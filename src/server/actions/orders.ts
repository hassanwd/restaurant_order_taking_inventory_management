"use server";

import { z } from "zod";
import { TABLES } from "@/data/tables";
import { nextStatus, round2 } from "@/lib/format";
import { can } from "@/lib/permissions";
import { computeTotals } from "@/lib/pricing";
import type { CartLine, Order, SelectedOption } from "@/lib/types";
import { mutate, recordAudit, type Database } from "../db";
import { buildCatalog, isOpen, visibleOrders } from "../data";
import { randomId } from "../security";
import {
  ActionError,
  authorize,
  cleanText,
  money,
  parse,
  requiredText,
  run,
  type ActionResult,
} from "./helpers";

const lineSchema = z.object({
  itemId: z.string().max(60),
  quantity: z
    .number({ error: "Quantity must be a number." })
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(99, "Quantity must be 99 or less."),
  options: z
    .array(z.object({ groupId: z.string().max(60), choiceId: z.string().max(60) }))
    .max(40),
  notes: cleanText(200, "Item note", true),
  /** Only honoured for roles holding `price.adjust` — see `buildLines`. */
  unitPrice: money("Price").optional(),
});

const customerSchema = z.object({
  name: cleanText(80, "Customer name"),
  phone: cleanText(30, "Phone").refine((value) => /^[0-9+()\-\s.]*$/.test(value), {
    message: "Phone can only contain digits, spaces and + ( ) - .",
  }),
  email: cleanText(120, "Email").refine(
    (value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    { message: "Enter a valid email address." },
  ),
  address: cleanText(200, "Location"),
});

const settleSchema = z.object({
  method: z.enum(["cash", "card"], { error: "Choose cash or card." }),
  amountTendered: money("Amount tendered", 10_000_000),
});

const placeSchema = z.object({
  type: z.enum(["dine-in", "takeaway", "parcel"]),
  tableId: z.string().max(20).nullable(),
  guests: z.number().int().min(1).max(30),
  customer: customerSchema,
  notes: cleanText(300, "Order note", true),
  discountPercent: z.number().min(0).max(100),
  lines: z.array(lineSchema).min(1, "Add at least one item to the order.").max(60),
  settle: settleSchema.nullable(),
});

export type PlaceOrderInput = z.input<typeof placeSchema>;

/**
 * The browser sends *what* was ordered; the server decides *what it costs*.
 * Names, icons, base prices and option prices are all re-read from the catalog,
 * so a tampered request cannot buy a steak for a cent. The one exception is an
 * explicit price override, which only roles with `price.adjust` may send.
 */
function buildLines(db: Database, inputs: z.output<typeof lineSchema>[], canAdjust: boolean) {
  const catalog = buildCatalog(db);
  const adjustments: string[] = [];

  const lines = inputs.map((input): CartLine => {
    const item = catalog.find((entry) => entry.id === input.itemId);
    if (!item) throw new ActionError("An item in this order is no longer on the menu.");
    if (!item.available) throw new ActionError(`${item.name} is not available right now.`);

    const options: SelectedOption[] = [];
    const seenGroups = new Set<string>();
    for (const picked of input.options) {
      const group = item.optionGroups.find((entry) => entry.id === picked.groupId);
      const choice = group?.choices.find((entry) => entry.id === picked.choiceId);
      if (!group || !choice) throw new ActionError(`An option for ${item.name} is no longer available.`);
      const key = `${group.id}:${choice.id}`;
      if (seenGroups.has(key)) throw new ActionError(`Duplicate option on ${item.name}.`);
      seenGroups.add(key);
      options.push({
        groupId: group.id,
        groupName: group.name,
        choiceId: choice.id,
        choiceName: choice.name,
        price: choice.price,
      });
    }

    for (const group of item.optionGroups) {
      const count = options.filter((option) => option.groupId === group.id).length;
      if (group.type === "single" && count > 1) {
        throw new ActionError(`Choose only one ${group.name.toLowerCase()} for ${item.name}.`);
      }
      if (group.type === "multi" && group.maxSelect && count > group.maxSelect) {
        throw new ActionError(`Choose up to ${group.maxSelect} ${group.name.toLowerCase()} for ${item.name}.`);
      }
      // A required "pick up to N" group can never exceed N (checked above), so requiring "at
      // least N" here means it must be exactly N.
      if (group.required && count < (group.maxSelect ?? 1)) {
        throw new ActionError(
          group.maxSelect
            ? `Choose ${group.maxSelect} ${group.name.toLowerCase()} for ${item.name}.`
            : `Choose a ${group.name.toLowerCase()} for ${item.name}.`,
        );
      }
    }

    let basePrice = item.price;
    if (input.unitPrice !== undefined && round2(input.unitPrice) !== round2(item.price)) {
      if (!canAdjust) throw new ActionError("You do not have permission to change prices.");
      basePrice = round2(input.unitPrice);
      adjustments.push(`${item.name}: ${item.price.toFixed(2)} → ${basePrice.toFixed(2)}`);
    }

    return {
      lineId: randomId("L"),
      itemId: item.id,
      name: item.name,
      image: item.image,
      basePrice,
      listPrice: item.price,
      quantity: input.quantity,
      options,
      notes: input.notes,
    };
  });

  return { lines, adjustments };
}

function settlement(
  method: "cash" | "card",
  amountTendered: number,
  total: number,
  code: string,
) {
  // An empty tender field means "exact cash"; cards are always charged exactly.
  const tendered = method === "cash" ? (amountTendered > 0 ? amountTendered : total) : total;
  if (method === "cash" && round2(tendered) < total) {
    throw new ActionError("The cash tendered does not cover the bill.");
  }
  return {
    method,
    amountTendered: round2(tendered),
    change: method === "cash" ? round2(tendered - total) : 0,
    reference: `${method.toUpperCase()}-${code.slice(-4)}`,
  };
}

export async function placeOrderAction(
  input: PlaceOrderInput,
): Promise<ActionResult<{ orderId: string }>> {
  return run(async () => {
    const user = await authorize("order.create");
    const data = parse(placeSchema, input);

    if (data.discountPercent > 0 && !can(user.role, "discount.apply")) {
      throw new ActionError("You do not have permission to apply discounts.");
    }
    if (data.settle && !can(user.role, "payment.settle")) {
      throw new ActionError("You do not have permission to take payment.");
    }

    // Dine-in and takeaway are paid first; only a parcel may be placed unpaid (paid on delivery).
    if (data.type !== "parcel" && !data.settle) {
      throw new ActionError("Take payment before placing a dine-in or takeaway order.");
    }

    if (!data.customer.name) throw new ActionError("Customer name is required.");
    if (data.type === "parcel") {
      if (!data.customer.phone) throw new ActionError("Contact number is required for parcel orders.");
      if (!data.customer.address) throw new ActionError("Location is required for parcel orders.");
    }

    const orderId = await mutate((db) => {
      if (data.type === "dine-in") {
        const table = TABLES.find((entry) => entry.id === data.tableId);
        if (!table) throw new ActionError("Select a table for dine-in.");
        // Checked against every employee's open orders, not just the caller's.
        const taken = db.orders.some((order) => order.tableId === table.id && isOpen(order));
        if (taken) {
          throw new ActionError(`${table.name} is already occupied.`);
        }
      }

      const { lines, adjustments } = buildLines(db, data.lines, can(user.role, "price.adjust"));
      const pricing = db.settings.pricing;
      const method = data.settle?.method ?? null;
      const totals = computeTotals({
        lines,
        orderType: data.type,
        discountPercent: data.discountPercent,
        pricing,
        method,
      });

      db.settings.orderCounter += 1;
      const code = `ORD-${db.settings.orderCounter}`;
      const now = new Date().toISOString();
      const payment = data.settle
        ? settlement(data.settle.method, data.settle.amountTendered, totals.total, code)
        : null;

      const order: Order = {
        id: code,
        code,
        type: data.type,
        tableId: data.type === "dine-in" ? data.tableId : null,
        guests: data.type === "dine-in" ? data.guests : 1,
        customer: data.customer,
        lines,
        notes: data.notes,
        discountPercent: data.discountPercent,
        totals,
        status: "pending",
        payment,
        paidAt: payment ? now : null,
        cashier: user.name,
        createdById: user.id,
        returned: null,
        cancelReason: null,
        createdAt: now,
        updatedAt: now,
      };
      db.orders.unshift(order);

      recordAudit(db, user, "order.place", `${code} · ${totals.total.toFixed(2)}${payment ? ` · paid ${payment.method}` : ""}`);
      if (adjustments.length > 0) {
        recordAudit(db, user, "price.adjust", `${code} · ${adjustments.join("; ")}`);
      }
      if (data.discountPercent > 0) {
        recordAudit(db, user, "discount.apply", `${code} · ${data.discountPercent}% off`);
      }
      return code;
    });

    return { ok: true, orderId };
  });
}

/** Finds an order the user may touch — a worker's own, or any for roles that see all. */
function ownedOrder(db: Database, user: Parameters<typeof visibleOrders>[1], id: string) {
  const visible = visibleOrders(db, user).find((order) => order.id === id);
  if (!visible) throw new ActionError("Order not found.");
  return db.orders.find((order) => order.id === id)!;
}

export async function advanceOrderAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize("order.advance");
    await mutate((db) => {
      const order = ownedOrder(db, user, String(id));
      const upcoming = nextStatus(order.status, order.type);
      if (!upcoming) throw new ActionError("This order cannot be advanced.");
      if (upcoming === "completed" && !order.payment) {
        throw new ActionError("Settle the bill before completing the order.");
      }
      if (upcoming === "completed" && !can(user.role, "payment.settle")) {
        throw new ActionError("Only a cashier can complete an order.");
      }
      order.status = upcoming;
      order.updatedAt = new Date().toISOString();
      recordAudit(db, user, "order.status", `${order.code} → ${upcoming}`);
    });
    return { ok: true };
  });
}

const reasonSchema = requiredText(3, 200, "Reason");

export async function cancelOrderAction(id: string, reason: string): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize("order.cancel");
    const text = parse(reasonSchema, reason);
    await mutate((db) => {
      const order = ownedOrder(db, user, String(id));
      if (!isOpen(order)) throw new ActionError("Only orders that are not yet completed can be cancelled.");
      const now = new Date().toISOString();
      order.status = "cancelled";
      order.cancelReason = text;
      // A cancelled order that was already paid is refunded, and the refund is recorded.
      if (order.payment) {
        order.returned = {
          reason: `Cancelled after payment — ${text}`,
          amount: order.totals.total,
          at: now,
          byId: user.id,
          byName: user.name,
        };
      }
      order.updatedAt = now;
      recordAudit(
        db,
        user,
        "order.cancel",
        `${order.code} · ${text}${order.payment ? ` · refund ${order.totals.total.toFixed(2)}` : ""}`,
      );
    });
    return { ok: true };
  });
}

export async function returnOrderAction(id: string, reason: string): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize("order.return");
    const text = parse(reasonSchema, reason);
    await mutate((db) => {
      const order = ownedOrder(db, user, String(id));
      // Before completion any role holding order.return may return an order; after completion
      // only roles with order.return.completed may.
      if (order.status === "completed") {
        if (!can(user.role, "order.return.completed")) {
          throw new ActionError("You do not have permission to return a completed order.");
        }
      } else if (!isOpen(order)) {
        throw new ActionError("This order can no longer be returned.");
      }
      const now = new Date().toISOString();
      const refund = order.payment ? order.totals.total : 0;
      order.status = "returned";
      order.returned = {
        reason: text,
        amount: refund,
        at: now,
        byId: user.id,
        byName: user.name,
      };
      order.updatedAt = now;
      recordAudit(db, user, "order.return", `${order.code} · refund ${refund.toFixed(2)} · ${text}`);
    });
    return { ok: true };
  });
}

export async function settleOrderAction(
  id: string,
  input: z.input<typeof settleSchema>,
): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize("payment.settle");
    const data = parse(settleSchema, input);
    await mutate((db) => {
      const order = ownedOrder(db, user, String(id));
      if (order.payment) throw new ActionError("This bill has already been settled.");
      if (order.status === "cancelled" || order.status === "returned") {
        throw new ActionError("This order can no longer be paid.");
      }

      // GST is decided by how the bill is settled, so the totals are re-priced here.
      const totals = computeTotals({
        lines: order.lines,
        orderType: order.type,
        discountPercent: order.discountPercent,
        pricing: db.settings.pricing,
        method: data.method,
      });
      const now = new Date().toISOString();
      order.totals = totals;
      order.payment = settlement(data.method, data.amountTendered, totals.total, order.code);
      order.paidAt = now;
      // A parcel that is out for delivery is finished the moment the money is received.
      if (order.status === "delivery") order.status = "completed";
      order.updatedAt = now;
      recordAudit(
        db,
        user,
        "order.settle",
        `${order.code} · ${data.method} · ${totals.total.toFixed(2)} (GST ${totals.taxRate}%)`,
      );
    });
    return { ok: true };
  });
}

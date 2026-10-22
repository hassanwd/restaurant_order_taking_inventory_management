import "server-only";

import { round2 } from "@/lib/format";
import type { InventoryMovement, Order, PaymentMethod } from "@/lib/types";
import { getDb } from "./db";

export type Period = "daily" | "weekly" | "monthly";

export interface Range {
  period: Period;
  /** Inclusive start / exclusive end, as ISO timestamps (UTC). */
  from: string;
  to: string;
  /** First and last calendar day covered, `YYYY-MM-DD`. */
  firstDay: string;
  lastDay: string;
  label: string;
  /** The anchor date, plus neighbours for the previous/next links. */
  date: string;
  previous: string;
  next: string;
}

const DAY = 86_400_000;
const dayString = (date: Date) => date.toISOString().slice(0, 10);
const parseDay = (value: string | undefined) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    ? new Date(`${value}T00:00:00Z`)
    : null;

const labelFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});
const monthFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export const isPeriod = (value: unknown): value is Period =>
  value === "daily" || value === "weekly" || value === "monthly";

/** Resolves a period + anchor date into the exact window to report on. Weeks run Monday–Sunday. */
export function resolveRange(period: Period, dateInput?: string): Range {
  const anchor = parseDay(dateInput) ?? new Date(`${dayString(new Date())}T00:00:00Z`);

  let start: Date;
  let end: Date;
  let previous: Date;
  let next: Date;
  let label: string;

  if (period === "daily") {
    start = anchor;
    end = new Date(start.getTime() + DAY);
    previous = new Date(start.getTime() - DAY);
    next = end;
    label = labelFormat.format(start);
  } else if (period === "weekly") {
    const weekday = (anchor.getUTCDay() + 6) % 7; // Monday = 0
    start = new Date(anchor.getTime() - weekday * DAY);
    end = new Date(start.getTime() + 7 * DAY);
    previous = new Date(start.getTime() - 7 * DAY);
    next = end;
    label = `${labelFormat.format(start)} – ${labelFormat.format(new Date(end.getTime() - DAY))}`;
  } else {
    start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
    previous = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1));
    next = end;
    label = monthFormat.format(start);
  }

  return {
    period,
    from: start.toISOString(),
    to: end.toISOString(),
    firstDay: dayString(start),
    lastDay: dayString(new Date(end.getTime() - DAY)),
    label,
    date: dayString(anchor),
    previous: dayString(previous),
    next: dayString(next),
  };
}

const inRange = (iso: string, range: Range) => iso >= range.from && iso < range.to;
const sum = (values: number[]) => round2(values.reduce((total, value) => total + value, 0));

export const isSale = (order: Order) => order.status !== "cancelled" && order.status !== "returned";

export interface OrdersReport {
  placed: number;
  returned: number;
  cancelled: number;
  completed: number;
  open: number;
  /** Orders placed in the window (any final status), newest first. */
  placedOrders: Order[];
  /** Orders refunded in the window, newest refund first. */
  returnedOrders: Order[];
  byDay: { day: string; placed: number; returned: number; sales: number }[];
}

export interface BillingReport {
  billed: number;
  collected: number;
  outstanding: number;
  refunds: number;
  netSales: number;
  subtotal: number;
  discounts: number;
  serviceCharges: number;
  parcelFees: number;
  tax: number;
  averageTicket: number;
  byMethod: Record<PaymentMethod, { count: number; amount: number; tax: number }>;
  byEmployee: { name: string; orders: number; sales: number }[];
  bills: Order[];
}

export interface InventoryReportRow {
  itemId: string;
  name: string;
  unit: string;
  opening: number;
  received: number;
  out: number;
  used: number;
  closing: number;
  reorderLevel: number;
  low: boolean;
}

export interface Report {
  range: Range;
  orders: OrdersReport;
  billing: BillingReport;
  inventory: InventoryReportRow[];
}

const round3 = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;

function buildOrdersReport(all: Order[], range: Range): OrdersReport {
  const placedOrders = all.filter((order) => inRange(order.createdAt, range));
  const returnedOrders = all
    .filter((order) => order.returned && inRange(order.returned.at, range))
    .sort((a, b) => (b.returned?.at ?? "").localeCompare(a.returned?.at ?? ""));

  const days = new Map<string, { day: string; placed: number; returned: number; sales: number }>();
  for (let cursor = Date.parse(range.from); cursor < Date.parse(range.to); cursor += DAY) {
    const day = dayString(new Date(cursor));
    days.set(day, { day, placed: 0, returned: 0, sales: 0 });
  }
  for (const order of placedOrders) {
    const bucket = days.get(order.createdAt.slice(0, 10));
    if (!bucket) continue;
    bucket.placed += 1;
    if (isSale(order)) bucket.sales = round2(bucket.sales + order.totals.total);
  }
  for (const order of returnedOrders) {
    const bucket = days.get(order.returned!.at.slice(0, 10));
    if (bucket) bucket.returned += 1;
  }

  return {
    placed: placedOrders.length,
    returned: returnedOrders.length,
    cancelled: placedOrders.filter((order) => order.status === "cancelled").length,
    completed: placedOrders.filter((order) => order.status === "completed").length,
    open: placedOrders.filter((order) =>
      ["pending", "preparing", "ready", "delivery"].includes(order.status),
    ).length,
    placedOrders: placedOrders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    returnedOrders,
    byDay: [...days.values()],
  };
}

function buildBillingReport(all: Order[], range: Range): BillingReport {
  const bills = all
    .filter((order) => inRange(order.createdAt, range) && isSale(order))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const paid = bills.filter((order) => order.payment);
  const refunds = sum(
    all
      .filter((order) => order.returned && inRange(order.returned.at, range))
      .map((order) => order.returned!.amount),
  );

  const byMethod: BillingReport["byMethod"] = {
    cash: { count: 0, amount: 0, tax: 0 },
    card: { count: 0, amount: 0, tax: 0 },
  };
  for (const order of paid) {
    const bucket = byMethod[order.payment!.method];
    bucket.count += 1;
    bucket.amount = round2(bucket.amount + order.totals.total);
    bucket.tax = round2(bucket.tax + order.totals.tax);
  }

  const employees = new Map<string, { name: string; orders: number; sales: number }>();
  for (const order of bills) {
    const entry = employees.get(order.createdById) ?? { name: order.cashier, orders: 0, sales: 0 };
    entry.orders += 1;
    entry.sales = round2(entry.sales + order.totals.total);
    employees.set(order.createdById, entry);
  }

  const billed = sum(bills.map((order) => order.totals.total));
  const collected = sum(paid.map((order) => order.totals.total));

  return {
    billed,
    collected,
    outstanding: round2(billed - collected),
    refunds,
    netSales: round2(collected - refunds),
    subtotal: sum(bills.map((order) => order.totals.subtotal)),
    discounts: sum(bills.map((order) => order.totals.discount)),
    serviceCharges: sum(bills.map((order) => order.totals.serviceCharge)),
    parcelFees: sum(bills.map((order) => order.totals.deliveryFee)),
    tax: sum(bills.map((order) => order.totals.tax)),
    averageTicket: bills.length ? round2(billed / bills.length) : 0,
    byMethod,
    byEmployee: [...employees.values()].sort((a, b) => b.sales - a.sales),
    bills,
  };
}

const signed = (movement: InventoryMovement) =>
  movement.type === "in" ? movement.quantity : -movement.quantity;

function buildInventoryReport(
  items: { id: string; name: string; unit: string; quantity: number; reorderLevel: number }[],
  movements: InventoryMovement[],
  range: Range,
): InventoryReportRow[] {
  return items
    .map((item) => {
      const mine = movements.filter((movement) => movement.itemId === item.id);
      const within = mine.filter((movement) => inRange(movement.at, range));
      const after = mine.filter((movement) => movement.at >= range.to);

      const closing = round3(item.quantity - after.reduce((total, m) => total + signed(m), 0));
      const received = round3(within.filter((m) => m.type === "in").reduce((t, m) => t + m.quantity, 0));
      const out = round3(within.filter((m) => m.type === "out").reduce((t, m) => t + m.quantity, 0));
      const used = round3(within.filter((m) => m.type === "usage").reduce((t, m) => t + m.quantity, 0));

      return {
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        opening: round3(closing - received + out + used),
        received,
        out,
        used,
        closing,
        reorderLevel: item.reorderLevel,
        low: item.quantity <= item.reorderLevel,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function buildReport(period: Period, date?: string): Promise<Report> {
  const db = await getDb();
  const range = resolveRange(period, date);
  return {
    range,
    orders: buildOrdersReport(db.orders, range),
    billing: buildBillingReport(db.orders, range),
    inventory: buildInventoryReport(db.inventory, db.movements, range),
  };
}

/** Sales records for the Billing screen — every bill in an arbitrary day range. */
export async function buildBillingRange(from: string, to: string): Promise<BillingReport> {
  const db = await getDb();
  const start = parseDay(from) ?? new Date(`${dayString(new Date())}T00:00:00Z`);
  const end = parseDay(to) ?? start;
  const range: Range = {
    period: "daily",
    from: start.toISOString(),
    to: new Date(end.getTime() + DAY).toISOString(),
    firstDay: dayString(start),
    lastDay: dayString(end),
    label: "",
    date: dayString(start),
    previous: "",
    next: "",
  };
  return buildBillingReport(db.orders, range);
}

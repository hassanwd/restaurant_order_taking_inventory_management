"use server";

import { z } from "zod";
import { ASSIGNABLE_CATEGORIES } from "@/data/menu";
import { round2 } from "@/lib/format";
import type { MenuItem, OptionChoice, OptionGroup, Pricing } from "@/lib/types";
import { mutate, recordAudit } from "../db";
import { randomId } from "../security";
import {
  ActionError,
  authorize,
  cleanText,
  money,
  parse,
  quantity,
  requiredText,
  run,
  type ActionResult,
} from "./helpers";

/* ---------------------------------------------------------------- menu */

const CATEGORY_IDS = ASSIGNABLE_CATEGORIES.map((category) => category.id);
const CATEGORY_ICON = Object.fromEntries(ASSIGNABLE_CATEGORIES.map((c) => [c.id, c.icon]));

const menuItemSchema = z.object({
  name: requiredText(2, 60, "Name"),
  description: cleanText(160, "Description"),
  price: money("Price", 10000).refine((value) => value > 0, { message: "Price must be greater than zero." }),
  categoryId: z.enum(CATEGORY_IDS as [string, ...string[]], { error: "Choose a category." }),
  icon: cleanText(8, "Icon"),
  prepMinutes: z.number().int().min(1, "Prep time must be at least 1 minute.").max(180),
  available: z.boolean(),
  tags: cleanText(80, "Tags"),
  /** One add-on per line: `Name | price`. */
  addOns: cleanText(600, "Add-ons", true),
});

function parseAddOns(text: string): OptionGroup[] {
  const rows = text
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean);
  if (rows.length === 0) return [];
  if (rows.length > 12) throw new ActionError("Add at most 12 add-ons per item.");

  const choices: OptionChoice[] = rows.map((row, index) => {
    const [rawName, rawPrice = "0"] = row.split("|").map((part) => part.trim());
    const price = Number(rawPrice);
    if (!rawName || rawName.length > 40 || !Number.isFinite(price) || price < 0 || price > 1000) {
      throw new ActionError(`Add-on ${index + 1} must look like "Extra cheese | 1.50".`);
    }
    return { id: `${rawName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "addon"}-${index}`, name: rawName, price: round2(price) };
  });
  return [{ id: "addons", name: "Add-ons", type: "multi", required: false, choices }];
}

export async function createMenuItemAction(
  input: z.input<typeof menuItemSchema>,
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const user = await authorize("menu.manage");
    const data = parse(menuItemSchema, input);

    const item: MenuItem = {
      id: randomId("itm"),
      name: data.name,
      description: data.description,
      price: round2(data.price),
      categoryId: data.categoryId,
      icon: data.icon || CATEGORY_ICON[data.categoryId] || "🍽️",
      prepMinutes: data.prepMinutes,
      available: data.available,
      tags: data.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 6),
      popular: false,
      optionGroups: parseAddOns(data.addOns),
    };

    await mutate((db) => {
      if (db.menuItems.some((entry) => entry.name.toLowerCase() === item.name.toLowerCase())) {
        throw new ActionError("A menu item with that name already exists.");
      }
      db.menuItems.push(item);
      recordAudit(db, user, "menu.create", `${item.name} · ${item.price.toFixed(2)}`);
    });
    return { ok: true, id: item.id };
  });
}

const updateSchema = z.object({
  id: z.string().max(60),
  price: money("Price", 10000).refine((value) => value > 0, { message: "Price must be greater than zero." }).optional(),
  available: z.boolean().optional(),
});

export async function updateMenuItemAction(
  input: z.input<typeof updateSchema>,
): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize("menu.manage");
    const data = parse(updateSchema, input);
    await mutate((db) => {
      const item = db.menuItems.find((entry) => entry.id === data.id);
      if (!item) throw new ActionError("Menu item not found.");
      if (data.price !== undefined && round2(data.price) !== item.price) {
        recordAudit(db, user, "menu.price", `${item.name}: ${item.price.toFixed(2)} → ${round2(data.price).toFixed(2)}`);
        item.price = round2(data.price);
      }
      if (data.available !== undefined && data.available !== item.available) {
        item.available = data.available;
        recordAudit(db, user, "menu.availability", `${item.name} → ${data.available ? "available" : "sold out"}`);
      }
    });
    return { ok: true };
  });
}

export async function deleteMenuItemAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize("menu.manage");
    await mutate((db) => {
      const item = db.menuItems.find((entry) => entry.id === String(id));
      if (!item) throw new ActionError("Menu item not found.");
      const deal = db.deals.find((entry) => entry.items.some((part) => part.itemId === item.id));
      if (deal) throw new ActionError(`Remove ${item.name} from the "${deal.name}" deal first.`);
      db.menuItems = db.menuItems.filter((entry) => entry.id !== item.id);
      recordAudit(db, user, "menu.delete", item.name);
    });
    return { ok: true };
  });
}

/* ---------------------------------------------------------------- deals */

const dealSchema = z.object({
  name: requiredText(2, 60, "Deal name"),
  description: cleanText(160, "Description"),
  price: money("Deal price", 10000).refine((value) => value > 0, { message: "Price must be greater than zero." }),
  items: z
    .array(z.object({ itemId: z.string().max(60), quantity: z.number().int().min(1).max(20) }))
    .min(1, "Pick at least one item for the deal.")
    .max(15),
});

export async function createDealAction(input: z.input<typeof dealSchema>): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize("deals.manage");
    const data = parse(dealSchema, input);
    await mutate((db) => {
      for (const part of data.items) {
        if (!db.menuItems.some((item) => item.id === part.itemId)) {
          throw new ActionError("A selected item no longer exists.");
        }
      }
      if (db.deals.some((deal) => deal.name.toLowerCase() === data.name.toLowerCase())) {
        throw new ActionError("A deal with that name already exists.");
      }
      db.deals.push({
        id: randomId("deal"),
        name: data.name,
        description: data.description,
        price: round2(data.price),
        items: data.items,
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
      });
      recordAudit(db, user, "deal.create", `${data.name} · ${round2(data.price).toFixed(2)}`);
    });
    return { ok: true };
  });
}

export async function setDealActiveAction(id: string, active: boolean): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize("deals.manage");
    await mutate((db) => {
      const deal = db.deals.find((entry) => entry.id === String(id));
      if (!deal) throw new ActionError("Deal not found.");
      deal.active = Boolean(active);
      recordAudit(db, user, "deal.toggle", `${deal.name} → ${deal.active ? "active" : "paused"}`);
    });
    return { ok: true };
  });
}

export async function deleteDealAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize("deals.manage");
    await mutate((db) => {
      const deal = db.deals.find((entry) => entry.id === String(id));
      if (!deal) throw new ActionError("Deal not found.");
      db.deals = db.deals.filter((entry) => entry.id !== deal.id);
      recordAudit(db, user, "deal.delete", deal.name);
    });
    return { ok: true };
  });
}

/* ------------------------------------------------------------ inventory */

const round3 = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;

const inventoryItemSchema = z.object({
  name: requiredText(2, 60, "Name"),
  unit: requiredText(1, 12, "Unit"),
  quantity: money("Opening quantity", 1_000_000),
  reorderLevel: money("Reorder level", 1_000_000),
});

export async function createInventoryItemAction(
  input: z.input<typeof inventoryItemSchema>,
): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize("inventory.manage");
    const data = parse(inventoryItemSchema, input);
    await mutate((db) => {
      if (db.inventory.some((item) => item.name.toLowerCase() === data.name.toLowerCase())) {
        throw new ActionError("An inventory item with that name already exists.");
      }
      const now = new Date().toISOString();
      const item = {
        id: randomId("inv"),
        name: data.name,
        unit: data.unit,
        quantity: round3(data.quantity),
        reorderLevel: round3(data.reorderLevel),
        createdAt: now,
      };
      db.inventory.push(item);
      if (item.quantity > 0) {
        db.movements.unshift({
          id: randomId("mov"),
          itemId: item.id,
          itemName: item.name,
          type: "in",
          quantity: item.quantity,
          balanceAfter: item.quantity,
          note: "Opening stock",
          at: now,
          byId: user.id,
          byName: user.name,
        });
      }
      recordAudit(db, user, "inventory.create", `${item.name} (${item.unit})`);
    });
    return { ok: true };
  });
}

export async function deleteInventoryItemAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize("inventory.manage");
    await mutate((db) => {
      const item = db.inventory.find((entry) => entry.id === String(id));
      if (!item) throw new ActionError("Inventory item not found.");
      // Movement rows keep the item's name, so past records stay readable after deletion.
      db.inventory = db.inventory.filter((entry) => entry.id !== item.id);
      recordAudit(db, user, "inventory.delete", `${item.name} (${item.quantity} ${item.unit} on hand)`);
    });
    return { ok: true };
  });
}

const movementSchema = z.object({
  itemId: z.string().max(60),
  type: z.enum(["in", "out", "usage"], { error: "Choose a movement type." }),
  quantity: quantity("Quantity"),
  note: cleanText(120, "Note"),
});

export async function recordMovementAction(
  input: z.input<typeof movementSchema>,
): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize("inventory.manage");
    const data = parse(movementSchema, input);
    await mutate((db) => {
      const item = db.inventory.find((entry) => entry.id === data.itemId);
      if (!item) throw new ActionError("Inventory item not found.");
      const amount = round3(data.quantity);
      const balance = round3(data.type === "in" ? item.quantity + amount : item.quantity - amount);
      if (balance < 0) {
        throw new ActionError(`Only ${item.quantity} ${item.unit} of ${item.name} is on hand.`);
      }
      item.quantity = balance;
      db.movements.unshift({
        id: randomId("mov"),
        itemId: item.id,
        itemName: item.name,
        type: data.type,
        quantity: amount,
        balanceAfter: balance,
        note: data.note,
        at: new Date().toISOString(),
        byId: user.id,
        byName: user.name,
      });
      // Keep the trail bounded; reports only ever look at recent history.
      if (db.movements.length > 5000) db.movements.length = 5000;
    });
    return { ok: true };
  });
}

/* -------------------------------------------------------------- pricing */

const pricingSchema = z.object({
  taxRateCash: z.number().min(0, "GST cannot be negative.").max(50, "GST must be 50% or less."),
  taxRateCard: z.number().min(0, "GST cannot be negative.").max(50, "GST must be 50% or less."),
  serviceChargeRate: z.number().min(0).max(30, "Service charge must be 30% or less."),
  serviceChargeAppliesTo: z.array(z.enum(["dine-in", "takeaway", "parcel"])).max(3),
  parcelFee: money("Parcel fee", 1000),
});

export async function updatePricingAction(
  input: z.input<typeof pricingSchema>,
): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize("pricing.manage");
    const data = parse(pricingSchema, input);
    const next: Pricing = {
      taxRateCash: round2(data.taxRateCash),
      taxRateCard: round2(data.taxRateCard),
      serviceChargeRate: round2(data.serviceChargeRate),
      serviceChargeAppliesTo: [...new Set(data.serviceChargeAppliesTo)],
      parcelFee: round2(data.parcelFee),
    };
    await mutate((db) => {
      db.settings.pricing = next;
      recordAudit(
        db,
        user,
        "pricing.update",
        `GST cash ${next.taxRateCash}% · card ${next.taxRateCard}% · service ${next.serviceChargeRate}% · parcel ${next.parcelFee}`,
      );
    });
    return { ok: true };
  });
}

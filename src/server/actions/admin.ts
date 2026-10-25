"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { ASSIGNABLE_CATEGORIES } from "@/data/menu";
import { round2 } from "@/lib/format";
import type { DealComponent, MenuItem, OptionGroup, Pricing } from "@/lib/types";
import { recordAudit } from "../db";
import { prisma } from "../prisma";
import { randomId } from "../security";
import {
  ActionError,
  authorize,
  cleanText,
  imagePath,
  money,
  optionalText,
  parse,
  requiredText,
  run,
  type ActionResult,
} from "./helpers";

/* ---------------------------------------------------------------- menu */

const CATEGORY_IDS = ASSIGNABLE_CATEGORIES.map((category) => category.id);

/** A choice within an option group, as submitted from the admin's option-group editor. */
const optionChoiceInput = z.object({
  name: requiredText(1, 40, "Choice name"),
  price: money("Choice price", 1000),
});

/** A customization group — e.g. "Dip Sauce, pick 1" — shared by menu items and deals. */
const optionGroupInput = z
  .object({
    name: requiredText(1, 40, "Option group name"),
    type: z.enum(["single", "multi"]),
    required: z.boolean(),
    /** `multi` groups only: caps how many choices can be picked; absent/null means no limit. */
    maxSelect: z.number().int().min(1, "Must allow at least 1 choice.").max(12, "At most 12 choices can be picked.").nullable().optional(),
    choices: z.array(optionChoiceInput).min(1, "Each option group needs at least one choice.").max(12, "At most 12 choices per group."),
  })
  .refine((group) => group.maxSelect == null || group.maxSelect <= group.choices.length, {
    message: "The selection limit can't be more than the number of choices.",
    path: ["maxSelect"],
  });

const optionGroupsInput = z.array(optionGroupInput).max(8, "At most 8 option groups.");

/** Stamps ids onto the admin's draft groups/choices to make them real `OptionGroup[]`. */
function buildOptionGroups(groups: z.output<typeof optionGroupsInput>): OptionGroup[] {
  return groups.map((group) => ({
    id: randomId("grp"),
    name: group.name,
    type: group.type,
    required: group.required,
    // A single-choice pick is inherently capped at 1 — the limit only ever applies to "multi".
    maxSelect: group.type === "multi" ? (group.maxSelect ?? null) : null,
    choices: group.choices.map((choice) => ({
      id: randomId("choice"),
      name: choice.name,
      price: round2(choice.price),
    })),
  }));
}

const asJson = (value: unknown) => value as unknown as Prisma.InputJsonValue;

const menuItemSchema = z.object({
  name: requiredText(2, 60, "Name"),
  description: cleanText(160, "Description"),
  price: money("Price", 10000).refine((value) => value > 0, { message: "Price must be greater than zero." }),
  categoryId: z.enum(CATEGORY_IDS as [string, ...string[]], { error: "Choose a category." }),
  image: imagePath("Photo"),
  ingredients: optionalText(400, "Ingredients", true),
  prepMinutes: z.number().int().min(1, "Prep time must be at least 1 minute.").max(180),
  available: z.boolean(),
  tags: cleanText(80, "Tags"),
  optionGroups: optionGroupsInput,
});

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
      image: data.image,
      ingredients: data.ingredients,
      prepMinutes: data.prepMinutes,
      available: data.available,
      tags: data.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 6),
      popular: false,
      optionGroups: buildOptionGroups(data.optionGroups),
    };

    await prisma.$transaction(async (tx) => {
      const duplicate = await tx.menuItem.findFirst({
        where: { name: { equals: item.name, mode: "insensitive" } },
      });
      if (duplicate) throw new ActionError("A menu item with that name already exists.");
      await tx.menuItem.create({
        data: {
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          categoryId: item.categoryId,
          image: item.image,
          ingredients: item.ingredients,
          prepMinutes: item.prepMinutes,
          available: item.available,
          tags: item.tags,
          popular: item.popular ?? false,
          optionGroups: asJson(item.optionGroups),
        },
      });
      await recordAudit(tx, user, "menu.create", `${item.name} · ${item.price.toFixed(2)}`);
    });
    return { ok: true, id: item.id };
  });
}

const updateSchema = z.object({
  id: z.string().max(60),
  name: requiredText(2, 60, "Name").optional(),
  description: cleanText(160, "Description").optional(),
  categoryId: z.enum(CATEGORY_IDS as [string, ...string[]], { error: "Choose a category." }).optional(),
  price: money("Price", 10000).refine((value) => value > 0, { message: "Price must be greater than zero." }).optional(),
  available: z.boolean().optional(),
  image: imagePath("Photo").optional(),
  ingredients: optionalText(400, "Ingredients", true).optional(),
  prepMinutes: z.number().int().min(1, "Prep time must be at least 1 minute.").max(180).optional(),
  tags: cleanText(80, "Tags").optional(),
  optionGroups: optionGroupsInput.optional(),
});

export async function updateMenuItemAction(
  input: z.input<typeof updateSchema>,
): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize("menu.manage");
    const data = parse(updateSchema, input);
    await prisma.$transaction(async (tx) => {
      const item = await tx.menuItem.findUnique({ where: { id: data.id } });
      if (!item) throw new ActionError("Menu item not found.");
      const originalName = item.name;
      const updates: Prisma.MenuItemUpdateInput = {};

      if (data.name !== undefined && data.name !== item.name) {
        const duplicate = await tx.menuItem.findFirst({
          where: { id: { not: item.id }, name: { equals: data.name, mode: "insensitive" } },
        });
        if (duplicate) throw new ActionError("A menu item with that name already exists.");
        await recordAudit(tx, user, "menu.rename", `${item.name} renamed to ${data.name}`);
        updates.name = data.name;
      }
      const nextTags = data.tags
        ?.split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 6);
      const detailsChanged =
        (data.description !== undefined && data.description !== item.description) ||
        (data.categoryId !== undefined && data.categoryId !== item.categoryId) ||
        (data.ingredients !== undefined && data.ingredients !== item.ingredients) ||
        (data.prepMinutes !== undefined && data.prepMinutes !== item.prepMinutes) ||
        (nextTags !== undefined && nextTags.join(",") !== item.tags.join(",")) ||
        data.optionGroups !== undefined;
      if (data.description !== undefined) updates.description = data.description;
      if (data.categoryId !== undefined) updates.categoryId = data.categoryId;
      if (data.ingredients !== undefined) updates.ingredients = data.ingredients;
      if (data.prepMinutes !== undefined) updates.prepMinutes = data.prepMinutes;
      if (nextTags !== undefined) updates.tags = { set: nextTags };
      if (data.optionGroups !== undefined) updates.optionGroups = asJson(buildOptionGroups(data.optionGroups));
      if (detailsChanged) await recordAudit(tx, user, "menu.update", `${originalName}: details updated`);
      if (data.price !== undefined && round2(data.price) !== item.price) {
        await recordAudit(tx, user, "menu.price", `${item.name}: ${item.price.toFixed(2)} → ${round2(data.price).toFixed(2)}`);
        updates.price = round2(data.price);
      }
      if (data.available !== undefined && data.available !== item.available) {
        updates.available = data.available;
        await recordAudit(tx, user, "menu.availability", `${item.name} → ${data.available ? "available" : "sold out"}`);
      }
      if (data.image !== undefined && data.image !== item.image) {
        updates.image = data.image;
        await recordAudit(tx, user, "menu.image", `${item.name} image ${data.image ? "updated" : "cleared"}`);
      }
      if (Object.keys(updates).length > 0) {
        await tx.menuItem.update({ where: { id: item.id }, data: updates });
      }
    });
    return { ok: true };
  });
}

export async function deleteMenuItemAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize("menu.manage");
    await prisma.$transaction(async (tx) => {
      const item = await tx.menuItem.findUnique({ where: { id: String(id) } });
      if (!item) throw new ActionError("Menu item not found.");
      const deals = await tx.deal.findMany({ select: { id: true, name: true, items: true } });
      const blocking = deals.find((entry) =>
        (entry.items as unknown as DealComponent[]).some((part) => part.itemId === item.id),
      );
      if (blocking) throw new ActionError(`Remove ${item.name} from the "${blocking.name}" deal first.`);
      await tx.menuItem.delete({ where: { id: item.id } });
      await recordAudit(tx, user, "menu.delete", item.name);
    });
    return { ok: true };
  });
}

/* ---------------------------------------------------------------- deals */

const dealPartsSchema = z
  .array(z.object({ itemId: z.string().max(60), quantity: z.number().int().min(1).max(20) }))
  .min(1, "Pick at least one item for the deal.")
  .max(15);

const dealSchema = z.object({
  name: requiredText(2, 60, "Deal name"),
  description: cleanText(160, "Description"),
  price: money("Deal price", 10000).refine((value) => value > 0, { message: "Price must be greater than zero." }),
  image: imagePath("Photo"),
  ingredients: optionalText(400, "Ingredients", true),
  items: dealPartsSchema,
  optionGroups: optionGroupsInput,
});

async function assertItemsExist(tx: Prisma.TransactionClient, items: z.output<typeof dealPartsSchema>) {
  const uniqueIds = [...new Set(items.map((part) => part.itemId))];
  const found = await tx.menuItem.findMany({ where: { id: { in: uniqueIds } }, select: { id: true } });
  if (found.length !== uniqueIds.length) throw new ActionError("A selected item no longer exists.");
}

export async function createDealAction(input: z.input<typeof dealSchema>): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize("deals.manage");
    const data = parse(dealSchema, input);
    await prisma.$transaction(async (tx) => {
      await assertItemsExist(tx, data.items);
      const duplicate = await tx.deal.findFirst({ where: { name: { equals: data.name, mode: "insensitive" } } });
      if (duplicate) throw new ActionError("A deal with that name already exists.");
      await tx.deal.create({
        data: {
          id: randomId("deal"),
          name: data.name,
          description: data.description,
          price: round2(data.price),
          items: asJson(data.items),
          image: data.image,
          ingredients: data.ingredients,
          optionGroups: asJson(buildOptionGroups(data.optionGroups)),
          active: true,
          createdBy: user.id,
        },
      });
      await recordAudit(tx, user, "deal.create", `${data.name} · ${round2(data.price).toFixed(2)}`);
    });
    return { ok: true };
  });
}

const dealUpdateSchema = z.object({
  id: z.string().max(60),
  name: requiredText(2, 60, "Deal name").optional(),
  description: cleanText(160, "Description").optional(),
  price: money("Deal price", 10000).refine((value) => value > 0, { message: "Price must be greater than zero." }).optional(),
  image: imagePath("Photo").optional(),
  ingredients: optionalText(400, "Ingredients", true).optional(),
  items: dealPartsSchema.optional(),
  optionGroups: optionGroupsInput.optional(),
});

export async function updateDealAction(input: z.input<typeof dealUpdateSchema>): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize("deals.manage");
    const data = parse(dealUpdateSchema, input);
    await prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({ where: { id: data.id } });
      if (!deal) throw new ActionError("Deal not found.");
      if (data.items !== undefined) await assertItemsExist(tx, data.items);

      const originalName = deal.name;
      const updates: Prisma.DealUpdateInput = {};
      if (data.name !== undefined && data.name !== deal.name) {
        const duplicate = await tx.deal.findFirst({
          where: { id: { not: deal.id }, name: { equals: data.name, mode: "insensitive" } },
        });
        if (duplicate) throw new ActionError("A deal with that name already exists.");
        await recordAudit(tx, user, "deal.rename", `${deal.name} renamed to ${data.name}`);
        updates.name = data.name;
      }
      const detailsChanged =
        (data.description !== undefined && data.description !== deal.description) ||
        (data.ingredients !== undefined && data.ingredients !== deal.ingredients) ||
        (data.items !== undefined && JSON.stringify(data.items) !== JSON.stringify(deal.items)) ||
        data.optionGroups !== undefined;
      if (data.description !== undefined) updates.description = data.description;
      if (data.ingredients !== undefined) updates.ingredients = data.ingredients;
      if (data.items !== undefined) updates.items = asJson(data.items);
      if (data.optionGroups !== undefined) updates.optionGroups = asJson(buildOptionGroups(data.optionGroups));
      if (detailsChanged) await recordAudit(tx, user, "deal.update", `${originalName}: details updated`);
      if (data.price !== undefined && round2(data.price) !== deal.price) {
        await recordAudit(tx, user, "deal.price", `${deal.name}: ${deal.price.toFixed(2)} → ${round2(data.price).toFixed(2)}`);
        updates.price = round2(data.price);
      }
      if (data.image !== undefined && data.image !== deal.image) {
        updates.image = data.image;
        await recordAudit(tx, user, "deal.image", `${deal.name} image ${data.image ? "updated" : "cleared"}`);
      }
      if (Object.keys(updates).length > 0) {
        await tx.deal.update({ where: { id: deal.id }, data: updates });
      }
    });
    return { ok: true };
  });
}

const dealImageSchema = z.object({ id: z.string().max(60), image: imagePath("Photo") });

export async function updateDealImageAction(
  input: z.input<typeof dealImageSchema>,
): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize("deals.manage");
    const data = parse(dealImageSchema, input);
    await prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({ where: { id: data.id } });
      if (!deal) throw new ActionError("Deal not found.");
      await tx.deal.update({ where: { id: deal.id }, data: { image: data.image } });
      await recordAudit(tx, user, "deal.image", `${deal.name} image ${data.image ? "updated" : "cleared"}`);
    });
    return { ok: true };
  });
}

export async function setDealActiveAction(id: string, active: boolean): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize("deals.manage");
    await prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({ where: { id: String(id) } });
      if (!deal) throw new ActionError("Deal not found.");
      const next = Boolean(active);
      await tx.deal.update({ where: { id: deal.id }, data: { active: next } });
      await recordAudit(tx, user, "deal.toggle", `${deal.name} → ${next ? "active" : "paused"}`);
    });
    return { ok: true };
  });
}

export async function deleteDealAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize("deals.manage");
    await prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({ where: { id: String(id) } });
      if (!deal) throw new ActionError("Deal not found.");
      await tx.deal.delete({ where: { id: deal.id } });
      await recordAudit(tx, user, "deal.delete", deal.name);
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
    await prisma.$transaction(async (tx) => {
      await tx.settings.update({ where: { id: "singleton" }, data: { pricing: asJson(next) } });
      await recordAudit(
        tx,
        user,
        "pricing.update",
        `GST cash ${next.taxRateCash}% · card ${next.taxRateCard}% · service ${next.serviceChargeRate}% · parcel ${next.parcelFee}`,
      );
    });
    return { ok: true };
  });
}

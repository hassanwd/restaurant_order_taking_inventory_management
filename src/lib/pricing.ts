import { PRICING } from "@/data/settings";
import { lineTotal, round2 } from "./format";
import type { CartLine, OrderTotals, OrderType } from "./types";

export interface TotalsInput {
  lines: CartLine[];
  orderType: OrderType;
  discountPercent: number;
  tip?: number;
}

/**
 * Single source of truth for order maths — used by the cart, the checkout screen
 * and the seeded orders so every screen agrees on the numbers.
 */
export function computeTotals({
  lines,
  orderType,
  discountPercent,
  tip = 0,
}: TotalsInput): OrderTotals {
  const subtotal = round2(lines.reduce((sum, line) => sum + lineTotal(line), 0));
  const discount = round2((subtotal * clampPercent(discountPercent)) / 100);
  const taxable = round2(subtotal - discount);

  const serviceCharge = PRICING.serviceChargeAppliesTo.includes(orderType)
    ? round2((taxable * PRICING.serviceChargeRate) / 100)
    : 0;

  const deliveryFee = orderType === "delivery" ? PRICING.deliveryFee : 0;
  const tax = round2((taxable * PRICING.taxRate) / 100);
  const total = round2(taxable + serviceCharge + deliveryFee + tax + round2(tip));

  return { subtotal, discount, serviceCharge, tax, deliveryFee, tip: round2(tip), total };
}

export const clampPercent = (value: number) =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

export const itemCount = (lines: CartLine[]) =>
  lines.reduce((sum, line) => sum + line.quantity, 0);

export const estimatedPrepMinutes = (lines: CartLine[], prepLookup: (itemId: string) => number) =>
  lines.reduce((max, line) => Math.max(max, prepLookup(line.itemId)), 0);

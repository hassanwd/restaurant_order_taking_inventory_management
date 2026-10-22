import { lineTotal, round2 } from "./format";
import type { CartLine, OrderTotals, OrderType, PaymentMethod, Pricing } from "./types";

export interface TotalsInput {
  lines: CartLine[];
  orderType: OrderType;
  discountPercent: number;
  pricing: Pricing;
  /**
   * GST depends on how the bill is settled. Before payment is known (an order
   * that has just been taken) the cash rate is used as the provisional figure.
   */
  method?: PaymentMethod | null;
  tip?: number;
}

export const taxRateFor = (pricing: Pricing, method: PaymentMethod | null | undefined) =>
  method === "card" ? pricing.taxRateCard : pricing.taxRateCash;

/**
 * Single source of truth for order maths — used by the cart, the checkout screen,
 * the server when it re-prices an order, and the seed data, so every screen and
 * the stored bill agree on the numbers.
 */
export function computeTotals({
  lines,
  orderType,
  discountPercent,
  pricing,
  method = null,
  tip = 0,
}: TotalsInput): OrderTotals {
  const subtotal = round2(lines.reduce((sum, line) => sum + lineTotal(line), 0));
  const discount = round2((subtotal * clampPercent(discountPercent)) / 100);
  const taxable = round2(subtotal - discount);

  const serviceChargeRate = pricing.serviceChargeAppliesTo.includes(orderType)
    ? pricing.serviceChargeRate
    : 0;
  const serviceCharge = round2((taxable * serviceChargeRate) / 100);

  const deliveryFee = orderType === "parcel" ? pricing.parcelFee : 0;
  const taxRate = taxRateFor(pricing, method);
  const tax = round2((taxable * taxRate) / 100);
  const total = round2(taxable + serviceCharge + deliveryFee + tax + round2(tip));

  return {
    subtotal,
    discount,
    serviceCharge,
    tax,
    deliveryFee,
    tip: round2(tip),
    total,
    taxRate,
    serviceChargeRate,
  };
}

export const clampPercent = (value: number) =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

export const itemCount = (lines: CartLine[]) =>
  lines.reduce((sum, line) => sum + line.quantity, 0);

export const estimatedPrepMinutes = (lines: CartLine[], prepLookup: (itemId: string) => number) =>
  lines.reduce((max, line) => Math.max(max, prepLookup(line.itemId)), 0);

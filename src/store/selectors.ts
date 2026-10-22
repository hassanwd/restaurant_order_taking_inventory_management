import { createSelector } from "@reduxjs/toolkit";
import { computeTotals } from "@/lib/pricing";
import type { RootState } from "./index";

export const selectCart = (state: RootState) => state.cart;
export const selectCartLines = (state: RootState) => state.cart.lines;
export const selectUi = (state: RootState) => state.ui;
export const selectPricing = (state: RootState) => state.config.pricing;
export const selectUser = (state: RootState) => state.config.user;

export const selectCartCount = createSelector(selectCartLines, (lines) =>
  lines.reduce((sum, line) => sum + line.quantity, 0),
);

/** Totals without the tip — what the order screen shows (cash GST until payment is chosen). */
export const selectCartTotals = createSelector([selectCart, selectPricing], (cart, pricing) =>
  computeTotals({
    lines: cart.lines,
    orderType: cart.orderType,
    discountPercent: cart.discountPercent,
    pricing,
  }),
);

/** What stops the cart moving on to checkout: nothing to sell, or no table for dine-in. */
export const selectCartIssues = createSelector(selectCart, (cart) => {
  const issues: string[] = [];
  if (cart.lines.length === 0) issues.push("Add at least one item to the order.");
  if (cart.orderType === "dine-in" && !cart.tableId) issues.push("Select a table for dine-in.");
  return issues;
});

/** What stops the order being placed: the cart rules plus the details checkout collects for a parcel. */
export const selectCheckoutIssues = createSelector([selectCart, selectCartIssues], (cart, cartIssues) => {
  const issues = [...cartIssues];
  if (cart.orderType === "parcel") {
    if (!cart.customer.name.trim()) issues.push("Customer name is required for parcel orders.");
    if (!cart.customer.phone.trim()) issues.push("Phone number is required for parcel orders.");
    if (!cart.customer.address.trim()) issues.push("Location is required for parcel orders.");
  }
  return issues;
});

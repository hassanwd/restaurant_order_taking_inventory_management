import { createSelector } from "@reduxjs/toolkit";
import { computeTotals } from "@/lib/pricing";
import type { RootState } from "./index";

export const selectCart = (state: RootState) => state.cart;
export const selectCartLines = (state: RootState) => state.cart.lines;
export const selectOrdersState = (state: RootState) => state.orders;
export const selectAllOrders = (state: RootState) => state.orders.items;
export const selectUi = (state: RootState) => state.ui;

export const selectCartCount = createSelector(selectCartLines, (lines) =>
  lines.reduce((sum, line) => sum + line.quantity, 0),
);

/** Totals without the tip — what the order screen shows. */
export const selectCartTotals = createSelector(selectCart, (cart) =>
  computeTotals({
    lines: cart.lines,
    orderType: cart.orderType,
    discountPercent: cart.discountPercent,
  }),
);

/** Totals including the tip — what the checkout screen charges. */
export const selectCheckoutTotals = createSelector(selectCart, (cart) =>
  computeTotals({
    lines: cart.lines,
    orderType: cart.orderType,
    discountPercent: cart.discountPercent,
    tip: cart.tip,
  }),
);

export const selectOrderById = (id: string) => (state: RootState) =>
  state.orders.items.find((order) => order.id === id) ?? null;

export const selectOrdersView = createSelector(selectOrdersState, (orders) => ({
  filter: orders.filter,
  search: orders.search,
}));

/** Blocks checkout until the order is actually placeable. */
export const selectCartIssues = createSelector(selectCart, (cart) => {
  const issues: string[] = [];
  if (cart.lines.length === 0) issues.push("Add at least one item to the order.");
  if (cart.orderType === "dine-in" && !cart.tableId) issues.push("Select a table for dine-in.");
  if (cart.orderType === "delivery") {
    if (!cart.customer.name.trim()) issues.push("Customer name is required for delivery.");
    if (!cart.customer.phone.trim()) issues.push("Contact number is required for delivery.");
    if (!cart.customer.address.trim()) issues.push("Delivery address is required.");
  }
  return issues;
});

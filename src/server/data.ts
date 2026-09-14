import "server-only";

import { CATEGORIES, MENU_ITEMS } from "@/data/menu";
import { SEED_ORDERS } from "@/data/orders";
import { OUTLET, PRICING } from "@/data/settings";
import { TABLES } from "@/data/tables";
import type { Category, DiningTable, MenuItem, Order } from "@/lib/types";

/**
 * Server-only data access layer.
 *
 * Everything is static for now, but each read is async and goes through this
 * module so swapping in a database or REST call later is a one-file change —
 * the pages stay Server Components and keep rendering on the server.
 */

const latency = (ms = 0) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : null);

export async function getCategories(): Promise<Category[]> {
  await latency();
  return CATEGORIES;
}

export async function getMenuItems(): Promise<MenuItem[]> {
  await latency();
  return MENU_ITEMS;
}

export async function getTables(): Promise<DiningTable[]> {
  await latency();
  return TABLES;
}

export async function getOrders(): Promise<Order[]> {
  await latency();
  // Newest first — the list and dashboard both rely on this ordering.
  return [...SEED_ORDERS].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOrderById(id: string): Promise<Order | null> {
  const orders = await getOrders();
  return orders.find((order) => order.id === id) ?? null;
}

export async function getOutlet() {
  await latency();
  return OUTLET;
}

export async function getPricing() {
  await latency();
  return PRICING;
}

export interface DashboardStats {
  ordersToday: number;
  revenueToday: number;
  averageTicket: number;
  openOrders: number;
  byStatus: Record<string, number>;
  topItems: { itemId: string; name: string; icon: string; quantity: number; revenue: number }[];
  tablesOccupied: number;
  tablesTotal: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [orders, tables] = await Promise.all([getOrders(), getTables()]);
  const billable = orders.filter((order) => order.status !== "cancelled");

  const revenueToday = billable.reduce((sum, order) => sum + order.totals.total, 0);
  const byStatus = orders.reduce<Record<string, number>>((acc, order) => {
    acc[order.status] = (acc[order.status] ?? 0) + 1;
    return acc;
  }, {});

  const tally = new Map<string, { itemId: string; name: string; icon: string; quantity: number; revenue: number }>();
  for (const order of billable) {
    for (const line of order.lines) {
      const current = tally.get(line.itemId) ?? {
        itemId: line.itemId,
        name: line.name,
        icon: line.icon,
        quantity: 0,
        revenue: 0,
      };
      const unit = line.basePrice + line.options.reduce((sum, option) => sum + option.price, 0);
      current.quantity += line.quantity;
      current.revenue += unit * line.quantity;
      tally.set(line.itemId, current);
    }
  }

  return {
    ordersToday: orders.length,
    revenueToday: Math.round(revenueToday * 100) / 100,
    averageTicket: billable.length ? Math.round((revenueToday / billable.length) * 100) / 100 : 0,
    openOrders: orders.filter((order) =>
      ["pending", "preparing", "ready", "served"].includes(order.status),
    ).length,
    byStatus,
    topItems: [...tally.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    tablesOccupied: tables.filter((table) => table.status === "occupied").length,
    tablesTotal: tables.length,
  };
}

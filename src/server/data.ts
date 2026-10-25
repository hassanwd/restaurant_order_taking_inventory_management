import "server-only";

import { OUTLET } from "@/data/settings";
import { TABLES } from "@/data/tables";
import { CATEGORIES } from "@/data/menu";
import { can } from "@/lib/permissions";
import { round2 } from "@/lib/format";
import { roleSeesOrder } from "@/lib/orders";
import type {
  Category,
  Deal,
  DiningTable,
  EmployeeView,
  MenuItem,
  Order,
  Pricing,
  SessionUser,
} from "@/lib/types";
import { getDb, type Database } from "./db";

/**
 * Server-only data access layer.
 *
 * Every function that returns orders takes the signed-in user and filters by
 * what their role may see — a worker only ever gets their own orders, so an
 * order id guessed from a URL still resolves to "not found" (no IDOR).
 */

export async function getCategories(): Promise<Category[]> {
  return CATEGORIES;
}

export function dealToMenuItem(deal: Deal, db: Database): MenuItem {
  const components = deal.items.map((component) => ({
    component,
    item: db.menuItems.find((entry) => entry.id === component.itemId),
  }));
  const summary = components
    .map(({ component, item }) => `${component.quantity}× ${item?.name ?? "Removed item"}`)
    .join(" + ");
  return {
    id: deal.id,
    name: deal.name,
    description: deal.description || summary,
    price: deal.price,
    categoryId: "deals",
    image: deal.image,
    ingredients: deal.ingredients,
    prepMinutes: Math.max(1, ...components.map(({ item }) => item?.prepMinutes ?? 1)),
    // A deal is sellable only while it is active and everything in it can still be sold.
    available: deal.active && components.every(({ item }) => item?.available),
    tags: ["Deal"],
    popular: false,
    optionGroups: deal.optionGroups,
    kind: "deal",
  };
}

/** Everything the order screen can sell: menu items plus live deals. Also the server's price list. */
export function buildCatalog(db: Database): MenuItem[] {
  return [
    ...db.menuItems.map((item) => ({ ...item, kind: "item" as const })),
    ...db.deals.filter((deal) => deal.active).map((deal) => dealToMenuItem(deal, db)),
  ];
}

export async function getCatalog(): Promise<MenuItem[]> {
  return buildCatalog(await getDb());
}

export async function getMenuItems(): Promise<MenuItem[]> {
  return (await getDb()).menuItems;
}

export async function getDeals(): Promise<Deal[]> {
  return (await getDb()).deals;
}

/**
 * The floor plan with live occupancy: a table is occupied exactly while an open
 * dine-in order sits on it, whichever employee took that order.
 */
export async function getTables(): Promise<DiningTable[]> {
  const db = await getDb();
  const busy = new Set(db.orders.filter((order) => order.tableId && isOpen(order)).map((o) => o.tableId));
  return TABLES.map((table) => ({
    ...table,
    status: busy.has(table.id) ? "occupied" : table.status === "occupied" ? "free" : table.status,
  }));
}

export async function getPricing(): Promise<Pricing> {
  return (await getDb()).settings.pricing;
}

export async function getOutlet() {
  return OUTLET;
}

export const isOpen = (order: Order) =>
  ["pending", "preparing", "ready", "delivery"].includes(order.status);

const newestFirst = (a: Order, b: Order) => b.createdAt.localeCompare(a.createdAt);

export function visibleOrders(db: Database, user: SessionUser): Order[] {
  const all = can(user.role, "order.view.all");
  const own = can(user.role, "order.view.own");
  return db.orders
    .filter((order) => (all ? true : own && order.createdById === user.id))
    .filter((order) => roleSeesOrder(user.role, order))
    .sort(newestFirst);
}

export async function getOrders(user: SessionUser): Promise<Order[]> {
  return visibleOrders(await getDb(), user);
}

export async function getOrderById(user: SessionUser, id: string): Promise<Order | null> {
  const orders = await getOrders(user);
  return orders.find((order) => order.id === id) ?? null;
}

export async function getOpenOrderCount(user: SessionUser) {
  return (await getOrders(user)).filter(isOpen).length;
}

export interface DashboardStats {
  ordersToday: number;
  cancelledToday: number;
  revenueToday: number;
  openOrders: number;
  byStatus: Record<string, number>;
  topItems: { itemId: string; name: string; image: string | null; quantity: number; revenue: number }[];
  tablesOccupied: number;
  tablesTotal: number;
}

const isToday = (iso: string) => iso.slice(0, 10) === new Date().toISOString().slice(0, 10);

/** Orders that count as sales: placed, not cancelled, not refunded. */
export const isBillable = (order: Order) =>
  order.status !== "cancelled" && order.status !== "returned";

export async function getDashboardStats(user: SessionUser): Promise<DashboardStats> {
  const [allOrders, tables] = await Promise.all([getOrders(user), getTables()]);
  const orders = allOrders.filter((order) => isToday(order.createdAt));
  const billable = orders.filter(isBillable);

  const revenueToday = billable.reduce((sum, order) => sum + order.totals.total, 0);
  const byStatus = orders.reduce<Record<string, number>>((acc, order) => {
    acc[order.status] = (acc[order.status] ?? 0) + 1;
    return acc;
  }, {});

  const tally = new Map<string, DashboardStats["topItems"][number]>();
  for (const order of billable) {
    for (const line of order.lines) {
      const current = tally.get(line.itemId) ?? {
        itemId: line.itemId,
        name: line.name,
        image: line.image,
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
    cancelledToday: orders.filter((order) => order.status === "cancelled").length,
    revenueToday: round2(revenueToday),
    openOrders: allOrders.filter(isOpen).length,
    byStatus,
    topItems: [...tally.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    tablesOccupied: tables.filter((table) => table.status === "occupied").length,
    tablesTotal: tables.length,
  };
}

/** A session counts as "signed in now" if it was used within this window. */
const ACTIVE_WINDOW_MS = 15 * 60 * 1000;

export async function getEmployees(): Promise<EmployeeView[]> {
  const db = await getDb();
  const now = Date.now();
  return db.users.map((user) => {
    const sessions = db.sessions.filter(
      (session) =>
        session.userId === user.id &&
        Date.parse(session.expiresAt) > now &&
        now - Date.parse(session.lastSeenAt) < ACTIVE_WINDOW_MS,
    );
    const lastActive = sessions.reduce<string | null>(
      (latest, session) => (!latest || session.lastSeenAt > latest ? session.lastSeenAt : latest),
      null,
    );
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      frozen: user.frozen,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      lastActiveAt: lastActive,
      ordersPlaced: db.orders.filter((order) => order.createdById === user.id).length,
      locked: user.lockedUntil !== null && Date.parse(user.lockedUntil) > now,
    };
  });
}


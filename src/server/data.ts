import "server-only";

import type { Prisma } from "@prisma/client";
import { OUTLET } from "@/data/settings";
import { TABLES } from "@/data/tables";
import { CATEGORIES } from "@/data/menu";
import { can } from "@/lib/permissions";
import { round2 } from "@/lib/format";
import type {
  Category,
  Deal,
  DiningTable,
  EmployeeView,
  MenuItem,
  Order,
  OrderStatus,
  Pricing,
  SessionUser,
} from "@/lib/types";
import { ensureSeeded, mapDeal, mapMenuItem, mapOrder } from "./db";
import { prisma } from "./prisma";

/**
 * Server-only data access layer.
 *
 * Every function that returns orders takes the signed-in user and filters by
 * what their role may see — a worker only ever gets their own orders, so an
 * order id guessed from a URL still resolves to "not found" (no IDOR). That
 * scoping is expressed as a Postgres `where` clause (`orderVisibilityWhere`) so
 * it is enforced by the query itself, not by filtering a fully-loaded table.
 */

export const OPEN_STATUSES: OrderStatus[] = ["pending", "preparing", "ready", "delivery"];

/** Mirrors `roleSeesOrder` + the own/all scoping that `can()` grants, as a Prisma `where`. */
export function orderVisibilityWhere(user: SessionUser): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (!can(user.role, "order.view.all")) {
    if (!can(user.role, "order.view.own")) return { id: "::none::" }; // no grant — sees nothing
    where.createdById = user.id;
  }
  if (user.role === "super_admin") {
    where.status = { in: ["completed", "cancelled"] };
  }
  return where;
}

export async function getCategories(): Promise<Category[]> {
  return CATEGORIES;
}

export function dealToMenuItem(deal: Deal, menuItems: MenuItem[]): MenuItem {
  const byId = new Map(menuItems.map((item) => [item.id, item]));
  const components = deal.items.map((component) => ({
    component,
    item: byId.get(component.itemId),
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
export function buildCatalog(menuItems: MenuItem[], deals: Deal[]): MenuItem[] {
  return [
    ...menuItems.map((item) => ({ ...item, kind: "item" as const })),
    ...deals.filter((deal) => deal.active).map((deal) => dealToMenuItem(deal, menuItems)),
  ];
}

export async function getCatalog(): Promise<MenuItem[]> {
  const [menuItems, deals] = await Promise.all([getMenuItems(), getDeals()]);
  return buildCatalog(menuItems, deals);
}

export async function getMenuItems(): Promise<MenuItem[]> {
  const rows = await prisma.menuItem.findMany({ orderBy: { name: "asc" } });
  return rows.map(mapMenuItem);
}

export async function getDeals(): Promise<Deal[]> {
  const rows = await prisma.deal.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(mapDeal);
}

/**
 * The floor plan with live occupancy: a table is occupied exactly while an open
 * dine-in order sits on it, whichever employee took that order.
 */
export async function getTables(): Promise<DiningTable[]> {
  const openOrders = await prisma.order.findMany({
    where: { tableId: { not: null }, status: { in: OPEN_STATUSES } },
    select: { tableId: true },
  });
  const busy = new Set(openOrders.map((order) => order.tableId));
  return TABLES.map((table) => ({
    ...table,
    status: busy.has(table.id) ? "occupied" : table.status === "occupied" ? "free" : table.status,
  }));
}

/**
 * The root layout reads this in parallel with `getCurrentUser()` (which seeds as a side effect),
 * so on a cold database this can run before that seed finishes — it has to be able to self-heal
 * too, not just assume someone else already did.
 */
export async function getPricing(): Promise<Pricing> {
  await ensureSeeded();
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "singleton" } });
  return settings.pricing as unknown as Pricing;
}

export async function getOutlet() {
  return OUTLET;
}

export const isOpen = (order: Order) =>
  (OPEN_STATUSES as string[]).includes(order.status);

export async function getOrders(user: SessionUser): Promise<Order[]> {
  const rows = await prisma.order.findMany({
    where: orderVisibilityWhere(user),
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapOrder);
}

export async function getOrderById(user: SessionUser, id: string): Promise<Order | null> {
  const row = await prisma.order.findFirst({ where: { id, ...orderVisibilityWhere(user) } });
  return row ? mapOrder(row) : null;
}

export async function getOpenOrderCount(user: SessionUser) {
  return prisma.order.count({
    where: { ...orderVisibilityWhere(user), status: { in: OPEN_STATUSES } },
  });
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

/** Orders that count as sales: placed, not cancelled, not refunded. */
export const isBillable = (order: Order) =>
  order.status !== "cancelled" && order.status !== "returned";

export async function getDashboardStats(user: SessionUser): Promise<DashboardStats> {
  const startOfDay = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const [todayRows, openOrders, tables] = await Promise.all([
    prisma.order.findMany({
      where: { ...orderVisibilityWhere(user), createdAt: { gte: startOfDay, lt: endOfDay } },
    }),
    prisma.order.count({ where: { ...orderVisibilityWhere(user), status: { in: OPEN_STATUSES } } }),
    getTables(),
  ]);
  const orders = todayRows.map(mapOrder);
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
    openOrders,
    byStatus,
    topItems: [...tally.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    tablesOccupied: tables.filter((table) => table.status === "occupied").length,
    tablesTotal: tables.length,
  };
}

/** A session counts as "signed in now" if it was used within this window. */
const ACTIVE_WINDOW_MS = 15 * 60 * 1000;

export async function getEmployees(): Promise<EmployeeView[]> {
  const now = Date.now();
  const [users, sessions, orderCounts] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.session.findMany({ where: { expiresAt: { gt: new Date() } } }),
    prisma.order.groupBy({ by: ["createdById"], _count: { _all: true } }),
  ]);
  const ordersByUser = new Map(orderCounts.map((entry) => [entry.createdById, entry._count._all]));

  return users.map((user) => {
    const active = sessions.filter(
      (session) => session.userId === user.id && now - session.lastSeenAt.getTime() < ACTIVE_WINDOW_MS,
    );
    const lastActive = active.reduce<string | null>((latest, session) => {
      const seen = session.lastSeenAt.toISOString();
      return !latest || seen > latest ? seen : latest;
    }, null);
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role as EmployeeView["role"],
      frozen: user.frozen,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      lastActiveAt: lastActive,
      ordersPlaced: ordersByUser.get(user.id) ?? 0,
      locked: user.lockedUntil !== null && user.lockedUntil.getTime() > now,
    };
  });
}

import type { Order, OrderStatus, OrderType, Role } from "./types";

export type OrderFilter = OrderStatus | "all";
export type OrderTypeFilter = OrderType | "all";

/**
 * A Super Admin reviews finished business only: completed, cancelled and returned orders. Every
 * other role sees orders in any status (subject to the own / all scoping applied elsewhere).
 */
export const roleSeesOrder = (role: Role, order: Order) =>
  role !== "super_admin" ||
  order.status === "completed" ||
  order.status === "cancelled" ||
  order.status === "returned";

/** Pure list filtering, shared by the store selector and the orders screen. */
export function filterOrders(
  orders: Order[],
  filter: OrderFilter,
  search: string,
  type: OrderTypeFilter = "all",
) {
  const query = search.trim().toLowerCase();
  return orders.filter((order) => {
    if (type !== "all" && order.type !== type) return false;
    if (filter !== "all" && order.status !== filter) return false;
    if (!query) return true;
    return (
      order.code.toLowerCase().includes(query) ||
      order.customer.name.toLowerCase().includes(query) ||
      order.customer.phone.toLowerCase().includes(query) ||
      order.cashier.toLowerCase().includes(query) ||
      (order.tableId ?? "").toLowerCase().includes(query) ||
      order.lines.some((line) => line.name.toLowerCase().includes(query))
    );
  });
}

export function countByStatus(orders: Order[]): Record<OrderFilter, number> {
  const counts: Record<OrderFilter, number> = {
    all: orders.length,
    pending: 0,
    preparing: 0,
    ready: 0,
    delivery: 0,
    completed: 0,
    cancelled: 0,
    returned: 0,
  };
  for (const order of orders) counts[order.status] += 1;
  return counts;
}

export function countByType(orders: Order[]): Record<OrderTypeFilter, number> {
  const counts: Record<OrderTypeFilter, number> = {
    all: orders.length,
    "dine-in": 0,
    takeaway: 0,
    parcel: 0,
  };
  for (const order of orders) counts[order.type] += 1;
  return counts;
}

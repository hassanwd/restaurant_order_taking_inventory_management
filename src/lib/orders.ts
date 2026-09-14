import type { Order, OrderStatus } from "./types";

export type OrderFilter = OrderStatus | "all";

/** Pure list filtering, shared by the store selector and the orders screen. */
export function filterOrders(orders: Order[], filter: OrderFilter, search: string) {
  const query = search.trim().toLowerCase();
  return orders.filter((order) => {
    if (filter !== "all" && order.status !== filter) return false;
    if (!query) return true;
    return (
      order.code.toLowerCase().includes(query) ||
      order.customer.name.toLowerCase().includes(query) ||
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
    served: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const order of orders) counts[order.status] += 1;
  return counts;
}

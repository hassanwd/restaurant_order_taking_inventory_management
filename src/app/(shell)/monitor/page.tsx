import OrdersScreen from "@/components/order/OrdersScreen";
import { can } from "@/lib/permissions";
import { getOrders } from "@/server/data";
import { requirePermission } from "@/server/session";

export const metadata = { title: "Monitor" };

export default async function MonitorPage() {
  const user = await requirePermission("monitor.view");
  // Same scoping as the Orders list: a worker only receives their own orders.
  const orders = await getOrders(user);
  return (
    <OrdersScreen
      view="monitor"
      role={user.role}
      orders={orders}
      scope={can(user.role, "order.view.all") ? "all" : "own"}
    />
  );
}

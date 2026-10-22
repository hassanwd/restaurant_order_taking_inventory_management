import OrdersScreen from "@/components/order/OrdersScreen";
import { can } from "@/lib/permissions";
import { getOrders } from "@/server/data";
import { requirePermission } from "@/server/session";

export const metadata = { title: "Orders" };

export default async function OrdersPage() {
  const user = await requirePermission("order.view.own");
  // Scoped to the signed-in role: a worker only receives their own orders.
  const orders = await getOrders(user);
  return <OrdersScreen view="list" role={user.role} orders={orders} scope={can(user.role, "order.view.all") ? "all" : "own"} />;
}

import OrderDetail from "@/components/order/OrderDetail";
import { getOrderById } from "@/server/data";
import { requirePermission } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  return { title: `Order ${id}` };
}

export default async function OrderDetailPage({ params }: PageProps<"/orders/[id]">) {
  const user = await requirePermission("order.view.own");
  const { id } = await params;
  // Not-found and not-yours look identical, so order ids cannot be probed.
  const order = await getOrderById(user, id);

  return <OrderDetail orderId={id} order={order} role={user.role} />;
}

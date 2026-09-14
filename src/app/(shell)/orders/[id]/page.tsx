import OrderDetail from "@/components/order/OrderDetail";
import { getOrderById } from "@/server/data";

export async function generateMetadata({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  return { title: `Order ${id}` };
}

export default async function OrderDetailPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  // Server lookup covers the seeded orders; orders placed in this browser
  // session are resolved from the store inside the client component.
  const serverOrder = await getOrderById(id);

  return <OrderDetail orderId={id} serverOrder={serverOrder} />;
}

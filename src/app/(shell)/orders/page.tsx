import OrdersScreen from "@/components/order/OrdersScreen";
import { getOrders } from "@/server/data";

export const metadata = { title: "Orders" };

export default async function OrdersPage() {
  // Fetched on the server and passed down, so the list is complete in the first
  // HTML response; the store takes over once the client has hydrated.
  const orders = await getOrders();
  return <OrdersScreen serverOrders={orders} />;
}

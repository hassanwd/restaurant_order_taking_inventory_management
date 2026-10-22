import CheckoutScreen from "@/components/order/CheckoutScreen";
import { getTables } from "@/server/data";
import { requirePermission } from "@/server/session";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  await requirePermission("order.create");
  const tables = await getTables();
  return <CheckoutScreen tables={tables} />;
}

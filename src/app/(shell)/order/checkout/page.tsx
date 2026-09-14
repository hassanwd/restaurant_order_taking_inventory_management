import CheckoutScreen from "@/components/order/CheckoutScreen";
import { getTables } from "@/server/data";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const tables = await getTables();
  return <CheckoutScreen tables={tables} />;
}

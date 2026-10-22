import PrintScreen from "@/components/order/PrintScreen";
import { getOrderById, getTables } from "@/server/data";
import { requirePermission } from "@/server/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/print/[id]">) {
  const { id } = await params;
  return { title: `Print ${id}` };
}

export default async function PrintPage({ params, searchParams }: PageProps<"/print/[id]">) {
  const user = await requirePermission("order.view.own");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [order, tables] = await Promise.all([getOrderById(user, id), getTables()]);

  return (
    <PrintScreen orderId={id} order={order} tables={tables} justPlaced={query.placed === "1"} />
  );
}

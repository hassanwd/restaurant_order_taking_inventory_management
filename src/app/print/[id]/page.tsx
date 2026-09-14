import PrintScreen from "@/components/order/PrintScreen";
import { getOrderById, getTables } from "@/server/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/print/[id]">) {
  const { id } = await params;
  return { title: `Print ${id}` };
}

export default async function PrintPage({ params, searchParams }: PageProps<"/print/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [serverOrder, tables] = await Promise.all([getOrderById(id), getTables()]);

  return (
    <PrintScreen
      orderId={id}
      serverOrder={serverOrder}
      tables={tables}
      justPlaced={query.placed === "1"}
    />
  );
}

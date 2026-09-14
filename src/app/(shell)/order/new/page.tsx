import OrderTakingScreen from "@/components/order/OrderTakingScreen";
import type { OrderType } from "@/lib/types";
import { getCategories, getMenuItems, getTables } from "@/server/data";

export const metadata = { title: "New Order" };

const ORDER_TYPES: OrderType[] = ["dine-in", "takeaway", "delivery"];

const asOrderType = (value: string | string[] | undefined): OrderType | undefined =>
  typeof value === "string" && ORDER_TYPES.includes(value as OrderType)
    ? (value as OrderType)
    : undefined;

export default async function NewOrderPage({ searchParams }: PageProps<"/order/new">) {
  // Menu, categories and the floor plan are fetched and rendered on the server.
  const [categories, items, tables, params] = await Promise.all([
    getCategories(),
    getMenuItems(),
    getTables(),
    searchParams,
  ]);

  const table = typeof params.table === "string" ? params.table : undefined;

  return (
    <OrderTakingScreen
      categories={categories}
      items={items}
      tables={tables}
      initialType={asOrderType(params.type)}
      initialTableId={tables.some((entry) => entry.id === table) ? table : undefined}
    />
  );
}

import OrderTakingScreen from "@/components/order/OrderTakingScreen";
import type { OrderType } from "@/lib/types";
import { getCategories, getCatalog, getOpenOrderCount, getTables } from "@/server/data";
import { requirePermission } from "@/server/session";

export const metadata = { title: "New Order" };

const ORDER_TYPES: OrderType[] = ["dine-in", "takeaway", "parcel"];

const asOrderType = (value: string | string[] | undefined): OrderType | undefined =>
  typeof value === "string" && ORDER_TYPES.includes(value as OrderType)
    ? (value as OrderType)
    : undefined;

export default async function NewOrderPage({ searchParams }: PageProps<"/order/new">) {
  const user = await requirePermission("order.create");

  // Menu (items, drinks, add-ons, deals), categories and the floor plan are fetched and rendered on the server.
  const [categories, items, tables, openOrders, params] = await Promise.all([
    getCategories(),
    getCatalog(),
    getTables(),
    getOpenOrderCount(user),
    searchParams,
  ]);

  const table = typeof params.table === "string" ? params.table : undefined;

  return (
    <OrderTakingScreen
      categories={categories}
      items={items}
      tables={tables}
      userName={user.name}
      openOrders={openOrders}
      initialType={asOrderType(params.type)}
      initialTableId={tables.some((entry) => entry.id === table) ? table : undefined}
    />
  );
}

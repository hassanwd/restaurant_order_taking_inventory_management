import InventoryManager from "@/components/admin/InventoryManager";
import { getInventory, getMovements } from "@/server/data";
import { requirePermission } from "@/server/session";

export const metadata = { title: "Inventory" };

export default async function InventoryPage() {
  await requirePermission("inventory.view");
  const [items, movements] = await Promise.all([getInventory(), getMovements(200)]);
  const today = new Date().toISOString().slice(0, 10);
  return <InventoryManager items={items} movements={movements} today={today} />;
}

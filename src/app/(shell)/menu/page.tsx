import MenuManager from "@/components/admin/MenuManager";
import { ASSIGNABLE_CATEGORIES } from "@/data/menu";
import { getDeals, getMenuItems } from "@/server/data";
import { requirePermission } from "@/server/session";

export const metadata = { title: "Menu & Deals" };

export default async function MenuPage() {
  await requirePermission("menu.manage");
  const [items, deals] = await Promise.all([getMenuItems(), getDeals()]);
  return <MenuManager items={items} deals={deals} categories={ASSIGNABLE_CATEGORIES} />;
}

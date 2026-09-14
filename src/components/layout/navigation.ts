import { NAV_ICONS } from "@/lib/icons";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Highlight the item for nested routes too. */
  match?: (pathname: string) => boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: NAV_ICONS.dashboard,
    description: "Today at a glance",
    match: (pathname) => pathname === "/",
  },
  {
    href: "/order/new",
    label: "New Order",
    icon: NAV_ICONS.newOrder,
    description: "Take an order",
    // "/order/" only — "/orders" is a different section.
    match: (pathname) => pathname.startsWith("/order/"),
  },
  {
    href: "/orders",
    label: "Orders",
    icon: NAV_ICONS.orders,
    description: "Track and print",
    match: (pathname) => pathname.startsWith("/orders"),
  },
  {
    href: "/tables",
    label: "Tables",
    icon: NAV_ICONS.tables,
    description: "Floor status",
    match: (pathname) => pathname.startsWith("/tables"),
  },
];

export const isActive = (item: NavItem, pathname: string) =>
  item.match ? item.match(pathname) : pathname === item.href;

/** Heading shown in the top bar — more specific than the nav label. */
export function pageTitle(pathname: string) {
  if (pathname === "/order/checkout") return "Checkout";
  if (pathname === "/order/new") return "New Order";
  if (/^\/orders\/.+/.test(pathname)) return "Order Details";
  const item = NAV_ITEMS.find((entry) => isActive(entry, pathname));
  return item?.label ?? "Order Taking System";
}

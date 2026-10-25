import { NAV_ICONS } from "@/lib/icons";
import { can, type Permission } from "@/lib/permissions";
import type { Role } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Hidden from roles without it. The page itself enforces the same permission on the server. */
  permission: Permission | null;
  section: "service" | "manage";
  /** Highlight the item for nested routes too. */
  match?: (pathname: string) => boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: NAV_ICONS.dashboard,
    description: "Today at a glance",
    permission: "dashboard.view",
    section: "service",
    match: (pathname) => pathname === "/",
  },
  {
    href: "/order/new",
    label: "New Order",
    icon: NAV_ICONS.newOrder,
    description: "Take an order",
    permission: "order.create",
    section: "service",
    // "/order/" only — "/orders" is a different section.
    match: (pathname) => pathname.startsWith("/order/"),
  },
  {
    href: "/orders",
    label: "Orders",
    icon: NAV_ICONS.orders,
    description: "Track orders",
    permission: "order.view.own",
    section: "service",
    match: (pathname) => pathname.startsWith("/orders"),
  },
  {
    href: "/monitor",
    label: "Monitor",
    icon: NAV_ICONS.monitor,
    description: "Live by order type",
    permission: "monitor.view",
    section: "service",
    match: (pathname) => pathname.startsWith("/monitor"),
  },
  {
    href: "/tables",
    label: "Tables",
    icon: NAV_ICONS.tables,
    description: "Floor status",
    permission: "tables.view",
    section: "service",
    match: (pathname) => pathname.startsWith("/tables"),
  },
  {
    href: "/menu",
    label: "Menu & Deals",
    icon: NAV_ICONS.menu,
    description: "Items, prices, deals",
    permission: "menu.manage",
    section: "manage",
    match: (pathname) => pathname.startsWith("/menu"),
  },
  {
    href: "/billing",
    label: "Billing",
    icon: NAV_ICONS.billing,
    description: "Sales records & GST",
    permission: "billing.view",
    section: "manage",
    match: (pathname) => pathname.startsWith("/billing"),
  },
  {
    href: "/reports",
    label: "Reports",
    icon: NAV_ICONS.reports,
    description: "Daily, weekly, monthly",
    permission: "reports.view",
    section: "manage",
    match: (pathname) => pathname.startsWith("/reports"),
  },
  {
    href: "/employees",
    label: "Employees",
    icon: NAV_ICONS.employees,
    description: "Accounts & roles",
    permission: "employees.manage",
    section: "manage",
    match: (pathname) => pathname.startsWith("/employees"),
  },
];

export const navFor = (role: Role | undefined | null) =>
  NAV_ITEMS.filter((item) => item.permission === null || can(role, item.permission));

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

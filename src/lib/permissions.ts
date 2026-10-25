import type { Role } from "./types";

/**
 * Role-based access control, shared by the server (which enforces it) and the
 * browser (which only uses it to hide controls the user could not use anyway).
 * The server never trusts the browser's copy — every action and page re-checks.
 */
export type Permission =
  | "dashboard.view"
  | "tables.view"
  | "monitor.view"
  | "menu.view"
  | "order.create"
  | "order.view.own"
  | "order.view.all"
  | "order.advance"
  | "order.cancel"
  | "order.return"
  | "order.return.completed"
  | "payment.settle"
  | "price.adjust"
  | "discount.apply"
  | "menu.manage"
  | "deals.manage"
  | "billing.view"
  | "pricing.manage"
  | "reports.view"
  | "employees.manage";

// Workers take payment for the orders they place (dine-in and takeaway are paid before they are placed).
const WORKER: Permission[] = [
  "menu.view",
  "order.create",
  "order.view.own",
  "monitor.view",
  "order.advance",
  "payment.settle",
  // Calling an order off, or returning it, before it is completed — their own orders only.
  "order.cancel",
  "order.return",
];

// Taking orders and the live Monitor belong to the Worker persona; cashiers and above work from the
// Orders list, so they do not inherit these.
const WORKER_ONLY: Permission[] = ["menu.view", "order.create", "monitor.view"];

const ADMIN: Permission[] = [
  ...WORKER.filter((permission) => !WORKER_ONLY.includes(permission)),
  "dashboard.view",
  "order.view.all",
  // Refunding an order after it has been completed stays with cashiers and above.
  "order.return.completed",
  "payment.settle",
  "price.adjust",
  "discount.apply",
  "menu.manage",
  "deals.manage",
  "billing.view",
  "pricing.manage",
];

const SUPER_ADMIN: Permission[] = [...ADMIN, "reports.view", "employees.manage"];

const GRANTS: Record<Role, ReadonlySet<Permission>> = {
  worker: new Set(WORKER),
  admin: new Set(ADMIN),
  super_admin: new Set(SUPER_ADMIN),
};

export function can(role: Role | undefined | null, permission: Permission) {
  return role ? GRANTS[role].has(permission) : false;
}

export const ROLES: Role[] = ["worker", "admin", "super_admin"];

export const ROLE_LABEL: Record<Role, string> = {
  worker: "Worker",
  admin: "Admin / Cashier",
  super_admin: "Super Admin",
};

export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLES as string[]).includes(value);

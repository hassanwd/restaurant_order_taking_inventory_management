export type OrderType = "dine-in" | "takeaway" | "parcel";

export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  /** Parcels only: handed to the rider, waiting for delivery and (for COD) payment. */
  | "delivery"
  | "completed"
  | "cancelled"
  | "returned";

export type PaymentMethod = "cash" | "card";

export type TableStatus = "free" | "occupied" | "reserved";

export type Role = "worker" | "admin" | "super_admin";

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface OptionChoice {
  id: string;
  name: string;
  price: number;
}

export interface OptionGroup {
  id: string;
  name: string;
  /** `single` renders radio choices, `multi` renders checkboxes. */
  type: "single" | "multi";
  required: boolean;
  choices: OptionChoice[];
}

export interface DealComponent {
  itemId: string;
  quantity: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  icon: string;
  prepMinutes: number;
  available: boolean;
  tags: string[];
  popular?: boolean;
  optionGroups: OptionGroup[];
  /** Deals are surfaced to the order screen as menu items of kind `deal`. */
  kind?: "item" | "deal";
}

export interface Deal {
  id: string;
  name: string;
  description: string;
  price: number;
  items: DealComponent[];
  active: boolean;
  createdAt: string;
  createdBy: string;
}

export interface DiningTable {
  id: string;
  name: string;
  seats: number;
  area: string;
  status: TableStatus;
}

/** A chosen option, flattened onto the cart line so a line is self-describing. */
export interface SelectedOption {
  groupId: string;
  groupName: string;
  choiceId: string;
  choiceName: string;
  price: number;
}

export interface CartLine {
  /** Unique per line — the same item with different options is a separate line. */
  lineId: string;
  itemId: string;
  name: string;
  icon: string;
  /** Effective unit price — equals `listPrice` unless an admin adjusted it in the cart. */
  basePrice: number;
  /** The menu price when the line was added; used to show and audit adjustments. */
  listPrice: number;
  quantity: number;
  options: SelectedOption[];
  notes: string;
}

export interface Customer {
  name: string;
  phone: string;
  email: string;
  /** The customer's location — required for parcel orders. */
  address: string;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  serviceCharge: number;
  tax: number;
  deliveryFee: number;
  tip: number;
  total: number;
  /** Rates in force when the bill was produced, so later setting changes never rewrite history. */
  taxRate: number;
  serviceChargeRate: number;
}

export interface PaymentDetails {
  method: PaymentMethod;
  amountTendered: number;
  change: number;
  reference: string;
}

export interface OrderReturn {
  reason: string;
  amount: number;
  at: string;
  byId: string;
  byName: string;
}

export interface Order {
  id: string;
  code: string;
  type: OrderType;
  tableId: string | null;
  guests: number;
  customer: Customer;
  lines: CartLine[];
  notes: string;
  discountPercent: number;
  totals: OrderTotals;
  status: OrderStatus;
  payment: PaymentDetails | null;
  paidAt: string | null;
  /** Display name of the employee who took the order (snapshot). */
  cashier: string;
  createdById: string;
  returned: OrderReturn | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Tax / charge configuration — edited by admins on the billing screen. */
export interface Pricing {
  /** GST applied when the bill is settled in cash (percent). */
  taxRateCash: number;
  /** GST applied when the bill is settled by card (percent). */
  taxRateCard: number;
  serviceChargeRate: number;
  serviceChargeAppliesTo: OrderType[];
  parcelFee: number;
}

/** What the browser is allowed to know about the signed-in employee. */
export interface SessionUser {
  id: string;
  name: string;
  username: string;
  role: Role;
}

export interface EmployeeView {
  id: string;
  name: string;
  username: string;
  role: Role;
  frozen: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  ordersPlaced: number;
  locked: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  reorderLevel: number;
  createdAt: string;
}

export type MovementType = "in" | "out" | "usage";

export interface InventoryMovement {
  id: string;
  itemId: string;
  itemName: string;
  type: MovementType;
  quantity: number;
  balanceAfter: number;
  note: string;
  at: string;
  byId: string;
  byName: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string | null;
  actorName: string;
  action: string;
  detail: string;
}

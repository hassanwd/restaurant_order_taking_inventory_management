export type OrderType = "dine-in" | "takeaway" | "delivery";

export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "cancelled";

export type PaymentMethod = "cash" | "card" | "wallet";

export type TableStatus = "free" | "occupied" | "reserved";

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
  basePrice: number;
  quantity: number;
  options: SelectedOption[];
  notes: string;
}

export interface Customer {
  name: string;
  phone: string;
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
}

export interface PaymentDetails {
  method: PaymentMethod;
  amountTendered: number;
  change: number;
  reference: string;
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
  cashier: string;
  createdAt: string;
  updatedAt: string;
}

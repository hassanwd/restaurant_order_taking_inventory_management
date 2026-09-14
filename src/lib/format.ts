import type { CartLine, OrderStatus, OrderType, PaymentMethod } from "./types";

export const CURRENCY = "$";

/** Money is kept as plain numbers; round on every derived value to dodge float drift. */
export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function currency(value: number) {
  return `${CURRENCY}${round2(value).toFixed(2)}`;
}

/**
 * Fixed formatter/timezone so the string the server renders matches the one the
 * client hydrates with.
 */
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export const formatDateTime = (iso: string) => dateTimeFormatter.format(new Date(iso));
export const formatTime = (iso: string) => timeFormatter.format(new Date(iso));

export function lineUnitPrice(line: CartLine) {
  return round2(line.basePrice + line.options.reduce((sum, o) => sum + o.price, 0));
}

export function lineTotal(line: CartLine) {
  return round2(lineUnitPrice(line) * line.quantity);
}

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  "dine-in": "Dine In",
  takeaway: "Takeaway",
  delivery: "Delivery",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  wallet: "Wallet",
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Tailwind classes per status, all sourced from the global theme tokens. */
export const STATUS_CLASS: Record<OrderStatus, string> = {
  pending: "bg-warning-soft text-warning",
  preparing: "bg-info-soft text-info",
  ready: "bg-accent-soft text-accent",
  served: "bg-accent-soft text-accent",
  completed: "bg-success-soft text-success",
  cancelled: "bg-danger-soft text-danger",
};

/** The forward-only status pipeline used by the order detail screen. */
export const STATUS_FLOW: OrderStatus[] = [
  "pending",
  "preparing",
  "ready",
  "served",
  "completed",
];

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const index = STATUS_FLOW.indexOf(status);
  if (index === -1 || index === STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[index + 1];
}

export function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

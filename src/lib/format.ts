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
  parcel: "Parcel",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
  returned: "Returned",
};

/** Outlined, so an order-type badge never reads as a (filled) status badge sitting next to it. */
export const ORDER_TYPE_CLASS: Record<OrderType, string> = {
  "dine-in": "border border-accent/60 text-accent",
  takeaway: "border border-info/60 text-info",
  parcel: "border border-fg/50 text-fg",
};

/** Tailwind classes per status, all sourced from the global theme tokens. */
export const STATUS_CLASS: Record<OrderStatus, string> = {
  pending: "bg-warning-soft text-warning",
  preparing: "bg-info-soft text-info",
  ready: "bg-accent-soft text-accent",
  delivery: "bg-info-soft text-info",
  completed: "bg-success-soft text-success",
  cancelled: "bg-danger-soft text-danger",
  returned: "bg-warning-soft text-warning",
};

/** The forward-only status pipeline for dine-in and takeaway orders. */
export const STATUS_FLOW: OrderStatus[] = [
  "pending",
  "preparing",
  "ready",
  "completed",
];

/** A parcel has one more step: once ready it is handed to delivery before it is completed. */
export const PARCEL_STATUS_FLOW: OrderStatus[] = [
  "pending",
  "preparing",
  "ready",
  "delivery",
  "completed",
];

export const flowFor = (type: OrderType): OrderStatus[] =>
  type === "parcel" ? PARCEL_STATUS_FLOW : STATUS_FLOW;

export function nextStatus(status: OrderStatus, type: OrderType = "dine-in"): OrderStatus | null {
  const flow = flowFor(type);
  const index = flow.indexOf(status);
  if (index === -1 || index === flow.length - 1) return null;
  return flow[index + 1];
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

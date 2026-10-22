import { computeTotals } from "@/lib/pricing";
import { round2 } from "@/lib/format";
import type {
  CartLine,
  Order,
  OrderStatus,
  OrderType,
  PaymentMethod,
  Pricing,
} from "@/lib/types";

/** Seeds are written as clock times; they are stamped onto real days when the store is first created. */
const at = (time: string) => time;

interface SeedLine {
  itemId: string;
  name: string;
  icon: string;
  basePrice: number;
  quantity: number;
  options?: [string, string, number][];
  notes?: string;
}

function toLines(orderId: string, seeds: SeedLine[]): CartLine[] {
  return seeds.map((seed, index) => ({
    lineId: `${orderId}-L${index + 1}`,
    itemId: seed.itemId,
    name: seed.name,
    icon: seed.icon,
    basePrice: seed.basePrice,
    listPrice: seed.basePrice,
    quantity: seed.quantity,
    notes: seed.notes ?? "",
    options: (seed.options ?? []).map(([groupName, choiceName, price]) => ({
      groupId: groupName.toLowerCase(),
      groupName,
      choiceId: choiceName.toLowerCase().replace(/\s+/g, "-"),
      choiceName,
      price,
    })),
  }));
}

interface SeedOrder {
  code: string;
  type: OrderType;
  tableId: string | null;
  guests: number;
  customer: { name: string; phone: string; address: string; email?: string };
  status: OrderStatus;
  discountPercent: number;
  notes: string;
  createdAt: string;
  payment: { method: PaymentMethod; tendered: number } | null;
  lines: SeedLine[];
}

const SEEDS: SeedOrder[] = [];

export interface SeedCreator {
  id: string;
  name: string;
}

function buildOrder(
  seed: SeedOrder,
  day: string,
  code: string,
  creator: SeedCreator,
  pricing: Pricing,
): Order {
  const lines = toLines(code, seed.lines);
  const method = seed.payment?.method ?? null;
  const totals = computeTotals({
    lines,
    orderType: seed.type,
    discountPercent: seed.discountPercent,
    pricing,
    method,
  });
  const createdAt = `${day}T${seed.createdAt}:00.000Z`;
  const tendered = seed.payment?.tendered || totals.total;
  const returned = seed.status === "returned";

  return {
    id: code,
    code,
    type: seed.type,
    tableId: seed.tableId,
    guests: seed.guests,
    customer: { email: "", ...seed.customer },
    lines,
    notes: seed.notes,
    discountPercent: seed.discountPercent,
    totals,
    status: seed.status,
    payment: seed.payment
      ? {
          method: seed.payment.method,
          amountTendered: round2(tendered),
          change: round2(Math.max(0, tendered - totals.total)),
          reference: `${seed.payment.method.toUpperCase()}-${code.slice(-4)}`,
        }
      : null,
    paidAt: seed.payment ? createdAt : null,
    cashier: creator.name,
    createdById: creator.id,
    returned: returned
      ? {
          reason: "Guest found the dish undercooked.",
          amount: totals.total,
          at: createdAt,
          byId: creator.id,
          byName: creator.name,
        }
      : null,
    cancelReason: seed.status === "cancelled" ? "Duplicate order" : null,
    createdAt,
    updatedAt: createdAt,
  };
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Demo orders: the full set lands on today, and the settled ones are repeated on
 * the previous days so the weekly and monthly reports have something to show.
 */
export function buildSeedOrders(now: Date, creators: SeedCreator[], pricing: Pricing): Order[] {
  const orders: Order[] = [];
  let counter = 1000;
  const next = () => `ORD-${++counter}`;

  const history = [...SEEDS].reverse();
  for (let back = 9; back >= 1; back -= 1) {
    const day = isoDay(new Date(now.getTime() - back * 86_400_000));
    history
      .filter((seed) => seed.status === "completed" || seed.status === "returned")
      .forEach((seed, index) => {
        if ((index + back) % 2 === 1) return;
        orders.push(buildOrder(seed, day, next(), creators[index % creators.length], pricing));
      });
  }

  const today = isoDay(now);
  [...SEEDS].reverse().forEach((seed, index) => {
    orders.push(buildOrder(seed, today, next(), creators[index % creators.length], pricing));
  });

  return orders;
}

export const SEED_ORDER_COUNTER = (orders: Order[]) =>
  orders.reduce((max, order) => Math.max(max, Number(order.code.replace("ORD-", "")) || 0), 1000);

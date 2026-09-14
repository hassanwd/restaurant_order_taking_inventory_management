import { computeTotals } from "@/lib/pricing";
import type { CartLine, Order, OrderStatus, OrderType, PaymentMethod } from "@/lib/types";
import { OUTLET } from "./settings";

/** Fixed clock so server and client render identical timestamps for the seed data. */
const SEED_DAY = "2026-09-09";
const at = (time: string) => `${SEED_DAY}T${time}:00.000Z`;

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
  customer: { name: string; phone: string; address: string };
  status: OrderStatus;
  discountPercent: number;
  notes: string;
  createdAt: string;
  payment: { method: PaymentMethod; tendered: number } | null;
  lines: SeedLine[];
}

const SEEDS: SeedOrder[] = [
  {
    code: "ORD-1041",
    type: "dine-in",
    tableId: "T4",
    guests: 4,
    customer: { name: "Walk-in Guest", phone: "", address: "" },
    status: "preparing",
    discountPercent: 0,
    notes: "Birthday table — bring dessert with a candle.",
    createdAt: at("11:12"),
    payment: null,
    lines: [
      {
        itemId: "itm-201",
        name: "Charcoal Ribeye",
        icon: "🥩",
        basePrice: 28.9,
        quantity: 2,
        options: [
          ["Doneness", "Medium Rare", 0],
          ["Add-ons", "Peppercorn Sauce", 2.5],
        ],
      },
      { itemId: "itm-102", name: "Garlic Truffle Fries", icon: "🍟", basePrice: 6.25, quantity: 2 },
      {
        itemId: "itm-702",
        name: "Iced Caramel Latte",
        icon: "🧋",
        basePrice: 5.2,
        quantity: 2,
        options: [
          ["Size", "Large", 1.2],
          ["Milk", "Oat", 0.6],
        ],
      },
    ],
  },
  {
    code: "ORD-1040",
    type: "delivery",
    tableId: null,
    guests: 1,
    customer: {
      name: "Amara Osei",
      phone: "+1 (555) 771-0034",
      address: "88 Maple Court, Apt 12B, Downtown",
    },
    status: "ready",
    discountPercent: 10,
    notes: "Leave at the front desk.",
    createdAt: at("11:02"),
    payment: { method: "card", tendered: 0 },
    lines: [
      {
        itemId: "itm-302",
        name: "Spicy Pepperoni",
        icon: "🍕",
        basePrice: 14.5,
        quantity: 1,
        options: [["Size", "14 inch Medium", 4]],
      },
      { itemId: "itm-101", name: "Loaded Nachos", icon: "🌮", basePrice: 8.5, quantity: 1 },
      { itemId: "itm-703", name: "Sparkling Water", icon: "💧", basePrice: 3, quantity: 2 },
    ],
  },
  {
    code: "ORD-1039",
    type: "takeaway",
    tableId: null,
    guests: 1,
    customer: { name: "Daniel Reyes", phone: "+1 (555) 908-2211", address: "" },
    status: "completed",
    discountPercent: 0,
    notes: "",
    createdAt: at("10:41"),
    payment: { method: "cash", tendered: 60 },
    lines: [
      {
        itemId: "itm-401",
        name: "Smash Cheeseburger",
        icon: "🍔",
        basePrice: 13.25,
        quantity: 2,
        options: [
          ["Patty", "Double", 0],
          ["Add-ons", "Streaky Bacon", 2],
        ],
        notes: "No pickles on one.",
      },
      { itemId: "itm-102", name: "Garlic Truffle Fries", icon: "🍟", basePrice: 6.25, quantity: 1 },
      { itemId: "itm-601", name: "Molten Chocolate Cake", icon: "🍫", basePrice: 7.9, quantity: 2 },
    ],
  },
  {
    code: "ORD-1038",
    type: "dine-in",
    tableId: "T9",
    guests: 3,
    customer: { name: "Walk-in Guest", phone: "", address: "" },
    status: "served",
    discountPercent: 5,
    notes: "",
    createdAt: at("10:15"),
    payment: null,
    lines: [
      { itemId: "itm-501", name: "Truffle Carbonara", icon: "🍝", basePrice: 16.4, quantity: 2 },
      { itemId: "itm-502", name: "Arrabbiata Penne", icon: "🌶️", basePrice: 13.6, quantity: 1 },
      { itemId: "itm-701", name: "Fresh Orange Juice", icon: "🍊", basePrice: 4.5, quantity: 3 },
    ],
  },
  {
    code: "ORD-1037",
    type: "takeaway",
    tableId: null,
    guests: 1,
    customer: { name: "Priya Nair", phone: "+1 (555) 442-7781", address: "" },
    status: "pending",
    discountPercent: 0,
    notes: "Customer arriving in 15 minutes.",
    createdAt: at("10:04"),
    payment: null,
    lines: [
      { itemId: "itm-403", name: "Beyond Veggie Burger", icon: "🥬", basePrice: 13.9, quantity: 1 },
      { itemId: "itm-602", name: "New York Cheesecake", icon: "🍰", basePrice: 6.95, quantity: 1 },
    ],
  },
  {
    code: "ORD-1036",
    type: "delivery",
    tableId: null,
    guests: 1,
    customer: {
      name: "Marcus Lin",
      phone: "+1 (555) 330-1190",
      address: "5 Harbour Lane, Riverside",
    },
    status: "cancelled",
    discountPercent: 0,
    notes: "Customer cancelled — duplicate order.",
    createdAt: at("09:48"),
    payment: null,
    lines: [
      { itemId: "itm-202", name: "Smoked BBQ Ribs", icon: "🍖", basePrice: 21.5, quantity: 1 },
    ],
  },
  {
    code: "ORD-1035",
    type: "dine-in",
    tableId: "T2",
    guests: 2,
    customer: { name: "Walk-in Guest", phone: "", address: "" },
    status: "completed",
    discountPercent: 0,
    notes: "",
    createdAt: at("09:20"),
    payment: { method: "wallet", tendered: 0 },
    lines: [
      {
        itemId: "itm-301",
        name: "Margherita",
        icon: "🍕",
        basePrice: 12,
        quantity: 1,
        options: [
          ["Size", "14 inch Medium", 4],
          ["Crust", "Thin and Crispy", 0],
        ],
      },
      { itemId: "itm-203", name: "Grilled Salmon", icon: "🐟", basePrice: 19.75, quantity: 1 },
      { itemId: "itm-702", name: "Iced Caramel Latte", icon: "🧋", basePrice: 5.2, quantity: 2 },
    ],
  },
];

function buildOrder(seed: SeedOrder): Order {
  const lines = toLines(seed.code, seed.lines);
  const totals = computeTotals({
    lines,
    orderType: seed.type,
    discountPercent: seed.discountPercent,
  });

  return {
    id: seed.code,
    code: seed.code,
    type: seed.type,
    tableId: seed.tableId,
    guests: seed.guests,
    customer: seed.customer,
    lines,
    notes: seed.notes,
    discountPercent: seed.discountPercent,
    totals,
    status: seed.status,
    payment: seed.payment
      ? {
          method: seed.payment.method,
          amountTendered: seed.payment.tendered || totals.total,
          change: Math.max(0, Math.round(((seed.payment.tendered || totals.total) - totals.total) * 100) / 100),
          reference: `${seed.payment.method.toUpperCase()}-${seed.code.slice(-4)}`,
        }
      : null,
    cashier: OUTLET.cashier,
    createdAt: seed.createdAt,
    updatedAt: seed.createdAt,
  };
}

export const SEED_ORDERS: Order[] = SEEDS.map(buildOrder);

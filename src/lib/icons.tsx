import {
  Armchair,
  Banknote,
  Bell,
  Bike,
  CakeSlice,
  ChefHat,
  CircleCheck,
  CircleX,
  ClipboardList,
  Clock,
  CookingPot,
  CreditCard,
  CupSoda,
  Flame,
  LayoutDashboard,
  LayoutGrid,
  ListOrdered,
  Pizza,
  Salad,
  Sandwich,
  ShoppingBag,
  Smartphone,
  Soup,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { OrderStatus, OrderType, PaymentMethod } from "./types";

/**
 * Real icon components, in one place, instead of emoji scattered across
 * components. Everything here is a `LucideIcon` — render with
 * `<Icon className="size-4" />` (size + colour come from the caller).
 */

export const ORDER_TYPE_ICONS: Record<OrderType, LucideIcon> = {
  "dine-in": Utensils,
  takeaway: ShoppingBag,
  delivery: Bike,
};

export const PAYMENT_ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  wallet: Smartphone,
};

export const STATUS_ICONS: Record<OrderStatus, LucideIcon> = {
  pending: Clock,
  preparing: CookingPot,
  ready: Bell,
  served: Utensils,
  completed: CircleCheck,
  cancelled: CircleX,
};

/** Keyed by category id from `src/data/menu.ts` — chrome only, not menu data. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  all: LayoutGrid,
  starters: Soup,
  grill: Flame,
  pizza: Pizza,
  burgers: Sandwich,
  pasta: ChefHat,
  desserts: CakeSlice,
  drinks: CupSoda,
};

export const NAV_ICONS = {
  dashboard: LayoutDashboard,
  newOrder: ClipboardList,
  orders: ListOrdered,
  tables: Armchair,
} satisfies Record<string, LucideIcon>;

/** Fallback for a category id this map doesn't know about. */
export const DEFAULT_CATEGORY_ICON: LucideIcon = Salad;

import type { OrderType } from "@/lib/types";

/** Static outlet configuration — stands in for what would come from a settings API. */
export const OUTLET = {
  name: "Saffron & Smoke",
  tagline: "Kitchen · Grill · Coffee",
  branch: "Downtown Branch",
  address: "142 Riverside Avenue, Downtown",
  phone: "+1 (555) 214-8890",
  taxId: "TX-9938-21",
  cashier: "Hassan K.",
  register: "POS-02",
};

export const PRICING = {
  /** Percentages. */
  taxRate: 8.5,
  serviceChargeRate: 5,
  /** Service charge only applies to dine-in orders. */
  serviceChargeAppliesTo: ["dine-in"] as OrderType[],
  deliveryFee: 3.5,
};

export const TIP_PRESETS = [0, 5, 10, 15];

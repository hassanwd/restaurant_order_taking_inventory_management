import type { Pricing } from "@/lib/types";

/** Static outlet configuration — printed on receipts and shown in the sidebar. */
export const OUTLET = {
  name: "Saffron & Smoke",
  tagline: "Kitchen · Grill · Coffee",
  branch: "Downtown Branch",
  address: "142 Riverside Avenue, Downtown",
  phone: "+1 (555) 214-8890",
  taxId: "TX-9938-21",
  register: "POS-02",
};

/**
 * Starting tax configuration. Admins change the live values on the Billing
 * screen; these only seed the data store the first time the app runs.
 */
export const DEFAULT_PRICING: Pricing = {
  /** Percentages. GST differs by how the bill is settled. */
  taxRateCash: 8.5,
  taxRateCard: 5,
  serviceChargeRate: 5,
  /** Service charge only applies to dine-in orders. */
  serviceChargeAppliesTo: ["dine-in"],
  parcelFee: 3.5,
};


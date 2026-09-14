import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Order, OrderStatus } from "@/lib/types";

export interface OrdersState {
  /** Seeded on the server via `preloadedState`, then extended on the client. */
  items: Order[];
  /** Ids created in this browser session — kept so they survive a reload. */
  localIds: string[];
  lastPlacedId: string | null;
  filter: OrderStatus | "all";
  search: string;
}

export const initialOrdersState: OrdersState = {
  items: [],
  localIds: [],
  lastPlacedId: null,
  filter: "all",
  search: "",
};

const sortByNewest = (orders: Order[]) =>
  [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const ordersSlice = createSlice({
  name: "orders",
  initialState: initialOrdersState,
  reducers: {
    placeOrder(state, action: PayloadAction<Order>) {
      state.items = sortByNewest([action.payload, ...state.items]);
      if (!state.localIds.includes(action.payload.id)) {
        state.localIds.push(action.payload.id);
      }
      state.lastPlacedId = action.payload.id;
    },
    updateOrderStatus(state, action: PayloadAction<{ id: string; status: OrderStatus }>) {
      const order = state.items.find((entry) => entry.id === action.payload.id);
      if (!order) return;
      order.status = action.payload.status;
      order.updatedAt = new Date().toISOString();
      if (!state.localIds.includes(order.id)) state.localIds.push(order.id);
    },
    clearLastPlaced(state) {
      state.lastPlacedId = null;
    },
    setFilter(state, action: PayloadAction<OrderStatus | "all">) {
      state.filter = action.payload;
    },
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
    },
    /**
     * Merges orders restored from localStorage on top of the server-seeded list.
     * The stored copy wins so client-side status changes are not lost on reload.
     */
    hydrateOrders(state, action: PayloadAction<{ items: Order[]; localIds: string[] }>) {
      const merged = new Map(state.items.map((order) => [order.id, order]));
      for (const order of action.payload.items) merged.set(order.id, order);
      state.items = sortByNewest([...merged.values()]);
      state.localIds = Array.from(new Set([...state.localIds, ...action.payload.localIds]));
    },
  },
});

export const {
  placeOrder,
  updateOrderStatus,
  clearLastPlaced,
  setFilter,
  setSearch,
  hydrateOrders,
} = ordersSlice.actions;

export default ordersSlice.reducer;

import { createSlice, nanoid, type PayloadAction } from "@reduxjs/toolkit";
import { clampPercent } from "@/lib/pricing";
import type { CartLine, Customer, MenuItem, OrderType, SelectedOption } from "@/lib/types";

export interface CartState {
  orderType: OrderType;
  tableId: string | null;
  guests: number;
  customer: Customer;
  lines: CartLine[];
  notes: string;
  discountPercent: number;
}

const emptyCustomer: Customer = { name: "", phone: "", email: "", address: "" };

export const initialCartState: CartState = {
  orderType: "dine-in",
  tableId: null,
  guests: 2,
  customer: emptyCustomer,
  lines: [],
  notes: "",
  discountPercent: 0,
};

/** Two lines merge only when they are the same item with the same options and notes. */
function sameConfiguration(line: CartLine, itemId: string, options: SelectedOption[], notes: string) {
  if (line.itemId !== itemId || line.notes !== notes) return false;
  if (line.options.length !== options.length) return false;
  const key = (list: SelectedOption[]) =>
    list
      .map((option) => `${option.groupId}:${option.choiceId}`)
      .sort()
      .join("|");
  return key(line.options) === key(options);
}

const cartSlice = createSlice({
  name: "cart",
  initialState: initialCartState,
  reducers: {
    setOrderType(state, action: PayloadAction<OrderType>) {
      state.orderType = action.payload;
      if (action.payload !== "dine-in") {
        state.tableId = null;
        state.guests = 1;
      } else if (state.guests < 1) {
        state.guests = 2;
      }
    },
    setTable(state, action: PayloadAction<string | null>) {
      state.tableId = action.payload;
    },
    setGuests(state, action: PayloadAction<number>) {
      state.guests = Math.min(30, Math.max(1, Math.round(action.payload) || 1));
    },
    setCustomerField(
      state,
      action: PayloadAction<{ field: keyof Customer; value: string }>,
    ) {
      state.customer[action.payload.field] = action.payload.value;
    },
    setOrderNotes(state, action: PayloadAction<string>) {
      state.notes = action.payload;
    },
    setDiscountPercent(state, action: PayloadAction<number>) {
      state.discountPercent = clampPercent(action.payload);
    },
    addLine: {
      reducer(state, action: PayloadAction<CartLine>) {
        const incoming = action.payload;
        const existing = state.lines.find((line) =>
          sameConfiguration(line, incoming.itemId, incoming.options, incoming.notes),
        );
        if (existing) {
          existing.quantity += incoming.quantity;
          return;
        }
        state.lines.push(incoming);
      },
      prepare(payload: {
        item: MenuItem;
        quantity?: number;
        options?: SelectedOption[];
        notes?: string;
      }) {
        const { item, quantity = 1, options = [], notes = "" } = payload;
        const line: CartLine = {
          lineId: nanoid(8),
          itemId: item.id,
          name: item.name,
          icon: item.icon,
          basePrice: item.price,
          listPrice: item.price,
          quantity,
          options,
          notes,
        };
        return { payload: line };
      },
    },
    incrementLine(state, action: PayloadAction<string>) {
      const line = state.lines.find((entry) => entry.lineId === action.payload);
      if (line) line.quantity += 1;
    },
    decrementLine(state, action: PayloadAction<string>) {
      const index = state.lines.findIndex((entry) => entry.lineId === action.payload);
      if (index === -1) return;
      const line = state.lines[index];
      if (line.quantity <= 1) {
        state.lines.splice(index, 1);
      } else {
        line.quantity -= 1;
      }
    },
    setLineQuantity(state, action: PayloadAction<{ lineId: string; quantity: number }>) {
      const line = state.lines.find((entry) => entry.lineId === action.payload.lineId);
      if (!line) return;
      line.quantity = Math.min(99, Math.max(1, Math.round(action.payload.quantity) || 1));
    },
    /** Adjusting a price is an admin action; the server rejects it for anyone else. */
    setLinePrice(state, action: PayloadAction<{ lineId: string; price: number }>) {
      const line = state.lines.find((entry) => entry.lineId === action.payload.lineId);
      if (!line) return;
      const price = Math.round((action.payload.price + Number.EPSILON) * 100) / 100;
      line.basePrice = Number.isFinite(price) ? Math.min(100000, Math.max(0, price)) : line.listPrice;
    },
    setLineNotes(state, action: PayloadAction<{ lineId: string; notes: string }>) {
      const line = state.lines.find((entry) => entry.lineId === action.payload.lineId);
      if (line) line.notes = action.payload.notes;
    },
    removeLine(state, action: PayloadAction<string>) {
      state.lines = state.lines.filter((line) => line.lineId !== action.payload);
    },
    clearLines(state) {
      state.lines = [];
      state.discountPercent = 0;
      state.notes = "";
    },
    resetCart() {
      return { ...initialCartState, customer: { ...emptyCustomer } };
    },
    /** Restores a cart saved to localStorage by <StatePersistence />. */
    hydrateCart(state, action: PayloadAction<Partial<CartState>>) {
      return { ...state, ...action.payload, customer: { ...state.customer, ...action.payload.customer } };
    },
  },
});

export const {
  setOrderType,
  setTable,
  setGuests,
  setCustomerField,
  setOrderNotes,
  setDiscountPercent,
  addLine,
  incrementLine,
  decrementLine,
  setLineQuantity,
  setLinePrice,
  setLineNotes,
  removeLine,
  clearLines,
  resetCart,
  hydrateCart,
} = cartSlice.actions;

export default cartSlice.reducer;

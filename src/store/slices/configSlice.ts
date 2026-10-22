import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { DEFAULT_PRICING } from "@/data/settings";
import type { Pricing, SessionUser } from "@/lib/types";

export interface ConfigState {
  /** Live tax / charge settings, read on the server and mirrored here so cart maths matches the bill. */
  pricing: Pricing;
  /** The signed-in employee — used only to hide controls; the server re-checks everything. */
  user: SessionUser | null;
}

export const initialConfigState: ConfigState = { pricing: DEFAULT_PRICING, user: null };

const configSlice = createSlice({
  name: "config",
  initialState: initialConfigState,
  reducers: {
    syncConfig(_state, action: PayloadAction<ConfigState>) {
      return action.payload;
    },
  },
});

export const { syncConfig } = configSlice.actions;
export default configSlice.reducer;

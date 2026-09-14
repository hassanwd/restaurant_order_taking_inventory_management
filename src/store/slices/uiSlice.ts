import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ThemeMode = "light" | "dark";

export interface UiState {
  sidebarOpen: boolean;
  theme: ThemeMode;
  activeCategory: string;
  menuSearch: string;
  /** Item id whose option sheet is open, or null. */
  configuringItemId: string | null;
  cartDrawerOpen: boolean;
  toast: { id: number; message: string; tone: "success" | "info" | "danger" } | null;
}

export const initialUiState: UiState = {
  sidebarOpen: false,
  theme: "light",
  activeCategory: "all",
  menuSearch: "",
  configuringItemId: null,
  cartDrawerOpen: false,
  toast: null,
};

let toastSeq = 0;

const uiSlice = createSlice({
  name: "ui",
  initialState: initialUiState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    setTheme(state, action: PayloadAction<ThemeMode>) {
      state.theme = action.payload;
    },
    toggleTheme(state) {
      state.theme = state.theme === "light" ? "dark" : "light";
    },
    setActiveCategory(state, action: PayloadAction<string>) {
      state.activeCategory = action.payload;
    },
    setMenuSearch(state, action: PayloadAction<string>) {
      state.menuSearch = action.payload;
    },
    openItemConfigurator(state, action: PayloadAction<string>) {
      state.configuringItemId = action.payload;
    },
    closeItemConfigurator(state) {
      state.configuringItemId = null;
    },
    setCartDrawerOpen(state, action: PayloadAction<boolean>) {
      state.cartDrawerOpen = action.payload;
    },
    showToast(
      state,
      action: PayloadAction<{ message: string; tone?: "success" | "info" | "danger" }>,
    ) {
      toastSeq += 1;
      state.toast = {
        id: toastSeq,
        message: action.payload.message,
        tone: action.payload.tone ?? "success",
      };
    },
    dismissToast(state) {
      state.toast = null;
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  setTheme,
  toggleTheme,
  setActiveCategory,
  setMenuSearch,
  openItemConfigurator,
  closeItemConfigurator,
  setCartDrawerOpen,
  showToast,
  dismissToast,
} = uiSlice.actions;

export default uiSlice.reducer;

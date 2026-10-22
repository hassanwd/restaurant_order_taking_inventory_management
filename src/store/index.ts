import { combineReducers, configureStore } from "@reduxjs/toolkit";
import cartReducer from "./slices/cartSlice";
import configReducer from "./slices/configSlice";
import uiReducer from "./slices/uiSlice";

const rootReducer = combineReducers({
  cart: cartReducer,
  config: configReducer,
  ui: uiReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

/**
 * A factory, not a singleton.
 *
 * With SSR the module is shared between requests, so a module-level store would
 * leak one user's cart into another user's render. Every request (and every
 * client mount) builds its own store, seeded with state prepared on the server.
 */
export const makeStore = (preloadedState?: Partial<RootState>) =>
  configureStore({
    reducer: rootReducer,
    preloadedState,
    devTools: process.env.NODE_ENV !== "production",
  });

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];

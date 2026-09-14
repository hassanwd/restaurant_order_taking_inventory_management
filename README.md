# Order Taking System

A restaurant point-of-sale built with **Next.js (App Router)**, **Tailwind CSS v4**, **Redux
Toolkit** and **server-side rendering**. Every screen of the order-taking flow is here, from
picking a table to handing the guest a printed receipt.

All data is static for now — it lives in `src/data/` and is read through a server-only data
layer, so swapping in a real API later touches one file.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## The flow

| Screen | Route | What it does |
| --- | --- | --- |
| Dashboard | `/` | Today's revenue, open orders, top sellers, floor status |
| Tables | `/tables` | Floor plan; tap a free table to start a dine-in order |
| New order | `/order/new` | Order type, table/customer, menu browser, live cart |
| Checkout | `/order/checkout` | Payment method, tip, cash tendered and change |
| Orders | `/orders` | Searchable, status-filtered, paginated list of every order |
| Order details | `/orders/[id]` | Full breakdown; advance status or cancel |
| Print | `/print/[id]` | 80mm customer receipt and kitchen ticket, print-ready |

Taking an order end to end: pick the order type → choose a table (dine-in) or enter customer
details (takeaway/delivery) → tap dishes (items with options open a configurator for size, crust,
doneness, add-ons and a kitchen note) → adjust quantities, per-line notes and a discount in the
cart → **Review & Pay** → take payment or send to the kitchen unpaid → the receipt screen opens
with the order ready to print.

## Server-side rendering

Every route is rendered on the server per request (`ƒ` in the build output) — there is no static
snapshot of order data to go stale.

- `src/server/data.ts` is `server-only`. Pages call it directly as async Server Components, so the
  menu, orders, tables and dashboard statistics are already in the first HTML response.
- `src/app/layout.tsx` awaits `getOrders()` on the server and hands the result to Redux as
  `preloadedState`, so client components that read the store render complete markup during SSR
  instead of flashing empty.
- `src/store/index.ts` exports a `makeStore` **factory**, never a module-level singleton — a shared
  store would leak one request's cart into another's render. `StoreProvider` creates one instance
  per mount with `useRef`.
- Anything that can only exist in the browser (saved theme, restored cart) is applied in an effect
  after hydration, so the server HTML and the first client render always match.

## Redux Toolkit

| Slice | Holds |
| --- | --- |
| `cart` | The order being built: type, table, guests, customer, lines, notes, discount, tip |
| `orders` | Every order — seeded from the server, extended by orders placed in the browser |
| `ui` | Theme, sidebar, active category, menu search, open modals, toasts |

`src/store/selectors.ts` derives everything else — cart totals, filtered orders, status counts and
the validation issues that gate checkout. Order maths lives in `src/lib/pricing.ts` so the cart,
the checkout screen and the seeded orders can never disagree.

The cart and locally created orders are mirrored to `localStorage` by `StatePersistence`, so a
refresh mid-order does not lose the guest's food.

## Theme

The colour theme is defined once, globally, in `src/app/globals.css`: a **light orange** brand
ramp against **dark** warm neutrals and **white** surfaces. Semantic tokens (`--surface`, `--fg`,
`--accent`, …) are re-declared under `[data-theme="dark"]` and exposed to Tailwind through
`@theme inline`, so components use `bg-surface` / `text-fg-muted` / `bg-accent` and never a raw
hex value. Both themes are complete; the toggle lives in the top bar, and an inline script applies
the saved choice before first paint so there is no flash.

Print styling is part of the same stylesheet: `@page` is set to an 80mm roll, `.no-print` hides
the UI chrome and `.print-sheet` flattens the receipt to black on white.

The sidebar's active nav item uses its own fixed token, `--sidebar-active` (`#e26311`), separate
from the general `--accent` used by buttons and chips — so it stays put even if the brand ramp
changes.

## Icons

All interactive chrome — nav, buttons, status badges, payment/order-type indicators, search,
pagination, the modal close button, quantity steppers, toasts — renders real SVG icons from
[lucide-react](https://lucide.dev), mapped once in `src/lib/icons.tsx` rather than repeated inline.
The one deliberate exception is the emoji per dish in `src/data/menu.ts`: those stand in for a
food photo, not a UI icon, so they stay as data.

## Interaction feel

`src/components/ui/Button.tsx` gives every button a lift-on-hover, compress-on-press motion
(`hover:-translate-y-0.5` + a deeper shadow, `active:scale-[0.97]` + a shallower one) instead of a
flat colour swap. The same `active:scale-*` treatment is applied to chips, cards, and icon-only
buttons throughout so the whole app feels consistently pressable, and `-webkit-tap-highlight-color`
is disabled globally so mobile taps don't flash blue underneath it.

## Project layout

```
src/
  app/
    layout.tsx            root layout — fonts, theme bootstrap, Redux provider
    (shell)/              POS screens that share the sidebar + top bar
    print/[id]/           receipt screen, deliberately outside the shell
  components/
    layout/               sidebar, top bar, theme sync
    order/                order taking, checkout, detail, receipt, kitchen ticket
    ui/                   buttons, modal, toaster, form primitives
  data/                   static menu, tables, seeded orders, outlet settings
  lib/                    types, money formatting, pricing rules
  server/data.ts          server-only data access
  store/                  Redux Toolkit store, slices, selectors, persistence
```

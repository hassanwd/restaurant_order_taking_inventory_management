# Order Taking System

A role-based restaurant point-of-sale built with **Next.js (App Router)**, **Tailwind CSS v4**,
**Redux Toolkit**, **server-side rendering** and a real, server-enforced **security model**:
employee accounts, roles, sessions, validated server actions and an audit trail.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

On the **first start** the app creates its data store in `.data/` (git-ignored) and generates a
**random password for each of three starter accounts**. They are printed in the server console and
saved to `.data/initial-credentials.txt`:

| Username | Role |
| --- | --- |
| `superadmin` | Super Admin |
| `cashier` | Admin / Cashier |
| `waiter` | Worker |

Sign in, change the passwords from the account menu (top right), then **delete the credentials
file**. A Super Admin can reset any password from the Employees screen. To start over, stop the
server and delete `.data/`.

| Environment variable | Purpose |
| --- | --- |
| `OTS_DATA_DIR` | Where the data store lives (default `./.data`) |
| `OTS_INSECURE_COOKIES=1` | Allow the session cookie over plain http. Only for a trusted LAN without https — in production the cookie is `Secure` and `__Host-` prefixed |
| `OTS_FORCE_HTTPS=1` | Add `upgrade-insecure-requests` to the CSP (use when served over https) |

## Roles

What each role can do — enforced on the server for every page, action and export (the UI merely
hides what you cannot use).

| | Worker | Admin / Cashier | Super Admin |
| --- | :-: | :-: | :-: |
| View menu, drinks, add-ons and deals; add them to the cart | ✅ | | |
| Enter customer name, phone, email and location | ✅ | | |
| Choose dine-in / takeaway / parcel | ✅ | | |
| Place an order | ✅ | | |
| Show the customer bill and kitchen ticket | ✅ | ✅ | ✅ |
| Live **Monitor** of orders in progress | ✅ | | |
| Take payment by **cash or card** (GST by payment method) — workers on their own orders | ✅ | ✅ | ✅ |
| See orders | own only | all | all |
| Advance order status (pending → preparing → ready) | ✅ | ✅ | ✅ |
| Complete a Ready order / hand a parcel to delivery (from the Orders list; workers use Monitor) | ✅ | ✅ | ✅ |
| Cancel or **return** an order **before it is completed** (reason required; a paid order is refunded) — workers on their own orders | ✅ | ✅ | ✅ |
| Return an order **after** it was completed (refund + reason) | | ✅ | ✅ |
| Add / delete menu items, mark sold out, change prices | | ✅ | ✅ |
| Create / pause / delete deals | | ✅ | ✅ |
| Billing & sales records, tax / GST settings | | ✅ | ✅ |
| Daily / weekly / monthly reports (orders, billing) + CSV export | | | ✅ |
| Add / delete employees, freeze / unfreeze, reset passwords | | | ✅ |

The permission table lives in one file, `src/lib/permissions.ts`.

## The flow

| Screen | Route | Who |
| --- | --- | --- |
| Sign in | `/login` | everyone |
| Dashboard | `/` | cashier and up (workers land on New order) |
| New order | `/order/new` | workers only |
| Checkout | `/order/checkout` | workers only |
| Monitor | `/monitor` | workers only |
| Orders / details | `/orders`, `/orders/[id]` | everyone (workers: own orders only) |
| Bill & kitchen ticket | `/print/[id]` | everyone (same scoping) |
| Menu & deals | `/menu` | cashier and up |
| Billing & GST settings | `/billing` | cashier and up |
| Reports | `/reports` | Super Admin |
| Employees | `/employees` | Super Admin |

A worker picks the order type (and Table 1–5 for dine-in), taps items (menu, drinks, add-ons or a
deal) and reviews the cart. **Checkout** asks only what the order type needs — name and order note for
dine-in and takeaway; name, phone, location and order note for parcel.

- **Dine-in and takeaway are paid first.** Checkout takes payment (cash or card, which selects the
  GST rate) and only then places the order. The server refuses an unpaid dine-in or takeaway order.
- **Parcel offers COD or By Card at checkout.** *By Card* takes payment and places the order paid.
  *COD* (cash on delivery) places it unpaid.
- **The Orders list moves an order Pending → Preparing → Ready** with the **Next step** button, one step
  at a time, and stops there.
- **Monitor is the live view** of orders in progress: tabs for Dine In, Takeaway and Parcel hold Pending and
  Preparing orders; an order that becomes Ready moves to the **Ready** tab. Completed, cancelled and returned
  orders are not shown there (they stay in the Orders list).
- **Ready orders are handled on Monitor › Ready.** Dine-in and takeaway cards have **Complete**. A **parcel**
  card has **Delivery**: pressing it hands the parcel to the rider, it leaves Monitor, and on the Orders list
  it becomes **Out for delivery**. There a COD parcel shows *Awaiting payment* — clicking it asks *Payment
  received?* (cash or card) and, once confirmed, completes the order; a parcel already paid by card shows
  **Delivered**.
- Confirming an order offers **Print order**, View order or New order. A cashier can additionally adjust
  prices, apply discounts, cancel or return an order.

Order types are **dine-in**, **takeaway** and **parcel** (packed to go; adds the parcel fee).

## Security

Authentication, authorisation and validation all happen on the server; nothing in the browser is
trusted.

- **Passwords** — hashed with scrypt (per-password salt), compared in constant time; a decoy hash
  runs for unknown usernames so timing does not reveal which accounts exist. Policy: 10+ characters
  with a letter and a number.
- **Sessions** — an opaque 256-bit random token in an `HttpOnly`, `SameSite=Lax`, `Secure`
  (production) cookie. Only its SHA-256 is stored server-side, so a leaked data file cannot be
  replayed. 8 h idle / 12 h absolute expiry, a fresh token on every sign-in (no session fixation),
  and sessions are checked against the stored account on **every request** — freezing or deleting
  an employee, or changing a password, ends their access immediately.
- **Brute force** — 5 failed attempts lock an account for 15 minutes (the same message is returned
  for unknown usernames); a per-address limiter caps spraying across usernames.
- **Authorisation** — role → permission map checked in every page, Server Action and route handler.
  Server Actions are public HTTP endpoints, so each one re-authorises the caller itself.
- **No trusting the client** — an order carries only item ids, option ids and quantities. The server
  re-reads every name and price from the catalogue and recomputes the bill, so a tampered request
  cannot change what something costs. A price override or discount from a role without that
  permission is rejected.
- **No ID guessing** — workers can only load their own orders; someone else's order id returns
  "not found", identical to a missing one.
- **Validation** — every action input is parsed with zod: types, ranges, lengths, enums, control
  characters stripped. Unknown fields are dropped.
- **Headers** — per-request nonce-based **Content-Security-Policy** (`src/proxy.ts`),
  `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, COOP/CORP, HSTS, `no-store` on every
  page, `X-Powered-By` removed.
- **CSV export** — cells starting with `= + - @` are neutralised so customer-typed text cannot run
  as a spreadsheet formula.
- **Uploaded photos** — a menu item or deal photo is never a typed-in link: the file's actual bytes
  are sniffed (not the browser's claimed type or extension) and must be a PNG, JPEG, WEBP or GIF,
  5MB or smaller. It is then named and stored by its own content hash, so the field that records it
  can only ever hold a path to something this app itself validated and saved — never an arbitrary
  or `javascript:` URL — and serving it still goes through the same sign-in check as everything else.
- **Open redirects** — the post-login `?next=` target must be a same-site path.
- **Safeguards** — nobody can freeze or delete their own account, and the last active Super Admin
  cannot be frozen or deleted.
- **Audit trail** — sign-ins (and failures), order placement, status changes, price adjustments,
  discounts, settlements, cancellations, returns, menu/deal/tax changes, employee changes and
  exports are recorded with the actor in `db.audit` (`recordAudit` in `src/server/db.ts`). There is
  no screen that displays it — it exists for a database export or a future admin view to read.
- **Secrets** — no default passwords ship with the app; `.data/` is git-ignored.

> **Deployment notes.** Run behind https. The data store is a single JSON file written atomically
> and serialised in-process, which suits one register or a small site; for several server instances
> replace `src/server/db.ts` (and the queries in `src/server/data.ts`) with a real database — no
> page or action changes. The per-address limiter reads `X-Forwarded-For`, so only expose the app
> through a proxy you control.

## Server-side rendering

Every route is rendered on the server per request (`ƒ` in the build output) — there is no static
snapshot of order data to go stale.

- `src/server/data.ts` is `server-only`. Pages call it directly as async Server Components, scoped
  to the signed-in user, so the menu, orders, tables and statistics are in the first HTML response.
- `src/app/layout.tsx` reads the signed-in user and the live tax settings on the server and hands
  them to Redux as `preloadedState`.
- `src/store/index.ts` exports a `makeStore` **factory**, never a module-level singleton — a shared
  store would leak one request's cart into another's render.
- Mutations are Server Actions in `src/server/actions/`; the client calls them, then
  `router.refresh()` re-renders the page with fresh data.

## Redux Toolkit

| Slice | Holds |
| --- | --- |
| `cart` | The order being built: type, table, guests, customer, lines, notes, discount, tip |
| `config` | Signed-in user (for hiding controls only) and the live tax settings |
| `ui` | Theme, sidebar, active category, menu search, open modals, toasts |

Orders themselves live on the server. The in-progress cart is saved to `localStorage` **per
employee** (and the in-memory cart is cleared on sign-out), so a refresh mid-order does not lose
the guest's food but a shared register never shows one person's cart to the next.

## Theme

The colour theme is defined once, globally, in `src/app/globals.css`: a **light orange** brand
ramp against **dark** warm neutrals and **white** surfaces. Semantic tokens (`--surface`, `--fg`,
`--accent`, …) are re-declared under `[data-theme="dark"]` and exposed to Tailwind through
`@theme inline`, so components use `bg-surface` / `text-fg-muted` / `bg-accent` and never a raw
hex value. Both themes are complete; the toggle lives in the top bar, and an inline script applies
the saved choice before first paint so there is no flash. Every new screen — sign-in, menu,
billing, reports, employees — is built from the same tokens and shared primitives, so the whole
app looks like one product.

Print styling is part of the same stylesheet: `@page` is set to an 80mm roll, `.no-print` hides
the UI chrome and `.print-sheet` flattens the bill to black on white.

The sidebar's active nav item uses its own fixed token, `--sidebar-active` (`#e26311`), separate
from the general `--accent` used by buttons and chips — so it stays put even if the brand ramp
changes.

## Icons

All interactive chrome — nav, buttons, status badges, payment/order-type indicators, search,
pagination, the modal close button, quantity steppers, toasts — renders real SVG icons from
[lucide-react](https://lucide.dev), mapped once in `src/lib/icons.tsx` rather than repeated inline.
A menu item or deal without a photo falls back to a generic icon on a muted tile
(`ItemImage` in `src/components/ui/primitives.tsx`) rather than an emoji.

## Menu & deal photos

Admins add a photo from the Menu & Deals screen by picking a file — there is nowhere to paste a
link. The browser downscales and re-encodes it (max 1600px, JPEG ~85% quality; GIFs are left alone
so an animation is not flattened to its first frame) before uploading, then `uploadImageAction`
(`src/server/actions/uploads.ts`) re-validates it server-side regardless of what the browser did:
the actual bytes are sniffed against PNG/JPEG/WEBP/GIF signatures, capped at 5MB, and saved under
`.data/uploads/` named by their own SHA-256 hash. The hash doubles as a cache key — identical photos
collapse onto one file, and because a given URL's content can never change, `/uploads/[file]/route.ts`
serves it with a cache-forever header after confirming there is still a signed-in session. Replacing
or removing an item's photo later works the same way, one click on its thumbnail in place.

## Interaction feel

`src/components/ui/Button.tsx` gives every button a lift-on-hover, compress-on-press motion
(`hover:-translate-y-0.5` + a deeper shadow, `active:scale-[0.97]` + a shallower one) instead of a
flat colour swap. The same `active:scale-*` treatment is applied to chips, cards, and icon-only
buttons throughout so the whole app feels consistently pressable, and `-webkit-tap-highlight-color`
is disabled globally so mobile taps don't flash blue underneath it.

## Project layout

```
src/
  proxy.ts                CSP nonce + optimistic sign-in redirect
  app/
    layout.tsx            root layout — fonts, theme bootstrap, Redux provider
    login/                sign-in screen
    (shell)/              screens that share the sidebar + top bar (sign-in required)
      menu/ billing/ reports/ employees/   management screens
      export/[kind]/      CSV downloads (permission-checked route handler)
    print/[id]/           bill / kitchen ticket, deliberately outside the shell
    uploads/[file]/       serves a saved menu/deal photo (sign-in checked again, cached forever)
  components/
    layout/               sidebar, top bar, account menu, theme sync
    order/                order taking, checkout, detail, settle/return dialogs, receipt
    admin/                menu, employee managers, tax settings form
    auth/                 login form, change-password dialog
    ui/                   buttons, modal, confirm, toaster, form primitives
  data/                   seed menu, tables, demo orders, outlet settings
  lib/                    types, permissions, money formatting, pricing rules
  server/
    db.ts                 file-backed store, atomic writes, first-run seeding
    security.ts           scrypt, tokens, rate limiting
    session.ts            cookie sessions, requireUser / requirePermission
    uploads.ts            sniffs, hashes and saves a menu/deal photo
    data.ts               role-scoped reads        reports.ts   period reports
    actions/              Server Actions (auth, orders, admin, employees, uploads)
  store/                  Redux Toolkit store, slices, selectors, persistence
```

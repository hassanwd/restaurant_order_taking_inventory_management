"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronsRight, CircleCheck, ClipboardList, Search, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, Input, OrderTypeBadge, Select, StatusBadge } from "@/components/ui/primitives";
import Pagination from "@/components/ui/Pagination";
import { cn } from "@/lib/cn";
import { currency, formatTime, nextStatus, ORDER_TYPE_LABEL, PAYMENT_LABEL, STATUS_LABEL } from "@/lib/format";
import { countByStatus, countByType, filterOrders } from "@/lib/orders";
import { ORDER_TYPE_ICONS, STATUS_ICONS } from "@/lib/icons";
import { can } from "@/lib/permissions";
import type { Order, OrderStatus, OrderType, PaymentMethod, Role } from "@/lib/types";
import { useServerAction } from "@/lib/useServerAction";
import { advanceOrderAction, settleOrderAction } from "@/server/actions/orders";
import PaymentReceivedModal from "./PaymentReceivedModal";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showToast } from "@/store/slices/uiSlice";

type MonitorTab = OrderType | "ready";

/** Dine In, Takeaway and Parcel split by type; Ready gathers every order waiting for pickup, whatever its type. */
const TYPE_TABS: { value: MonitorTab; label: string }[] = [
  { value: "dine-in", label: ORDER_TYPE_LABEL["dine-in"] },
  { value: "takeaway", label: ORDER_TYPE_LABEL.takeaway },
  { value: "parcel", label: ORDER_TYPE_LABEL.parcel },
  { value: "ready", label: STATUS_LABEL.ready },
];

const STATUS_FILTERS: OrderStatus[] = [
  "pending",
  "preparing",
  "delivery",
  "completed",
  "cancelled",
  "returned",
];

/** Roles without Monitor also work Ready orders from this list, so they get a Ready filter. */
const STATUS_FILTERS_WITH_READY: OrderStatus[] = [
  "pending",
  "preparing",
  "ready",
  "delivery",
  "completed",
  "cancelled",
  "returned",
];

/** Monitor only deals with orders still in progress, so its dropdown has just these. */
const MONITOR_STATUS_FILTERS: OrderStatus[] = ["pending", "preparing"];

/** A Super Admin only ever sees finished orders (see `roleSeesOrder`), so only these filters apply. */
const SUPER_ADMIN_STATUS_FILTERS: OrderStatus[] = ["completed", "cancelled"];

function statusFiltersFor(role: Role, monitor: boolean): OrderStatus[] {
  if (monitor) return MONITOR_STATUS_FILTERS;
  if (role === "super_admin") return SUPER_ADMIN_STATUS_FILTERS;
  return can(role, "monitor.view") ? STATUS_FILTERS : STATUS_FILTERS_WITH_READY;
}

/** Rows-per-page choices for the Orders list. Monitor is not paginated — it shows every order in the tab. */
const PAGE_SIZES = [10, 20, 50, 100];


/**
 * What Monitor's Ready tab offers on an order card. A parcel is handed to **Delivery** (it then
 * leaves Monitor and shows on the Orders list as "Out for delivery"). Dine-in and takeaway are
 * simply **Complete**d.
 */
function ReadyControl({
  order,
  role,
  busy,
  onAdvance,
}: {
  order: Order;
  role: Role;
  busy: boolean;
  onAdvance: () => void;
}) {
  if (!can(role, "order.advance")) return null;

  if (order.type === "parcel") {
    return (
      <Button size="sm" fullWidth disabled={busy} onClick={onAdvance}>
        <Truck className="size-3.5" aria-hidden />
        {busy ? "Saving…" : "Delivery"}
      </Button>
    );
  }

  // Dine-in and takeaway are paid before they are placed, so an unpaid one is a leftover from
  // before that rule — settle it from its details page.
  if (!order.payment) {
    return (
      <Link href={`/orders/${order.id}`} className="text-xs font-semibold text-warning hover:underline">
        Unpaid · settle in details
      </Link>
    );
  }

  return (
    <Button size="sm" fullWidth disabled={busy} onClick={onAdvance}>
      <CircleCheck className="size-3.5" aria-hidden />
      {busy ? "Saving…" : "Complete"}
    </Button>
  );
}

/**
 * The one-click "next step" for a row of the Orders list.
 *
 * - Pending → Preparing → Ready: a button, one step at a time.
 * - Ready: with Monitor access there is no button here — Monitor › Ready hands a parcel to delivery or
 *   completes the order. Roles without Monitor do it here instead: **Delivery** for a parcel, **Complete**
 *   for the rest (an unpaid one is settled from its details page first).
 * - Out for delivery (parcels only): a COD parcel shows **Awaiting payment**; clicking it asks
 *   "Payment received?" and, once confirmed, the order is completed. A parcel already paid by
 *   card shows **Delivered**.
 */
function NextStepCell({
  order,
  role,
  busy,
  onAdvance,
  onPayment,
}: {
  order: Order;
  role: Role;
  busy: boolean;
  onAdvance: () => void;
  onPayment: () => void;
}) {
  const upcoming = nextStatus(order.status, order.type);
  if (!upcoming || !can(role, "order.advance")) return <span className="text-fg-subtle">—</span>;

  if (order.status === "delivery") {
    if (!order.payment) {
      return can(role, "payment.settle") ? (
        <Button size="sm" variant="secondary" onClick={onPayment} className="border-warning/50 text-warning">
          Awaiting payment
        </Button>
      ) : (
        <span className="text-[11px] font-semibold text-warning">Awaiting payment</span>
      );
    }
    return (
      <Button size="sm" variant="secondary" disabled={busy} onClick={onAdvance}>
        {busy ? "Saving…" : "Delivered"}
        <ChevronsRight className="size-3.5" aria-hidden />
      </Button>
    );
  }

  if (order.status === "ready") {
    if (can(role, "monitor.view")) {
      return (
        <span className="text-[11px] font-semibold text-fg-subtle">
          {order.type === "parcel" ? "Delivery in Monitor" : "Complete in Monitor"}
        </span>
      );
    }
    if (upcoming === "completed" && !order.payment) {
      return (
        <Link href={`/orders/${order.id}`} className="text-xs font-semibold text-warning hover:underline">
          Unpaid · settle in details
        </Link>
      );
    }
    return (
      <Button size="sm" variant="secondary" disabled={busy} onClick={onAdvance}>
        {busy ? "Saving…" : upcoming === "delivery" ? "Delivery" : "Complete"}
        <ChevronsRight className="size-3.5" aria-hidden />
      </Button>
    );
  }

  return (
    <Button size="sm" variant="secondary" disabled={busy} onClick={onAdvance}>
      {busy ? "Saving…" : STATUS_LABEL[upcoming]}
      <ChevronsRight className="size-3.5" aria-hidden />
    </Button>
  );
}

/**
 * One list, two views. `list` (Orders) is every order in a table. `monitor` splits them
 * by order type — Dine In, Takeaway, Parcel — as cards. Search and status filters apply to both.
 */
export default function OrdersScreen({
  view,
  orders: source,
  scope,
  role,
}: {
  view: "list" | "monitor";
  /** Already scoped on the server to what this employee may see. */
  orders: Order[];
  scope: "all" | "own";
  role: Role;
}) {
  const router = useRouter();
  const { call, pending } = useServerAction();
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<Order | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const dispatch = useAppDispatch();
  // Every arrival starts on "All": the filter is plain screen state, so coming back from an order
  // or from any other page builds the screen afresh. Clicking the sidebar link while already here
  // bumps `ordersViewResets`, which clears it too.
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<MonitorTab>("dine-in");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const monitor = view === "monitor";

  const resets = useAppSelector((state) => state.ui.ordersViewResets);
  const [seenResets, setSeenResets] = useState(resets);
  if (seenResets !== resets) {
    setSeenResets(resets);
    setFilter("all");
    setSearch("");
    setTab("dine-in");
  }
  const readyTab = monitor && tab === "ready";
  const type = monitor && !readyTab ? (tab as OrderType) : "all";
  // The Ready tab fixes the status and ignores the search, since neither control is shown there.
  const statusFilter = readyTab ? "ready" : filter;

  // Monitor is the live view of what is in progress. The type tabs hold orders that are Pending or
  // Preparing; once an order is Ready it moves to the Ready tab, and Completed, Cancelled and
  // Returned orders are not shown on Monitor at all (they stay in the Orders list).
  const notReady = useMemo(
    () =>
      monitor
        ? source.filter((order) => order.status === "pending" || order.status === "preparing")
        : source,
    [source, monitor],
  );
  const typeCounts = countByType(notReady);
  // Status counts follow the selected type tab, so the dropdown never promises orders the tab hides.
  const inType = useMemo(() => filterOrders(notReady, "all", "", type), [notReady, type]);
  const statusCounts = countByStatus(inType);
  const statusCountsAll = countByStatus(source);
  const orders = useMemo(
    () => filterOrders(readyTab ? source : notReady, statusFilter, readyTab ? "" : search, type),
    [source, notReady, statusFilter, readyTab, search, type],
  );

  // A new tab, filter or search reshuffles the result set — land back on page 1.
  // Adjusted during render (React's recommended pattern) rather than in an effect.
  const [resetKey, setResetKey] = useState(`${tab}|${type}|${filter}|${search}|${pageSize}`);
  const nextResetKey = `${tab}|${type}|${filter}|${search}|${pageSize}`;
  if (resetKey !== nextResetKey) {
    setResetKey(nextResetKey);
    setPage(1);
  }

  // Moves an order one step along the sequence. The server enforces the same rules again.
  const advance = async (order: Order) => {
    const upcoming = nextStatus(order.status, order.type);
    if (!upcoming) return;
    setAdvancing(order.id);
    const result = await call(() => advanceOrderAction(order.id));
    setAdvancing(null);
    if (result.ok) {
      dispatch(showToast({ message: `${order.code} marked ${STATUS_LABEL[upcoming].toLowerCase()}` }));
      router.refresh();
    } else {
      dispatch(showToast({ message: result.error, tone: "danger" }));
    }
  };

  // "Payment received?" → mark the order paid; the row then offers the Completed step.
  const confirmPayment = async (method: PaymentMethod) => {
    if (!payFor) return;
    const result = await call(() =>
      settleOrderAction(payFor.id, { method, amountTendered: 0 }),
    );
    if (!result.ok) {
      setPayError(result.error);
      return;
    }
    dispatch(showToast({ message: `${payFor.code} paid by ${method} — order completed` }));
    setPayFor(null);
    router.refresh();
  };

  const pageCount = Math.max(1, Math.ceil(orders.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = monitor ? orders : orders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const rangeStart = orders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(orders.length, currentPage * pageSize);

  // Say *why* the list is empty. Moving the last pending order on is the common case: it leaves the
  // Pending filter, which is not the same as having no orders.
  const emptyMessage = (() => {
    if (source.length === 0) {
      return { title: "No orders yet", description: "Orders will show up here as soon as they are placed.", reset: false };
    }
    if (readyTab) {
      return { title: "Nothing is ready", description: "No order is waiting for pickup right now.", reset: false };
    }
    if (search.trim()) {
      return { title: "No orders match your search", description: "Try a different word, or clear the search.", reset: true };
    }
    if (filter !== "all") {
      return {
        title: `No ${STATUS_LABEL[filter].toLowerCase()} orders`,
        description: `Nothing is ${STATUS_LABEL[filter].toLowerCase()} right now — the ${source.length} order${source.length === 1 ? "" : "s"} you have ${source.length === 1 ? "is" : "are"} in another status.`,
        reset: true,
      };
    }
    return { title: "No orders in this tab", description: "Orders of this type will show up here.", reset: false };
  })();

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="shrink-0">
          <h2 className="text-xl font-bold tracking-tight text-fg">{monitor ? "Monitor" : "Orders"}</h2>
          <p className="text-xs text-fg-muted">
            {scope === "own" ? "Your orders" : "All employees' orders"} ·{" "}
            {monitor ? "by order type" : `${typeCounts.all} placed`} ·{" "}
            {statusCounts.pending + statusCounts.preparing} in the kitchen
          </p>
        </div>

        {/* Search and status filter, top right. */}
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center xl:justify-end">
          {/* The Ready tab is a fixed list — no search or status filter there. */}
          {readyTab ? null : (
            <>
              <div className="relative lg:w-64 lg:shrink-0">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
                  aria-hidden
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Order, customer, table or item"
                  className="pl-10"
                  aria-label="Search orders"
                />
              </div>

              <Select
                value={filter}
                onChange={(event) => setFilter(event.target.value as OrderStatus | "all")}
                aria-label="Filter by status"
                className="lg:w-48 lg:shrink-0"
              >
                {(["all", ...statusFiltersFor(role, monitor)] as const).map((entry) => (
                  <option key={entry} value={entry}>
                    {entry === "all" ? "All" : STATUS_LABEL[entry]} ({statusCounts[entry]})
                  </option>
                ))}
              </Select>
            </>
          )}
        </div>
      </div>

      {monitor ? (
        <div
          role="tablist"
          aria-label="Order type"
          className="scroll-slim -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {TYPE_TABS.map((entry) => {
            const Icon = entry.value === "ready" ? STATUS_ICONS.ready : ORDER_TYPE_ICONS[entry.value];
            const active = tab === entry.value;
            return (
              <button
                key={entry.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(entry.value)}
                className={cn(
                  "flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all duration-150 active:scale-[0.97]",
                  active
                    ? "border-accent bg-accent text-accent-fg shadow-card"
                    : "border-line bg-surface text-fg-muted hover:border-accent hover:text-accent",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {entry.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] tabular-nums",
                    active ? "bg-accent-fg/20" : "bg-surface-3",
                  )}
                >
                  {entry.value === "ready" ? statusCountsAll.ready : typeCounts[entry.value]}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          {...emptyMessage}
          action={
            emptyMessage.reset ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setFilter("all");
                  setSearch("");
                }}
              >
                Show all orders
              </Button>
            ) : undefined
          }
        />
      ) : !monitor ? (
        // "All" is the working list: a table that the search and status filters narrow down.
        <Card className="overflow-hidden">
          <div className="scroll-slim overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-[11px] uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="px-5 py-3 font-bold">Order</th>
                  <th className="px-3 py-3 font-bold">Type</th>
                  <th className="px-3 py-3 font-bold">Customer</th>
                  {scope === "all" ? <th className="px-3 py-3 font-bold">Taken by</th> : null}
                  <th className="px-3 py-3 text-right font-bold">Items</th>
                  <th className="px-3 py-3 font-bold">Payment</th>
                  <th className="px-3 py-3 font-bold">Status</th>
                  <th className="px-3 py-3 text-right font-bold">Total</th>
                  <th className="px-5 py-3 text-right font-bold">Next step</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {paged.map((order) => {
                  return (
                    <tr key={order.id} className="transition-colors hover:bg-surface-2">
                      <td className="px-5 py-3">
                        <Link href={`/orders/${order.id}`} className="font-bold text-fg hover:text-accent">
                          {order.code}
                        </Link>
                        <p className="text-[11px] text-fg-subtle">{formatTime(order.createdAt)}</p>
                      </td>
                      <td className="px-3 py-3 text-fg-muted">
                        <OrderTypeBadge type={order.type} />
                        {order.tableId ? <span className="text-fg-subtle"> · {order.tableId}</span> : null}
                      </td>
                      <td className="max-w-44 truncate px-3 py-3 text-fg-muted">
                        {order.customer.name || "Walk-in Guest"}
                      </td>
                      {scope === "all" ? <td className="px-3 py-3 text-fg-muted">{order.cashier}</td> : null}
                      <td className="px-3 py-3 text-right tabular-nums text-fg-muted">
                        {order.lines.reduce((sum, line) => sum + line.quantity, 0)}
                      </td>
                      <td className="px-3 py-3 text-fg-muted">
                        {order.payment ? PAYMENT_LABEL[order.payment.method] : <span className="text-warning">Unpaid</span>}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-fg">
                        {currency(order.totals.total)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <NextStepCell
                          order={order}
                          role={role}
                          busy={pending && advancing === order.id}
                          onAdvance={() => void advance(order)}
                          onPayment={() => {
                            setPayError(null);
                            setPayFor(order);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paged.map((order) => {
            const itemCount = order.lines.reduce((sum, line) => sum + line.quantity, 0);
            return (
              <div
                key={order.id}
                className="flex flex-col rounded-2xl border border-line bg-surface-2 transition-all duration-150 hover:-translate-y-0.5 hover:border-accent hover:shadow-pop"
              >
              <Link href={`/orders/${order.id}`} className="group flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-fg">
                      {order.code}
                      <OrderTypeBadge type={order.type} />
                    </p>
                    <p className="mt-1 text-[11px] text-fg-muted">
                      {order.tableId ? `${order.tableId} · ` : ""}
                      {formatTime(order.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <p className="mt-3 line-clamp-2 min-h-8 text-xs leading-snug text-fg-muted">
                  {order.lines.map((line) => `${line.quantity}× ${line.name}`).join(", ")}
                </p>

                <div className="mt-3 flex items-end justify-between gap-3 border-t border-dashed border-line-strong pt-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-fg">
                      {order.customer.name || "Walk-in Guest"}
                    </p>
                    <p className="truncate text-[11px] text-fg-subtle">
                      {itemCount} item{itemCount === 1 ? "" : "s"} ·{" "}
                      {order.payment ? PAYMENT_LABEL[order.payment.method] : "Unpaid"}
                      {scope === "all" ? ` · ${order.cashier}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-base font-bold tabular-nums text-fg">
                      {currency(order.totals.total)}
                    </span>
                    <ArrowRight
                      className="size-4 text-fg-subtle transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-accent"
                      aria-hidden
                    />
                  </div>
                </div>
              </Link>

              {/* Ready orders are handled here: a parcel goes to Delivery, everything else is Completed. */}
              {readyTab ? (
                <div className="border-t border-line px-4 py-3">
                  <ReadyControl
                    order={order}
                    role={role}
                    busy={pending && advancing === order.id}
                    onAdvance={() => void advance(order)}
                  />
                </div>
              ) : null}
              </div>
            );
          })}
        </div>
      )}

      {!monitor && orders.length > 0 ? (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-xs text-fg-muted">
            Showing <span className="font-bold text-fg">{rangeStart}–{rangeEnd}</span> of{" "}
            <span className="font-bold text-fg">{orders.length}</span> orders
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <label className="flex items-center gap-2 whitespace-nowrap text-xs text-fg-muted">
              Rows per page
              <Select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                aria-label="Rows per page"
                className="w-20! py-1.5 text-xs"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </Select>
            </label>
            <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
          </div>
        </div>
      ) : null}

      {payFor ? (
        <PaymentReceivedModal
          order={payFor}
          pending={pending}
          error={payError}
          onConfirm={(method) => void confirmPayment(method)}
          onClose={() => setPayFor(null)}
        />
      ) : null}
    </div>
  );
}

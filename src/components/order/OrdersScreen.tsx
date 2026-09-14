"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClipboardList, Plus, Printer, Search } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Card, Chip, EmptyState, Input, StatusBadge } from "@/components/ui/primitives";
import Pagination from "@/components/ui/Pagination";
import {
  currency,
  formatTime,
  ORDER_TYPE_LABEL,
  PAYMENT_LABEL,
  STATUS_LABEL,
} from "@/lib/format";
import { countByStatus, filterOrders, type OrderFilter } from "@/lib/orders";
import { ORDER_TYPE_ICONS } from "@/lib/icons";
import { useHydrated } from "@/lib/useHydrated";
import type { Order } from "@/lib/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAllOrders } from "@/store/selectors";
import { setFilter, setSearch } from "@/store/slices/ordersSlice";

const FILTERS: OrderFilter[] = [
  "all",
  "pending",
  "preparing",
  "ready",
  "served",
  "completed",
  "cancelled",
];

/** Rows per page for the orders table/list — small on purpose so pagination is visible with the seed data. */
const PAGE_SIZE = 5;

export default function OrdersScreen({ serverOrders }: { serverOrders: Order[] }) {
  const dispatch = useAppDispatch();
  const hydrated = useHydrated();
  const storeOrders = useAppSelector(selectAllOrders);
  const { filter, search } = useAppSelector((state) => state.orders);
  const [page, setPage] = useState(1);

  // Orders restored from this browser only appear once hydration is done, so
  // the first client render matches the server HTML exactly.
  const source = hydrated ? storeOrders : serverOrders;
  const orders = useMemo(() => filterOrders(source, filter, search), [source, filter, search]);
  const counts = countByStatus(source);

  // A new filter or search term reshuffles the result set — always land back on
  // page 1. Adjusted during render (React's recommended pattern for resetting
  // state on a prop/state change) rather than in an effect, so there is no
  // extra render pass.
  const [resetKey, setResetKey] = useState(`${filter}|${search}`);
  const nextResetKey = `${filter}|${search}`;
  if (resetKey !== nextResetKey) {
    setResetKey(nextResetKey);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = orders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = orders.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(orders.length, currentPage * PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-fg">Orders</h2>
          <p className="text-xs text-fg-muted">
            {counts.all} orders on this register today · {counts.pending + counts.preparing} in the
            kitchen
          </p>
        </div>
        <ButtonLink href="/order/new">
          <Plus className="size-4" aria-hidden />
          New order
        </ButtonLink>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative lg:w-80">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(event) => dispatch(setSearch(event.target.value))}
              placeholder="Order code, customer, table or item"
              className="pl-10"
              aria-label="Search orders"
            />
          </div>

          <div className="scroll-slim -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:pb-0">
            {FILTERS.map((entry) => (
              <Chip
                key={entry}
                active={filter === entry}
                onClick={() => dispatch(setFilter(entry))}
              >
                {entry === "all" ? "All" : STATUS_LABEL[entry]}
                <span
                  className={
                    filter === entry
                      ? "rounded-full bg-accent-fg/20 px-1.5 text-[10px] tabular-nums"
                      : "rounded-full bg-surface-3 px-1.5 text-[10px] tabular-nums"
                  }
                >
                  {counts[entry]}
                </span>
              </Chip>
            ))}
          </div>
        </div>
      </Card>

      {orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No orders match this view"
          description="Change the status filter or clear the search to see the rest of today's orders."
        />
      ) : (
        <div className="grid gap-3 lg:hidden">
          {paged.map((order) => {
            const OrderTypeIcon = ORDER_TYPE_ICONS[order.type];
            return (
              <Card key={order.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-fg">{order.code}</p>
                    <p className="flex items-center gap-1.5 text-xs text-fg-muted">
                      <OrderTypeIcon className="size-3.5" aria-hidden />
                      {ORDER_TYPE_LABEL[order.type]}
                      {order.tableId ? ` · ${order.tableId}` : ""} · {formatTime(order.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <p className="mt-2 truncate text-xs text-fg-muted">
                  {order.lines.map((line) => `${line.quantity}× ${line.name}`).join(", ")}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-base font-bold tabular-nums text-fg">
                    {currency(order.totals.total)}
                  </span>
                  <div className="flex gap-2">
                    <ButtonLink href={`/orders/${order.id}`} variant="secondary" size="sm">
                      Details
                    </ButtonLink>
                    <ButtonLink href={`/print/${order.id}`} size="sm">
                      <Printer className="size-3.5" aria-hidden />
                      Print
                    </ButtonLink>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {orders.length > 0 ? (
        <Card className="hidden overflow-hidden lg:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-2 text-[11px] uppercase tracking-wide text-fg-muted">
              <tr>
                <th className="px-5 py-3 font-bold">Order</th>
                <th className="px-5 py-3 font-bold">Type</th>
                <th className="px-5 py-3 font-bold">Customer</th>
                <th className="px-5 py-3 font-bold">Items</th>
                <th className="px-5 py-3 font-bold">Payment</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 text-right font-bold">Total</th>
                <th className="px-5 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {paged.map((order) => {
                const OrderTypeIcon = ORDER_TYPE_ICONS[order.type];
                return (
                  <tr key={order.id} className="transition-colors hover:bg-surface-2">
                    <td className="px-5 py-3">
                      <Link href={`/orders/${order.id}`} className="font-bold text-fg hover:text-accent">
                        {order.code}
                      </Link>
                      <p className="text-[11px] text-fg-subtle">{formatTime(order.createdAt)}</p>
                    </td>
                    <td className="px-5 py-3 text-fg-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <OrderTypeIcon className="size-3.5" aria-hidden />
                        {ORDER_TYPE_LABEL[order.type]}
                      </span>
                      {order.tableId ? (
                        <span className="text-fg-subtle"> · {order.tableId}</span>
                      ) : null}
                    </td>
                    <td className="max-w-45 truncate px-5 py-3 text-fg-muted">
                      {order.customer.name}
                    </td>
                    <td className="px-5 py-3 text-fg-muted">
                      {order.lines.reduce((sum, line) => sum + line.quantity, 0)}
                    </td>
                    <td className="px-5 py-3 text-fg-muted">
                      {order.payment ? (
                        PAYMENT_LABEL[order.payment.method]
                      ) : (
                        <span className="text-warning">Unpaid</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-3 text-right font-bold tabular-nums text-fg">
                      {currency(order.totals.total)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <ButtonLink href={`/orders/${order.id}`} variant="secondary" size="sm">
                          Details
                        </ButtonLink>
                        <ButtonLink href={`/print/${order.id}`} size="sm">
                          <Printer className="size-3.5" aria-hidden />
                          Print
                        </ButtonLink>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : null}

      {orders.length > 0 ? (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-xs text-fg-muted">
            Showing <span className="font-bold text-fg">{rangeStart}–{rangeEnd}</span> of{" "}
            <span className="font-bold text-fg">{orders.length}</span> orders
          </p>
          <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { ArrowLeft, Printer, SearchX, StickyNote } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, EmptyState, KeyValue, SectionTitle, StatusBadge } from "@/components/ui/primitives";
import { OUTLET, PRICING } from "@/data/settings";
import { cn } from "@/lib/cn";
import {
  currency,
  formatDateTime,
  lineTotal,
  nextStatus,
  ORDER_TYPE_LABEL,
  PAYMENT_LABEL,
  STATUS_FLOW,
  STATUS_LABEL,
} from "@/lib/format";
import { ORDER_TYPE_ICONS } from "@/lib/icons";
import type { Order } from "@/lib/types";
import { useHydrated } from "@/lib/useHydrated";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectOrderById } from "@/store/selectors";
import { updateOrderStatus } from "@/store/slices/ordersSlice";
import { showToast } from "@/store/slices/uiSlice";

export default function OrderDetail({
  orderId,
  serverOrder,
}: {
  orderId: string;
  /** Rendered on the server; the store copy wins once it has one. */
  serverOrder: Order | null;
}) {
  const dispatch = useAppDispatch();
  const hydrated = useHydrated();
  const storeOrder = useAppSelector(selectOrderById(orderId));
  // Before hydration the server's answer is the only one that may render.
  const order = (hydrated ? storeOrder : null) ?? serverOrder;

  if (!order) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <EmptyState
          icon={SearchX}
          title="Order not found"
          description={`No order matches "${orderId}". It may have been placed on another register.`}
          action={<ButtonLink href="/orders">Back to orders</ButtonLink>}
        />
      </div>
    );
  }

  const upcoming = nextStatus(order.status);
  const activeIndex = STATUS_FLOW.indexOf(order.status);
  const OrderTypeIcon = ORDER_TYPE_ICONS[order.type];

  const advance = () => {
    if (!upcoming) return;
    dispatch(updateOrderStatus({ id: order.id, status: upcoming }));
    dispatch(showToast({ message: `${order.code} marked ${STATUS_LABEL[upcoming].toLowerCase()}` }));
  };

  const cancel = () => {
    dispatch(updateOrderStatus({ id: order.id, status: "cancelled" }));
    dispatch(showToast({ message: `${order.code} cancelled`, tone: "danger" }));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <ButtonLink href="/orders" variant="ghost" size="sm" className="-ml-3">
            <ArrowLeft className="size-3.5" aria-hidden />
            All orders
          </ButtonLink>
          <h2 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-fg">
            {order.code}
            <StatusBadge status={order.status} />
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-fg-muted">
            <OrderTypeIcon className="size-3.5" aria-hidden />
            {ORDER_TYPE_LABEL[order.type]}
            {order.tableId ? ` · ${order.tableId} · ${order.guests} guests` : ""} ·{" "}
            {formatDateTime(order.createdAt)} UTC · {order.cashier}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/print/${order.id}`} variant="secondary">
            <Printer className="size-4" aria-hidden />
            Print
          </ButtonLink>
          {upcoming ? <Button onClick={advance}>Mark {STATUS_LABEL[upcoming]}</Button> : null}
          {order.status !== "cancelled" && order.status !== "completed" ? (
            <Button variant="danger" onClick={cancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="p-5">
        <SectionTitle title="Progress" subtitle="Advance the order as the kitchen works through it" />
        <ol className="mt-4 flex flex-wrap items-center gap-2">
          {STATUS_FLOW.map((status, index) => {
            const done = order.status !== "cancelled" && index <= activeIndex;
            return (
              <li key={status} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold",
                    done
                      ? "border-accent bg-accent text-accent-fg"
                      : "border-line bg-surface-2 text-fg-subtle",
                  )}
                >
                  <span className="grid size-4 place-items-center rounded-full bg-current/20 text-[10px]">
                    {index + 1}
                  </span>
                  {STATUS_LABEL[status]}
                </span>
                {index < STATUS_FLOW.length - 1 ? (
                  <span
                    className={cn(
                      "hidden h-0.5 w-6 rounded-full sm:block",
                      index < activeIndex ? "bg-accent" : "bg-line-strong",
                    )}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
        {order.status === "cancelled" ? (
          <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
            This order was cancelled and will not be charged.
          </p>
        ) : null}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <SectionTitle title="Items" subtitle={`${order.lines.length} lines`} />
          </div>
          <ul className="divide-y divide-line">
            {order.lines.map((line) => (
              <li key={line.lineId} className="flex items-start gap-3 px-5 py-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-lg" aria-hidden>
                  {line.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-fg">
                    <span className="text-accent">{line.quantity}×</span> {line.name}
                  </p>
                  {line.options.length > 0 ? (
                    <p className="mt-0.5 text-[11px] text-fg-muted">
                      {line.options
                        .map((option) => `${option.groupName}: ${option.choiceName}`)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {line.notes ? (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-lg bg-warning-soft px-2 py-1 text-[11px] font-medium text-warning">
                      <StickyNote className="size-3" aria-hidden />
                      {line.notes}
                    </p>
                  ) : null}
                </div>
                <span className="text-sm font-bold tabular-nums text-fg">
                  {currency(lineTotal(line))}
                </span>
              </li>
            ))}
          </ul>
          {order.notes ? (
            <div className="border-t border-line bg-surface-2 px-5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-fg-muted">
                Order note
              </p>
              <p className="mt-1 text-sm text-fg">{order.notes}</p>
            </div>
          ) : null}
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle title="Bill" />
            <div className="mt-4 space-y-2">
              <KeyValue label="Subtotal" value={currency(order.totals.subtotal)} />
              {order.totals.discount > 0 ? (
                <KeyValue
                  label={`Discount (${order.discountPercent}%)`}
                  value={`− ${currency(order.totals.discount)}`}
                />
              ) : null}
              {order.totals.serviceCharge > 0 ? (
                <KeyValue
                  label={`Service (${PRICING.serviceChargeRate}%)`}
                  value={currency(order.totals.serviceCharge)}
                />
              ) : null}
              {order.totals.deliveryFee > 0 ? (
                <KeyValue label="Delivery" value={currency(order.totals.deliveryFee)} />
              ) : null}
              <KeyValue label={`Tax (${PRICING.taxRate}%)`} value={currency(order.totals.tax)} />
              {order.totals.tip > 0 ? (
                <KeyValue label="Tip" value={currency(order.totals.tip)} />
              ) : null}
              <div className="my-2 border-t border-dashed border-line-strong" />
              <KeyValue label="Total" value={currency(order.totals.total)} strong />
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle title="Payment" />
            <div className="mt-4 space-y-2">
              {order.payment ? (
                <>
                  <KeyValue label="Method" value={PAYMENT_LABEL[order.payment.method]} />
                  <KeyValue label="Reference" value={order.payment.reference} />
                  <KeyValue label="Tendered" value={currency(order.payment.amountTendered)} />
                  <KeyValue label="Change" value={currency(order.payment.change)} />
                </>
              ) : (
                <p className="rounded-xl bg-warning-soft px-3 py-2 text-xs font-semibold text-warning">
                  Not settled yet — the guest pays at the table.
                </p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle title="Customer" />
            <div className="mt-4 space-y-2">
              <KeyValue label="Name" value={order.customer.name || "Walk-in Guest"} />
              <KeyValue label="Phone" value={order.customer.phone || "—"} />
              {order.customer.address ? (
                <div className="pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-fg-muted">
                    Address
                  </p>
                  <p className="mt-1 text-sm text-fg">{order.customer.address}</p>
                </div>
              ) : null}
              <KeyValue label="Served by" value={order.cashier || OUTLET.cashier} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

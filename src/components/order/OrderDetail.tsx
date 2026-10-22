"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Banknote, Printer, SearchX, StickyNote, Undo2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, EmptyState, KeyValue, SectionTitle, StatusBadge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import {
  currency,
  formatDateTime,
  lineTotal,
  nextStatus,
  ORDER_TYPE_LABEL,
  PAYMENT_LABEL,
  flowFor,
  STATUS_LABEL,
} from "@/lib/format";
import { ORDER_TYPE_ICONS } from "@/lib/icons";
import { can } from "@/lib/permissions";
import type { Order, Role } from "@/lib/types";
import { useServerAction } from "@/lib/useServerAction";
import {
  advanceOrderAction,
  cancelOrderAction,
  returnOrderAction,
  settleOrderAction,
} from "@/server/actions/orders";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/slices/uiSlice";
import ReasonModal from "./ReasonModal";
import SettleModal from "./SettleModal";

type Dialog = "cancel" | "return" | "settle" | null;


export default function OrderDetail({
  orderId,
  order,
  role,
}: {
  orderId: string;
  /** Resolved on the server for this employee; null when it does not exist or is not theirs. */
  order: Order | null;
  role: Role;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { call, pending } = useServerAction();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);

  if (!order) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <EmptyState
          icon={SearchX}
          title="Order not found"
          description={`No order matches "${orderId}", or it belongs to another employee.`}
          action={<ButtonLink href="/orders">Back to orders</ButtonLink>}
        />
      </div>
    );
  }

  const upcoming = nextStatus(order.status, order.type);
  const closed = order.status === "cancelled" || order.status === "returned";
  const flow = flowFor(order.type);
  const activeIndex = flow.indexOf(order.status);
  const OrderTypeIcon = ORDER_TYPE_ICONS[order.type];

  // This page only moves an order up to Ready. Handing a parcel to delivery and completing an order
  // happen on Monitor › Ready; a parcel that is out for delivery is finished from the Orders list.
  const canAdvance =
    can(role, "order.advance") &&
    upcoming !== null &&
    upcoming !== "completed" &&
    upcoming !== "delivery" &&
    !closed;
  const finishesElsewhere = can(role, "order.advance") && !closed && (upcoming === "completed" || upcoming === "delivery");
  const canSettle = can(role, "payment.settle") && !order.payment && !closed;
  // Before completion: cancel or return. After completion: only roles allowed to refund it.
  const beforeCompletion = ["pending", "preparing", "ready", "delivery"].includes(order.status);
  const canCancel = can(role, "order.cancel") && beforeCompletion;
  const canReturn =
    (can(role, "order.return") && beforeCompletion) ||
    (can(role, "order.return.completed") && order.status === "completed");

  const finish = (message: string, tone?: "danger") => {
    dispatch(showToast({ message, tone }));
    setDialog(null);
    setError(null);
    router.refresh();
  };

  const advance = async () => {
    if (!upcoming) return;
    const result = await call(() => advanceOrderAction(order.id));
    if (result.ok) finish(`${order.code} marked ${STATUS_LABEL[upcoming].toLowerCase()}`);
    else dispatch(showToast({ message: result.error, tone: "danger" }));
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
            {order.tableId ? ` · ${order.tableId}` : ""} ·{" "}
            {formatDateTime(order.createdAt)} UTC · {order.cashier}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/print/${order.id}`} variant="secondary">
            <Printer className="size-4" aria-hidden />
            Bill / Print
          </ButtonLink>
          {canSettle ? (
            <Button onClick={() => setDialog("settle")}>
              <Banknote className="size-4" aria-hidden />
              Settle bill
            </Button>
          ) : null}
          {canAdvance ? (
            <Button variant={canSettle ? "secondary" : "primary"} disabled={pending} onClick={advance}>
              Mark {STATUS_LABEL[upcoming]}
            </Button>
          ) : null}
          {canReturn ? (
            <Button variant="danger" onClick={() => setDialog("return")}>
              <Undo2 className="size-4" aria-hidden />
              Return
            </Button>
          ) : null}
          {canCancel ? (
            <Button variant="danger" onClick={() => setDialog("cancel")}>
              Cancel order
            </Button>
          ) : null}
        </div>
      </div>

      {finishesElsewhere ? (
        <p className="rounded-xl bg-info-soft px-4 py-2.5 text-xs font-semibold text-info">
          {order.status === "delivery" ? (
            <>
              This parcel is out for delivery. Confirm the delivery{order.payment ? "" : " and payment"} from the{" "}
              <span className="font-bold">Orders</span> list.
            </>
          ) : order.type === "parcel" ? (
            <>
              This parcel is ready. Hand it to delivery from <span className="font-bold">Monitor › Ready</span>.
            </>
          ) : (
            <>
              This order is ready. Complete it from <span className="font-bold">Monitor › Ready</span>.
            </>
          )}
        </p>
      ) : null}

      <Card className="p-5">
        <SectionTitle title="Progress" subtitle="Advance the order as the kitchen works through it" />
        <ol className="mt-4 flex flex-wrap items-center gap-2">
          {flow.map((status, index) => {
            const done = !closed && index <= activeIndex;
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
                {index < flow.length - 1 ? (
                  <span
                    className={cn(
                      "hidden h-0.5 w-6 rounded-full sm:block",
                      index < activeIndex && !closed ? "bg-accent" : "bg-line-strong",
                    )}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
        {order.status === "cancelled" ? (
          <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
            {order.returned
              ? "This order was cancelled after payment, and the payment was refunded"
              : "This order was cancelled and will not be charged"}
            {order.cancelReason ? ` — ${order.cancelReason}` : ""}.
          </p>
        ) : null}
        {order.returned ? (
          <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-xs font-semibold text-warning">
            {order.status === "cancelled" ? "Refunded" : "Returned"} by {order.returned.byName} on{" "}
            {formatDateTime(order.returned.at)} UTC ·{" "}
            {order.returned.amount > 0
              ? `refund ${currency(order.returned.amount)}`
              : "no payment had been taken, nothing to refund"}{" "}
            — {order.returned.reason}
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
                  {line.basePrice !== line.listPrice ? (
                    <p className="mt-0.5 text-[11px] font-semibold text-warning">
                      Price adjusted from {currency(line.listPrice)}
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
                  label={`Service (${order.totals.serviceChargeRate}%)`}
                  value={currency(order.totals.serviceCharge)}
                />
              ) : null}
              {order.totals.deliveryFee > 0 ? (
                <KeyValue label="Parcel fee" value={currency(order.totals.deliveryFee)} />
              ) : null}
              <KeyValue label={`GST (${order.totals.taxRate}%)`} value={currency(order.totals.tax)} />
              {order.totals.tip > 0 ? (
                <KeyValue label="Tip" value={currency(order.totals.tip)} />
              ) : null}
              <div className="my-2 border-t border-dashed border-line-strong" />
              <KeyValue label="Total" value={currency(order.totals.total)} strong />
              {!order.payment && !closed ? (
                <p className="text-[10px] text-fg-subtle">
                  GST is provisional (cash rate) until the bill is settled.
                </p>
              ) : null}
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
                  {order.paidAt ? <KeyValue label="Paid" value={`${formatDateTime(order.paidAt)} UTC`} /> : null}
                </>
              ) : (
                <p className="rounded-xl bg-warning-soft px-3 py-2 text-xs font-semibold text-warning">
                  Not settled yet — payment is taken by cash or card.
                </p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle title="Customer" />
            <div className="mt-4 space-y-2">
              <KeyValue label="Name" value={order.customer.name || "Walk-in Guest"} />
              <KeyValue label="Phone" value={order.customer.phone || "—"} />
              <KeyValue label="Email" value={order.customer.email || "—"} />
              {order.customer.address ? (
                <div className="pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-fg-muted">
                    Location
                  </p>
                  <p className="mt-1 text-sm text-fg">{order.customer.address}</p>
                </div>
              ) : null}
              <KeyValue label="Taken by" value={order.cashier} />
            </div>
          </Card>
        </div>
      </div>

      {dialog === "settle" ? (
        <SettleModal
          order={order}
          open
          pending={pending}
          error={error}
          onClose={() => {
            setDialog(null);
            setError(null);
          }}
          onConfirm={async (input) => {
            const result = await call(() => settleOrderAction(order.id, input));
            if (result.ok) finish(`${order.code} settled by ${input.method}`);
            else setError(result.error);
          }}
        />
      ) : null}

      {dialog === "cancel" || dialog === "return" ? (
        <ReasonModal
          open
          title={dialog === "cancel" ? `Cancel ${order.code}?` : `Return ${order.code}?`}
          subtitle={
            dialog === "cancel"
              ? order.payment
                ? `The order is called off and the ${currency(order.totals.total)} already paid is refunded.`
                : "The order is called off. It will not be charged or counted as a sale."
              : order.payment
                ? `${currency(order.totals.total)} is refunded and the order moves to the returned records.`
                : "No payment was taken, so nothing is refunded. The order moves to the returned records."
          }
          confirmLabel={dialog === "cancel" ? "Cancel order" : "Confirm return"}
          pending={pending}
          error={error}
          onClose={() => {
            setDialog(null);
            setError(null);
          }}
          onConfirm={async (reason) => {
            const result = await call(() =>
              dialog === "cancel"
                ? cancelOrderAction(order.id, reason)
                : returnOrderAction(order.id, reason),
            );
            if (result.ok) {
              finish(dialog === "cancel" ? `${order.code} cancelled` : `${order.code} returned`, "danger");
            } else {
              setError(result.error);
            }
          }}
        />
      ) : null}
    </div>
  );
}

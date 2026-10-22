"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CircleCheck, ClipboardList, Plus, Printer, ShoppingBasket, StickyNote, Truck } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Card, Chip, EmptyState, Field, Input, KeyValue, SectionTitle } from "@/components/ui/primitives";
import SegmentedControl, { type SegmentOption } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import { currency, lineTotal, ORDER_TYPE_LABEL, PAYMENT_LABEL, round2 } from "@/lib/format";
import { ORDER_TYPE_ICONS, PAYMENT_ICONS } from "@/lib/icons";
import { can } from "@/lib/permissions";
import { computeTotals } from "@/lib/pricing";
import type { DiningTable, PaymentMethod } from "@/lib/types";
import { useServerAction } from "@/lib/useServerAction";
import { placeOrderAction } from "@/server/actions/orders";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCheckoutIssues, selectPricing, selectUser } from "@/store/selectors";
import { resetCart, setCustomerField, setOrderNotes } from "@/store/slices/cartSlice";

/** COD (cash on delivery) only exists for parcels: the order is placed now and the money is collected on delivery. */
type PayChoice = "cash" | "card" | "cod";

const PAYMENT_OPTIONS: SegmentOption<PayChoice>[] = [
  { value: "cash", label: PAYMENT_LABEL.cash, icon: PAYMENT_ICONS.cash },
  { value: "card", label: PAYMENT_LABEL.card, icon: PAYMENT_ICONS.card },
];

const PARCEL_PAYMENT_OPTIONS: SegmentOption<PayChoice>[] = [
  { value: "cod", label: "COD", icon: Truck },
  { value: "card", label: "By Card", icon: PAYMENT_ICONS.card },
];

function cashSuggestions(total: number) {
  const rounded = Math.ceil(total);
  const set = new Set<number>([
    round2(total),
    rounded,
    Math.ceil(total / 5) * 5,
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 50) * 50,
  ]);
  return [...set].filter((value) => value >= total).sort((a, b) => a - b).slice(0, 4);
}

export default function CheckoutScreen({ tables }: { tables: DiningTable[] }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const cart = useAppSelector((state) => state.cart);
  const pricing = useAppSelector(selectPricing);
  const user = useAppSelector(selectUser);
  const issues = useAppSelector(selectCheckoutIssues);
  const { call, pending } = useServerAction();

  // What the screen shows is driven by role; the server enforces the same rules independently.
  const canSettle = can(user?.role, "payment.settle");
  const canDiscount = can(user?.role, "discount.apply");

  // Dine-in and takeaway are paid (cash or card) before the order is placed. A parcel is either
  // paid now by card or placed as COD and paid on delivery.
  const [choice, setChoice] = useState<PayChoice>("cash");
  const isParcel = cart.orderType === "parcel";
  const activeChoice: PayChoice = isParcel
    ? choice === "card"
      ? "card"
      : "cod"
    : choice === "card"
      ? "card"
      : "cash";
  const method: PaymentMethod = activeChoice === "card" ? "card" : "cash";
  const payOnDelivery = activeChoice === "cod";
  /** True when money is taken at this screen (everything except COD). */
  const showPayment = canSettle && !payOnDelivery;
  const [tendered, setTendered] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [confirmed, setConfirmed] = useState<{ id: string; total: number; paid: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // GST depends on how the bill is settled; before payment is known the cash rate is shown.
  const totals = useMemo(
    () =>
      computeTotals({
        lines: cart.lines,
        orderType: cart.orderType,
        discountPercent: canDiscount ? cart.discountPercent : 0,
        pricing,
        method: showPayment ? method : null,
      }),
    [cart.lines, cart.orderType, cart.discountPercent, pricing, method, showPayment, canDiscount],
  );

  const table = tables.find((entry) => entry.id === cart.tableId);
  // An empty field means "exact cash" — the common case at the counter.
  const tenderedValue = tendered.trim() === "" ? totals.total : Number(tendered) || 0;
  const change = round2(Math.max(0, tenderedValue - totals.total));
  const shortfall = round2(Math.max(0, totals.total - tenderedValue));
  const suggestions = useMemo(() => cashSuggestions(totals.total), [totals.total]);

  const cashShort = showPayment && method === "cash" && shortfall > 0;
  const OrderTypeIcon = ORDER_TYPE_ICONS[cart.orderType];
  const busy = pending || submitted;

  // Order is in — offer to print it (or carry on) instead of whisking the cashier away.
  if (confirmed) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <Modal
          open
          onClose={() => router.push("/order/new")}
          title="Order confirmed"
          subtitle={`${confirmed.id} · ${currency(confirmed.total)}${confirmed.paid ? " · paid" : ""}`}
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => router.push(`/orders/${confirmed.id}`)}>
                <ClipboardList className="size-4" aria-hidden />
                View order
              </Button>
              <Button variant="secondary" onClick={() => router.push("/order/new")}>
                <Plus className="size-4" aria-hidden />
                New order
              </Button>
              <Button onClick={() => router.push(`/print/${confirmed.id}?placed=1`)}>
                <Printer className="size-4" aria-hidden />
                Print order
              </Button>
            </div>
          }
        >
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-success-soft text-success">
              <CircleCheck className="size-6" aria-hidden />
            </span>
            <p className="text-sm text-fg-muted">
              {confirmed.paid
                ? "Payment received and the order has been sent to the kitchen."
                : "The order has been sent to the kitchen — payment is collected on delivery."}{" "}
              Print the bill and kitchen ticket now, or start the next order.
            </p>
          </div>
        </Modal>
      </div>
    );
  }

  if (cart.lines.length === 0 && !submitted) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <EmptyState
          icon={ShoppingBasket}
          title="There is nothing to charge"
          description="This order has no items yet. Head back to the menu and add a few dishes first."
          action={<ButtonLink href="/order/new">Back to order screen</ButtonLink>}
        />
      </div>
    );
  }

  const place = async (settle: boolean) => {
    if (issues.length > 0 || busy) return;
    if (settle && cashShort) return;
    setError(null);

    // Only *what* was ordered goes to the server — it re-reads names and prices itself.
    const result = await call(() =>
      placeOrderAction({
        type: cart.orderType,
        tableId: cart.orderType === "dine-in" ? cart.tableId : null,
        guests: 1,
        // Only the fields this order type asks for are sent.
        customer: {
          name: cart.customer.name,
          phone: cart.orderType === "parcel" ? cart.customer.phone : "",
          email: "",
          address: cart.orderType === "parcel" ? cart.customer.address : "",
        },
        notes: cart.notes,
        discountPercent: canDiscount ? cart.discountPercent : 0,
        lines: cart.lines.map((line) => ({
          itemId: line.itemId,
          quantity: line.quantity,
          options: line.options.map((option) => ({
            groupId: option.groupId,
            choiceId: option.choiceId,
          })),
          notes: line.notes,
          unitPrice: line.basePrice !== line.listPrice ? line.basePrice : undefined,
        })),
        settle: settle
          ? {
              method,
              amountTendered: method === "cash" ? round2(tenderedValue) : totals.total,
            }
          : null,
      }),
    );

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSubmitted(true);
    setConfirmed({ id: result.orderId, total: totals.total, paid: settle });
    dispatch(resetCart());
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-fg">Checkout</h2>
          <p className="text-xs text-fg-muted">
            {isParcel
              ? "Choose COD to place the order now and collect on delivery, or take payment by card."
              : "Take payment first — the order is placed once it is paid."}
          </p>
        </div>
        <ButtonLink href="/order/new" variant="secondary" size="sm">
          <ArrowLeft className="size-3.5" aria-hidden />
          Edit order
        </ButtonLink>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
                  <OrderTypeIcon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-bold text-fg">{ORDER_TYPE_LABEL[cart.orderType]}</p>
                  <p className="text-xs text-fg-muted">
                    {table ? `${table.name} · ${table.area}` : null}
                    {!table && cart.customer.phone ? cart.customer.phone : null}
                    {!table && !cart.customer.phone ? "No table required" : null}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle">
                  Taken by
                </p>
                <p className="text-sm font-semibold text-fg">{user?.name ?? "—"}</p>
              </div>
            </div>

            <ul className="divide-y divide-line">
              {cart.lines.map((line) => (
                <li key={line.lineId} className="flex items-start gap-3 px-5 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-base" aria-hidden>
                    {line.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-fg">
                      <span className="text-accent">{line.quantity}×</span> {line.name}
                    </p>
                    {line.options.length > 0 ? (
                      <p className="text-[11px] text-fg-muted">
                        {line.options.map((option) => option.choiceName).join(" · ")}
                      </p>
                    ) : null}
                    {line.basePrice !== line.listPrice ? (
                      <p className="text-[11px] font-semibold text-warning">
                        Price adjusted from {currency(line.listPrice)}
                      </p>
                    ) : null}
                    {line.notes ? (
                      <p className="mt-1 flex items-start gap-1 text-[11px] font-medium text-warning">
                        <StickyNote className="mt-0.5 size-3 shrink-0" aria-hidden />
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
          </Card>

          <Card className="p-5">
            <SectionTitle
              title={cart.orderType === "parcel" ? "Parcel details" : "Order details"}
              subtitle="Printed on the bill"
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Name" required={cart.orderType === "parcel"}>
                <Input
                  value={cart.customer.name}
                  maxLength={80}
                  placeholder="Walk-in Guest"
                  onChange={(event) =>
                    dispatch(setCustomerField({ field: "name", value: event.target.value }))
                  }
                />
              </Field>
              {cart.orderType === "parcel" ? (
                <>
                  <Field label="Phone" required>
                    <Input
                      type="tel"
                      maxLength={30}
                      value={cart.customer.phone}
                      placeholder="+1 (555) 000-0000"
                      onChange={(event) =>
                        dispatch(setCustomerField({ field: "phone", value: event.target.value }))
                      }
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Location" required>
                      <Input
                        maxLength={200}
                        value={cart.customer.address}
                        placeholder="Street, apartment, area"
                        onChange={(event) =>
                          dispatch(setCustomerField({ field: "address", value: event.target.value }))
                        }
                      />
                    </Field>
                  </div>
                </>
              ) : null}
              <div className="sm:col-span-2">
                <Field label="Order note">
                  <Input
                    maxLength={300}
                    value={cart.notes}
                    placeholder="Anything the kitchen should know"
                    onChange={(event) => dispatch(setOrderNotes(event.target.value))}
                  />
                </Field>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-20">
          {canSettle ? (
            <Card className="p-5">
              <SectionTitle title="Payment" subtitle="Select how the guest is paying" />

              <SegmentedControl
                options={isParcel ? PARCEL_PAYMENT_OPTIONS : PAYMENT_OPTIONS}
                value={activeChoice}
                onChange={setChoice}
                className="mt-4"
              />
              <p className="mt-2 text-[11px] text-fg-subtle">
                GST for {payOnDelivery ? "COD (cash)" : `${PAYMENT_LABEL[method].toLowerCase()} payments`}: {totals.taxRate}%
              </p>

              {payOnDelivery ? (
                <p className="mt-5 rounded-xl bg-info-soft px-3 py-2.5 text-xs font-medium text-info">
                  Nothing to collect now. The order is placed unpaid; when the money is received on delivery,
                  confirm it from the Orders list (Awaiting payment).
                </p>
              ) : null}

              {payOnDelivery ? null : method === "cash" ? (
                <div className="mt-5 space-y-3">
                  <Field label="Amount tendered" hint="Leave blank for the exact amount">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={tendered}
                      placeholder={currency(totals.total).replace(/^\$/, "")}
                      onChange={(event) => setTendered(event.target.value)}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((value) => (
                      <Chip key={value} onClick={() => setTendered(String(value))}>
                        {currency(value)}
                      </Chip>
                    ))}
                  </div>
                  <div
                    className={cn(
                      "rounded-xl px-3 py-2.5",
                      cashShort ? "bg-danger-soft" : "bg-success-soft",
                    )}
                  >
                    <KeyValue
                      label={cashShort ? "Still due" : "Change due"}
                      value={
                        <span className={cashShort ? "text-danger" : "text-success"}>
                          {currency(cashShort ? shortfall : change)}
                        </span>
                      }
                      strong
                    />
                  </div>
                </div>
              ) : (
                <p className="mt-5 rounded-xl bg-info-soft px-3 py-2.5 text-xs font-medium text-info">
                  Present the terminal to the guest and confirm once approved.
                </p>
              )}
            </Card>
          ) : null}

          <Card className="p-5">
            <div className="space-y-2">
              <KeyValue label="Subtotal" value={currency(totals.subtotal)} />
              {totals.discount > 0 ? (
                <KeyValue
                  label={`Discount (${cart.discountPercent}%)`}
                  value={`− ${currency(totals.discount)}`}
                />
              ) : null}
              {totals.serviceCharge > 0 ? (
                <KeyValue
                  label={`Service (${totals.serviceChargeRate}%)`}
                  value={currency(totals.serviceCharge)}
                />
              ) : null}
              {totals.deliveryFee > 0 ? (
                <KeyValue label="Parcel fee" value={currency(totals.deliveryFee)} />
              ) : null}
              <KeyValue label={`GST (${totals.taxRate}%)`} value={currency(totals.tax)} />
              <div className="my-2 border-t border-dashed border-line-strong" />
              <KeyValue label={showPayment ? "Amount due" : payOnDelivery ? "Due on delivery" : "Bill total"} value={currency(totals.total)} strong />
              {!showPayment ? (
                <p className="text-[10px] text-fg-subtle">
                  GST shown at the cash rate — it is finalised when the payment is received.
                </p>
              ) : null}
            </div>

            {issues.length > 0 ? (
              <ul className="mt-3 space-y-1 rounded-xl bg-warning-soft px-3 py-2">
                {issues.map((issue) => (
                  <li key={issue} className="text-[11px] font-medium text-warning">
                    • {issue}
                  </li>
                ))}
              </ul>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-xs font-semibold text-danger"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {error}
              </p>
            ) : null}

            {showPayment ? (
              <Button
                size="lg"
                fullWidth
                className="mt-4"
                disabled={issues.length > 0 || busy || cashShort}
                onClick={() => void place(true)}
              >
                {busy ? "Placing order…" : `Pay ${currency(totals.total)} & place order`}
              </Button>
            ) : (
              <Button
                size="lg"
                fullWidth
                className="mt-4"
                disabled={issues.length > 0 || busy}
                onClick={() => void place(false)}
              >
                {busy ? "Placing order…" : `Place COD order · ${currency(totals.total)}`}
              </Button>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

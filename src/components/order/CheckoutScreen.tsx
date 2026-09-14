"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ShoppingBasket, StickyNote } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, Chip, EmptyState, Field, Input, KeyValue, SectionTitle } from "@/components/ui/primitives";
import SegmentedControl, { type SegmentOption } from "@/components/ui/SegmentedControl";
import { OUTLET, PRICING, TIP_PRESETS } from "@/data/settings";
import { cn } from "@/lib/cn";
import { currency, lineTotal, ORDER_TYPE_LABEL, PAYMENT_LABEL, round2 } from "@/lib/format";
import { ORDER_TYPE_ICONS, PAYMENT_ICONS } from "@/lib/icons";
import type { DiningTable, Order, PaymentMethod } from "@/lib/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCartIssues, selectCheckoutTotals } from "@/store/selectors";
import { resetCart, setCustomerField, setOrderNotes, setTip } from "@/store/slices/cartSlice";
import { placeOrder } from "@/store/slices/ordersSlice";
import { showToast } from "@/store/slices/uiSlice";

const METHODS: PaymentMethod[] = ["cash", "card", "wallet"];
const PAYMENT_OPTIONS: SegmentOption<PaymentMethod>[] = METHODS.map((method) => ({
  value: method,
  label: PAYMENT_LABEL[method],
  icon: PAYMENT_ICONS[method],
}));

/** Next sequential code, derived from the orders already in the store. */
function nextOrderCode(existing: string[]) {
  const highest = existing.reduce((max, code) => {
    const match = /^ORD-(\d+)$/.exec(code);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 1000);
  return `ORD-${highest + 1}`;
}

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
  const totals = useAppSelector(selectCheckoutTotals);
  const issues = useAppSelector(selectCartIssues);
  const existingCodes = useAppSelector((state) => state.orders.items.map((order) => order.code));

  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [tendered, setTendered] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const table = tables.find((entry) => entry.id === cart.tableId);
  // An empty field means "exact cash" — the common case at the counter.
  const tenderedValue = tendered.trim() === "" ? totals.total : Number(tendered) || 0;
  const change = round2(Math.max(0, tenderedValue - totals.total));
  const shortfall = round2(Math.max(0, totals.total - tenderedValue));
  const suggestions = useMemo(() => cashSuggestions(totals.total), [totals.total]);

  const cashShort = method === "cash" && shortfall > 0;
  const OrderTypeIcon = ORDER_TYPE_ICONS[cart.orderType];

  if (cart.lines.length === 0) {
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

  const buildOrder = (makePayment: (code: string) => Order["payment"]): Order => {
    const now = new Date().toISOString();
    const code = nextOrderCode(existingCodes);
    return {
      id: code,
      code,
      type: cart.orderType,
      tableId: cart.tableId,
      guests: cart.guests,
      customer: {
        name: cart.customer.name.trim() || "Walk-in Guest",
        phone: cart.customer.phone.trim(),
        address: cart.customer.address.trim(),
      },
      lines: cart.lines,
      notes: cart.notes.trim(),
      discountPercent: cart.discountPercent,
      totals,
      status: "pending",
      payment: makePayment(code),
      cashier: OUTLET.cashier,
      createdAt: now,
      updatedAt: now,
    };
  };

  const finish = (makePayment: (code: string) => Order["payment"], message: string) => {
    if (issues.length > 0 || submitting) return;
    setSubmitting(true);
    const order = buildOrder(makePayment);
    dispatch(placeOrder(order));
    dispatch(resetCart());
    dispatch(showToast({ message }));
    router.push(`/print/${order.id}?placed=1`);
  };

  const payNow = () => {
    if (method === "cash" && tenderedValue < totals.total) return;
    finish(
      (code) => ({
        method,
        amountTendered: method === "cash" ? round2(tenderedValue) : totals.total,
        change: method === "cash" ? change : 0,
        // Derived from the order code so the reference is stable and traceable.
        reference: `${method.toUpperCase()}-${code.slice(-4)}`,
      }),
      "Payment captured — printing receipt",
    );
  };

  const sendToKitchen = () => finish(() => null, "Sent to kitchen — pay at the table");

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-fg">Checkout</h2>
          <p className="text-xs text-fg-muted">
            Confirm the order, take payment and print the receipt.
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
                    {table ? `${table.name} · ${table.area} · ${cart.guests} guests` : null}
                    {!table && cart.customer.phone ? cart.customer.phone : null}
                    {!table && !cart.customer.phone ? "No table required" : null}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle">
                  Cashier
                </p>
                <p className="text-sm font-semibold text-fg">{OUTLET.cashier}</p>
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
            <SectionTitle title="Customer details" subtitle="Printed on the receipt" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input
                  value={cart.customer.name}
                  placeholder="Walk-in Guest"
                  onChange={(event) =>
                    dispatch(setCustomerField({ field: "name", value: event.target.value }))
                  }
                />
              </Field>
              <Field label="Phone" required={cart.orderType === "delivery"}>
                <Input
                  value={cart.customer.phone}
                  placeholder="+1 (555) 000-0000"
                  onChange={(event) =>
                    dispatch(setCustomerField({ field: "phone", value: event.target.value }))
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field
                  label={cart.orderType === "delivery" ? "Delivery address" : "Note"}
                  required={cart.orderType === "delivery"}
                >
                  <Input
                    value={
                      cart.orderType === "delivery" ? cart.customer.address : cart.notes
                    }
                    placeholder={
                      cart.orderType === "delivery"
                        ? "Street, apartment, area"
                        : "Anything the kitchen should know"
                    }
                    onChange={(event) =>
                      cart.orderType === "delivery"
                        ? dispatch(
                            setCustomerField({ field: "address", value: event.target.value }),
                          )
                        : dispatch(setOrderNotes(event.target.value))
                    }
                  />
                </Field>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-20">
          <Card className="p-5">
            <SectionTitle title="Payment" subtitle="Select how the guest is paying" />

            <SegmentedControl options={PAYMENT_OPTIONS} value={method} onChange={setMethod} className="mt-4" />

            <div className="mt-5">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-fg-muted">
                Tip
              </p>
              <div className="flex flex-wrap gap-2">
                {TIP_PRESETS.map((percent) => {
                  const value = round2((totals.subtotal * percent) / 100);
                  const active = round2(cart.tip) === value;
                  return (
                    <Chip key={percent} active={active} onClick={() => dispatch(setTip(value))}>
                      {percent === 0 ? "None" : `${percent}%`}
                    </Chip>
                  );
                })}
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={cart.tip || ""}
                  placeholder="Custom"
                  onChange={(event) => dispatch(setTip(Number(event.target.value)))}
                  className="w-24 py-2 text-right text-xs"
                  aria-label="Custom tip amount"
                />
              </div>
            </div>

            {method === "cash" ? (
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
                {method === "card"
                  ? "Present the terminal to the guest and confirm once approved."
                  : "Scan the guest's wallet QR code, then confirm the payment."}
              </p>
            )}
          </Card>

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
                  label={`Service (${PRICING.serviceChargeRate}%)`}
                  value={currency(totals.serviceCharge)}
                />
              ) : null}
              {totals.deliveryFee > 0 ? (
                <KeyValue label="Delivery" value={currency(totals.deliveryFee)} />
              ) : null}
              <KeyValue label={`Tax (${PRICING.taxRate}%)`} value={currency(totals.tax)} />
              {totals.tip > 0 ? <KeyValue label="Tip" value={currency(totals.tip)} /> : null}
              <div className="my-2 border-t border-dashed border-line-strong" />
              <KeyValue label="Amount due" value={currency(totals.total)} strong />
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

            <Button
              size="lg"
              fullWidth
              className="mt-4"
              disabled={issues.length > 0 || submitting || cashShort}
              onClick={payNow}
            >
              {submitting ? "Placing order…" : `Charge ${currency(totals.total)} & Print`}
            </Button>

            {cart.orderType === "dine-in" ? (
              <Button
                variant="secondary"
                fullWidth
                className="mt-2"
                disabled={issues.length > 0 || submitting}
                onClick={sendToKitchen}
              >
                Send to kitchen · pay later
              </Button>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}

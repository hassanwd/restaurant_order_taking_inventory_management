"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, KeyValue } from "@/components/ui/primitives";
import SegmentedControl, { type SegmentOption } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import { currency, PAYMENT_LABEL, round2 } from "@/lib/format";
import { PAYMENT_ICONS } from "@/lib/icons";
import { computeTotals } from "@/lib/pricing";
import type { Order, PaymentMethod } from "@/lib/types";
import { useAppSelector } from "@/store/hooks";
import { selectPricing } from "@/store/selectors";

const OPTIONS: SegmentOption<PaymentMethod>[] = (["cash", "card"] as PaymentMethod[]).map(
  (method) => ({ value: method, label: PAYMENT_LABEL[method], icon: PAYMENT_ICONS[method] }),
);

/**
 * Settles an open bill. GST depends on the payment method, so the totals shown
 * here move as the cashier toggles Cash / Card — and the server recomputes the
 * same figures itself before saving.
 */
export default function SettleModal({
  order,
  open,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  order: Order;
  open: boolean;
  pending: boolean;
  error: string | null;
  onConfirm: (input: { method: PaymentMethod; amountTendered: number }) => void;
  onClose: () => void;
}) {
  const pricing = useAppSelector(selectPricing);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [tendered, setTendered] = useState("");

  const totals = useMemo(
    () =>
      computeTotals({
        lines: order.lines,
        orderType: order.type,
        discountPercent: order.discountPercent,
        pricing,
        method,
      }),
    [order, pricing, method],
  );

  const tenderedValue = tendered.trim() === "" ? totals.total : Number(tendered) || 0;
  const short = method === "cash" && round2(tenderedValue) < totals.total;
  const change = round2(Math.max(0, tenderedValue - totals.total));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Settle ${order.code}`}
      subtitle="Choose how the guest is paying — GST follows the payment method."
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold tabular-nums text-fg">{currency(totals.total)}</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={pending || short}
              onClick={() =>
                onConfirm({
                  method,
                  amountTendered: method === "cash" ? round2(tenderedValue) : totals.total,
                })
              }
            >
              {pending ? "Saving…" : "Confirm payment"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <SegmentedControl options={OPTIONS} value={method} onChange={setMethod} />

        <div className="space-y-1.5 rounded-xl bg-surface-2 p-3">
          <KeyValue label="Subtotal" value={currency(totals.subtotal)} />
          {totals.discount > 0 ? (
            <KeyValue label="Discount" value={`− ${currency(totals.discount)}`} />
          ) : null}
          {totals.serviceCharge > 0 ? (
            <KeyValue label={`Service (${totals.serviceChargeRate}%)`} value={currency(totals.serviceCharge)} />
          ) : null}
          {totals.deliveryFee > 0 ? (
            <KeyValue label="Parcel fee" value={currency(totals.deliveryFee)} />
          ) : null}
          <KeyValue label={`GST (${totals.taxRate}% · ${PAYMENT_LABEL[method]})`} value={currency(totals.tax)} />
          <div className="my-1 border-t border-dashed border-line-strong" />
          <KeyValue label="Amount due" value={currency(totals.total)} strong />
        </div>

        {method === "cash" ? (
          <div className="space-y-3">
            <Field label="Amount tendered" hint="Leave blank for the exact amount">
              <Input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={tendered}
                onChange={(event) => setTendered(event.target.value)}
                placeholder={totals.total.toFixed(2)}
              />
            </Field>
            <div className={cn("rounded-xl px-3 py-2.5", short ? "bg-danger-soft" : "bg-success-soft")}>
              <KeyValue
                label={short ? "Still due" : "Change due"}
                value={
                  <span className={short ? "text-danger" : "text-success"}>
                    {currency(short ? round2(totals.total - tenderedValue) : change)}
                  </span>
                }
                strong
              />
            </div>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

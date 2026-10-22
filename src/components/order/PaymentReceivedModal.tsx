"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { KeyValue } from "@/components/ui/primitives";
import SegmentedControl, { type SegmentOption } from "@/components/ui/SegmentedControl";
import { currency, PAYMENT_LABEL } from "@/lib/format";
import { PAYMENT_ICONS } from "@/lib/icons";
import { computeTotals } from "@/lib/pricing";
import type { Order, PaymentMethod } from "@/lib/types";
import { useAppSelector } from "@/store/hooks";
import { selectPricing } from "@/store/selectors";

const OPTIONS: SegmentOption<PaymentMethod>[] = (["cash", "card"] as PaymentMethod[]).map(
  (method) => ({ value: method, label: PAYMENT_LABEL[method], icon: PAYMENT_ICONS[method] }),
);

/**
 * "Have you received the payment?" — the quick confirmation for an order that was placed
 * unpaid (a parcel, paid on delivery). GST depends on how it was paid, so the amount shown
 * follows the Cash / Card choice; the server recomputes the same figure before saving.
 */
export default function PaymentReceivedModal({
  order,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  order: Order;
  pending: boolean;
  error: string | null;
  onConfirm: (method: PaymentMethod) => void;
  onClose: () => void;
}) {
  const pricing = useAppSelector(selectPricing);
  const [method, setMethod] = useState<PaymentMethod>("cash");

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

  return (
    <Modal
      open
      onClose={onClose}
      title="Payment received?"
      subtitle={`${order.code} · ${order.customer.name || "Walk-in Guest"}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Not yet
          </Button>
          <Button disabled={pending} onClick={() => onConfirm(method)}>
            {pending ? "Saving…" : "Yes, received"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-fg-muted">
          Confirm you have collected the money for this parcel. It is then marked paid and the order is completed.
        </p>
        <SegmentedControl options={OPTIONS} value={method} onChange={setMethod} />
        <div className="space-y-1.5 rounded-xl bg-surface-2 p-3">
          <KeyValue label={`GST (${totals.taxRate}% · ${PAYMENT_LABEL[method]})`} value={currency(totals.tax)} />
          <div className="my-1 border-t border-dashed border-line-strong" />
          <KeyValue label="Amount received" value={currency(totals.total)} strong />
        </div>
        {error ? (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

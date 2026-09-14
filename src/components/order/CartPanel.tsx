"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShoppingBasket, StickyNote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState, Input, KeyValue, Textarea } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { currency, lineTotal, ORDER_TYPE_LABEL } from "@/lib/format";
import { PRICING } from "@/data/settings";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectCartCount, selectCartIssues, selectCartTotals } from "@/store/selectors";
import {
  clearLines,
  decrementLine,
  incrementLine,
  removeLine,
  setDiscountPercent,
  setLineNotes,
  setOrderNotes,
} from "@/store/slices/cartSlice";
import { showToast } from "@/store/slices/uiSlice";
import QuantityStepper from "./QuantityStepper";

function CartLineRow({ lineId }: { lineId: string }) {
  const dispatch = useAppDispatch();
  const line = useAppSelector((state) => state.cart.lines.find((entry) => entry.lineId === lineId));
  const [editingNote, setEditingNote] = useState(false);

  if (!line) return null;

  return (
    <li className="rounded-xl border border-line bg-surface-2 p-3">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-base" aria-hidden>
          {line.icon}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold leading-snug text-fg">{line.name}</p>
            <span className="shrink-0 text-sm font-bold tabular-nums text-fg">
              {currency(lineTotal(line))}
            </span>
          </div>

          {line.options.length > 0 ? (
            <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">
              {line.options
                .map((option) =>
                  option.price > 0 ? `${option.choiceName} (+${currency(option.price)})` : option.choiceName,
                )
                .join(" · ")}
            </p>
          ) : null}

          {line.notes ? (
            <p className="mt-1 flex items-start gap-1.5 rounded-lg bg-warning-soft px-2 py-1 text-[11px] font-medium text-warning">
              <StickyNote className="mt-0.5 size-3 shrink-0" aria-hidden />
              {line.notes}
            </p>
          ) : null}

          <div className="mt-2 flex items-center gap-2">
            <QuantityStepper
              size="sm"
              value={line.quantity}
              onChange={(next) =>
                next > line.quantity
                  ? dispatch(incrementLine(line.lineId))
                  : dispatch(decrementLine(line.lineId))
              }
            />
            <button
              type="button"
              onClick={() => setEditingNote((value) => !value)}
              className="cursor-pointer rounded-lg px-2 py-1 text-[11px] font-semibold text-fg-muted transition-all duration-150 hover:bg-surface-3 hover:text-accent active:scale-95"
            >
              {line.notes ? "Edit note" : "Add note"}
            </button>
            <button
              type="button"
              onClick={() => dispatch(removeLine(line.lineId))}
              aria-label={`Remove ${line.name}`}
              className="ml-auto flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-fg-muted transition-all duration-150 hover:bg-danger-soft hover:text-danger active:scale-95"
            >
              <Trash2 className="size-3" aria-hidden />
              Remove
            </button>
          </div>

          {editingNote ? (
            <Textarea
              autoFocus
              rows={2}
              className="mt-2 text-xs"
              value={line.notes}
              placeholder="Note for the kitchen"
              onChange={(event) =>
                dispatch(setLineNotes({ lineId: line.lineId, notes: event.target.value }))
              }
              onBlur={() => setEditingNote(false)}
            />
          ) : null}
        </div>
      </div>
    </li>
  );
}

export default function CartPanel({ className }: { className?: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const cart = useAppSelector((state) => state.cart);
  const totals = useAppSelector(selectCartTotals);
  const count = useAppSelector(selectCartCount);
  const issues = useAppSelector(selectCartIssues);

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-surface", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3.5">
        <div>
          <h2 className="text-sm font-bold text-fg">Current order</h2>
          <p className="text-[11px] text-fg-muted">
            {ORDER_TYPE_LABEL[cart.orderType]}
            {cart.tableId ? ` · ${cart.tableId}` : ""} · {count} item{count === 1 ? "" : "s"}
          </p>
        </div>
        {cart.lines.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              dispatch(clearLines());
              dispatch(showToast({ message: "Order cleared", tone: "info" }));
            }}
            className="cursor-pointer rounded-lg px-2 py-1 text-[11px] font-bold text-fg-muted transition-all duration-150 hover:bg-danger-soft hover:text-danger active:scale-95"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="scroll-slim min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {cart.lines.length === 0 ? (
          <EmptyState
            icon={ShoppingBasket}
            title="No items yet"
            description="Tap a dish on the left to start building this order."
          />
        ) : (
          <ul className="space-y-2">
            {cart.lines.map((line) => (
              <CartLineRow key={line.lineId} lineId={line.lineId} />
            ))}
          </ul>
        )}

        {cart.lines.length > 0 ? (
          <div className="space-y-3 pt-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-fg-muted">
                Order note
              </span>
              <Textarea
                rows={2}
                className="text-xs"
                value={cart.notes}
                onChange={(event) => dispatch(setOrderNotes(event.target.value))}
                placeholder="Anything the kitchen or server should know"
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fg-muted">
                Discount %
              </span>
              <Input
                type="number"
                min={0}
                max={100}
                value={cart.discountPercent}
                onChange={(event) => dispatch(setDiscountPercent(Number(event.target.value)))}
                className="w-20 py-1.5 text-right"
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="border-t border-line bg-surface-2 p-4">
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
          <div className="my-2 border-t border-dashed border-line-strong" />
          <KeyValue label="Total" value={currency(totals.total)} strong />
        </div>

        {issues.length > 0 && cart.lines.length > 0 ? (
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
          className="mt-3"
          disabled={issues.length > 0}
          onClick={() => {
            if (issues.length > 0) return;
            router.push("/order/checkout");
          }}
        >
          Review &amp; Pay · {currency(totals.total)}
        </Button>

        <p className="mt-2 text-center text-[11px] text-fg-subtle">
          Need the full breakdown?{" "}
          <Link href="/orders" className="font-semibold text-accent hover:underline">
            View all orders
          </Link>
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ArrowLeft, ChefHat, CircleCheck, Plus, Printer, ReceiptText } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/primitives";
import SegmentedControl, { type SegmentOption } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import { currency } from "@/lib/format";
import type { DiningTable, Order } from "@/lib/types";
import { useHydrated } from "@/lib/useHydrated";
import { useAppSelector } from "@/store/hooks";
import { selectOrderById } from "@/store/selectors";
import KitchenTicket from "./KitchenTicket";
import Receipt from "./Receipt";

type DocumentKind = "receipt" | "kitchen" | "both";

const TAB_OPTIONS: SegmentOption<DocumentKind>[] = [
  { value: "receipt", label: "Customer receipt", icon: ReceiptText },
  { value: "kitchen", label: "Kitchen ticket", icon: ChefHat },
  { value: "both", label: "Print both", icon: Printer },
];

export default function PrintScreen({
  orderId,
  serverOrder,
  tables,
  justPlaced,
}: {
  orderId: string;
  serverOrder: Order | null;
  tables: DiningTable[];
  justPlaced: boolean;
}) {
  const hydrated = useHydrated();
  const storeOrder = useAppSelector(selectOrderById(orderId));
  // Before hydration the server's answer is the only one that may render.
  const order = (hydrated ? storeOrder : null) ?? serverOrder;
  const [kind, setKind] = useState<DocumentKind>("receipt");

  if (!order) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <EmptyState
          icon={Printer}
          title="Nothing to print"
          description={`No order matches "${orderId}".`}
          action={<ButtonLink href="/orders">Back to orders</ButtonLink>}
        />
      </div>
    );
  }

  const table = tables.find((entry) => entry.id === order.tableId);

  return (
    <div className="min-h-dvh bg-bg">
      <div className="no-print sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <ButtonLink href={`/orders/${order.id}`} variant="ghost" size="sm" className="-ml-2">
            <ArrowLeft className="size-3.5" aria-hidden />
            Order details
          </ButtonLink>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <SegmentedControl
              options={TAB_OPTIONS}
              value={kind}
              onChange={setKind}
              size="sm"
              equalWidth={false}
              hideLabelOnMobile
            />

            <Button onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden />
              Print
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {justPlaced ? (
          <div className="no-print mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-success/30 bg-success-soft px-5 py-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-success text-white">
              <CircleCheck className="size-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-success">
                {order.code} placed · {currency(order.totals.total)}
              </p>
              <p className="text-xs text-fg-muted">
                {order.payment
                  ? `Paid by ${order.payment.method}. Hand the receipt to the guest.`
                  : "Sent to the kitchen. The guest settles at the table."}
              </p>
            </div>
            <div className="flex gap-2">
              <ButtonLink href="/order/new" size="sm">
                <Plus className="size-3.5" aria-hidden />
                New order
              </ButtonLink>
              <ButtonLink href="/orders" variant="secondary" size="sm">
                All orders
              </ButtonLink>
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "flex flex-wrap items-start justify-center gap-6",
            kind === "both" && "sm:flex-nowrap",
          )}
        >
          {kind !== "kitchen" ? (
            <div className={cn(kind === "both" && "print-break")}>
              <p className="no-print mb-2 text-center text-[11px] font-bold uppercase tracking-wide text-fg-muted">
                Customer receipt
              </p>
              <Receipt order={order} table={table} />
            </div>
          ) : null}

          {kind !== "receipt" ? (
            <div>
              <p className="no-print mb-2 text-center text-[11px] font-bold uppercase tracking-wide text-fg-muted">
                Kitchen ticket
              </p>
              <KitchenTicket order={order} table={table} />
            </div>
          ) : null}
        </div>

        <p className="no-print mt-6 text-center text-[11px] text-fg-subtle">
          Sized for an 80mm thermal roll. Use your browser print dialog and pick the receipt
          printer.
        </p>
      </div>
    </div>
  );
}

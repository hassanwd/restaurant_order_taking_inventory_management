"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleCheck, Printer } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/primitives";
import { currency } from "@/lib/format";
import type { DiningTable, Order } from "@/lib/types";
import KitchenTicket from "./KitchenTicket";
import Receipt from "./Receipt";

export default function PrintScreen({
  orderId,
  order,
  tables,
  justPlaced,
}: {
  orderId: string;
  /** Resolved on the server for this employee; null when missing or not theirs. */
  order: Order | null;
  tables: DiningTable[];
  justPlaced: boolean;
}) {
  const router = useRouter();

  // Straight from checkout: once the print dialog closes (printed or cancelled), head to the
  // next order rather than leaving the cashier stranded on the receipt.
  useEffect(() => {
    if (!justPlaced) return;
    const onAfterPrint = () => router.push("/order/new");
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, [justPlaced, router]);

  if (!order) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <EmptyState
          icon={Printer}
          title="Nothing to print"
          description={`No order matches "${orderId}", or it belongs to another employee.`}
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
                  ? `Paid by ${order.payment.method}. Hand the bill to the guest.`
                  : "Sent to the kitchen. A cashier settles the bill with the guest."}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-start justify-center gap-6 sm:flex-nowrap">
          <div className="print-break">
            <p className="no-print mb-2 text-center text-[11px] font-bold uppercase tracking-wide text-fg-muted">
              Customer bill
            </p>
            <Receipt order={order} table={table} />
          </div>

          <div>
            <p className="no-print mb-2 text-center text-[11px] font-bold uppercase tracking-wide text-fg-muted">
              Kitchen ticket
            </p>
            <KitchenTicket order={order} table={table} />
          </div>
        </div>

        <p className="no-print mt-6 text-center text-[11px] text-fg-subtle">
          Sized for an 80mm thermal roll. Use your browser print dialog and pick the receipt
          printer.
        </p>
      </div>
    </div>
  );
}

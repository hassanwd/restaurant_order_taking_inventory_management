import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { currency } from "@/lib/format";
import { ORDER_TYPE_ICONS } from "@/lib/icons";
import type { DiningTable } from "@/lib/types";
import { getOrders, getTables } from "@/server/data";
import { requirePermission } from "@/server/session";

export const metadata = { title: "Tables" };

const STATUS_STYLE: Record<DiningTable["status"], string> = {
  free: "border-success/40 bg-success-soft text-success",
  occupied: "border-accent bg-accent text-accent-fg",
  reserved: "border-warning/40 bg-warning-soft text-warning",
};

export default async function TablesPage() {
  const user = await requirePermission("tables.view");
  const [tables, orders] = await Promise.all([getTables(), getOrders(user)]);

  // Which open order is sitting on which table.
  const openByTable = new Map(
    orders
      .filter(
        (order) =>
          order.tableId && !["completed", "cancelled", "returned"].includes(order.status),
      )
      .map((order) => [order.tableId as string, order]),
  );

  const areas = [...new Set(tables.map((table) => table.area))];

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-fg">Floor plan</h2>
        <p className="text-xs text-fg-muted">
          Tap a free table to start a dine-in order, or open the order already running on it.
        </p>
      </div>

      {areas.map((area) => (
        <Card key={area} className="p-5">
          <SectionTitle
            title={area}
            subtitle={`${tables.filter((table) => table.area === area).length} tables`}
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tables
              .filter((table) => table.area === area)
              .map((table) => {
                const order = openByTable.get(table.id);
                const occupiedElsewhere = !order && table.status === "occupied";
                const href = order
                  ? `/orders/${order.id}`
                  : occupiedElsewhere
                    ? "/tables"
                    : `/order/new?table=${table.id}`;
                const OrderTypeIcon = order ? ORDER_TYPE_ICONS[order.type] : null;

                return (
                  <Link
                    key={table.id}
                    href={href}
                    className="group rounded-2xl border border-line bg-surface-2 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-accent hover:shadow-pop active:translate-y-0 active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-fg">{table.name}</p>
                        <p className="text-[11px] text-fg-muted">{table.seats} seats</p>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[table.status]}`}
                      >
                        {table.status}
                      </span>
                    </div>

                    <div className="mt-4 border-t border-dashed border-line-strong pt-3">
                      {order && OrderTypeIcon ? (
                        <p className="flex items-center gap-1.5 text-xs text-fg-muted">
                          <OrderTypeIcon className="size-3.5 shrink-0" aria-hidden />
                          <span className="font-bold text-fg">{order.code}</span> ·{" "}
                          {currency(order.totals.total)}
                          <span className="block w-full text-[11px] text-fg-subtle">
                            Open order — tap to view
                          </span>
                        </p>
                      ) : occupiedElsewhere ? (
                        <p className="text-xs text-fg-muted">Occupied — order taken by another employee</p>
                      ) : (
                        <p className="flex items-center gap-1 text-xs font-semibold text-accent">
                          Start a dine-in order
                          <ArrowRight className="size-3.5" aria-hidden />
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
          </div>
        </Card>
      ))}
    </div>
  );
}

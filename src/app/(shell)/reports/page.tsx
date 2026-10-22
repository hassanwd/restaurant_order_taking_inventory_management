import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Percent,
  ReceiptText,
  TrendingUp,
  Undo2,
  Wallet,
  XCircle,
} from "lucide-react";
import { DataTable, StatTile } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/Button";
import { Card, chipClass, EmptyState, KeyValue, SectionTitle, StatusBadge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { currency, formatDateTime, ORDER_TYPE_LABEL, PAYMENT_LABEL } from "@/lib/format";
import { buildReport, isPeriod, type Period, type Report } from "@/server/reports";
import { requirePermission } from "@/server/session";

export const metadata = { title: "Reports" };

type Tab = "overview" | "orders" | "billing" | "inventory";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "orders", label: "Orders" },
  { id: "billing", label: "Billing" },
  { id: "inventory", label: "Inventory" },
];
const PERIODS: { id: Period; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];
const ROW_LIMIT = 100;
const num = (value: number) => (Math.round(value * 1000) / 1000).toString();

function Overview({ report }: { report: Report }) {
  const { orders, billing, range } = report;
  const peak = Math.max(1, ...orders.byDay.map((entry) => entry.sales));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Orders placed" value={String(orders.placed)} sub={`${orders.completed} completed · ${orders.open} open`} icon={ReceiptText} tone="accent" />
        <StatTile label="Orders returned" value={String(orders.returned)} sub={`${currency(billing.refunds)} refunded`} icon={Undo2} tone="warning" />
        <StatTile label="Net sales" value={currency(billing.netSales)} sub={`${currency(billing.collected)} collected − refunds`} icon={Wallet} tone="dark" />
        <StatTile label="GST collected" value={currency(billing.tax)} sub={`Average ticket ${currency(billing.averageTicket)}`} icon={Percent} />
      </section>

      <Card className="p-5">
        <SectionTitle
          title={range.period === "daily" ? "Today's sales" : "Sales by day"}
          subtitle="Billable orders only (cancelled and returned are excluded)"
        />
        <ul className="mt-4 space-y-2">
          {orders.byDay.map((entry) => (
            <li key={entry.day} className="flex items-center gap-3 text-xs">
              <span className="w-20 shrink-0 font-semibold tabular-nums text-fg-muted">{entry.day.slice(5)}</span>
              <span className="h-5 flex-1 overflow-hidden rounded-md bg-surface-3">
                <span
                  className="block h-full rounded-md bg-accent transition-all"
                  style={{ width: `${(entry.sales / peak) * 100}%` }}
                />
              </span>
              <span className="w-28 shrink-0 text-right font-bold tabular-nums text-fg">{currency(entry.sales)}</span>
              <span className="hidden w-32 shrink-0 text-right text-fg-subtle sm:block">
                {entry.placed} placed · {entry.returned} returned
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <SectionTitle title="By employee" subtitle="Who took the orders in this period" />
        </div>
        {billing.byEmployee.length === 0 ? (
          <p className="px-5 py-6 text-sm text-fg-muted">No billable orders in this period.</p>
        ) : (
          <DataTable
            minWidth={420}
            head={
              <tr>
                <th className="px-5 py-3 font-bold">Employee</th>
                <th className="px-3 py-3 text-right font-bold">Orders</th>
                <th className="px-5 py-3 text-right font-bold">Sales</th>
              </tr>
            }
          >
            {billing.byEmployee.map((entry) => (
              <tr key={entry.name} className="hover:bg-surface-2">
                <td className="px-5 py-3 font-semibold text-fg">{entry.name}</td>
                <td className="px-3 py-3 text-right tabular-nums text-fg-muted">{entry.orders}</td>
                <td className="px-5 py-3 text-right font-bold tabular-nums text-fg">{currency(entry.sales)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}

function OrdersTab({ report }: { report: Report }) {
  const { orders } = report;
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Placed" value={String(orders.placed)} icon={ReceiptText} tone="accent" />
        <StatTile label="Completed" value={String(orders.completed)} icon={TrendingUp} tone="success" />
        <StatTile label="Returned" value={String(orders.returned)} icon={Undo2} tone="warning" />
        <StatTile label="Cancelled" value={String(orders.cancelled)} icon={XCircle} />
      </section>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <SectionTitle
            title="Placed orders"
            subtitle={orders.placedOrders.length > ROW_LIMIT ? `Latest ${ROW_LIMIT} of ${orders.placedOrders.length} — export for all` : `${orders.placedOrders.length} orders`}
          />
        </div>
        {orders.placedOrders.length === 0 ? (
          <p className="px-5 py-6 text-sm text-fg-muted">No orders were placed in this period.</p>
        ) : (
          <DataTable
            minWidth={860}
            head={
              <tr>
                <th className="px-5 py-3 font-bold">Order</th>
                <th className="px-3 py-3 font-bold">Type</th>
                <th className="px-3 py-3 font-bold">Customer</th>
                <th className="px-3 py-3 font-bold">Taken by</th>
                <th className="px-3 py-3 font-bold">Status</th>
                <th className="px-5 py-3 text-right font-bold">Total</th>
              </tr>
            }
          >
            {orders.placedOrders.slice(0, ROW_LIMIT).map((order) => (
              <tr key={order.id} className="hover:bg-surface-2">
                <td className="px-5 py-3">
                  <Link href={`/orders/${order.id}`} className="font-bold text-fg hover:text-accent">{order.code}</Link>
                  <p className="text-[11px] text-fg-subtle">{formatDateTime(order.createdAt)} UTC</p>
                </td>
                <td className="px-3 py-3 text-fg-muted">{ORDER_TYPE_LABEL[order.type]}</td>
                <td className="max-w-40 truncate px-3 py-3 text-fg-muted">{order.customer.name || "Walk-in Guest"}</td>
                <td className="px-3 py-3 text-fg-muted">{order.cashier}</td>
                <td className="px-3 py-3"><StatusBadge status={order.status} /></td>
                <td className="px-5 py-3 text-right font-bold tabular-nums text-fg">{currency(order.totals.total)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <SectionTitle title="Returned orders" subtitle="Orders refunded in this period, with who approved them and why" />
        </div>
        {orders.returnedOrders.length === 0 ? (
          <p className="px-5 py-6 text-sm text-fg-muted">No orders were returned in this period.</p>
        ) : (
          <DataTable
            minWidth={820}
            head={
              <tr>
                <th className="px-5 py-3 font-bold">Order</th>
                <th className="px-3 py-3 font-bold">Returned</th>
                <th className="px-3 py-3 font-bold">Approved by</th>
                <th className="px-3 py-3 font-bold">Reason</th>
                <th className="px-5 py-3 text-right font-bold">Refund</th>
              </tr>
            }
          >
            {orders.returnedOrders.map((order) => (
              <tr key={order.id} className="hover:bg-surface-2">
                <td className="px-5 py-3">
                  <Link href={`/orders/${order.id}`} className="font-bold text-fg hover:text-accent">{order.code}</Link>
                  <p className="text-[11px] text-fg-subtle">taken by {order.cashier}</p>
                </td>
                <td className="px-3 py-3 text-fg-muted">{formatDateTime(order.returned!.at)} UTC</td>
                <td className="px-3 py-3 text-fg-muted">{order.returned!.byName}</td>
                <td className="max-w-60 truncate px-3 py-3 text-fg-muted">{order.returned!.reason}</td>
                <td className="px-5 py-3 text-right font-bold tabular-nums text-fg">{currency(order.returned!.amount)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}

function BillingTab({ report }: { report: Report }) {
  const { billing } = report;
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Billing summary" />
          <div className="mt-4 space-y-2">
            <KeyValue label="Subtotal" value={currency(billing.subtotal)} />
            <KeyValue label="Discounts" value={`− ${currency(billing.discounts)}`} />
            <KeyValue label="Service charges" value={currency(billing.serviceCharges)} />
            <KeyValue label="Parcel fees" value={currency(billing.parcelFees)} />
            <KeyValue label="GST" value={currency(billing.tax)} />
            <div className="my-2 border-t border-dashed border-line-strong" />
            <KeyValue label="Billed" value={currency(billing.billed)} strong />
            <KeyValue label="Collected" value={currency(billing.collected)} />
            <KeyValue label="Outstanding (unpaid)" value={currency(billing.outstanding)} />
            <KeyValue label="Refunds" value={`− ${currency(billing.refunds)}`} />
            <KeyValue label="Net sales" value={currency(billing.netSales)} strong />
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle title="By payment method" />
            <div className="mt-4 space-y-3">
              {(["cash", "card"] as const).map((method) => (
                <div key={method} className="rounded-xl bg-surface-2 p-3">
                  <KeyValue label={PAYMENT_LABEL[method]} value={currency(billing.byMethod[method].amount)} strong />
                  <p className="mt-1 text-[11px] text-fg-subtle">
                    {billing.byMethod[method].count} bills · GST {currency(billing.byMethod[method].tax)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <SectionTitle title="By employee" />
            <ul className="mt-4 space-y-2">
              {billing.byEmployee.length === 0 ? (
                <li className="text-sm text-fg-muted">No billable orders.</li>
              ) : (
                billing.byEmployee.map((entry) => (
                  <li key={entry.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-fg">{entry.name}</span>
                    <span className="tabular-nums text-fg-muted">
                      {entry.orders} orders · <span className="font-bold text-fg">{currency(entry.sales)}</span>
                    </span>
                  </li>
                ))
              )}
            </ul>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <SectionTitle
            title="Bills"
            subtitle={billing.bills.length > ROW_LIMIT ? `Latest ${ROW_LIMIT} of ${billing.bills.length} — export for all` : `${billing.bills.length} bills`}
          />
        </div>
        {billing.bills.length === 0 ? (
          <p className="px-5 py-6 text-sm text-fg-muted">No bills in this period.</p>
        ) : (
          <DataTable
            minWidth={820}
            head={
              <tr>
                <th className="px-5 py-3 font-bold">Bill</th>
                <th className="px-3 py-3 font-bold">Taken by</th>
                <th className="px-3 py-3 font-bold">Payment</th>
                <th className="px-3 py-3 text-right font-bold">GST</th>
                <th className="px-5 py-3 text-right font-bold">Total</th>
              </tr>
            }
          >
            {billing.bills.slice(0, ROW_LIMIT).map((order) => (
              <tr key={order.id} className="hover:bg-surface-2">
                <td className="px-5 py-3">
                  <Link href={`/orders/${order.id}`} className="font-bold text-fg hover:text-accent">{order.code}</Link>
                  <p className="text-[11px] text-fg-subtle">{formatDateTime(order.createdAt)} UTC</p>
                </td>
                <td className="px-3 py-3 text-fg-muted">{order.cashier}</td>
                <td className="px-3 py-3 text-fg-muted">{order.payment ? PAYMENT_LABEL[order.payment.method] : <span className="text-warning">Unpaid</span>}</td>
                <td className="px-3 py-3 text-right tabular-nums text-fg-muted">{currency(order.totals.tax)}</td>
                <td className="px-5 py-3 text-right font-bold tabular-nums text-fg">{currency(order.totals.total)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}

function InventoryTab({ report }: { report: Report }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <SectionTitle
          title="Inventory report"
          subtitle="Opening stock + received − out − used = closing stock, for this period"
        />
      </div>
      {report.inventory.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={ReceiptText} title="No inventory items" description="Add items on the Inventory screen to see them here." />
        </div>
      ) : (
        <DataTable
          minWidth={780}
          head={
            <tr>
              <th className="px-5 py-3 font-bold">Item</th>
              <th className="px-3 py-3 text-right font-bold">Opening</th>
              <th className="px-3 py-3 text-right font-bold">Received</th>
              <th className="px-3 py-3 text-right font-bold">Out</th>
              <th className="px-3 py-3 text-right font-bold">Used</th>
              <th className="px-5 py-3 text-right font-bold">Closing</th>
            </tr>
          }
        >
          {report.inventory.map((row) => (
            <tr key={row.itemId} className="hover:bg-surface-2">
              <td className="px-5 py-3">
                <p className="font-bold text-fg">{row.name}</p>
                <p className="text-[11px] text-fg-subtle">Reorder at {num(row.reorderLevel)} {row.unit}</p>
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-fg-muted">{num(row.opening)} {row.unit}</td>
              <td className="px-3 py-3 text-right tabular-nums text-success">{row.received ? `+${num(row.received)}` : "—"}</td>
              <td className="px-3 py-3 text-right tabular-nums text-warning">{row.out ? `−${num(row.out)}` : "—"}</td>
              <td className="px-3 py-3 text-right tabular-nums text-info">{row.used ? `−${num(row.used)}` : "—"}</td>
              <td className="px-5 py-3 text-right">
                <span className={cn("font-bold tabular-nums", row.low ? "text-danger" : "text-fg")}>
                  {num(row.closing)} {row.unit}
                </span>
                {row.low ? <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-bold uppercase text-danger">Low</span> : null}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </Card>
  );
}

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  await requirePermission("reports.view");
  const params = await searchParams;

  const period: Period = isPeriod(params.period) ? params.period : "daily";
  const tab: Tab = TABS.some((entry) => entry.id === params.tab) ? (params.tab as Tab) : "overview";
  const report = await buildReport(period, typeof params.date === "string" ? params.date : undefined);
  const { range } = report;

  const href = (next: { period?: Period; tab?: Tab; date?: string }) =>
    `/reports?period=${next.period ?? period}&tab=${next.tab ?? tab}&date=${next.date ?? range.date}`;
  const exportKind = tab === "overview" ? "billing" : tab;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-fg">Reports</h2>
          <p className="text-xs text-fg-muted">Daily, weekly and monthly view of orders, billing and stock.</p>
        </div>
        <Link
          href={`/export/${exportKind}?period=${period}&date=${range.date}`}
          prefetch={false}
          className={buttonClass({ variant: "secondary", size: "sm" })}
        >
          <Download className="size-3.5" aria-hidden />
          Export {exportKind} CSV
        </Link>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((entry) => (
              <Link key={entry.id} href={href({ period: entry.id })} prefetch={false} className={chipClass(period === entry.id)}>
                {entry.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link href={href({ date: range.previous })} prefetch={false} aria-label="Previous period" className={buttonClass({ variant: "secondary", size: "sm" })}>
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <span className="min-w-44 text-center text-sm font-bold text-fg">{range.label}</span>
            {range.next <= today ? (
              <Link href={href({ date: range.next })} prefetch={false} aria-label="Next period" className={buttonClass({ variant: "secondary", size: "sm" })}>
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <span aria-hidden className={cn(buttonClass({ variant: "secondary", size: "sm" }), "pointer-events-none opacity-40")}>
                <ChevronRight className="size-4" />
              </span>
            )}
          </div>

          <form method="get" className="flex items-end gap-2">
            <input type="hidden" name="period" value={period} />
            <input type="hidden" name="tab" value={tab} />
            <input
              type="date"
              name="date"
              defaultValue={range.date}
              max={today}
              aria-label="Jump to date"
              className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
            />
            <button type="submit" className={buttonClass({ size: "sm" })}>Go</button>
          </form>
        </div>

        <nav aria-label="Report sections" className="mt-4 flex flex-wrap gap-1 border-t border-line pt-3">
          {TABS.map((entry) => (
            <Link
              key={entry.id}
              href={href({ tab: entry.id })}
              prefetch={false}
              aria-current={tab === entry.id ? "page" : undefined}
              className={cn(
                "rounded-lg px-3.5 py-2 text-xs font-bold transition-colors",
                tab === entry.id ? "bg-accent-soft text-accent" : "text-fg-muted hover:bg-surface-3 hover:text-fg",
              )}
            >
              {entry.label}
            </Link>
          ))}
        </nav>
      </Card>

      {tab === "overview" ? <Overview report={report} /> : null}
      {tab === "orders" ? <OrdersTab report={report} /> : null}
      {tab === "billing" ? <BillingTab report={report} /> : null}
      {tab === "inventory" ? <InventoryTab report={report} /> : null}
    </div>
  );
}

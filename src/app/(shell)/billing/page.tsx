import Link from "next/link";
import { Banknote, CreditCard, Download, Percent, Receipt, Undo2, Wallet } from "lucide-react";
import PricingForm from "@/components/admin/PricingForm";
import { DataTable, StatTile } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/Button";
import { Card, chipClass, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { currency, formatDateTime, ORDER_TYPE_LABEL, PAYMENT_LABEL } from "@/lib/format";
import { getPricing } from "@/server/data";
import { buildBillingRange } from "@/server/reports";
import { requirePermission } from "@/server/session";

export const metadata = { title: "Billing" };

const DAY = 86_400_000;
const day = (date: Date) => date.toISOString().slice(0, 10);
const isDay = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
/** Bills shown on screen; the CSV export always carries the whole range. */
const ROW_LIMIT = 100;

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const user = await requirePermission("billing.view");
  const params = await searchParams;

  const now = new Date();
  const today = day(now);
  const from = isDay(params.from) ? params.from : today;
  const to = isDay(params.to) && params.to >= from ? params.to : from;

  const [report, pricing] = await Promise.all([buildBillingRange(from, to, user.role), getPricing()]);

  const presets = [
    { label: "Today", from: today, to: today },
    { label: "Last 7 days", from: day(new Date(now.getTime() - 6 * DAY)), to: today },
    { label: "Last 30 days", from: day(new Date(now.getTime() - 29 * DAY)), to: today },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-fg">Billing &amp; sales records</h2>
          <p className="text-xs text-fg-muted">
            Every bill with its GST, payment method and who took it. {from === to ? from : `${from} → ${to}`}
          </p>
        </div>
        <Link
          href={`/export/billing?from=${from}&to=${to}`}
          prefetch={false}
          className={buttonClass({ variant: "secondary", size: "sm" })}
        >
          <Download className="size-3.5" aria-hidden />
          Export CSV
        </Link>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <Link
                key={preset.label}
                href={`/billing?from=${preset.from}&to=${preset.to}`}
                prefetch={false}
                className={chipClass(preset.from === from && preset.to === to)}
              >
                {preset.label}
              </Link>
            ))}
          </div>
          <form method="get" className="flex flex-wrap items-end gap-2 lg:ml-auto">
            <label className="text-[11px] font-bold uppercase tracking-wide text-fg-muted">
              From
              <input
                type="date"
                name="from"
                defaultValue={from}
                max={today}
                className="mt-1 block rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
              />
            </label>
            <label className="text-[11px] font-bold uppercase tracking-wide text-fg-muted">
              To
              <input
                type="date"
                name="to"
                defaultValue={to}
                max={today}
                className="mt-1 block rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
              />
            </label>
            <button type="submit" className={buttonClass({ size: "md" })}>
              Apply
            </button>
          </form>
        </div>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Billed" value={currency(report.billed)} sub={`${report.bills.length} bills · avg ${currency(report.averageTicket)}`} icon={Receipt} tone="accent" />
        <StatTile label="Collected" value={currency(report.collected)} sub={`${currency(report.outstanding)} still unpaid`} icon={Wallet} tone="dark" />
        <StatTile label="GST collected" value={currency(report.tax)} sub={`Cash ${currency(report.byMethod.cash.tax)} · Card ${currency(report.byMethod.card.tax)}`} icon={Percent} />
        <StatTile label="Refunds" value={currency(report.refunds)} sub={`Net sales ${currency(report.netSales)}`} icon={Undo2} tone="warning" />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {(["cash", "card"] as const).map((method) => {
          const Icon = method === "cash" ? Banknote : CreditCard;
          const bucket = report.byMethod[method];
          return (
            <Card key={method} className="flex items-center gap-4 p-4">
              <span className="grid size-11 place-items-center rounded-xl bg-surface-3 text-fg-muted">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-fg">{PAYMENT_LABEL[method]}</p>
                <p className="text-xs text-fg-muted">{bucket.count} bills · GST {currency(bucket.tax)}</p>
              </div>
              <span className="text-lg font-bold tabular-nums text-fg">{currency(bucket.amount)}</span>
            </Card>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <SectionTitle
            title="Bills"
            subtitle={
              report.bills.length > ROW_LIMIT
                ? `Showing the latest ${ROW_LIMIT} of ${report.bills.length} — export for the full list`
                : `${report.bills.length} bills (cancelled and returned orders excluded)`
            }
          />
        </div>
        {report.bills.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={Receipt} title="No bills in this range" description="Pick a different date range to see sales records." />
          </div>
        ) : (
          <DataTable
            minWidth={900}
            head={
              <tr>
                <th className="px-5 py-3 font-bold">Bill</th>
                <th className="px-3 py-3 font-bold">Type</th>
                <th className="px-3 py-3 font-bold">Taken by</th>
                <th className="px-3 py-3 font-bold">Payment</th>
                <th className="px-3 py-3 text-right font-bold">Subtotal</th>
                <th className="px-3 py-3 text-right font-bold">GST</th>
                <th className="px-5 py-3 text-right font-bold">Total</th>
              </tr>
            }
          >
            {report.bills.slice(0, ROW_LIMIT).map((order) => (
              <tr key={order.id} className="transition-colors hover:bg-surface-2">
                <td className="px-5 py-3">
                  <Link href={`/orders/${order.id}`} className="font-bold text-fg hover:text-accent">
                    {order.code}
                  </Link>
                  <p className="text-[11px] text-fg-subtle">{formatDateTime(order.createdAt)} UTC</p>
                </td>
                <td className="px-3 py-3 text-fg-muted">{ORDER_TYPE_LABEL[order.type]}</td>
                <td className="px-3 py-3 text-fg-muted">{order.cashier}</td>
                <td className="px-3 py-3 text-fg-muted">
                  {order.payment ? PAYMENT_LABEL[order.payment.method] : <span className="text-warning">Unpaid</span>}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-fg-muted">{currency(order.totals.subtotal)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-fg-muted">
                  {currency(order.totals.tax)} <span className="text-[11px] text-fg-subtle">({order.totals.taxRate}%)</span>
                </td>
                <td className="px-5 py-3 text-right font-bold tabular-nums text-fg">{currency(order.totals.total)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <PricingForm pricing={pricing} />
    </div>
  );
}

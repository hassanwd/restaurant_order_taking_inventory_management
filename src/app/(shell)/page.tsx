import Link from "next/link";
import { Armchair, ChevronRight, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Card, SectionTitle, StatusBadge } from "@/components/ui/primitives";
import { OUTLET } from "@/data/settings";
import { currency, formatTime, ORDER_TYPE_LABEL } from "@/lib/format";
import { ORDER_TYPE_ICONS } from "@/lib/icons";
import { getDashboardStats, getOrders, getTables } from "@/server/data";

export const metadata = { title: "Dashboard" };

const STAT_TONES = {
  accent: "bg-accent-soft text-accent",
  dark: "bg-ink-900 text-white dark:bg-white dark:text-ink-900",
  plain: "bg-surface-3 text-fg",
};

function Stat({
  label,
  value,
  sub,
  icon: Icon,
  tone = "plain",
}: {
  label: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  tone?: keyof typeof STAT_TONES;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-fg-muted">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tabular-nums text-fg">{value}</p>
          <p className="mt-1 text-[11px] text-fg-subtle">{sub}</p>
        </div>
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${STAT_TONES[tone]}`}>
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
    </Card>
  );
}

export default async function DashboardPage() {
  // Three server-side reads, resolved before a single byte reaches the browser.
  const [stats, orders, tables] = await Promise.all([
    getDashboardStats(),
    getOrders(),
    getTables(),
  ]);

  const recent = orders.slice(0, 6);
  const freeTables = tables.filter((table) => table.status === "free").length;
  const DineInIcon = ORDER_TYPE_ICONS["dine-in"];
  const TakeawayIcon = ORDER_TYPE_ICONS.takeaway;
  const DeliveryIcon = ORDER_TYPE_ICONS.delivery;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <section className="overflow-hidden rounded-2xl border border-line bg-linear-to-br from-brand-500 to-brand-700 p-6 text-white shadow-pop">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">
              {OUTLET.branch} · {OUTLET.register}
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Good service starts with a fast order.
            </h2>
            <p className="mt-1.5 max-w-md text-sm text-white/85">
              {stats.openOrders} orders are still open and {freeTables} of {stats.tablesTotal}{" "}
              tables are free right now.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/order/new?type=dine-in" variant="light" size="lg">
              <DineInIcon className="size-4" aria-hidden />
              New Dine In
            </ButtonLink>
            <ButtonLink href="/order/new?type=takeaway" variant="light" size="lg">
              <TakeawayIcon className="size-4" aria-hidden />
              Takeaway
            </ButtonLink>
            <ButtonLink href="/order/new?type=delivery" variant="light" size="lg">
              <DeliveryIcon className="size-4" aria-hidden />
              Delivery
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Orders today"
          value={String(stats.ordersToday)}
          sub={`${stats.openOrders} still open`}
          icon={ReceiptText}
          tone="accent"
        />
        <Stat
          label="Revenue"
          value={currency(stats.revenueToday)}
          sub="Excludes cancelled orders"
          icon={Wallet}
          tone="dark"
        />
        <Stat
          label="Average ticket"
          value={currency(stats.averageTicket)}
          sub="Per completed order"
          icon={TrendingUp}
        />
        <Stat
          label="Tables occupied"
          value={`${stats.tablesOccupied}/${stats.tablesTotal}`}
          sub={`${freeTables} available now`}
          icon={Armchair}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr] xl:items-start">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <SectionTitle
              title="Recent orders"
              subtitle="Loaded on the server with the rest of the page"
              action={
                <Link
                  href="/orders"
                  className="flex items-center text-xs font-bold text-accent hover:text-accent-hover"
                >
                  View all
                  <ChevronRight className="size-3.5" aria-hidden />
                </Link>
              }
            />
          </div>

          <ul className="divide-y divide-line">
            {recent.map((order) => {
              const OrderTypeIcon = ORDER_TYPE_ICONS[order.type];
              return (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-fg-muted">
                    <OrderTypeIcon className="size-4.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-fg">
                      {order.code}
                      <span className="ml-2 font-medium text-fg-muted">
                        {ORDER_TYPE_LABEL[order.type]}
                        {order.tableId ? ` · ${order.tableId}` : ""}
                      </span>
                    </p>
                    <p className="truncate text-xs text-fg-muted">
                      {order.lines.length} item{order.lines.length === 1 ? "" : "s"} ·{" "}
                      {order.customer.name || "Walk-in Guest"} ·{" "}
                      {formatTime(order.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={order.status} className="hidden sm:inline-flex" />
                  <span className="w-20 text-right text-sm font-bold tabular-nums text-fg">
                    {currency(order.totals.total)}
                  </span>
                </Link>
              </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle title="Top sellers" subtitle="By quantity sold today" />
            <ul className="mt-4 space-y-3">
              {stats.topItems.map((item, index) => (
                <li key={item.itemId} className="flex items-center gap-3">
                  <span className="w-4 text-xs font-bold tabular-nums text-fg-subtle">
                    {index + 1}
                  </span>
                  <span className="grid size-9 place-items-center rounded-lg bg-surface-3 text-base" aria-hidden>
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-fg">{item.name}</p>
                    <p className="text-[11px] text-fg-muted">{item.quantity} sold</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-fg">
                    {currency(item.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <SectionTitle
              title="Floor status"
              action={
                <Link
                  href="/tables"
                  className="flex items-center text-xs font-bold text-accent hover:text-accent-hover"
                >
                  Open
                  <ChevronRight className="size-3.5" aria-hidden />
                </Link>
              }
            />
            <div className="mt-4 grid grid-cols-6 gap-2">
              {tables.map((table) => (
                <span
                  key={table.id}
                  title={`${table.name} · ${table.status}`}
                  className={`grid h-9 place-items-center rounded-lg text-[11px] font-bold ${
                    table.status === "free"
                      ? "bg-success-soft text-success"
                      : table.status === "occupied"
                        ? "bg-accent text-accent-fg"
                        : "bg-warning-soft text-warning"
                  }`}
                >
                  {table.id}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-fg-muted">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-success" /> Free
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-accent" /> Occupied
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-warning" /> Reserved
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

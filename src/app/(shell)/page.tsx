import Link from "next/link";
import { ChevronRight, CircleX, ReceiptText, ShieldAlert, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, GreetingBanner, ItemImage, SectionTitle, StatusBadge } from "@/components/ui/primitives";
import { currency, formatTime, ORDER_TYPE_LABEL } from "@/lib/format";
import { ORDER_TYPE_ICONS } from "@/lib/icons";
import { can } from "@/lib/permissions";
import { getDashboardStats, getOrders } from "@/server/data";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/session";

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

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  // Workers have no dashboard — their home is the order screen.
  if (!can(user.role, "dashboard.view")) redirect("/order/new");
  const [params, stats, orders] = await Promise.all([
    searchParams,
    getDashboardStats(user),
    getOrders(user),
  ]);

  // Sales figures are for cashiers and above; workers see their own order counts only.
  const seesSales = can(user.role, "billing.view");
  const seesAll = can(user.role, "order.view.all");

  const recent = orders.slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      {params.denied ? (
        <p className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm font-semibold text-warning">
          <ShieldAlert className="size-4 shrink-0" aria-hidden />
          Your role does not have access to that page.
        </p>
      ) : null}

      {/* Super Admin oversees multiple registers, so the single-register greeting lives on the
          worker's order screen instead — see GreetingBanner in OrderTakingScreen. */}
      {user.role !== "super_admin" ? (
        <GreetingBanner name={user.name} openOrders={stats.openOrders} />
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        <Stat
          label="Orders today"
          value={String(stats.ordersToday)}
          sub={`${stats.openOrders} still open${seesAll ? "" : " · yours"}`}
          icon={ReceiptText}
          tone="accent"
        />
        {seesSales ? (
          <Stat
            label="Revenue"
            value={currency(stats.revenueToday)}
            sub="Excludes cancelled and returned"
            icon={Wallet}
            tone="dark"
          />
        ) : null}
        {seesAll ? (
          <Stat
            label="Cancelled today"
            value={String(stats.cancelledToday)}
            sub="Called-off orders"
            icon={CircleX}
          />
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr] xl:items-start">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <SectionTitle
              title="Recent orders"
              subtitle={seesAll ? "Across all employees" : "Orders you have taken"}
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
                  <ItemImage src={item.image} alt={item.name} className="size-9 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-fg">{item.name}</p>
                    <p className="text-[11px] text-fg-muted">{item.quantity} sold</p>
                  </div>
                  {seesSales ? (
                    <span className="text-sm font-bold tabular-nums text-fg">
                      {currency(item.revenue)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

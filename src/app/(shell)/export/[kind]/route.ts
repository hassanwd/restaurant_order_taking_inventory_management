import { can, type Permission } from "@/lib/permissions";
import { mutate, recordAudit } from "@/server/db";
import { buildBillingRange, buildReport, isPeriod } from "@/server/reports";
import { getCurrentUser } from "@/server/session";

type Cell = string | number | null | undefined;

/**
 * Spreadsheet apps run any cell that starts with = + - @ as a formula, so text a
 * user typed (customer names, notes) could execute when a manager opens the
 * export. Prefixing a quote turns it back into plain text. Numbers are written
 * as numbers and left alone.
 */
function cell(value: Cell) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const toCsv = (rows: Cell[][]) => rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request, ctx: RouteContext<"/export/[kind]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { kind } = await ctx.params;
  const query = new URL(request.url).searchParams;
  const rangeBased = query.has("from");

  const required: Permission =
    kind === "billing" && rangeBased ? "billing.view" : "reports.view";
  if (!can(user.role, required)) return new Response("Forbidden", { status: 403 });

  let rows: Cell[][];
  let label: string;

  if (kind === "billing" && rangeBased) {
    const from = query.get("from") ?? "";
    const to = query.get("to") ?? from;
    if (!DATE.test(from) || !DATE.test(to)) return new Response("Bad request", { status: 400 });
    const report = await buildBillingRange(from, to, user.role);
    label = `billing_${from}_${to}`;
    rows = billingRows(report.bills);
  } else {
    const periodParam = query.get("period");
    const dateParam = query.get("date") ?? undefined;
    if (!isPeriod(periodParam) || (dateParam && !DATE.test(dateParam))) {
      return new Response("Bad request", { status: 400 });
    }
    const report = await buildReport(periodParam, dateParam, user.role);
    label = `${kind}_${periodParam}_${report.range.date}`;

    if (kind === "billing") {
      rows = billingRows(report.billing.bills);
    } else if (kind === "orders") {
      rows = [
        ["Order", "Status", "Type", "Table", "Customer", "Phone", "Taken by", "Created (UTC)", "Total", "Returned at (UTC)", "Return reason", "Refund"],
        ...report.orders.placedOrders.map((order) => [
          order.code,
          order.status,
          order.type,
          order.tableId,
          order.customer.name,
          order.customer.phone,
          order.cashier,
          order.createdAt,
          order.totals.total,
          order.returned?.at,
          order.returned?.reason,
          order.returned?.amount,
        ]),
      ];
    } else {
      return new Response("Not found", { status: 404 });
    }
  }

  await mutate((db) => recordAudit(db, user, "export", `${label} (${rows.length - 1} rows)`));

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${label.replace(/[^a-z0-9_-]/gi, "")}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function billingRows(bills: Awaited<ReturnType<typeof buildBillingRange>>["bills"]): Cell[][] {
  return [
    ["Bill", "Created (UTC)", "Type", "Taken by", "Payment", "Reference", "Subtotal", "Discount", "Service", "Parcel fee", "GST rate %", "GST", "Total"],
    ...bills.map((order) => [
      order.code,
      order.createdAt,
      order.type,
      order.cashier,
      order.payment?.method ?? "unpaid",
      order.payment?.reference,
      order.totals.subtotal,
      order.totals.discount,
      order.totals.serviceCharge,
      order.totals.deliveryFee,
      order.totals.taxRate,
      order.totals.tax,
      order.totals.total,
    ]),
  ];
}

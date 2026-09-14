import { formatDateTime, ORDER_TYPE_LABEL } from "@/lib/format";
import type { DiningTable, Order } from "@/lib/types";

/** Kitchen copy — no prices, big type, notes shouted. */
export default function KitchenTicket({
  order,
  table,
}: {
  order: Order;
  table?: DiningTable;
}) {
  return (
    <div className="print-sheet mx-auto w-[320px] max-w-full rounded-xl border border-line bg-white p-5 font-mono text-[12px] leading-relaxed text-ink-900 shadow-pop">
      <header className="text-center">
        <p className="text-[14px] font-bold uppercase tracking-[0.16em]">Kitchen Ticket</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.2em]">
          {ORDER_TYPE_LABEL[order.type]}
        </p>
      </header>

      <div className="my-2 border-t border-ink-900" />

      <div className="flex items-baseline justify-between">
        <span className="text-[18px] font-bold">{order.code}</span>
        <span className="text-[16px] font-bold">
          {table ? table.name : order.type === "delivery" ? "DELIVERY" : "TAKEAWAY"}
        </span>
      </div>
      <p className="text-[10px]">
        {formatDateTime(order.createdAt)} UTC · {order.cashier}
        {order.tableId ? ` · ${order.guests} guests` : ""}
      </p>

      <div className="my-2 border-t border-dashed border-ink-400" />

      <ul className="space-y-3">
        {order.lines.map((line) => (
          <li key={line.lineId}>
            <p className="text-[15px] font-bold uppercase leading-tight">
              {line.quantity} × {line.name}
            </p>
            {line.options.map((option) => (
              <p key={`${option.groupId}-${option.choiceId}`} className="pl-4 text-[11px]">
                – {option.groupName}: {option.choiceName}
              </p>
            ))}
            {line.notes ? (
              <p className="mt-1 border border-ink-900 px-2 py-1 text-[11px] font-bold uppercase">
                ** {line.notes} **
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {order.notes ? (
        <>
          <div className="my-2 border-t border-dashed border-ink-400" />
          <p className="text-[11px] font-bold uppercase">Order note</p>
          <p className="text-[11px]">{order.notes}</p>
        </>
      ) : null}

      <div className="my-2 border-t border-ink-900" />

      <p className="text-center text-[10px] uppercase tracking-[0.2em]">
        {order.lines.reduce((sum, line) => sum + line.quantity, 0)} items · fire now
      </p>
    </div>
  );
}

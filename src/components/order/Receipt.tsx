import { OUTLET, PRICING } from "@/data/settings";
import { currency, formatDateTime, lineTotal, lineUnitPrice, ORDER_TYPE_LABEL, PAYMENT_LABEL } from "@/lib/format";
import type { DiningTable, Order } from "@/lib/types";

const Divider = ({ solid }: { solid?: boolean }) => (
  <div className={`my-2 border-t ${solid ? "border-ink-900" : "border-dashed border-ink-400"}`} />
);

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${bold ? "text-[13px] font-bold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Fake barcode built from divs — no image dependency, prints cleanly. */
function Barcode({ value }: { value: string }) {
  // Three bars per character keeps the stripe pattern dense enough to read as
  // a barcode at receipt width while staying deterministic.
  const bars = [...value].flatMap((char, index) => {
    const code = char.charCodeAt(0);
    return [((code + index) % 3) + 1, (code % 2) + 1, ((code >> 2) % 3) + 1];
  });

  return (
    <div className="mt-2">
      <div className="flex h-9 items-end justify-center gap-[2px]">
        {bars.map((width, index) => (
          <span
            key={index}
            className="h-full bg-ink-900"
            style={{ width: `${width}px` }}
          />
        ))}
      </div>
      <p className="mt-1 text-center text-[10px] tracking-[0.28em]">{value}</p>
    </div>
  );
}

/**
 * Customer receipt, sized for an 80mm thermal roll. Deliberately paper-coloured
 * in both themes — it is a preview of something printed on white paper.
 */
export default function Receipt({ order, table }: { order: Order; table?: DiningTable }) {
  return (
    <div className="print-sheet mx-auto w-[320px] max-w-full rounded-xl border border-line bg-white p-5 font-mono text-[11px] leading-relaxed text-ink-900 shadow-pop">
      <header className="text-center">
        <p className="text-[15px] font-bold uppercase tracking-[0.12em]">{OUTLET.name}</p>
        <p className="text-[10px] uppercase tracking-[0.2em]">{OUTLET.tagline}</p>
        <p className="mt-2 text-[10px]">{OUTLET.address}</p>
        <p className="text-[10px]">Tel {OUTLET.phone}</p>
        <p className="text-[10px]">Tax ID {OUTLET.taxId}</p>
      </header>

      <Divider solid />

      <div className="space-y-0.5">
        <Row label="Order" value={order.code} bold />
        <Row label="Type" value={ORDER_TYPE_LABEL[order.type].toUpperCase()} />
        {table ? <Row label="Table" value={`${table.name} · ${order.guests} guests`} /> : null}
        <Row label="Date" value={`${formatDateTime(order.createdAt)} UTC`} />
        <Row label="Cashier" value={`${order.cashier} · ${OUTLET.register}`} />
        <Row label="Guest" value={order.customer.name || "Walk-in Guest"} />
        {order.customer.phone ? <Row label="Phone" value={order.customer.phone} /> : null}
      </div>

      {order.customer.address ? (
        <p className="mt-1 text-[10px] leading-snug">Deliver to: {order.customer.address}</p>
      ) : null}

      <Divider />

      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wide">
        <span>Qty · Item</span>
        <span>Amount</span>
      </div>

      <Divider />

      <ul className="space-y-2">
        {order.lines.map((line) => (
          <li key={line.lineId}>
            <div className="flex justify-between gap-3">
              <span className="flex-1">
                <span className="font-bold">{line.quantity}×</span> {line.name}
              </span>
              <span className="tabular-nums">{currency(lineTotal(line))}</span>
            </div>
            {line.quantity > 1 ? (
              <p className="pl-4 text-[10px] text-ink-600">
                @ {currency(lineUnitPrice(line))} each
              </p>
            ) : null}
            {line.options.map((option) => (
              <p key={`${option.groupId}-${option.choiceId}`} className="pl-4 text-[10px] text-ink-600">
                · {option.choiceName}
                {option.price > 0 ? ` (+${currency(option.price)})` : ""}
              </p>
            ))}
            {line.notes ? (
              <p className="pl-4 text-[10px] italic text-ink-700">note: {line.notes}</p>
            ) : null}
          </li>
        ))}
      </ul>

      <Divider />

      <div className="space-y-0.5">
        <Row label="Subtotal" value={currency(order.totals.subtotal)} />
        {order.totals.discount > 0 ? (
          <Row
            label={`Discount (${order.discountPercent}%)`}
            value={`-${currency(order.totals.discount)}`}
          />
        ) : null}
        {order.totals.serviceCharge > 0 ? (
          <Row
            label={`Service (${PRICING.serviceChargeRate}%)`}
            value={currency(order.totals.serviceCharge)}
          />
        ) : null}
        {order.totals.deliveryFee > 0 ? (
          <Row label="Delivery" value={currency(order.totals.deliveryFee)} />
        ) : null}
        <Row label={`Tax (${PRICING.taxRate}%)`} value={currency(order.totals.tax)} />
        {order.totals.tip > 0 ? <Row label="Tip" value={currency(order.totals.tip)} /> : null}
      </div>

      <Divider solid />

      <Row label="TOTAL" value={currency(order.totals.total)} bold />

      <Divider />

      {order.payment ? (
        <div className="space-y-0.5">
          <Row label="Paid by" value={PAYMENT_LABEL[order.payment.method].toUpperCase()} />
          <Row label="Reference" value={order.payment.reference} />
          <Row label="Tendered" value={currency(order.payment.amountTendered)} />
          <Row label="Change" value={currency(order.payment.change)} />
        </div>
      ) : (
        <p className="text-center text-[11px] font-bold uppercase tracking-wide">
          ** Unpaid — settle at the table **
        </p>
      )}

      {order.notes ? (
        <>
          <Divider />
          <p className="text-[10px] leading-snug">Note: {order.notes}</p>
        </>
      ) : null}

      <Divider />

      <footer className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em]">Thank you</p>
        <p className="text-[10px]">We hope to see you again soon.</p>
        <Barcode value={order.code} />
      </footer>
    </div>
  );
}

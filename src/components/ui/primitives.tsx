import { UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { OUTLET } from "@/data/settings";
import { ORDER_TYPE_CLASS, ORDER_TYPE_LABEL, STATUS_CLASS, STATUS_LABEL } from "@/lib/format";
import { ORDER_TYPE_ICONS, STATUS_ICONS } from "@/lib/icons";
import type { OrderStatus, OrderType } from "@/lib/types";

/** The branch/register/name greeting banner shown atop the dashboard and the worker's order screen. */
export function GreetingBanner({ name, openOrders }: { name: string; openOrders: number }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-linear-to-br from-brand-500 to-brand-700 p-6 text-white shadow-pop">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">
            {OUTLET.branch} · {OUTLET.register} · {name}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Good service starts with a fast order.
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-white/85">
            {openOrders} order{openOrders === 1 ? " is" : "s are"} still open right now.
          </p>
        </div>
      </div>
    </section>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-base font-bold tracking-tight text-fg">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
        STATUS_CLASS[status],
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Class list for a pill, so links can look like chips without nesting a button inside an anchor. */
export const chipClass = (active?: boolean, className?: string) =>
  cn(
    "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all duration-150 active:scale-[0.96]",
    active
      ? "border-accent bg-accent text-accent-fg shadow-card"
      : "border-line bg-surface text-fg-muted hover:border-accent hover:text-accent",
    className,
  );

/** Dine In / Takeaway / Parcel, so the kind of order is readable at a glance wherever orders are listed. */
export function OrderTypeBadge({ type, className }: { type: OrderType; className?: string }) {
  const Icon = ORDER_TYPE_ICONS[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        ORDER_TYPE_CLASS[type],
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {ORDER_TYPE_LABEL[type]}
    </span>
  );
}

export function Chip({
  active,
  className,
  ...props
}: { active?: boolean } & ComponentProps<"button">) {
  return <button type="button" className={chipClass(active, className)} {...props} />;
}

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-fg-muted">
        {label}
        {required ? <span className="text-accent">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-fg-subtle">{hint}</span> : null}
    </label>
  );
}

const controlClass =
  "w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-fg " +
  "placeholder:text-fg-subtle transition-colors focus:border-accent focus:bg-surface focus:outline-none";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlClass, "resize-none", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(controlClass, "cursor-pointer", className)} {...props} />;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface-2 px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-surface-3 text-fg-muted">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-bold text-fg">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-fg-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/**
 * A menu item, deal or cart line's photo as a cropped, boxed thumbnail — used wherever a fixed-size
 * tile is needed (cart lines, checkout, order detail, dashboard, admin rows). Falls back to a
 * generic icon on a muted tile when no image is set. `className` sets the box's size and rounding;
 * a plain `<img>` (not `next/image`) so an admin-supplied URL is fetched by the browser, never
 * proxied through the server's image optimizer.
 *
 * The menu-browsing card uses its own uncropped, floating image instead — see `ItemCard` in
 * `MenuBrowser.tsx` — since a product photo there should never be cropped into a box.
 */
export function ItemImage({
  src,
  alt,
  icon: Icon = UtensilsCrossed,
  iconClassName,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  icon?: LucideIcon;
  iconClassName?: string;
  className?: string;
}) {
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden bg-surface-3 text-fg-subtle", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- external, admin-supplied URL; see comment above.
        <img src={src} alt={alt} className="size-full object-cover" loading="lazy" />
      ) : (
        <Icon className={cn("size-1/2", iconClassName)} aria-hidden />
      )}
    </span>
  );
}

export function KeyValue({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className={cn("text-fg-muted", strong && "font-bold text-fg")}>{label}</span>
      <span className={cn("tabular-nums text-fg", strong && "text-base font-bold")}>{value}</span>
    </div>
  );
}

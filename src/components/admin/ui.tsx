import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/primitives";

const TONES = {
  accent: "bg-accent-soft text-accent",
  dark: "bg-ink-900 text-white dark:bg-white dark:text-ink-900",
  plain: "bg-surface-3 text-fg",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
};

/** Stat tile shared by the billing and report screens — same look as the dashboard tiles. */
export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "plain",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-fg-muted">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tabular-nums text-fg">{value}</p>
          {sub ? <p className="mt-1 text-[11px] text-fg-subtle">{sub}</p> : null}
        </div>
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${TONES[tone]}`}>
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
    </Card>
  );
}

export function DataTable({
  head,
  children,
  minWidth = 640,
}: {
  head: ReactNode;
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="scroll-slim overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead className="border-b border-line bg-surface-2 text-[11px] uppercase tracking-wide text-fg-muted">
          {head}
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

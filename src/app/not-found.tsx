import { UtensilsCrossed } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-6">
      <div className="max-w-sm rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-surface-3 text-fg-muted">
          <UtensilsCrossed className="size-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-bold text-fg">This table is empty</h1>
        <p className="mt-2 text-sm text-fg-muted">
          The page you were looking for is not on the menu. Head back to the register and carry on
          taking orders.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <ButtonLink href="/">Dashboard</ButtonLink>
          <ButtonLink href="/orders" variant="secondary">
            Orders
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { ShieldCheck, UtensilsCrossed } from "lucide-react";
import LoginForm from "@/components/auth/LoginForm";
import { OUTLET } from "@/data/settings";
import { getCurrentUser } from "@/server/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/");

  const { next } = await searchParams;

  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-4 sm:p-6">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-line bg-surface shadow-float md:grid-cols-[1fr_1.05fr]">
        <section className="relative hidden flex-col justify-between bg-linear-to-br from-brand-500 to-brand-700 p-8 text-white md:flex">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-white/20">
              <UtensilsCrossed className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-bold">{OUTLET.name}</p>
              <p className="text-[11px] text-white/80">{OUTLET.branch}</p>
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight">
              Good service starts with a fast order.
            </h1>
            <p className="mt-3 max-w-xs text-sm text-white/85">
              Sign in with your employee account to take orders, settle bills and keep the
              kitchen moving.
            </p>
          </div>

          <p className="flex items-center gap-2 text-[11px] text-white/80">
            <ShieldCheck className="size-4" aria-hidden />
            Accounts are role-based and every action is recorded.
          </p>
        </section>

        <section className="p-6 sm:p-10">
          <div className="mb-6 flex items-center gap-3 md:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-fg">
              <UtensilsCrossed className="size-5" aria-hidden />
            </span>
            <p className="text-sm font-bold text-fg">{OUTLET.name}</p>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-fg">Welcome back</h2>
          <p className="mt-1 text-sm text-fg-muted">Sign in to the {OUTLET.register} register.</p>

          <LoginForm next={typeof next === "string" ? next : "/"} />
        </section>
      </div>
    </main>
  );
}

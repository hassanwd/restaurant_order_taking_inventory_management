"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/primitives";
import { loginAction, type LoginState } from "@/server/actions/auth";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [visible, setVisible] = useState(false);

  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />

      <Field label="Username">
        <Input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          required
          maxLength={64}
          defaultValue={state.username ?? ""}
          placeholder="e.g. cashier"
        />
      </Field>

      <Field label="Password">
        <div className="relative">
          <Input
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={256}
            className="pr-11"
            placeholder="••••••••••"
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-fg-subtle transition-all duration-150 hover:bg-surface-3 hover:text-accent active:scale-90"
          >
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
      </Field>

      {state.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-xs font-semibold text-danger"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" fullWidth disabled={pending}>
        <LogIn className="size-4" aria-hidden />
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-[11px] text-fg-subtle">
        Forgot your password? Ask a Super Admin to reset it for you.
      </p>
    </form>
  );
}

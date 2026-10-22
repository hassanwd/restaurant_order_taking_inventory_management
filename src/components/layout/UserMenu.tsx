"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";
import ChangePasswordModal from "@/components/auth/ChangePasswordModal";
import { initials } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";
import { logoutAction } from "@/server/actions/auth";

export default function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface-2 py-1.5 pl-1.5 pr-2.5 transition-all duration-150 hover:border-accent active:scale-[0.98]"
      >
        <span className="grid size-8 place-items-center rounded-lg bg-ink-900 text-xs font-bold text-white dark:bg-white dark:text-ink-900">
          {initials(user.name)}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-32 truncate text-xs font-bold text-fg">{user.name}</span>
          <span className="block text-[10px] text-fg-muted">{ROLE_LABEL[user.role]}</span>
        </span>
        <ChevronDown className="size-3.5 text-fg-subtle" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-30 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-float animate-pop-in"
        >
          <div className="border-b border-line px-3.5 py-3">
            <p className="truncate text-sm font-bold text-fg">{user.name}</p>
            <p className="truncate text-[11px] text-fg-muted">
              @{user.username} · {ROLE_LABEL[user.role]}
            </p>
          </div>
          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setChanging(true);
              }}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-fg-muted transition-colors hover:bg-surface-3 hover:text-accent"
            >
              <KeyRound className="size-4" aria-hidden />
              Change password
            </button>
            <form action={logoutAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-fg-muted transition-colors hover:bg-danger-soft hover:text-danger"
              >
                <LogOut className="size-4" aria-hidden />
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <ChangePasswordModal open={changing} onClose={() => setChanging(false)} />
    </div>
  );
}

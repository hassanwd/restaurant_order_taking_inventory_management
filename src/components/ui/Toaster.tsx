"use client";

import { useEffect } from "react";
import { AlertTriangle, CircleCheck, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { dismissToast } from "@/store/slices/uiSlice";

const tones = {
  success: "border-success/40 bg-success-soft text-success",
  info: "border-info/40 bg-info-soft text-info",
  danger: "border-danger/40 bg-danger-soft text-danger",
};

const toneIcons = {
  success: CircleCheck,
  info: Info,
  danger: AlertTriangle,
};

export default function Toaster() {
  const toast = useAppSelector((state) => state.ui.toast);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => dispatch(dismissToast()), 2600);
    return () => clearTimeout(timer);
  }, [toast, dispatch]);

  if (!toast) return null;

  const Icon = toneIcons[toast.tone];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <div
        key={toast.id}
        role="status"
        className={cn(
          "pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-float animate-pop-in",
          tones[toast.tone],
        )}
      >
        <Icon className="size-4" aria-hidden />
        {toast.message}
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/slices/uiSlice";
import type { ActionResult } from "@/server/actions/helpers";

/**
 * Calls a Server Action and handles the parts every caller needs: a pending
 * flag, and — if the session has expired or been frozen mid-use — a clean trip
 * back to the sign-in screen instead of a silent failure.
 */
export function useServerAction() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [pending, setPending] = useState(false);

  const call = useCallback(
    async <T extends object>(action: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> => {
      setPending(true);
      try {
        const result = await action();
        if (!result.ok && result.unauthenticated) {
          dispatch(showToast({ message: result.error, tone: "danger" }));
          router.replace("/login");
        }
        return result;
      } catch {
        return { ok: false, error: "Could not reach the server. Check your connection and retry." };
      } finally {
        setPending(false);
      }
    },
    [dispatch, router],
  );

  return { call, pending };
}

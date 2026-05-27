"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Shared styling for the small inline action buttons on subscription rows. */
export const ROW_ACTION_CLASS =
  "rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:opacity-50";

interface RowAction {
  pending: boolean;
  run: (fn: () => Promise<{ success: boolean; error?: string }>) => void;
}

/**
 * Runs a subscription action inside a transition: shows a toast on failure,
 * refreshes the route on success. Shared by subscription-row and
 * subscription-suggestions.
 */
export function useRowAction(): RowAction {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ success: boolean; error?: string }>): void {
    start(async () => {
      const res = await fn();
      if (!res.success) {
        toast.error(res.error ?? "Ocurrió un error");
        return;
      }
      router.refresh();
    });
  }

  return { pending, run };
}

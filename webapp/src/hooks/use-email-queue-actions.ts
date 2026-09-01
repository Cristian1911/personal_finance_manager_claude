"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  approveEmailTransaction,
  checkEmailReconciliation,
  dismissEmailTransaction,
  type ReconciliationCandidatePreview,
} from "@/actions/email-ingest";

export interface EmailQueueReconMatch {
  pendingId: string;
  candidate: ReconciliationCandidatePreview;
}

export interface UseEmailQueueActionsOptions {
  /** Account the row will be imported into (override › suggestion › client match). */
  resolveAccountId: (pendingId: string) => string | undefined;
  /** The row left the queue (imported or dismissed). */
  onProcessed: (pendingId: string) => void;
  /**
   * "optimistic": `onProcessed` fires before the server answers and
   * `onRollback` undoes it on failure — the row disappears on tap.
   * "confirmed" (default): `onProcessed` fires only after the server succeeds.
   */
  mode?: "optimistic" | "confirmed";
  onRollback?: (pendingId: string) => void;
  /** Awaited right before approving a row — e.g. flush an in-flight enrichment save. */
  beforeApprove?: (pendingId: string) => Promise<void>;
  /** Called once after every successful mutation — e.g. `router.refresh()`. */
  afterChange?: () => void;
}

const BULK_HINT = "impórtalas una por una";

/**
 * The email-queue state machine shared by every surface that lists queued
 * Bancolombia email transactions: import with duplicate check, resolve the
 * "posible duplicado" prompt, dismiss, and bulk import that never decides a
 * merge silently. Surfaces keep their own row state and pass the callbacks.
 */
export function useEmailQueueActions({
  resolveAccountId,
  onProcessed,
  mode = "confirmed",
  onRollback,
  beforeApprove,
  afterChange,
}: UseEmailQueueActionsOptions) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [reconMatch, setReconMatch] = useState<EmailQueueReconMatch | null>(null);
  const [isPending, startTransition] = useTransition();

  const optimistic = mode === "optimistic";

  /** Approve one row; returns whether it left the queue. */
  const approve = useCallback(
    async (pendingId: string, reconcileWithId?: string): Promise<boolean> => {
      const accountId = resolveAccountId(pendingId);
      if (optimistic) onProcessed(pendingId);
      try {
        await beforeApprove?.(pendingId);
        const result = await approveEmailTransaction(pendingId, accountId, reconcileWithId);
        if (result.success) {
          if (!optimistic) onProcessed(pendingId);
          return true;
        }
        if (optimistic) onRollback?.(pendingId);
        toast.error(result.error ?? "Error al importar");
        return false;
      } catch {
        if (optimistic) onRollback?.(pendingId);
        toast.error("Error al importar. Inténtalo de nuevo.");
        return false;
      }
    },
    [resolveAccountId, optimistic, onProcessed, onRollback, beforeApprove],
  );

  /** Import a row, stopping at the duplicate prompt when there's a candidate. */
  const importOne = useCallback(
    (pendingId: string) => {
      setBusyId(pendingId);
      startTransition(async () => {
        try {
          const recon = await checkEmailReconciliation(pendingId, resolveAccountId(pendingId));
          if (recon.success && recon.data) {
            setBusyId(null);
            setReconMatch({ pendingId, candidate: recon.data.candidate });
            return;
          }
        } catch {
          // Check unavailable — import directly, the server dedups by idempotency key.
        }
        const ok = await approve(pendingId);
        setBusyId(null);
        if (ok) {
          afterChange?.();
          toast.success("Transacción importada");
        }
      });
    },
    [resolveAccountId, approve, afterChange],
  );

  /** Resolve the duplicate prompt: merge into the candidate or import as new. */
  const chooseRecon = useCallback(
    (reconcile: boolean) => {
      if (!reconMatch) return;
      const { pendingId, candidate } = reconMatch;
      setReconMatch(null);
      setBusyId(pendingId);
      startTransition(async () => {
        const ok = await approve(pendingId, reconcile ? candidate.id : undefined);
        setBusyId(null);
        if (ok) {
          afterChange?.();
          toast.success(reconcile ? "Transacción reconciliada" : "Transacción importada");
        }
      });
    },
    [reconMatch, approve, afterChange],
  );

  const closeRecon = useCallback(() => setReconMatch(null), []);

  const dismiss = useCallback(
    (pendingId: string) => {
      setBusyId(pendingId);
      if (optimistic) onProcessed(pendingId);
      startTransition(async () => {
        try {
          const result = await dismissEmailTransaction(pendingId);
          setBusyId(null);
          if (result.success) {
            if (!optimistic) onProcessed(pendingId);
            afterChange?.();
            toast.success("Descartada");
          } else {
            if (optimistic) onRollback?.(pendingId);
            toast.error(result.error ?? "Error al descartar");
          }
        } catch {
          setBusyId(null);
          if (optimistic) onRollback?.(pendingId);
          toast.error("Error al descartar. Inténtalo de nuevo.");
        }
      });
    },
    [optimistic, onProcessed, onRollback, afterChange],
  );

  /**
   * Import many rows. Rows with a possible duplicate stay in the queue — bulk
   * never decides a merge; the user resolves those one by one with the prompt.
   */
  const bulkImport = useCallback(
    (pendingIds: string[]) => {
      if (pendingIds.length === 0) return;
      setBulkLoading(true);
      startTransition(async () => {
        let imported = 0;
        let failed = 0;
        let needsReview = 0;
        for (const id of pendingIds) {
          try {
            const recon = await checkEmailReconciliation(id, resolveAccountId(id));
            if (recon.success && recon.data) {
              needsReview++;
              continue;
            }
          } catch {
            // Same fallback as importOne — the server dedups.
          }
          if (await approve(id)) imported++;
          else failed++;
        }
        setBulkLoading(false);
        afterChange?.();
        if (failed === 0 && needsReview === 0) {
          toast.success(`${imported} transacciones importadas`);
        } else if (needsReview > 0) {
          toast.warning(
            `${imported} importadas · ${needsReview} con posible duplicado — ${BULK_HINT}${failed > 0 ? ` · ${failed} con error` : ""}`,
          );
        } else {
          toast.warning(`${imported} importadas, ${failed} con error`);
        }
      });
    },
    [resolveAccountId, approve, afterChange],
  );

  return {
    busyId,
    bulkLoading,
    isPending,
    reconMatch,
    closeRecon,
    importOne,
    chooseRecon,
    dismiss,
    bulkImport,
  };
}

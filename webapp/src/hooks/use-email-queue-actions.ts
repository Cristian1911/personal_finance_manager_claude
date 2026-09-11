"use client";

import { useCallback, useRef, useState, useTransition } from "react";
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
const EMPTY_SET: ReadonlySet<string> = new Set();

/**
 * The email-queue state machine shared by every surface that lists queued
 * Bancolombia email transactions: import with duplicate check, resolve the
 * "posible duplicado" prompt, dismiss, and bulk import that never decides a
 * merge silently. Surfaces keep their own row state and pass the callbacks.
 *
 * Every row in flight is tracked individually (`busyIds`) and a row that is
 * already in flight ignores a second tap. A single shared "busy" id used to
 * let a tap on row B re-enable row A mid-import; tapping A again then ran a
 * second import of the same row, whose duplicate check found the transaction
 * the first import had just created and offered it as a "posible duplicado".
 */
export function useEmailQueueActions({
  resolveAccountId,
  onProcessed,
  mode = "confirmed",
  onRollback,
  beforeApprove,
  afterChange,
}: UseEmailQueueActionsOptions) {
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(EMPTY_SET);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [reconMatch, setReconMatch] = useState<EmailQueueReconMatch | null>(null);
  const [isPending, startTransition] = useTransition();
  // Synchronous mirror of `busyIds` — state updates are batched, so two taps
  // in the same tick would both see the row as idle.
  const inFlightRef = useRef(new Set<string>());

  const optimistic = mode === "optimistic";

  /** Claim a row; false when it is already being processed. */
  const begin = useCallback((pendingId: string): boolean => {
    if (inFlightRef.current.has(pendingId)) return false;
    inFlightRef.current.add(pendingId);
    setBusyIds(new Set(inFlightRef.current));
    return true;
  }, []);

  const settle = useCallback((pendingId: string) => {
    inFlightRef.current.delete(pendingId);
    setBusyIds(inFlightRef.current.size === 0 ? EMPTY_SET : new Set(inFlightRef.current));
  }, []);

  /**
   * Approve one row; returns whether it left the queue. `notify` controls the
   * per-row error toast — bulk runs report failures once, in their summary.
   */
  const approve = useCallback(
    async (
      pendingId: string,
      reconcileWithId?: string,
      { notify = true }: { notify?: boolean } = {},
    ): Promise<boolean> => {
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
        if (notify) toast.error(result.error ?? "Error al importar");
        return false;
      } catch {
        if (optimistic) onRollback?.(pendingId);
        if (notify) toast.error("Error al importar. Inténtalo de nuevo.");
        return false;
      }
    },
    [resolveAccountId, optimistic, onProcessed, onRollback, beforeApprove],
  );

  /**
   * The server says the row already left the queue (imported or dismissed
   * elsewhere — another tab, a bulk run, a webhook). Drop it here too.
   */
  const acknowledgeProcessed = useCallback(
    (pendingId: string, status: "imported" | "dismissed") => {
      onProcessed(pendingId);
      afterChange?.();
      toast.info(
        status === "imported"
          ? "Esta transacción ya se había importado."
          : "Esta transacción ya se había descartado.",
      );
    },
    [onProcessed, afterChange],
  );

  /** Import a row, stopping at the duplicate prompt when there's a candidate. */
  const importOne = useCallback(
    (pendingId: string) => {
      if (!begin(pendingId)) return;
      startTransition(async () => {
        try {
          const recon = await checkEmailReconciliation(pendingId, resolveAccountId(pendingId));
          if (recon.success && recon.data?.kind === "processed") {
            settle(pendingId);
            acknowledgeProcessed(pendingId, recon.data.status);
            return;
          }
          if (recon.success && recon.data?.kind === "review") {
            settle(pendingId);
            setReconMatch({ pendingId, candidate: recon.data.candidate });
            return;
          }
        } catch {
          // Check unavailable — import directly, the server dedups by idempotency key.
        }
        const ok = await approve(pendingId);
        settle(pendingId);
        if (ok) {
          afterChange?.();
          toast.success("Transacción importada");
        }
      });
    },
    [begin, settle, resolveAccountId, acknowledgeProcessed, approve, afterChange],
  );

  /** Resolve the duplicate prompt: merge into the candidate or import as new. */
  const chooseRecon = useCallback(
    (reconcile: boolean) => {
      if (!reconMatch) return;
      const { pendingId, candidate } = reconMatch;
      setReconMatch(null);
      if (!begin(pendingId)) return;
      startTransition(async () => {
        const ok = await approve(pendingId, reconcile ? candidate.id : undefined);
        settle(pendingId);
        if (ok) {
          afterChange?.();
          toast.success(reconcile ? "Transacción reconciliada" : "Transacción importada");
        }
      });
    },
    [reconMatch, begin, settle, approve, afterChange],
  );

  /** Closing the prompt decides nothing — the row stays in the queue. */
  const closeRecon = useCallback(() => setReconMatch(null), []);

  const dismiss = useCallback(
    (pendingId: string) => {
      if (!begin(pendingId)) return;
      if (optimistic) onProcessed(pendingId);
      startTransition(async () => {
        try {
          const result = await dismissEmailTransaction(pendingId);
          settle(pendingId);
          if (result.success) {
            if (!optimistic) onProcessed(pendingId);
            afterChange?.();
            toast.success("Descartada");
          } else {
            if (optimistic) onRollback?.(pendingId);
            toast.error(result.error ?? "Error al descartar");
          }
        } catch {
          settle(pendingId);
          if (optimistic) onRollback?.(pendingId);
          toast.error("Error al descartar. Inténtalo de nuevo.");
        }
      });
    },
    [begin, settle, optimistic, onProcessed, onRollback, afterChange],
  );

  /**
   * Import many rows. Rows with a possible duplicate stay in the queue — bulk
   * never decides a merge; the user resolves those one by one with the prompt.
   * Rows already in flight from a single tap are left to that tap.
   */
  const bulkImport = useCallback(
    (pendingIds: string[]) => {
      const ids = pendingIds.filter(begin);
      if (ids.length === 0) return;
      setBulkLoading(true);
      startTransition(async () => {
        let imported = 0;
        let failed = 0;
        let needsReview = 0;
        for (const id of ids) {
          try {
            const recon = await checkEmailReconciliation(id, resolveAccountId(id));
            if (recon.success && recon.data?.kind === "processed") {
              // Gone from the queue already — nothing to import, nothing to count.
              onProcessed(id);
              settle(id);
              continue;
            }
            if (recon.success && recon.data?.kind === "review") {
              needsReview++;
              settle(id);
              continue;
            }
          } catch {
            // Same fallback as importOne — the server dedups.
          }
          if (await approve(id, undefined, { notify: false })) imported++;
          else failed++;
          settle(id);
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
    [begin, settle, resolveAccountId, onProcessed, approve, afterChange],
  );

  return {
    /** Rows currently being imported or dismissed. */
    busyIds,
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

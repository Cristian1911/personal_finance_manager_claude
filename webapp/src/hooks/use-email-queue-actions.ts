"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  approveEmailTransaction,
  checkEmailReconciliation,
  dismissEmailTransaction,
  type ReconciliationCandidatePreview,
} from "@/actions/email-ingest";
import {
  processedQueueRowMessage,
  type ProcessedQueueStatus,
} from "@/lib/email-ingest/queue-status";

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
 * How a row left (or failed to leave) the queue: `imported` by this call,
 * `processed` elsewhere before this call landed, or `failed`.
 */
type ApproveOutcome = "imported" | "processed" | "failed";

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
   * The server says the row already left the queue (imported or dismissed
   * elsewhere — another tab, a bulk run, a webhook). Drop it here too; with
   * `notify` off the caller reports it in its own summary.
   */
  const acknowledgeProcessed = useCallback(
    (pendingId: string, status: ProcessedQueueStatus, notify = true) => {
      onProcessed(pendingId);
      if (notify) {
        afterChange?.();
        toast.info(processedQueueRowMessage(status));
      }
    },
    [onProcessed, afterChange],
  );

  /**
   * Approve one row. `notify` controls the per-row toasts — bulk runs report
   * failures and already-processed rows once, in their summary.
   */
  const approve = useCallback(
    async (
      pendingId: string,
      reconcileWithId?: string,
      { notify = true }: { notify?: boolean } = {},
    ): Promise<ApproveOutcome> => {
      const accountId = resolveAccountId(pendingId);
      if (optimistic) onProcessed(pendingId);
      try {
        await beforeApprove?.(pendingId);
        const result = await approveEmailTransaction(pendingId, accountId, reconcileWithId);
        if (result.success) {
          if (!optimistic) onProcessed(pendingId);
          return "imported";
        }
        if (result.processed) {
          // Already gone server-side: an optimistic removal stands, a
          // confirmed surface drops the row now — never roll it back.
          if (optimistic) {
            if (notify) {
              afterChange?.();
              toast.info(processedQueueRowMessage(result.processed));
            }
          } else {
            acknowledgeProcessed(pendingId, result.processed, notify);
          }
          return "processed";
        }
        if (optimistic) onRollback?.(pendingId);
        if (notify) toast.error(result.error ?? "Error al importar");
        return "failed";
      } catch {
        if (optimistic) onRollback?.(pendingId);
        if (notify) toast.error("Error al importar. Inténtalo de nuevo.");
        return "failed";
      }
    },
    [resolveAccountId, optimistic, onProcessed, onRollback, beforeApprove, afterChange, acknowledgeProcessed],
  );

  /** Import a row, stopping at the duplicate prompt when there's a candidate. */
  const importOne = useCallback(
    (pendingId: string) => {
      if (!begin(pendingId)) return;
      startTransition(async () => {
        try {
          try {
            const recon = await checkEmailReconciliation(pendingId, resolveAccountId(pendingId));
            if (recon.success && recon.data?.kind === "processed") {
              acknowledgeProcessed(pendingId, recon.data.status);
              return;
            }
            if (recon.success && recon.data?.kind === "review") {
              setReconMatch({ pendingId, candidate: recon.data.candidate });
              return;
            }
          } catch {
            // Check unavailable — import directly, the server dedups by idempotency key.
          }
          const outcome = await approve(pendingId);
          if (outcome === "imported") {
            afterChange?.();
            toast.success("Transacción importada");
          }
        } finally {
          settle(pendingId);
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
      if (!begin(pendingId)) return;
      setReconMatch(null);
      startTransition(async () => {
        try {
          const outcome = await approve(pendingId, reconcile ? candidate.id : undefined);
          if (outcome === "imported") {
            afterChange?.();
            toast.success(reconcile ? "Transacción reconciliada" : "Transacción importada");
          }
        } finally {
          settle(pendingId);
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
          if (result.success) {
            if (!optimistic) onProcessed(pendingId);
            afterChange?.();
            toast.success("Descartada");
          } else if (result.processed) {
            if (!optimistic) onProcessed(pendingId);
            afterChange?.();
            toast.info(processedQueueRowMessage(result.processed));
          } else {
            if (optimistic) onRollback?.(pendingId);
            toast.error(result.error ?? "Error al descartar");
          }
        } catch {
          if (optimistic) onRollback?.(pendingId);
          toast.error("Error al descartar. Inténtalo de nuevo.");
        } finally {
          settle(pendingId);
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
        let processed = 0;
        try {
          for (const id of ids) {
            try {
              try {
                const recon = await checkEmailReconciliation(id, resolveAccountId(id));
                if (recon.success && recon.data?.kind === "processed") {
                  acknowledgeProcessed(id, recon.data.status, false);
                  processed++;
                  continue;
                }
                if (recon.success && recon.data?.kind === "review") {
                  needsReview++;
                  continue;
                }
              } catch {
                // Same fallback as importOne — the server dedups.
              }
              const outcome = await approve(id, undefined, { notify: false });
              if (outcome === "imported") imported++;
              else if (outcome === "processed") processed++;
              else failed++;
            } finally {
              settle(id);
            }
          }
        } finally {
          setBulkLoading(false);
        }
        afterChange?.();
        const alreadyGone =
          processed > 0 ? ` · ${processed} ya no estaban en la cola` : "";
        if (failed === 0 && needsReview === 0) {
          if (imported === 0 && processed > 0) {
            toast.info(`${processed} ya no estaban en la cola`);
          } else {
            toast.success(`${imported} transacciones importadas${alreadyGone}`);
          }
        } else if (needsReview > 0) {
          toast.warning(
            `${imported} importadas · ${needsReview} con posible duplicado — ${BULK_HINT}${failed > 0 ? ` · ${failed} con error` : ""}${alreadyGone}`,
          );
        } else {
          toast.warning(`${imported} importadas, ${failed} con error${alreadyGone}`);
        }
      });
    },
    [begin, settle, resolveAccountId, acknowledgeProcessed, approve, afterChange],
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

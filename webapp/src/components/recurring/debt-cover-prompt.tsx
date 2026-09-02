"use client";

import { useCallback, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  findCoveringDebtOccurrence,
  linkExistingTransactionToOccurrence,
  type DebtCoverCandidate,
} from "@/actions/occurrences";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { isDebtAccountType } from "@zeta/shared";

type PendingPrompt = {
  candidate: DebtCoverCandidate;
  transactionId: string;
  onDone: () => void;
};

export interface DebtCoverAskArgs {
  /** The saved transaction — for a transfer, the INFLOW leg on the debt account. */
  transactionId: string;
  /** Account the money went INTO. Non-debt accounts never prompt. */
  accountType: string | null | undefined;
  /** Called once the user answers (or immediately when there is nothing to ask). */
  onDone: () => void;
}

/**
 * "¿Este abono incluye la cuota del 1 sep?" — asked right after a payment into
 * a credit card / loan is saved, when a pending payment occurrence (the
 * statement minimum) falls inside the cover window and the amount covers it.
 *
 * The payment is never linked silently: after the statement cut it may be a
 * pure extra contribution with the minimum still to be paid, so only a "Sí"
 * links (linkExistingTransactionToOccurrence → occurrence paid, tx kept).
 *
 * Usage: `const { maybeAsk, dialog } = useDebtCoverPrompt();` — call `maybeAsk`
 * inside the form's action wrapper instead of the success handler; it returns
 * true when a prompt opened (the success handler runs when the user answers)
 * and false when the caller should run it right away. Render `dialog`.
 */
export function useDebtCoverPrompt(): {
  maybeAsk: (args: DebtCoverAskArgs) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [prompt, setPrompt] = useState<PendingPrompt | null>(null);
  const [linking, setLinking] = useState(false);

  const maybeAsk = useCallback(async (args: DebtCoverAskArgs) => {
    if (!args.accountType || !isDebtAccountType(args.accountType)) return false;
    let candidate: DebtCoverCandidate | null = null;
    try {
      candidate = await findCoveringDebtOccurrence(args.transactionId);
    } catch (e) {
      console.error("[useDebtCoverPrompt] lookup failed:", e);
      return false;
    }
    if (!candidate) return false;
    setPrompt({ candidate, transactionId: args.transactionId, onDone: args.onDone });
    return true;
  }, []);

  const finish = useCallback(() => {
    const done = prompt?.onDone;
    setPrompt(null);
    setLinking(false);
    done?.();
  }, [prompt]);

  const handleInclude = useCallback(async () => {
    if (!prompt) return;
    setLinking(true);
    const result = await linkExistingTransactionToOccurrence(
      prompt.candidate.occurrenceId,
      prompt.transactionId,
    );
    if (result.success) {
      toast.success("Cuota marcada como pagada con este abono");
    } else {
      toast.error(result.error);
    }
    finish();
  }, [prompt, finish]);

  const dialog = prompt ? (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !linking) finish();
      }}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Este abono incluye la cuota del{" "}
            {formatDate(prompt.candidate.occurrenceDate, "d MMM")}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {prompt.candidate.merchant} tiene una cuota pendiente de{" "}
            {formatCurrency(
              prompt.candidate.expectedAmount,
              prompt.candidate.currencyCode,
            )}{" "}
            que vence el {formatDate(prompt.candidate.occurrenceDate)}. Si este
            abono la incluye, la marcamos como pagada. Si es un aporte extra, la
            cuota sigue pendiente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={linking} onClick={finish}>
            No, es aporte extra
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={linking}
            onClick={(e) => {
              e.preventDefault();
              void handleInclude();
            }}
          >
            {linking ? "Vinculando…" : "Sí, incluirla"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  return { maybeAsk, dialog };
}

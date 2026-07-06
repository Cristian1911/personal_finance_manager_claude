import type { TransactionDirection } from "../types/domain";
import { applyAccountBalanceDelta } from "./account-balance";

/**
 * Prefix used by the manual balance adjustment transactions created from the
 * account edit form. Shared so the import flow can recognize (and exclude or
 * anchor around) these rows without duplicating the literal.
 */
export const MANUAL_BALANCE_ADJUSTMENT_PREFIX = "Ajuste manual de saldo";

export function isManualBalanceAdjustment(rawDescription: string | null | undefined): boolean {
  return !!rawDescription?.startsWith(MANUAL_BALANCE_ADJUSTMENT_PREFIX);
}

export type StatementOccurrenceInput = {
  /** "statementIndex:transactionIndex" — scopes duplicate counting per statement. */
  importKey?: string | null;
  transactionDate: string;
  amount: number;
  originalAmount?: number | null;
  rawDescription: string;
  installmentCurrent?: number | null;
};

/**
 * Assigns a 1-based occurrence index to each transaction, counting identical
 * rows (same date, amount, description, installment) WITHIN the same statement.
 *
 * Why: a bank statement never lists the same movement twice, so two identical
 * rows in ONE statement are two real movements (e.g. two transfers of the same
 * amount to the same person on the same day). Without an occurrence index they
 * collapse into one idempotency key and the second row is silently skipped —
 * the imported total then can't reproduce the statement's final balance.
 *
 * Counting is scoped per statement (via importKey's statementIndex prefix) so
 * the same movement appearing in TWO uploaded statements — overlapping periods
 * or a re-selected file — still deduplicates occurrence-for-occurrence.
 */
export function assignStatementOccurrenceIndexes(
  transactions: StatementOccurrenceInput[]
): number[] {
  const counters = new Map<string, number>();
  return transactions.map((tx) => {
    const statementScope = tx.importKey?.split(":")[0] ?? "";
    const identity = [
      statementScope,
      tx.transactionDate,
      (tx.originalAmount ?? tx.amount).toFixed(2),
      tx.rawDescription,
      tx.installmentCurrent != null ? String(tx.installmentCurrent) : "",
    ].join("|");
    const next = (counters.get(identity) ?? 0) + 1;
    counters.set(identity, next);
    return next;
  });
}

export type PostCutoffTransaction = {
  amount: number;
  direction: TransactionDirection;
  rawDescription?: string | null;
};

export type AnchoredBalanceResult =
  | {
      /**
       * The account balance already reflects a manual adjustment made AFTER the
       * statement cutoff — the user re-anchored it to reality. The import must
       * not overwrite it.
       */
      keepExisting: true;
      balance: null;
      postCutoffCount: number;
    }
  | {
      keepExisting: false;
      /** Statement final balance + net effect of movements after the cutoff. */
      balance: number;
      postCutoffCount: number;
    };

/**
 * Computes the account balance to persist after importing a statement for a
 * non-debt (savings/checking) account.
 *
 * The statement's final balance is the truth AT the cutoff date — not today.
 * Overwriting the live balance with it silently erases every movement the user
 * recorded after the cutoff (the "137k → 937k" bug). Instead we anchor at the
 * cutoff and replay the post-cutoff movements the app already knows about:
 *
 *   balance = final_balance + Σ delta(post-cutoff transactions)
 *
 * Exception: if any post-cutoff manual balance adjustment exists, the user has
 * explicitly re-anchored the balance to reality after the cutoff. Replaying an
 * adjustment as a delta is wrong (its amount was computed against a different
 * history), so we keep the existing account balance untouched.
 */
export function anchorStatementBalance(params: {
  finalBalance: number;
  accountType: string;
  postCutoffTransactions: PostCutoffTransaction[];
}): AnchoredBalanceResult {
  const { finalBalance, accountType, postCutoffTransactions } = params;

  const hasPostCutoffAdjustment = postCutoffTransactions.some((tx) =>
    isManualBalanceAdjustment(tx.rawDescription)
  );
  if (hasPostCutoffAdjustment) {
    return { keepExisting: true, balance: null, postCutoffCount: postCutoffTransactions.length };
  }

  let balance = finalBalance;
  for (const tx of postCutoffTransactions) {
    balance = applyAccountBalanceDelta({
      currentBalance: balance,
      accountType,
      direction: tx.direction,
      amount: tx.amount,
    });
  }

  return {
    keepExisting: false,
    balance: Math.round(balance * 100) / 100,
    postCutoffCount: postCutoffTransactions.length,
  };
}

export type PeriodBalanceValidation = {
  /** previous_balance + Σ delta(period transactions in the app). */
  computedBalance: number;
  /** computedBalance − statement final_balance. Positive = app has extra inflows/missing outflows. */
  difference: number;
  matches: boolean;
};

/**
 * Balance-guarantee check: after importing, the app's transactions inside the
 * statement period must walk previous_balance to final_balance. A non-zero
 * difference means duplicated rows (difference has the sign of the extra
 * delta) or missing/deselected movements — surfaced to the user instead of
 * silently drifting.
 */
export function validateStatementPeriodBalance(params: {
  previousBalance: number;
  finalBalance: number;
  accountType: string;
  periodTransactions: Array<{ amount: number; direction: TransactionDirection }>;
}): PeriodBalanceValidation {
  let balance = params.previousBalance;
  for (const tx of params.periodTransactions) {
    balance = applyAccountBalanceDelta({
      currentBalance: balance,
      accountType: params.accountType,
      direction: tx.direction,
      amount: tx.amount,
    });
  }
  const computedBalance = Math.round(balance * 100) / 100;
  const difference = Math.round((computedBalance - params.finalBalance) * 100) / 100;
  return {
    computedBalance,
    difference,
    // Sub-peso tolerance: statements round to the peso; cents drift is noise.
    matches: Math.abs(difference) <= 1,
  };
}

/**
 * Canonical aggregation for the "Resumen del mes" card on both mobile and
 * webapp. Both surfaces had divergent ad-hoc implementations that produced
 * 7-33× different numbers (live walkthrough 2026-05-21). This helper is the
 * single source of truth for what counts as a movimiento / ingreso / gasto /
 * uncategorizado for a given month.
 *
 * Rules (mirror CLAUDE.md "Income & Metrics Rules"):
 *  - Exclude transactions with `is_excluded === true` from every total.
 *  - Exclude reconciled-into-other-transaction rows (`reconciled_into_transaction_id !== null`).
 *  - For totalInflow specifically, also exclude INFLOWs into debt accounts —
 *    those are debt payments, not income (see `isDebtAccountType` in
 *    @zeta/shared/utils/account-balance.ts).
 *  - "Uncategorized" = OUTFLOW with no `category_id`. Not direction-agnostic.
 *
 * Pure function over plain row objects so it works identically against the
 * decrypted Supabase view (webapp) and the local SQLite mirror (mobile).
 */

/** Minimum-information row shape — both platforms can project into this. */
import { effectiveFlowClass, isIncomeClass, isSpendClass } from "./flow-class";

export interface AggregatableTransaction {
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  account_id: string;
  category_id: string | null;
  /** Boolean on webapp; integer 0/1 from SQLite on mobile. */
  is_excluded: boolean | number | null;
  reconciled_into_transaction_id: string | null;
  /** YYYY-MM-DD. Used only when caller wants the daily breakdown. */
  transaction_date: string;
  /**
   * Shared-payment ("Pago compartido") repaid total. The OUTFLOW's effective
   * spend = amount − split_repaid_amount (converges to the user's own share as
   * participants pay back). NULL/0/undefined for every normal transaction.
   */
  split_repaid_amount?: number | null;
  /**
   * Persisted flow class, when the row has one. Honored in preference to the
   * `debtAccountIds` heuristic: the account type cannot tell a loan disbursed
   * into savings from a salary, nor a card payment from a purchase.
   */
  flow_class?: string | null;
  /** User correction. Always wins over `flow_class`. */
  flow_class_override?: string | null;
}

export interface MonthlyAggregatesResult {
  /** All non-excluded, non-reconciled rows in scope. */
  count: number;
  /** Sum of INFLOW amounts, excluding INFLOWs into debt accounts. */
  totalInflow: number;
  /** Sum of OUTFLOW amounts. */
  totalOutflow: number;
  /** Count of OUTFLOWs with no category_id. */
  uncategorizedCount: number;
  /**
   * Per-day breakdown (in transaction_date order ascending). Empty when the
   * caller passes `{ withDaysByDate: false }`.
   */
  daysByDate: { date: string; income: number; expense: number }[];
}

export interface AggregateOptions {
  /** Debt-account ids — INFLOWs into these accounts are NOT counted as income. */
  debtAccountIds: ReadonlySet<string>;
  /** Skip the per-day breakdown if the consumer doesn't need it. Default `true`. */
  withDaysByDate?: boolean;
}

function isExcluded(value: boolean | number | null | undefined): boolean {
  return value === true || value === 1;
}

/**
 * Reduce an array of transactions to the canonical monthly aggregates.
 *
 * Caller is responsible for scoping the input to the desired month — either
 * with a SQL `WHERE transaction_date BETWEEN ?` (mobile) or a Supabase
 * `.gte/.lte("transaction_date", ...)` (webapp). This helper does NOT filter
 * by date; it only applies the exclusion + direction + category rules.
 */
export function computeMonthlyAggregates(
  rows: readonly AggregatableTransaction[],
  options: AggregateOptions,
): MonthlyAggregatesResult {
  const withDays = options.withDaysByDate ?? true;
  let count = 0;
  let totalInflow = 0;
  let totalOutflow = 0;
  let uncategorizedCount = 0;
  const dayBuckets = new Map<string, { income: number; expense: number }>();

  for (const row of rows) {
    if (row.reconciled_into_transaction_id !== null) continue;
    if (isExcluded(row.is_excluded)) continue;

    count += 1;

    // Prefer the persisted class when the row carries one; fall back to the
    // account-type heuristic for rows written before flow_class existed.
    const flowClass = effectiveFlowClass(row);
    const isDebt = options.debtAccountIds.has(row.account_id);
    const countsAsIncome = flowClass ? isIncomeClass(flowClass) : !isDebt;
    const countsAsSpend = flowClass ? isSpendClass(flowClass) : true;

    // Effective OUTFLOW spend nets out the shared-payment repaid portion.
    const outflowSpend = row.amount - Number(row.split_repaid_amount ?? 0);

    if (row.direction === "INFLOW") {
      if (countsAsIncome) {
        totalInflow += row.amount;
      }
    } else {
      // OUTFLOW
      if (countsAsSpend) {
        totalOutflow += outflowSpend;
        if (row.category_id === null || row.category_id === undefined) {
          uncategorizedCount += 1;
        }
      }
    }

    if (withDays) {
      const bucket = dayBuckets.get(row.transaction_date) ?? { income: 0, expense: 0 };
      if (row.direction === "INFLOW" && countsAsIncome) bucket.income += row.amount;
      if (row.direction === "OUTFLOW" && countsAsSpend) bucket.expense += outflowSpend;
      dayBuckets.set(row.transaction_date, bucket);
    }
  }

  const daysByDate = withDays
    ? Array.from(dayBuckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, sums]) => ({ date, income: sums.income, expense: sums.expense }))
    : [];

  return { count, totalInflow, totalOutflow, uncategorizedCount, daysByDate };
}

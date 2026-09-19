import type { SupabaseClient } from "@supabase/supabase-js";
import { captureMethodsOfTier } from "@zeta/shared";
import type { Database } from "@/types/database";

/**
 * Bandeja "sin respaldo en el extracto".
 *
 * A card statement is the source of truth for the period it covers. A
 * movement that reached the ledger from a bank alert or a screenshot (tier 2)
 * inside an already-imported period, and that no statement row reconciled
 * against, is not on the statement: typically a card validation hold
 * (LOUNGEKEY USD 1,00) the bank later withdrew. The tray lists them so the
 * user deletes or keeps each one; "keep" is remembered in
 * `statement_tray_dismissals`.
 *
 * Manual entries (tier 3) are left alone: they are the user's own decision.
 * Only OUTFLOW rows qualify (holds are purchases; a card payment that failed
 * to reconcile is an abono problem, not a hold). A row dated within the last
 * days of a period is skipped unless the FOLLOWING statement is imported too:
 * the bank may post it on the next statement, so it is not missing yet.
 */
export const STATEMENT_TRAY_CUTOFF_GRACE_DAYS = 3;

function shiftIsoDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export const STATEMENT_TRAY_CAPTURE_METHODS = captureMethodsOfTier(2);

/** Rows the tray lists per read — past this, the panel says "y N más". */
export const STATEMENT_TRAY_LIMIT = 200;

/** One statement period (account + currency) — the scope of one import. */
export type StatementTrayPeriod = {
  accountId: string;
  currencyCode: string;
  periodFrom: string;
  periodTo: string;
};

export type StatementTrayRow = {
  id: string;
  account_id: string;
  account_name: string | null;
  transaction_date: string;
  amount: number;
  currency_code: string;
  description: string;
  capture_method: string;
  /** Statement period the movement falls in but is missing from. */
  period_from: string;
  period_to: string;
  /**
   * True when the row reached the ledger AFTER that statement was imported:
   * its balance delta is live on the account (the statement did not overwrite
   * it), so deleting it must reverse the delta.
   */
  balance_delta_live: boolean;
};

type SnapshotPeriod = {
  account_id: string;
  currency_code: string;
  period_from: string;
  period_to: string;
  updated_at: string;
};

export async function fetchStatementTrayRows(
  supabase: SupabaseClient<Database>,
  userId: string,
  options: {
    /** Demo mode shows demo cards only, real mode real cards only. */
    isDemo: boolean;
    accountIds?: string[];
    /** Only rows inside these periods (one import's statements). */
    periods?: StatementTrayPeriod[];
  },
): Promise<{ rows: StatementTrayRow[]; truncated: boolean }> {
  let accountsQuery = supabase
    .from("accounts")
    .select("id, name, account_type")
    .eq("user_id", userId)
    .eq("is_demo", options.isDemo)
    .eq("account_type", "CREDIT_CARD");
  if (options.accountIds && options.accountIds.length > 0) {
    accountsQuery = accountsQuery.in("id", options.accountIds);
  }
  const { data: cards, error: accountsError } = await accountsQuery;
  if (accountsError) throw accountsError;
  if (!cards || cards.length === 0) return { rows: [], truncated: false };
  const cardIds = cards.map((c) => c.id);
  const cardName = new Map(cards.map((c) => [c.id, c.name as string | null]));

  const { data: snapshots, error: snapshotsError } = await supabase
    .from("statement_snapshots")
    .select("account_id, currency_code, period_from, period_to, updated_at")
    .eq("user_id", userId)
    .in("account_id", cardIds)
    .not("period_from", "is", null)
    .not("period_to", "is", null);
  if (snapshotsError) throw snapshotsError;
  const allPeriods = (snapshots ?? []).filter(
    (s): s is SnapshotPeriod => s.period_from != null && s.period_to != null,
  );
  // The "following statement" test below must see every snapshot; the scope
  // filter only decides which periods may put rows in the tray.
  const scope = options.periods;
  const periods = scope
    ? allPeriods.filter((p) =>
        scope.some(
          (q) =>
            q.accountId === p.account_id &&
            q.currencyCode === p.currency_code &&
            q.periodFrom === p.period_from &&
            q.periodTo === p.period_to,
        ),
      )
    : allPeriods;
  if (periods.length === 0) return { rows: [], truncated: false };

  const from = periods.reduce((min, p) => (p.period_from < min ? p.period_from : min), periods[0].period_from);
  const to = periods.reduce((max, p) => (p.period_to > max ? p.period_to : max), periods[0].period_to);
  // Last day of each period the tray may judge: the full period when the next
  // statement is already imported, otherwise the period minus the grace days.
  const effectiveTo = new Map<SnapshotPeriod, string>();
  for (const p of periods) {
    const hasFollowing = allPeriods.some(
      (q) => q !== p && q.account_id === p.account_id && q.currency_code === p.currency_code && q.period_from >= p.period_to,
    );
    effectiveTo.set(p, hasFollowing ? p.period_to : shiftIsoDate(p.period_to, -STATEMENT_TRAY_CUTOFF_GRACE_DAYS));
  }

  const [{ data: rows, error: rowsError }, { data: dismissals, error: dismissalsError }] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, account_id, transaction_date, amount, currency_code, merchant_name, clean_description, raw_description, capture_method, personal_debt_id, split_group_id, created_at",
      )
      .eq("user_id", userId)
      .in("account_id", cardIds)
      .in("capture_method", [...STATEMENT_TRAY_CAPTURE_METHODS])
      .eq("direction", "OUTFLOW")
      .is("reconciled_into_transaction_id", null)
      .is("transfer_group_id", null)
      .eq("is_excluded", false)
      .gte("transaction_date", from)
      .lte("transaction_date", to)
      .order("transaction_date", { ascending: false })
      .limit(STATEMENT_TRAY_LIMIT + 1),
    supabase.from("statement_tray_dismissals").select("transaction_id").eq("user_id", userId),
  ]);
  if (rowsError) throw rowsError;
  if (dismissalsError) throw dismissalsError;
  const dismissed = new Set((dismissals ?? []).map((d) => d.transaction_id));

  // A row that pays a recurring occurrence must not vanish from under it
  // (the FK only nulls transaction_id and the occurrence would stay "paid").
  const candidateIds = (rows ?? []).map((r) => r.id);
  const linkedToOccurrence = new Set<string>();
  if (candidateIds.length > 0) {
    const { data: occurrences, error: occurrencesError } = await supabase
      .from("recurring_occurrences")
      .select("transaction_id")
      .eq("user_id", userId)
      .in("transaction_id", candidateIds);
    if (occurrencesError) throw occurrencesError;
    for (const o of occurrences ?? []) if (o.transaction_id) linkedToOccurrence.add(o.transaction_id);
  }

  const out: StatementTrayRow[] = [];
  for (const row of rows ?? []) {
    if (dismissed.has(row.id)) continue;
    if (linkedToOccurrence.has(row.id)) continue;
    // Debt-linked and shared rows have side tables hanging off them; the
    // tray's one-tap delete must not orphan those.
    if (row.personal_debt_id || row.split_group_id) continue;
    const period = periods.find(
      (p) =>
        p.account_id === row.account_id &&
        p.currency_code === row.currency_code &&
        row.transaction_date >= p.period_from &&
        row.transaction_date <= (effectiveTo.get(p) ?? p.period_to),
    );
    if (!period) continue;
    out.push({
      id: row.id,
      account_id: row.account_id,
      account_name: cardName.get(row.account_id) ?? null,
      transaction_date: row.transaction_date,
      amount: Number(row.amount),
      currency_code: row.currency_code,
      description: row.merchant_name ?? row.clean_description ?? row.raw_description ?? "",
      capture_method: row.capture_method,
      period_from: period.period_from,
      period_to: period.period_to,
      balance_delta_live: row.created_at > period.updated_at,
    });
  }
  const truncated = out.length > STATEMENT_TRAY_LIMIT;
  return { rows: truncated ? out.slice(0, STATEMENT_TRAY_LIMIT) : out, truncated };
}

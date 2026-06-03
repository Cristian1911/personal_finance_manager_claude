/**
 * Pure decision logic for the personal-debts (Personas) feature. Framework-free
 * so both webapp and mobile share one source of truth. String-literal unions
 * mirror the DB enums (personal_debt_direction, personal_debt_status, pd_role)
 * without importing generated types.
 */
export type PersonalDebtDirection = "borrowed" | "lent";
export type PersonalDebtStatus = "active" | "settled" | "cancelled";
export type PdRole = "origin" | "repayment";
// Local (not exported) — `TransactionDirection` is already exported by
// ./types/domain; re-exporting it here would make the @zeta/shared barrel
// ambiguous (TS2308).
type TransactionDirection = "INFLOW" | "OUTFLOW";

/**
 * Auto-infer the pd_role when linking a transaction to a personal debt.
 * borrowed+INFLOW = origin (loan received), lent+OUTFLOW = origin (money given);
 * everything else is a repayment.
 */
export function inferPersonalDebtRole(
  debtDirection: PersonalDebtDirection,
  txDirection: TransactionDirection,
): PdRole {
  const isOrigin =
    (debtDirection === "borrowed" && txDirection === "INFLOW") ||
    (debtDirection === "lent" && txDirection === "OUTFLOW");
  return isOrigin ? "origin" : "repayment";
}

export interface OutstandingResult {
  outstanding: number;
  status: PersonalDebtStatus;
}

/**
 * outstanding = principal - sum(repayments), clamped at 0. Derives 'settled'
 * when outstanding reaches 0, else 'active'. (Cancelled is a manual lifecycle
 * action and is never inferred here.)
 */
export function computeOutstanding(
  principal: number,
  linkedRepayments: number[],
): OutstandingResult {
  const repaid = linkedRepayments.reduce((sum, n) => sum + n, 0);
  const outstanding = Math.max(0, principal - repaid);
  return { outstanding, status: outstanding <= 0 ? "settled" : "active" };
}

/**
 * A debt is overdue when it has a due_date strictly before today and is still
 * active. Compares ISO date strings (YYYY-MM-DD) lexicographically — safe and
 * avoids the new Date("YYYY-MM-DD") UTC-midnight footgun.
 */
export function isPersonalDebtOverdue(
  dueDate: string | null,
  status: PersonalDebtStatus,
  today: string,
): boolean {
  if (!dueDate || status !== "active") return false;
  return dueDate < today;
}

/**
 * The single income/spend-exclusion predicate, reused by every cashflow site.
 * A transaction is an "origin" (the cash that created the debt) only when it is
 * linked AND its role is 'origin'; repayments count as normal cashflow.
 */
export function isPersonalDebtOrigin(tx: {
  personal_debt_id: string | null;
  pd_role: PdRole | null;
}): boolean {
  return tx.personal_debt_id != null && tx.pd_role === "origin";
}

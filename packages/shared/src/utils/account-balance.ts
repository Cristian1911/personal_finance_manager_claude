import type { AccountType, TransactionDirection } from "../types/domain";

const DEBT_ACCOUNT_TYPES = new Set<AccountType>(["CREDIT_CARD", "LOAN"]);

export function isDebtAccountType(accountType: string): accountType is AccountType {
  return DEBT_ACCOUNT_TYPES.has(accountType as AccountType);
}

/**
 * An INFLOW to a credit card or loan is a payment against debt, never income.
 * Promoted from `mobile/lib/transaction-semantics.ts`, which had the only named
 * helper for a rule the rest of the codebase kept re-inlining.
 *
 * Null-tolerant because callers read it off joined rows where the account may
 * not have been selected.
 */
export function isDebtInflow(params: {
  direction: string | null | undefined;
  accountType: string | null | undefined;
}): boolean {
  return (
    params.direction === "INFLOW" &&
    params.accountType != null &&
    isDebtAccountType(params.accountType)
  );
}

export function applyAccountBalanceDelta(params: {
  currentBalance: number;
  accountType: string;
  direction: TransactionDirection;
  amount: number;
}): number {
  // Supabase returns numeric columns as strings — coerce to avoid string concat.
  const balance = Number(params.currentBalance);
  const amount = Number(params.amount);

  if (isDebtAccountType(params.accountType)) {
    if (params.direction === "INFLOW") return balance - amount;
    return balance + amount;
  }

  if (params.direction === "INFLOW") return balance + amount;
  return balance - amount;
}

export function reverseAccountBalanceDelta(params: {
  currentBalance: number;
  accountType: string;
  direction: TransactionDirection;
  amount: number;
}): number {
  return applyAccountBalanceDelta({
    ...params,
    direction: params.direction === "INFLOW" ? "OUTFLOW" : "INFLOW",
  });
}

export function getDirectionForBalanceDelta(params: {
  accountType: string;
  delta: number;
}): TransactionDirection | null {
  if (params.delta === 0) return null;

  if (isDebtAccountType(params.accountType)) {
    return params.delta > 0 ? "OUTFLOW" : "INFLOW";
  }

  return params.delta > 0 ? "INFLOW" : "OUTFLOW";
}

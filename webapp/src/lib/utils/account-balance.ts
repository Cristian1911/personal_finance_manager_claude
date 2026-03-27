import type { AccountType, TransactionDirection } from "@/types/domain";

const DEBT_ACCOUNT_TYPES = new Set<AccountType>(["CREDIT_CARD", "LOAN"]);

export function isDebtAccountType(accountType: string): accountType is AccountType {
  return DEBT_ACCOUNT_TYPES.has(accountType as AccountType);
}

export function applyAccountBalanceDelta(params: {
  currentBalance: number;
  accountType: string;
  direction: TransactionDirection;
  amount: number;
}): number {
  if (isDebtAccountType(params.accountType)) {
    if (params.direction === "INFLOW") return params.currentBalance - params.amount;
    return params.currentBalance + params.amount;
  }

  if (params.direction === "INFLOW") return params.currentBalance + params.amount;
  return params.currentBalance - params.amount;
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

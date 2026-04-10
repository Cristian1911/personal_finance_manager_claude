import { DEBT_ACCOUNT_TYPES } from "../constants/accounts";

interface MinimalTransaction {
  amount: number;
  direction: string;
  account_id: string;
  is_excluded: number | boolean;
}

interface MinimalAccount {
  id: string;
  account_type: string;
}

export interface CashflowResult {
  totalInflow: number;
  totalOutflow: number;
  net: number;
}

/**
 * Compute monthly cashflow from transactions and accounts.
 * Excludes debt inflows (INFLOW to CREDIT_CARD/LOAN) per project rules.
 */
export function computeCashflow(
  transactions: MinimalTransaction[],
  accounts: MinimalAccount[]
): CashflowResult {
  const debtAccountIds = new Set(
    accounts.filter((a) => DEBT_ACCOUNT_TYPES.has(a.account_type)).map((a) => a.id)
  );

  let totalInflow = 0;
  let totalOutflow = 0;

  for (const tx of transactions) {
    if (tx.is_excluded) continue;
    const amount = Math.abs(tx.amount);
    if (tx.direction === "INFLOW" && !debtAccountIds.has(tx.account_id)) {
      totalInflow += amount;
    } else if (tx.direction === "OUTFLOW") {
      totalOutflow += amount;
    }
  }

  return { totalInflow, totalOutflow, net: totalInflow - totalOutflow };
}

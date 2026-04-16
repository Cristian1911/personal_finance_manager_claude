import { DEBT_ACCOUNT_TYPES } from "../constants/accounts";

interface MinimalTransaction {
  amount: number;
  direction: string;
  account_id: string;
  is_excluded: number | boolean;
  transfer_group_id?: string | null;
  reconciled_into_transaction_id?: string | null;
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
    if (tx.transfer_group_id) continue; // exclude internal transfers
    if (tx.reconciled_into_transaction_id) continue; // exclude reconciled dupes
    const amount = Math.abs(tx.amount);
    if (tx.direction === "INFLOW" && !debtAccountIds.has(tx.account_id)) {
      totalInflow += amount;
    } else if (tx.direction === "OUTFLOW") {
      totalOutflow += amount;
    }
  }

  return { totalInflow, totalOutflow, net: totalInflow - totalOutflow };
}

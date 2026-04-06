import type { DebtAccount } from "./debt";

export interface ExtraPaymentAllocation {
  accountId: string;
  accountName: string;
  interestRate: number;
  currentBalance: number;
  allocatedAmount: number;
  newBalance: number;
  locked: boolean;
}

/**
 * Allocate a lump sum across selected debt accounts using avalanche strategy
 * (highest interest rate first). Respects manual overrides (locked amounts).
 */
export function allocateExtraPayment(input: {
  totalAmount: number;
  accounts: DebtAccount[];
  selectedIds: string[];
  manualOverrides?: Map<string, number>;
}): ExtraPaymentAllocation[] {
  const { totalAmount, accounts, selectedIds, manualOverrides } = input;

  const selected = accounts.filter((a) => selectedIds.includes(a.id));
  if (selected.length === 0) return [];

  // Subtract locked amounts from available pool
  let available = totalAmount;
  const lockedAmounts = new Map<string, number>();

  if (manualOverrides) {
    for (const [accountId, amount] of manualOverrides) {
      if (selectedIds.includes(accountId)) {
        const account = selected.find((a) => a.id === accountId);
        if (account) {
          const capped = Math.min(amount, account.balance);
          lockedAmounts.set(accountId, capped);
          available -= capped;
        }
      }
    }
  }

  available = Math.max(available, 0);

  // Sort unlocked accounts by interest rate descending (avalanche)
  const unlocked = selected
    .filter((a) => !lockedAmounts.has(a.id))
    .sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0));

  // Allocate remaining pool to unlocked accounts
  const allocations = new Map<string, number>();
  let pool = available;

  for (const account of unlocked) {
    if (pool <= 0) {
      allocations.set(account.id, 0);
      continue;
    }
    const payment = Math.min(pool, account.balance);
    allocations.set(account.id, payment);
    pool -= payment;
  }

  // Build result array
  return selected.map((account) => {
    const locked = lockedAmounts.has(account.id);
    const allocatedAmount = locked
      ? lockedAmounts.get(account.id)!
      : (allocations.get(account.id) ?? 0);

    return {
      accountId: account.id,
      accountName: account.name,
      interestRate: account.interestRate ?? 0,
      currentBalance: account.balance,
      allocatedAmount,
      newBalance: account.balance - allocatedAmount,
      locked,
    };
  });
}

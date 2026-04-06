import type { DebtAccount } from "./debt";
import { estimateMonthlyInterest } from "./debt";
import { runScenario } from "./scenario-engine";
import type { ScenarioAllocations } from "./scenario-types";

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

export interface ExtraPaymentImpact {
  monthlyInterestBefore: number;
  monthlyInterestAfter: number;
  monthlyInterestSaved: number;
  monthsToDebtFreeBefore: number;
  monthsToDebtFreeAfter: number;
  monthsSaved: number;
  totalInterestSavedOverLife: number;
}

export function computeExtraPaymentImpact(input: {
  accounts: DebtAccount[];
  allocations: ExtraPaymentAllocation[];
}): ExtraPaymentImpact {
  const { accounts, allocations } = input;

  const allocationMap = new Map(
    allocations.map((a) => [a.accountId, a.allocatedAmount])
  );

  let monthlyInterestBefore = 0;
  let monthlyInterestAfter = 0;

  for (const account of accounts) {
    const interest = estimateMonthlyInterest(account.balance, account.interestRate);
    monthlyInterestBefore += interest;

    const allocated = allocationMap.get(account.id) ?? 0;
    const newBalance = account.balance - allocated;
    monthlyInterestAfter += estimateMonthlyInterest(newBalance, account.interestRate);
  }

  const monthlyInterestSaved = monthlyInterestBefore - monthlyInterestAfter;

  const now = new Date();
  const startMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const emptyAllocations: ScenarioAllocations = {
    manualOverrides: [],
    cascadeRedirects: [],
  };

  const activeAccounts = accounts.filter((a) => a.balance > 0);
  if (activeAccounts.length === 0) {
    return {
      monthlyInterestBefore: 0,
      monthlyInterestAfter: 0,
      monthlyInterestSaved: 0,
      monthsToDebtFreeBefore: 0,
      monthsToDebtFreeAfter: 0,
      monthsSaved: 0,
      totalInterestSavedOverLife: 0,
    };
  }

  const resultBefore = runScenario({
    accounts: activeAccounts,
    cashEntries: [],
    strategy: "avalanche",
    allocations: emptyAllocations,
    startMonth,
  });

  const accountsAfter = activeAccounts
    .map((a) => {
      const allocated = allocationMap.get(a.id) ?? 0;
      const newBalance = a.balance - allocated;
      if (newBalance <= 0) return null;
      return { ...a, balance: newBalance };
    })
    .filter((a): a is DebtAccount => a !== null);

  const resultAfter =
    accountsAfter.length > 0
      ? runScenario({
          accounts: accountsAfter,
          cashEntries: [],
          strategy: "avalanche",
          allocations: emptyAllocations,
          startMonth,
        })
      : { totalMonths: 0, totalInterestPaid: 0 };

  return {
    monthlyInterestBefore,
    monthlyInterestAfter,
    monthlyInterestSaved,
    monthsToDebtFreeBefore: resultBefore.totalMonths,
    monthsToDebtFreeAfter: resultAfter.totalMonths,
    monthsSaved: resultBefore.totalMonths - resultAfter.totalMonths,
    totalInterestSavedOverLife:
      resultBefore.totalInterestPaid - resultAfter.totalInterestPaid,
  };
}

"use server";

import { cache } from "react";
import { getLatestDebtSnapshots } from "@/actions/debt-snapshots";
import type { CurrencyCode } from "@/types/domain";

export interface DebtProgressAccount {
  id: string;
  name: string;
  currentBalance: number;
  initialAmount: number | null;
  progressPercent: number;
  currency: CurrencyCode;
}

export const getDebtProgress = cache(
  async (currency?: CurrencyCode): Promise<DebtProgressAccount[]> => {
    const baseCurrency = currency ?? "COP";

    const { debtAccounts: allDebtAccounts, snapshotsByAccount } =
      await getLatestDebtSnapshots();

    const debtAccounts = allDebtAccounts.filter(
      (a: { currency_code: string }) => a.currency_code === baseCurrency
    );

    if (debtAccounts.length === 0) return [];

    return debtAccounts.map((account: { id: string; name: string; current_balance: number; currency_code: string }): DebtProgressAccount => {
      const snap = snapshotsByAccount.get(account.id);
      const currentBalance = snap?.remaining_balance ?? Math.abs(account.current_balance);
      const initialAmount = snap?.initial_amount ?? null;

      let progressPercent = 0;
      if (initialAmount != null && initialAmount > 0) {
        progressPercent = Math.min(
          100,
          Math.max(0, ((initialAmount - currentBalance) / initialAmount) * 100)
        );
      }

      return {
        id: account.id,
        name: account.name,
        currentBalance,
        initialAmount,
        progressPercent,
        currency: baseCurrency,
      };
    });
  }
);

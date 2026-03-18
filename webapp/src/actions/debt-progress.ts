"use server";

import { cache } from "react";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { getAccounts } from "@/actions/accounts";
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
    const { supabase, user } = await getAuthenticatedClient();
    if (!user) return [];

    const baseCurrency = currency ?? "COP";

    // Get all active debt accounts in the target currency
    const accountsResult = await getAccounts();
    if (!accountsResult.success || !accountsResult.data) return [];

    const debtAccounts = accountsResult.data.filter(
      (a) =>
        (a.account_type === "CREDIT_CARD" || a.account_type === "LOAN") &&
        a.currency_code === baseCurrency
    );

    if (debtAccounts.length === 0) return [];

    const accountIds = debtAccounts.map((a) => a.id);

    // Fetch latest snapshot per debt account
    const { data: snapshots } = await supabase
      .from("statement_snapshots")
      .select("account_id, remaining_balance, initial_amount, period_to")
      .eq("user_id", user.id)
      .in("account_id", accountIds)
      .order("period_to", { ascending: false });

    // Group: keep only most recent snapshot per account
    const latestByAccount = new Map<
      string,
      { remaining_balance: number | null; initial_amount: number | null }
    >();
    for (const snap of snapshots ?? []) {
      if (!latestByAccount.has(snap.account_id)) {
        latestByAccount.set(snap.account_id, snap);
      }
    }

    return debtAccounts.map((account): DebtProgressAccount => {
      const snap = latestByAccount.get(account.id);
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

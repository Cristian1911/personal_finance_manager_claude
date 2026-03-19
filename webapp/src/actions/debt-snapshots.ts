"use server";

import { cache } from "react";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { getAccounts } from "./accounts";

export interface LatestDebtSnapshot {
  account_id: string;
  interest_rate: number | null;
  minimum_payment: number | null;
  total_payment_due: number | null;
  remaining_balance: number | null;
  initial_amount: number | null;
  period_to: string;
}

export const getLatestDebtSnapshots = cache(async () => {
  const accountsResult = await getAccounts();
  const accounts = accountsResult.success ? accountsResult.data : [];
  const debtAccounts = accounts.filter((a: { account_type: string }) =>
    a.account_type === "CREDIT_CARD" || a.account_type === "LOAN"
  );

  const snapshotsByAccount = new Map<string, LatestDebtSnapshot>();
  if (debtAccounts.length === 0) return { debtAccounts, snapshotsByAccount };

  const { supabase, user } = await getAuthenticatedClient();
  const ids = debtAccounts.map((a: { id: string }) => a.id);

  const { data: snapshots } = await supabase
    .from("statement_snapshots")
    .select("account_id, interest_rate, minimum_payment, total_payment_due, remaining_balance, initial_amount, period_to")
    .in("account_id", ids)
    .eq("user_id", user!.id)
    .order("period_to", { ascending: false })
    .limit(ids.length * 3);

  for (const snap of snapshots ?? []) {
    if (!snapshotsByAccount.has(snap.account_id)) {
      snapshotsByAccount.set(snap.account_id, snap as LatestDebtSnapshot);
    }
  }

  return { debtAccounts, snapshotsByAccount };
});

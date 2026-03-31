"use server";

import { cache } from "react";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import type { ImpactEvent, ImpactEventMetrics } from "@/types/domain";
import { calcUtilization, estimateMonthlyInterest } from "@zeta/shared";

interface SnapshotRow {
  account_id: string;
  period_to: string | null;
  remaining_balance: number | null;
  final_balance: number | null;
  credit_limit: number | null;
  available_credit: number | null;
  interest_rate: number | null;
  currency_code: string;
}

interface AccountInfo {
  id: string;
  name: string;
  account_type: string;
  currency_code: string;
}

function getBalance(snap: SnapshotRow): number {
  return snap.remaining_balance ?? snap.final_balance ?? 0;
}

function estimateMonthsToFreedom(
  balance: number,
  creditLimit: number | null
): number | null {
  if (balance <= 0) return 0;
  const monthlyPayment = (creditLimit ?? balance) * 0.03;
  if (monthlyPayment <= 0) return null;
  return Math.ceil(Math.abs(balance) / monthlyPayment);
}

function buildMetrics(
  prev: SnapshotRow,
  curr: SnapshotRow,
  accountType: string
): ImpactEventMetrics | null {
  const prevBalance = Math.abs(getBalance(prev));
  const currBalance = Math.abs(getBalance(curr));
  const metrics: ImpactEventMetrics = {};
  let hasMetric = false;

  // Utilization (credit cards only)
  if (accountType === "CREDIT_CARD" && curr.credit_limit && curr.credit_limit > 0) {
    const utilBefore = calcUtilization(prevBalance, curr.credit_limit);
    const utilAfter = calcUtilization(currBalance, curr.credit_limit);
    if (Math.abs(utilBefore - utilAfter) >= 1) {
      metrics.utilizationBefore = Math.round(utilBefore);
      metrics.utilizationAfter = Math.round(utilAfter);
      hasMetric = true;
    }
  }

  // Monthly interest
  const rate = curr.interest_rate ?? prev.interest_rate;
  if (rate && rate > 0) {
    const interestBefore = estimateMonthlyInterest(prevBalance, rate);
    const interestAfter = estimateMonthlyInterest(currBalance, rate);
    if (interestBefore - interestAfter >= 100) {
      metrics.monthlyInterestBefore = Math.round(interestBefore);
      metrics.monthlyInterestAfter = Math.round(interestAfter);
      hasMetric = true;
    }
  }

  // Available credit (credit cards only)
  if (
    accountType === "CREDIT_CARD" &&
    prev.available_credit != null &&
    curr.available_credit != null
  ) {
    const diff = curr.available_credit - prev.available_credit;
    if (diff > 0) {
      metrics.availableCreditBefore = prev.available_credit;
      metrics.availableCreditAfter = curr.available_credit;
      hasMetric = true;
    }
  }

  // Months to freedom
  const creditLimit = curr.credit_limit ?? prev.credit_limit;
  const monthsBefore = estimateMonthsToFreedom(prevBalance, creditLimit);
  const monthsAfter = estimateMonthsToFreedom(currBalance, creditLimit);
  if (monthsBefore != null && monthsAfter != null && monthsBefore - monthsAfter >= 1) {
    metrics.monthsToFreedomBefore = monthsBefore;
    metrics.monthsToFreedomAfter = monthsAfter;
    hasMetric = true;
  }

  return hasMetric ? metrics : null;
}

export const getRecentImpactEvents = cache(async (limit = 3): Promise<ImpactEvent[]> => {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];

  // 1. Get debt accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, account_type, currency_code")
    .eq("user_id", user.id)
    .in("account_type", ["CREDIT_CARD", "LOAN"])
    .eq("is_active", true);

  if (!accounts || accounts.length === 0) return [];

  const accountMap = new Map<string, AccountInfo>();
  for (const a of accounts) {
    accountMap.set(a.id, a);
  }
  const accountIds = accounts.map((a) => a.id);

  // 2. Get snapshots for debt accounts, ordered by period_to ascending
  const { data: snapshots } = await supabase
    .from("statement_snapshots")
    .select(
      "account_id, period_to, remaining_balance, final_balance, credit_limit, available_credit, interest_rate, currency_code"
    )
    .eq("user_id", user.id)
    .in("account_id", accountIds)
    .order("period_to", { ascending: true });

  if (!snapshots || snapshots.length < 2) return [];

  // 3. Group by account_id
  const grouped = new Map<string, SnapshotRow[]>();
  for (const snap of snapshots) {
    const list = grouped.get(snap.account_id) ?? [];
    list.push(snap as SnapshotRow);
    grouped.set(snap.account_id, list);
  }

  // 4. Compare consecutive pairs and build events
  const events: ImpactEvent[] = [];

  for (const [accountId, snaps] of grouped) {
    const account = accountMap.get(accountId);
    if (!account || snaps.length < 2) continue;

    for (let i = 1; i < snaps.length; i++) {
      const prev = snaps[i - 1];
      const curr = snaps[i];

      const prevBalance = getBalance(prev);
      const currBalance = getBalance(curr);

      // Skip if balance didn't decrease (not a positive event)
      if (Math.abs(currBalance) >= Math.abs(prevBalance)) continue;

      const amountPaid = Math.abs(Math.abs(prevBalance) - Math.abs(currBalance));
      if (amountPaid <= 0) continue;

      const metrics = buildMetrics(prev, curr, account.account_type);
      if (!metrics) continue;

      events.push({
        accountId,
        accountName: account.name,
        accountType: account.account_type,
        date: curr.period_to ?? "",
        amountPaid,
        currencyCode: (curr.currency_code ?? account.currency_code) as string,
        metrics,
      });
    }
  }

  // 5. Sort by date descending, return top N
  events.sort((a, b) => b.date.localeCompare(a.date));
  return events.slice(0, limit);
});

export const getAccountImpactEvents = cache(
  async (accountId: string): Promise<ImpactEvent[]> => {
    const events = await getRecentImpactEvents(50);
    return events.filter((e) => e.accountId === accountId);
  }
);

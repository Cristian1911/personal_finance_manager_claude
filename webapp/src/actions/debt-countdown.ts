"use server";

import { cacheTag, cacheLife } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMonthParam } from "@/lib/utils/date";
import type { CurrencyCode } from "@/types/domain";

export interface DebtCountdownData {
  monthsToFree: number;
  projectedDate: string; // YYYY-MM
  totalDebt: number;
  originalDebt: number; // sum of initial_amounts from snapshots
  progressPercent: number;
  extraPaymentScenario: {
    extraAmount: number;
    monthsToFree: number;
    monthsSaved: number;
    interestSaved: number;
  } | null;
  currency: CurrencyCode;
  incompleteAccounts: string[]; // account names with missing data
}

// ─── Cached inner function ────────────────────────────────────────────────────

async function getDebtFreeCountdownCached(
  userId: string,
  currency: CurrencyCode
): Promise<DebtCountdownData | null> {
  "use cache";
  cacheTag("debt", "snapshots");
  cacheLife("zeta");

  const supabase = createAdminClient();

  // Fetch debt accounts + latest snapshots in parallel
  // Snapshots not filtered by account_id (unknown until accounts query resolves) — acceptable trade-off for parallelism
  const [{ data: accounts }, { data: snapshots }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, account_type, current_balance, monthly_payment, currency_code")
      .eq("user_id", userId)
      .eq("is_active", true)
      .in("account_type", ["CREDIT_CARD", "LOAN"]),
    supabase
      .from("statement_snapshots")
      .select("account_id, minimum_payment, remaining_balance, initial_amount")
      .eq("user_id", userId)
      .order("period_to", { ascending: false }),
  ]);

  const debtAccounts = (accounts ?? []).filter((a) => a.currency_code === currency);
  if (debtAccounts.length === 0) return null;

  // Build latest snapshot per account
  const latestSnap = new Map<string, NonNullable<typeof snapshots>[number]>();
  for (const snap of snapshots ?? []) {
    if (!latestSnap.has(snap.account_id)) {
      latestSnap.set(snap.account_id, snap);
    }
  }

  // 2. Simple arithmetic — no amortization simulation
  let totalDebt = 0;
  let totalMonthlyPayment = 0;
  let originalDebt = 0;
  const incompleteAccounts: string[] = [];

  for (const account of debtAccounts) {
    const snap = latestSnap.get(account.id);
    const balance = snap?.remaining_balance ?? Math.abs(account.current_balance);
    const payment = snap?.minimum_payment ?? account.monthly_payment ?? 0;

    if (balance <= 0) continue;

    totalDebt += balance;
    totalMonthlyPayment += payment;
    originalDebt += snap?.initial_amount ?? balance;

    if (!payment) {
      incompleteAccounts.push(account.name);
    }
  }

  if (totalDebt <= 0 || totalMonthlyPayment <= 0) return null;

  const monthsToFree = Math.ceil(totalDebt / totalMonthlyPayment);

  // Projected payoff date
  const now = new Date();
  const projectedDate = formatMonthParam(
    new Date(now.getFullYear(), now.getMonth() + monthsToFree, 1)
  );

  // Progress
  const progressPercent =
    originalDebt > 0
      ? Math.min(100, Math.max(0, ((originalDebt - totalDebt) / originalDebt) * 100))
      : 0;

  // Extra payment scenario: 10% of total monthly payment
  let extraPaymentScenario: DebtCountdownData["extraPaymentScenario"] = null;
  const extraAmount = Math.ceil(totalMonthlyPayment * 0.1);
  if (extraAmount > 0) {
    const monthsWithExtra = Math.ceil(totalDebt / (totalMonthlyPayment + extraAmount));
    const monthsSaved = monthsToFree - monthsWithExtra;
    if (monthsSaved > 0) {
      extraPaymentScenario = {
        extraAmount,
        monthsToFree: monthsWithExtra,
        monthsSaved,
        interestSaved: 0, // precise interest calc lives in /deudas/planificador
      };
    }
  }

  return {
    monthsToFree,
    projectedDate,
    totalDebt,
    originalDebt,
    progressPercent,
    extraPaymentScenario,
    currency,
    incompleteAccounts,
  };
}

// ─── Public wrapper ──────────────────────────────────────────────────────────

export async function getDebtFreeCountdown(
  currency?: CurrencyCode
): Promise<DebtCountdownData | null> {
  const baseCurrency = currency ?? "COP";
  const { user } = await getAuthenticatedClient();
  if (!user) return null;

  try {
    return await getDebtFreeCountdownCached(user.id, baseCurrency);
  } catch (error) {
    console.error("Error computing debt countdown:", error);
    return null;
  }
}

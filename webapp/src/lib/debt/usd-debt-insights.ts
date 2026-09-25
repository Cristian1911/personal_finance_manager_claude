import { addMonths, differenceInCalendarDays, getDaysInMonth } from "date-fns";
import { isDebtAccountType } from "@/lib/utils/account-balance";
import { getTrackedCurrencyBalances } from "@/lib/utils/currency-balances";
import type { Account, CurrencyCode } from "@/types/domain";
import type { RatePoint } from "@/lib/fx/rate-sources";

/**
 * Pure analysis behind /deudas/dolares: where today's rate sits in its
 * recent range, what the foreign-currency debt costs at today's rate vs the
 * average / best recent day, and one deterministic recommendation.
 */

/** ±% vs the 30-day average that counts as a cheap / expensive day. */
export const FX_TIMING_THRESHOLD_PCT = 2;

export type FxTiming = "barato" | "normal" | "caro";

export interface FxRangeStats {
  /** Days of history behind the stats. */
  days: number;
  min: RatePoint;
  max: RatePoint;
  avg30d: number | null;
  avg90d: number;
  /** 0 = today is the cheapest day in the window, 100 = the most expensive. */
  percentile: number;
  percentVsAvg30d: number | null;
  timing: FxTiming;
}

export interface ForeignDebtAccount {
  id: string;
  name: string;
  /** Outstanding balance in the foreign currency. */
  balance: number;
  paymentDay: number | null;
  /** Next payment date (YYYY-MM-DD) and days until it, when payment_day is set. */
  nextPaymentDate: string | null;
  daysToPayment: number | null;
}

export interface ForeignDebtCost {
  total: number;
  /** Cost in local currency at each reference rate. */
  atToday: number;
  atAvg30d: number | null;
  atMin: number;
  atMax: number;
  /** atToday − atAvg30d: negative = paying today saves vs the average. */
  vsAvg30d: number | null;
  /** Local-currency change per 100 units of rate movement. */
  per100: number;
}

export function computeRangeStats(
  history: RatePoint[],
  rate: number,
  avg30d: number | null,
): FxRangeStats | null {
  if (history.length < 2) return null;
  let min = history[0];
  let max = history[0];
  let sum = 0;
  for (const p of history) {
    if (p.rate < min.rate) min = p;
    if (p.rate > max.rate) max = p;
    sum += p.rate;
  }
  const below = history.filter((p) => p.rate < rate).length;
  const percentile = Math.round((below / history.length) * 100);
  const percentVsAvg30d = avg30d ? ((rate - avg30d) / avg30d) * 100 : null;
  const timing: FxTiming =
    percentVsAvg30d === null
      ? percentile <= 25
        ? "barato"
        : percentile >= 75
          ? "caro"
          : "normal"
      : percentVsAvg30d <= -FX_TIMING_THRESHOLD_PCT
        ? "barato"
        : percentVsAvg30d >= FX_TIMING_THRESHOLD_PCT
          ? "caro"
          : "normal";
  return {
    days: history.length,
    min,
    max,
    avg30d,
    avg90d: sum / history.length,
    percentile,
    percentVsAvg30d,
    timing,
  };
}

/** Next occurrence of `paymentDay` on or after `today` (clamped to month length). */
export function nextPaymentDate(paymentDay: number, today: string): string {
  const base = new Date(`${today}T12:00:00`);
  const inMonth = (d: Date) => {
    const copy = new Date(d);
    copy.setDate(Math.min(paymentDay, getDaysInMonth(d)));
    return copy;
  };
  let candidate = inMonth(base);
  if (candidate.getDate() < base.getDate()) {
    const next = addMonths(new Date(base.getFullYear(), base.getMonth(), 1, 12), 1);
    candidate = inMonth(next);
  }
  const y = candidate.getFullYear();
  const m = String(candidate.getMonth() + 1).padStart(2, "0");
  const d = String(candidate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Outstanding debt per foreign currency (≠ base) across cards/loans. */
export function getForeignDebtTotals(
  accounts: Account[],
  baseCurrency: CurrencyCode,
): Map<CurrencyCode, number> {
  const totals = new Map<CurrencyCode, number>();
  for (const account of accounts) {
    if (!isDebtAccountType(account.account_type)) continue;
    const balances = getTrackedCurrencyBalances({
      currencyCode: account.currency_code,
      currentBalance: account.current_balance ?? 0,
      currencyBalances: account.currency_balances,
    });
    for (const { currency, currentBalance } of balances) {
      if (currency === baseCurrency || currentBalance <= 0) continue;
      totals.set(currency, (totals.get(currency) ?? 0) + currentBalance);
    }
  }
  return totals;
}

/** The foreign currency with the largest debt, or null when there's none. */
export function largestForeignDebt(
  accounts: Account[],
  baseCurrency: CurrencyCode,
): [CurrencyCode, number] | null {
  let best: [CurrencyCode, number] | null = null;
  for (const entry of getForeignDebtTotals(accounts, baseCurrency)) {
    if (!best || entry[1] > best[1]) best = entry;
  }
  return best;
}

/** Debt accounts with an outstanding balance in `currency`, largest first. */
export function getForeignDebtAccounts(
  accounts: Account[],
  currency: CurrencyCode,
  today: string,
): ForeignDebtAccount[] {
  const rows: ForeignDebtAccount[] = [];
  for (const account of accounts) {
    if (!isDebtAccountType(account.account_type)) continue;
    const balance = getTrackedCurrencyBalances({
      currencyCode: account.currency_code,
      currentBalance: account.current_balance ?? 0,
      currencyBalances: account.currency_balances,
    }).find((b) => b.currency === currency)?.currentBalance;
    if (!balance || balance <= 0) continue;
    const paymentDay =
      account.payment_day && account.payment_day >= 1 && account.payment_day <= 31
        ? account.payment_day
        : null;
    const next = paymentDay ? nextPaymentDate(paymentDay, today) : null;
    rows.push({
      id: account.id,
      name: account.name,
      balance,
      paymentDay,
      nextPaymentDate: next,
      daysToPayment: next
        ? differenceInCalendarDays(new Date(`${next}T12:00:00`), new Date(`${today}T12:00:00`))
        : null,
    });
  }
  return rows.sort((a, b) => b.balance - a.balance);
}

export function computeForeignDebtCost(
  total: number,
  rate: number,
  stats: FxRangeStats | null,
): ForeignDebtCost {
  const atToday = total * rate;
  const atAvg30d = stats?.avg30d ? total * stats.avg30d : null;
  return {
    total,
    atToday,
    atAvg30d,
    atMin: total * (stats?.min.rate ?? rate),
    atMax: total * (stats?.max.rate ?? rate),
    vsAvg30d: atAvg30d !== null ? atToday - atAvg30d : null,
    per100: total * 100,
  };
}

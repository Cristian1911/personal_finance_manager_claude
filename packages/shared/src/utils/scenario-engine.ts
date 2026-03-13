/**
 * Debt scenario planning engine.
 * Builds on the existing simulation functions with support for:
 * - Time-sequenced cash injections
 * - Manual allocation overrides
 * - Interactive cascade control
 * - Calendar-month timeline
 */

import type { DebtAccount } from "./debt";
import { monthlyRateFromEA } from "./debt";
import type {
  CashEntry,
  ScenarioInput,
  ScenarioResult,
  ScenarioMonth,
  ScenarioEvent,
  ScenarioAllocations,
  ScenarioStrategy,
  ScenarioMonthAccount,
  ScenarioPayoffEntry,
} from "./scenario-types";

/**
 * Expand recurring CashEntry items into individual monthly entries.
 * Call this before passing entries to runScenario().
 */
export function expandCashEntries(entries: CashEntry[]): CashEntry[] {
  const result: CashEntry[] = [];

  for (const entry of entries) {
    if (!entry.recurring || entry.recurring.months <= 1) {
      const { recurring, ...rest } = entry;
      result.push(rest);
      continue;
    }

    const [yearStr, monthStr] = entry.month.split("-");
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10);

    for (let i = 0; i < entry.recurring.months; i++) {
      const m = String(month).padStart(2, "0");
      result.push({
        id: `${entry.id}-${i}`,
        amount: entry.amount,
        month: `${year}-${m}`,
        label: entry.label,
        currency: entry.currency,
      });

      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
  }

  return result;
}

const MIN_PAYMENT_RATE = 0.05;
const MIN_PAYMENT_FLOORS: Record<string, number> = {
  COP: 50_000,
  USD: 25,
  EUR: 25,
  BRL: 100,
  MXN: 500,
  PEN: 50,
  CLP: 15_000,
  ARS: 5_000,
};
const DEFAULT_FLOOR = 50_000;

/**
 * Get the minimum monthly payment for an account.
 * Uses the account's monthlyPayment if set, otherwise falls back to
 * 5% of balance with a currency-aware floor.
 */
export function getMinPayment(account: DebtAccount): number {
  if (account.monthlyPayment && account.monthlyPayment > 0) {
    return account.monthlyPayment;
  }
  const floor = MIN_PAYMENT_FLOORS[account.currency] ?? DEFAULT_FLOOR;
  return Math.max(account.balance * MIN_PAYMENT_RATE, floor);
}

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

import type { CashflowPoint, ForecastPoint, RecurringObligation } from "./types";

// ponytail: linear projection — avg historical net per month, no seasonality.
// Upgrade path is seasonal decomposition if users find it too naive.
export function forecast(
  history: readonly CashflowPoint[],
  currentBalance: number,
  recurring: readonly RecurringObligation[],
  horizonMonths: readonly string[],
): ForecastPoint[] {
  const avgNet = history.length ? history.reduce((a, p) => a + p.net, 0) / history.length : 0;
  const recByMonth = new Map(recurring.map((r) => [r.month, r.amount]));
  let bal = currentBalance;
  return horizonMonths.map((month) => {
    bal = bal + avgNet - (recByMonth.get(month) ?? 0);
    return { month, balance: Math.round(bal), projected: true };
  });
}

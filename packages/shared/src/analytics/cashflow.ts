import type { AnalyticsConfig, AnalyticsTx, CashflowPoint, SavingsPoint } from "./types";

export function incomeVsExpenseSeries(rows: readonly AnalyticsTx[], cfg: AnalyticsConfig): CashflowPoint[] {
  const idx = new Map(cfg.months.map((m, i) => [m, i]));
  const inc = new Array(cfg.months.length).fill(0);
  const exp = new Array(cfg.months.length).fill(0);
  for (const t of rows) {
    const mi = idx.get(t.date.slice(0, 7));
    if (mi === undefined) continue;
    if (t.direction === "INFLOW" && !cfg.debtAccountIds.has(t.accountId)) inc[mi] += t.amount;
    else if (t.direction === "OUTFLOW") exp[mi] += t.amount;
  }
  return cfg.months.map((month, i) => ({ month, income: inc[i], expense: exp[i], net: inc[i] - exp[i] }));
}

// Pass `cashflow` to reuse an already-computed incomeVsExpenseSeries (avoids recomputation).
export function savingsRateSeries(
  rows: readonly AnalyticsTx[],
  cfg: AnalyticsConfig,
  cashflow?: readonly CashflowPoint[],
): SavingsPoint[] {
  return (cashflow ?? incomeVsExpenseSeries(rows, cfg)).map((p) => ({
    month: p.month,
    income: p.income,
    expense: p.expense,
    rate: p.income === 0 ? null : (p.income - p.expense) / p.income,
  }));
}

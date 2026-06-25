import type { AnalyticsConfig } from "@zeta/shared";
import {
  anomalies,
  budgetAdherenceSeries,
  buildVerdict,
  categorySeries,
  fixedVsVariable,
  forecast,
  incomeVsExpenseSeries,
  movers,
  savingsRateSeries,
  topRecipients,
} from "@zeta/shared";
import { getTendenciasDataset, type TendenciasDataset } from "@/actions/analytics";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";
import type { AnalyticsRange } from "@/lib/analytics/range";
import { TendenciasShell } from "@/components/tendencias/tendencias-shell";
import type { TendenciasViewModel } from "@/components/tendencias/types";

function buildConfig(ds: TendenciasDataset): AnalyticsConfig {
  return {
    months: ds.months,
    debtAccountIds: new Set(ds.debtAccountIds),
    categoryMeta: new Map(ds.categoryMeta),
    destinatarioMeta: new Map(ds.destinatarioMeta),
  };
}

export default async function TendenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; currency?: string }>;
}) {
  const sp = await searchParams;
  const range = (sp.range as AnalyticsRange) ?? "6M";
  const currency = (sp.currency as CurrencyCode) ?? "COP";
  const ds = await getTendenciasDataset(range, currency);
  const config = buildConfig(ds);
  const { rows } = ds;

  const cats = categorySeries(rows, config);
  const cashflow = incomeVsExpenseSeries(rows, config);
  const savings = savingsRateSeries(rows, config, cashflow);
  const moverList = movers(cats);
  const n = Math.max(cashflow.length, 1);
  const avgIncome = cashflow.reduce((a, p) => a + p.income, 0) / n;
  const avgExpense = cashflow.reduce((a, p) => a + p.expense, 0) / n;
  const fmt = (x: number) => formatCurrency(x, currency);

  const vm: TendenciasViewModel = {
    range: typeof range === "string" ? range : "custom",
    currency,
    months: config.months,
    verdict: buildVerdict({ savings, movers: moverList, avgExpense, avgIncome }, fmt),
    gastos: {
      // Cap at top-20 by spend to bound the RSC payload (list shows 8, movers/anomalies use full `cats`).
      categories: cats.slice(0, 20),
      recipients: topRecipients(rows, config),
      fixedVariable: fixedVsVariable(rows, config),
    },
    ahorro: { savings, cashflow, adherence: budgetAdherenceSeries(rows, config, cats) },
    cambios: {
      movers: moverList,
      anomalies: anomalies(rows, config, cats),
      forecast: forecast(cashflow, ds.currentBalance, ds.recurring, ds.horizonMonths),
      currentBalance: ds.currentBalance,
    },
  };

  return <TendenciasShell vm={vm} />;
}

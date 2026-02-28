import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import {
  formatDate,
  parseMonth,
  subMonths,
  formatMonthParam,
  monthStartStr,
  monthEndStr,
  formatMonthLabel,
} from "@/lib/utils/date";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  FileUp,
  Landmark,
  Sparkles,
  Tags,
  Target,
  TrendingDown,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  getCategorySpending,
  getMonthlyCashflow,
  getDailySpending,
  getDailyCashflow,
  getMonthMetrics,
  getNetWorthHistory,
} from "@/actions/charts";
import { getBudgetSummary } from "@/actions/budgets";
import { getCategories } from "@/actions/categories";
import { CategorySpendingChart } from "@/components/charts/category-spending-chart";
import { MonthlyCashflowChart } from "@/components/charts/monthly-cashflow-chart";
import { DailySpendingChart } from "@/components/charts/daily-spending-chart";
import { EnhancedCashflowChart } from "@/components/charts/enhanced-cashflow-chart";
import { NetWorthHistoryChart } from "@/components/charts/net-worth-history-chart";
import { InteractiveMetricCard } from "@/components/dashboard/interactive-metric-card";
import { PurchaseDecisionCard } from "@/components/dashboard/purchase-decision-card";
import { MonthSelector } from "@/components/month-selector";
import { UpcomingRecurringCard } from "@/components/recurring/upcoming-recurring-card";
import { getUpcomingRecurrences } from "@/actions/recurring-templates";
import { getUpcomingPayments } from "@/actions/payment-reminders";
import { PaymentRemindersCard } from "@/components/dashboard/payment-reminders-card";
import { computeDebtBalance } from "@venti5/shared";
import { trackProductEvent } from "@/actions/product-events";
import { executeVisibleTransactionQuery } from "@/lib/utils/transactions";
import { getUserSafely } from "@/lib/supabase/auth";

type DashboardTransactionRow = {
  id: string;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  account_id: string;
  merchant_name?: string | null;
  clean_description?: string | null;
  transaction_date?: string;
  currency_code?: string;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const month = params.month;
  const target = parseMonth(month);
  const monthLabel = formatMonthLabel(target);

  const supabase = await createClient();
  const user = await getUserSafely(supabase);

  if (!user) return null;

  // Fetch accounts
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .order("display_order");

  // Fetch recent transactions (exclude excluded ones)
  const { data: recentTransactions } = await executeVisibleTransactionQuery(() =>
    supabase
      .from("transactions")
      .select("*")
      .eq("is_excluded", false)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5)
  );

  const { count: uncategorizedCount, error: uncategorizedError } =
    await executeVisibleTransactionQuery(() =>
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .is("category_id", null)
      .eq("is_excluded", false)
  );
  if (uncategorizedError?.message) {
    console.warn("Dashboard uncategorized count unavailable:", uncategorizedError.message);
  }

  // Fetch selected month's transactions for summary (exclude excluded ones)
  const { data: monthTransactions } = await executeVisibleTransactionQuery(() =>
    supabase
      .from("transactions")
      .select("amount, direction, account_id")
      .eq("is_excluded", false)
      .gte("transaction_date", monthStartStr(target))
      .lte("transaction_date", monthEndStr(target))
  );

  // Fetch previous month param for trend calculation
  const prevMonthParam = formatMonthParam(subMonths(target, 1));

  // Fetch chart data + previous month metrics + upcoming recurring in parallel
  const [
    categoryData,
    cashflowData,
    dailyData,
    dailyCashflowData,
    prevMetrics,
    upcomingRecurrences,
    upcomingPayments,
    netWorthData,
    budgetData,
    outflowCategories,
  ] = await Promise.all([
    getCategorySpending(month),
    getMonthlyCashflow(month),
    getDailySpending(month),
    getDailyCashflow(month),
    getMonthMetrics(prevMonthParam),
    getUpcomingRecurrences(30),
    getUpcomingPayments(),
    getNetWorthHistory(month),
    getBudgetSummary(month),
    getCategories("OUTFLOW"),
  ]);

  const allAccounts = accounts ?? [];
  const monthTx = (monthTransactions ?? []) as DashboardTransactionRow[];
  const recentTx = (recentTransactions ?? []) as DashboardTransactionRow[];
  const starterMode = allAccounts.length > 0 && recentTx.length === 0;

  // Calculate metrics
  const assetAccounts = allAccounts.filter(
    (a) => a.account_type !== "CREDIT_CARD" && a.account_type !== "LOAN"
  );
  const liabilityAccounts = allAccounts.filter(
    (a) => a.account_type === "CREDIT_CARD" || a.account_type === "LOAN"
  );

  const debtAccountIds = new Set(liabilityAccounts.map((a) => a.id));

  const totalAssets = assetAccounts.reduce((sum, a) => sum + a.current_balance, 0);
  const totalLiabilities = liabilityAccounts.reduce(
    (sum, a) => sum + computeDebtBalance(a),
    0
  );
  const netWorth = totalAssets - totalLiabilities;

  const monthIncome = monthTx
    .filter((t) => t.direction === "INFLOW" && !debtAccountIds.has(t.account_id))
    .reduce((sum, t) => sum + t.amount, 0);

  const monthExpenses = monthTx
    .filter((t) => t.direction === "OUTFLOW")
    .reduce((sum, t) => sum + t.amount, 0);

  const monthDebtPayments = monthTx
    .filter((t) => t.direction === "INFLOW" && debtAccountIds.has(t.account_id))
    .reduce((sum, t) => sum + t.amount, 0);

  const savingsRate =
    monthIncome > 0 ? ((monthIncome - monthExpenses) / monthIncome) * 100 : 0;

  // Trend calculations
  function computeTrend(current: number, previous: number) {
    if (previous === 0) return { direction: "neutral" as const, percentage: 0 };
    const pct = ((current - previous) / previous) * 100;
    return {
      direction: (pct > 0 ? "up" : pct < 0 ? "down" : "neutral") as
        | "up"
        | "down"
        | "neutral",
      percentage: Math.abs(pct),
    };
  }

  const incomeTrend = computeTrend(monthIncome, prevMetrics.income);
  // For expenses: spending going up is bad → invert direction semantics
  const rawExpenseTrend = computeTrend(monthExpenses, prevMetrics.expenses);
  const expensesTrend = {
    ...rawExpenseTrend,
    direction: (rawExpenseTrend.direction === "up"
      ? "down"
      : rawExpenseTrend.direction === "down"
        ? "up"
        : "neutral") as "up" | "down" | "neutral",
  };

  // Per-account breakdowns for detail dialogs
  const accountBreakdown = allAccounts.map((a) => ({
    label: a.name,
    value: formatCurrency(a.current_balance, a.currency_code),
    href: `/accounts`,
  }));

  const netWorthInsight =
    totalLiabilities > 0
      ? `Activos: ${formatCurrency(totalAssets)} | Deudas: ${formatCurrency(totalLiabilities)}`
      : undefined;
  const monthNet = monthIncome - monthExpenses;
  const budgetConfigured = budgetData.totalTarget > 0;
  const budgetPressureHigh = budgetConfigured && budgetData.progress >= 90;
  const cashflowPressure = monthIncome > 0 && monthExpenses > monthIncome;
  const uncategorizedTotal = uncategorizedCount ?? 0;

  await trackProductEvent({
    event_name: "dashboard_viewed",
    flow: "dashboard",
    step: "main",
    entry_point: "direct",
    success: true,
    metadata: {
      starter_mode: starterMode,
      month: monthLabel,
      uncategorized_count: uncategorizedTotal,
    },
  });

  if (!starterMode && recentTx.length > 0) {
    await trackProductEvent({
      event_name: "first_financial_insight_rendered",
      flow: "dashboard",
      step: "main",
      entry_point: "direct",
      success: true,
      metadata: {
        recent_transactions_count: recentTx.length,
        accounts_count: allAccounts.length,
      },
    });
  }

  if (starterMode) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Tu base ya está lista. Falta activar tu flujo.</p>
          </div>
        </div>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Primeros pasos recomendados
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Link
              href="/import"
              className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <FileUp className="h-4 w-4 text-primary" />
                Importar extracto PDF
              </div>
              <p className="text-sm text-muted-foreground">
                Carga tus movimientos reales para activar métricas, categorías y alertas.
              </p>
            </Link>
            <Link
              href="/transactions"
              className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <WalletCards className="h-4 w-4 text-primary" />
                Registrar primer movimiento
              </div>
              <p className="text-sm text-muted-foreground">
                Si aún no tienes PDF, crea movimientos manuales para empezar.
              </p>
            </Link>
            <Link
              href="/categorizar"
              className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Tags className="h-4 w-4 text-primary" />
                Definir categorías base
              </div>
              <p className="text-sm text-muted-foreground">
                Etiqueta tus primeras compras para entrenar sugerencias automáticas.
              </p>
            </Link>
            <Link
              href="/categories"
              className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Landmark className="h-4 w-4 text-primary" />
                Crear presupuesto mensual
              </div>
              <p className="text-sm text-muted-foreground">
                Establece límites desde el inicio para detectar desvíos temprano.
              </p>
            </Link>
          </CardContent>
          <CardContent className="pt-0">
            <Link href="/import">
              <Button className="gap-2">
                Empezar ahora
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Resumen de tus finanzas</p>
        </div>
        <Suspense>
          <MonthSelector />
        </Suspense>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InteractiveMetricCard
          type="net-worth"
          data={{
            label: "Patrimonio Neto",
            value: netWorth,
            insight: netWorthInsight,
          }}
          details={{
            title: "Desglose por cuenta",
            items: accountBreakdown,
          }}
        />
        <InteractiveMetricCard
          type="income"
          data={{
            label: "Ingresos del mes",
            value: monthIncome,
          }}
          trend={incomeTrend}
        />
        <InteractiveMetricCard
          type="expenses"
          data={{
            label: "Gastos del mes",
            value: monthExpenses,
            alert:
              monthExpenses > monthIncome && monthIncome > 0
                ? "Gastos superan ingresos"
                : undefined,
          }}
          trend={expensesTrend}
        />
        <InteractiveMetricCard
          type="savings-rate"
          data={{
            label: "Tasa de Ahorro",
            value: savingsRate,
            insight:
              savingsRate > 0
                ? `Estás ahorrando ${savingsRate.toFixed(0)}% de tus ingresos`
                : monthIncome > 0
                  ? "Tus gastos superan tus ingresos este mes"
                  : undefined,
          }}
        />
        {budgetData.totalTarget > 0 && (
          <InteractiveMetricCard
            type="budget"
            data={{
              label: "Presupuesto Mensual",
              value: budgetData.totalSpent,
              target: budgetData.totalTarget,
              progress: budgetData.progress,
              alert: budgetData.progress >= 100
                ? "Has superado tu presupuesto límite"
                : budgetData.progress >= 80
                  ? "Te acercas al límite de tu presupuesto mensual"
                  : undefined,
            }}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className={cashflowPressure ? "border-red-500/30" : "border-emerald-500/30"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Control de flujo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold">
              {monthNet >= 0 ? "+" : "-"}
              {formatCurrency(Math.abs(monthNet))}
            </p>
            <p className="text-sm text-muted-foreground">
              {cashflowPressure
                ? "Tus gastos van por encima de tus ingresos este mes."
                : "Tu flujo mensual está positivo."}
            </p>
            <Link href="/transactions" className="text-xs text-primary hover:underline">
              Revisar salidas mayores
            </Link>
          </CardContent>
        </Card>

        <Card className={budgetPressureHigh ? "border-amber-500/30" : undefined}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ejecución de presupuesto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold">
              {budgetConfigured ? `${Math.round(budgetData.progress)}%` : "Sin meta"}
            </p>
            <p className="text-sm text-muted-foreground">
              {budgetConfigured
                ? budgetPressureHigh
                  ? "Estás cerca del límite mensual."
                  : "Vas dentro de un ritmo controlado."
                : "Configura una meta para anticipar desvíos."}
            </p>
            <Link href="/categories" className="text-xs text-primary hover:underline">
              {budgetConfigured ? "Ajustar categorías y metas" : "Configurar presupuesto"}
            </Link>
          </CardContent>
        </Card>

        <Card className={uncategorizedTotal > 0 ? "border-blue-500/30" : undefined}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Calidad de datos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold">{uncategorizedTotal}</p>
            <p className="text-sm text-muted-foreground">
              {uncategorizedTotal > 0
                ? "Transacciones sin categoría impactan reportes y alertas."
                : "Todo está categorizado y listo para análisis."}
            </p>
            <Link href="/categorizar" className="text-xs text-primary hover:underline">
              {uncategorizedTotal > 0 ? "Limpiar pendientes" : "Abrir inbox de categorías"}
            </Link>
          </CardContent>
        </Card>
      </div>

      <PurchaseDecisionCard
        accounts={allAccounts}
        categories={outflowCategories.success ? outflowCategories.data ?? [] : []}
        defaultMonth={month ?? formatMonthParam(target)}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Plan de acción</CardTitle>
          <span className="text-xs text-muted-foreground">
            Prioriza estas tareas para mejorar resultados
          </span>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Link
            href="/categorizar"
            className="rounded-lg border p-3 hover:bg-accent/50 transition-colors"
          >
            <div className="mb-2 flex items-center gap-2">
              <Tags className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Ordenar categorías</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {uncategorizedTotal > 0
                ? `${uncategorizedTotal} pendientes para mejorar tus insights`
                : "Sin pendientes actuales"}
            </p>
          </Link>
          <Link
            href="/deudas"
            className="rounded-lg border p-3 hover:bg-accent/50 transition-colors"
          >
            <div className="mb-2 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Reducir costo de deuda</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {totalLiabilities > 0
                ? `Saldo activo: ${formatCurrency(totalLiabilities)}`
                : "No tienes deudas registradas"}
            </p>
          </Link>
          <Link
            href="/categories"
            className="rounded-lg border p-3 hover:bg-accent/50 transition-colors"
          >
            <div className="mb-2 flex items-center gap-2">
              {budgetPressureHigh ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              ) : (
                <Target className="h-4 w-4 text-primary" />
              )}
              <p className="text-sm font-medium">Corregir ritmo mensual</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {budgetConfigured
                ? `Consumo actual: ${Math.round(budgetData.progress)}% del presupuesto`
                : "Sin presupuesto definido"}
            </p>
          </Link>
        </CardContent>
      </Card>

      {/* Charts */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Análisis</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <NetWorthHistoryChart data={netWorthData} />
          </div>
          <CategorySpendingChart data={categoryData} monthLabel={monthLabel} />
          <EnhancedCashflowChart data={dailyCashflowData} monthLabel={monthLabel} />
          <DailySpendingChart data={dailyData} monthLabel={monthLabel} />
          <MonthlyCashflowChart data={cashflowData} monthLabel={monthLabel} />
        </div>
      </div>

      {/* Debt Summary Card (if there are liabilities) */}
      {totalLiabilities > 0 && (
        <Card className="border-amber-500/20">
          <CardContent className="pt-6">
            <Link href="/deudas" className="flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Landmark className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Deuda total</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(totalLiabilities)}
                  </p>
                </div>
              </div>
              <span className="text-sm text-primary group-hover:underline">
                Ver detalles
              </span>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Upcoming recurring and payments */}
      <div className="grid gap-6 lg:grid-cols-2">
        <UpcomingRecurringCard upcoming={upcomingRecurrences} />
        {upcomingPayments.length > 0 && (
          <PaymentRemindersCard payments={upcomingPayments} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Accounts Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Cuentas</CardTitle>
            <Link
              href="/accounts"
              className="text-sm text-primary hover:underline"
            >
              Ver todas
            </Link>
          </CardHeader>
          <CardContent>
            {allAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No tienes cuentas registradas.{" "}
                <Link href="/accounts" className="text-primary hover:underline">
                  Crear una
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {allAccounts.slice(0, 5).map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: account.color ?? "#6366f1" }}
                      />
                      <span className="text-sm font-medium">
                        {account.name}
                      </span>
                    </div>
                    <span className="text-sm font-medium">
                      {formatCurrency(
                        account.current_balance,
                        account.currency_code
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Últimas transacciones</CardTitle>
            <Link
              href="/transactions"
              className="text-sm text-primary hover:underline"
            >
              Ver todas
            </Link>
          </CardHeader>
          <CardContent>
            {!recentTransactions || recentTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay transacciones aún.{" "}
                <Link
                  href="/transactions"
                  className="text-primary hover:underline"
                >
                  Registrar una
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {recentTx.map((tx) => (
                  <Link
                    key={tx.id}
                    href={`/transactions/${tx.id}`}
                    className="flex items-center justify-between hover:bg-muted rounded-md px-2 py-1 -mx-2 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {tx.direction === "INFLOW" ? (
                        <ArrowDownLeft className="h-4 w-4 text-green-500" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-orange-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {tx.merchant_name ||
                            tx.clean_description ||
                            "Sin descripción"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tx.transaction_date ? formatDate(tx.transaction_date) : "Sin fecha"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-medium ${tx.direction === "INFLOW" ? "text-green-600" : ""}`}
                    >
                      {tx.direction === "INFLOW" ? "+" : "-"}
                      {formatCurrency(tx.amount, tx.currency_code as Parameters<typeof formatCurrency>[1])}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

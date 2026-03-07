import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import {
  formatDate,
  parseMonth,
  formatMonthParam,
  formatMonthLabel,
} from "@/lib/utils/date";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  FileUp,
  Landmark,
  Sparkles,
  Tags,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  getDashboardHeroData,
  getAccountsWithSparklineData,
  getDailyBudgetPace,
  getCategorySpending,
  getMonthlyCashflow,
} from "@/actions/charts";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { UpcomingPayments } from "@/components/dashboard/upcoming-payments";
import { AccountsOverview } from "@/components/dashboard/accounts-overview";
import { BudgetPaceChart } from "@/components/charts/budget-pace-chart";
import { IncomeVsExpensesChart } from "@/components/charts/income-vs-expenses-chart";
import { CategorySpendingChart } from "@/components/charts/category-spending-chart";
import { MonthSelector } from "@/components/month-selector";
import { trackProductEvent } from "@/actions/product-events";
import { getUserSafely } from "@/lib/supabase/auth";
import { executeVisibleTransactionQuery } from "@/lib/utils/transactions";

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

  // Fetch recent transactions
  const { data: recentTransactions } = await executeVisibleTransactionQuery(() =>
    supabase
      .from("transactions")
      .select("*")
      .eq("is_excluded", false)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5)
  );

  // Check if user has accounts (for starter mode)
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id")
    .eq("is_active", true)
    .limit(1);

  const recentTx = (recentTransactions ?? []) as DashboardTransactionRow[];
  const hasAccounts = (accounts ?? []).length > 0;
  const starterMode = hasAccounts && recentTx.length === 0;

  await trackProductEvent({
    event_name: "dashboard_viewed",
    flow: "dashboard",
    step: "main",
    entry_point: "direct",
    success: true,
    metadata: {
      starter_mode: starterMode,
      month: monthLabel,
    },
  });

  if (starterMode) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Tu base ya esta lista. Falta activar tu flujo.</p>
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
                Carga tus movimientos reales para activar metricas, categorias y alertas.
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
                Si aun no tienes PDF, crea movimientos manuales para empezar.
              </p>
            </Link>
            <Link
              href="/categorizar"
              className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Tags className="h-4 w-4 text-primary" />
                Definir categorias base
              </div>
              <p className="text-sm text-muted-foreground">
                Etiqueta tus primeras compras para entrenar sugerencias automaticas.
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
                Establece limites desde el inicio para detectar desvios temprano.
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

  // Fetch all dashboard data in parallel
  const [heroData, accountsData, budgetPaceData, cashflowData, categoryData] =
    await Promise.all([
      getDashboardHeroData(month),
      getAccountsWithSparklineData(),
      getDailyBudgetPace(month),
      getMonthlyCashflow(month),
      getCategorySpending(month),
    ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Tu centro de comando financiero</p>
        </div>
        <Suspense>
          <MonthSelector />
        </Suspense>
      </div>

      {/* 1. Hero — "Tu dinero ahora" */}
      <DashboardHero data={heroData} />

      {/* 2. Payments + Accounts side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <UpcomingPayments
          obligations={heroData.pendingObligations}
          totalPending={heroData.totalPending}
        />
        <AccountsOverview data={accountsData} />
      </div>

      {/* 3. Analysis */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Analisis</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <BudgetPaceChart
            data={budgetPaceData.data}
            totalBudget={budgetPaceData.totalBudget}
            totalSpent={budgetPaceData.totalSpent}
            monthLabel={monthLabel}
          />
          <IncomeVsExpensesChart data={cashflowData} monthLabel={monthLabel} />
          <CategorySpendingChart data={categoryData} monthLabel={monthLabel} />
        </div>
      </div>

      {/* 4. Recent Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Ultimas transacciones</CardTitle>
          <Link
            href="/transactions"
            className="text-sm text-primary hover:underline"
          >
            Ver todas
          </Link>
        </CardHeader>
        <CardContent>
          {recentTx.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay transacciones aun.{" "}
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
                          "Sin descripcion"}
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
  );
}

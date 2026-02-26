"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils/currency";
import {
  type DebtAccount,
  compareStrategies,
  allocateLumpSum,
  simulateSingleAccount,
  type SimulationComparison,
  type LumpSumResult,
  type SingleAccountResult,
  type PayoffStrategy,
} from "@venti5/shared";
import {
  TrendingDown,
  Snowflake,
  Mountain,
  CheckCircle2,
  ArrowRight,
  Wallet,
  CalendarClock,
} from "lucide-react";

interface Props {
  accounts: DebtAccount[];
}

// ─── Tab 1: Lump Sum ───

function LumpSumTab({ accounts }: Props) {
  const [input, setInput] = useState("");
  const amount = Number(input) || 0;

  const result = useMemo<LumpSumResult | null>(() => {
    if (amount <= 0) return null;
    return allocateLumpSum(accounts, amount);
  }, [accounts, amount]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Tengo plata extra
          </CardTitle>
          <CardDescription>
            Ingresa el monto que tienes disponible y te recomendamos a qué deuda
            destinarlo para ahorrar más en intereses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              min={0}
              step={100000}
              placeholder="1,000,000"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="pl-7"
            />
          </div>
        </CardContent>
      </Card>

      {result && result.allocations.some((a) => a.payment > 0) && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribución recomendada</CardTitle>
              <CardDescription>
                Priorizando la tasa más alta para maximizar el ahorro
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {result.allocations
                  .filter((a) => a.payment > 0)
                  .map((a) => (
                    <div
                      key={a.accountId}
                      className="flex items-center gap-3 p-3 rounded-lg border"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {a.accountName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.interestRate.toFixed(1)}% EA
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-green-600">
                          Abonar {formatCurrency(a.payment)}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground justify-end">
                          <span>{formatCurrency(a.currentBalance)}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="font-medium text-foreground">
                            {formatCurrency(a.newBalance)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-emerald-500/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <TrendingDown className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-700">
                    Ahorras{" "}
                    <strong>
                      {formatCurrency(result.totalMonthlyInterestSaved)}
                    </strong>{" "}
                    al mes en intereses
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Interés mensual: {formatCurrency(result.totalMonthlyInterestBefore)}{" "}
                    → {formatCurrency(result.totalMonthlyInterestAfter)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Tab 2: Single Account Extra Payment ───

function SingleAccountTab({ accounts }: Props) {
  const [selectedId, setSelectedId] = useState(accounts[0]?.id ?? "");
  const [input, setInput] = useState("");
  const extraPayment = Number(input) || 0;

  const selectedAccount = accounts.find((a) => a.id === selectedId);

  const result = useMemo<SingleAccountResult | null>(() => {
    if (!selectedAccount || extraPayment <= 0) return null;
    return simulateSingleAccount(selectedAccount, extraPayment);
  }, [selectedAccount, extraPayment]);

  const chartConfig = {
    withoutExtra: {
      label: "Solo mínimo",
      color: "var(--chart-1)",
    },
    withExtra: {
      label: "Con pago extra",
      color: "var(--chart-2)",
    },
  } satisfies ChartConfig;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Pago extra mensual
          </CardTitle>
          <CardDescription>
            Selecciona una cuenta y mira qué pasa si le abonas más cada mes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Cuenta</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full max-w-xs rounded-md border bg-background px-3 py-2 text-sm"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {formatCurrency(a.balance)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Pago extra mensual
            </label>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                min={0}
                step={50000}
                placeholder="200,000"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          {/* Impact summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted-foreground mb-1">Tiempo de pago</p>
                <p className="text-2xl font-bold">
                  {result.monthsWithExtra}{" "}
                  <span className="text-sm font-normal text-muted-foreground">meses</span>
                </p>
                {result.monthsSaved > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    {result.monthsSaved} meses menos
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted-foreground mb-1">Intereses que pagarías</p>
                <p className="text-2xl font-bold text-amber-600">
                  {formatCurrency(result.interestWithExtra)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  vs {formatCurrency(result.interestWithoutExtra)} solo con mínimo
                </p>
              </CardContent>
            </Card>
            <Card className="border-green-500/20">
              <CardContent className="pt-6 text-center">
                <p className="text-xs text-muted-foreground mb-1">Te ahorras</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(result.interestSaved)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">en intereses</p>
              </CardContent>
            </Card>
          </div>

          {/* Timeline chart */}
          {result.timeline.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Proyección de saldo</CardTitle>
                <CardDescription>
                  {result.accountName}: solo mínimo vs con pago extra
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={chartConfig}
                  className="aspect-auto h-[300px] w-full overflow-hidden"
                >
                  <AreaChart data={result.timeline} accessibilityLayer>
                    <defs>
                      <linearGradient id="fillWithout" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-withoutExtra)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-withoutExtra)" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="fillWith" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-withExtra)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-withExtra)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      interval="preserveStartEnd"
                      label={{
                        value: "Meses",
                        position: "insideBottom",
                        offset: -4,
                        className: "text-xs fill-muted-foreground",
                      }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={4}
                      tickFormatter={(v) => {
                        if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                        if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
                        return String(v);
                      }}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload as { month: number; withoutExtra: number; withExtra: number };
                        return (
                          <div className="rounded-lg border bg-background p-2.5 shadow-sm text-xs">
                            <p className="font-medium mb-1.5">Mes {d.month}</p>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--color-withoutExtra)" }} />
                                <span className="text-muted-foreground">Solo mínimo:</span>
                                <span className="font-medium ml-auto">{formatCurrency(d.withoutExtra)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--color-withExtra)" }} />
                                <span className="text-muted-foreground">Con extra:</span>
                                <span className="font-medium ml-auto">{formatCurrency(d.withExtra)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Area type="monotone" dataKey="withoutExtra" stroke="var(--color-withoutExtra)" fill="url(#fillWithout)" strokeWidth={2} />
                    <Area type="monotone" dataKey="withExtra" stroke="var(--color-withExtra)" fill="url(#fillWith)" strokeWidth={2} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab 3: Snowball vs Avalanche (original) ───

const STRATEGY_LABELS: Record<PayoffStrategy, string> = {
  snowball: "Bola de Nieve",
  avalanche: "Avalancha",
};

const strategyChartConfig = {
  baseline: { label: "Solo mínimo", color: "var(--chart-3)" },
  snowball: { label: "Bola de Nieve", color: "var(--chart-1)" },
  avalanche: { label: "Avalancha", color: "var(--chart-2)" },
} satisfies ChartConfig;

function StrategiesTab({ accounts }: Props) {
  const [extraPaymentInput, setExtraPaymentInput] = useState("");
  const extraPayment = Number(extraPaymentInput) || 0;

  const totalMinPayments = accounts.reduce(
    (sum, a) => sum + (a.monthlyPayment ?? Math.max(a.balance * 0.02, 10000)),
    0
  );
  const totalDebt = accounts.reduce((sum, a) => sum + a.balance, 0);

  const comparison = useMemo<SimulationComparison | null>(() => {
    if (extraPayment <= 0) return null;
    return compareStrategies(accounts, extraPayment);
  }, [accounts, extraPayment]);

  const chartData = useMemo(() => {
    if (!comparison) return [];
    const maxLen = Math.max(
      comparison.baseline.timeline.length,
      comparison.snowball.timeline.length,
      comparison.avalanche.timeline.length
    );
    const data: { month: string; baseline: number; snowball: number; avalanche: number }[] = [];
    for (let i = 0; i < maxLen; i++) {
      data.push({
        month: `${i + 1}`,
        baseline: comparison.baseline.timeline[i]?.totalBalance ?? 0,
        snowball: comparison.snowball.timeline[i]?.totalBalance ?? 0,
        avalanche: comparison.avalanche.timeline[i]?.totalBalance ?? 0,
      });
    }
    return data;
  }, [comparison]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tus deudas</CardTitle>
          <CardDescription>Resumen de tus deudas activas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-medium">Cuenta</th>
                  <th className="text-right py-2 font-medium">Saldo</th>
                  <th className="text-right py-2 font-medium">Tasa</th>
                  <th className="text-right py-2 font-medium">Pago mín.</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        {a.color && (
                          <div
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: a.color }}
                          />
                        )}
                        <span className="font-medium">{a.name}</span>
                      </div>
                    </td>
                    <td className="text-right py-2.5">
                      {formatCurrency(a.balance)}
                    </td>
                    <td className="text-right py-2.5">
                      {a.interestRate != null
                        ? `${a.interestRate.toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="text-right py-2.5">
                      {a.monthlyPayment != null
                        ? formatCurrency(a.monthlyPayment)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold border-t">
                  <td className="py-2.5">Total</td>
                  <td className="text-right py-2.5">
                    {formatCurrency(totalDebt)}
                  </td>
                  <td />
                  <td className="text-right py-2.5">
                    {formatCurrency(totalMinPayments)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-6 pt-4 border-t">
            <label htmlFor="extra-payment-strat" className="block text-sm font-medium mb-1.5">
              Pago extra mensual
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              Monto adicional que puedes destinar cada mes a tus deudas, por
              encima de los pagos mínimos.
            </p>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="extra-payment-strat"
                type="number"
                min={0}
                step={10000}
                placeholder="0"
                value={extraPaymentInput}
                onChange={(e) => setExtraPaymentInput(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {comparison && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <StrategyCard
              label="Bola de Nieve"
              description="Paga primero la deuda más pequeña"
              icon={<Snowflake className="h-5 w-5" />}
              months={comparison.snowball.totalMonths}
              totalInterest={comparison.snowball.totalInterestPaid}
              totalPaid={comparison.snowball.totalAmountPaid}
              isRecommended={comparison.bestStrategy === "snowball"}
            />
            <StrategyCard
              label="Avalancha"
              description="Paga primero la deuda con mayor tasa"
              icon={<Mountain className="h-5 w-5" />}
              months={comparison.avalanche.totalMonths}
              totalInterest={comparison.avalanche.totalInterestPaid}
              totalPaid={comparison.avalanche.totalAmountPaid}
              isRecommended={comparison.bestStrategy === "avalanche"}
            />
          </div>

          {comparison.interestSaved !== 0 && (
            <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-emerald-500/5">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <TrendingDown className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-700">
                      Con{" "}
                      <strong>{STRATEGY_LABELS[comparison.bestStrategy]}</strong>{" "}
                      ahorras{" "}
                      <strong>
                        {formatCurrency(Math.abs(comparison.interestSaved))}
                      </strong>{" "}
                      en intereses
                      {comparison.monthsDifference !== 0 && (
                        <>
                          {" "}y{" "}
                          <strong>
                            {Math.abs(comparison.monthsDifference)} mes
                            {Math.abs(comparison.monthsDifference) !== 1 ? "es" : ""}
                          </strong>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Proyección de saldo</CardTitle>
                <CardDescription>
                  Saldo total restante mes a mes con cada estrategia
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={strategyChartConfig}
                  className="aspect-auto h-[300px] w-full overflow-hidden"
                >
                  <AreaChart data={chartData} accessibilityLayer>
                    <defs>
                      <linearGradient id="fillBaseline" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-baseline)" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="var(--color-baseline)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="fillSnowball" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-snowball)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-snowball)" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="fillAvalanche" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-avalanche)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-avalanche)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      interval="preserveStartEnd"
                      label={{
                        value: "Meses",
                        position: "insideBottom",
                        offset: -4,
                        className: "text-xs fill-muted-foreground",
                      }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={4}
                      tickFormatter={(v) => {
                        if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                        if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
                        return String(v);
                      }}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload as { month: string; baseline: number; snowball: number; avalanche: number };
                        return (
                          <div className="rounded-lg border bg-background p-2.5 shadow-sm text-xs">
                            <p className="font-medium mb-1.5">Mes {d.month}</p>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--color-baseline)" }} />
                                <span className="text-muted-foreground">Solo mínimo:</span>
                                <span className="font-medium ml-auto">{formatCurrency(d.baseline)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--color-snowball)" }} />
                                <span className="text-muted-foreground">Bola de Nieve:</span>
                                <span className="font-medium ml-auto">{formatCurrency(d.snowball)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--color-avalanche)" }} />
                                <span className="text-muted-foreground">Avalancha:</span>
                                <span className="font-medium ml-auto">{formatCurrency(d.avalanche)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Area type="monotone" dataKey="baseline" stroke="var(--color-baseline)" fill="url(#fillBaseline)" strokeWidth={1.5} strokeDasharray="4 4" />
                    <Area type="monotone" dataKey="snowball" stroke="var(--color-snowball)" fill="url(#fillSnowball)" strokeWidth={2} />
                    <Area type="monotone" dataKey="avalanche" stroke="var(--color-avalanche)" fill="url(#fillAvalanche)" strokeWidth={2} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Orden de pago</CardTitle>
              <CardDescription>
                En qué mes se liquida cada deuda con cada estrategia
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 font-medium">Cuenta</th>
                      <th className="text-center py-2 font-medium">Bola de Nieve</th>
                      <th className="text-center py-2 font-medium">Avalancha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => {
                      const snowballMonth = comparison.snowball.payoffOrder.find(
                        (p) => p.accountId === a.id
                      )?.month;
                      const avalancheMonth = comparison.avalanche.payoffOrder.find(
                        (p) => p.accountId === a.id
                      )?.month;
                      return (
                        <tr key={a.id} className="border-b last:border-0">
                          <td className="py-2.5 font-medium">{a.name}</td>
                          <td className="text-center py-2.5">
                            {snowballMonth ? (
                              <span className="inline-flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                Mes {snowballMonth}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="text-center py-2.5">
                            {avalancheMonth ? (
                              <span className="inline-flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                Mes {avalancheMonth}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StrategyCard({
  label,
  description,
  icon,
  months,
  totalInterest,
  totalPaid,
  isRecommended,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  months: number;
  totalInterest: number;
  totalPaid: number;
  isRecommended: boolean;
}) {
  return (
    <Card
      className={
        isRecommended ? "border-green-500/30 ring-1 ring-green-500/20" : ""
      }
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-base">{label}</CardTitle>
          </div>
          {isRecommended && (
            <Badge
              variant="secondary"
              className="bg-green-500/10 text-green-700 border-green-500/20"
            >
              Recomendado
            </Badge>
          )}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Tiempo de pago</span>
          <span className="font-semibold">
            {months} mes{months !== 1 ? "es" : ""}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Total intereses</span>
          <span className="font-semibold text-amber-600">
            {formatCurrency(totalInterest)}
          </span>
        </div>
        <div className="flex justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">Total pagado</span>
          <span className="font-semibold">{formatCurrency(totalPaid)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───

export function DebtSimulator({ accounts }: Props) {
  return (
    <Tabs defaultValue="lump-sum" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="lump-sum">Tengo extra</TabsTrigger>
        <TabsTrigger value="single-account">Una cuenta</TabsTrigger>
        <TabsTrigger value="strategies">Estrategias</TabsTrigger>
      </TabsList>
      <TabsContent value="lump-sum">
        <LumpSumTab accounts={accounts} />
      </TabsContent>
      <TabsContent value="single-account">
        <SingleAccountTab accounts={accounts} />
      </TabsContent>
      <TabsContent value="strategies">
        <StrategiesTab accounts={accounts} />
      </TabsContent>
    </Tabs>
  );
}

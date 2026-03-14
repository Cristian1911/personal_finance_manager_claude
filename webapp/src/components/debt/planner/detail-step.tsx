"use client";

import { useState, useMemo } from "react";
import type {
  DebtAccount,
  ScenarioResult,
  ScenarioMonth,
  ScenarioEvent,
} from "@zeta/shared";
import type { CurrencyCode } from "@zeta/shared";
import type { ScenarioState } from "../scenario-planner";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils/currency";
import {
  CalendarCheck,
  TrendingDown,
  Clock,
  DollarSign,
  Zap,
  ArrowRight,
} from "lucide-react";
import { SalaryTimelineChart } from "@/components/debt/salary-timeline-chart";

interface Props {
  accounts: DebtAccount[];
  scenarios: ScenarioState[];
  results: Record<number, ScenarioResult>;
  baseline: ScenarioResult;
  currency?: CurrencyCode;
  income?: number;
}

const PLAN_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
] as const;

const SPANISH_MONTHS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function formatCalendarMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-");
  const monthIdx = Number(month) - 1;
  return `${SPANISH_MONTHS[monthIdx] ?? month} ${year}`;
}

function formatDebtFreeDate(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("es-CO", { year: "numeric", month: "long" });
}

function abbreviateName(name: string, maxLen = 12): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + "…";
}

function EventBadges({ events }: { events: ScenarioEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {events.map((ev, i) => {
        if (ev.type === "cash_injection") {
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[10px] text-green-700 bg-green-100 rounded px-1.5 py-0.5 font-medium"
            >
              <Zap className="h-2.5 w-2.5" />
              {ev.description}
            </span>
          );
        }
        if (ev.type === "account_paid_off") {
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[10px] text-blue-700 bg-blue-100 rounded px-1.5 py-0.5 font-medium"
            >
              <CalendarCheck className="h-2.5 w-2.5" />
              {ev.description}
            </span>
          );
        }
        if (ev.type === "cascade_redirect") {
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100 rounded px-1.5 py-0.5 font-medium"
            >
              <ArrowRight className="h-2.5 w-2.5" />
              {ev.description}
            </span>
          );
        }
        return null;
      })}
    </div>
  );
}

function rowHighlightClass(events: ScenarioEvent[]): string {
  const types = events.map((e) => e.type);
  if (types.includes("account_paid_off")) return "bg-blue-50/60";
  if (types.includes("cash_injection")) return "bg-green-50/60";
  return "";
}

export function DetailStep({
  accounts,
  scenarios,
  results,
  baseline,
  currency,
  income,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const safeIndex = Math.min(selectedIndex, scenarios.length - 1);
  const scenario = scenarios[safeIndex];
  const result = results[safeIndex];

  // Summary metrics
  const interestSaved = result
    ? Math.max(0, baseline.totalInterestPaid - result.totalInterestPaid)
    : 0;

  // Build area chart data: one series per account for the selected scenario
  const accountIds = useMemo(() => accounts.map((a) => a.id), [accounts]);

  const chartConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {};
    accounts.forEach((a, i) => {
      cfg[`acct_${a.id}`] = {
        label: abbreviateName(a.name, 18),
        color: `var(--chart-${(i % 5) + 1})`,
      };
    });
    return cfg;
  }, [accounts]);

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.timeline.map((m: ScenarioMonth) => {
      const point: Record<string, number | string> = {
        month: formatCalendarMonth(m.calendarMonth),
      };
      for (const acc of m.accounts) {
        point[`acct_${acc.accountId}`] = acc.balanceAfter;
      }
      return point;
    });
  }, [result]);

  if (!scenario || !result) {
    return (
      <div className="text-muted-foreground text-sm p-8 text-center">
        No hay datos para mostrar. Configura un escenario primero.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scenario selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          Ver plan:
        </span>
        <Select
          value={String(safeIndex)}
          onValueChange={(v) => setSelectedIndex(Number(v))}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {scenarios.map((s, i) => (
              <SelectItem key={i} value={String(i)}>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: PLAN_COLORS[i] }}
                  />
                  {s.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Months to debt-free */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-2.5">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">
                  Meses para pagar
                </p>
                <p className="text-2xl font-bold tabular-nums">
                  {result.totalMonths}
                </p>
                <p className="text-xs text-muted-foreground">
                  {result.totalMonths === 1 ? "mes" : "meses"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total interest */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-2.5">
              <DollarSign className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">
                  Total intereses
                </p>
                <p className="text-xl font-bold tabular-nums text-amber-600">
                  {formatCurrency(result.totalInterestPaid, currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Interest saved */}
        <Card
          className={
            interestSaved > 0
              ? "border-green-500/20 bg-green-50/30"
              : undefined
          }
        >
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-2.5">
              <TrendingDown
                className={`h-4 w-4 mt-0.5 shrink-0 ${interestSaved > 0 ? "text-green-600" : "text-muted-foreground"}`}
              />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">
                  Ahorro en intereses
                </p>
                <p
                  className={`text-xl font-bold tabular-nums ${interestSaved > 0 ? "text-green-700" : "text-muted-foreground"}`}
                >
                  {interestSaved > 0
                    ? formatCurrency(interestSaved, currency)
                    : "—"}
                </p>
                {interestSaved > 0 && (
                  <p className="text-xs text-green-600">vs. solo mínimos</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Debt-free date */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-2.5">
              <CalendarCheck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">
                  Libre de deudas
                </p>
                <p className="text-sm font-semibold leading-snug">
                  {formatDebtFreeDate(result.debtFreeDate)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payoff order */}
      {result.payoffOrder.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Orden de liquidación</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              {result.payoffOrder.map((entry, i) => {
                const acct = accounts.find((a) => a.id === entry.accountId);
                return (
                  <div key={entry.accountId} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium">
                        {acct?.name ?? entry.accountName}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 h-4"
                      >
                        {formatCalendarMonth(entry.calendarMonth)}
                      </Badge>
                    </div>
                    {i < result.payoffOrder.length - 1 && (
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Month-by-month table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mes a mes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="whitespace-nowrap min-w-[90px]">
                    Mes
                  </TableHead>
                  <TableHead className="text-right whitespace-nowrap">
                    Saldo total
                  </TableHead>
                  {accounts.map((a) => (
                    <TableHead
                      key={a.id}
                      className="text-right whitespace-nowrap"
                    >
                      {abbreviateName(a.name)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.timeline.map((m: ScenarioMonth) => {
                  const highlight = rowHighlightClass(m.events);
                  return (
                    <TableRow key={m.month} className={highlight}>
                      <TableCell className="py-1.5 align-top">
                        <div className="text-xs font-medium whitespace-nowrap">
                          {formatCalendarMonth(m.calendarMonth)}
                        </div>
                        <EventBadges events={m.events} />
                      </TableCell>
                      <TableCell className="text-right py-1.5 align-top font-semibold text-sm whitespace-nowrap">
                        {formatCurrency(m.totalBalance, currency)}
                      </TableCell>
                      {accountIds.map((accountId) => {
                        const acctMonth = m.accounts.find(
                          (a) => a.accountId === accountId
                        );
                        return (
                          <TableCell
                            key={accountId}
                            className={`text-right py-1.5 align-top text-sm whitespace-nowrap ${
                              acctMonth?.paidOff
                                ? "text-green-600 font-medium"
                                : "text-muted-foreground"
                            }`}
                          >
                            {acctMonth?.paidOff
                              ? "✓ Pagado"
                              : acctMonth
                                ? formatCurrency(acctMonth.balanceAfter, currency)
                                : "—"}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Per-account area chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Trayectoria por cuenta — {scenario.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-[300px] w-full overflow-hidden"
            >
              <AreaChart data={chartData} accessibilityLayer>
                <defs>
                  {accounts.map((a, i) => (
                    <linearGradient
                      key={a.id}
                      id={`fillAcct_${a.id}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={`var(--chart-${(i % 5) + 1})`}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={`var(--chart-${(i % 5) + 1})`}
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval="preserveStartEnd"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => {
                    if (v >= 1_000_000)
                      return `${(v / 1_000_000).toFixed(1)}M`;
                    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
                    return String(v);
                  }}
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as Record<
                      string,
                      number | string
                    >;
                    return (
                      <div className="rounded-lg border bg-background p-2.5 shadow-sm text-xs">
                        <p className="font-medium mb-1.5">{String(d.month)}</p>
                        <div className="space-y-1">
                          {accounts.map((a, i) => {
                            const val = d[`acct_${a.id}`];
                            if (val === undefined) return null;
                            return (
                              <div
                                key={a.id}
                                className="flex items-center gap-2"
                              >
                                <div
                                  className="h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{
                                    backgroundColor: `var(--chart-${(i % 5) + 1})`,
                                  }}
                                />
                                <span className="text-muted-foreground">
                                  {abbreviateName(a.name, 18)}:
                                </span>
                                <span className="font-medium ml-auto">
                                  {formatCurrency(Number(val), currency)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }}
                />
                {accounts.map((a, i) => (
                  <Area
                    key={a.id}
                    type="monotone"
                    dataKey={`acct_${a.id}`}
                    stroke={`var(--chart-${(i % 5) + 1})`}
                    fill={`url(#fillAcct_${a.id})`}
                    strokeWidth={2}
                    stackId="accounts"
                  />
                ))}
              </AreaChart>
            </ChartContainer>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-3 justify-center">
              {accounts.map((a, i) => (
                <div key={a.id} className="flex items-center gap-1.5 text-xs">
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: `var(--chart-${(i % 5) + 1})` }}
                  />
                  <span className="text-muted-foreground">{a.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Salary timeline chart */}
      {income && income > 0 && result && (
        <SalaryTimelineChart
          accounts={accounts}
          income={income}
          result={result}
          currency={currency}
        />
      )}
    </div>
  );
}

"use client";

import { useMemo } from "react";
import type { DebtAccount, ScenarioResult } from "@zeta/shared";
import type { CurrencyCode } from "@zeta/shared";
import type { PlannerAction, ScenarioState } from "../scenario-planner";
import { PLAN_COLORS, formatDebtFreeDate } from "./utils";
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
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils/currency";
import { Plus, Trophy, TrendingDown } from "lucide-react";

interface Props {
  accounts: DebtAccount[];
  scenarios: ScenarioState[];
  results: Record<number, ScenarioResult>;
  baseline: ScenarioResult;
  currency?: CurrencyCode;
  dispatch: React.Dispatch<PlannerAction>;
}

const PLAN_GRADIENT_IDS = ["fillPlan0", "fillPlan1", "fillPlan2"] as const;

function formatMonths(months: number): string {
  if (months === 1) return "1 mes";
  return `${months} meses`;
}

export function CompareStep({
  scenarios,
  results,
  baseline,
  currency,
  dispatch,
}: Props) {
  const canAddScenario = scenarios.length < 3;

  // Find scenario with lowest total interest (recommended)
  const recommendedIndex = useMemo(() => {
    let minInterest = Infinity;
    let minIdx = 0;
    for (let i = 0; i < scenarios.length; i++) {
      const r = results[i];
      if (r && r.totalInterestPaid < minInterest) {
        minInterest = r.totalInterestPaid;
        minIdx = i;
      }
    }
    return minIdx;
  }, [scenarios.length, results]);

  // Build chart config
  const chartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {
      baseline: { label: "Solo mínimos", color: "var(--muted-foreground)" },
    };
    scenarios.forEach((s, i) => {
      config[`plan${i}`] = {
        label: s.name,
        color: PLAN_COLORS[i] ?? "var(--chart-1)",
      };
    });
    return config;
  }, [scenarios]);

  // Merge timelines: use longest timeline's months as x-axis
  const chartData = useMemo(() => {
    const allTimelines = [
      baseline.timeline,
      ...scenarios.map((_, i) => results[i]?.timeline ?? []),
    ];
    const maxLen = Math.max(...allTimelines.map((t) => t.length), 0);
    if (maxLen === 0) return [];

    type DataPoint = { month: string; baseline: number; [key: string]: number | string };
    const data: DataPoint[] = [];

    // Use baseline timeline months as reference, extend with plan months if longer
    const monthLabels: string[] = [];
    for (let i = 0; i < maxLen; i++) {
      const refTimeline = allTimelines.find((t) => t.length > i);
      monthLabels.push(refTimeline?.[i]?.calendarMonth ?? `${i + 1}`);
    }

    for (let i = 0; i < maxLen; i++) {
      const point: DataPoint = {
        month: monthLabels[i],
        baseline: baseline.timeline[i]?.totalBalance ?? 0,
      };
      scenarios.forEach((_, si) => {
        const timeline = results[si]?.timeline ?? [];
        point[`plan${si}`] = timeline[i]?.totalBalance ?? 0;
      });
      data.push(point);
    }
    return data;
  }, [baseline, scenarios, results]);

  const baselineInterest = baseline.totalInterestPaid;

  return (
    <div className="space-y-6">
      {/* Plan tabs + Add button */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {scenarios.map((s, i) => (
            <button
              key={i}
              onClick={() => dispatch({ type: "SET_ACTIVE_SCENARIO", index: i })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors border-border bg-muted/40 hover:bg-muted"
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: PLAN_COLORS[i] }}
              />
              {s.name}
              {i === recommendedIndex && (
                <Trophy className="h-3 w-3 text-z-expense" />
              )}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!canAddScenario}
          onClick={() => dispatch({ type: "ADD_SCENARIO" })}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar plan
        </Button>
      </div>

      {/* Summary comparison table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumen de planes</CardTitle>
          <CardDescription>
            Comparación de resultados entre tus planes y el escenario base (solo pagos mínimos)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Métrica</TableHead>
                  <TableHead className="text-center">
                    <span className="text-muted-foreground text-xs">Solo mínimos</span>
                  </TableHead>
                  {scenarios.map((s, i) => (
                    <TableHead key={i} className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: PLAN_COLORS[i] }}
                        />
                        <span>{s.name}</span>
                        {i === recommendedIndex && (
                          <Badge
                            variant="secondary"
                            className="bg-z-income/10 text-z-income border-z-income/20 text-[10px] px-1.5 py-0"
                          >
                            Recomendado
                          </Badge>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Months to debt-free */}
                <TableRow>
                  <TableCell className="font-medium text-sm text-muted-foreground">
                    Meses hasta deuda cero
                  </TableCell>
                  <TableCell className="text-center font-semibold">
                    {formatMonths(baseline.totalMonths)}
                  </TableCell>
                  {scenarios.map((_, i) => {
                    const r = results[i];
                    return (
                      <TableCell key={i} className="text-center font-semibold">
                        {r ? formatMonths(r.totalMonths) : "—"}
                        {r && r.totalMonths < baseline.totalMonths && (
                          <span className="block text-xs text-z-income font-normal">
                            {baseline.totalMonths - r.totalMonths} meses menos
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>

                {/* Total interest */}
                <TableRow>
                  <TableCell className="font-medium text-sm text-muted-foreground">
                    Total intereses
                  </TableCell>
                  <TableCell className="text-center font-semibold text-z-expense">
                    {formatCurrency(baseline.totalInterestPaid, currency)}
                  </TableCell>
                  {scenarios.map((_, i) => {
                    const r = results[i];
                    return (
                      <TableCell key={i} className="text-center font-semibold text-z-expense">
                        {r ? formatCurrency(r.totalInterestPaid, currency) : "—"}
                      </TableCell>
                    );
                  })}
                </TableRow>

                {/* Total amount paid */}
                <TableRow>
                  <TableCell className="font-medium text-sm text-muted-foreground">
                    Total pagado
                  </TableCell>
                  <TableCell className="text-center font-semibold">
                    {formatCurrency(baseline.totalAmountPaid, currency)}
                  </TableCell>
                  {scenarios.map((_, i) => {
                    const r = results[i];
                    return (
                      <TableCell key={i} className="text-center font-semibold">
                        {r ? formatCurrency(r.totalAmountPaid, currency) : "—"}
                      </TableCell>
                    );
                  })}
                </TableRow>

                {/* Debt-free date */}
                <TableRow>
                  <TableCell className="font-medium text-sm text-muted-foreground">
                    Fecha libre de deudas
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {formatDebtFreeDate(baseline.debtFreeDate)}
                  </TableCell>
                  {scenarios.map((_, i) => {
                    const r = results[i];
                    return (
                      <TableCell key={i} className="text-center text-sm">
                        {r ? formatDebtFreeDate(r.debtFreeDate) : "—"}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Savings callouts */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {scenarios.map((s, i) => {
          const r = results[i];
          if (!r) return null;
          const interestSaved = baselineInterest - r.totalInterestPaid;
          if (interestSaved <= 0) return null;
          return (
            <Card
              key={i}
              className="border-z-income/20 bg-gradient-to-br from-z-income/5 to-z-income/5"
            >
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start gap-2.5">
                  <TrendingDown className="h-4 w-4 text-z-income mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-z-income leading-snug">
                      <strong>{s.name}</strong> ahorra{" "}
                      <strong>{formatCurrency(interestSaved, currency)}</strong> en
                      intereses vs solo pagos mínimos
                    </p>
                    {r.totalMonths < baseline.totalMonths && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Y terminas{" "}
                        {baseline.totalMonths - r.totalMonths} mes
                        {baseline.totalMonths - r.totalMonths !== 1 ? "es" : ""}{" "}
                        antes
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Overlay area chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proyección de saldo total</CardTitle>
            <CardDescription>
              Saldo combinado de todas las deudas mes a mes para cada plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-[320px] w-full overflow-hidden"
            >
              <AreaChart data={chartData} accessibilityLayer>
                <defs>
                  <linearGradient id="fillBaseline" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--muted-foreground)" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="var(--muted-foreground)" stopOpacity={0.02} />
                  </linearGradient>
                  {scenarios.map((_, i) => (
                    <linearGradient key={i} id={PLAN_GRADIENT_IDS[i]} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PLAN_COLORS[i]} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={PLAN_COLORS[i]} stopOpacity={0.05} />
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
                    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
                    return String(v);
                  }}
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as Record<string, number | string>;
                    return (
                      <div className="rounded-lg border bg-background p-2.5 shadow-sm text-xs">
                        <p className="font-medium mb-1.5">{String(d.month)}</p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: "var(--muted-foreground)" }}
                            />
                            <span className="text-muted-foreground">Solo mínimos:</span>
                            <span className="font-medium ml-auto">
                              {formatCurrency(Number(d.baseline), currency)}
                            </span>
                          </div>
                          {scenarios.map((s, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: PLAN_COLORS[i] }}
                              />
                              <span className="text-muted-foreground">{s.name}:</span>
                              <span className="font-medium ml-auto">
                                {formatCurrency(Number(d[`plan${i}`]), currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }}
                />
                <ChartLegend content={<ChartLegendContent />} />
                {/* Baseline as dashed line */}
                <Area
                  type="monotone"
                  dataKey="baseline"
                  stroke="var(--muted-foreground)"
                  fill="url(#fillBaseline)"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  isAnimationActive={false}
                />
                {/* Plans */}
                {scenarios.map((_, i) => (
                  <Area
                    key={i}
                    type="monotone"
                    dataKey={`plan${i}`}
                    stroke={PLAN_COLORS[i]}
                    fill={`url(#${PLAN_GRADIENT_IDS[i]})`}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

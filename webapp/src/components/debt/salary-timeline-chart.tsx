"use client";

import { useState, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
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
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import {
  type DebtAccount,
  type ScenarioResult,
  type CurrencyCode,
  getTimelineSalaryBreakdown,
  getDebtColor,
  LIBRE_COLOR,
} from "@zeta/shared";

const SPANISH_MONTHS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function formatCalendarMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-");
  const monthIdx = Number(month) - 1;
  return `${SPANISH_MONTHS[monthIdx] ?? month} ${year}`;
}

function formatShortMonth(yyyyMm: string): string {
  const [, month] = yyyyMm.split("-");
  const monthIdx = Number(month) - 1;
  return SPANISH_MONTHS[monthIdx] ?? month;
}

interface Props {
  accounts: DebtAccount[];
  income: number;
  result: ScenarioResult;
  currency?: CurrencyCode;
}

export function SalaryTimelineChart({
  accounts,
  income,
  result,
  currency,
}: Props) {
  const [mode, setMode] = useState<"simple" | "cascade">("simple");

  // Build account name lookup
  const accountNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of accounts) {
      map.set(a.id, a.name);
    }
    return map;
  }, [accounts]);

  // Compute breakdowns for selected mode
  const breakdowns = useMemo(
    () => getTimelineSalaryBreakdown(income, result, mode),
    [income, result, mode]
  );

  // Build recharts data: each month is a row, each account+libre is a column
  // The dataKey for each account is `acct_{accountId}`, plus `libre`
  const activeAccountIds = useMemo(() => {
    const ids = new Set<string>();
    for (const bd of breakdowns) {
      for (const seg of bd.segments) {
        if (seg.accountId !== "libre" && seg.accountId !== "redirected") {
          ids.add(seg.accountId);
        }
      }
    }
    return [...ids];
  }, [breakdowns]);

  const chartData = useMemo(() => {
    return breakdowns.map((bd) => {
      const row: Record<string, number | string> = {
        month: formatShortMonth(bd.month),
        fullMonth: formatCalendarMonth(bd.month),
      };
      // Initialize all to 0
      for (const id of activeAccountIds) {
        row[`acct_${id}`] = 0;
      }
      row.libre = 0;

      for (const seg of bd.segments) {
        if (seg.accountId === "libre") {
          row.libre = seg.amount;
        } else if (seg.accountId === "redirected") {
          // In cascade mode, add to the target account's key with a suffix
          const key = `redir_${seg.redirectedTo}`;
          row[key] = (Number(row[key]) || 0) + seg.amount;
        } else {
          row[`acct_${seg.accountId}`] = seg.amount;
        }
      }
      return row;
    });
  }, [breakdowns, activeAccountIds]);

  // Chart config for recharts
  const chartConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {};
    for (const id of activeAccountIds) {
      const name = accountNames.get(id) ?? id;
      cfg[`acct_${id}`] = {
        label: name,
        color: getDebtColor(id),
      };
      if (mode === "cascade") {
        cfg[`redir_${id}`] = {
          label: `${name} (cascada)`,
          color: getDebtColor(id),
        };
      }
    }
    cfg.libre = {
      label: "Libre",
      color: LIBRE_COLOR,
    };
    return cfg;
  }, [activeAccountIds, accountNames, mode]);

  // Payoff milestones
  const milestones = result.payoffOrder.map((entry) => ({
    name: accountNames.get(entry.accountId) ?? entry.accountName,
    month: formatCalendarMonth(entry.calendarMonth),
    color: getDebtColor(entry.accountId),
  }));

  // Summary: first and last libre percentages
  const firstFree = breakdowns[0]?.freePercentage ?? 0;
  const lastMonth = breakdowns[breakdowns.length - 1];

  // Chart width: min 40px per bar, at least full container width
  const chartMinWidth = Math.max(breakdowns.length * 40, 300);
  const needsScroll = breakdowns.length > 12;

  if (income <= 0 || breakdowns.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">
            Distribución del salario
          </CardTitle>
          <div className="flex rounded-lg border p-0.5">
            <Button
              variant={mode === "simple" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-3"
              onClick={() => setMode("simple")}
            >
              Simple
            </Button>
            <Button
              variant={mode === "cascade" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-3"
              onClick={() => setMode("cascade")}
            >
              Cascada
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stacked bar chart */}
        <div className={needsScroll ? "overflow-x-auto" : ""}>
          <div style={{ minWidth: needsScroll ? `${chartMinWidth}px` : "100%" }}>
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-[300px] w-full"
            >
              <BarChart data={chartData} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
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
                        <p className="font-medium mb-1.5">{String(d.fullMonth)}</p>
                        <div className="space-y-1">
                          {payload
                            .filter((p) => Number(p.value) > 0)
                            .map((p) => (
                              <div key={p.dataKey} className="flex items-center gap-2">
                                <div
                                  className="h-2.5 w-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: String(p.color) }}
                                />
                                <span className="text-muted-foreground">
                                  {chartConfig[String(p.dataKey)]?.label ?? p.dataKey}:
                                </span>
                                <span className="font-medium ml-auto">
                                  {formatCurrency(Number(p.value), currency)}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    );
                  }}
                />

                {/* Debt segments (stacked) */}
                {activeAccountIds.map((id) => (
                  <Bar
                    key={`acct_${id}`}
                    dataKey={`acct_${id}`}
                    stackId="salary"
                    fill={getDebtColor(id)}
                  />
                ))}

                {/* Cascade redirect segments (striped via opacity) */}
                {mode === "cascade" &&
                  activeAccountIds.map((id) => (
                    <Bar
                      key={`redir_${id}`}
                      dataKey={`redir_${id}`}
                      stackId="salary"
                      fill={getDebtColor(id)}
                      fillOpacity={0.4}
                    />
                  ))}

                {/* Libre segment (always on top) */}
                <Bar
                  dataKey="libre"
                  stackId="salary"
                  fill={LIBRE_COLOR}
                />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 justify-center">
          {activeAccountIds.map((id) => (
            <div key={id} className="flex items-center gap-1.5 text-xs">
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: getDebtColor(id) }}
              />
              <span className="text-muted-foreground">
                {accountNames.get(id) ?? id}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs">
            <div
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: LIBRE_COLOR }}
            />
            <span className="text-muted-foreground">Libre</span>
          </div>
        </div>

        {/* Payoff milestones */}
        {milestones.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {milestones.map((m) => (
              <Badge
                key={m.name}
                variant="secondary"
                className="text-xs gap-1.5"
              >
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: m.color }}
                />
                {m.name} se paga en {m.month}
              </Badge>
            ))}
          </div>
        )}

        {/* Summary banner */}
        {lastMonth && (
          <div className="rounded-lg bg-green-50/60 border border-green-200/50 px-4 py-3">
            <p className="text-sm text-green-800">
              En{" "}
              <span className="font-semibold">
                {formatCalendarMonth(result.debtFreeDate)}
              </span>{" "}
              eres libre de deuda. Tu salario pasa de{" "}
              <span className="font-semibold">{firstFree.toFixed(0)}%</span>{" "}
              libre a{" "}
              <span className="font-semibold">100%</span> libre en{" "}
              <span className="font-semibold">{result.totalMonths}</span>{" "}
              {result.totalMonths === 1 ? "mes" : "meses"}.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

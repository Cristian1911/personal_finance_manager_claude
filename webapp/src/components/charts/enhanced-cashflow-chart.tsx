"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils/currency";
import { TrendingUp, Scale, Activity } from "lucide-react";

interface CashflowData {
  date: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
  cumulativeIncome: number;
  cumulativeExpenses: number;
  balance: number;
}

interface EnhancedCashflowChartProps {
  data: {
    date: string;
    label: string;
    income: number;
    expenses: number;
  }[];
  monthLabel?: string;
}

type ViewMode = "net-balance" | "dual" | "cumulative";

// Colors
const COLORS = {
  income: "#22c55e",
  expenses: "#ef4444",
  balance: "#3b82f6",
  net: "#8b5cf6",
};

function processData(data: EnhancedCashflowChartProps["data"]): CashflowData[] {
  let runningBalance = 0;
  let cumulativeIncome = 0;
  let cumulativeExpenses = 0;

  return data.map((d) => {
    const net = d.income - d.expenses;
    runningBalance += net;
    cumulativeIncome += d.income;
    cumulativeExpenses += d.expenses;

    return {
      ...d,
      net,
      cumulativeIncome,
      cumulativeExpenses,
      balance: runningBalance,
    };
  });
}

function formatYAxis(value: number) {
  if (value === 0) return "0";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

export function EnhancedCashflowChart({ data, monthLabel }: EnhancedCashflowChartProps) {
  const [view, setView] = useState<ViewMode>("dual");

  const hasTransactionData = data.some(d => d.income > 0 || d.expenses > 0);

  if (data.length === 0 || !hasTransactionData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Análisis de Flujo de Caja</CardTitle>
          <CardDescription className="capitalize">
            {monthLabel ?? "Este período"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-[280px] text-center">
          <p className="text-sm text-muted-foreground mb-2">
            No hay transacciones este mes
          </p>
        </CardContent>
      </Card>
    );
  }

  const processedData = processData(data);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as CashflowData;
    return (
      <div className="rounded-lg border bg-background p-2.5 shadow-sm text-xs">
        <p className="font-medium mb-1.5">{label}</p>
        {view === "dual" && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS.income }} />
              <span className="text-muted-foreground">Ingresos:</span>
              <span className="font-medium ml-auto text-green-600">{formatCurrency(d.income)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS.expenses }} />
              <span className="text-muted-foreground">Gastos:</span>
              <span className="font-medium ml-auto text-red-600">{formatCurrency(d.expenses)}</span>
            </div>
          </div>
        )}
        {view === "net-balance" && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Saldo:</span>
              <span className={`font-medium ml-auto ${d.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(d.balance)}
              </span>
            </div>
          </div>
        )}
        {view === "cumulative" && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Ing. Acum.:</span>
              <span className="font-medium ml-auto">{formatCurrency(d.cumulativeIncome)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Gast. Acum.:</span>
              <span className="font-medium ml-auto">{formatCurrency(d.cumulativeExpenses)}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Determine which lines to show based on view
  const showIncome = view === "dual";
  const showExpenses = view === "dual";
  const showBalance = view === "net-balance";
  const showCumulativeIncome = view === "cumulative";
  const showCumulativeExpenses = view === "cumulative";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Análisis de Flujo de Caja</CardTitle>
            <CardDescription className="capitalize">
              {monthLabel ?? "Este período"}
            </CardDescription>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList className="h-8">
              <TabsTrigger value="net-balance" className="text-xs px-2">
                <Scale className="h-3 w-3 mr-1" />
                Saldo
              </TabsTrigger>
              <TabsTrigger value="dual" className="text-xs px-2">
                <Activity className="h-3 w-3 mr-1" />
                Dual
              </TabsTrigger>
              <TabsTrigger value="cumulative" className="text-xs px-2">
                <TrendingUp className="h-3 w-3 mr-1" />
                Acumulado
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={processedData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tickFormatter={formatYAxis}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={45}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Always render all lines, but hide/show based on view */}
              <Line
                type="linear"
                dataKey="income"
                stroke={COLORS.income}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                hide={!showIncome}
              />
              <Line
                type="linear"
                dataKey="expenses"
                stroke={COLORS.expenses}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                hide={!showExpenses}
              />
              <Line
                type="linear"
                dataKey="balance"
                stroke={COLORS.balance}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                hide={!showBalance}
              />
              <Line
                type="linear"
                dataKey="cumulativeIncome"
                stroke={COLORS.income}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                hide={!showCumulativeIncome}
              />
              <Line
                type="linear"
                dataKey="cumulativeExpenses"
                stroke={COLORS.expenses}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                hide={!showCumulativeExpenses}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs">
          {view === "dual" && (
            <>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.income }} />
                <span className="text-muted-foreground">Ingresos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.expenses }} />
                <span className="text-muted-foreground">Gastos</span>
              </div>
            </>
          )}
          {view === "net-balance" && (
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.balance }} />
              <span className="text-muted-foreground">Saldo acumulado</span>
            </div>
          )}
          {view === "cumulative" && (
            <>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.income }} />
                <span className="text-muted-foreground">Ingresos acumulados</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.expenses }} />
                <span className="text-muted-foreground">Gastos acumulados</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

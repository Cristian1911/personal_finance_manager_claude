"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

function getUtilizationColor(pct: number): string {
  if (pct <= 30) return "#22c55e"; // green
  if (pct <= 70) return "#f59e0b"; // amber
  return "#ef4444"; // red
}

function getUtilizationLabel(pct: number): string {
  if (pct <= 30) return "Saludable";
  if (pct <= 70) return "Moderado";
  return "Alto";
}

export function UtilizationGauge({
  utilization,
  totalUsed,
  totalLimit,
}: {
  utilization: number;
  totalUsed: number;
  totalLimit: number;
}) {
  const color = getUtilizationColor(utilization);
  const label = getUtilizationLabel(utilization);

  const data = [
    { name: "used", value: utilization },
    { name: "available", value: Math.max(100 - utilization, 0) },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Utilización de crédito
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="relative h-32 w-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={0}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill={color} />
                  <Cell fill="hsl(var(--muted))" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold" style={{ color }}>
                {utilization.toFixed(0)}%
              </span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <p className="text-muted-foreground">Usado</p>
              <p className="font-medium">{formatCurrency(totalUsed)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cupo total</p>
              <p className="font-medium">{formatCurrency(totalLimit)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Disponible</p>
              <p className="font-medium text-green-600">
                {formatCurrency(Math.max(totalLimit - totalUsed, 0))}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

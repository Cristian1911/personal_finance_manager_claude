"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import { toAlmuerzos, toHorasMinimo } from "@/lib/utils/debt";
import { Flame } from "lucide-react";

export function InterestCostCard({
  monthlyInterest,
}: {
  monthlyInterest: number;
}) {
  const almuerzos = toAlmuerzos(monthlyInterest);
  const horas = toHorasMinimo(monthlyInterest);

  if (monthlyInterest <= 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Intereses mensuales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-green-600">$0</p>
          <p className="text-sm text-muted-foreground mt-1">
            No estás pagando intereses. Excelente.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Intereses mensuales (est.)
          </CardTitle>
          <Flame className="h-4 w-4 text-amber-500" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-amber-600">
          {formatCurrency(monthlyInterest)}
        </p>
        <div className="mt-3 space-y-1.5">
          <p className="text-xs text-muted-foreground">
            Eso equivale a:
          </p>
          <div className="flex gap-4">
            <div className="bg-amber-500/10 rounded-lg px-3 py-2 text-center">
              <p className="text-lg font-bold text-amber-700">{almuerzos}</p>
              <p className="text-xs text-muted-foreground">almuerzos</p>
            </div>
            <div className="bg-amber-500/10 rounded-lg px-3 py-2 text-center">
              <p className="text-lg font-bold text-amber-700">{horas}</p>
              <p className="text-xs text-muted-foreground">horas de salario mín.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

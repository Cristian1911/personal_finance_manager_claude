import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingUp, TrendingDown } from "lucide-react";
import type { PeriodPlanData } from "@/types/cashflow-planner";

interface PeriodHeaderProps {
  data: PeriodPlanData;
}

export function PeriodHeader({ data }: PeriodHeaderProps) {
  const { period, total_income, total_expenses, total_assigned, total_unassigned, currency } = data;
  const percentAssigned = total_expenses > 0
    ? Math.round((total_assigned / total_expenses) * 100)
    : 0;
  const surplus = total_income - total_expenses;
  const isExpired = new Date(period.end_date) < new Date();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {period.name || "Periodo activo"}
          </h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {formatDate(period.start_date)} — {formatDate(period.end_date)}
            </span>
            {isExpired && (
              <Badge variant="outline" className="text-amber-400 border-amber-400/30">
                Vencido
              </Badge>
            )}
          </div>
        </div>
        <Badge variant="outline" className="text-sm tabular-nums">
          {percentAssigned}% asignado
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-white/6 bg-card p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3 text-emerald-400" />
            Ingresos
          </div>
          <p className="text-lg font-semibold tabular-nums text-emerald-400">
            {formatCurrency(total_income, currency)}
          </p>
        </div>
        <div className="rounded-lg border border-white/6 bg-card p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingDown className="h-3 w-3 text-red-400" />
            Gastos
          </div>
          <p className="text-lg font-semibold tabular-nums text-red-400">
            {formatCurrency(total_expenses, currency)}
          </p>
        </div>
        <div className="rounded-lg border border-white/6 bg-card p-3 space-y-1">
          <p className="text-xs text-muted-foreground">
            {surplus >= 0 ? "Superávit" : "Déficit"}
          </p>
          <p
            className={`text-lg font-semibold tabular-nums ${
              surplus >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {formatCurrency(Math.abs(surplus), currency)}
          </p>
        </div>
      </div>

      {total_unassigned > 0 && (
        <p className="text-sm text-amber-400">
          {formatCurrency(total_unassigned, currency)} en gastos sin asignar a un ingreso
        </p>
      )}
    </div>
  );
}

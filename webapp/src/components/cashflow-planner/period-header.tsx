import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingUp, TrendingDown, ArrowRightLeft } from "lucide-react";
import type { PeriodPlanData } from "@/types/cashflow-planner";

interface PeriodHeaderProps {
  data: PeriodPlanData;
  isExpired?: boolean;
}

export function PeriodHeader({ data, isExpired = false }: PeriodHeaderProps) {
  const {
    period, total_income, total_expenses, total_assigned,
    total_unassigned, currency, is_multi_currency, exchange_rates,
  } = data;
  const percentAssigned = total_expenses > 0
    ? Math.round((total_assigned / total_expenses) * 100)
    : 0;
  const surplus = total_income - total_expenses;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight truncate">
            {period.name || "Periodo activo"}
          </h2>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {formatDate(period.start_date)} — {formatDate(period.end_date)}
            </span>
            {isExpired && (
              <Badge variant="outline" className="text-amber-400 border-amber-400/30">
                Vencido
              </Badge>
            )}
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 text-xs sm:text-sm tabular-nums">
          {percentAssigned}% asignado
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-lg border border-white/6 bg-card p-2 sm:p-3 space-y-1 min-w-0">
          <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3 shrink-0 text-z-income" />
            <span className="truncate">Ingresos</span>
          </div>
          <p className="truncate text-[13px] sm:text-lg font-semibold tabular-nums text-z-income">
            {formatCurrency(total_income, currency)}
          </p>
        </div>
        <div className="rounded-lg border border-white/6 bg-card p-2 sm:p-3 space-y-1 min-w-0">
          <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
            <TrendingDown className="h-3 w-3 shrink-0 text-z-expense" />
            <span className="truncate">Gastos</span>
          </div>
          <p className="truncate text-[13px] sm:text-lg font-semibold tabular-nums text-z-expense">
            {formatCurrency(total_expenses, currency)}
          </p>
        </div>
        <div className="rounded-lg border border-white/6 bg-card p-2 sm:p-3 space-y-1 min-w-0">
          <p className="truncate text-[10px] sm:text-xs text-muted-foreground">
            {surplus >= 0 ? "Superávit" : "Déficit"}
          </p>
          <p
            className={`truncate text-[13px] sm:text-lg font-semibold tabular-nums ${
              surplus >= 0 ? "text-z-income" : "text-z-expense"
            }`}
          >
            {formatCurrency(Math.abs(surplus), currency)}
          </p>
        </div>
      </div>

      {is_multi_currency && Object.keys(exchange_rates).length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowRightLeft className="h-3 w-3" />
          <span>
            Totales en {currency}.
            {Object.entries(exchange_rates).map(([fc, rate]) => (
              <span key={fc} className="ml-1">
                1 {fc} = {formatCurrency(rate, currency)}
              </span>
            ))}
          </span>
        </div>
      )}

      {total_unassigned > 0 && (
        <p className="text-sm text-amber-400">
          {formatCurrency(total_unassigned, currency)} en gastos sin asignar a un ingreso
        </p>
      )}
    </div>
  );
}

"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrencyCompact } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

interface RecurringHeroCompactProps {
  totalExpenses: number;
  totalIncome: number;
  currency: CurrencyCode;
  monthLabel: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  canGoNext: boolean;
}

export function RecurringHeroCompact({
  totalExpenses,
  totalIncome,
  currency,
  monthLabel,
  onPrevMonth,
  onNextMonth,
  canGoNext,
}: RecurringHeroCompactProps) {
  const net = totalIncome - totalExpenses;
  const isPositive = net >= 0;
  const total = totalExpenses + totalIncome;
  const expensePercent = total > 0 ? (totalExpenses / total) * 100 : 50;

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={onPrevMonth}
          className="flex size-7 items-center justify-center rounded-full border border-white/6 text-muted-foreground active:bg-white/5"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="text-xs font-medium capitalize text-muted-foreground">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={onNextMonth}
          disabled={!canGoNext}
          className="flex size-7 items-center justify-center rounded-full border border-white/6 text-muted-foreground active:bg-white/5 disabled:opacity-30"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      {/* Compact hero card */}
      <div className="rounded-2xl border border-white/6 bg-gradient-to-br from-z-brass/[0.06] to-transparent p-3.5">
        {/* Proportion bar */}
        <div className="mb-3 flex h-1.5 overflow-hidden rounded-full">
          <div
            className="rounded-l-full bg-gradient-to-r from-z-debt to-z-alert"
            style={{ width: `${expensePercent}%` }}
          />
          <div
            className="rounded-r-full bg-gradient-to-r from-z-income to-emerald-500"
            style={{ width: `${100 - expensePercent}%` }}
          />
        </div>

        {/* Three numbers */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-z-debt">
              Gastos
            </p>
            <p className="text-base font-bold tabular-nums">
              {formatCurrencyCompact(totalExpenses, currency)}
            </p>
          </div>
          <div className="px-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Neto
            </p>
            <p
              className={cn(
                "text-xl font-extrabold tabular-nums",
                isPositive ? "text-z-income" : "text-z-debt"
              )}
            >
              {isPositive ? "+" : ""}
              {formatCurrencyCompact(Math.abs(net), currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-z-income">
              Ingresos
            </p>
            <p className="text-base font-bold tabular-nums">
              {formatCurrencyCompact(totalIncome, currency)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

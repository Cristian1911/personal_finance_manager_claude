"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { ChevronDown, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { isDebtAccountType } from "@/lib/utils/account-balance";
import type { CurrencyCode, UpcomingRecurrence } from "@/types/domain";

interface PlanFlowTimelineProps {
  upcoming: UpcomingRecurrence[];
  totalMonthlyIncome: number;
  totalMonthlyExpenses: number;
  currency: CurrencyCode;
}

export function PlanFlowTimeline({
  upcoming,
  totalMonthlyIncome,
  totalMonthlyExpenses,
  currency,
}: PlanFlowTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const net = totalMonthlyIncome - totalMonthlyExpenses;
  const isPositive = net >= 0;

  // Sort upcoming by date, take first 8
  const sorted = [...upcoming]
    .sort((a, b) => a.next_date.localeCompare(b.next_date))
    .slice(0, expanded ? 20 : 5);

  return (
    <div className={cn(PANEL_INSET_CLASS, "overflow-hidden")}>
      {/* Summary header */}
      <div className="flex items-center justify-between border-b border-white/6 px-3.5 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Flujo del mes
          </p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-xs text-z-income">
              +{formatCurrency(totalMonthlyIncome, currency)}
            </span>
            <span className="text-xs text-z-expense">
              -{formatCurrency(totalMonthlyExpenses, currency)}
            </span>
            <span
              className={cn(
                "text-sm font-semibold",
                isPositive ? "text-z-income" : "text-z-debt"
              )}
            >
              = {isPositive ? "+" : ""}
              {formatCurrency(net, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Timeline items */}
      {sorted.length > 0 ? (
        <div className="divide-y divide-white/6">
          {sorted.map((item) => {
            const t = item.template;
            const isIncome = t.direction === "INFLOW" && !isDebtAccountType(t.account?.account_type);
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 px-3.5 py-2.5"
              >
                <div
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full",
                    isIncome
                      ? "bg-z-income/10 text-z-income"
                      : "bg-z-expense/10 text-z-expense"
                  )}
                >
                  {isIncome ? (
                    <ArrowDownLeft className="size-3" />
                  ) : (
                    <ArrowUpRight className="size-3" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight truncate">
                    {t.merchant_name || t.description || "Sin descripción"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(item.next_date, "dd MMM")}
                    {t.account && (
                      <> · {t.account.name}</>
                    )}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-sm font-medium",
                    isIncome && "text-z-income"
                  )}
                >
                  {isIncome ? "+" : "-"}
                  {formatCurrency(t.amount, (t.account?.currency_code ?? currency) as CurrencyCode)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-3.5 py-6 text-center text-xs text-muted-foreground">
          Sin obligaciones próximas registradas
        </div>
      )}

      {/* Expand toggle */}
      {upcoming.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="flex w-full items-center justify-center gap-1 border-t border-white/6 py-2 text-[11px] font-semibold text-z-brass transition-colors hover:bg-white/[0.02]"
        >
          {expanded ? "Ver menos" : `Ver ${upcoming.length - 5} más`}
          <ChevronDown
            className={cn(
              "size-3 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>
      )}
    </div>
  );
}

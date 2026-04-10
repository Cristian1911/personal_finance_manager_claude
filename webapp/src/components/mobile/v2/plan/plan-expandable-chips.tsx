"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { CurrencyCode, UpcomingRecurrence } from "@/types/domain";

interface PlanExpandableChipsProps {
  incomes: UpcomingRecurrence[];
  payments: UpcomingRecurrence[];
  currency: CurrencyCode;
}

type ChipType = "income" | "payment" | null;

export function PlanExpandableChips({
  incomes,
  payments,
  currency,
}: PlanExpandableChipsProps) {
  const [expanded, setExpanded] = useState<ChipType>(null);

  const nextIncome = incomes[0] ?? null;
  const nextPayment = payments[0] ?? null;

  const toggle = (type: ChipType) => {
    setExpanded((prev) => (prev === type ? null : type));
  };

  const expandedList = expanded === "income" ? incomes : expanded === "payment" ? payments : [];
  const expandedLabel = expanded === "income" ? "Ingresos esperados" : "Pagos programados";
  const expandedColor = expanded === "income" ? "text-emerald-400" : "text-red-400";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => toggle("income")}
          className={cn(
            "rounded-xl border p-3 text-left transition-all",
            expanded === "income"
              ? "border-emerald-500/50 bg-emerald-950/30"
              : "border-white/6 bg-emerald-950/20",
            expanded === "payment" && "opacity-50"
          )}
        >
          {nextIncome ? (
            <>
              <p className="text-lg font-bold text-emerald-400">
                {formatCurrency(nextIncome.template.amount ?? 0, currency)}
              </p>
              <p className="text-[10px] text-emerald-400/80">Próximo ingreso</p>
              <p className="text-[9px] text-muted-foreground">
                {nextIncome.template.description} · {formatDate(new Date(nextIncome.next_date), "dd MMM")}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1 text-emerald-400/60">
                <Plus className="size-4" />
                <p className="text-xs font-semibold">Mapear ingreso</p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Agrega un ingreso recurrente
              </p>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => toggle("payment")}
          className={cn(
            "rounded-xl border p-3 text-left transition-all",
            expanded === "payment"
              ? "border-red-500/50 bg-red-950/30"
              : "border-white/6 bg-red-950/20",
            expanded === "income" && "opacity-50"
          )}
        >
          {nextPayment ? (
            <>
              <p className="text-lg font-bold text-red-400">
                {formatCurrency(nextPayment.template.amount ?? 0, currency)}
              </p>
              <p className="text-[10px] text-red-400/80">Próximo pago</p>
              <p className="text-[9px] text-muted-foreground">
                {nextPayment.template.description} · {formatDate(new Date(nextPayment.next_date), "dd MMM")}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1 text-red-400/60">
                <Plus className="size-4" />
                <p className="text-xs font-semibold">Mapear pago</p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Agrega un pago recurrente
              </p>
            </>
          )}
        </button>
      </div>

      {expanded && (
        <div className={cn(
          "rounded-xl border p-3",
          expanded === "income"
            ? "border-emerald-500/20 bg-emerald-950/20"
            : "border-red-500/20 bg-red-950/20"
        )}>
          <p className={cn("text-[10px] font-semibold uppercase tracking-widest mb-2", expandedColor)}>
            {expandedLabel}
          </p>
          {expandedList.length > 0 ? (
            <>
              <div className="divide-y divide-white/5">
                {expandedList.map((item, i) => (
                  <div key={`${item.template.id}-${i}`} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-xs font-medium">{item.template.description}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(new Date(item.next_date), "dd MMM yyyy")}
                        {item.template.account && ` · ${item.template.account.name}`}
                      </p>
                    </div>
                    <p className={cn("text-sm font-semibold", expandedColor)}>
                      {formatCurrency(item.template.amount ?? 0, currency)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-xs">
                <span className="text-muted-foreground">Total</span>
                <span className={cn("font-bold", expandedColor)}>
                  {formatCurrency(
                    expandedList.reduce((sum, item) => sum + (item.template.amount ?? 0), 0),
                    currency
                  )}
                </span>
              </div>
            </>
          ) : (
            <div className="py-3 text-center">
              <p className="text-xs text-muted-foreground mb-2">
                {expanded === "income"
                  ? "No tienes ingresos recurrentes configurados"
                  : "No tienes pagos recurrentes configurados"}
              </p>
              <Link
                href="/recurrentes"
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  expanded === "income"
                    ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                    : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                )}
              >
                <Plus className="size-3.5" />
                Crear en Recurrentes
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

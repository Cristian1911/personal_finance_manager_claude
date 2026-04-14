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
  expanded?: string | null;
  onToggle?: (id: string) => void;
}

type ChipType = "income" | "payment" | null;

const CHIP_CONFIG = {
  income: {
    label: "Próximo ingreso",
    emptyAction: "Mapear ingreso",
    emptyHint: "Agrega un ingreso recurrente",
    expandedLabel: "Ingresos esperados",
    emptyMessage: "No tienes ingresos recurrentes configurados",
    text: "text-z-income",
    textMuted: "text-z-income/80",
    textEmpty: "text-z-income/60",
    borderActive: "border-z-income/50 bg-z-income/10",
    borderInactive: "border-white/6 bg-z-income/5",
    panelBorder: "border-z-income/20 bg-z-income/5",
    ctaBg: "bg-z-income/15 text-z-income hover:bg-z-income/20",
  },
  payment: {
    label: "Próximo pago",
    emptyAction: "Mapear pago",
    emptyHint: "Agrega un pago recurrente",
    expandedLabel: "Pagos programados",
    emptyMessage: "No tienes pagos recurrentes configurados",
    text: "text-z-debt",
    textMuted: "text-z-debt/80",
    textEmpty: "text-z-debt/60",
    borderActive: "border-z-debt/50 bg-z-debt/10",
    borderInactive: "border-white/6 bg-z-debt/5",
    panelBorder: "border-z-debt/20 bg-z-debt/5",
    ctaBg: "bg-z-debt/15 text-z-debt hover:bg-z-debt/20",
  },
} as const;

const OPPOSITE: Record<"income" | "payment", ChipType> = { income: "payment", payment: "income" };
const CHIP_KEYS = { income: "chip-income", payment: "chip-payment" } as const;

export function PlanExpandableChips({
  incomes,
  payments,
  currency,
  expanded: externalExpanded,
  onToggle: externalToggle,
}: PlanExpandableChipsProps) {
  const [internalExpanded, setInternalExpanded] = useState<ChipType>(null);

  // Use external zone if provided, otherwise internal state
  const activeChip: ChipType = externalExpanded
    ? (externalExpanded === CHIP_KEYS.income ? "income" : externalExpanded === CHIP_KEYS.payment ? "payment" : null)
    : internalExpanded;

  const items = { income: incomes, payment: payments } as const;
  const toggle = (type: ChipType) => {
    if (type && externalToggle) {
      externalToggle(CHIP_KEYS[type]);
    } else {
      setInternalExpanded((prev) => (prev === type ? null : type));
    }
  };

  const expandedList = activeChip ? items[activeChip] : [];
  const config = activeChip ? CHIP_CONFIG[activeChip] : null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {(["income", "payment"] as const).map((type) => {
          const c = CHIP_CONFIG[type];
          const next = items[type][0] ?? null;
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggle(type)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all",
                activeChip === type ? c.borderActive : c.borderInactive,
                activeChip === OPPOSITE[type] && "opacity-50"
              )}
            >
              {next ? (
                <>
                  <p className={cn("text-lg font-bold tabular-nums", c.text)}>
                    {formatCurrency(next.template.amount ?? 0, currency)}
                  </p>
                  <p className={cn("text-[10px]", c.textMuted)}>{c.label}</p>
                  <p className="text-[9px] text-muted-foreground">
                    {next.template.description} · {formatDate(next.next_date, "dd MMM")}
                  </p>
                </>
              ) : (
                <>
                  <div className={cn("flex items-center gap-1", c.textEmpty)}>
                    <Plus className="size-4" />
                    <p className="text-xs font-semibold">{c.emptyAction}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{c.emptyHint}</p>
                </>
              )}
            </button>
          );
        })}
      </div>

      {activeChip && config && (
        <div className={cn("rounded-xl border p-3", config.panelBorder)}>
          <p className={cn("text-[10px] font-semibold uppercase tracking-[0.18em] mb-2", config.text)}>
            {config.expandedLabel}
          </p>
          {expandedList.length > 0 ? (
            <>
              <div className="divide-y divide-white/5">
                {expandedList.map((item, i) => (
                  <div key={`${item.template.id}-${i}`} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-xs font-medium">{item.template.description}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(item.next_date, "dd MMM yyyy")}
                        {item.template.account && ` · ${item.template.account.name}`}
                      </p>
                    </div>
                    <p className={cn("text-sm font-semibold tabular-nums", config.text)}>
                      {formatCurrency(item.template.amount ?? 0, currency)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-xs">
                <span className="text-muted-foreground">Total</span>
                <span className={cn("font-bold tabular-nums", config.text)}>
                  {formatCurrency(
                    expandedList.reduce((sum, item) => sum + (item.template.amount ?? 0), 0),
                    currency
                  )}
                </span>
              </div>
            </>
          ) : (
            <div className="py-3 text-center">
              <p className="text-xs text-muted-foreground mb-2">{config.emptyMessage}</p>
              <Link
                href="/recurrentes"
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  config.ctaBg
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

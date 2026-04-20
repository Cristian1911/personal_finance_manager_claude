"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { ChipEyebrow } from "../widget-chip";
import type { WidgetRender } from "../widget-grid";
import type { CurrencyCode } from "@/types/domain";

interface WhereTodayWidgetProps {
  spentToday: number;
  spentYesterday: number;
  avgLast7: number;
  currency: CurrencyCode;
}

export function renderWhereTodayWidget(props: WhereTodayWidgetProps): WidgetRender {
  const { spentToday, spentYesterday, avgLast7, currency } = props;
  const tone = spentToday === 0 ? "foreground" : "expense";

  return {
    tone,
    accessibilityLabel: `Gasto de hoy: ${formatCurrency(spentToday, currency)}`,
    chip: (
      <div className="flex h-full flex-col items-center gap-1.5 text-center">
        <ChipEyebrow>Gasto de hoy</ChipEyebrow>
        <p
          className={cn(
            "flex-1 text-[26px] font-bold leading-none tabular-nums",
            spentToday === 0 ? "text-z-sage-light" : "text-foreground",
          )}
        >
          {formatCurrencyCompact(spentToday, currency)}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {spentToday === 0 ? "Sin gastos hoy" : "gastado hoy"}
        </p>
      </div>
    ),
    detail: (
      <div className={cn(PANEL_INSET_CLASS, "border-z-brass/20 bg-black/20 p-3 space-y-2")}>
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground">Hoy</span>
          <span className="text-sm font-semibold tabular-nums">
            {formatCurrency(spentToday, currency)}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground">Ayer</span>
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
            {formatCurrency(spentYesterday, currency)}
          </span>
        </div>
        {avgLast7 > 0 && (
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-muted-foreground">Promedio 7 días</span>
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">
              {formatCurrency(Math.round(avgLast7), currency)}
            </span>
          </div>
        )}
        <Link href="/transactions" className="inline-block text-[11px] font-semibold text-z-brass">
          Ver movimientos →
        </Link>
      </div>
    ),
  };
}

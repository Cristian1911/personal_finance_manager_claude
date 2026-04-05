"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import {
  PANEL_SURFACE_SUBTLE_CLASS,
  HERO_CARD_GRADIENT_CLASS,
  PANEL_INSET_CLASS,
} from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";

interface InicioHeroProps {
  availablePerDay: number;
  availableTotal: number;
  daysRemaining: number;
  currency: CurrencyCode;
  breakdown?: {
    totalLiquid: number;
    fixedExpenses: number;
    alreadySpent: number;
  };
  /** Controlled from parent page-level accordion */
  expanded?: boolean;
  onToggle?: () => void;
}

export function InicioHero({
  availablePerDay,
  availableTotal,
  daysRemaining,
  currency,
  breakdown,
  expanded = false,
  onToggle,
}: InicioHeroProps) {

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        PANEL_SURFACE_SUBTLE_CLASS,
        HERO_CARD_GRADIENT_CLASS,
        "w-full p-5 text-left"
      )}
      aria-expanded={expanded}
      aria-label="Expandir desglose del disponible diario"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
        Disponible para gastar
      </p>

      <div className="mt-2 flex items-baseline gap-0.5">
        <span className="text-[36px] font-extrabold leading-none tracking-tight text-foreground">
          {formatCurrency(availablePerDay, currency)}
        </span>
        <span className="text-sm font-medium text-muted-foreground">/día</span>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        = {formatCurrency(availableTotal, currency)} este mes · {daysRemaining}{" "}
        días restantes
      </p>

      {/* Expandable math breakdown */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "mt-3 transition-opacity duration-150",
              expanded ? "opacity-100 delay-75" : "opacity-0"
            )}
          >
            {breakdown && (
              <div
                className={cn(
                  PANEL_INSET_CLASS,
                  "border-white/8 bg-black/20 p-3 space-y-1.5"
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-brass">
                  Cómo se calcula
                </p>
                <div className="flex justify-between text-xs text-z-sage-light">
                  <span>Saldo total</span>
                  <span>{formatCurrency(breakdown.totalLiquid, currency)}</span>
                </div>
                <div className="flex justify-between text-xs text-z-sage-light">
                  <span>− Gastos fijos pendientes</span>
                  <span className="text-z-expense">
                    −{formatCurrency(breakdown.fixedExpenses, currency)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-z-sage-light">
                  <span>− Ya gastado</span>
                  <span className="text-z-expense">
                    −{formatCurrency(breakdown.alreadySpent, currency)}
                  </span>
                </div>
                <div className="border-t border-white/8 pt-1.5 flex justify-between text-xs font-semibold text-foreground">
                  <span>= Disponible</span>
                  <span>{formatCurrency(availableTotal, currency)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  ÷ {daysRemaining} días = {formatCurrency(availablePerDay, currency)}/día
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

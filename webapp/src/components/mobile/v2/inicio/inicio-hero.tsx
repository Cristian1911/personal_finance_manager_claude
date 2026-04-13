"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, toColombiaDateString } from "@/lib/utils/date";
import { ChevronRight } from "lucide-react";
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
  nextIncomeDate: string | null;
  nextIncomeAmount: number;
  nextIncomeName: string | null;
  incomeConfigured: boolean;
  breakdown?: {
    totalLiquid: number;
    fixedExpenses: number;
    alreadySpent: number;
  };
  primaryAccount?: {
    id: string;
    name: string;
    currentBalance: number;
    currencyCode: CurrencyCode;
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
  nextIncomeDate,
  nextIncomeAmount,
  nextIncomeName,
  incomeConfigured,
  breakdown,
  primaryAccount,
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
        {nextIncomeDate
          ? <>{`= ${formatCurrency(availableTotal, currency)} · `}{nextIncomeDate === toColombiaDateString(new Date()) ? "hoy" : `${daysRemaining} días`}{` hasta ${formatDate(nextIncomeDate, "d MMM")}`}</>
          : <>{`= ${formatCurrency(availableTotal, currency)} · ${daysRemaining} días restantes`}</>
        }
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
                  <span>Saldo líquido</span>
                  <span>{formatCurrency(breakdown.totalLiquid, currency)}</span>
                </div>
                <div className="flex justify-between text-xs text-z-sage-light">
                  <span>− Obligaciones pendientes</span>
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
                  ÷ {daysRemaining} días{nextIncomeDate ? ` (hasta ${formatDate(nextIncomeDate, "d MMM")})` : ""} = {formatCurrency(availablePerDay, currency)}/día
                </p>
                {nextIncomeDate && (
                  <div className="border-t border-white/8 pt-1.5 flex justify-between text-xs text-z-income">
                    <span>Próximo ingreso: {nextIncomeName}</span>
                    <span>+{formatCurrency(nextIncomeAmount, currency)} el {formatDate(nextIncomeDate, "d MMM")}</span>
                  </div>
                )}
              </div>
            )}

            {!incomeConfigured && (
              <Link
                href="/plan?tab=recurrentes"
                onClick={(e) => e.stopPropagation()}
                className={cn(PANEL_INSET_CLASS, "mt-2 flex items-center justify-between border-z-brass/20 bg-z-brass/5 p-3 transition-colors hover:bg-z-brass/10")}
              >
                <p className="text-[11px] text-z-brass">Configura tus ingresos recurrentes para un presupuesto diario más preciso</p>
                <ChevronRight className="size-3.5 shrink-0 text-z-brass/50" />
              </Link>
            )}

            {primaryAccount && (
              <Link
                href={`/accounts/${primaryAccount.id}`}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  PANEL_INSET_CLASS,
                  "mt-2 flex items-center justify-between border-white/8 bg-black/20 p-3 transition-colors hover:bg-white/[0.04]"
                )}
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-sage-dark">
                    Cuenta principal
                  </p>
                  <p className="mt-0.5 text-[12px] text-z-sage-light">
                    {primaryAccount.name}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[15px] font-bold tabular-nums text-foreground">
                    {formatCurrency(primaryAccount.currentBalance, primaryAccount.currencyCode)}
                  </p>
                  <ChevronRight className="size-3.5 text-muted-foreground/50" />
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

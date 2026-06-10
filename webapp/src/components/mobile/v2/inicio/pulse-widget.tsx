"use client";

import { useId } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, toColombiaDateString } from "@/lib/utils/date";
import { ChevronRight } from "lucide-react";
import {
  PANEL_SURFACE_SUBTLE_CLASS,
  HERO_CARD_GRADIENT_CLASS,
  PANEL_INSET_CLASS,
  SECTION_EYEBROW_CLASS,
} from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";

interface PulseWidgetProps {
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
  /** Last-N days of OUTFLOW amounts — fed to the sparkline. Ordered oldest → newest. */
  spark: number[];
  /** Average spending per day over the same window, used for the "en ritmo" signal. */
  avgSpend: number;
  expanded?: boolean;
  onToggle?: () => void;
}

type Status = {
  tone: "income" | "brass" | "muted";
  label: string;
};

function resolveStatus({
  incomeConfigured,
  avgSpend,
  availablePerDay,
}: {
  incomeConfigured: boolean;
  avgSpend: number;
  availablePerDay: number;
}): Status {
  if (!incomeConfigured) {
    return { tone: "muted", label: "Configura ingresos" };
  }
  if (avgSpend === 0) {
    return { tone: "muted", label: "Sin gasto aún" };
  }
  // Treat "en ritmo" as avgSpend ≤ availablePerDay * 1.05 (small grace band
  // so a single pricey day doesn't flip the signal).
  if (avgSpend <= availablePerDay * 1.05) {
    return { tone: "income", label: "En ritmo" };
  }
  return { tone: "brass", label: "Arriba del ritmo" };
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const gradientId = useId();
  if (values.length < 2) {
    // Placeholder line so the Pulse card doesn't look broken with no history.
    return (
      <svg
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        className="h-6 w-full"
        aria-hidden
      >
        <line
          x1={0}
          y1={20}
          x2={100}
          y2={20}
          stroke={color}
          strokeOpacity={0.2}
          strokeWidth={1.25}
          strokeDasharray="2 3"
        />
      </svg>
    );
  }

  const max = Math.max(...values, 1);
  const width = 100;
  const height = 24;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - (v / max) * height * 0.85 - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = points.join(" ");
  // Area path: close bottom so we can fill a subtle gradient.
  const area = `M0,${height} L${points.join(" L")} L${width},${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-6 w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} stroke="none" />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PulseWidget({
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
  spark,
  avgSpend,
  expanded = false,
  onToggle,
}: PulseWidgetProps) {
  const todayStr = toColombiaDateString(new Date());
  const isPayday = nextIncomeDate === todayStr;
  const status = resolveStatus({ incomeConfigured, avgSpend, availablePerDay });

  const statusToneClass =
    status.tone === "income"
      ? "text-z-income"
      : status.tone === "brass"
        ? "text-z-brass"
        : "text-z-sage-dark";
  const statusDotClass =
    status.tone === "income"
      ? "bg-z-income"
      : status.tone === "brass"
        ? "bg-z-brass"
        : "bg-z-sage-dark/40";

  const sparkColor =
    status.tone === "brass" ? "var(--color-z-brass)" : "var(--color-z-sage)";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        PANEL_SURFACE_SUBTLE_CLASS,
        HERO_CARD_GRADIENT_CLASS,
        "block w-full p-5 text-left"
      )}
      aria-expanded={expanded}
      aria-label="Expandir desglose del disponible diario"
    >
      <div className="flex items-center justify-between">
        <p className={SECTION_EYEBROW_CLASS}>Este mes · pulso</p>
        <span className={cn("flex items-center gap-1.5 text-[10px] font-semibold", statusToneClass)}>
          <span className={cn("size-1.5 rounded-full", statusDotClass)} aria-hidden />
          {status.label}
        </span>
      </div>

      <div className="mt-2 flex items-end gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-0.5">
            <span className="text-[36px] font-extrabold leading-none tracking-tight text-foreground">
              {formatCurrency(availablePerDay, currency)}
            </span>
            <span className="text-sm font-medium text-muted-foreground">/día</span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {nextIncomeDate ? (
              <>
                {`${formatCurrency(availableTotal, currency)} · `}
                {isPayday ? "hoy" : `${daysRemaining} días`}
                {` hasta ${formatDate(nextIncomeDate, "d MMM")}`}
              </>
            ) : (
              <>{`${formatCurrency(availableTotal, currency)} · ${daysRemaining} días restantes`}</>
            )}
          </p>
        </div>
        <div className="flex-1 self-center">
          <Sparkline values={spark} color={sparkColor} />
        </div>
      </div>

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
                  "border-white/6 bg-black/20 p-3 space-y-1.5"
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
                <div className="flex justify-between border-t border-white/6 pt-1.5 text-xs font-semibold text-foreground">
                  <span>= Disponible</span>
                  <span>{formatCurrency(availableTotal, currency)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  ÷ {daysRemaining} días
                  {nextIncomeDate ? ` (hasta ${formatDate(nextIncomeDate, "d MMM")})` : ""} ={" "}
                  {formatCurrency(availablePerDay, currency)}/día
                </p>
                {nextIncomeDate && (
                  <div className="flex justify-between border-t border-white/6 pt-1.5 text-xs text-z-income">
                    <span>Próximo ingreso: {nextIncomeName}</span>
                    <span className="tabular-nums">
                      +{formatCurrency(nextIncomeAmount, currency)} el{" "}
                      {formatDate(nextIncomeDate, "d MMM")}
                    </span>
                  </div>
                )}
              </div>
            )}

            {!incomeConfigured && (
              <Link
                href="/plan?tab=recurrentes"
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  PANEL_INSET_CLASS,
                  "mt-2 flex items-center justify-between border-z-brass/20 bg-z-brass/5 p-3 transition-colors hover:bg-z-brass/10"
                )}
              >
                <p className="text-[11px] text-z-brass">
                  Configura tus ingresos recurrentes para un presupuesto diario más preciso
                </p>
                <ChevronRight className="size-3.5 shrink-0 text-z-brass/50" />
              </Link>
            )}

            {primaryAccount && (
              <Link
                href={`/accounts/${primaryAccount.id}`}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  PANEL_INSET_CLASS,
                  "mt-2 flex items-center justify-between border-white/6 bg-black/20 p-3 transition-colors hover:bg-white/[0.04]"
                )}
              >
                <div>
                  <p className={SECTION_EYEBROW_CLASS}>Cuenta principal</p>
                  <p className="mt-0.5 text-[12px] text-z-sage-light">{primaryAccount.name}</p>
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

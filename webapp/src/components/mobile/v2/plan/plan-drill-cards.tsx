"use client";

import Link from "next/link";
import { ArrowRight, Wallet, CalendarClock, RotateCcw, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { PANEL_INSET_CLASS, MOBILE_ACTION_BUTTON_CLASS } from "@/lib/constants/styles";
import type { PlanBudgetSummary, PlanRecurringSummary } from "@/types/plan";
import type { CurrencyCode } from "@/types/domain";

interface DrillCard {
  key: string;
  title: string;
  hint: string;
  hintColor: string;
  href: string;
  icon: React.ReactNode;
  expandedContent: React.ReactNode;
}

interface PlanDrillCardsProps {
  budget: PlanBudgetSummary;
  recurring: PlanRecurringSummary;
  periodoSummary: { hasActive: boolean; percentAssigned: number; unassignedCount?: number } | null;
  wishlistCount: number;
  currency: CurrencyCode;
  expanded?: string | null;
  onToggle?: (id: string) => void;
}

export function PlanDrillCards({
  budget,
  recurring,
  periodoSummary,
  wishlistCount,
  currency,
  expanded,
  onToggle,
}: PlanDrillCardsProps) {
  const budgetPct = budget.totalBudgeted > 0
    ? Math.round((budget.totalSpent / budget.totalBudgeted) * 100)
    : 0;

  const nextPayment = recurring.upcoming?.[0];
  const pendingCount = (recurring.upcoming?.length ?? 0) + (recurring.upcomingIncome?.length ?? 0);

  const cards: DrillCard[] = [
    {
      key: "drill-presupuesto",
      title: "Presupuesto",
      icon: <Wallet className="size-3.5" />,
      hint: budget.overLimitCount > 0
        ? `${budget.overLimitCount} sobre límite`
        : `${budgetPct}%`,
      hintColor: budget.overLimitCount > 0 ? "text-z-debt" : "text-z-income",
      href: "/plan?tab=presupuesto",
      expandedContent: (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Gastado</span>
            <span className="font-medium tabular-nums">{formatCurrency(budget.totalSpent, currency)} de {formatCurrency(budget.totalBudgeted, currency)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", budgetPct > 100 ? "bg-z-debt" : "bg-z-income")}
              style={{ width: `${Math.min(budgetPct, 100)}%` }}
            />
          </div>
          {budget.overLimitCount > 0 && (
            <p className="text-[10px] text-z-debt">{budget.overLimitCount} categoría{budget.overLimitCount !== 1 ? "s" : ""} sobre límite</p>
          )}
        </div>
      ),
    },
    {
      key: "drill-periodo",
      title: "Periodo",
      icon: <CalendarClock className="size-3.5" />,
      hint: periodoSummary?.hasActive
        ? `${periodoSummary.percentAssigned}%`
        : "—",
      hintColor: periodoSummary?.hasActive ? "text-z-income" : "text-muted-foreground",
      href: "/plan?tab=periodo",
      expandedContent: periodoSummary?.hasActive ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Asignado</span>
            <span className="font-medium">{periodoSummary.percentAssigned}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-z-income" style={{ width: `${Math.min(periodoSummary.percentAssigned, 100)}%` }} />
          </div>
          {(periodoSummary.unassignedCount ?? 0) > 0 && (
            <p className="text-[10px] text-z-alert">{periodoSummary.unassignedCount} gasto{periodoSummary.unassignedCount !== 1 ? "s" : ""} sin asignar</p>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">No hay periodo activo este mes</p>
      ),
    },
    {
      key: "drill-recurrentes",
      title: "Recurrentes",
      icon: <RotateCcw className="size-3.5" />,
      hint: `${pendingCount}`,
      hintColor: pendingCount > 0 ? "text-z-alert" : "text-z-income",
      href: "/plan?tab=recurrentes",
      expandedContent: (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {formatCurrency(recurring.totalMonthlyExpenses, currency)}/mes en gastos
          </p>
          {nextPayment && (
            <div className="flex items-center justify-between text-xs">
              <span className="truncate text-muted-foreground">{nextPayment.template.merchant_name}</span>
              <span className="shrink-0 font-medium">{formatDate(nextPayment.next_date, "dd MMM")}</span>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""} este mes
          </p>
        </div>
      ),
    },
    {
      key: "drill-deseos",
      title: "Deseos",
      icon: <Heart className="size-3.5" />,
      hint: `${wishlistCount}`,
      hintColor: "text-muted-foreground",
      href: "/plan?tab=deseos",
      expandedContent: (
        <p className="text-xs text-muted-foreground">
          {wishlistCount} item{wishlistCount !== 1 ? "s" : ""} en tu lista de deseos
        </p>
      ),
    },
  ];

  const toggle = (key: string) => onToggle?.(key);
  const activeKey = expanded?.startsWith("drill-") ? expanded : null;

  // Group into rows of 2
  const rows: DrillCard[][] = [];
  for (let i = 0; i < cards.length; i += 2) {
    rows.push(cards.slice(i, i + 2));
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Ir a
      </p>

      {rows.map((row, rowIdx) => {
        const expandedCard = activeKey ? row.find((c) => c.key === activeKey) : null;

        return (
          <div key={rowIdx}>
            {/* Row of 2 cards */}
            <div className="grid grid-cols-2 gap-1.5">
              {row.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => toggle(card.key)}
                  className={cn(
                    PANEL_INSET_CLASS,
                    "flex w-full flex-col items-start gap-1 px-3 py-2.5 text-left transition-colors active:bg-white/[0.03]",
                    activeKey === card.key && "ring-1 ring-z-brass/30 bg-z-brass/[0.06]",
                    activeKey && activeKey !== card.key && "opacity-50",
                  )}
                  aria-expanded={activeKey === card.key}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-muted-foreground">{card.icon}</span>
                    <span className={cn("text-sm font-bold tabular-nums", card.hintColor)}>
                      {card.hint}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold">{card.title}</p>
                </button>
              ))}
            </div>

            {/* Animated expand panel — same pattern as InicioDiscovery */}
            <div
              className="grid transition-[grid-template-rows] duration-200 ease-out"
              style={{ gridTemplateRows: expandedCard ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <div
                  className={cn(
                    "mt-1.5 transition-opacity duration-150",
                    expandedCard ? "opacity-100 delay-75" : "opacity-0",
                  )}
                >
                  {expandedCard && (
                    <div className={cn(PANEL_INSET_CLASS, "border-z-brass/20 bg-black/20 space-y-3 px-4 py-3")}>
                      <p className="text-xs font-semibold">{expandedCard.title}</p>
                      {expandedCard.expandedContent}
                      <Link
                        href={expandedCard.href}
                        className={cn(MOBILE_ACTION_BUTTON_CLASS, "inline-flex items-center gap-1.5")}
                      >
                        Ver {expandedCard.title.toLowerCase()}
                        <ArrowRight className="size-3" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

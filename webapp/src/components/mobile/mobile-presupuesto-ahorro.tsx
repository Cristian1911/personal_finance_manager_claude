"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import {
  AlertTriangle,
  Briefcase,
  Car,
  Flame,
  HeartPulse,
  Home,
  PiggyBank,
  PlusCircle,
  Shield,
  Sparkles,
  Tag,
  TrendingDown,
  Utensils,
} from "lucide-react";
import { FadeIn, StaggerItem, StaggerList } from "./motion";
import type { CategoryBudgetData, CurrencyCode } from "@/types/domain";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home,
  utensils: Utensils,
  car: Car,
  "heart-pulse": HeartPulse,
  sparkles: Sparkles,
  shield: Shield,
  briefcase: Briefcase,
  "plus-circle": PlusCircle,
  tag: Tag,
};

export interface MobilePresupuestoAhorroProps {
  availableToSave: number;
  income: number;
  expenses: number;
  fixedCosts: number;
  currency: string;
  budgetCategories: CategoryBudgetData[];
  savingsStreak: number;
}

export function MobilePresupuestoAhorro({
  availableToSave,
  income,
  expenses,
  fixedCosts,
  currency,
  budgetCategories,
  savingsStreak,
}: MobilePresupuestoAhorroProps) {
  const currencyCode = currency as CurrencyCode;

  const fixedBudgets = budgetCategories.filter(
    (c) => c.expense_type === "fixed" && c.budget !== null && c.budget > 0
  );
  const variableBudgets = budgetCategories.filter(
    (c) => c.expense_type !== "fixed" && c.budget !== null && c.budget > 0
  );
  const unbudgeted = budgetCategories.filter(
    (c) => (c.budget === null || c.budget === 0) && c.spent > 0
  );

  const savePercent =
    income > 0 ? Math.round((availableToSave / income) * 100) : 0;
  const isNegative = availableToSave < 0;

  return (
    <div className="space-y-6">
      {/* Hero: Available to Save */}
      <FadeIn>
        <div
          className={cn(
            "rounded-2xl p-5 text-center space-y-3",
            isNegative
              ? "bg-z-debt/10 border border-z-debt/20"
              : "bg-z-income/10 border border-z-income/20"
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <PiggyBank
              className={cn(
                "size-5",
                isNegative ? "text-z-debt" : "text-z-income"
              )}
            />
            <span className="text-sm font-medium text-muted-foreground">
              Disponible para ahorrar
            </span>
          </div>
          <p
            className={cn(
              "text-3xl font-bold tabular-nums",
              isNegative ? "text-z-debt" : "text-z-income"
            )}
          >
            {formatCurrency(Math.abs(availableToSave), currencyCode)}
          </p>
          {isNegative && (
            <p className="text-xs text-z-debt font-medium">
              Tus gastos superan tus ingresos
            </p>
          )}
          {!isNegative && income > 0 && (
            <p className="text-xs text-muted-foreground">
              {savePercent}% de tus ingresos
            </p>
          )}

          {/* Breakdown */}
          <div className="flex items-center justify-center gap-4 pt-1 text-xs text-muted-foreground">
            <span>
              Ingresos:{" "}
              <span className="text-z-income font-medium">
                {formatCurrency(income, currencyCode)}
              </span>
            </span>
            <span>
              Fijos:{" "}
              <span className="text-z-expense font-medium">
                {formatCurrency(fixedCosts, currencyCode)}
              </span>
            </span>
            <span>
              Variables:{" "}
              <span className="text-z-debt font-medium">
                {formatCurrency(expenses, currencyCode)}
              </span>
            </span>
          </div>
        </div>
      </FadeIn>

      {/* Savings Streak */}
      {savingsStreak > 0 && (
        <FadeIn delay={0.05}>
          <div className="flex items-center gap-3 rounded-xl border p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-z-income/10">
              <Flame className="size-5 text-z-income" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {savingsStreak}{" "}
                {savingsStreak === 1 ? "mes" : "meses"} ahorrando
              </p>
              <p className="text-xs text-muted-foreground">
                Racha consecutiva bajo presupuesto
              </p>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Fixed Budget Categories */}
      {fixedBudgets.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Gastos fijos
          </h3>
          <StaggerList className="space-y-3">
            {fixedBudgets.map((cat) => (
              <StaggerItem key={cat.id}>
                <BudgetRow category={cat} currencyCode={currencyCode} />
              </StaggerItem>
            ))}
          </StaggerList>
        </div>
      )}

      {/* Variable Budget Categories */}
      {variableBudgets.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Gastos variables
          </h3>
          <StaggerList className="space-y-3">
            {variableBudgets.map((cat) => (
              <StaggerItem key={cat.id}>
                <BudgetRow category={cat} currencyCode={currencyCode} />
              </StaggerItem>
            ))}
          </StaggerList>
        </div>
      )}

      {/* Unbudgeted Spending Alerts */}
      {unbudgeted.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-z-alert" />
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Gastos sin presupuesto
            </h3>
          </div>
          <StaggerList className="space-y-2 rounded-lg border border-z-alert/20 bg-z-alert/5 p-3">
            {unbudgeted.map((cat) => (
              <StaggerItem key={cat.id}>
                <UnbudgetedAlertRow
                  category={cat}
                  currencyCode={currencyCode}
                />
              </StaggerItem>
            ))}
          </StaggerList>
          <p className="text-xs text-muted-foreground">
            Asigna un presupuesto para controlar estos gastos
          </p>
        </div>
      )}

      {/* Empty state */}
      {fixedBudgets.length === 0 &&
        variableBudgets.length === 0 &&
        unbudgeted.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay presupuestos configurados.
          </p>
        )}
    </div>
  );
}

function BudgetRow({
  category,
  currencyCode,
}: {
  category: CategoryBudgetData;
  currencyCode: CurrencyCode;
}) {
  const IconComp = ICON_MAP[category.icon] ?? Tag;
  const percent = category.percentUsed;

  const barColor =
    percent > 90
      ? "bg-z-debt"
      : percent >= 70
        ? "bg-z-expense"
        : "bg-z-income";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-md"
            style={{
              backgroundColor: `${category.color}20`,
              color: category.color,
            }}
          >
            <IconComp className="size-3.5" />
          </span>
          <span className="text-sm font-medium truncate">
            {category.name_es ?? category.name}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {percent > 90 && (
            <TrendingDown className="size-3.5 text-z-debt" />
          )}
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatCurrency(category.spent, currencyCode)} /{" "}
            {formatCurrency(category.budget!, currencyCode)}
          </span>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

function UnbudgetedAlertRow({
  category,
  currencyCode,
}: {
  category: CategoryBudgetData;
  currencyCode: CurrencyCode;
}) {
  const IconComp = ICON_MAP[category.icon] ?? Tag;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-md"
          style={{
            backgroundColor: `${category.color}20`,
            color: category.color,
          }}
        >
          <IconComp className="size-3.5" />
        </span>
        <span className="text-sm font-medium truncate">
          {category.name_es ?? category.name}
        </span>
      </div>
      <span className="text-sm tabular-nums text-z-alert font-medium whitespace-nowrap ml-2">
        {formatCurrency(category.spent, currencyCode)}
      </span>
    </div>
  );
}

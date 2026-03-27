"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import {
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  AlertCircle,
  Tag,
  Home,
  Utensils,
  Car,
  HeartPulse,
  Sparkles,
  Shield,
  Briefcase,
  PlusCircle,
} from "lucide-react";
import { FadeIn, StaggerList, StaggerItem } from "./motion";
import type {
  Transaction,
  Category,
  CategoryWithChildren,
  CategoryBudgetData,
  CurrencyCode,
} from "@/types/domain";

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

export interface MobileMovimientosPresupuestoProps {
  transactions: Transaction[];
  categories: CategoryWithChildren[];
  budgetCategories: CategoryBudgetData[];
}

/** Flatten a tree of CategoryWithChildren into a flat Category array */
function flattenCategories(tree: CategoryWithChildren[]): Category[] {
  const result: Category[] = [];
  for (const node of tree) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { children, ...cat } = node;
    result.push(cat);
    if (node.children.length > 0) {
      result.push(...flattenCategories(node.children));
    }
  }
  return result;
}

export function MobileMovimientosPresupuesto({
  transactions,
  categories,
  budgetCategories,
}: MobileMovimientosPresupuestoProps) {
  const categoryMap = useMemo(() => {
    const flat = flattenCategories(categories);
    const map = new Map<string, Category>();
    for (const cat of flat) {
      map.set(cat.id, cat);
    }
    return map;
  }, [categories]);

  const { inflow, outflow } = useMemo(() => {
    let inflowSum = 0;
    let outflowSum = 0;
    for (const t of transactions) {
      if (t.is_excluded) continue;
      if (t.direction === "INFLOW") {
        inflowSum += t.amount;
      } else {
        outflowSum += t.amount;
      }
    }
    return { inflow: inflowSum, outflow: outflowSum };
  }, [transactions]);

  // Determine the primary currency from the first non-excluded transaction
  const currency = useMemo(() => {
    const first = transactions.find((t) => !t.is_excluded);
    return (first?.currency_code ?? "COP") as CurrencyCode;
  }, [transactions]);

  const activeBudgets = useMemo(
    () => budgetCategories.filter((c) => c.budget !== null && c.budget > 0),
    [budgetCategories]
  );

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const tx of transactions) {
      const date = tx.transaction_date;
      const existing = groups.get(date);
      if (existing) {
        existing.push(tx);
      } else {
        groups.set(date, [tx]);
      }
    }

    // Sort by date descending
    return Array.from(groups.entries()).sort(([a], [b]) =>
      b.localeCompare(a)
    );
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground">No hay movimientos este mes</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Spending summary */}
      <FadeIn>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Gastos</p>
              <p className="font-semibold text-z-expense">
                {formatCurrency(outflow, currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ingresos</p>
              <p className="font-semibold text-z-income">
                {formatCurrency(inflow, currency)}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground">Balance</p>
              <p
                className={cn(
                  "font-semibold",
                  inflow >= outflow ? "text-z-income" : "text-z-expense"
                )}
              >
                {inflow >= outflow ? "+" : "-"}
                {formatCurrency(Math.abs(inflow - outflow), currency)}
              </p>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Compact budget progress bars */}
      {activeBudgets.length > 0 && (
        <FadeIn delay={0.05}>
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Presupuestos
            </h3>
            <StaggerList className="space-y-3">
              {activeBudgets.map((cat) => (
                <StaggerItem key={cat.id}>
                  <BudgetRow category={cat} />
                </StaggerItem>
              ))}
            </StaggerList>
          </div>
        </FadeIn>
      )}

      {/* Date-grouped transaction feed */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Movimientos
        </h3>
        <StaggerList className="space-y-4">
          {groupedByDate.map(([date, txs]) => (
            <StaggerItem key={date}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {formatDate(date, "EEEE, dd MMM")}
              </p>
              <div className="space-y-1">
                {txs.map((tx) => {
                  const cat = tx.category_id
                    ? categoryMap.get(tx.category_id)
                    : undefined;
                  const description =
                    tx.merchant_name ||
                    tx.clean_description ||
                    tx.raw_description ||
                    "Sin descripcion";

                  return (
                    <Link
                      key={tx.id}
                      href={`/transactions/${tx.id}`}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-2 py-2 -mx-2 hover:bg-muted transition-colors",
                        tx.is_excluded && "opacity-40"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                            tx.direction === "INFLOW"
                              ? "bg-z-income/10 text-z-income"
                              : "bg-z-expense/10 text-z-expense"
                          )}
                        >
                          {tx.direction === "INFLOW" ? (
                            <ArrowDownLeft className="h-4 w-4" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {description}
                          </p>
                          {cat && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <span
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: cat.color }}
                              />
                              {cat.name_es ?? cat.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-sm font-medium shrink-0 ml-2",
                          tx.direction === "INFLOW" && "text-z-income",
                          tx.is_excluded && "line-through"
                        )}
                      >
                        {tx.direction === "INFLOW" ? "+" : "-"}
                        {formatCurrency(tx.amount, tx.currency_code)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </StaggerItem>
          ))}
        </StaggerList>
      </div>
    </div>
  );
}

function BudgetRow({ category }: { category: CategoryBudgetData }) {
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
            style={{ backgroundColor: `${category.color}20`, color: category.color }}
          >
            <IconComp className="size-3.5" />
          </span>
          <span className="text-sm font-medium truncate">
            {category.name_es ?? category.name}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {percent > 90 && <AlertTriangle className="size-3.5 text-z-debt" />}
          {percent >= 70 && percent <= 90 && <AlertCircle className="size-3.5 text-z-expense" />}
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatCurrency(category.spent)} / {formatCurrency(category.budget!)}
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

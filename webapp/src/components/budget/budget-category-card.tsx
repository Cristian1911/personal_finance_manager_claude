"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  Utensils,
  Car,
  HeartPulse,
  Sparkles,
  Shield,
  Briefcase,
  PlusCircle,
  Tag,
  ChevronDown,
  ChevronRight,
  Repeat,
} from "lucide-react";
import type { CategoryBudgetData } from "@/types/domain";

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

interface BudgetCategoryCardProps {
  category: CategoryBudgetData;
  onSetBudget: (categoryId: string) => void;
}

export function BudgetCategoryCard({
  category,
  onSetBudget,
}: BudgetCategoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasBudget = category.budget !== null && category.budget > 0;
  const hasRecurring = category.committedRecurring > 0;
  const IconComp = ICON_MAP[category.icon] ?? Tag;

  const recurringPercent =
    hasBudget && category.budget! > 0
      ? (category.committedRecurring / category.budget!) * 100
      : 0;
  const spentPercent = category.percentUsed;
  // Flexible = budget minus recurring committed
  const flexible =
    hasBudget ? Math.max(0, category.budget! - category.committedRecurring) : 0;

  const totalPercent = spentPercent;
  const barColor =
    totalPercent >= 100
      ? "bg-z-debt"
      : totalPercent >= 80
        ? "bg-z-expense"
        : undefined;

  return (
    <Card
      className={cn(
        "py-4 gap-3 transition-colors",
        !hasBudget && "bg-muted/40"
      )}
    >
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="flex size-7 items-center justify-center rounded-md"
              style={{ backgroundColor: `${category.color}20`, color: category.color }}
            >
              <IconComp className="size-4" />
            </span>
            <CardTitle className="text-sm">
              {category.name_es ?? category.name}
            </CardTitle>
            {category.expense_type && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {category.expense_type === "fixed" ? "Fijo" : "Variable"}
              </Badge>
            )}
          </div>
          {category.children.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {hasBudget ? (
          <div className="space-y-1.5">
            {/* Progress bar with recurring + spent segments */}
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
              {/* Recurring committed segment (striped pattern) */}
              {hasRecurring && (
                <div
                  className="h-full opacity-40"
                  style={{
                    width: `${Math.min(recurringPercent, 100)}%`,
                    backgroundColor: category.color,
                    backgroundImage:
                      "repeating-linear-gradient(135deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 4px)",
                  }}
                />
              )}
              {/* Actual spent segment */}
              <div
                className={cn("h-full transition-all", barColor)}
                style={{
                  width: `${Math.min(spentPercent, Math.max(0, 100 - recurringPercent))}%`,
                  ...(barColor
                    ? {}
                    : { backgroundColor: category.color }),
                }}
              />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium">
                Gastado: {formatCurrency(category.spent)}
                <span className="text-muted-foreground font-normal">
                  {" "}de {formatCurrency(category.budget!)}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Disponible:{" "}
                <span className={category.spent > category.budget! ? "text-z-debt" : "text-z-income"}>
                  {formatCurrency(Math.max(0, category.budget! - category.spent))}
                </span>
              </p>
            </div>
            {/* Recurring breakdown */}
            {hasRecurring && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Repeat className="size-3" />
                <span>
                  {formatCurrency(category.committedRecurring)} fijos &middot;{" "}
                  {formatCurrency(flexible)} flexible
                </span>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => onSetBudget(category.id)}
            className="text-xs text-primary hover:underline"
          >
            Fijar presupuesto
          </button>
        )}

        {/* Expanded subcategories */}
        {expanded && category.children.length > 0 && (
          <ul className="mt-3 space-y-1 border-t pt-2">
            {category.children.map((child) => (
              <li
                key={child.id}
                className="flex items-center gap-2 text-xs text-muted-foreground pl-2"
              >
                <span
                  className="inline-block size-2 rounded-full shrink-0"
                  style={{ backgroundColor: category.color }}
                />
                {child.name_es ?? child.name}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

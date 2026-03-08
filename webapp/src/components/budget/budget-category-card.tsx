"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const IconComp = ICON_MAP[category.icon] ?? Tag;

  const barColor =
    category.percentUsed >= 100
      ? "bg-red-500"
      : category.percentUsed >= 80
        ? "bg-amber-500"
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
            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", barColor)}
                style={{
                  width: `${Math.min(category.percentUsed, 100)}%`,
                  ...(barColor
                    ? {}
                    : { backgroundColor: category.color }),
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(category.spent)} / {formatCurrency(category.budget!)} &mdash;{" "}
              {Math.round(category.percentUsed)}%
            </p>
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

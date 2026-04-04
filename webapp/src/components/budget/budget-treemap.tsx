"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { CategoryIcon } from "@/components/categories/category-icon";
import type { CategoryBudgetData, CurrencyCode } from "@/types/domain";

interface BudgetTreemapProps {
  categories: CategoryBudgetData[];
  budgetAmounts: Record<string, number>;
  currency: CurrencyCode;
  onCategoryClick?: (categoryId: string) => void;
}

function subZoneBg(color: string, index: number) {
  const opacities = [0.18, 0.12, 0.08, 0.06];
  const o = opacities[index] ?? 0.06;
  return `${color}${Math.round(o * 255).toString(16).padStart(2, "0")}`;
}

export function BudgetTreemap({
  categories,
  budgetAmounts,
  currency,
  onCategoryClick,
}: BudgetTreemapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return categories
      .filter((c) => c.direction === "OUTFLOW")
      .map((c) => ({ ...c, _budget: budgetAmounts[c.id] ?? 0 }))
      .filter((c) => c._budget > 0)
      .sort((a, b) => b._budget - a._budget);
  }, [categories, budgetAmounts]);

  const totalBudget = useMemo(
    () => sorted.reduce((s, c) => s + c._budget, 0),
    [sorted],
  );

  if (sorted.length === 0) return null;

  // Split into big (top row) and small (bottom row)
  const bigThreshold = totalBudget * 0.08;
  const bigCats = [...sorted.filter((c) => c._budget >= bigThreshold)];
  const smallCats = [...sorted.filter((c) => c._budget < bigThreshold)];

  while (bigCats.length < 3 && smallCats.length > 0) {
    bigCats.push(smallCats.shift()!);
  }

  return (
    <div className="rounded-2xl border border-white/6 bg-[#111411] p-1.5 overflow-hidden">
      <div className="flex flex-col gap-1.5">
        {/* Top row — large categories with subcategories */}
        {bigCats.length > 0 && (
          <div className="flex gap-1.5" style={{ minHeight: 170 }}>
            {bigCats.map((cat) => (
              <TreemapCell
                key={cat.id}
                cat={cat}
                flex={cat._budget}
                totalBudget={totalBudget}
                currency={currency}
                isHovered={hoveredId === cat.id}
                onHover={setHoveredId}
                onClick={() => onCategoryClick?.(cat.id)}
                showSubs
              />
            ))}
          </div>
        )}

        {/* Bottom row — small categories */}
        {smallCats.length > 0 && (
          <div className="flex gap-1.5" style={{ minHeight: 72 }}>
            {smallCats.slice(0, 6).map((cat) => (
              <TreemapCell
                key={cat.id}
                cat={cat}
                flex={cat._budget}
                totalBudget={totalBudget}
                currency={currency}
                isHovered={hoveredId === cat.id}
                onHover={setHoveredId}
                onClick={() => onCategoryClick?.(cat.id)}
                compact
              />
            ))}
            {smallCats.length > 6 && (
              <div
                className="flex items-center justify-center rounded-xl bg-white/[0.02] border border-white/6 text-xs text-muted-foreground"
                style={{ flex: smallCats.slice(6).reduce((s, c) => s + c._budget, 0) }}
              >
                +{smallCats.length - 6}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Treemap cell ────────────────────────────────────────────

function TreemapCell({
  cat,
  flex,
  totalBudget,
  currency,
  isHovered,
  onHover,
  onClick,
  showSubs,
  compact,
}: {
  cat: CategoryBudgetData & { _budget: number };
  flex: number;
  totalBudget: number;
  currency: CurrencyCode;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onClick: () => void;
  showSubs?: boolean;
  compact?: boolean;
}) {
  const ratio = cat._budget > 0 ? cat.spent / cat._budget : 0;
  const isHighSpent = ratio >= 0.8;
  const pctOfTotal = totalBudget > 0 ? Math.round((cat._budget / totalBudget) * 100) : 0;

  const childrenWithSpending = showSubs
    ? cat.children.filter((child) => (cat.childrenSpent[child.id] ?? 0) > 0)
    : [];

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl cursor-pointer",
        "border transition-all duration-200",
        isHovered
          ? "border-white/12 shadow-[0_8px_24px_rgba(0,0,0,0.4)] -translate-y-0.5"
          : isHighSpent
            ? "border-[rgba(224,85,69,0.15)]"
            : "border-white/6",
      )}
      style={{
        flex,
        background: `linear-gradient(160deg, ${cat.color}12, ${cat.color}06)`,
      }}
      onMouseEnter={() => onHover(cat.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Glass tint */}
      <div
        className="absolute inset-0 rounded-xl opacity-[0.08]"
        style={{ background: `linear-gradient(135deg, ${cat.color}, transparent)` }}
      />

      {/* Header */}
      <div className={cn("flex items-center gap-2 z-[2] relative", compact ? "p-2.5" : "px-3 pt-3")}>
        {!compact && (
          <span
            className="flex size-[22px] shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
          >
            <CategoryIcon icon={cat.icon} className="size-3" />
          </span>
        )}
        <span className={cn("font-semibold text-white/90 truncate", compact ? "text-[11px]" : "text-xs")}>
          {cat.name_es ?? cat.name}
        </span>
      </div>

      {/* Amount */}
      {!compact && (
        <p className="text-[10px] text-white/40 px-3 mt-0.5 z-[2] relative tabular-nums">
          {formatCurrency(cat.spent, currency)} de {formatCurrency(cat._budget, currency)}
        </p>
      )}

      {/* Nested subcategory zones */}
      {childrenWithSpending.length > 0 && (
        <div className="flex gap-2 mx-3 mb-4 mt-auto z-[2] relative flex-1 min-h-0 pt-2">
          {childrenWithSpending.map((child, i) => {
            const childSpent = cat.childrenSpent[child.id] ?? 0;
            return (
              <div
                key={child.id}
                className="relative flex flex-col items-center justify-center text-center rounded-lg overflow-hidden min-w-0"
                style={{
                  flex: childSpent,
                  backgroundColor: subZoneBg(cat.color, i),
                }}
              >
                <span className="text-[10px] font-medium text-white/60 truncate max-w-full px-2">
                  {child.name_es ?? child.name}
                </span>
                <span className="text-[9px] text-white/30 tabular-nums">
                  {formatCurrency(childSpent, currency)}
                </span>
                {/* Mini progress */}
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/15">
                  <div
                    className="h-full"
                    style={{
                      width: `${cat.spent > 0 ? Math.min((childSpent / cat.spent) * 100, 100) : 0}%`,
                      backgroundColor: `${cat.color}50`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* % watermark */}
      <span className={cn(
        "absolute bottom-1.5 right-2.5 font-extrabold text-white/[0.04] z-[1] leading-none",
        compact ? "text-lg" : "text-[28px]",
      )}>
        {pctOfTotal}%
      </span>

      {/* Bottom progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/[0.03]">
        <div
          className="h-full transition-all"
          style={{
            width: `${Math.min(ratio * 100, 100)}%`,
            backgroundColor: isHighSpent ? "rgba(224,85,69,0.5)" : "rgba(255,255,255,0.3)",
          }}
        />
      </div>
    </div>
  );
}

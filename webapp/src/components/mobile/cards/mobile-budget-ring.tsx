"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { ChevronRight } from "lucide-react";
import type { CurrencyCode } from "@/types/domain";
import { ExpandableCard } from "./expandable-card";

interface TopCategory {
  name: string;
  percentUsed: number;
}

interface MobileBudgetRingProps {
  totalTarget: number;
  totalSpent: number;
  progress: number;
  currency: CurrencyCode;
  topCategories: TopCategory[];
}

function getStatusMessage(progress: number): string {
  if (progress >= 100) return "Presupuesto superado";
  if (progress >= 80) return "Cerca del límite";
  if (progress >= 50) return "Vas bien este mes";
  return "Buen ritmo";
}

function ProgressRing({
  progress,
  size = 44,
  strokeWidth = 4,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(progress, 100);
  const strokeDasharray = `${(filled / 100) * circumference} ${circumference}`;
  const isOver = progress >= 100;
  const isHigh = progress >= 80;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isOver ? "#c44" : isHigh ? "#d4a853" : "#a8b5a0"}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn(
            "text-[11px] font-bold",
            isOver ? "text-z-debt" : "text-z-sage-lightest"
          )}
        >
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
}

export function MobileBudgetRing({
  totalTarget,
  totalSpent,
  progress,
  currency,
  topCategories,
}: MobileBudgetRingProps) {
  const [expanded, setExpanded] = useState(false);

  if (totalTarget === 0) return null;

  return (
    <ExpandableCard
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      compact={
        <div className="flex items-center gap-3 px-4 py-3">
          <ProgressRing progress={progress} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-z-sage-light">Presupuesto</p>
            <p className="text-[11px] text-muted-foreground">
              {formatCurrency(totalSpent, currency)} de {formatCurrency(totalTarget, currency)} — {getStatusMessage(progress)}
            </p>
          </div>
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-90"
            )}
          />
        </div>
      }
      detail={
        <div className="px-4 pb-3 pt-0">
          <div className="rounded-xl bg-black/20 p-3">
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Categorías con más gasto
            </p>
            {topCategories.length > 0 ? (
              <div className="space-y-2">
                {topCategories.map((cat) => (
                  <div key={cat.name}>
                    <div className="flex justify-between text-[11px] text-z-sage-light">
                      <span>{cat.name}</span>
                      <span>{Math.round(cat.percentUsed)}%</span>
                    </div>
                    <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-white/5">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          cat.percentUsed >= 100
                            ? "bg-z-debt"
                            : cat.percentUsed >= 80
                              ? "bg-z-brass"
                              : "bg-z-sage-light"
                        )}
                        style={{ width: `${Math.min(cat.percentUsed, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">Sin categorías presupuestadas</p>
            )}
          </div>
          <Link
            href="/plan"
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-white/8 bg-white/3 px-3 py-2 text-[11px] font-semibold text-z-sage-light transition-colors hover:bg-white/5"
          >
            Ir a presupuesto <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      }
    />
  );
}

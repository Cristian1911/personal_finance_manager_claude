"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

export interface TopCategory {
  name: string;
  percentUsed: number;
}

export interface MobileBudgetTileProps {
  totalTarget: number;
  totalSpent: number;
  progress: number;
  topCategories: TopCategory[];
}

// ─── Tile (compact, for the side-by-side row) ────────────────────────────────

export function BudgetTile({
  progress,
  active,
  onClick,
}: {
  progress: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-center rounded-xl border bg-[#111] p-2.5 text-center transition-colors",
        active ? "border-z-sage-light/25" : "border-white/4"
      )}
      aria-expanded={active}
    >
      <ProgressRing progress={progress} />
      <span className={cn(
        "mt-1 text-[7px] font-semibold uppercase tracking-[0.1em]",
        active ? "text-z-sage-light" : "text-muted-foreground"
      )}>
        Presupuesto
      </span>
    </button>
  );
}

// ─── Detail panel (full-width, rendered below tiles row) ─────────────────────

export function BudgetDetail({ topCategories }: { topCategories: TopCategory[] }) {
  return (
    <div className="rounded-xl border border-white/6 bg-[#111] p-3">
      <p className="mb-2 text-[10px] font-semibold text-z-sage-light">Categorías con más gasto</p>
      {topCategories.length > 0 ? (
        <div className="space-y-2">
          {topCategories.map((cat) => (
            <div key={cat.name}>
              <div className="flex justify-between text-[10px] text-z-sage-light">
                <span>{cat.name}</span>
                <span>{Math.round(cat.percentUsed)}%</span>
              </div>
              <div className="mt-1 h-[2px] overflow-hidden rounded-full bg-white/5">
                <div
                  className={cn(
                    "h-full rounded-full",
                    cat.percentUsed >= 100 ? "bg-z-debt" : cat.percentUsed >= 80 ? "bg-z-brass" : "bg-z-sage-light"
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
      <Link
        href="/plan"
        className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-white/8 bg-white/3 px-3 py-1.5 text-[11px] font-semibold text-z-sage-light transition-colors hover:bg-white/5"
      >
        Ir a presupuesto <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

// ─── Progress Ring SVG ───────────────────────────────────────────────────────

function ProgressRing({ progress, size = 38 }: { progress: number; size?: number }) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(progress, 100);
  const strokeDasharray = `${(filled / 100) * circumference} ${circumference}`;
  const isOver = progress >= 100;
  const isHigh = progress >= 80;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={isOver ? "#c44" : isHigh ? "#d4a853" : "#a8b5a0"}
          strokeWidth={strokeWidth} strokeDasharray={strokeDasharray} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("text-[9px] font-bold", isOver ? "text-z-debt" : "text-z-sage-lightest")}>
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
}

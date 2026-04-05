"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MetricChip {
  id: string;
  label: string;
  value: string;
  accent?: "brass" | "income" | "expense" | "debt";
}

interface LinkedMetricDetailPanelProps {
  chips: MetricChip[];
  activeChip: string | null;
  onToggle: (id: string) => void;
  renderDetail: (chipId: string) => ReactNode;
  className?: string;
}

// ─── Accent colors ───────────────────────────────────────────────────────────

const accentStyles = {
  brass: {
    active: "bg-z-brass/10 ring-1 ring-z-brass/30 text-z-brass",
    value: "text-z-brass",
    panel: "border-z-brass/20",
  },
  income: {
    active: "bg-z-income/10 ring-1 ring-z-income/30 text-z-income",
    value: "text-z-income",
    panel: "border-z-income/20",
  },
  expense: {
    active: "bg-z-expense/10 ring-1 ring-z-expense/30 text-z-expense",
    value: "text-z-expense",
    panel: "border-z-expense/20",
  },
  debt: {
    active: "bg-z-debt/10 ring-1 ring-z-debt/30 text-z-debt",
    value: "text-z-debt",
    panel: "border-z-debt/20",
  },
} as const;

// ─── Component ───────────────────────────────────────────────────────────────

export function LinkedMetricDetailPanel({
  chips,
  activeChip,
  onToggle,
  renderDetail,
  className,
}: LinkedMetricDetailPanelProps) {
  const activeChipData = chips.find((c) => c.id === activeChip);
  const panelAccent = activeChipData?.accent ?? "brass";

  return (
    <div className={className}>
      {/* Chip row */}
      <div className="flex gap-1.5">
        {chips.map((chip) => {
          const isActive = activeChip === chip.id;
          const accent = chip.accent ?? "brass";
          const styles = accentStyles[accent];

          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onToggle(chip.id)}
              className={cn(
                "flex flex-1 flex-col items-center rounded-xl bg-black/20 px-2 py-1.5 transition-colors",
                isActive && styles.active
              )}
              aria-expanded={isActive}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {chip.label}
              </span>
              <span
                className={cn(
                  "text-[13px] font-semibold",
                  isActive ? styles.value : "text-z-sage-light"
                )}
              >
                {chip.value}
              </span>
            </button>
          );
        })}
      </div>

      {/* Expandable detail panel */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: activeChip ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "mt-2 transition-opacity duration-150",
              activeChip ? "opacity-100 delay-75" : "opacity-0"
            )}
          >
            {activeChip && (
              <div
                className={cn(
                  PANEL_INSET_CLASS,
                  "border-white/8 bg-black/20 p-3",
                  accentStyles[panelAccent].panel
                )}
              >
                {renderDetail(activeChip)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

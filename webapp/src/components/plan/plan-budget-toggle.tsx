"use client";

import { useState, type ReactNode } from "react";
import { RhythmView } from "@/components/budget/rhythm-view";
import type { CurrencyCode } from "@/types/domain";
import type { RhythmGroup } from "@/actions/categories";

interface PlanBudgetToggleProps {
  domainView: ReactNode;
  rhythmGroups: RhythmGroup[];
  currency: CurrencyCode;
}

export function PlanBudgetToggle({ domainView, rhythmGroups, currency }: PlanBudgetToggleProps) {
  const [viewMode, setViewMode] = useState<"domain" | "rhythm">("domain");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-full bg-white/5 p-0.5 w-fit">
        <button
          type="button"
          onClick={() => setViewMode("domain")}
          className={`rounded-full px-4 py-1 text-sm transition-colors ${
            viewMode === "domain"
              ? "bg-indigo-500/20 font-semibold text-indigo-300"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Dominio
        </button>
        <button
          type="button"
          onClick={() => setViewMode("rhythm")}
          className={`rounded-full px-4 py-1 text-sm transition-colors ${
            viewMode === "rhythm"
              ? "bg-indigo-500/20 font-semibold text-indigo-300"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Ritmo
        </button>
      </div>

      {viewMode === "domain" ? (
        domainView
      ) : (
        <RhythmView groups={rhythmGroups} currency={currency} />
      )}
    </div>
  );
}

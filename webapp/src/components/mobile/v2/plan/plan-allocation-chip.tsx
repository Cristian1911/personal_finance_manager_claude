"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Plan5030Sheet20 } from "./plan-5030-20-sheet";
import type { AllocationData } from "@/actions/allocation";

interface PlanAllocationChipProps {
  allocation: AllocationData | null;
  needsLabel?: string;
  wantsLabel?: string;
  /**
   * Optional fallback percents if allocation is null. When allocation is
   * available we prefer allocation.needs.percent / allocation.wants.percent.
   */
  fallbackNeedsPct?: number;
  fallbackWantsPct?: number;
}

export function PlanAllocationChip({
  allocation,
  needsLabel = "Necesario",
  wantsLabel = "Deseos",
  fallbackNeedsPct = 0,
  fallbackWantsPct = 0,
}: PlanAllocationChipProps) {
  const [open, setOpen] = useState(false);

  const needsPct = allocation
    ? Math.round(allocation.needs.percent)
    : Math.round(fallbackNeedsPct);
  const wantsPct = allocation
    ? Math.round(allocation.wants.percent)
    : Math.round(fallbackWantsPct);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!allocation}
        className="flex items-center gap-1.5 text-[10px] text-muted-foreground transition-colors active:text-foreground disabled:cursor-default disabled:opacity-60"
      >
        <span>
          {needsLabel} {needsPct}%
        </span>
        <span className="text-white/15">|</span>
        <span>
          {wantsLabel} {wantsPct}%
        </span>
        {allocation && (
          <span className="ml-1 flex items-center gap-0.5 text-z-brass">
            50/30/20 <ArrowUpRight className="size-2.5" aria-hidden />
          </span>
        )}
      </button>
      <Plan5030Sheet20
        open={open}
        onOpenChange={setOpen}
        allocation={allocation}
      />
    </>
  );
}

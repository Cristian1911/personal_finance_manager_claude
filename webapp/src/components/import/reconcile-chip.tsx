"use client";

import { ChevronDown } from "lucide-react";
import { PANEL_INSET_SUBTLE_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";

type Tone = "income" | "brass" | "alert" | "muted";

type Props = {
  label: string;
  value: number | string;
  hint?: string;
  tone?: Tone;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
};

const TONE_VALUE: Record<Tone, string> = {
  income: "text-z-income",
  brass: "text-z-brass",
  alert: "text-z-alert",
  muted: "text-z-sage-light",
};

const TONE_LABEL: Record<Tone, string> = {
  income: "text-z-income/80",
  brass: "text-z-brass/80",
  alert: "text-z-alert/80",
  muted: "text-z-sage-dark",
};

const TONE_RING: Record<Tone, string> = {
  income: "ring-z-income/35 bg-z-income/[0.05]",
  brass: "ring-z-brass/35 bg-z-brass/[0.05]",
  alert: "ring-z-alert/35 bg-z-alert/[0.05]",
  muted: "ring-white/20 bg-white/[0.03]",
};

/**
 * Expandable stat tile used in the reconcile grid.
 * Vertical card layout (label → value → optional hint) matching the
 * widget tiles on Flow 02 (Ritmo, Gasto de hoy, Por resolver).
 */
export function ReconcileChip({
  label,
  value,
  hint,
  tone = "brass",
  active = false,
  onClick,
  disabled = false,
}: Props) {
  const interactive = !!onClick && !disabled;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      aria-expanded={active}
      className={cn(
        PANEL_INSET_SUBTLE_CLASS,
        "relative flex h-full min-h-[96px] w-full flex-col items-center justify-center gap-1.5 px-3 py-3 text-center transition-colors",
        active && `ring-1 ${TONE_RING[tone]}`,
        interactive && "hover:bg-white/[0.04]",
        !interactive && "cursor-default opacity-70",
      )}
    >
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.18em]",
          TONE_LABEL[tone],
        )}
      >
        {label}
      </p>
      <p className={cn("text-2xl font-bold tabular-nums tracking-tight", TONE_VALUE[tone])}>
        {value}
      </p>
      {hint && (
        <p className="text-[10px] text-z-sage-dark">{hint}</p>
      )}
      {interactive && (
        <ChevronDown
          className={cn(
            "absolute bottom-2 right-2 h-3.5 w-3.5 text-z-sage-dark transition-transform",
            active && "rotate-180",
          )}
        />
      )}
    </button>
  );
}

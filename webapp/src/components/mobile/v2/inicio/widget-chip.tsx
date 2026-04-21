"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PANEL_INSET_SUBTLE_CLASS } from "@/lib/constants/styles";

export type ChipTone =
  | "brass"
  | "income"
  | "expense"
  | "debt"
  | "foreground"
  | "muted";

const TONE_RING: Record<ChipTone, string> = {
  brass: "ring-z-brass/35 bg-z-brass/[0.04]",
  income: "ring-z-income/35 bg-z-income/[0.04]",
  expense: "ring-z-expense/35 bg-z-expense/[0.04]",
  debt: "ring-z-debt/35 bg-z-debt/[0.04]",
  foreground: "ring-white/20 bg-white/[0.03]",
  muted: "ring-white/10 bg-white/[0.015]",
};

interface ExpandableChipProps {
  tone: ChipTone;
  active: boolean;
  dimmed: boolean;
  editing?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  accessibilityLabel?: string;
  children: React.ReactNode;
}

/**
 * Chip primitive for the mobile dashboard widget grid (Flow 02 Variant B).
 * Visual states:
 *  - `active` — brass-tinted ring; sibling chips in the same row are dimmed.
 *  - `editing` — shows an × remove affordance; chip tap is disabled.
 */
export function ExpandableChip({
  tone,
  active,
  dimmed,
  editing,
  onPress,
  onRemove,
  accessibilityLabel,
  children,
}: ExpandableChipProps) {
  return (
    <div
      className={cn(
        "relative transition-opacity",
        dimmed && "opacity-40",
      )}
    >
      <button
        type="button"
        onClick={onPress}
        aria-expanded={active}
        aria-label={accessibilityLabel}
        className={cn(
          PANEL_INSET_SUBTLE_CLASS,
          "flex h-full w-full flex-col justify-between px-3 py-3.5 transition-colors min-h-[120px] active:bg-white/[0.04]",
          active && `ring-1 ${TONE_RING[tone]}`,
          editing && "border-dashed border-z-brass/40 bg-z-brass/[0.03]",
        )}
      >
        {children}
      </button>
      {editing && onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          aria-label="Quitar widget"
          className="absolute -right-1.5 -top-1.5 inline-flex size-6 items-center justify-center rounded-full border border-white/10 bg-z-debt/90 text-z-white shadow-sm transition-colors active:bg-z-debt"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

interface ChipEyebrowProps {
  tone?: ChipTone;
  children: React.ReactNode;
}

const TONE_TEXT: Record<ChipTone, string> = {
  brass: "text-z-brass",
  income: "text-z-income",
  expense: "text-z-expense",
  debt: "text-z-debt",
  foreground: "text-z-sage-dark",
  muted: "text-muted-foreground",
};

export function ChipEyebrow({ tone = "foreground", children }: ChipEyebrowProps) {
  return (
    <p
      className={cn(
        "text-[10px] font-semibold uppercase tracking-[0.18em]",
        TONE_TEXT[tone],
      )}
    >
      {children}
    </p>
  );
}

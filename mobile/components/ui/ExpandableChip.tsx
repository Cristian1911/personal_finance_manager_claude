import { Pressable, Text } from "react-native";
import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";
import { COLORS } from "../../lib/constants/colors";

export type ChipTone = "brass" | "income" | "debt" | "alert" | "foreground";

type ToneStyles = {
  value: string;
  label: string;
  activeBorder: string;
  activeFill: string;
};

const TONE: Record<ChipTone, ToneStyles> = {
  brass: {
    value: "text-z-brass",
    label: "text-z-brass",
    activeBorder: "border-z-brass-50",
    activeFill: "bg-z-brass-10",
  },
  income: {
    value: "text-z-income",
    label: "text-z-income",
    activeBorder: "border-z-income-30",
    activeFill: "bg-z-income-10",
  },
  debt: {
    value: "text-z-debt",
    label: "text-z-debt",
    activeBorder: "border-z-debt-30",
    activeFill: "bg-z-debt-12",
  },
  alert: {
    value: "text-z-alert",
    label: "text-z-alert",
    activeBorder: "border-z-alert-25",
    activeFill: "bg-z-alert-12",
  },
  foreground: {
    value: "text-foreground",
    label: "text-z-sage-dark",
    activeBorder: "border-white-25",
    activeFill: "bg-z-surface-2-10",
  },
};

interface ExpandableChipProps {
  tone?: ChipTone;
  active: boolean;
  dimmed?: boolean;
  onPress: () => void;
  editing?: boolean;
  onRemove?: () => void;
  accessibilityLabel?: string;
  children: ReactNode;
}

/**
 * Expandable chip wrapper (tap-to-expand, shared accordion owned by parent).
 * Renders arbitrary children — each widget supplies its own bespoke chip
 * layout, getting the interaction model for free.
 *
 * - Active: tinted border + tinted fill (by tone)
 * - Dimmed: sibling in same row is active → opacity-50
 * - Editing: disables press + shows × remove button
 */
export function ExpandableChip({
  tone = "brass",
  active,
  dimmed = false,
  onPress,
  editing = false,
  onRemove,
  accessibilityLabel,
  children,
}: ExpandableChipProps) {
  const t = TONE[tone];
  const activeCls = active ? `${t.activeBorder} ${t.activeFill}` : "";
  const dimCls = dimmed && !active ? "opacity-50" : "";

  return (
    <Pressable
      onPress={editing ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: active, disabled: editing }}
      accessibilityLabel={accessibilityLabel}
      className={`${PANEL_INSET_CLASS} flex-1 p-3 ${activeCls} ${dimCls}`}
      style={{ minHeight: 88 }}
    >
      {children}
      {editing && onRemove && (
        <Pressable
          onPress={onRemove}
          accessibilityLabel="Quitar chip"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full border border-z-debt-30 bg-z-surface-2"
        >
          <X size={12} color={COLORS.debt} />
        </Pressable>
      )}
    </Pressable>
  );
}

/**
 * Shared eyebrow for chip headers (top-aligned, tinted by tone).
 * Matches the "NEXT BILL" / "ACCOUNTS" label style in the Claude design.
 */
export function ChipEyebrow({
  tone = "brass",
  children,
}: {
  tone?: ChipTone;
  children: string;
}) {
  const t = TONE[tone];
  return (
    <Text
      // tracking mirrors the webapp's `tracking-[0.18em]` at a 10px font.
      // Two lines, not one: the webapp counterpart is a <p> that wraps, so
      // truncating here clipped "Gasto de hoy" / "Por resolver" in the
      // 3-column tools row. minHeight reserves both lines so a 1-line eyebrow
      // ("Ritmo") doesn't pull its tile's content up relative to a 2-line
      // neighbour, which left the row with a jagged bottom edge.
      className={`text-[10px] font-inter-semibold uppercase tracking-[1.8px] ${t.label}`}
      style={{ minHeight: 26 }}
      numberOfLines={2}
    >
      {children}
    </Text>
  );
}

/** Matching eyebrow for detail panels (same styling, larger tracking). */
export function ChipDetailHeading({
  tone = "brass",
  children,
}: {
  tone?: ChipTone;
  children: string;
}) {
  const t = TONE[tone];
  return (
    <Text
      className={`mb-2 text-[10px] font-inter-semibold uppercase tracking-[2px] ${t.label}`}
    >
      {children}
    </Text>
  );
}


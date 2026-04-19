import { Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";

export type StatTone = "white" | "brass" | "alert" | "income" | "debt";

type Props = {
  label: string;
  /** Already-formatted value (number, currency, string, or custom node). */
  value: ReactNode;
  hint?: string;
  tone?: StatTone;
  /** Override dim detection. When value is a number === 0 it dims automatically. */
  dim?: boolean;
  /** When true, swap surface to the neutral-theme variant. */
  neutral?: boolean;
  /** Brass-highlight border when expanded. */
  active?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

const toneClass: Record<StatTone, string> = {
  white: "text-z-white",
  brass: "text-z-brass",
  alert: "text-z-alert",
  income: "text-z-income",
  debt: "text-z-debt",
};

/**
 * Interactive stat tile used across surfaces where a metric expands a detail
 * panel (import reconcile grid, dashboard "Gasto hoy", etc.). Pair with
 * <AnimatedAccordion> for the expansion; this component only renders the tile.
 */
export function ExpandableStatTile({
  label,
  value,
  hint,
  tone = "white",
  dim,
  neutral = false,
  active = false,
  onPress,
  accessibilityLabel,
}: Props) {
  const surfaceCls = neutral ? "bg-z-surface-2-neutral" : "bg-z-surface-2";
  const isDim = dim ?? (typeof value === "number" && value === 0);
  const valueColor = isDim ? "text-z-sage-dark" : toneClass[tone];
  const borderCls = active ? "border-z-brass" : "border-white-6";
  const interactive = typeof onPress === "function";
  const Wrapper = interactive ? Pressable : View;
  return (
    <Wrapper
      {...(interactive
        ? {
            onPress,
            accessibilityRole: "button" as const,
            accessibilityState: { expanded: active },
            accessibilityLabel:
              accessibilityLabel ?? `Ver ${label.toLowerCase()}`,
          }
        : {})}
      className={`rounded-2xl border ${borderCls} ${surfaceCls} px-4 pt-3.5 pb-4`}
    >
      <Text className="text-[10px] font-inter-semibold uppercase text-z-sage-dark tracking-[0.18em]">
        {label}
      </Text>
      <Text
        className={`mt-1.5 text-[34px] font-inter-bold tabular-nums tracking-tight ${valueColor}`}
      >
        {value}
      </Text>
      {hint && (
        <Text className="mt-1 font-inter text-[12px] text-z-sage-dark">
          {hint}
        </Text>
      )}
    </Wrapper>
  );
}

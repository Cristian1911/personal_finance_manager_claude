import { View } from "react-native";
import type { ReactNode } from "react";
import { packRows, type WidgetInstance } from "../../lib/dashboard/widgets";
import {
  ExpandableChip,
  type ChipTone,
} from "../ui/ExpandableChip";
import { AnimatedAccordion } from "../ui/AnimatedAccordion";

export type WidgetRender = {
  tone: ChipTone;
  accessibilityLabel?: string;
  chip: ReactNode;
  /** Lazy — only invoked when the chip is the active one in its row. */
  detail: () => ReactNode;
  /**
   * Upper bound for the expanded detail's height. Tune per widget so the
   * accordion caps at a realistic value and siblings don't leave a gap.
   * Defaults to 260.
   */
  estimatedHeight?: number;
};

interface WidgetGridProps {
  widgets: WidgetInstance[];
  activeId: string | null;
  onToggle: (id: string) => void;
  render: (w: WidgetInstance) => WidgetRender;
  editing?: boolean;
  onRemove?: (id: string) => void;
}

/**
 * Row-packed chip grid with a shared accordion per row. Row packing uses the
 * shared `packRows` helper so webapp and mobile agree on capacity (XS×3,
 * S/M×2, L×1). Chips in a row share space equally via `flex-1`.
 */
export function WidgetGrid({
  widgets,
  activeId,
  onToggle,
  render,
  editing = false,
  onRemove,
}: WidgetGridProps) {
  const rows = packRows(widgets);

  return (
    <View className="gap-2">
      {rows.map((row, i) => {
        const rendered = row.map((w) => ({
          w,
          r: render(w),
          isActive: w.id === activeId,
        }));
        const active = rendered.find((x) => x.isActive);
        return (
          <View key={i} className="gap-2">
            <View className="flex-row items-stretch gap-2">
              {rendered.map(({ w, r, isActive }) => (
                <View key={w.id} className="flex-1">
                  <ExpandableChip
                    tone={r.tone}
                    active={isActive}
                    dimmed={Boolean(active) && !isActive}
                    editing={editing}
                    accessibilityLabel={r.accessibilityLabel}
                    onPress={() => onToggle(w.id)}
                    onRemove={onRemove ? () => onRemove(w.id) : undefined}
                  >
                    {r.chip}
                  </ExpandableChip>
                </View>
              ))}
            </View>
            <AnimatedAccordion
              expanded={Boolean(active)}
              estimatedHeight={active?.r.estimatedHeight ?? 260}
            >
              {active ? active.r.detail() : null}
            </AnimatedAccordion>
          </View>
        );
      })}
    </View>
  );
}

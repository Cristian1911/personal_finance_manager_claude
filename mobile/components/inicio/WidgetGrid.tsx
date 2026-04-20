import { View } from "react-native";
import type { ReactNode } from "react";
import { widgetColSpan, type WidgetInstance } from "../../lib/dashboard/widgets";
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
 * 2-column chip grid with a shared accordion per row.
 * Chips follow the Plan page behavior: tap to expand, sibling dims, tinted
 * border when active. Content inside each chip is bespoke per widget.
 */
export function WidgetGrid({
  widgets,
  activeId,
  onToggle,
  render,
  editing = false,
  onRemove,
}: WidgetGridProps) {
  const rows: WidgetInstance[][] = [];
  let pair: WidgetInstance[] = [];

  for (const w of widgets) {
    const span = widgetColSpan(w.size);
    if (span === 2) {
      if (pair.length > 0) {
        rows.push(pair);
        pair = [];
      }
      rows.push([w]);
    } else {
      pair.push(w);
      if (pair.length === 2) {
        rows.push(pair);
        pair = [];
      }
    }
  }
  if (pair.length > 0) rows.push(pair);

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
                <ExpandableChip
                  key={w.id}
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
              ))}
            </View>
            <AnimatedAccordion
              expanded={Boolean(active)}
              estimatedHeight={800}
            >
              {active ? active.r.detail() : null}
            </AnimatedAccordion>
          </View>
        );
      })}
    </View>
  );
}

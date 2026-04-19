import { View } from "react-native";
import type { ReactNode } from "react";
import { widgetColSpan, type WidgetInstance } from "../../lib/dashboard/widgets";

interface WidgetGridProps {
  widgets: WidgetInstance[];
  render: (w: WidgetInstance) => ReactNode;
}

/**
 * 2-column grid that packs widgets by size.
 * S widgets take 1 col, L widgets take full row. M defaults to 1 col here
 * (treated as S) — full-row M behavior can be added in the arrange slice.
 */
export function WidgetGrid({ widgets, render }: WidgetGridProps) {
  // Pair S widgets into rows; L widgets get their own full-width row.
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
    <View className="gap-1.5">
      {rows.map((row, i) => (
        <View key={i} className="flex-row gap-1.5">
          {row.map((w) => (
            <View
              key={w.id}
              style={{ flex: widgetColSpan(w.size) }}
            >
              {render(w)}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

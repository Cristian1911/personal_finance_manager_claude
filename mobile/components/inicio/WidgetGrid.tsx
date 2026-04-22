import { View } from "react-native";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
      {rows.map((row, i) => (
        <WidgetGridRow
          key={i}
          row={row}
          activeId={activeId}
          onToggle={onToggle}
          render={render}
          editing={editing}
          onRemove={onRemove}
        />
      ))}
    </View>
  );
}

interface WidgetGridRowProps {
  row: WidgetInstance[];
  activeId: string | null;
  onToggle: (id: string) => void;
  render: (w: WidgetInstance) => WidgetRender;
  editing: boolean;
  onRemove?: (id: string) => void;
}

/**
 * Per-row wrapper that keeps the last-active detail mounted for the duration
 * of the close animation. Without this, toggling off an active chip unmounts
 * detail content instantly and `AnimatedAccordion` only animates a shrinking
 * empty box — the content vanishes before the fade starts. Hero-style.
 */
function WidgetGridRow({
  row,
  activeId,
  onToggle,
  render,
  editing,
  onRemove,
}: WidgetGridRowProps) {
  const rendered = row.map((w) => ({
    w,
    r: render(w),
    isActive: w.id === activeId,
  }));
  const active = rendered.find((x) => x.isActive);
  const expanded = Boolean(active);
  const activeIdForRow = active?.w.id ?? null;

  // Retain the last-active detail during the collapse transition so the
  // accordion fades real content rather than an empty box. Effect depends
  // on the active id (stable string) — not on `active` (object reference
  // changes every render, which would infinite-loop).
  const [lastDetail, setLastDetail] = useState<ReactNode>(null);
  const [lastEstimate, setLastEstimate] = useState<number>(260);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
    if (activeIdForRow) {
      const item = rendered.find((x) => x.w.id === activeIdForRow);
      if (item) {
        setLastDetail(item.r.detail());
        setLastEstimate(item.r.estimatedHeight ?? 260);
      }
      return;
    }
    // Keep previous detail mounted for ~260ms (slightly past the 220ms
    // animation) so the fade actually has content to fade.
    clearTimer.current = setTimeout(() => setLastDetail(null), 260);
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rendered is
    // re-created each render; we key off the stable activeIdForRow instead.
  }, [activeIdForRow]);

  return (
    <View className="gap-2">
      <View className="flex-row items-stretch gap-2">
        {rendered.map(({ w, r, isActive }) => (
          <ExpandableChip
            key={w.id}
            tone={r.tone}
            active={isActive}
            dimmed={expanded && !isActive}
            editing={editing}
            accessibilityLabel={r.accessibilityLabel}
            onPress={() => onToggle(w.id)}
            onRemove={onRemove ? () => onRemove(w.id) : undefined}
          >
            {r.chip}
          </ExpandableChip>
        ))}
      </View>
      <AnimatedAccordion expanded={expanded} estimatedHeight={lastEstimate}>
        {lastDetail}
      </AnimatedAccordion>
    </View>
  );
}

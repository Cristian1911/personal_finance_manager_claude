"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  packRows,
  rowKindFor,
  type WidgetInstance,
} from "@/lib/dashboard/widgets";
import { ExpandableChip, type ChipTone } from "./widget-chip";

export type WidgetRender = {
  tone: ChipTone;
  accessibilityLabel?: string;
  chip: React.ReactNode;
  /** Rendered below the row when this chip is active. null for launcher widgets. */
  detail: React.ReactNode | null;
  /** Optional: tapping the chip runs this instead of expanding (launchers). */
  onPress?: () => void;
};

interface WidgetGridProps {
  widgets: WidgetInstance[];
  activeId: string | null;
  onToggle: (id: string) => void;
  render: (w: WidgetInstance) => WidgetRender;
  editing?: boolean;
  onRemove?: (id: string) => void;
  /** Fired when a chip is tapped while in editing mode — caller opens the edit sheet. */
  onEdit?: (id: string) => void;
}

const GRID_COLS_BY_KIND: Record<"xs" | "s" | "l", string> = {
  xs: "grid-cols-3",
  s: "grid-cols-2",
  l: "grid-cols-1",
};

/**
 * 2-column widget grid with per-row shared accordion (Flow 02 Variant B).
 * XS rows pack 3; S/M pack 2; L is full-width.
 */
export function WidgetGrid({
  widgets,
  activeId,
  onToggle,
  render,
  editing = false,
  onRemove,
  onEdit,
}: WidgetGridProps) {
  const rows = useMemo(() => packRows(widgets), [widgets]);

  // Protection layer: when a zone expands, smoothly scroll its row into view so
  // the expanded detail is never left hidden below the fold (the page scroll is
  // no longer locked). `block: "nearest"` pins the panel up/down minimally; the
  // detail's own max-height + overflow-y-auto handles content taller than the
  // viewport. Timeout clears the 200ms grid-template-rows expand animation first.
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    if (!activeId) return;
    const idx = rows.findIndex((row) => row.some((w) => w.id === activeId));
    const el = rowRefs.current[idx];
    if (!el) return;
    const t = setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 220);
    return () => clearTimeout(t);
  }, [activeId, rows]);

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row, rowIdx) => {
        const rowKind = rowKindFor(row[0].size);
        const rendered = row.map((w) => ({
          w,
          r: render(w),
          isActive: w.id === activeId,
        }));
        const active = rendered.find((x) => x.isActive);
        return (
          <div
            key={rowIdx}
            ref={(el) => {
              rowRefs.current[rowIdx] = el;
            }}
            className="flex flex-col gap-2"
            // Reserve floating tab-bar + FAB clearance so scroll-into-view on
            // expand stops above the bar instead of tucking the panel behind it.
            style={{
              scrollMarginBottom:
                "calc(var(--z-mobile-tab-bar-h) + var(--z-mobile-fab-overshoot) + env(safe-area-inset-bottom) + 12px)",
            }}
          >
            <div className={cn("grid gap-2", GRID_COLS_BY_KIND[rowKind])}>
              {rendered.map(({ w, r, isActive }) => {
                const press = editing
                  ? () => onEdit?.(w.id)
                  : (r.onPress ?? (() => onToggle(w.id)));
                return (
                  <ExpandableChip
                    key={w.id}
                    tone={r.tone}
                    active={isActive}
                    dimmed={Boolean(active) && !isActive}
                    editing={editing}
                    onPress={press}
                    onRemove={onRemove ? () => onRemove(w.id) : undefined}
                    accessibilityLabel={r.accessibilityLabel}
                  >
                    {r.chip}
                  </ExpandableChip>
                );
              })}
            </div>
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out",
              )}
              style={{ gridTemplateRows: active ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <div
                  className={cn(
                    "transition-opacity duration-150",
                    active ? "pt-1 opacity-100" : "opacity-0",
                  )}
                >
                  {active && active.r.detail ? (
                    <div className="max-h-[calc(100dvh-16rem)] overflow-y-auto">
                      {active.r.detail}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

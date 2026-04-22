/**
 * Shared dashboard widget contract used by both the webapp mobile viewport
 * and the native mobile app. Pulse is always rendered first and is never
 * part of `DashboardLayout.widgets`.
 */

export type WidgetSize = "XS" | "S" | "M" | "L";

export type WidgetType =
  | "pulse"
  | "next_bill"
  | "next_income"
  | "accounts"
  | "where_today"
  | "recent"
  | "puedo_comprarlo"
  | "attention"
  | "import_strip"
  | "ritmo"
  | "goal"
  | "spending_by_category"
  | "cashflow_calendar"
  | "debt_progress"
  | "merchants_this_month"
  | "shared_with_partner";

export type WidgetInstance = {
  id: string;
  type: WidgetType;
  size: WidgetSize;
};

export type PulseRange = "weekly" | "monthly";

export type DashboardLayout = {
  pulseRange: PulseRange;
  widgets: WidgetInstance[];
};

/** Types that can legally live in the user-arrangeable widget zone. */
export const ARRANGEABLE_TYPES: ReadonlySet<WidgetType> = new Set<WidgetType>([
  "puedo_comprarlo",
  "recent",
]);

/** Types rendered by the fixed system-insights row (never arrangeable). */
export const SYSTEM_TYPES: ReadonlySet<WidgetType> = new Set<WidgetType>([
  "ritmo",
  "where_today",
  "attention",
]);

export const SYSTEM_INSIGHTS: WidgetInstance[] = [
  { id: "sys-ritmo", type: "ritmo", size: "XS" },
  { id: "sys-where-today", type: "where_today", size: "XS" },
  { id: "sys-attention", type: "attention", size: "XS" },
];

export const DEFAULT_LAYOUT: DashboardLayout = {
  pulseRange: "weekly",
  widgets: [
    { id: "puedo_comprarlo", type: "puedo_comprarlo", size: "S" },
    { id: "recent", type: "recent", size: "S" },
  ],
};

export type RowKind = "xs" | "s" | "l";

export function rowKindFor(size: WidgetSize): RowKind {
  if (size === "XS") return "xs";
  if (size === "L") return "l";
  return "s";
}

export const ROW_CAPACITY: Record<RowKind, number> = {
  xs: 3,
  s: 2,
  l: 1,
};

/**
 * Greedy row-packing. Widgets are placed in insertion order. A row's kind is
 * set by its first widget; subsequent widgets join if they match that kind
 * AND there is room; otherwise the row is flushed and a new row opens.
 */
export function packRows(widgets: WidgetInstance[]): WidgetInstance[][] {
  const rows: WidgetInstance[][] = [];
  let current: WidgetInstance[] = [];
  let kind: RowKind | null = null;

  const flush = () => {
    if (current.length > 0) {
      rows.push(current);
      current = [];
      kind = null;
    }
  };

  for (const widget of widgets) {
    const widgetKind = rowKindFor(widget.size);
    if (kind === null) {
      kind = widgetKind;
      current.push(widget);
    } else if (widgetKind === kind && current.length < ROW_CAPACITY[kind]) {
      current.push(widget);
    } else {
      flush();
      kind = widgetKind;
      current.push(widget);
    }
    if (current.length >= ROW_CAPACITY[widgetKind]) flush();
  }
  flush();
  return rows;
}

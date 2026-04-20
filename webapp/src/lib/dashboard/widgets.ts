/**
 * Webapp mobile dashboard widget system (Flow 02 · Variant B).
 * Mirrors `mobile/lib/dashboard/widgets.ts` so RN + webapp share the same
 * catalog semantics. Pulse is always rendered first and is non-removable.
 */

/**
 * Widget sizes map to row packing:
 *  - XS → 1 of 3 (insights row, e.g. Por resolver + Ritmo + Gasto hoy)
 *  - S  → 1 of 2 (half-row)
 *  - M  → 1 of 2 (half-row, reserved for taller chips in future)
 *  - L  → full row
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

/** Types that can legally live in the arrangeable widget zone (not system-fixed). */
export const ARRANGEABLE_TYPES: ReadonlySet<string> = new Set([
  "attention",
  "recent",
] satisfies WidgetType[]);

/** Types rendered by the system insights strip — never appear in the widget zone. */
export const SYSTEM_TYPES: ReadonlySet<string> = new Set([
  "ritmo",
  "where_today",
  "puedo_comprarlo",
] satisfies WidgetType[]);

export type WidgetInstance = {
  id: string;
  type: WidgetType;
  size: WidgetSize;
};

export type PulseRange = "weekly" | "monthly";

export type DashboardLayout = {
  pulseRange: PulseRange;
  widgets: WidgetInstance[]; // pulse excluded — always rendered first
};

/**
 * Default layout — seeds every first-time user. Matches the current webapp
 * mobile body shape so the experience is stable when Variant B ships.
 */
/**
 * Fixed "insights strip" rendered directly below the Pulse. Not user-editable.
 * Kept as WidgetInstance[] so the existing WidgetGrid renders them with the
 * same chip + shared-accordion behavior as the arrangeable zone.
 */
export const SYSTEM_INSIGHTS: WidgetInstance[] = [
  { id: "sys-ritmo", type: "ritmo", size: "XS" },
  { id: "sys-where-today", type: "where_today", size: "XS" },
  { id: "sys-puedo-comprarlo", type: "puedo_comprarlo", size: "XS" },
];

export const DEFAULT_LAYOUT: DashboardLayout = {
  pulseRange: "weekly",
  widgets: [
    // Por resolver + Reciente share a row.
    { id: "attention", type: "attention", size: "S" },
    { id: "recent", type: "recent", size: "S" },
  ],
};

export type CatalogEntry = {
  type: WidgetType;
  label: string;
  description: string;
  defaultSize: WidgetSize;
  available: boolean; // false = "Próximamente"
};

export const WIDGET_CATALOG: CatalogEntry[] = [
  {
    type: "attention",
    label: "Por resolver",
    description: "Pagos vencidos, próximos y correos pendientes",
    defaultSize: "S",
    available: true,
  },
  {
    type: "recent",
    label: "Movimientos recientes",
    description: "Tus últimas transacciones",
    defaultSize: "S",
    available: true,
  },
  {
    type: "next_bill",
    label: "Próximo pago",
    description: "La siguiente obligación a pagar",
    defaultSize: "S",
    available: false,
  },
  {
    type: "next_income",
    label: "Próximo ingreso",
    description: "Tu siguiente entrada de dinero",
    defaultSize: "S",
    available: false,
  },
  {
    type: "accounts",
    label: "Cuentas",
    description: "Tus cuentas principales",
    defaultSize: "S",
    available: false,
  },
  {
    type: "import_strip",
    label: "Recordatorio de importar",
    description: "Te avisa cuándo sincronizar extractos",
    defaultSize: "L",
    available: false,
  },
  {
    type: "goal",
    label: "Meta de ahorro",
    description: "Progreso de tu objetivo",
    defaultSize: "S",
    available: false,
  },
  {
    type: "spending_by_category",
    label: "Gasto por categoría",
    description: "Top categorías del mes",
    defaultSize: "M",
    available: false,
  },
  {
    type: "cashflow_calendar",
    label: "Calendario de flujo",
    description: "Ingresos y pagos por día",
    defaultSize: "L",
    available: false,
  },
  {
    type: "debt_progress",
    label: "Progreso de deudas",
    description: "Avance de payoff",
    defaultSize: "M",
    available: false,
  },
  {
    type: "merchants_this_month",
    label: "Destinatarios del mes",
    description: "Top merchants",
    defaultSize: "M",
    available: false,
  },
  {
    type: "shared_with_partner",
    label: "Compartido con pareja",
    description: "Gastos de pareja",
    defaultSize: "M",
    available: false,
  },
];

/** Row kind that groups compatible sizes for packing. */
export type RowKind = "xs" | "s" | "l";

export function rowKindFor(size: WidgetSize): RowKind {
  if (size === "XS") return "xs";
  if (size === "L") return "l";
  return "s"; // S and M share the 2-col row.
}

export const ROW_CAPACITY: Record<RowKind, number> = {
  xs: 3,
  s: 2,
  l: 1,
};

/**
 * Greedy row-packing. Widgets are placed in insertion order. A row is "kind X"
 * based on its first widget; subsequent widgets join if they match that kind
 * and there's room; otherwise a new row opens.
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

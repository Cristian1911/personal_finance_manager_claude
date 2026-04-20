/**
 * Mobile dashboard widget system.
 * Pulse is fixed (always top, non-removable). All other widgets are user-arranged.
 */

export type WidgetSize = "S" | "M" | "L";

export type WidgetType =
  | "pulse"
  | "next_bill"
  | "next_income"
  | "accounts"
  | "where_today"
  | "recent"
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
  widgets: WidgetInstance[]; // pulse excluded — always rendered first
};

export const DEFAULT_LAYOUT: DashboardLayout = {
  pulseRange: "weekly",
  widgets: [
    { id: "next_income", type: "next_income", size: "S" },
    { id: "next_bill", type: "next_bill", size: "S" },
    { id: "accounts", type: "accounts", size: "S" },
    { id: "where_today", type: "where_today", size: "S" },
    { id: "recent", type: "recent", size: "L" },
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
    type: "next_income",
    label: "Próximo ingreso",
    description: "Tu siguiente entrada de dinero",
    defaultSize: "S",
    available: true,
  },
  {
    type: "next_bill",
    label: "Próximo pago",
    description: "La siguiente obligación a pagar",
    defaultSize: "S",
    available: true,
  },
  {
    type: "accounts",
    label: "Cuentas",
    description: "Tus cuentas principales",
    defaultSize: "S",
    available: true,
  },
  {
    type: "where_today",
    label: "Gasto de hoy",
    description: "Distribución del gasto diario",
    defaultSize: "S",
    available: true,
  },
  {
    type: "recent",
    label: "Movimientos recientes",
    description: "Últimas transacciones",
    defaultSize: "L",
    available: true,
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

/** S + M + L → grid spans in a 2-column layout. */
export function widgetColSpan(size: WidgetSize): 1 | 2 {
  return size === "L" ? 2 : 1;
}

/** Vertical weight used for rough row-height target. */
export function widgetRowSpan(size: WidgetSize): 1 | 2 {
  return size === "M" || size === "L" ? 1 : 1;
}

/**
 * Mobile dashboard widget catalog. Pure layout logic lives in
 * `@zeta/shared/dashboard-layout` so mobile and webapp share one contract.
 * System insights (ritmo / where_today / attention) render in the fixed
 * Herramientas row; only `ARRANGEABLE_TYPES` may live in the user zone.
 */

export {
  ARRANGEABLE_TYPES,
  DEFAULT_LAYOUT,
  ROW_CAPACITY,
  SYSTEM_INSIGHTS,
  SYSTEM_TYPES,
  packRows,
  rowKindFor,
  type DashboardLayout,
  type PulseRange,
  type RowKind,
  type WidgetInstance,
  type WidgetSize,
  type WidgetType,
} from "@zeta/shared";

import type { WidgetSize, WidgetType } from "@zeta/shared";

export type CatalogEntry = {
  type: WidgetType;
  label: string;
  description: string;
  defaultSize: WidgetSize;
  available: boolean;
};

export const WIDGET_CATALOG: CatalogEntry[] = [
  { type: "recent", label: "Movimientos recientes", description: "Tus últimas transacciones", defaultSize: "S", available: true },
  { type: "puedo_comprarlo", label: "¿Puedo comprarlo?", description: "Evalúa una compra contra el plan", defaultSize: "S", available: true },
  { type: "next_bill", label: "Próximo pago", description: "La siguiente obligación a pagar", defaultSize: "S", available: false },
  { type: "next_income", label: "Próximo ingreso", description: "Tu siguiente entrada de dinero", defaultSize: "S", available: false },
  { type: "accounts", label: "Cuentas", description: "Tus cuentas principales", defaultSize: "S", available: false },
  { type: "goal", label: "Meta de ahorro", description: "Progreso de tu objetivo", defaultSize: "S", available: false },
  { type: "spending_by_category", label: "Gasto por categoría", description: "Top categorías del mes", defaultSize: "M", available: false },
  { type: "cashflow_calendar", label: "Calendario de flujo", description: "Ingresos y pagos por día", defaultSize: "L", available: false },
  { type: "debt_progress", label: "Progreso de deudas", description: "Avance de payoff", defaultSize: "M", available: false },
  { type: "merchants_this_month", label: "Destinatarios del mes", description: "Top merchants", defaultSize: "M", available: false },
  { type: "shared_with_partner", label: "Compartido con pareja", description: "Gastos de pareja", defaultSize: "M", available: false },
];

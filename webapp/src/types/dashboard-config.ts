export type AppPurpose = "manage_debt" | "track_spending" | "save_money" | "improve_habits";

export type DashboardSection = "hero" | "niveles" | "flujo" | "presupuesto" | "patrimonio" | "actividad" | "cuentas";

export interface WidgetConfig {
  id: string;
  visible: boolean;
  order: number;
  section: DashboardSection;
}

export type MobileWidgetSize = "XS" | "S" | "M" | "L";

export type MobilePulseRange = "weekly" | "monthly";

/**
 * User-curated mobile layout — Flow 02 Variant B.
 * Pulse is always first and non-removable, so it's not tracked here.
 */
export interface MobileWidgetInstance {
  id: string;
  type: string;
  size: MobileWidgetSize;
}

export interface MobileDashboardLayout {
  pulseRange: MobilePulseRange;
  widgets: MobileWidgetInstance[];
}

export interface DashboardConfig {
  purpose: AppPurpose;
  widgets: WidgetConfig[];
}

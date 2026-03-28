export type AppPurpose = "manage_debt" | "track_spending" | "save_money" | "improve_habits";

export type DashboardSection = "hero" | "niveles" | "flujo" | "presupuesto" | "patrimonio" | "actividad" | "cuentas";

export interface WidgetConfig {
  id: string;
  visible: boolean;
  order: number;
  section: DashboardSection;
}

export interface DashboardConfig {
  purpose: AppPurpose;
  widgets: WidgetConfig[];
}

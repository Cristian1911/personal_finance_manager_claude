export type AppPurpose = "manage_debt" | "track_spending" | "save_money" | "improve_habits";

export interface TabConfig {
  id: string;
  label: string;
  icon: string;
  features: string[];
  position: 2 | 3;
}

export interface WidgetConfig {
  id: string;
  visible: boolean;
  order: number;
}

export interface DashboardConfig {
  purpose: AppPurpose;
  tabs: TabConfig[];
  widgets: WidgetConfig[];
}

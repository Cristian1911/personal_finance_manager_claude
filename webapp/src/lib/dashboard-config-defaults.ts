import type { AppPurpose, DashboardConfig } from "@/types/dashboard-config";

const DEFAULTS: Record<AppPurpose, DashboardConfig> = {
  manage_debt: {
    purpose: "manage_debt",
    tabs: [
      { id: "debt-recurring", label: "Deudas", icon: "CreditCard", features: ["debt", "recurring"], position: 2 },
      { id: "presupuesto", label: "Presupuesto", icon: "PiggyBank", features: ["budget"], position: 3 },
    ],
    widgets: [
      { id: "debt-progress", visible: true, order: 0 },
      { id: "upcoming-payments", visible: true, order: 1 },
      { id: "budget-pulse", visible: true, order: 2 },
      { id: "nudge-cards", visible: true, order: 3 },
      { id: "recent-tx", visible: true, order: 4 },
      { id: "spending-trend", visible: false, order: 5 },
      { id: "category-donut", visible: false, order: 6 },
      { id: "habit-score", visible: false, order: 7 },
    ],
  },
  track_spending: {
    purpose: "track_spending",
    tabs: [
      { id: "movimientos", label: "Movimientos", icon: "ArrowLeftRight", features: ["transactions"], position: 2 },
      { id: "presupuesto", label: "Presupuesto", icon: "PiggyBank", features: ["budget"], position: 3 },
    ],
    widgets: [
      { id: "spending-trend", visible: true, order: 0 },
      { id: "category-donut", visible: true, order: 1 },
      { id: "recent-tx", visible: true, order: 2 },
      { id: "budget-pulse", visible: true, order: 3 },
      { id: "nudge-cards", visible: true, order: 4 },
      { id: "upcoming-payments", visible: false, order: 5 },
      { id: "debt-progress", visible: false, order: 6 },
      { id: "habit-score", visible: false, order: 7 },
    ],
  },
  save_money: {
    purpose: "save_money",
    tabs: [
      { id: "presupuesto-ahorro", label: "Presupuesto", icon: "PiggyBank", features: ["budget", "savings"], position: 2 },
      { id: "movimientos", label: "Movimientos", icon: "ArrowLeftRight", features: ["transactions"], position: 3 },
    ],
    widgets: [
      { id: "budget-pulse", visible: true, order: 0 },
      { id: "spending-trend", visible: true, order: 1 },
      { id: "nudge-cards", visible: true, order: 2 },
      { id: "recent-tx", visible: true, order: 3 },
      { id: "upcoming-payments", visible: false, order: 4 },
      { id: "category-donut", visible: false, order: 5 },
      { id: "debt-progress", visible: false, order: 6 },
      { id: "habit-score", visible: false, order: 7 },
    ],
  },
  improve_habits: {
    purpose: "improve_habits",
    tabs: [
      { id: "movimientos-presupuesto", label: "Gastos", icon: "TrendingDown", features: ["transactions", "budget"], position: 2 },
      { id: "recurrentes", label: "Recurrentes", icon: "Repeat2", features: ["recurring"], position: 3 },
    ],
    widgets: [
      { id: "habit-score", visible: true, order: 0 },
      { id: "spending-trend", visible: true, order: 1 },
      { id: "budget-pulse", visible: true, order: 2 },
      { id: "nudge-cards", visible: true, order: 3 },
      { id: "recent-tx", visible: true, order: 4 },
      { id: "upcoming-payments", visible: false, order: 5 },
      { id: "category-donut", visible: false, order: 6 },
      { id: "debt-progress", visible: false, order: 7 },
    ],
  },
};

export function getDefaultConfig(purpose: AppPurpose): DashboardConfig {
  return structuredClone(DEFAULTS[purpose]);
}

export function getDefaultConfigForProfile(appPurpose: string | null): DashboardConfig {
  const purpose = (appPurpose as AppPurpose) || "track_spending";
  return getDefaultConfig(purpose);
}

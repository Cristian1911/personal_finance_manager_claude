import type { AppPurpose, DashboardConfig } from "@/types/dashboard-config";

const DEFAULTS: Record<AppPurpose, DashboardConfig> = {
  manage_debt: {
    purpose: "manage_debt",
    tabs: [
      { id: "debt-recurring", label: "Deudas", icon: "CreditCard", features: ["debt", "recurring"], position: 2 },
      { id: "presupuesto", label: "Presupuesto", icon: "PiggyBank", features: ["budget"], position: 3 },
    ],
    widgets: [
      // Hero (always visible)
      { id: "hero-available", visible: true, order: 0, section: "hero" },
      { id: "hero-flow-strip", visible: true, order: 1, section: "hero" },
      // Niveles
      { id: "health-meters", visible: true, order: 0, section: "niveles" },
      // Flujo
      { id: "waterfall", visible: true, order: 0, section: "flujo" },
      { id: "cashflow-trend", visible: false, order: 1, section: "flujo" },
      // Presupuesto
      { id: "budget-pulse", visible: true, order: 0, section: "presupuesto" },
      { id: "allocation-5030", visible: true, order: 1, section: "presupuesto" },
      { id: "category-donut", visible: false, order: 2, section: "presupuesto" },
      { id: "savings-rate", visible: false, order: 3, section: "presupuesto" },
      // Patrimonio
      { id: "debt-countdown", visible: true, order: 0, section: "patrimonio" },
      { id: "debt-progress", visible: true, order: 1, section: "patrimonio" },
      { id: "net-worth", visible: false, order: 2, section: "patrimonio" },
      { id: "emergency-fund", visible: false, order: 3, section: "patrimonio" },
      { id: "interest-paid", visible: false, order: 4, section: "patrimonio" },
      // Actividad
      { id: "upcoming-payments", visible: true, order: 0, section: "actividad" },
      { id: "recent-tx", visible: true, order: 1, section: "actividad" },
      { id: "spending-heatmap", visible: false, order: 2, section: "actividad" },
    ],
  },
  track_spending: {
    purpose: "track_spending",
    tabs: [
      { id: "movimientos", label: "Movimientos", icon: "ArrowLeftRight", features: ["transactions"], position: 2 },
      { id: "presupuesto", label: "Presupuesto", icon: "PiggyBank", features: ["budget"], position: 3 },
    ],
    widgets: [
      // Hero (always visible)
      { id: "hero-available", visible: true, order: 0, section: "hero" },
      { id: "hero-flow-strip", visible: true, order: 1, section: "hero" },
      // Niveles
      { id: "health-meters", visible: true, order: 0, section: "niveles" },
      // Flujo
      { id: "waterfall", visible: true, order: 0, section: "flujo" },
      { id: "cashflow-trend", visible: true, order: 1, section: "flujo" },
      // Presupuesto
      { id: "budget-pulse", visible: true, order: 0, section: "presupuesto" },
      { id: "allocation-5030", visible: false, order: 1, section: "presupuesto" },
      { id: "category-donut", visible: true, order: 2, section: "presupuesto" },
      { id: "savings-rate", visible: false, order: 3, section: "presupuesto" },
      // Patrimonio
      { id: "debt-countdown", visible: false, order: 0, section: "patrimonio" },
      { id: "debt-progress", visible: false, order: 1, section: "patrimonio" },
      { id: "net-worth", visible: false, order: 2, section: "patrimonio" },
      { id: "emergency-fund", visible: false, order: 3, section: "patrimonio" },
      { id: "interest-paid", visible: false, order: 4, section: "patrimonio" },
      // Actividad
      { id: "upcoming-payments", visible: true, order: 0, section: "actividad" },
      { id: "recent-tx", visible: true, order: 1, section: "actividad" },
      { id: "spending-heatmap", visible: true, order: 2, section: "actividad" },
    ],
  },
  save_money: {
    purpose: "save_money",
    tabs: [
      { id: "presupuesto-ahorro", label: "Presupuesto", icon: "PiggyBank", features: ["budget", "savings"], position: 2 },
      { id: "movimientos", label: "Movimientos", icon: "ArrowLeftRight", features: ["transactions"], position: 3 },
    ],
    widgets: [
      // Hero (always visible)
      { id: "hero-available", visible: true, order: 0, section: "hero" },
      { id: "hero-flow-strip", visible: true, order: 1, section: "hero" },
      // Niveles
      { id: "health-meters", visible: true, order: 0, section: "niveles" },
      // Flujo
      { id: "waterfall", visible: true, order: 0, section: "flujo" },
      { id: "cashflow-trend", visible: false, order: 1, section: "flujo" },
      // Presupuesto
      { id: "budget-pulse", visible: true, order: 0, section: "presupuesto" },
      { id: "allocation-5030", visible: true, order: 1, section: "presupuesto" },
      { id: "category-donut", visible: false, order: 2, section: "presupuesto" },
      { id: "savings-rate", visible: true, order: 3, section: "presupuesto" },
      // Patrimonio
      { id: "debt-countdown", visible: false, order: 0, section: "patrimonio" },
      { id: "debt-progress", visible: false, order: 1, section: "patrimonio" },
      { id: "net-worth", visible: false, order: 2, section: "patrimonio" },
      { id: "emergency-fund", visible: true, order: 3, section: "patrimonio" },
      { id: "interest-paid", visible: false, order: 4, section: "patrimonio" },
      // Actividad
      { id: "upcoming-payments", visible: true, order: 0, section: "actividad" },
      { id: "recent-tx", visible: true, order: 1, section: "actividad" },
      { id: "spending-heatmap", visible: false, order: 2, section: "actividad" },
    ],
  },
  improve_habits: {
    purpose: "improve_habits",
    tabs: [
      { id: "movimientos-presupuesto", label: "Gastos", icon: "TrendingDown", features: ["transactions", "budget"], position: 2 },
      { id: "recurrentes", label: "Recurrentes", icon: "Repeat2", features: ["recurring"], position: 3 },
    ],
    widgets: [
      // Hero (always visible)
      { id: "hero-available", visible: true, order: 0, section: "hero" },
      { id: "hero-flow-strip", visible: true, order: 1, section: "hero" },
      // Niveles
      { id: "health-meters", visible: true, order: 0, section: "niveles" },
      // Flujo
      { id: "waterfall", visible: true, order: 0, section: "flujo" },
      { id: "cashflow-trend", visible: false, order: 1, section: "flujo" },
      // Presupuesto
      { id: "budget-pulse", visible: true, order: 0, section: "presupuesto" },
      { id: "allocation-5030", visible: false, order: 1, section: "presupuesto" },
      { id: "category-donut", visible: false, order: 2, section: "presupuesto" },
      { id: "savings-rate", visible: false, order: 3, section: "presupuesto" },
      // Patrimonio
      { id: "debt-countdown", visible: false, order: 0, section: "patrimonio" },
      { id: "debt-progress", visible: false, order: 1, section: "patrimonio" },
      { id: "net-worth", visible: false, order: 2, section: "patrimonio" },
      { id: "emergency-fund", visible: false, order: 3, section: "patrimonio" },
      { id: "interest-paid", visible: false, order: 4, section: "patrimonio" },
      // Actividad
      { id: "upcoming-payments", visible: true, order: 0, section: "actividad" },
      { id: "recent-tx", visible: true, order: 1, section: "actividad" },
      { id: "spending-heatmap", visible: true, order: 2, section: "actividad" },
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

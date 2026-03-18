"use client";

import { createContext, useContext, useCallback } from "react";
import { useDashboardConfig } from "@/hooks/use-dashboard-config";
import type {
  DashboardConfig,
  DashboardSection,
  WidgetConfig,
} from "@/types/dashboard-config";

interface DashboardConfigContextValue {
  config: DashboardConfig;
  isWidgetVisible: (widgetId: string) => boolean;
  getWidgetsForSection: (section: DashboardSection) => WidgetConfig[];
  toggleWidget: (widgetId: string, visible: boolean) => void;
  getWidgetToggleList: (
    section: DashboardSection
  ) => Array<{ id: string; label: string; visible: boolean }>;
}

const DashboardConfigContext = createContext<DashboardConfigContextValue | null>(
  null
);

const WIDGET_LABELS: Record<string, string> = {
  "hero-available": "Disponible",
  "hero-flow-strip": "Flujo rápido",
  "health-meters": "Niveles de salud",
  waterfall: "Cascada de flujo",
  "cashflow-trend": "Tendencia de flujo",
  "budget-pulse": "Pulso presupuestal",
  "allocation-5030": "Distribución 50/30/20",
  "category-donut": "Donut por categoría",
  "savings-rate": "Tasa de ahorro",
  "debt-countdown": "Cuenta regresiva deuda",
  "debt-progress": "Progreso de deuda",
  "net-worth": "Patrimonio neto",
  "emergency-fund": "Fondo de emergencia",
  "interest-paid": "Intereses pagados",
  "upcoming-payments": "Próximos pagos",
  "recent-tx": "Transacciones recientes",
  "spending-heatmap": "Mapa de gastos",
  "burn-rate": "Ritmo de gasto",
  "budget-bar": "Gasto por categoría",
};

export function DashboardConfigProvider({
  serverConfig,
  appPurpose,
  children,
}: {
  serverConfig: DashboardConfig | null;
  appPurpose: string | null;
  children: React.ReactNode;
}) {
  const { config, setConfig } = useDashboardConfig(serverConfig, appPurpose);

  const isWidgetVisible = useCallback(
    (widgetId: string) => {
      const widget = config.widgets.find((w) => w.id === widgetId);
      // Default to visible if widget not found in config
      return widget?.visible ?? true;
    },
    [config.widgets]
  );

  const getWidgetsForSection = useCallback(
    (section: DashboardSection) =>
      config.widgets
        .filter((w) => w.section === section)
        .sort((a, b) => a.order - b.order),
    [config.widgets]
  );

  const toggleWidget = useCallback(
    (widgetId: string, visible: boolean) => {
      const newConfig = {
        ...config,
        widgets: config.widgets.map((w) =>
          w.id === widgetId ? { ...w, visible } : w
        ),
      };
      setConfig(newConfig);
    },
    [config, setConfig]
  );

  const getWidgetToggleList = useCallback(
    (section: DashboardSection) =>
      config.widgets
        .filter((w) => w.section === section)
        .sort((a, b) => a.order - b.order)
        .map((w) => ({
          id: w.id,
          label: WIDGET_LABELS[w.id] ?? w.id,
          visible: w.visible,
        })),
    [config.widgets]
  );

  return (
    <DashboardConfigContext.Provider
      value={{
        config,
        isWidgetVisible,
        getWidgetsForSection,
        toggleWidget,
        getWidgetToggleList,
      }}
    >
      {children}
    </DashboardConfigContext.Provider>
  );
}

export function useDashboardConfigContext() {
  const ctx = useContext(DashboardConfigContext);
  if (!ctx) {
    throw new Error(
      "useDashboardConfigContext must be used within a DashboardConfigProvider"
    );
  }
  return ctx;
}

/** Non-throwing variant — returns null if no provider is present */
export function useDashboardConfigContextSafe() {
  return useContext(DashboardConfigContext);
}

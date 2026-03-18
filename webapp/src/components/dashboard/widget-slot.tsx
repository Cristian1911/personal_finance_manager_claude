"use client";

import { useDashboardConfigContext } from "./dashboard-config-provider";

interface WidgetSlotProps {
  widgetId: string;
  children: React.ReactNode;
}

/**
 * Conditionally renders a widget based on the user's dashboard config.
 * If the widget is not visible in the config, renders nothing.
 * Falls back to visible if the widgetId is not found in the config.
 */
export function WidgetSlot({ widgetId, children }: WidgetSlotProps) {
  const { isWidgetVisible } = useDashboardConfigContext();

  if (!isWidgetVisible(widgetId)) return null;

  return <>{children}</>;
}

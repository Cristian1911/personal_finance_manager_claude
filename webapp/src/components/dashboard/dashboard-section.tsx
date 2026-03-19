"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { WidgetTogglePanel } from "./widget-toggle-panel";
import { useDashboardConfigContextSafe } from "./dashboard-config-provider";
import type { DashboardSection as SectionType } from "@/types/dashboard-config";

interface DashboardSectionProps {
  title: string;
  section: SectionType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  summaryText?: string;
  showToggle?: boolean;
  /** Override widgets list — if omitted, pulls from DashboardConfigProvider */
  onToggleWidget?: (widgetId: string, visible: boolean) => void;
  widgets?: Array<{ id: string; label: string; visible: boolean }>;
}

export function DashboardSection({
  title,
  section,
  children,
  defaultOpen = true,
  summaryText,
  showToggle = true,
  onToggleWidget: onToggleWidgetProp,
  widgets: widgetsProp,
}: DashboardSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const ctx = useDashboardConfigContextSafe();

  // Pull from context if props not provided
  const resolvedWidgets = widgetsProp ?? ctx?.getWidgetToggleList(section);
  const resolvedOnToggle = onToggleWidgetProp ?? ctx?.toggleWidget;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-sm"
          aria-expanded={isOpen}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              !isOpen && "-rotate-90"
            )}
          />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {title}
          </span>
        </button>
        {showToggle && resolvedWidgets && resolvedOnToggle && (
          <WidgetTogglePanel
            widgets={resolvedWidgets}
            onToggle={resolvedOnToggle}
          />
        )}
      </div>

      {/* Content */}
      {isOpen ? (
        <div className="space-y-4">{children}</div>
      ) : (
        summaryText && (
          <p className="text-sm text-muted-foreground lg:hidden">
            {summaryText}
          </p>
        )
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { WidgetTogglePanel } from "./widget-toggle-panel";
import type { DashboardSection as SectionType } from "@/types/dashboard-config";

interface DashboardSectionProps {
  title: string;
  section: SectionType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  summaryText?: string;
  showToggle?: boolean;
  onToggleWidget?: (widgetId: string, visible: boolean) => void;
  widgets?: Array<{ id: string; label: string; visible: boolean }>;
}

export function DashboardSection({
  title,
  section: _section,
  children,
  defaultOpen = true,
  summaryText,
  showToggle = true,
  onToggleWidget,
  widgets,
}: DashboardSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2"
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
        {showToggle && widgets && onToggleWidget && (
          <WidgetTogglePanel widgets={widgets} onToggle={onToggleWidget} />
        )}
      </div>

      {/* Content */}
      {isOpen ? (
        <div className="space-y-4">{children}</div>
      ) : (
        summaryText && (
          <p className="text-sm text-muted-foreground lg:hidden">{summaryText}</p>
        )
      )}
    </div>
  );
}

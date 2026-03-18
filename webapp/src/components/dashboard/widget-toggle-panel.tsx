"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Settings2 } from "lucide-react";

interface WidgetTogglePanelProps {
  widgets: Array<{ id: string; label: string; visible: boolean }>;
  onToggle: (widgetId: string, visible: boolean) => void;
}

export function WidgetTogglePanel({ widgets, onToggle }: WidgetTogglePanelProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Widgets
          </p>
          {widgets.map((w) => (
            <div key={w.id} className="flex items-center justify-between">
              <span className="text-sm">{w.label}</span>
              <Switch
                checked={w.visible}
                onCheckedChange={(checked) => onToggle(w.id, checked)}
              />
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const ZONE_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
];

interface ColorPickerProps {
  value: string;
  onValueChange: (color: string) => void;
}

export function ColorPicker({ value, onValueChange }: ColorPickerProps) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {ZONE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onValueChange(color)}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110",
            value === color && "ring-2 ring-offset-2 ring-offset-background"
          )}
          style={{
            backgroundColor: color,
            ...(value === color ? { ringColor: color } : {}),
          }}
        >
          {value === color && <Check className="h-3.5 w-3.5 text-white" />}
        </button>
      ))}
    </div>
  );
}

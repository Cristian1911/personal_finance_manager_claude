"use client";

import { cn } from "@/lib/utils";

const CATEGORY_ICONS = [
  "🏠", "🍕", "🚌", "💡", "🏥", "🎓", "👶",
  "🎯", "🎬", "🛍️", "✈️", "💪", "🎮", "☕",
  "💰", "📈", "🏦", "💳", "🎁", "📱", "🔧",
  "👗", "🐾", "🌿", "📚", "🎵", "🍺", "🏋️",
  "🚗", "🏡", "💊", "🧹", "👨‍💻", "🎨", "📦",
];

interface IconPickerProps {
  value: string;
  onValueChange: (icon: string) => void;
}

export function IconPicker({ value, onValueChange }: IconPickerProps) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {CATEGORY_ICONS.map((icon) => (
        <button
          key={icon}
          type="button"
          onClick={() => onValueChange(icon)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors hover:bg-accent",
            value === icon && "bg-accent ring-2 ring-primary"
          )}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";
import { chipBackground, zoneTextColor } from "@/lib/utils/zone-colors";

interface SubcategoryChipProps {
  name: string;
  icon?: string;
  color: string;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function SubcategoryChip({
  name,
  icon,
  color,
  isSelected,
  onClick,
  className,
}: SubcategoryChipProps) {
  const Component = onClick ? "button" : "span";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        onClick && "cursor-pointer hover:opacity-80",
        isSelected && "ring-2 ring-offset-1 ring-offset-background",
        className
      )}
      style={{
        backgroundColor: chipBackground(color),
        color: zoneTextColor(color),
        ...(isSelected ? { ringColor: color } : {}),
      }}
    >
      {icon && <span className="text-[11px]">{icon}</span>}
      <span className="truncate">{name}</span>
    </Component>
  );
}

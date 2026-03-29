"use client";

import { X } from "lucide-react";
import type { Tag } from "@/types/domain";

interface TagChipProps {
  tag: Tag;
  groupColor?: string | null;
  onRemove?: () => void;
  size?: "sm" | "md";
}

export function TagChip({ tag, groupColor, onRemove, size = "md" }: TagChipProps) {
  const color = tag.color ?? groupColor ?? "rgba(255,255,255,0.15)";
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${sizeClasses}`}
      style={{
        borderColor: color,
        backgroundColor: `${color}15`,
      }}
    >
      <span style={{ color }}>{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 rounded-full p-0.5 hover:bg-white/10"
        >
          <X className="size-3" style={{ color }} />
        </button>
      )}
    </span>
  );
}

"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ExpandableCardProps {
  expanded: boolean;
  onToggle: () => void;
  compact: ReactNode;
  detail: ReactNode;
  className?: string;
  disableCompactTap?: boolean;
}

export function ExpandableCard({
  expanded,
  onToggle,
  compact,
  detail,
  className,
  disableCompactTap = false,
}: ExpandableCardProps) {
  return (
    <div
      className={cn(
        "rounded-[18px] border border-white/6 bg-[#111] transition-colors",
        expanded && "border-white/10",
        className
      )}
    >
      <button
        type="button"
        className="w-full text-left"
        onClick={disableCompactTap ? undefined : onToggle}
        aria-expanded={expanded}
      >
        {compact}
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "transition-opacity duration-150",
              expanded ? "opacity-100 delay-75" : "opacity-0"
            )}
          >
            {detail}
          </div>
        </div>
      </div>
    </div>
  );
}

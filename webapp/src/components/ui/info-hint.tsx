"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface InfoHintProps {
  /** Popover body — pass a string for plain text or nodes for richer content. */
  children: React.ReactNode;
  /** Optional bold heading inside the popover. */
  title?: string;
  /** Accessible label for the "?" trigger. */
  label?: string;
  /** Brass trigger signals an actionable nudge sits behind the hint. */
  tone?: "default" | "brass";
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /** Extra classes for the trigger. */
  className?: string;
}

/**
 * Guided-experience InfoHint primitive (design "Experiencia guiada" · D4).
 * A discreet "?" next to a number that needs context. Tap → popover.
 * Touch-friendly (Popover, not hover-only Tooltip). Sage by default; brass
 * only when there is an actionable nudge behind it. Never blocks.
 */
export function InfoHint({
  children,
  title,
  label = "Más información",
  tone = "default",
  side = "bottom",
  align = "start",
  className,
}: InfoHintProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-z-brass/50",
            tone === "brass"
              ? "border-z-brass/40 bg-z-brass/15 text-z-brass hover:bg-z-brass/25"
              : "border-white/15 bg-white/[0.04] text-z-sage-dark hover:text-z-sage-light",
            className,
          )}
        >
          ?
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        onClick={(e) => e.stopPropagation()}
        className="w-64 rounded-xl border-white/6 bg-z-surface-3 p-3.5 text-left shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)]"
      >
        {title ? (
          <p className="mb-1 text-sm font-semibold text-foreground">{title}</p>
        ) : null}
        <div className="text-[12.5px] leading-relaxed text-muted-foreground">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}

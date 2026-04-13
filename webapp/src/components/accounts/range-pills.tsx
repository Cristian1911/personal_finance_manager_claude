"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Days to look back. 0 = show all data. */
export type RangeValue = 0 | 7 | 14 | 30 | 90 | 180 | 365;

const RANGES: { label: string; value: RangeValue }[] = [
  { label: "1S", value: 7 },
  { label: "2S", value: 14 },
  { label: "1M", value: 30 },
  { label: "3M", value: 90 },
  { label: "6M", value: 180 },
  { label: "1A", value: 365 },
  { label: "Todo", value: 0 },
];

interface RangePillsProps {
  value: RangeValue;
  onChange: (v: RangeValue) => void;
  className?: string;
}

export function RangePills({ value, onChange, className }: RangePillsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Scroll active pill into view on mount and when value changes
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [value]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "max-w-[140px] overflow-x-auto scrollbar-none",
        "flex snap-x snap-mandatory gap-1",
        className,
      )}
    >
      {RANGES.map((r) => (
        <button
          key={r.value}
          ref={r.value === value ? activeRef : undefined}
          type="button"
          onClick={() => onChange(r.value)}
          className={cn(
            "shrink-0 snap-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
            value === r.value
              ? "bg-z-brass text-z-ink"
              : "bg-white/[0.04] text-z-sage-dark hover:bg-white/[0.08]",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

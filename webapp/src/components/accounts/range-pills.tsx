"use client";

import { cn } from "@/lib/utils";

export type RangeValue = 0 | 3 | 6 | 12;

const RANGES: { label: string; value: RangeValue }[] = [
  { label: "3M", value: 3 },
  { label: "6M", value: 6 },
  { label: "1A", value: 12 },
  { label: "Todo", value: 0 },
];

interface RangePillsProps {
  value: RangeValue;
  onChange: (v: RangeValue) => void;
  className?: string;
}

export function RangePills({ value, onChange, className }: RangePillsProps) {
  return (
    <div className={cn("flex gap-1", className)}>
      {RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          onClick={() => onChange(r.value)}
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
            value === r.value
              ? "bg-z-brass text-z-ink"
              : "bg-white/[0.04] text-z-sage-dark hover:bg-white/[0.08]"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

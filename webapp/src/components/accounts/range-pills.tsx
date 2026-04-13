"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    return () => el.removeEventListener("scroll", updateScrollState);
  }, [updateScrollState]);

  // Scroll active pill into view on mount and value change
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [value]);

  function scrollBy(dir: -1 | 1) {
    scrollRef.current?.scrollBy({ left: dir * 80, behavior: "smooth" });
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Left arrow */}
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        className={cn(
          "shrink-0 text-z-sage-dark/50 transition-opacity hover:text-z-sage-dark",
          canScrollLeft ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        tabIndex={-1}
        aria-label="Anterior"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      {/* Scrollable pills */}
      <div
        ref={scrollRef}
        className="max-w-[120px] flex snap-x snap-mandatory gap-1 overflow-x-auto scrollbar-none"
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

      {/* Right arrow */}
      <button
        type="button"
        onClick={() => scrollBy(1)}
        className={cn(
          "shrink-0 text-z-sage-dark/50 transition-opacity hover:text-z-sage-dark",
          canScrollRight ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        tabIndex={-1}
        aria-label="Siguiente"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

"use client";

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RecurringMiniCalendarProps {
  monthCursor: Date;
  onNavigate: (delta: number) => void;
  monthLabel: string;
  dateOccurrenceCounts: Map<string, { total: number; completed: number }>;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

/* ------------------------------------------------------------------ */
/*  Day header labels (Mon-Sun, Spanish abbreviations)                 */
/* ------------------------------------------------------------------ */

const DAY_HEADERS = ["L", "M", "X", "J", "V", "S", "D"] as const;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function RecurringMiniCalendar({
  monthCursor,
  onNavigate,
  monthLabel,
  dateOccurrenceCounts,
  selectedDate,
  onSelectDate,
}: RecurringMiniCalendarProps) {
  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);

  // Build the full calendar grid (start on Monday = { weekStartsOn: 1 })
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <div className="rounded-lg border bg-card p-3">
      {/* Month navigation header */}
      <div className="mb-2 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onNavigate(-1)}
          aria-label="Mes anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>

        <span className="text-sm font-medium capitalize">{monthLabel}</span>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onNavigate(1)}
          aria-label="Mes siguiente"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
        {DAY_HEADERS.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>

      {/* Day cells */}
      <div className="mt-1 grid grid-cols-7 gap-y-0.5">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, monthCursor);
          const today = isToday(day);
          const counts = dateOccurrenceCounts.get(dateStr);
          const hasOccurrences = counts != null && counts.total > 0;
          const isSelected = selectedDate === dateStr;

          if (!inMonth) {
            return <div key={dateStr} className="h-8" />;
          }

          const pendingCount = counts
            ? counts.total - counts.completed
            : 0;
          const completedCount = counts?.completed ?? 0;

          // Build dots: amber for pending, green for completed (max 3 total)
          const dots: ("amber" | "green")[] = [];
          for (let i = 0; i < Math.min(pendingCount, 3); i++) dots.push("amber");
          for (
            let i = 0;
            i < Math.min(completedCount, 3 - dots.length);
            i++
          )
            dots.push("green");

          return (
            <button
              key={dateStr}
              type="button"
              disabled={!hasOccurrences}
              onClick={() => {
                if (!hasOccurrences) return;
                onSelectDate(isSelected ? null : dateStr);
              }}
              className={cn(
                "relative mx-auto flex h-8 w-8 flex-col items-center justify-center rounded-md text-xs transition-colors",
                !hasOccurrences && "cursor-default text-muted-foreground/60",
                hasOccurrences &&
                  "cursor-pointer hover:bg-accent",
                today && "font-bold text-primary",
                isSelected &&
                  "ring-2 ring-primary ring-offset-1 ring-offset-background"
              )}
            >
              <span className="leading-none">{format(day, "d")}</span>

              {/* Occurrence dots */}
              {dots.length > 0 && (
                <span className="mt-0.5 flex gap-px">
                  {dots.map((color, i) => (
                    <span
                      key={i}
                      className={cn(
                        "inline-block size-1 rounded-full",
                        color === "amber" && "bg-amber-500",
                        color === "green" && "bg-green-500"
                      )}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import type { RitmoData } from "@/actions/ritmo";

/**
 * V7 hybrid hero — Option A canonical. Predictive-runway model:
 *   - "Hoy puedes gastar" as the bold anchor
 *   - Period progress bar (sage → amber → red as user burns through the
 *     period's available balance)
 *   - Collapsible month calendar showing daily spend buckets relative to
 *     the user's own pace
 *
 * Replaces the 50/30/20 allocation hero. Allocation lens belongs in
 * /presupuesto. See claude-ai-design/hero-runway-brainstorm.html for the
 * design spec.
 */

interface HybridHeroProps {
  data: RitmoData;
  /** Initial expanded state for the calendar — persisted via localStorage. */
  defaultExpanded?: boolean;
}

const BUCKET_CLASS: Record<string, string> = {
  none: "bg-z-surface-2 text-z-sage-dark",
  low: "bg-z-income/20 text-z-sage-dark",
  med: "bg-z-alert/35 text-z-sage-dark",
  high: "bg-z-debt/45 text-z-white",
};

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"]; // Spanish week, Mon-start

function dayOfMonth(iso: string): number {
  return parseInt(iso.slice(8, 10), 10);
}

function weekdayMondayStart(iso: string): number {
  // JS getDay(): 0=Sun..6=Sat. Map to 0=Mon..6=Sun for ES calendars.
  const d = new Date(`${iso}T12:00:00`).getDay();
  return (d + 6) % 7;
}

export function HybridHero({ data, defaultExpanded = false }: HybridHeroProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const allowedTone =
    data.allowedToday <= 0
      ? "text-z-debt"
      : data.spentFraction >= 0.85
        ? "text-z-alert"
        : "text-z-income";

  const sub =
    data.allowedToday <= 0
      ? "Hoy te pasaste del cupo diario — frena para llegar al cierre."
      : data.onTrack
        ? "y aún llegas al cierre del período con tu colchón."
        : "pero vas rápido — revisa los próximos días.";

  return (
    <div className="rounded-2xl border border-white/6 bg-z-surface p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark mb-2">
        Hoy puedes gastar
      </p>

      <p className={cn("text-[44px] font-bold leading-none tracking-[-0.04em] tabular-nums", allowedTone)}>
        {formatCurrency(data.allowedToday, data.currency)}
      </p>

      <p className="mt-2 text-sm text-z-sage-light leading-snug">{sub}</p>

      {/* Period progress bar — gradient mapped to spentFraction */}
      <div className="relative mt-5 h-2.5 w-full overflow-hidden rounded-full bg-z-surface-2">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.round(data.spentFraction * 100))}%`,
            background:
              "linear-gradient(to right, var(--color-z-excellent, #3D9E6E) 0%, var(--color-z-sage, #768053) 30%, var(--color-z-alert, #D4A843) 70%, var(--color-z-debt, #E05545) 100%)",
            transition: "width 0.5s ease",
          }}
        />
      </div>
      <div className="mt-2 flex items-baseline justify-between text-[11px] text-z-sage-dark tabular-nums">
        <span>
          {formatCurrency(data.spentMonth, data.currency)} gastados ·{" "}
          {formatCurrency(data.availableTotal, data.currency)} restantes
        </span>
        <span className="font-medium text-z-sage-light">
          {Math.round(data.spentFraction * 100)}% del período
        </span>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/6 px-3 py-2 text-[11px] font-semibold tracking-wide text-z-sage-light hover:bg-white/[0.02]"
        aria-expanded={expanded}
      >
        <span>{expanded ? "Ocultar patrón del mes" : "Ver patrón del mes"}</span>
        <ChevronDown
          className={cn(
            "size-3.5 text-z-brass transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {expanded && (
        <div className="mt-4 border-t border-dashed border-white/6 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark mb-3">
            Patrón de gasto · este mes
          </p>
          <CalendarHeatmap data={data} />
          <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-z-sage-dark">
            <span className="inline-flex items-center gap-1.5">
              <i className="size-2.5 rounded-sm bg-z-income/20" /> Día tranquilo
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="size-2.5 rounded-sm bg-z-alert/35" /> Día normal
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="size-2.5 rounded-sm bg-z-debt/45" /> Día caro
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarHeatmap({ data }: { data: RitmoData }) {
  // Lay out the month in a 7-column grid, Monday-first. Future days from the
  // current month appear with low opacity. Empty leading slots align the
  // first-of-the-month to its weekday column.
  if (data.calendar.length === 0) return null;

  const firstIso = data.calendar[0].date;
  const leadingEmpty = weekdayMondayStart(firstIso);

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {WEEKDAY_LABELS.map((label) => (
        <div
          key={label}
          className="text-center text-[9px] font-semibold uppercase tracking-wider text-z-sage-dark"
        >
          {label}
        </div>
      ))}
      {Array.from({ length: leadingEmpty }).map((_, i) => (
        <div key={`empty-${i}`} className="aspect-square" />
      ))}
      {data.calendar.map((day) => (
        <div
          key={day.date}
          className={cn(
            "flex aspect-square items-start justify-end rounded-md px-1 py-0.5 text-[9px] tabular-nums",
            BUCKET_CLASS[day.bucket] ?? BUCKET_CLASS.none,
            day.isFuture && "opacity-30",
            day.isToday && "outline outline-2 outline-offset-[-2px] outline-white",
          )}
          title={
            day.expense > 0
              ? `${day.date}: ${formatCurrency(day.expense, data.currency)}`
              : day.date
          }
        >
          {dayOfMonth(day.date)}
        </div>
      ))}
    </div>
  );
}

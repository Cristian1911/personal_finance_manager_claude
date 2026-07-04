"use client";

import { memo, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { Verdict } from "@/components/ui/verdict";
import {
  BUCKET_LABEL,
  WEEKDAYS_MONDAY_START,
  deriveRitmoStatus,
  weekdayMondayStart,
  type DailyBucket,
  type RitmoStatusTone,
} from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";
import type { RitmoData } from "@/actions/ritmo";

export interface PrimaryAccountSummary {
  id: string;
  name: string;
  currentBalance: number;
  currencyCode: CurrencyCode;
}

interface HybridHeroProps {
  data: RitmoData;
  primaryAccount?: PrimaryAccountSummary;
  defaultExpanded?: boolean;
}

const BUCKET_CLASS: Record<DailyBucket, string> = {
  none: "bg-z-surface-2 text-z-white",
  low: "bg-z-income/20 text-z-white",
  med: "bg-z-alert/35 text-z-white",
  high: "bg-z-debt/45 text-z-white",
};

const TONE_TEXT_CLASS: Record<RitmoStatusTone, string> = {
  income: "text-z-income",
  alert: "text-z-alert",
  debt: "text-z-debt",
};

const TONE_STROKE: Record<RitmoStatusTone, string> = {
  income: "var(--color-z-sage)",
  alert: "var(--color-z-alert)",
  debt: "var(--color-z-debt)",
};

type ExpandedView = "calc" | "pattern";

function dayOfMonth(iso: string): number {
  return parseInt(iso.slice(8, 10), 10);
}

function formatDayLabel(iso: string): string {
  // Chrome on macOS title-cases the weekday and keeps a trailing period
  // ("Vie. 21 may"); strip both so the label reads consistently.
  const raw = new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return raw.replace(/\./g, "").toLowerCase();
}

export function HybridHero({ data, primaryAccount, defaultExpanded = false }: HybridHeroProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [view, setView] = useState<ExpandedView>("calc");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const overspentToday = data.spentToday > data.availablePerDay;
  const status = deriveRitmoStatus(data);
  const statusTextClass = TONE_TEXT_CLASS[status.tone];
  // "income" tone falls through to a muted color when nothing was spent
  // today — there's no "you spent $0" achievement to celebrate in green.
  const todayTone =
    !data.incomeConfigured || (status.tone === "income" && data.spentToday === 0)
      ? "text-z-sage-light"
      : statusTextClass;

  // Last-7-days OUTFLOW series for the mini sparkline — read from
  // data.calendar so it scales with the user's actual month-to-date data.
  // If the month is fresh (< 7 days), we just plot what we have.
  const sparkData = useMemo(() => {
    const slice = data.calendar.slice(-7);
    const max = slice.reduce((m, d) => Math.max(m, d.expense), 0);
    return { values: slice.map((d) => d.expense), max };
  }, [data.calendar]);

  // Cumulative outflow through each day in the month. Used to compute
  // "remaining balance after this day" on the calendar-click detail.
  // Indexed by date so the lookup is O(1) on selection.
  const cumulativeByDate = useMemo(() => {
    const map = new Map<string, number>();
    let running = 0;
    for (const day of data.calendar) {
      running += day.expense;
      map.set(day.date, running);
    }
    return map;
  }, [data.calendar]);

  const selectedEntry = useMemo(
    () => (selectedDay ? data.calendar.find((d) => d.date === selectedDay) : null),
    [selectedDay, data.calendar],
  );

  const selectedBalance = useMemo(() => {
    if (!selectedDay || !selectedEntry) return null;
    // Period budget minus cumulative spend through this date = headroom
    // remaining after this day's transactions. For FUTURE days the value
    // assumes only the past spend has fired.
    const cumulative = cumulativeByDate.get(selectedDay) ?? 0;
    return data.periodBudget - cumulative;
  }, [selectedDay, selectedEntry, cumulativeByDate, data.periodBudget]);

  return (
    <div className="rounded-2xl border border-white/6 bg-z-surface-2/80 p-5">
      {/* Top row: eyebrow ("Gasto de hoy"); the verdict lives under the
          number (slot: eyebrow → number → verdict → detail), never here. */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Gasto de hoy
        </p>
        {!data.incomeConfigured && (
          <span
            role="status"
            aria-label="Sin datos suficientes para un veredicto"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/6 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-z-sage-dark"
          >
            <span className="size-1.5 rounded-full bg-z-sage-dark" />
            Sin datos aún
          </span>
        )}
      </div>

      {/* Bottom row: today's spend (the headline fact) + sparkline. */}
      <div className="mt-2 flex items-end justify-between gap-3">
        <p
          className={cn(
            "text-[44px] font-bold leading-none tracking-[-0.04em] tabular-nums",
            todayTone,
          )}
        >
          {formatCurrency(data.spentToday, data.currency)}
        </p>
        {sparkData.values.length > 0 && (
          <HeroSparkline
            values={sparkData.values}
            max={sparkData.max}
            tone={status.tone}
          />
        )}
      </div>

      {/* Verdict chip — the one full-volume status element on this screen. */}
      {data.incomeConfigured && (
        <div className="mt-2">
          <Verdict state={status.state} />
        </div>
      )}

      {/* Daily allowance context line. Always rendered — it's the
          baseline the headline is being compared against. Tone shifts
          to amber when today is over the daily budget. */}
      {data.incomeConfigured ? (
        <p
          className={cn(
            "mt-1.5 text-[12px] tabular-nums",
            overspentToday ? "text-z-alert" : "text-z-sage-light",
          )}
        >
          {overspentToday ? (
            <>
              Por encima de {formatCurrency(data.availablePerDay, data.currency)} al día
            </>
          ) : (
            <>
              de {formatCurrency(data.availablePerDay, data.currency)} al día
            </>
          )}
        </p>
      ) : (
        <Link
          href="/settings/perfil"
          className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-z-brass hover:text-z-brass-hot"
        >
          Agrega tu ingreso para calcular tu ritmo
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      )}

      <p className="mt-5 text-right text-[10px] font-medium text-z-sage-light tabular-nums">
        {Math.round(data.spentFraction * 100)}% del período
      </p>
      <div className="relative mt-1 h-2.5 w-full overflow-hidden rounded-full bg-z-surface-2">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.round(data.spentFraction * 100))}%`,
            background:
              "linear-gradient(to right, var(--color-z-excellent) 0%, var(--color-z-sage) 30%, var(--color-z-alert) 70%, var(--color-z-debt) 100%)",
            transition: "width 0.5s ease",
          }}
        />
      </div>
      {/* Legend below — each metric on its own line so they breathe. */}
      <dl className="mt-3 space-y-1 text-[11px] tabular-nums">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-z-sage-dark">Gastados</dt>
          <dd className="text-z-sage-light">
            {formatCurrency(data.spentMonth, data.currency)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-z-sage-dark">Restantes</dt>
          <dd
            className={cn(
              data.availableTotal < 0 ? "text-z-debt" : "text-z-sage-light",
            )}
          >
            {formatCurrency(data.availableTotal, data.currency)}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/6 px-3 py-2 text-[11px] font-semibold tracking-[0.12em] text-z-sage-light hover:bg-white/[0.02]"
        aria-expanded={expanded}
      >
        <span>{expanded ? "Ocultar detalle" : "Ver detalle"}</span>
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
          {/* View tabs */}
          <div className="mb-3 flex gap-1 rounded-lg border border-white/6 bg-z-surface-2 p-0.5">
            <button
              type="button"
              onClick={() => setView("calc")}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
                view === "calc"
                  ? "bg-z-brass/20 text-z-brass"
                  : "text-z-sage-dark hover:text-z-sage-light",
              )}
              aria-pressed={view === "calc"}
            >
              Cómo se calcula
            </button>
            <button
              type="button"
              onClick={() => setView("pattern")}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
                view === "pattern"
                  ? "bg-z-brass/20 text-z-brass"
                  : "text-z-sage-dark hover:text-z-sage-light",
              )}
              aria-pressed={view === "pattern"}
            >
              Patrón del mes
            </button>
          </div>

          {view === "calc" ? (
            <CalculoView data={data} primaryAccount={primaryAccount} />
          ) : (
            <>
              <CalendarHeatmap
                data={data}
                selectedDay={selectedDay}
                onSelect={(date) => setSelectedDay((prev) => (prev === date ? null : date))}
              />
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
              {selectedEntry && (
                <div className="mt-3 rounded-lg border border-white/6 bg-z-surface-2 p-3 text-xs">
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold text-z-sage-light">
                      {formatDayLabel(selectedEntry.date)}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-z-sage-dark">
                      {BUCKET_LABEL[selectedEntry.bucket] ?? ""}
                    </span>
                  </div>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                    {selectedEntry.expense > 0
                      ? `−${formatCurrency(selectedEntry.expense, data.currency)}`
                      : "Sin gasto"}
                  </p>
                  {selectedBalance !== null && (
                    <p
                      className={cn(
                        "mt-1 text-[11px] tabular-nums",
                        selectedBalance < 0 ? "text-z-debt" : "text-z-sage-dark",
                      )}
                    >
                      Restante después de este día:{" "}
                      <span className="font-semibold">
                        {formatCurrency(selectedBalance, data.currency)}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Línea-por-línea de cómo se calcula el "Disponible" / "Hoy puedes gastar". */
const CalculoView = memo(function CalculoView({
  data,
  primaryAccount,
}: {
  data: RitmoData;
  primaryAccount?: PrimaryAccountSummary;
}) {
  const dailyValue = `${formatCurrency(data.availablePerDay, data.currency)}/día`;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-white/6 bg-z-surface-2 p-3 space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-brass">
          Cómo se calcula
        </p>
        <div className="flex justify-between text-xs text-z-sage-light">
          <span>Saldo líquido</span>
          <span className="tabular-nums">
            {formatCurrency(data.liquidBalance, data.currency)}
          </span>
        </div>
        <div className="flex justify-between text-xs text-z-sage-light">
          <span>− Obligaciones pendientes</span>
          <span className="tabular-nums text-z-expense">
            −{formatCurrency(data.pendingObligationsTotal, data.currency)}
          </span>
        </div>
        <div className="flex justify-between text-xs text-z-sage-light">
          <span>− Ya gastado</span>
          <span className="tabular-nums text-z-expense">
            −{formatCurrency(data.spentMonth, data.currency)}
          </span>
        </div>
        <div className="flex justify-between border-t border-white/6 pt-1.5 text-xs font-semibold text-foreground">
          <span>= Disponible</span>
          <span
            className={cn(
              "tabular-nums",
              data.availableTotal <= 0 && "text-z-debt",
            )}
          >
            {formatCurrency(data.availableTotal, data.currency)}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          ÷ {data.daysRemaining} días (hasta {data.windowEndLabel}) = {dailyValue}
        </p>
        {data.nextIncomeDateLabel && data.nextIncomeAmount > 0 && (
          <div className="flex justify-between border-t border-white/6 pt-1.5 text-xs text-z-income">
            <span className="truncate">
              Próximo ingreso: {data.nextIncomeName ?? "ingreso"}
            </span>
            <span className="shrink-0 tabular-nums">
              +{formatCurrency(data.nextIncomeAmount, data.currency)} el{" "}
              {data.nextIncomeDateLabel}
            </span>
          </div>
        )}
      </div>

      {primaryAccount && (
        <Link
          href={`/accounts/${primaryAccount.id}`}
          className="flex items-center justify-between rounded-lg border border-white/6 bg-black/20 p-3 transition-colors hover:bg-white/[0.04]"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              Cuenta principal
            </p>
            <p className="mt-0.5 truncate text-[12px] text-z-sage-light">
              {primaryAccount.name}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <p className="text-[15px] font-bold tabular-nums text-foreground">
              {formatCurrency(primaryAccount.currentBalance, primaryAccount.currencyCode)}
            </p>
            <ChevronRight className="size-3.5 text-muted-foreground/50" />
          </div>
        </Link>
      )}
    </div>
  );
});

/** Tiny inline sparkline of the last-N OUTFLOW series. Stroke colour tracks
 *  the hero's status so a "Te pasaste" hero shows a red rhythm and a
 *  "Vas bien" hero shows a sage one — same emotional cue as the main amount. */
const HeroSparkline = memo(function HeroSparkline({
  values,
  max,
  tone,
}: {
  values: number[];
  max: number;
  tone: RitmoStatusTone;
}) {
  const width = 96;
  const height = 32;
  const pad = 3;
  const stroke = TONE_STROKE[tone];

  if (values.length === 0) return null;

  // Single-day case: draw a flat baseline so the SVG still occupies space.
  if (values.length === 1) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
        <line
          x1={pad}
          x2={width - pad}
          y1={height / 2}
          y2={height / 2}
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.6}
        />
      </svg>
    );
  }

  const safeMax = max > 0 ? max : 1;
  const step = (width - pad * 2) / (values.length - 1);
  const points = values.map((v, i) => {
    const x = pad + step * i;
    const y = height - pad - (v / safeMax) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});

const CalendarHeatmap = memo(function CalendarHeatmap({
  data,
  selectedDay,
  onSelect,
}: {
  data: RitmoData;
  selectedDay: string | null;
  onSelect: (date: string) => void;
}) {
  if (data.calendar.length === 0) return null;

  const firstIso = data.calendar[0].date;
  const leadingEmpty = weekdayMondayStart(firstIso);

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark mb-2">
        Toca un día para ver su detalle
      </p>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS_MONDAY_START.map((label) => (
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
        {data.calendar.map((day) => {
          const isSelected = day.date === selectedDay;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelect(day.date)}
              className={cn(
                "flex aspect-square items-start justify-end rounded-md px-1 py-0.5 text-[9px] tabular-nums transition-transform active:scale-95",
                BUCKET_CLASS[day.bucket] ?? BUCKET_CLASS.none,
                day.isFuture && "opacity-30",
                isSelected && "outline outline-2 outline-offset-[-2px] outline-z-brass",
              )}
              aria-pressed={isSelected}
              aria-label={`${formatDayLabel(day.date)} — ${BUCKET_LABEL[day.bucket]}, ${day.expense > 0 ? `−${formatCurrency(day.expense, data.currency)}` : "sin gasto"}`}
            >
              {dayOfMonth(day.date)}
            </button>
          );
        })}
      </div>
    </div>
  );
});

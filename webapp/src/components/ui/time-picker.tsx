"use client";

import * as React from "react";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Period = "AM" | "PM";

interface TimePickerProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
  /** HTML name attribute for form submission (renders a hidden input). */
  name?: string;
  /** HTML id used by sibling <Label htmlFor={...}>. Defaults to `name`. */
  id?: string;
  placeholder?: string;
  /** Minute granularity for the grid (default 5). The current minute is always
   *  included even if it isn't a multiple of the step. */
  minuteStep?: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Parse stored 24h "HH:mm" → 24h hour + minute. */
function parseTime(value: string | null | undefined): { h: number | null; m: number | null } {
  if (!value) return { h: null, m: null };
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return { h: null, m: null };
  return { h: Number(match[1]), m: Number(match[2]) };
}

/** Build a 24h "HH:mm" from 12h hour (1-12) + period + minute. */
function build(hour12: number, period: Period, minute: number): string {
  let h = hour12 % 12; // 12 → 0
  if (period === "PM") h += 12; // 0→12 … 11→23
  return `${pad(h)}:${pad(minute)}`;
}

/**
 * Time-of-day picker. Stores values as 24h "HH:mm". Opens a popover with
 * tap-to-select hour / minute grids + an AM·PM toggle (no keyboard, no inner
 * scroll — so it works inside vaul drawers too).
 */
export function TimePicker({
  value,
  onChange,
  disabled = false,
  className,
  name,
  id,
  placeholder = "HH:MM",
  minuteStep = 5,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const { h: h24, m } = parseTime(value);
  const hour12 = h24 == null ? null : ((h24 + 11) % 12) + 1;
  const period: Period = h24 != null && h24 >= 12 ? "PM" : "AM";
  const display = value ? `${pad(hour12 ?? 12)}:${pad(m ?? 0)} ${period}` : null;

  const hours = React.useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const minutes = React.useMemo(() => {
    const base = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep);
    // Keep the existing exact minute selectable even when it's off-step.
    if (m != null && !base.includes(m)) base.push(m);
    return base.sort((a, b) => a - b);
  }, [minuteStep, m]);

  return (
    <>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id ?? name}
            disabled={disabled}
            className={cn(
              "flex h-9 w-full items-center gap-2 rounded-md border border-white/6 bg-transparent px-3 text-sm transition-colors hover:bg-white/[0.03] disabled:opacity-50",
              className,
            )}
          >
            <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className={cn("tabular-nums", display ? "text-foreground" : "text-muted-foreground")}>
              {display ?? placeholder}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[244px] space-y-3 p-3" align="start" sideOffset={6}>
          <Section label="Hora">
            <div className="grid grid-cols-6 gap-1">
              {hours.map((hh) => (
                <Cell
                  key={hh}
                  active={hour12 === hh}
                  onClick={() => onChange(build(hh, period, m ?? 0))}
                >
                  {pad(hh)}
                </Cell>
              ))}
            </div>
          </Section>

          <Section label="Minuto">
            <div className="grid grid-cols-6 gap-1">
              {minutes.map((mm) => (
                <Cell
                  key={mm}
                  active={m === mm}
                  onClick={() => onChange(build(hour12 ?? 12, period, mm))}
                >
                  {pad(mm)}
                </Cell>
              ))}
            </div>
          </Section>

          <div className="grid grid-cols-2 gap-1">
            {(["AM", "PM"] as const).map((p) => (
              <Cell
                key={p}
                active={value != null && period === p}
                onClick={() => onChange(build(hour12 ?? 12, p, m ?? 0))}
              >
                {p}
              </Cell>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function Cell({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md py-1.5 text-center text-sm tabular-nums transition-colors",
        active
          ? "bg-z-brass/15 font-semibold text-z-brass"
          : "text-foreground hover:bg-white/5",
      )}
    >
      {children}
    </button>
  );
}

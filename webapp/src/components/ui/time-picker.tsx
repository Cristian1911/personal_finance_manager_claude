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
  /** Minute granularity (default 1). */
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
 * scrollable hour / minute columns + an AM·PM toggle (alarm-clock style).
 *
 * The popover portals into the nearest modal (`[role="dialog"]` — vaul drawers
 * and Radix dialogs both qualify) so its columns scroll inside that modal's
 * scroll-lock instead of being blocked as portaled-to-body content.
 */
export function TimePicker({
  value,
  onChange,
  disabled = false,
  className,
  name,
  id,
  placeholder = "HH:MM",
  minuteStep = 1,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [container, setContainer] = React.useState<HTMLElement | null>(null);

  const { h: h24, m } = parseTime(value);
  const hour12 = h24 == null ? null : ((h24 + 11) % 12) + 1;
  const period: Period = h24 != null && h24 >= 12 ? "PM" : "AM";
  const display = value ? `${pad(hour12 ?? 12)}:${pad(m ?? 0)} ${period}` : null;

  const hours = React.useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const minutes = React.useMemo(
    () => Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep),
    [minuteStep],
  );

  function handleOpenChange(next: boolean) {
    if (next) {
      setContainer(triggerRef.current?.closest<HTMLElement>('[role="dialog"]') ?? null);
    }
    setOpen(next);
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            ref={triggerRef}
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
        <PopoverContent
          container={container ?? undefined}
          className="w-auto p-0"
          align="start"
          sideOffset={6}
        >
          <div className="flex">
            <ScrollColumn
              label="Hora"
              items={hours}
              selected={hour12}
              open={open}
              onSelect={(nh) => onChange(build(nh, period, m ?? 0))}
            />
            <div className="w-px self-stretch bg-white/6" />
            <ScrollColumn
              label="Min"
              items={minutes}
              selected={m}
              open={open}
              onSelect={(nm) => onChange(build(hour12 ?? 12, period, nm))}
            />
            <div className="w-px self-stretch bg-white/6" />
            <div className="flex flex-col">
              <ColumnHeader>AM/PM</ColumnHeader>
              <div className="flex h-48 w-16 flex-col justify-center gap-1 p-1.5">
                {(["AM", "PM"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onChange(build(hour12 ?? 12, p, m ?? 0))}
                    className={cn(
                      "rounded-md px-2 py-2 text-center text-sm font-semibold transition-colors",
                      value != null && period === p
                        ? "bg-z-brass/15 text-z-brass"
                        : "text-foreground hover:bg-white/5",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

function ScrollColumn({
  label,
  items,
  selected,
  open,
  onSelect,
}: {
  label: string;
  items: number[];
  selected: number | null;
  open: boolean;
  onSelect: (value: number) => void;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const selectedRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      const el = selectedRef.current;
      const container = scrollRef.current;
      if (!el || !container) return;
      container.scrollTop = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
    });
  }, [open]);

  return (
    <div className="flex flex-col">
      <ColumnHeader>{label}</ColumnHeader>
      <div
        ref={scrollRef}
        className="relative h-48 w-16 overflow-y-auto overscroll-contain py-1 scrollbar-none"
      >
        {items.map((it) => {
          const isSel = selected === it;
          return (
            <button
              key={it}
              ref={isSel ? selectedRef : undefined}
              type="button"
              onClick={() => onSelect(it)}
              className={cn(
                "block w-full rounded-md px-2 py-1.5 text-center text-sm tabular-nums transition-colors",
                isSel
                  ? "bg-z-brass/15 font-semibold text-z-brass"
                  : "text-foreground hover:bg-white/5",
              )}
            >
              {pad(it)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ColumnHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-white/6 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

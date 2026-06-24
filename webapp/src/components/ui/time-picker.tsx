"use client";

import * as React from "react";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

function parseTime(value: string | null | undefined): { h: number | null; m: number | null } {
  if (!value) return { h: null, m: null };
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return { h: null, m: null };
  return { h: Number(match[1]), m: Number(match[2]) };
}

/**
 * Time-of-day picker. Stores values as "HH:mm" strings. Opens a popover with
 * tap-to-select hour and minute columns (no keyboard) — alarm-clock style.
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
  const { h, m } = parseTime(value);
  const display = value ? `${pad(h ?? 0)}:${pad(m ?? 0)}` : null;

  const hours = React.useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = React.useMemo(
    () => Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep),
    [minuteStep],
  );

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
        <PopoverContent className="w-auto p-0" align="start" sideOffset={6}>
          <div className="flex">
            <TimeColumn
              label="Hora"
              items={hours}
              selected={h}
              open={open}
              onSelect={(nh) => onChange(`${pad(nh)}:${pad(m ?? 0)}`)}
            />
            <div className="w-px self-stretch bg-white/6" />
            <TimeColumn
              label="Min"
              items={minutes}
              selected={m}
              open={open}
              onSelect={(nm) => onChange(`${pad(h ?? 0)}:${pad(nm)}`)}
            />
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

function TimeColumn({
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

  // Center the selected value when the popover opens. Manual scrollTop (not
  // scrollIntoView) so it stays scoped to this column and doesn't shove the
  // popover/page around.
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
      <div className="border-b border-white/6 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
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

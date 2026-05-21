"use client";

import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";

interface TimePickerProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
  /** HTML name attribute for form submission */
  name?: string;
  /** HTML id used by sibling <Label htmlFor={...}>. Defaults to `name`. */
  id?: string;
  placeholder?: string;
}

/**
 * Lightweight time-of-day picker. Stores values as "HH:mm" strings.
 * Wraps a native <input type="time"> styled to match shadcn surfaces.
 */
export function TimePicker({
  value,
  onChange,
  disabled = false,
  className,
  name,
  id,
  placeholder = "HH:MM",
}: TimePickerProps) {
  const normalised = normaliseTime(value);
  const inputId = id ?? name;

  return (
    <div
      className={cn(
        "flex h-9 items-center gap-2 rounded-md border border-white/6 bg-transparent px-3 text-sm",
        disabled && "opacity-50",
        className,
      )}
    >
      <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <input
        type="time"
        id={inputId}
        name={name}
        value={normalised ?? ""}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next ? next : null);
        }}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full bg-transparent text-foreground outline-none"
      />
    </div>
  );
}

function normaliseTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

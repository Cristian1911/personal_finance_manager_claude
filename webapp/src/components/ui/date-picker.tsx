"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { es } from "react-day-picker/locale";

import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/date";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Extra classes for the popover content — e.g. `Z_DIALOG_ABOVE_SHEET`
   *  when the picker is opened from inside a Sheet (z-[10000]). */
  contentClassName?: string;
  /** HTML name attribute for form submission */
  name?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  disabled = false,
  className,
  contentClassName,
  name,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Parse ISO date string to Date object
  const selected = value ? new Date(value + "T12:00:00") : undefined;

  function handleSelect(date: Date | undefined) {
    if (date) {
      // Convert to ISO date string (YYYY-MM-DD)
      const iso =
        date.getFullYear() +
        "-" +
        String(date.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(date.getDate()).padStart(2, "0");
      onChange(iso);
    } else {
      onChange(null);
    }
    setOpen(false);
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-9 justify-start text-left font-normal border-white/6 bg-transparent hover:bg-white/5",
              !value && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
            {value ? (
              formatDate(value, "dd MMM yyyy")
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className={cn("w-auto p-0", contentClassName)} align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            locale={es}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}

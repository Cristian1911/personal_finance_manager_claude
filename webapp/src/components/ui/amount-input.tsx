"use client";

import { cn } from "@/lib/utils";
import { CurrencyInput } from "./currency-input";

interface AmountInputProps {
  name?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  currency?: string;
  autoFocus?: boolean;
  className?: string;
}

export function AmountInput({
  name,
  value,
  defaultValue,
  onChange,
  currency = "COP",
  autoFocus,
  className,
}: AmountInputProps) {
  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <span className="text-sm text-muted-foreground">{currency}</span>
      <CurrencyInput
        name={name}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        autoFocus={autoFocus}
        placeholder="0"
        className={cn(
          "border-none bg-transparent text-center shadow-none",
          "text-[32px] font-extrabold tracking-tight",
          "h-auto py-2",
          "focus-visible:ring-0 focus-visible:border-none",
          "placeholder:text-muted-foreground/30",
        )}
      />
    </div>
  );
}

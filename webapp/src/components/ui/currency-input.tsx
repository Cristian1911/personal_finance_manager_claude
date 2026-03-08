"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Format a numeric value with thousand separators (es-CO style: 500.000)
function formatDisplay(value: string | number): string {
  const num = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(num)) return "";
  const decimals = num % 1 === 0 ? 0 : 2;
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

// Strip formatting to get raw numeric string (e.g., "1.500.000" → "1500000")
function stripFormatting(display: string): string {
  return display.replace(/\./g, "").replace(",", ".");
}

// Safely evaluate a simple math expression (+ - * / only, no eval)
function safeEvaluate(expr: string): number | null {
  // Normalize: strip spaces, replace comma decimal with dot
  const normalized = expr.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");

  // Must match: number (op number)+ pattern — reject anything else
  if (!/^-?\d+(\.\d+)?([+\-*/]-?\d+(\.\d+)?)+$/.test(normalized)) {
    return null;
  }

  // Tokenize into numbers and operators
  const tokens = normalized.match(/-?\d+(\.\d+)?|[+\-*/]/g);
  if (!tokens) return null;

  // Evaluate with standard precedence: * / first, then + -
  const values: number[] = [];
  const ops: string[] = [];

  function applyOp() {
    const b = values.pop()!;
    const a = values.pop()!;
    const op = ops.pop()!;
    switch (op) {
      case "+": values.push(a + b); break;
      case "-": values.push(a - b); break;
      case "*": values.push(a * b); break;
      case "/": values.push(b !== 0 ? a / b : NaN); break;
    }
  }

  const precedence: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

  for (const token of tokens) {
    if (/^-?\d/.test(token)) {
      values.push(parseFloat(token));
    } else {
      while (ops.length > 0 && precedence[ops[ops.length - 1]] >= precedence[token]) {
        applyOp();
      }
      ops.push(token);
    }
  }

  while (ops.length > 0) applyOp();

  const result = values[0];
  return result != null && isFinite(result) ? result : null;
}

// Check if a string contains math operators (is an expression)
function isExpression(value: string): boolean {
  // Has at least one operator between numbers
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  return /\d[+\-*/]\d/.test(normalized);
}

type CurrencyInputProps = Omit<
  React.ComponentProps<"input">,
  "type" | "onChange" | "value" | "defaultValue"
> & {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

function CurrencyInput({
  className,
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  onBlur,
  ...props
}: CurrencyInputProps) {
  const isControlled = controlledValue !== undefined;
  const [display, setDisplay] = React.useState(() => {
    const initial = isControlled ? controlledValue : (defaultValue ?? "");
    return initial === "" || initial === undefined
      ? ""
      : formatDisplay(initial);
  });
  const [isEditing, setIsEditing] = React.useState(false);

  // Sync display when controlled value changes externally
  React.useEffect(() => {
    if (!isControlled || isEditing) return;
    const raw = stripFormatting(display);
    const controlledStr = String(controlledValue);
    if (raw !== controlledStr && String(controlledValue) !== "") {
      setDisplay(formatDisplay(controlledValue));
    } else if (controlledValue === "" || controlledValue === 0) {
      if (controlledValue === "" && display !== "") setDisplay("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledValue, isControlled]);

  const hiddenRef = React.useRef<HTMLInputElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target.value;
    setIsEditing(true);

    if (input === "") {
      setDisplay("");
      fireOnChange("", e);
      return;
    }

    // If it looks like a math expression, show it raw (don't format yet)
    if (isExpression(input)) {
      setDisplay(input);
      // Don't fire onChange with the expression — wait for blur to evaluate
      return;
    }

    // Normal numeric input
    const cleaned = input.replace(/[^\d.,-]/g, "");
    const rawValue = stripFormatting(cleaned);

    if (rawValue !== "" && rawValue !== "-" && isNaN(parseFloat(rawValue))) {
      return;
    }

    if (cleaned.endsWith(",")) {
      setDisplay(formatDisplay(rawValue) + ",");
    } else {
      setDisplay(rawValue === "" || rawValue === "-" ? cleaned : formatDisplay(rawValue));
    }

    fireOnChange(rawValue, e);
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    setIsEditing(false);

    // If current display is an expression, evaluate it
    if (isExpression(display)) {
      const result = safeEvaluate(display);
      if (result !== null) {
        const formatted = formatDisplay(result);
        setDisplay(formatted);
        fireOnChange(String(result), e as unknown as React.ChangeEvent<HTMLInputElement>);
      }
      // If evaluation fails, keep the text as-is so the user can fix it
    }

    onBlur?.(e);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Allow typing math operators
    if (["+", "-", "*", "/"].includes(e.key)) {
      // Allow the key through (don't prevent default)
      return;
    }
  }

  function fireOnChange(rawValue: string, originalEvent: React.ChangeEvent<HTMLInputElement>) {
    if (!onChange) return;
    const syntheticEvent = {
      ...originalEvent,
      target: {
        ...originalEvent.target,
        value: rawValue,
        name: name ?? originalEvent.target.name,
      },
    } as React.ChangeEvent<HTMLInputElement>;
    onChange(syntheticEvent);
  }

  const rawValue = isExpression(display) ? "" : stripFormatting(display);

  return (
    <>
      {name && (
        <input type="hidden" name={name} value={rawValue} ref={hiddenRef} />
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        data-slot="input"
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          className
        )}
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        {...props}
      />
    </>
  );
}

export { CurrencyInput, formatDisplay, stripFormatting };

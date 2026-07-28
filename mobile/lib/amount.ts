export function parseLocalizedAmount(input: string): number {
  const trimmed = input.trim().replace(/\s+/g, "");
  if (!trimmed) return Number.NaN;

  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    const normalized = trimmed
      .split(thousandsSeparator).join("")
      .replace(decimalSeparator, ".");
    return Number(normalized);
  }

  if (lastComma >= 0) {
    const normalized =
      trimmed.includes(",") && trimmed.split(",").length > 2
        ? trimmed.split(",").join("")
        : trimmed.replace(",", ".");
    return Number(normalized);
  }

  if (lastDot >= 0) {
    const normalized =
      trimmed.includes(".") && trimmed.split(".").length > 2
        ? trimmed.split(".").join("")
        : trimmed;
    return Number(normalized);
  }

  return Number(trimmed);
}

/**
 * A tail is a decimal fraction when it has 0-2 digits and no separators —
 * the user typed `,` or `,xx` rather than a thousand group.
 */
function isDecimalTail(tail: string): boolean {
  return tail.length <= 2 && !/[.,]/.test(tail);
}

/**
 * Format a partial amount string for live display in an input:
 *   "5000"      -> "5.000"
 *   "1234567"   -> "1.234.567"
 *   "1234,5"    -> "1.234,5"
 *   "5.000"     -> "5.000"  (dots already placed)
 *   "5.00"      -> "500"    (backspacing from "5.000" — dot treated as thousands)
 * Rule: `.` is always a thousand separator; `,` is the decimal marker.
 * This matches Colombian COP convention and keeps backspace intuitive.
 */
export function formatAmountInput(input: string): string {
  const sanitized = (input ?? "").replace(/[^\d.,]/g, "");
  if (!sanitized) return "";

  const lastComma = sanitized.lastIndexOf(",");
  let integerSource = sanitized;
  let decimalPart: string | null = null;

  if (lastComma !== -1) {
    const tail = sanitized.slice(lastComma + 1);
    if (isDecimalTail(tail)) {
      integerSource = sanitized.slice(0, lastComma);
      decimalPart = tail;
    }
  }

  const digits = integerSource.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (digits === "" && decimalPart === null) return "";
  const integerDigits = digits === "" ? "0" : digits;
  const grouped = integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimalPart === null ? grouped : `${grouped},${decimalPart}`;
}

/**
 * `formatAmountInput` for fields that accept a negative value (account
 * balances). It drops the sign, which would silently flip a debt balance to
 * positive as soon as the user edits the field.
 */
export function formatSignedAmountInput(input: string): string {
  const negative = (input ?? "").trim().startsWith("-");
  const formatted = formatAmountInput(input);
  if (!formatted) return negative ? "-" : "";
  return negative ? `-${formatted}` : formatted;
}

/**
 * Parse a formatted amount input (as produced by `formatAmountInput`) to a
 * number. Dots are treated as thousand separators, comma as the decimal mark.
 */
export function parseFormattedAmount(formatted: string): number {
  const sanitized = (formatted ?? "").replace(/[^\d.,]/g, "");
  if (!sanitized) return Number.NaN;

  const lastComma = sanitized.lastIndexOf(",");
  if (lastComma === -1) {
    return Number(sanitized.replace(/\./g, ""));
  }
  const tail = sanitized.slice(lastComma + 1);
  if (isDecimalTail(tail)) {
    const integer = sanitized.slice(0, lastComma).replace(/[.,]/g, "");
    return Number(`${integer || "0"}.${tail || "0"}`);
  }
  return Number(sanitized.replace(/[.,]/g, ""));
}

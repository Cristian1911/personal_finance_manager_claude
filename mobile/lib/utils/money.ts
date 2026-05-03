import { formatCurrency, type CurrencyCode } from "@zeta/shared";

const SYMBOL_BY_CURRENCY: Record<CurrencyCode, string> = {
  COP: "$",
  BRL: "R$",
  MXN: "$",
  USD: "$",
  EUR: "€",
  PEN: "S/",
  CLP: "$",
  ARS: "$",
};

/**
 * Sanitize a user-entered money string into a number.
 * Strips non-numeric characters, accepts `.` / `-` in any position.
 * Returns 0 when the input is empty or not finite.
 */
export function parseMoney(raw: string): number {
  if (!raw) return 0;
  const n = Number(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Abbreviated currency for narrow chips. $3.76M, $178K, $500.
 * Mirrors webapp `formatCurrencyCompact` so chip widths stay predictable.
 */
export function formatCurrencyCompact(
  amount: number,
  currencyCode: CurrencyCode = "COP"
): string {
  const symbol = SYMBOL_BY_CURRENCY[currencyCode] ?? "$";
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (abs >= 1_000_000) {
    const val = abs / 1_000_000;
    const formatted =
      val >= 10
        ? val.toFixed(1).replace(/\.0$/, "")
        : val.toFixed(2).replace(/0$/, "").replace(/\.$/, "");
    return `${sign}${symbol} ${formatted}M`;
  }
  if (abs >= 1_000) {
    const val = abs / 1_000;
    const formatted =
      val >= 100 ? Math.round(val).toString() : val.toFixed(1).replace(/\.0$/, "");
    return `${sign}${symbol} ${formatted}K`;
  }
  return formatCurrency(amount, currencyCode);
}

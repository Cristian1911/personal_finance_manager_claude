import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

/**
 * Compact currency formatter for projection/summary stats.
 * COP: `$1.420.800` → `"$ 1.42m"`, `$492.000` → `"$ 492k"`, `$340` → `"$ 340"`.
 * Other currencies fall back to `formatCurrency`.
 */
export function compactAmount(value: number, currency: CurrencyCode): string {
  if (currency !== "COP") return formatCurrency(value, currency);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}$ ${m.toFixed(m < 10 ? 2 : 1)}m`;
  }
  if (abs >= 1_000) return `${sign}$ ${Math.round(abs / 1_000)}k`;
  return `${sign}$ ${Math.round(abs)}`;
}

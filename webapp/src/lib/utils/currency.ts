import type { CurrencyCode } from "@/types/domain";

const CURRENCY_CONFIG: Record<
  CurrencyCode,
  { symbol: string; locale: string; decimals: number }
> = {
  COP: { symbol: "$", locale: "es-CO", decimals: 0 },
  BRL: { symbol: "R$", locale: "pt-BR", decimals: 2 },
  MXN: { symbol: "$", locale: "es-MX", decimals: 2 },
  USD: { symbol: "$", locale: "en-US", decimals: 2 },
  EUR: { symbol: "\u20AC", locale: "de-DE", decimals: 2 },
  PEN: { symbol: "S/", locale: "es-PE", decimals: 2 },
  CLP: { symbol: "$", locale: "es-CL", decimals: 0 },
  ARS: { symbol: "$", locale: "es-AR", decimals: 2 },
};

export function formatCurrency(
  amount: number,
  currencyCode: CurrencyCode = "COP"
): string {
  const config = CURRENCY_CONFIG[currencyCode];
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(amount);
}

/**
 * Abbreviated currency format: $3.76M, $178K, $500.
 * Uses K for thousands, M for millions. Keeps 1-2 significant digits after abbreviation.
 */
export function formatCurrencyCompact(
  amount: number,
  currencyCode: CurrencyCode = "COP"
): string {
  const config = CURRENCY_CONFIG[currencyCode];
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (abs >= 1_000_000) {
    const val = abs / 1_000_000;
    const formatted = val >= 10 ? val.toFixed(1).replace(/\.0$/, "") : val.toFixed(2).replace(/0$/, "").replace(/\.$/, "");
    return `${sign}${config.symbol} ${formatted}M`;
  }
  if (abs >= 1_000) {
    const val = abs / 1_000;
    const formatted = val >= 100 ? Math.round(val).toString() : val.toFixed(1).replace(/\.0$/, "");
    return `${sign}${config.symbol} ${formatted}K`;
  }
  return formatCurrency(amount, currencyCode);
}

export function getCurrencySymbol(currencyCode: CurrencyCode): string {
  return CURRENCY_CONFIG[currencyCode].symbol;
}

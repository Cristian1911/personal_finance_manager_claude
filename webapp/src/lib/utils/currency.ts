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

export function getCurrencySymbol(currencyCode: CurrencyCode): string {
  return CURRENCY_CONFIG[currencyCode].symbol;
}

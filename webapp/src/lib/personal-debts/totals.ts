import type { PersonalDebtCurrencyTotal } from "@/actions/personal-debts";

/**
 * Per-currency helpers for the personas summary. A plain module (not the
 * "use server" action file, whose exports must all be async) so Server
 * Components and Client Components can both use them.
 *
 * Personal debts are never converted between currencies — the app's rule
 * (see modo-summary.ts) is "nunca restar montos de monedas distintas".
 */

/** Total owed in one currency; 0 when that currency has no debts. */
export function totalForCurrency(
  totals: PersonalDebtCurrencyTotal[],
  currencyCode: string,
): number {
  return totals.find((t) => t.currency_code === currencyCode)?.total ?? 0;
}

/**
 * Every currency appearing on either side, primary first, then alphabetical —
 * the display order for the Debo / Me deben / Neto summary.
 */
export function summaryCurrencies(
  iOwe: PersonalDebtCurrencyTotal[],
  owedToMe: PersonalDebtCurrencyTotal[],
  primaryCurrency: string,
): string[] {
  const codes = new Set<string>([
    ...iOwe.map((t) => t.currency_code),
    ...owedToMe.map((t) => t.currency_code),
  ]);
  // The primary currency always leads, even with no debts in it, so the
  // summary never renders empty just because everything is in USD.
  codes.delete(primaryCurrency);
  return [primaryCurrency, ...[...codes].sort()];
}

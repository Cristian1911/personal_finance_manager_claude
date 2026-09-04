import type { ParsedEmailTransaction } from "@/lib/parsers/bancolombia-email";
import type { Database } from "@/types/database";

type CurrencyCode = Database["public"]["Enums"]["currency_code"];

/**
 * Currency to store on a transaction created from a Bancolombia alert.
 *
 * The account's currency wins for peso alerts ("$"/"COP"), which is what every
 * email path did before foreign-currency purchases were parsed. When the alert
 * names another currency ("Compraste USD1,00 …") the movement keeps it: the
 * PDF import already stores USD statement sections as USD transactions on a
 * COP card, and storing USD1,00 as COP $1 would be a wrong amount, not a
 * conversion.
 */
export function resolveEmailTransactionCurrency(
  parsed: Pick<ParsedEmailTransaction, "currency">,
  accountCurrency: CurrencyCode | null | undefined
): CurrencyCode {
  if (parsed.currency && parsed.currency !== "COP") return parsed.currency;
  return accountCurrency ?? parsed.currency ?? "COP";
}

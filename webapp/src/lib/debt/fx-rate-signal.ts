import "server-only";
import { getExchangeRateTrend } from "@/actions/exchange-rate";
import { largestForeignDebt } from "@/lib/debt/usd-debt-insights";
import type { Account, CurrencyCode } from "@/types/domain";

export interface FxRateSignal {
  from: CurrencyCode;
  to: CurrencyCode;
  rate: number;
  avg30d: number | null;
  percentVsAvg: number | null;
  /** Outstanding debt in `from` across cards/loans. */
  foreignDebt: number;
}

/**
 * Today's rate for the foreign currency the user owes the most in (usually
 * the USD side of a dual-currency card), against its 30-day average — the
 * "¿pago hoy los dólares?" signal. Null when there's no foreign-currency debt
 * or the rate can't be resolved. Reads only cached accounts + the daily
 * cached rate, so it adds no uncached query to the dashboard.
 */
export async function getForeignDebtFxSignal(
  accounts: Account[],
  baseCurrency: CurrencyCode,
): Promise<FxRateSignal | null> {
  const largest = largestForeignDebt(accounts, baseCurrency);
  if (!largest) return null;
  const [from, foreignDebt] = largest;
  const result = await getExchangeRateTrend(from, baseCurrency).catch(() => null);
  if (!result || !(result.rate > 0)) return null;

  return {
    from,
    to: baseCurrency,
    rate: result.rate,
    avg30d: result.avg30d,
    percentVsAvg: result.percentVsAvg,
    foreignDebt,
  };
}

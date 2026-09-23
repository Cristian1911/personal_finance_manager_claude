import "server-only";
import { getExchangeRate } from "@/actions/exchange-rate";
import { isDebtAccountType } from "@/lib/utils/account-balance";
import { getTrackedCurrencyBalances } from "@/lib/utils/currency-balances";
import type { Account, CurrencyCode } from "@/types/domain";

/** ±% vs the 30-day average that counts as a "cheap" / "expensive" day. */
export const FX_RATE_SIGNAL_THRESHOLD_PCT = 2;

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
  const debtByCurrency = new Map<CurrencyCode, number>();
  for (const account of accounts) {
    if (!isDebtAccountType(account.account_type)) continue;
    const balances = getTrackedCurrencyBalances({
      currencyCode: account.currency_code,
      currentBalance: account.current_balance ?? 0,
      currencyBalances: account.currency_balances,
    });
    for (const { currency, currentBalance } of balances) {
      if (currency === baseCurrency || currentBalance <= 0) continue;
      debtByCurrency.set(currency, (debtByCurrency.get(currency) ?? 0) + currentBalance);
    }
  }
  if (debtByCurrency.size === 0) return null;

  const [from, foreignDebt] = [...debtByCurrency.entries()].reduce((best, entry) =>
    entry[1] > best[1] ? entry : best,
  );
  const result = await getExchangeRate(from, baseCurrency).catch(() => null);
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

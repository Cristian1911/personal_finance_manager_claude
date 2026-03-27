import type { Json } from "@/types/database";
import type { CurrencyCode } from "@/types/domain";

export interface CurrencyBalanceEntry {
  current_balance: number | null;
  credit_limit: number | null;
  available_balance: number | null;
  interest_rate: number | null;
  minimum_payment: number | null;
  total_payment_due: number | null;
}

export type CurrencyBalanceMap = Record<string, CurrencyBalanceEntry>;

export interface TrackedCurrencyBalance {
  currency: CurrencyCode;
  currentBalance: number;
  entry: CurrencyBalanceEntry;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseCurrencyBalanceMap(raw: Json | null): CurrencyBalanceMap {
  if (!isRecord(raw)) return {};

  const result: CurrencyBalanceMap = {};

  for (const [currency, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue;

    result[currency] = {
      current_balance: asNullableNumber(value.current_balance),
      credit_limit: asNullableNumber(value.credit_limit),
      available_balance: asNullableNumber(value.available_balance),
      interest_rate: asNullableNumber(value.interest_rate),
      minimum_payment: asNullableNumber(value.minimum_payment),
      total_payment_due: asNullableNumber(value.total_payment_due),
    };
  }

  return result;
}

export function resolveCurrencyBalanceCurrentValue(entry: CurrencyBalanceEntry): number {
  if (entry.total_payment_due != null) return entry.total_payment_due;

  if (entry.credit_limit != null && entry.available_balance != null) {
    return Math.max(entry.credit_limit - entry.available_balance, 0);
  }

  return entry.current_balance ?? 0;
}

export function getTrackedCurrencyBalances(params: {
  currencyCode: string;
  currentBalance: number;
  currencyBalances: Json | null | undefined;
}): TrackedCurrencyBalance[] {
  const balances = parseCurrencyBalanceMap(params.currencyBalances ?? null);
  const primaryCurrency = params.currencyCode;
  const primaryEntry = balances[primaryCurrency] ?? {
    current_balance: params.currentBalance,
    credit_limit: null,
    available_balance: null,
    interest_rate: null,
    minimum_payment: null,
    total_payment_due: null,
  };

  balances[primaryCurrency] = {
    ...primaryEntry,
    current_balance: params.currentBalance,
  };

  return Object.entries(balances)
    .filter(([, entry]) => {
      return (
        entry.current_balance != null ||
        entry.total_payment_due != null ||
        entry.credit_limit != null ||
        entry.available_balance != null
      );
    })
    .sort(([currencyA], [currencyB]) => {
      if (currencyA === primaryCurrency) return -1;
      if (currencyB === primaryCurrency) return 1;
      return currencyA.localeCompare(currencyB);
    })
    .map(([currency, entry]) => ({
      currency: currency as CurrencyCode,
      currentBalance:
        currency === primaryCurrency
          ? params.currentBalance
          : resolveCurrencyBalanceCurrentValue(entry),
      entry,
    }));
}

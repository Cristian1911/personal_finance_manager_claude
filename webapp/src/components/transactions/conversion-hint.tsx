"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { currencyForTimeZone } from "@zeta/shared";
import { getConversionRates } from "@/actions/exchange-rate";
import { useDeviceTimeZone } from "@/hooks/use-device-timezone";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/domain";

interface ConversionHintProps {
  amount: number | null | undefined;
  /** Currency the amount is denominated in (the account's currency). */
  currency: CurrencyCode;
  /** The user's profile currency — the first conversion target. */
  baseCurrency: CurrencyCode;
  className?: string;
}

// Rates are global (not per user) and change once a day, so one fetch per
// source currency per page is plenty — keyed by "USD→COP,ARS".
const rateCache = new Map<string, Partial<Record<CurrencyCode, number>>>();

/**
 * "≈ $ 412.000 COP · ≈ $ 98.000 ARS" under a foreign-currency amount.
 *
 * Targets: the profile currency, plus the currency of wherever the phone is
 * right now (from its timezone) when that differs — a purchase in dollars
 * while in Argentina shows both what it costs at home and what it costs
 * locally. Renders nothing when the amount is already in every target.
 */
export function ConversionHint({ amount, currency, baseCurrency, className }: ConversionHintProps) {
  const deviceTimeZone = useDeviceTimeZone();
  const targets = useMemo(() => {
    const local = currencyForTimeZone(deviceTimeZone);
    const list: CurrencyCode[] = [];
    if (baseCurrency !== currency) list.push(baseCurrency);
    if (local && local !== currency && local !== baseCurrency) list.push(local);
    return list;
  }, [baseCurrency, currency, deviceTimeZone]);

  const cacheKey = `${currency}→${targets.join(",")}`;
  const [rates, setRates] = useState<Partial<Record<CurrencyCode, number>> | null>(
    () => rateCache.get(cacheKey) ?? null,
  );

  useEffect(() => {
    if (targets.length === 0) return;
    const cached = rateCache.get(cacheKey);
    if (cached) {
      // Cache hit from a previous mount — external store, so sync after mount.
      setRates(cached);
      return;
    }
    let cancelled = false;
    getConversionRates(currency, targets)
      .then((result) => {
        rateCache.set(cacheKey, result);
        if (!cancelled) setRates(result);
      })
      .catch(() => {
        // Offline or the rate source is down: no hint is better than a wrong one.
      });
    return () => {
      cancelled = true;
    };
    // `targets` is derived from cacheKey; listing both would refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, currency]);

  if (targets.length === 0 || !amount || !Number.isFinite(amount) || amount <= 0 || !rates) return null;

  const parts = targets
    .map((target) => {
      const rate = rates[target];
      if (!rate) return null;
      return `≈ ${formatCurrency(amount * rate, target)} ${target}`;
    })
    .filter((p): p is string => p !== null);
  if (parts.length === 0) return null;

  return (
    <p
      className={cn(
        "inline-flex flex-wrap items-center justify-center gap-x-1.5 text-[11px] leading-4 text-muted-foreground",
        className,
      )}
      title="Tasa de cambio de hoy, solo referencia"
    >
      <ArrowLeftRight className="size-3 shrink-0 text-z-brass" aria-hidden />
      {parts.map((part, i) => (
        <span key={targets[i]} className="tabular-nums">
          {i > 0 && <span className="mr-1.5 text-z-white/15">·</span>}
          {part}
        </span>
      ))}
    </p>
  );
}

"use client";

import { useEffect, useState } from "react";
import { getDailySpending } from "@/actions/charts";
import { toISODateString } from "@/lib/utils/date";
import { subDays } from "date-fns";
import type { CurrencyCode } from "@/types/domain";

export interface LiveDailyMetrics {
  spentToday: number;
  spentYesterday: number;
  avgLast7: number;
}

/**
 * Client-side hook that fetches fresh daily spending metrics on mount.
 * The server-rendered values display instantly (from Route Cache),
 * then this hook silently corrects them if stale.
 */
export function useLiveDailyMetrics(
  serverValues: LiveDailyMetrics,
  currency: CurrencyCode,
): LiveDailyMetrics {
  const [metrics, setMetrics] = useState(serverValues);

  useEffect(() => {
    let cancelled = false;

    getDailySpending(undefined, currency).then((data) => {
      if (cancelled) return;

      const now = new Date();
      const todayStr = toISODateString(now);
      const yesterdayStr = toISODateString(subDays(now, 1));
      const sevenDaysAgo = toISODateString(subDays(now, 7));

      const spentToday = data.find((d) => d.date === todayStr)?.amount ?? 0;
      const spentYesterday = data.find((d) => d.date === yesterdayStr)?.amount ?? 0;

      const last7Days = data.filter(
        (d) => d.date < todayStr && d.date >= sevenDaysAgo
      );
      const avgLast7 =
        last7Days.length > 0
          ? last7Days.reduce((sum, d) => sum + d.amount, 0) / last7Days.length
          : 0;

      setMetrics({ spentToday, spentYesterday, avgLast7 });
    });

    return () => { cancelled = true; };
  }, [currency]);

  return metrics;
}

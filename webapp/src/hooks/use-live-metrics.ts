"use client";

import { useEffect, useState } from "react";
import { getLiveDashboardData, type LiveDashboardData } from "@/actions/live-dashboard";
import type { CurrencyCode } from "@/types/domain";

/**
 * Client-side hook that fetches fresh volatile dashboard data on mount.
 * The server-rendered values display instantly (from Route Cache),
 * then this hook silently corrects them if stale.
 *
 * One server round-trip for hero + metrics + attention.
 */
export function useLiveDashboard(
  serverValues: LiveDashboardData,
  currency: CurrencyCode,
): LiveDashboardData {
  const [data, setData] = useState(serverValues);

  useEffect(() => {
    let cancelled = false;

    getLiveDashboardData(currency).then((fresh) => {
      if (!cancelled) setData(fresh);
    });

    return () => { cancelled = true; };
  }, [currency]);

  return data;
}

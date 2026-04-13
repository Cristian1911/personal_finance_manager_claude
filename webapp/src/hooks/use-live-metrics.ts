"use client";

import { useEffect, useState } from "react";
import { getLiveDashboardData, type LiveDashboardData } from "@/actions/live-dashboard";
import type { CurrencyCode } from "@/types/domain";

/**
 * Fingerprint volatile fields so we can detect RSC prop updates.
 * When a server action fires inside startTransition, Next.js re-renders
 * the route's Server Components with fresh data. This fingerprint lets us
 * detect that fresh props arrived and clear the stale mount-time override.
 */
function fingerprint(d: LiveDashboardData): string {
  const emailIds = d.attention.pendingEmails.map(e => e.id).sort().join(",");
  const reminderIds = d.attention.overdueReminders.map(r => r.id).sort().join(",");
  const paymentIds = d.attention.upcomingPayments.map(p => p.templateId + p.occurrenceDate).sort().join(",");
  return `${emailIds}:${reminderIds}:${paymentIds}:${d.hero.availableTotal}:${d.metrics.spentToday}`;
}

/**
 * Client-side hook that fetches fresh volatile dashboard data on mount.
 * The server-rendered values display instantly (from Route Cache),
 * then this hook silently corrects them if stale.
 *
 * When a mutation triggers an RSC re-render (via startTransition), the
 * hook detects updated serverValues and clears its stale live override.
 *
 * One server round-trip for hero + metrics + attention.
 */
export function useLiveDashboard(
  serverValues: LiveDashboardData,
  currency: CurrencyCode,
): LiveDashboardData {
  const [liveOverride, setLiveOverride] = useState<LiveDashboardData | null>(null);

  // Detect when server delivers fresh props after a mutation
  const fp = fingerprint(serverValues);
  const [prevFp, setPrevFp] = useState(fp);

  // Standard React "adjust state during rendering" pattern:
  // when serverValues change (new RSC payload arrived after startTransition),
  // clear the stale mount-time override so fresh server data wins.
  if (fp !== prevFp) {
    setPrevFp(fp);
    setLiveOverride(null);
  }

  // One-shot mount correction: fetch fresh data to fix Route Cache staleness
  useEffect(() => {
    let cancelled = false;
    getLiveDashboardData(currency).then((fresh) => {
      if (!cancelled) setLiveOverride(fresh);
    });
    return () => { cancelled = true; };
  }, [currency]);

  return liveOverride ?? serverValues;
}

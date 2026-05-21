"use server";

import { cacheTag, cacheLife } from "next/cache";
import { computeRitmo, type RitmoResult } from "@zeta/shared";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { getIsDemoFilter, getDemoAccountIds } from "@/lib/demo-filter";
import {
  parseMonth,
  monthStartStr,
  monthEndStr,
  toColombiaDateString,
} from "@/lib/utils/date";
import { getDashboardHeroData } from "@/actions/charts";
import type { CurrencyCode } from "@/types/domain";

/**
 * Canonical "ritmo" data for the dashboard hero. Wraps `getDashboardHeroData`
 * (for liquid balance + pending obligations + next-income date) and adds the
 * per-day OUTFLOW timeline needed for the V7 hero's progress bar + calendar
 * heatmap. Calls `computeRitmo` from @zeta/shared so mobile and webapp
 * produce identical numbers by construction.
 */

async function getDailyOutflowsCached(
  userId: string,
  accessToken: string,
  dateFrom: string,
  dateTo: string,
): Promise<{ date: string; expense: number }[]> {
  "use cache";
  cacheTag("transactions");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const isDemo = await getIsDemoFilter(userId);
  const demoAccountIds = await getDemoAccountIds(supabase, userId, isDemo);
  if (!demoAccountIds) return [];

  const { data, error } = await supabase
    .from("transactions")
    .select("transaction_date, amount")
    .eq("user_id", userId)
    .in("account_id", demoAccountIds)
    .eq("direction", "OUTFLOW")
    .eq("is_excluded", false)
    .is("reconciled_into_transaction_id", null)
    .gte("transaction_date", dateFrom)
    .lte("transaction_date", dateTo);

  if (error) throw error;

  const byDate = new Map<string, number>();
  for (const row of data ?? []) {
    const key = row.transaction_date as string;
    byDate.set(key, (byDate.get(key) ?? 0) + (row.amount as number));
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, expense]) => ({ date, expense }));
}

export interface RitmoData extends RitmoResult {
  currency: CurrencyCode;
  /** End-of-month label like "31 may", for the period-bar legend. */
  windowEndLabel: string;
  /** Total liquid balance carried over so the UI can show "balance disponible". */
  liquidBalance: number;
  /** Sum of pending obligation amounts in the window, for the secondary panel. */
  pendingObligationsTotal: number;
}

export async function getRitmo(
  month?: string,
  currency?: CurrencyCode,
): Promise<{ success: true; data: RitmoData } | { success: false; error: string }> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  try {
    const target = parseMonth(month);
    const dateFrom = monthStartStr(target);
    const dateTo = monthEndStr(target);
    const today = toColombiaDateString(new Date());
    const usedCurrency = (currency ?? "COP") as CurrencyCode;

    const [heroData, dailyOutflows] = await Promise.all([
      getDashboardHeroData(month, usedCurrency),
      getDailyOutflowsCached(user.id, accessToken, dateFrom, dateTo),
    ]);

    const ritmo = computeRitmo({
      today,
      endOfMonth: dateTo,
      liquidBalance: heroData.totalLiquid,
      nextIncomeDate: heroData.nextIncomeDate,
      nextIncomeAmount: heroData.nextIncomeAmount,
      pendingObligations: heroData.windowObligations,
      dailyOutflows,
    });

    // "31 may" — short label for the period-bar legend.
    const windowEnd = new Date(`${ritmo.windowEndDate}T12:00:00`);
    const windowEndLabel = windowEnd.toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
    });

    return {
      success: true,
      data: {
        ...ritmo,
        currency: usedCurrency,
        windowEndLabel,
        liquidBalance: heroData.totalLiquid,
        pendingObligationsTotal: heroData.windowObligations,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al cargar el ritmo";
    return { success: false, error: message };
  }
}

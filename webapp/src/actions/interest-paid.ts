"use server";

import { cache } from "react";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { formatMonthParam } from "@/lib/utils/date";
import type { CurrencyCode } from "@/types/domain";

export interface InterestPaidData {
  currentMonth: number;
  previousMonth: number;
  ytd: number;
  trend: number; // currentMonth - previousMonth (negative = improving)
  currency: CurrencyCode;
}

export const getInterestPaid = cache(
  async (month?: string, currency?: CurrencyCode): Promise<InterestPaidData | null> => {
    const { supabase, user } = await getAuthenticatedClient();
    if (!user) return null;

    // Determine the target month (default to current)
    const now = new Date();
    let targetMonth: string;
    if (month) {
      targetMonth = month.substring(0, 7); // normalize to YYYY-MM
    } else {
      targetMonth = formatMonthParam(now);
    }

    // Compute previous month
    const [targetYear, targetMonthNum] = targetMonth.split("-").map(Number);
    const prevDate = new Date(targetYear, targetMonthNum - 2, 1); // month - 2 because months are 0-indexed
    const previousMonth = formatMonthParam(prevDate);

    // Current year prefix for YTD
    const currentYear = targetMonth.substring(0, 4);

    // Fetch all interest_charged records for the current year (covers current, previous, and YTD)
    const { data: snapshots, error } = await supabase
      .from("statement_snapshots")
      .select("interest_charged, period_to")
      .eq("user_id", user.id)
      .not("interest_charged", "is", null)
      .gte("period_to", `${currentYear}-01-01`)
      .lte("period_to", `${targetMonth}-31`);

    if (error) throw error;

    if (!snapshots || snapshots.length === 0) {
      return {
        currentMonth: 0,
        previousMonth: 0,
        ytd: 0,
        trend: 0,
        currency: currency ?? "COP",
      };
    }

    // Group by YYYY-MM and sum interest_charged
    const monthlyTotals = new Map<string, number>();

    for (const snap of snapshots) {
      if (!snap.period_to || snap.interest_charged == null) continue;
      const monthKey = snap.period_to.substring(0, 7); // YYYY-MM
      monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) ?? 0) + snap.interest_charged);
    }

    const currentMonthTotal = monthlyTotals.get(targetMonth) ?? 0;
    const previousMonthTotal = monthlyTotals.get(previousMonth) ?? 0;

    // YTD = sum all months in the current year up to (and including) targetMonth
    let ytdTotal = 0;
    for (const [key, value] of monthlyTotals.entries()) {
      if (key.startsWith(currentYear) && key <= targetMonth) {
        ytdTotal += value;
      }
    }

    return {
      currentMonth: currentMonthTotal,
      previousMonth: previousMonthTotal,
      ytd: ytdTotal,
      trend: currentMonthTotal - previousMonthTotal,
      currency: currency ?? "COP",
    };
  }
);

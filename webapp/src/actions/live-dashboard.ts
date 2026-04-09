"use server";

import { getDashboardHeroData, getDailySpending } from "@/actions/charts";
import { getAttentionItems } from "@/actions/attention-items";
import { toISODateString } from "@/lib/utils/date";
import { subDays } from "date-fns";
import type { CurrencyCode } from "@/types/domain";
import type {
  AttentionOverdueReminder,
  AttentionUpcomingPayment,
  AttentionPendingEmail,
} from "@/actions/attention-items";

export interface LiveDashboardData {
  hero: {
    availablePerDay: number;
    availableTotal: number;
    daysRemaining: number;
    breakdown: {
      totalLiquid: number;
      fixedExpenses: number;
      alreadySpent: number;
    };
  };
  metrics: {
    spentToday: number;
    spentYesterday: number;
    avgLast7: number;
  };
  attention: {
    overdueReminders: AttentionOverdueReminder[];
    upcomingPayments: AttentionUpcomingPayment[];
    pendingEmails: AttentionPendingEmail[];
  };
}

/**
 * Single server action that returns all volatile mobile dashboard data.
 * Called client-side on mount to silently correct stale cached values.
 * One round-trip instead of 3 separate hooks.
 */
export async function getLiveDashboardData(
  currency: CurrencyCode,
): Promise<LiveDashboardData> {
  const [heroData, dailySpending, attentionItems] = await Promise.all([
    getDashboardHeroData(undefined, currency),
    getDailySpending(undefined, currency),
    getAttentionItems(),
  ]);

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(daysInMonth - now.getDate(), 1);

  const todayStr = toISODateString(now);
  const yesterdayStr = toISODateString(subDays(now, 1));
  const sevenDaysAgo = toISODateString(subDays(now, 7));

  const spentToday = dailySpending.find((d) => d.date === todayStr)?.amount ?? 0;
  const spentYesterday = dailySpending.find((d) => d.date === yesterdayStr)?.amount ?? 0;
  const last7Days = dailySpending.filter((d) => d.date < todayStr && d.date >= sevenDaysAgo);
  const avgLast7 = last7Days.length > 0
    ? last7Days.reduce((sum, d) => sum + d.amount, 0) / last7Days.length
    : 0;

  return {
    hero: {
      availablePerDay: heroData.availableToSpend / daysRemaining,
      availableTotal: heroData.availableToSpend,
      daysRemaining,
      breakdown: {
        totalLiquid: heroData.monthlyIncome,
        fixedExpenses: heroData.totalPending,
        alreadySpent: heroData.monthlySpent,
      },
    },
    metrics: {
      spentToday,
      spentYesterday,
      avgLast7,
    },
    attention: {
      overdueReminders: attentionItems.overdueReminders,
      upcomingPayments: attentionItems.upcomingPayments,
      pendingEmails: attentionItems.pendingEmails,
    },
  };
}

"use server";

import { getDashboardHeroData, getDailySpending } from "@/actions/charts";
import { getAttentionItems } from "@/actions/attention-items";
import { toColombiaDateString } from "@/lib/utils/date";
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
    nextIncomeDate: string | null;
    nextIncomeAmount: number;
    nextIncomeName: string | null;
    incomeConfigured: boolean;
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
    getDailySpending(undefined, currency, { liquidOnly: true }),
    getAttentionItems(),
  ]);

  const daysRemaining = heroData.daysUntilIncome;

  const now = new Date();
  const todayStr = toColombiaDateString(now);
  const yesterdayStr = toColombiaDateString(subDays(now, 1));
  const sevenDaysAgo = toColombiaDateString(subDays(now, 7));

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
      nextIncomeDate: heroData.nextIncomeDate,
      nextIncomeAmount: heroData.nextIncomeAmount,
      nextIncomeName: heroData.nextIncomeName,
      incomeConfigured: heroData.incomeConfigured,
      breakdown: {
        totalLiquid: heroData.totalLiquid,
        fixedExpenses: heroData.windowObligations,
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

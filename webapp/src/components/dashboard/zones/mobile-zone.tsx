import { getDashboardHeroData, getDailySpending } from "@/actions/charts";
import { getAttentionItems } from "@/actions/attention-items";
import { getBurnRate } from "@/actions/burn-rate";
import { getBudgetSummary } from "@/actions/budgets";
import { getAccounts } from "@/actions/accounts";
import { getLatestSnapshotDates } from "@/actions/statement-snapshots";
import type { RecentTransaction } from "@/actions/transactions";
import { InicioRoot } from "@/components/mobile/v2/inicio/inicio-root";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { toColombiaDateString } from "@/lib/utils/date";
import { subDays, differenceInDays } from "date-fns";
import type { CurrencyCode } from "@/types/domain";

interface MobileZoneProps {
  month: string | undefined;
  currency: CurrencyCode;
  recentTx: RecentTransaction[];
}

export async function MobileZone({ month, currency, recentTx }: MobileZoneProps) {
  const [heroData, attentionItemsData, burnRateData, budgetSummary, accountsResult, dailySpending, latestSnapshotDates] =
    await Promise.all([
      getDashboardHeroData(month, currency),
      getAttentionItems(),
      getBurnRate(currency),
      getBudgetSummary(month),
      getAccounts(),
      getDailySpending(month, currency),
      getLatestSnapshotDates(),
    ]);

  const allAccounts = accountsResult.success ? accountsResult.data : [];

  const starterMode = allAccounts.length > 0 && recentTx.length === 0;

  // Single date reference for the entire render
  const now = new Date();

  const daysSinceImport = (() => {
    const dates = Object.values(latestSnapshotDates);
    if (dates.length === 0) return 999;
    const latest = dates.reduce((a, b) => (a > b ? a : b));
    return differenceInDays(now, new Date(latest));
  })();

  // Map recent transactions to mobile format
  const mobileRecentTx = recentTx.map((tx) => ({
    id: tx.id,
    description: tx.merchant_name || tx.clean_description || "Sin descripción",
    amount: tx.amount,
    currency_code: (tx.currency_code ?? "COP") as CurrencyCode,
    direction: tx.direction,
    account_id: tx.account_id,
    account_name: tx.accounts?.name ?? "Sin cuenta",
    account_color: tx.accounts?.color ?? null,
    account_mask: tx.accounts?.mask ?? null,
    account_bank_key: tx.accounts?.bank_key ?? null,
    account_type: tx.accounts?.account_type ?? "OTHER",
    category_id: tx.category_id ?? null,
    category_name: tx.categories?.name_es ?? tx.categories?.name ?? null,
    category_icon: tx.categories?.icon ?? null,
    recurrence_group_id: tx.recurrence_group_id ?? null,
    tags: (tx.transaction_tags ?? []).map((tt) => ({
      id: tt.tag.id,
      name: tt.tag.name,
      color: tt.tag.color,
      group_color: tt.tag.group?.color ?? null,
    })),
  }));

  const todayStr = toColombiaDateString(now);
  const [yearStr, monthStr] = todayStr.split("-");
  const daysInMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate();
  const daysRemaining = heroData.daysUntilIncome;

  // Primary account lookup
  const primaryAccount = (() => {
    const primary =
      allAccounts.find(
        (a) =>
          (a.account_type === "SAVINGS" || a.account_type === "CHECKING") &&
          a.show_in_dashboard
      ) ??
      allAccounts.find(
        (a) => a.account_type === "SAVINGS" || a.account_type === "CHECKING"
      );
    if (!primary) return undefined;
    return {
      id: primary.id,
      name: primary.name,
      currentBalance: primary.current_balance ?? 0,
      currencyCode: primary.currency_code as CurrencyCode,
    };
  })();

  // Today's and yesterday's spending from cached daily data (Colombia timezone)
  const spentToday = dailySpending.find((d) => d.date === todayStr)?.amount ?? 0;
  const yesterdayStr = toColombiaDateString(subDays(now, 1));
  const spentYesterday = dailySpending.find((d) => d.date === yesterdayStr)?.amount ?? 0;

  // Last 7 days average (excluding today) — divide by actual days with data
  const sevenDaysAgo = toColombiaDateString(subDays(now, 7));
  const last7Days = dailySpending.filter((d) => d.date < todayStr && d.date >= sevenDaysAgo);
  const avgLast7 = last7Days.length > 0
    ? last7Days.reduce((sum, d) => sum + d.amount, 0) / last7Days.length
    : 0;

  // Upcoming income derived from hero data — surfaces on the "Por resolver" timeline
  const upcomingIncome = heroData.incomeConfigured && heroData.nextIncomeDate
    ? [{
        occurrenceDate: heroData.nextIncomeDate,
        amount: heroData.nextIncomeAmount,
        name: heroData.nextIncomeName ?? "Próximo ingreso",
      }]
    : [];

  return (
    <>
      <MobileHeader variant="main" title="Zeta" />
      <InicioRoot
        hero={{
          availablePerDay: heroData.availableToSpend / daysRemaining,
          availableTotal: heroData.availableToSpend,
          daysRemaining,
          currency,
          nextIncomeDate: heroData.nextIncomeDate,
          nextIncomeAmount: heroData.nextIncomeAmount,
          nextIncomeName: heroData.nextIncomeName,
          incomeConfigured: heroData.incomeConfigured,
          breakdown: {
            totalLiquid: heroData.totalLiquid,
            fixedExpenses: heroData.windowObligations,
            alreadySpent: heroData.monthlySpent,
          },
          primaryAccount,
        }}
        metrics={{
          daysInMonth,
          dayOfMonth: now.getDate(),
          spentToday,
          spentYesterday,
          avgLast7,
          currency,
        }}
        attentionItems={attentionItemsData}
        upcomingIncome={upcomingIncome}
        burnRateData={burnRateData}
        totalBudget={budgetSummary.totalTarget}
        starterMode={starterMode}
        daysSinceImport={daysSinceImport}
        recentTransactions={mobileRecentTx}
        currency={currency}
      />
    </>
  );
}

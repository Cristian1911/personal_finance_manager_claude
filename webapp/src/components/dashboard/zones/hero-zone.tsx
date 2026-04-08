import { getDashboardHeroData } from "@/actions/charts";
import { get503020Allocation } from "@/actions/allocation";
import { getDebtFreeCountdown } from "@/actions/debt-countdown";
import { getAttentionSnapshot } from "@/actions/attention";
import { getAccounts } from "@/actions/accounts";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { DebtFreeBanner } from "@/components/dashboard/debt-free-banner";
import { AttentionCard } from "@/components/ui/attention-card";
import { UpcomingPayments } from "@/components/dashboard/upcoming-payments";
import {
  QuickValueUpdates,
  type QuickValueUpdateAccount,
} from "@/components/dashboard/accounts-overview";
import { WidgetSlot } from "@/components/dashboard/widget-slot";
import { PlanTeaserCard } from "@/components/dashboard/plan-teaser-card";
import type { CurrencyCode } from "@/types/domain";

interface HeroZoneProps {
  month: string | undefined;
  currency: CurrencyCode;
  monthLabel: string;
}

export async function HeroZone({ month, currency, monthLabel }: HeroZoneProps) {
  const [heroData, allocationData, debtCountdownData, attentionSnapshot, accountsResult] =
    await Promise.all([
      getDashboardHeroData(month, currency),
      get503020Allocation(month, currency),
      getDebtFreeCountdown(currency),
      getAttentionSnapshot(),
      getAccounts(),
    ]);

  const allAccounts = accountsResult.success ? accountsResult.data : [];

  const quickUpdateAccounts: QuickValueUpdateAccount[] = allAccounts.map((account) => ({
    id: account.id,
    name: account.name,
    accountType: account.account_type,
    currentBalance: account.current_balance ?? 0,
    currencyBalances: account.currency_balances,
    currencyCode: account.currency_code,
    displayOrder: account.display_order,
  }));

  return (
    <>
      {/* Hero + Attention — 2/3 hero, 1/3 attention */}
      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <DashboardHero
          data={heroData}
          allocationData={allocationData}
          debtFreeBanner={<DebtFreeBanner data={debtCountdownData} />}
        />
        <AttentionCard signals={attentionSnapshot.signals} className="h-fit" />
      </div>

      {/* Action strip — balanced columns below hero */}
      <div className="grid gap-4 xl:grid-cols-2">
        <WidgetSlot widgetId="upcoming-payments">
          <UpcomingPayments
            obligations={heroData.pendingObligations}
            totalPending={heroData.totalPending}
          />
        </WidgetSlot>

        <QuickValueUpdates accounts={quickUpdateAccounts} id="quick-update-values" />
      </div>

      <PlanTeaserCard
        allocationData={allocationData}
        debtCountdownData={debtCountdownData}
        currency={currency}
        monthLabel={monthLabel}
      />
    </>
  );
}

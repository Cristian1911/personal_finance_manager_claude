import { getPlanPageData } from "@/actions/plan";
import { getPlanTimelineData } from "@/actions/plan-timeline";
import { PlanRoot } from "@/components/mobile/v2/plan/plan-root";
import type { CurrencyCode } from "@/types/domain";

interface PlanMobileZoneProps {
  month: string | undefined;
  currency: CurrencyCode;
  monthLabel: string;
  periodoSummary: {
    hasActive: boolean;
    percentAssigned: number;
    unassignedCount: number;
  } | null;
  wishlistCount: number;
}

export async function PlanMobileZone({
  month,
  currency,
  monthLabel,
  periodoSummary,
  wishlistCount,
}: PlanMobileZoneProps) {
  const [planData, timelineData] = await Promise.all([
    getPlanPageData(month, currency),
    getPlanTimelineData(month, currency),
  ]);

  const now = new Date();
  const planDayOfMonth = now.getDate();
  const planDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  return (
    <PlanRoot
      planData={planData}
      timelineData={timelineData}
      currency={planData.currency}
      monthLabel={monthLabel}
      dayOfMonth={planDayOfMonth}
      daysInMonth={planDaysInMonth}
      periodoSummary={periodoSummary}
      wishlistCount={wishlistCount}
    />
  );
}

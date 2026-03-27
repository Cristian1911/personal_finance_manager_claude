import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { WidgetSlot } from "@/components/dashboard/widget-slot";
import { DebtFreeCountdown } from "@/components/debt/debt-free-countdown";
import { DebtProgressWidget } from "@/components/dashboard/debt-progress-widget";
import dynamic from "next/dynamic";
import { EmergencyFundWidget } from "@/components/dashboard/emergency-fund-widget";

const NetWorthHistoryChart = dynamic(
  () => import("@/components/charts/net-worth-history-chart").then((m) => ({ default: m.NetWorthHistoryChart })),
  { loading: () => <div className="h-[300px] w-full rounded-xl bg-muted animate-pulse" /> }
);
import { InterestPaidWidget } from "@/components/dashboard/interest-paid-widget";
import { getDebtFreeCountdown } from "@/actions/debt-countdown";
import { getInterestPaid } from "@/actions/interest-paid";
import { getDebtProgress } from "@/actions/debt-progress";
import { getNetWorthHistory } from "@/actions/charts";
import type { CurrencyCode } from "@/types/domain";
import type { HealthMetersData } from "@/actions/health-meters";

export async function PatrimonioSection({
  currency,
  month,
  healthMetersData,
}: {
  currency: CurrencyCode;
  month: string | undefined;
  healthMetersData: HealthMetersData;
}) {
  const [debtCountdownData, interestPaidData, debtProgressAccounts, netWorthHistory] = await Promise.all([
    getDebtFreeCountdown(currency),
    getInterestPaid(month, currency),
    getDebtProgress(currency),
    getNetWorthHistory(month, currency),
  ]);

  let patrimonioSubtitle: string | undefined;
  if (debtCountdownData) {
    const activeDebts = debtProgressAccounts?.length ?? 0;
    patrimonioSubtitle = `${activeDebts} ${activeDebts === 1 ? "deuda activa" : "deudas activas"} — libre en ${debtCountdownData.monthsToFree} meses`;
  }

  return (
    <DashboardSection title="Patrimonio y deuda" section="patrimonio" subtitle={patrimonioSubtitle}>
      <WidgetSlot widgetId="debt-countdown">
        <DebtFreeCountdown data={debtCountdownData} />
      </WidgetSlot>

      <WidgetSlot widgetId="debt-progress">
        <DebtProgressWidget accounts={debtProgressAccounts} />
      </WidgetSlot>

      <WidgetSlot widgetId="net-worth">
        <NetWorthHistoryChart data={netWorthHistory} />
      </WidgetSlot>

      <WidgetSlot widgetId="emergency-fund">
        <EmergencyFundWidget data={healthMetersData} />
      </WidgetSlot>

      <WidgetSlot widgetId="interest-paid">
        <InterestPaidWidget data={interestPaidData} />
      </WidgetSlot>
    </DashboardSection>
  );
}

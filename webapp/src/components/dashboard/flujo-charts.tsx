import { CashFlowViewToggle } from "@/components/charts/cash-flow-view-toggle";
import { getMonthlyCashflow } from "@/actions/charts";
import type { CurrencyCode } from "@/types/domain";

export async function FlujoCharts({
  month,
  currency,
  monthLabel,
}: {
  month: string | undefined;
  currency: CurrencyCode;
  monthLabel: string;
}) {
  const cashflowData = await getMonthlyCashflow(month, currency);

  return <CashFlowViewToggle data={cashflowData} monthLabel={monthLabel} />;
}

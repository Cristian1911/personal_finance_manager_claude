import dynamic from "next/dynamic";
import { getMonthlyCashflow } from "@/actions/charts";
import type { CurrencyCode } from "@/types/domain";

const CashFlowViewToggle = dynamic(
  () => import("@/components/charts/cash-flow-view-toggle").then((m) => ({ default: m.CashFlowViewToggle })),
  {
    loading: () => (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="h-5 w-36 rounded bg-muted animate-pulse" />
          <div className="flex gap-1">
            <div className="h-7 w-16 rounded bg-muted animate-pulse" />
            <div className="h-7 w-16 rounded bg-muted animate-pulse" />
          </div>
        </div>
        <div className="h-[280px] w-full rounded-xl bg-muted animate-pulse" />
      </div>
    ),
  }
);

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

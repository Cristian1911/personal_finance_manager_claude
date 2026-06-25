import { Suspense } from "react";
import Link from "next/link";
import { getMonthlyCashflow } from "@/actions/charts";
import { getBurnRate } from "@/actions/burn-rate";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import { BRASS_GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { DashboardSection } from "./dashboard-section";
import { WidgetSlot } from "./widget-slot";
import { FlujoWaterfall } from "./flujo-waterfall";
import { FlujoCharts } from "./flujo-charts";
import {
  BurnRateSkeleton,
  FlujoWaterfallSkeleton,
  FlujoChartsSkeleton,
} from "./dashboard-skeletons";
import dynamic from "next/dynamic";
import type { CurrencyCode } from "@/types/domain";

const BurnRateCard = dynamic(
  () =>
    import("./burn-rate-card").then((m) => ({
      default: m.BurnRateCard,
    })),
  {
    loading: () => (
      <div className="h-40 w-full rounded-xl bg-muted animate-pulse" />
    ),
  }
);

const BurnRateCardEmpty = dynamic(
  () =>
    import("./burn-rate-card").then((m) => ({
      default: m.BurnRateCardEmpty,
    })),
  {
    loading: () => (
      <div className="h-40 w-full rounded-xl bg-muted animate-pulse" />
    ),
  }
);

async function BurnRateSection({ currency }: { currency: CurrencyCode }) {
  const data = await getBurnRate(currency);
  return data ? <BurnRateCard data={data} /> : <BurnRateCardEmpty />;
}

export async function FlujoSection({
  month,
  currency,
  monthLabel,
}: {
  month: string | undefined;
  currency: CurrencyCode;
  monthLabel: string;
}) {
  const cashflowData = await getMonthlyCashflow(month, currency);
  const currentMonth = cashflowData[cashflowData.length - 1];

  let flujoSubtitle: string | undefined;
  if (
    currentMonth &&
    (currentMonth.income > 0 || currentMonth.expenses > 0)
  ) {
    const { income, expenses } = currentMonth;
    if (expenses > income && income > 0) {
      flujoSubtitle = `Gastaste ${formatCurrency(expenses, currency)} de ${formatCurrency(income, currency)} — por encima del ingreso`;
    } else if (income > 0) {
      flujoSubtitle = `Gastaste ${formatCurrency(expenses, currency)} de ${formatCurrency(income, currency)} — vas bien`;
    } else {
      flujoSubtitle = `${formatCurrency(expenses, currency)} en gastos este mes`;
    }
  } else {
    flujoSubtitle = "Importa tu extracto para ver tu flujo";
  }

  return (
    <DashboardSection
      title="Flujo de caja"
      section="flujo"
      subtitle={flujoSubtitle}
      headerAction={
        <Link
          href="/tendencias"
          className={cn(
            BRASS_GHOST_BUTTON_CLASS,
            "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium",
          )}
        >
          Ver tendencias →
        </Link>
      }
    >
      <WidgetSlot widgetId="waterfall">
        <Suspense fallback={<FlujoWaterfallSkeleton />}>
          <FlujoWaterfall month={month} currency={currency} />
        </Suspense>
      </WidgetSlot>
      <WidgetSlot widgetId="burn-rate">
        <Suspense fallback={<BurnRateSkeleton />}>
          <BurnRateSection currency={currency} />
        </Suspense>
      </WidgetSlot>
      <WidgetSlot widgetId="cashflow-trend">
        <Suspense fallback={<FlujoChartsSkeleton />}>
          <FlujoCharts
            month={month}
            currency={currency}
            monthLabel={monthLabel}
          />
        </Suspense>
      </WidgetSlot>
    </DashboardSection>
  );
}

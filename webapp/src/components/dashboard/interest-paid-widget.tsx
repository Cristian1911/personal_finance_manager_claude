import { KPIWidget } from "@/components/ui/kpi-widget";
import { Percent } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import type { InterestPaidData } from "@/actions/interest-paid";

interface InterestPaidWidgetProps {
  data: InterestPaidData | null;
}

export function InterestPaidWidget({ data }: InterestPaidWidgetProps) {
  if (!data) {
    return (
      <KPIWidget
        label="Intereses pagados"
        value="—"
        trend={{ direction: "flat", text: "sin datos" }}
        icon={<Percent className="size-4" />}
        semanticColor="debt"
      />
    );
  }

  const value = formatCurrency(data.currentMonth, data.currency);

  // Trend: down = good (paying less interest), up = bad (paying more)
  let trend: { direction: "up" | "down" | "flat"; text: string };
  if (data.previousMonth === 0 || Math.abs(data.trend) < 1) {
    trend = { direction: "flat", text: "sin cambio vs mes anterior" };
  } else if (data.trend < 0) {
    // Current < previous = improving
    trend = {
      direction: "down",
      text: `${formatCurrency(Math.abs(data.trend), data.currency)} menos que el mes anterior`,
    };
  } else {
    trend = {
      direction: "up",
      text: `${formatCurrency(data.trend, data.currency)} mas que el mes anterior`,
    };
  }

  // Current year from the data
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-1">
      <KPIWidget
        label="Intereses pagados"
        value={value}
        trend={trend}
        icon={<Percent className="size-4" />}
        semanticColor="debt"
      />
      <p className="text-[10px] text-muted-foreground px-1">
        Acumulado {currentYear}: {formatCurrency(data.ytd, data.currency)}
      </p>
    </div>
  );
}

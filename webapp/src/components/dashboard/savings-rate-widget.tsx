import { KPIWidget } from "@/components/ui/kpi-widget";
import { TrendingUp } from "lucide-react";
import type { HealthMetersData } from "@/actions/health-meters";

interface SavingsRateWidgetProps {
  data: HealthMetersData;
  /** Previous month savings rate (0–100), if available */
  prevRate?: number | null;
}

export function SavingsRateWidget({ data, prevRate }: SavingsRateWidgetProps) {
  const ahorroMeter = data.meters.find((m) => m.type === "ahorro");
  const rate = ahorroMeter?.value ?? 0;
  const formattedRate = `${Math.round(rate)}%`;

  // Semantic color based on rate
  const semanticColor =
    rate >= 20 ? "income" : rate >= 10 ? "alert" : "debt";

  // Trend vs previous month
  let trend: { direction: "up" | "down" | "flat"; text: string } | undefined;
  if (prevRate != null) {
    const diff = rate - prevRate;
    if (Math.abs(diff) < 0.5) {
      trend = { direction: "flat", text: "igual al mes anterior" };
    } else if (diff > 0) {
      trend = { direction: "up", text: `+${Math.round(diff)}pp vs mes anterior` };
    } else {
      trend = { direction: "down", text: `${Math.round(diff)}pp vs mes anterior` };
    }
  } else {
    trend = { direction: "flat", text: "meta: 20%" };
  }

  // Progress bar: 0–50% scale, 20% target line
  const barPercent = Math.min(100, (rate / 50) * 100);
  const targetLinePercent = (20 / 50) * 100; // 40%

  return (
    <div className="space-y-2">
      <KPIWidget
        label="Tasa de ahorro"
        value={formattedRate}
        trend={trend}
        icon={<TrendingUp className="size-4" />}
        semanticColor={semanticColor}
      />
      {/* Progress bar: 0-50% scale, target at 20% */}
      <div className="relative h-1.5 rounded-full bg-z-surface-3 overflow-visible mx-1">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(barPercent, 0)}%`,
            background:
              semanticColor === "income"
                ? "var(--z-income)"
                : semanticColor === "alert"
                  ? "var(--z-alert)"
                  : "var(--z-debt)",
          }}
        />
        {/* Target marker at 20% */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full bg-white/50"
          style={{ left: `${targetLinePercent}%` }}
        />
      </div>
      <p className="text-[9px] text-muted-foreground text-right pr-1">meta: 20% | escala: 50%</p>
    </div>
  );
}

import { KPIWidget } from "@/components/ui/kpi-widget";
import { Shield } from "lucide-react";
import type { HealthMetersData } from "@/actions/health-meters";

interface EmergencyFundWidgetProps {
  data: HealthMetersData;
}

export function EmergencyFundWidget({ data }: EmergencyFundWidgetProps) {
  const colchonMeter = data.meters.find((m) => m.type === "colchon");
  const months = colchonMeter?.value ?? 0;
  const formattedValue = colchonMeter?.formattedValue ?? `${months.toFixed(1)} meses`;

  // Semantic color based on level
  const level = colchonMeter?.level ?? "critico";
  const semanticColor =
    level === "excelente" || level === "solido"
      ? "income"
      : level === "atento"
        ? "alert"
        : "debt";

  // Segmented bar: 0–6 months scale
  // Segment 1: current (up to 3m) → green
  // Segment 2: gap to 3m (if < 3m)
  // Segment 3: gap from 3m to 6m → goal zone
  const maxScale = 6;
  const clampedMonths = Math.min(months, maxScale);
  const currentPercent = (clampedMonths / maxScale) * 100;
  const target3mPercent = (3 / maxScale) * 100; // 50%
  const target6mPercent = 100;

  return (
    <div className="space-y-2">
      <KPIWidget
        label="Colchon de emergencia"
        value={formattedValue}
        trend={{ direction: "flat", text: "meta: 6 meses" }}
        icon={<Shield className="size-4" />}
        semanticColor={semanticColor}
      />

      {/* Segmented bar: current | gap to 3m | gap to 6m */}
      <div className="relative h-2 rounded-full bg-z-surface-3 overflow-hidden mx-1">
        {/* Filled portion */}
        <div
          className="absolute h-full rounded-full"
          style={{
            width: `${currentPercent}%`,
            background:
              months >= 6
                ? "var(--z-income)"
                : months >= 3
                  ? "var(--z-alert)"
                  : "var(--z-debt)",
          }}
        />
        {/* 3-month marker */}
        <div
          className="absolute top-0 h-full w-px bg-white/40"
          style={{ left: `${target3mPercent}%` }}
        />
        {/* 6-month marker (right edge) */}
        <div
          className="absolute top-0 h-full w-px bg-white/40"
          style={{ left: `${target6mPercent - 0.5}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground px-1">
        <span>0</span>
        <span>3m</span>
        <span>6m</span>
      </div>
    </div>
  );
}

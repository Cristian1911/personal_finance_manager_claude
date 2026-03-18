"use client";

import { useState } from "react";
import {
  getLevelColor,
  getLevelTag,
  getNormalizedPosition,
} from "@/lib/health-levels";
import type { HealthMetersData, HealthMeter } from "@/actions/health-meters";
import type { MeterType, Level } from "@/lib/health-levels";
import { HealthMeterExpanded } from "./health-meter-expanded";
import type { CurrencyCode } from "@/types/domain";

interface HealthMetersCardProps {
  data: HealthMetersData;
  onMeterClick?: (type: MeterType) => void;
}

const METER_LABELS: Record<MeterType, string> = {
  gasto: "Gasto",
  deuda: "Deuda",
  ahorro: "Ahorro",
  colchon: "Colchón",
};

const GRADIENT =
  "linear-gradient(to right, var(--z-debt), var(--z-expense), var(--z-alert), var(--z-income), var(--z-excellent))";

function levelBgStyle(level: Level): React.CSSProperties {
  const colorMap: Record<Level, string> = {
    excelente: "rgba(61,158,110,0.15)",
    solido: "rgba(92,184,138,0.15)",
    atento: "rgba(212,168,67,0.15)",
    alto: "rgba(232,135,90,0.15)",
    critico: "rgba(224,85,69,0.15)",
  };
  return { backgroundColor: colorMap[level] };
}

function MeterRow({
  meter,
  onClick,
}: {
  meter: HealthMeter;
  onClick: () => void;
}) {
  const color = getLevelColor(meter.level);
  const tag = getLevelTag(meter.level);
  const pinPosition = getNormalizedPosition(meter.type, meter.value);
  const label = METER_LABELS[meter.type];

  return (
    <div
      className="cursor-pointer space-y-1.5 rounded-lg px-3 py-2.5 transition-colors hover:bg-z-surface-3"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      {/* Row header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{label}</span>
        <div className="flex items-center gap-2">
          <span
            className="text-lg font-extrabold"
            style={{ color }}
          >
            {meter.formattedValue}
          </span>
          <span
            className="px-2 py-0.5 rounded text-[9px] font-bold uppercase"
            style={{ backgroundColor: color, color: "var(--z-ink)" }}
          >
            {tag}
          </span>
        </div>
      </div>

      {/* Gradient bar with pin */}
      <div className="relative" style={{ height: "14px" }}>
        <div
          className="absolute inset-0"
          style={{
            background: GRADIENT,
            borderRadius: "7px",
          }}
        />
        {/* White pin marker */}
        <div
          className="absolute"
          style={{
            left: `${Math.min(Math.max(pinPosition, 2), 98)}%`,
            top: "-6px",
            width: "4px",
            height: "26px",
            background: "var(--z-white)",
            borderRadius: "2px",
            boxShadow: "0 0 10px rgba(240,237,230,0.6)",
            transform: "translateX(-50%)",
          }}
        />
      </div>
    </div>
  );
}

export function HealthMetersCard({ data, onMeterClick }: HealthMetersCardProps) {
  const [expandedMeter, setExpandedMeter] = useState<MeterType | null>(null);

  const handleMeterClick = (type: MeterType) => {
    setExpandedMeter(type);
    onMeterClick?.(type);
  };

  const selectedMeter = expandedMeter
    ? data.meters.find((m) => m.type === expandedMeter) ?? null
    : null;

  // Determine worst level for summary box color
  const levelPriority: Record<Level, number> = {
    critico: 0,
    alto: 1,
    atento: 2,
    solido: 3,
    excelente: 4,
  };
  const worstMeter = data.meters.reduce((worst, m) =>
    levelPriority[m.level] < levelPriority[worst.level] ? m : worst,
  );
  const summaryColor = getLevelColor(worstMeter.level);

  return (
    <div className="rounded-xl bg-z-surface-2 border border-z-border p-4 space-y-1">
      {data.meters.map((meter) => (
        <MeterRow
          key={meter.type}
          meter={meter}
          onClick={() => handleMeterClick(meter.type)}
        />
      ))}

      {/* Summary roast */}
      <div
        className="mt-3 rounded-lg px-3 py-2.5 text-xs"
        style={levelBgStyle(worstMeter.level)}
      >
        <span style={{ color: summaryColor }} className="font-semibold">
          {data.summaryRoast}
        </span>
      </div>

      {/* Expanded detail dialog/sheet */}
      {selectedMeter && (
        <HealthMeterExpanded
          meter={selectedMeter}
          income={data.monthlyIncome}
          currency={data.currency}
          open={expandedMeter !== null}
          onOpenChange={(open) => {
            if (!open) setExpandedMeter(null);
          }}
        />
      )}
    </div>
  );
}

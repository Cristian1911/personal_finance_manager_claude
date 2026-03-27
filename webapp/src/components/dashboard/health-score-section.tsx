"use client";

import { useState } from "react";
import { SpeedometerGauge } from "./speedometer-gauge";
import { computeCompositeScore, getScoreLabel } from "@/lib/health-score";
import {
  getLevelColor,
  getLevelTag,
  getNormalizedPosition,
  METER_DISPLAY_LABELS,
  LEVEL_PRIORITY,
} from "@/lib/health-levels";
import type { HealthMetersData, HealthMeter } from "@/actions/health-meters";
import type { MeterType, Level } from "@/lib/health-levels";
import { HealthMeterExpanded } from "./health-meter-expanded";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRADIENT =
  "linear-gradient(to right, var(--z-debt), var(--z-expense), var(--z-alert), var(--z-income), var(--z-excellent))";

// ---------------------------------------------------------------------------
// MeterRow — copied from health-meters-card.tsx (kept in sync, not shared)
// ---------------------------------------------------------------------------

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
  const label = METER_DISPLAY_LABELS[meter.type];
  const isNoData = !meter.hasData;

  return (
    <button
      type="button"
      className="w-full text-left cursor-pointer space-y-1.5 rounded-lg px-3 py-2.5 transition-colors hover:bg-z-surface-3 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      onClick={onClick}
    >
      {/* Row header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{label}</span>
        {isNoData ? (
          <span className="text-xs text-muted-foreground">Sin datos</span>
        ) : (
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
        )}
      </div>

      {/* Gradient bar with pin -- hidden when no income data */}
      {!isNoData && (
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
      )}

      {/* Info line when no income data */}
      {isNoData && (
        <p className="text-[11px] text-muted-foreground">
          Configura tu ingreso en ajustes
        </p>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// HealthScoreSection
// ---------------------------------------------------------------------------

interface HealthScoreSectionProps {
  data: HealthMetersData;
}

export function HealthScoreSection({ data }: HealthScoreSectionProps) {
  const [expandedMeter, setExpandedMeter] = useState<MeterType | null>(null);
  const compositeScore = computeCompositeScore(data.meters);
  const scoreLabel = getScoreLabel(compositeScore);

  const selectedMeter = expandedMeter
    ? data.meters.find((m) => m.type === expandedMeter) ?? null
    : null;

  // Worst meter for summary roast color
  const worstMeter = data.meters.reduce((a, b) =>
    (LEVEL_PRIORITY[a.level] ?? 0) < (LEVEL_PRIORITY[b.level] ?? 0) ? a : b,
  );
  const summaryColor = getLevelColor(worstMeter.level);

  return (
    <div className="rounded-xl bg-z-surface-2 py-6 px-4 space-y-4">
      <SpeedometerGauge score={compositeScore} label={scoreLabel} />

      <div className="space-y-1">
        {data.meters.map((meter) => (
          <MeterRow
            key={meter.type}
            meter={meter}
            onClick={() => setExpandedMeter(meter.type)}
          />
        ))}
      </div>

      {/* Summary roast */}
      <div
        className="rounded-lg px-3 py-2.5 text-xs"
        style={{
          backgroundColor: `color-mix(in srgb, ${summaryColor} 15%, transparent)`,
        }}
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

"use client";

import { formatCurrency } from "@/lib/utils/currency";
import type { HeatmapData } from "@/actions/spending-heatmap";

interface SpendingHeatmapProps {
  data: HeatmapData;
}

const levelColors = [
  "var(--z-surface-3)",
  "color-mix(in srgb, var(--z-expense) 25%, var(--z-surface-3))",
  "color-mix(in srgb, var(--z-expense) 45%, var(--z-surface-3))",
  "color-mix(in srgb, var(--z-expense) 65%, var(--z-surface-3))",
  "var(--z-expense)",
];

export function SpendingHeatmap({ data }: SpendingHeatmapProps) {
  const offset = data.days[0]?.dayOfWeek ?? 0;

  // Build cells: `offset` empty cells + one cell per day
  const emptyCells = Array.from({ length: offset }, (_, i) => ({ type: "empty" as const, key: `empty-${i}` }));
  const dayCells = data.days.map((day) => ({ type: "day" as const, day }));
  const cells = [...emptyCells, ...dayCells];

  return (
    <div>
      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((d) => (
          <div key={d} className="text-[8px] text-muted-foreground text-center">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          if (cell.type === "empty") {
            return <div key={cell.key} className="aspect-square" />;
          }
          const { day } = cell;
          return (
            <div
              key={day.date}
              className="aspect-square rounded"
              style={{ background: levelColors[day.level] }}
              title={`${day.date}: ${formatCurrency(day.amount, data.currency)}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 mt-3 justify-end">
        <span className="text-[9px] text-muted-foreground">Menos</span>
        {([0, 1, 2, 3, 4] as const).map((l) => (
          <div key={l} className="w-3 h-3 rounded-sm" style={{ background: levelColors[l] }} />
        ))}
        <span className="text-[9px] text-muted-foreground">Mas</span>
      </div>

      {/* Pattern detection */}
      {data.patterns.weekendRatio > 1.3 && (
        <p className="text-[11px] text-muted-foreground mt-2">
          Patron detectado:{" "}
          <strong className="text-foreground">
            Gastas {data.patterns.weekendRatio.toFixed(1)}x mas los fines de semana
          </strong>
        </p>
      )}
    </div>
  );
}

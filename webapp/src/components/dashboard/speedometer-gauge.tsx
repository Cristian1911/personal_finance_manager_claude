"use client";

import { getScoreColor } from "@/lib/health-score";

interface SpeedometerGaugeProps {
  score: number; // 0-100
  label: string; // e.g. "Bien"
}

// ---------------------------------------------------------------------------
// Arc helper — creates an SVG arc path from angle1 to angle2 on a semicircle
// Angles in radians: PI = left (180deg), 0 = right (0deg)
// ---------------------------------------------------------------------------

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy - r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy - r * Math.sin(endAngle);

  // Large arc flag: if the arc spans more than PI radians
  const largeArc = Math.abs(startAngle - endAngle) > Math.PI ? 1 : 0;
  // Sweep flag: 0 = counter-clockwise in SVG (which is left-to-right for our semicircle)
  const sweep = 0;

  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweep} ${x2} ${y2}`;
}

// Zone definitions: percentage ranges mapped to colors
const ZONES = [
  { start: 0, end: 0.25, color: "var(--z-debt)" },
  { start: 0.25, end: 0.5, color: "var(--z-alert)" },
  { start: 0.5, end: 0.75, color: "var(--z-income)" },
  { start: 0.75, end: 1, color: "var(--z-excellent)" },
] as const;

const CX = 100;
const CY = 100;
const R = 80;
const STROKE_W = 12;

export function SpeedometerGauge({ score, label }: SpeedometerGaugeProps) {
  const indicatorColor = getScoreColor(score);

  // Indicator position: angle in radians (PI = left, 0 = right)
  const indicatorAngle = Math.PI - (score / 100) * Math.PI;
  const indicatorX = CX + R * Math.cos(indicatorAngle);
  const indicatorY = CY - R * Math.sin(indicatorAngle);

  return (
    <div className="flex justify-center min-h-[160px] lg:min-h-[200px]">
      <svg
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Puntaje de salud financiera"
        viewBox="0 0 200 120"
        className="w-full max-w-[280px]"
      >
        {/* Color zone arcs */}
        {ZONES.map((zone) => {
          // Convert zone percentages to angles (PI to 0)
          const startAngle = Math.PI - zone.start * Math.PI;
          const endAngle = Math.PI - zone.end * Math.PI;

          return (
            <path
              key={zone.color}
              d={describeArc(CX, CY, R, startAngle, endAngle)}
              fill="none"
              stroke={zone.color}
              strokeWidth={STROKE_W}
              strokeLinecap={
                zone.start === 0 || zone.end === 1 ? "round" : "butt"
              }
              opacity={0.85}
            />
          );
        })}

        {/* Indicator circle */}
        <circle
          cx={indicatorX}
          cy={indicatorY}
          r={6}
          fill={indicatorColor}
          style={{
            transition: "cx 0.6s ease, cy 0.6s ease, fill 0.6s ease",
          }}
        />

        {/* Score number */}
        <text
          x={CX}
          y={85}
          textAnchor="middle"
          fontSize="28"
          fontWeight="700"
          fill="currentColor"
        >
          {score}
        </text>

        {/* Score label */}
        <text
          x={CX}
          y={102}
          textAnchor="middle"
          fontSize="11"
          fill="var(--color-muted-foreground)"
        >
          {label}
        </text>
      </svg>
    </div>
  );
}

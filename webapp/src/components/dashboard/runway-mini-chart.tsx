/**
 * Shared SVG mini runway chart — used in BurndownExpandable and InicioMetricsGrid.
 * Shows balance decline from month start to today, projected slope, obligation dots.
 */

export interface RunwayMiniChartProps {
  dataPoints: { date: string; balance: number }[];
  runwayDays: number;
  dayOfMonth: number;
  daysInMonth: number;
  obligations?: { date: string; name: string; amount: number }[];
  nextIncomeDate?: string | null;
}

export function RunwayMiniChart({
  dataPoints,
  runwayDays,
  dayOfMonth,
  daysInMonth,
  obligations,
  nextIncomeDate,
}: RunwayMiniChartProps) {
  const W = 280;
  const H = 64;
  const PAD = { top: 6, right: 10, bottom: 16, left: 10 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const parseDay = (date: string) => parseInt(date.split("-")[2], 10);
  const monthPoints = dataPoints.filter(
    (dp) => parseDay(dp.date) <= dayOfMonth
  );

  if (monthPoints.length < 2) {
    return (
      <div className="flex h-10 items-center justify-center rounded-lg border border-white/8 bg-black/20 text-[11px] text-muted-foreground">
        Datos insuficientes
      </div>
    );
  }

  const maxBalance = Math.max(...monthPoints.map((p) => p.balance));
  const scaleX = (day: number) =>
    PAD.left + (day / daysInMonth) * plotW;
  const scaleY = (val: number) =>
    PAD.top + plotH - (val / ((maxBalance || 1) * 1.1)) * plotH;

  const actualPath = monthPoints
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${scaleX(parseDay(p.date))},${scaleY(p.balance)}`
    )
    .join(" ");

  const lastPoint = monthPoints[monthPoints.length - 1];
  const lastDay = parseDay(lastPoint.date);
  const cx = scaleX(lastDay);
  const cy = scaleY(lastPoint.balance);
  const projectedEndDay = Math.min(
    lastDay + runwayDays,
    daysInMonth + 2
  );
  const daysRemaining = daysInMonth - dayOfMonth;

  return (
    <div className="rounded-lg border border-white/8 bg-black/20 p-1.5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        aria-label="Proyección de gasto"
      >
        <line
          x1={scaleX(1)}
          y1={scaleY(maxBalance)}
          x2={scaleX(daysInMonth)}
          y2={scaleY(0)}
          stroke="var(--z-olive-deep)"
          strokeWidth="1"
          strokeDasharray="4,3"
        />
        <path
          d={actualPath}
          fill="none"
          stroke="var(--z-brass)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx={cx} cy={cy} r="2.5" fill="var(--z-brass)" />
        {runwayDays < daysRemaining && (
          <path
            d={`M${cx},${cy} L${scaleX(projectedEndDay)},${scaleY(0)}`}
            fill="none"
            stroke="var(--z-debt)"
            strokeWidth="1"
            strokeDasharray="3,2"
          />
        )}
        {obligations?.map((ob) => {
          const obDay = parseInt(ob.date.split("-")[2], 10);
          if (obDay <= dayOfMonth) return null;
          return (
            <circle
              key={`${ob.date}-${ob.name}`}
              cx={scaleX(obDay)}
              cy={scaleY(maxBalance * 0.1)}
              r="2"
              fill="var(--z-expense)"
              opacity={0.6}
            />
          );
        })}
        {nextIncomeDate && (() => {
          const incomeDay = parseInt(nextIncomeDate.split("-")[2], 10);
          if (incomeDay <= dayOfMonth || incomeDay > daysInMonth) return null;
          return (
            <circle
              key="next-income"
              cx={scaleX(incomeDay)}
              cy={scaleY(maxBalance * 0.9)}
              r="2.5"
              fill="var(--z-sage-light)"
              opacity={0.7}
            />
          );
        })()}
        <text
          x={PAD.left}
          y={H - 2}
          fill="var(--z-sage-dark)"
          fontSize="8"
          fontFamily="system-ui"
        >
          1
        </text>
        <text
          x={scaleX(dayOfMonth)}
          y={H - 2}
          fill="var(--z-sage-light)"
          fontSize="8"
          fontFamily="system-ui"
          textAnchor="middle"
        >
          Hoy
        </text>
        <text
          x={W - PAD.right}
          y={H - 2}
          fill="var(--z-sage-dark)"
          fontSize="8"
          fontFamily="system-ui"
          textAnchor="end"
        >
          {daysInMonth}
        </text>
      </svg>
    </div>
  );
}

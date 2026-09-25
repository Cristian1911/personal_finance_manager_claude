import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { RatePoint } from "@/lib/fx/rate-sources";
import type { CurrencyCode } from "@/types/domain";

const W = 600;
const H = 160;
const PAD_Y = 12;

/**
 * Server-rendered line of daily closes with the 30-day average as a dashed
 * reference. Plain SVG (no chart lib): the page stays zero-JS. The SVG
 * stretches to its box; the today marker and labels are HTML so they don't
 * distort with it.
 */
export function FxHistoryChart({
  history,
  avg30d,
  currency,
}: {
  history: RatePoint[];
  avg30d: number | null;
  currency: CurrencyCode;
}) {
  if (history.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-z-sage-dark">
        Aún no hay suficiente historial para graficar.
      </p>
    );
  }

  const rates = history.map((p) => p.rate);
  const lo = Math.min(...rates, avg30d ?? Infinity);
  const hi = Math.max(...rates, avg30d ?? -Infinity);
  const span = hi - lo || 1;
  const x = (i: number) => (i / (history.length - 1)) * W;
  const y = (rate: number) => PAD_Y + (1 - (rate - lo) / span) * (H - PAD_Y * 2);

  const line = history.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.rate).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const last = history[history.length - 1];
  const lastTop = (y(last.rate) / H) * 100;

  return (
    <div className="space-y-2">
      <div className="relative h-40 w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          role="img"
          aria-label={`Tasa diaria de los últimos ${history.length} días`}
        >
          <path d={area} className="fill-z-brass/10" />
          {avg30d !== null && (
            <line
              x1={0}
              x2={W}
              y1={y(avg30d)}
              y2={y(avg30d)}
              className="stroke-z-sage-dark"
              strokeDasharray="4 4"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path
            d={line}
            fill="none"
            className="stroke-z-brass"
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          aria-hidden="true"
          className="absolute right-0 size-2.5 -translate-y-1/2 translate-x-1/2 rounded-full border-2 border-z-surface bg-z-brass"
          style={{ top: `${lastTop}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] tabular-nums text-z-sage-dark">
        <span>{formatDate(history[0].date, "d MMM")}</span>
        {avg30d !== null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t border-dashed border-z-sage-dark" aria-hidden="true" />
            Promedio 30 días · {formatCurrency(avg30d, currency)}
          </span>
        )}
        <span>Hoy</span>
      </div>
    </div>
  );
}

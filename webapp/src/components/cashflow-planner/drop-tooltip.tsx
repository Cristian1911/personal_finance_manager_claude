"use client";

import { formatCurrency } from "@/lib/utils/currency";
import { getEnvelopeColor } from "@/lib/constants/envelope-colors";
import type { CurrencyCode } from "@/types/domain";
import type { JarCapacityPreview } from "@/lib/utils/envelope-assignment";

interface DropTooltipProps {
  /** Ref to mutate via `transform: translate3d(x,y,0)` on pointermove — avoids React renders. */
  tooltipRef: React.RefObject<HTMLDivElement | null>;
  envelopeLabel: string;
  colorIndex: number;
  currency: CurrencyCode;
  preview: JarCapacityPreview;
  /** Existing assigned amount on the jar, for the mini-bar. */
  existingAssigned: number;
  envelopeTotal: number;
}

export function DropTooltip({
  tooltipRef,
  envelopeLabel,
  colorIndex,
  currency,
  preview,
  existingAssigned,
  envelopeTotal,
}: DropTooltipProps) {
  const color = getEnvelopeColor(colorIndex);
  const existingPct = envelopeTotal > 0 ? (existingAssigned / envelopeTotal) * 100 : 0;
  const previewPct = envelopeTotal > 0 ? (preview.absorbs / envelopeTotal) * 100 : 0;

  return (
    <div
      ref={tooltipRef}
      className="pointer-events-none fixed left-0 top-0 z-[9999] min-w-[200px] rounded-lg border bg-z-surface-3 p-3 shadow-2xl will-change-transform"
      style={{ borderColor: color.hex }}
      role="tooltip"
    >
      <p
        className="font-mono text-[9px] font-bold uppercase tracking-[0.18em]"
        style={{ color: color.hex }}
      >
        {envelopeLabel} · capacidad
      </p>
      <p className="mt-1 text-xs">
        Absorbe{" "}
        <strong style={{ color: color.hex }}>{formatCurrency(preview.absorbs, currency)}</strong>
        {preview.leftover > 0 ? (
          <>
            <br />
            Queda{" "}
            <span className="font-semibold text-z-expense">
              {formatCurrency(preview.leftover, currency)} resto
            </span>
          </>
        ) : (
          <>
            <br />
            <span className="text-z-income">Cubre el gasto completo ✓</span>
          </>
        )}
      </p>
      <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-white/10">
        <span
          className="absolute left-0 top-0 h-full"
          style={{ width: `${existingPct}%`, backgroundColor: color.hex, opacity: 0.5 }}
        />
        <span
          className="absolute top-0 h-full"
          style={{
            left: `${existingPct}%`,
            width: `${previewPct}%`,
            backgroundColor: color.hex,
          }}
        />
      </div>
      <p className="mt-2 text-[9px] text-muted-foreground">
        <kbd className="rounded bg-z-surface-2 px-1 font-mono text-[9px] text-z-brass-hot">
          alt
        </kbd>{" "}
        + soltar = monto personalizado
      </p>
    </div>
  );
}

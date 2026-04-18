import { cn } from "@/lib/utils";
import { getEnvelopeColor } from "@/lib/constants/envelope-colors";

export interface RibbonSegment {
  /** Index into ENVELOPE_COLORS, or -1 for "resto" (unassigned remainder). */
  colorIndex: number;
  /** Portion of total expense this segment represents, 0..1. */
  portion: number;
}

interface ExpenseRibbonProps {
  /** Segments ordered top-to-bottom. Sum of portions should be 1. */
  segments: RibbonSegment[];
  className?: string;
}

/**
 * Vertical 4px ribbon on the left of an expense card.
 * Solid color segments = assigned sources; colorIndex=-1 = hatched orange (resto).
 * If segments is empty OR the only segment is a full-height resto, the card is "unassigned".
 */
export function ExpenseRibbon({ segments, className }: ExpenseRibbonProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute left-0 top-0 bottom-0 w-[4px] overflow-hidden rounded-l-[inherit]",
        className,
      )}
    >
      {segments.map((seg, i) => {
        const heightPct = `${seg.portion * 100}%`;
        if (seg.colorIndex === -1) {
          return (
            <span
              key={i}
              className="block w-full"
              style={{
                height: heightPct,
                background:
                  "repeating-linear-gradient(0deg, rgba(228,135,90,0.7) 0 4px, transparent 4px 8px)",
              }}
            />
          );
        }
        const color = getEnvelopeColor(seg.colorIndex);
        return (
          <span
            key={i}
            className="block w-full"
            style={{ height: heightPct, backgroundColor: color.hex }}
          />
        );
      })}
    </span>
  );
}

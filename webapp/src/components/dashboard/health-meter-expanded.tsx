"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getLevelColor, getLevelTag, getNormalizedPosition, METER_DISPLAY_LABELS } from "@/lib/health-levels";
import type { HealthMeter } from "@/actions/health-meters";
import type { CurrencyCode } from "@/types/domain";
import { useMediaQuery } from "@/hooks/use-media-query";

interface HealthMeterExpandedProps {
  meter: HealthMeter;
  income: number | null;
  currency: CurrencyCode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const METER_META: Record<
  string,
  { goalPct: number; idealPct: number; unit: string; lowerIsBetter: boolean }
> = {
  gasto:  { goalPct: 60,  idealPct: 50,  unit: "%",     lowerIsBetter: true  },
  deuda:  { goalPct: 36,  idealPct: 25,  unit: "%",     lowerIsBetter: true  },
  ahorro: { goalPct: 20,  idealPct: 30,  unit: "%",     lowerIsBetter: false },
  colchon:{ goalPct: 6,   idealPct: 12,  unit: " meses",lowerIsBetter: false },
};

function Speedometer({ meter }: { meter: HealthMeter }) {
  const color = getLevelColor(meter.level);
  const pinPosition = getNormalizedPosition(meter.type, meter.value);

  // Convert 0-100 position to -90deg to +90deg
  const needleDeg = -90 + (pinPosition / 100) * 180;

  // Semicircle arc path constants
  const cx = 100;
  const cy = 100;
  const r = 80;
  const strokeW = 14;

  // 5 color segment arcs on the semicircle (left to right = green to red for lower-is-better)
  // The semicircle goes from 180° to 0° (left to right in SVG angles).
  // We'll draw a gradient arc using the defs linearGradient approach,
  // but since SVG stroke gradients are limited, we use a single colored arc overlay trick.
  // Simpler: just draw the background arc + a single progress arc colored by level.

  return (
    <div className="relative flex justify-center">
      <svg
        viewBox="0 0 200 110"
        className="w-[200px] h-[110px]"
        aria-hidden="true"
      >
        <defs>
          {/* Gradient along the arc — we fake it with a linear gradient */}
          <linearGradient id="speedo-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="var(--z-debt)" />
            <stop offset="25%"  stopColor="var(--z-expense)" />
            <stop offset="50%"  stopColor="var(--z-alert)" />
            <stop offset="75%"  stopColor="var(--z-income)" />
            <stop offset="100%" stopColor="var(--z-excellent)" />
          </linearGradient>
        </defs>

        {/* Background track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="var(--z-surface-3)"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />

        {/* Colored gradient arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="url(#speedo-grad)"
          strokeWidth={strokeW}
          strokeLinecap="round"
          opacity={0.85}
        />

        {/* Level-colored highlight — small arc at current position */}
        {/* We draw a tiny cap at the pin position to highlight current level */}
      </svg>

      {/* Needle — CSS positioned */}
      <div
        className="absolute"
        style={{
          bottom: "0px",
          left: "50%",
          width: "3px",
          height: "72px",
          background: "var(--z-white)",
          borderRadius: "3px 3px 0 0",
          transformOrigin: "bottom center",
          transform: `translateX(-50%) rotate(${needleDeg}deg)`,
          boxShadow: `0 0 8px ${color}80`,
        }}
      />

      {/* Center dot */}
      <div
        className="absolute rounded-full"
        style={{
          bottom: "-4px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "12px",
          height: "12px",
          background: "var(--z-white)",
        }}
      />
    </div>
  );
}

function MeterContent({ meter, income, currency }: { meter: HealthMeter; income: number | null; currency: CurrencyCode }) {
  const color = getLevelColor(meter.level);
  const tag = getLevelTag(meter.level);
  const label = METER_DISPLAY_LABELS[meter.type] ?? meter.type;
  const meta = METER_META[meter.type];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">{label}</h2>
        <span
          className="px-2 py-0.5 rounded text-[9px] font-bold uppercase"
          style={{ backgroundColor: color, color: "var(--z-ink)" }}
        >
          {tag}
        </span>
      </div>

      {/* Speedometer */}
      <Speedometer meter={meter} />

      {/* Large value */}
      <div className="text-center">
        <span
          className="text-4xl font-extrabold"
          style={{ color }}
        >
          {meter.formattedValue}
        </span>
      </div>

      {/* Reference bar */}
      {meta && (
        <div className="text-center text-xs text-muted-foreground">
          Meta: {meta.goalPct}{meta.unit} · Ideal: {meta.idealPct}{meta.unit}
        </div>
      )}

      {/* Roast text */}
      <div
        className="rounded-lg px-4 py-3 text-sm leading-relaxed"
        style={{
          backgroundColor: `${color}18`,
          borderLeft: `3px solid ${color}`,
        }}
      >
        {meter.roast}
      </div>
    </div>
  );
}

export function HealthMeterExpanded({
  meter,
  income,
  currency,
  open,
  onOpenChange,
}: HealthMeterExpandedProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">
              {METER_DISPLAY_LABELS[meter.type] ?? meter.type}
            </DialogTitle>
          </DialogHeader>
          <MeterContent meter={meter} income={income} currency={currency} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl pb-8">
        <SheetHeader className="sr-only">
          <SheetTitle>{METER_DISPLAY_LABELS[meter.type] ?? meter.type}</SheetTitle>
        </SheetHeader>
        <div className="pt-2 px-1">
          <MeterContent meter={meter} income={income} currency={currency} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

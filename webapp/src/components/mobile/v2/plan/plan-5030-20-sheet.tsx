"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import { MOBILE_TAB_BAR_CLEARANCE_CLASS } from "@/lib/constants/styles";
import type { AllocationData } from "@/actions/allocation";
import type { CurrencyCode } from "@/types/domain";

interface Plan5030Sheet20Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allocation: AllocationData | null;
}

type Variance = "over" | "near" | "under";

interface BucketRowProps {
  name: string;
  actual: { amount: number; percent: number };
  target: number;
  currency: CurrencyCode;
  variance: Variance;
}

function BucketRow({ name, actual, target, currency, variance }: BucketRowProps) {
  const clampedPercent = Math.max(0, Math.min(100, actual.percent));
  const fillColor =
    variance === "over"
      ? "bg-z-expense"
      : variance === "near"
        ? "bg-z-brass"
        : "bg-z-income";
  const actualColor =
    variance === "over"
      ? "text-z-expense"
      : variance === "near"
        ? "text-z-brass"
        : "text-z-income";
  const markerLeft = Math.min(100, target);

  return (
    <div className="py-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-medium">{name}</span>
        <div className="flex gap-2 text-[11px]">
          <span className="text-muted-foreground">Meta {target}%</span>
          <span className={cn("font-semibold", actualColor)}>
            Actual {Math.round(actual.percent)}%
          </span>
        </div>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className={cn("h-full rounded-full", fillColor)}
          style={{ width: `${clampedPercent}%` }}
        />
        <div
          className="absolute inset-y-[-2px] w-0.5 bg-white/60"
          style={{ left: `${markerLeft}%` }}
          aria-hidden
        />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {formatCurrency(actual.amount, currency)}
      </p>
    </div>
  );
}

export function Plan5030Sheet20({
  open,
  onOpenChange,
  allocation,
}: Plan5030Sheet20Props) {
  if (!allocation) return null;

  const needsVariance: Variance =
    allocation.needs.percent > 55
      ? "over"
      : allocation.needs.percent >= 45
        ? "near"
        : "under";
  const wantsVariance: Variance =
    allocation.wants.percent > 35
      ? "over"
      : allocation.wants.percent >= 25
        ? "near"
        : "under";
  const savingsVariance: Variance =
    allocation.savings.percent < 15
      ? "over"
      : allocation.savings.percent <= 25
        ? "near"
        : "under";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn("rounded-t-2xl", MOBILE_TAB_BAR_CLEARANCE_CLASS)}
      >
        <SheetHeader>
          <SheetTitle>Distribución 50/30/20</SheetTitle>
          <SheetDescription>
            Cómo estás repartiendo tus gastos este mes
          </SheetDescription>
        </SheetHeader>
        <div className="mt-2 divide-y divide-white/5">
          <BucketRow
            name="Necesario"
            actual={allocation.needs}
            target={allocation.needs.target}
            currency={allocation.currency}
            variance={needsVariance}
          />
          <BucketRow
            name="Deseos"
            actual={allocation.wants}
            target={allocation.wants.target}
            currency={allocation.currency}
            variance={wantsVariance}
          />
          <BucketRow
            name="Ahorro"
            actual={allocation.savings}
            target={allocation.savings.target}
            currency={allocation.currency}
            variance={savingsVariance}
          />
        </div>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          50/30/20 es una guía, no una regla estricta.
        </p>
      </SheetContent>
    </Sheet>
  );
}

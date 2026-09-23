import Link from "next/link";
import { ChevronRight, DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import {
  FX_RATE_SIGNAL_THRESHOLD_PCT,
  type FxRateSignal,
} from "@/lib/debt/fx-rate-signal";

function formatPct(value: number): string {
  return `${Math.abs(value).toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;
}

/**
 * Dashboard strip: today's rate for the user's foreign-currency debt vs its
 * 30-day average. Highlighted when the rate is low (good day to pay the
 * dollar side of the card), quiet otherwise. Links to /deudas.
 */
export function FxRateStrip({
  signal,
  className,
}: {
  signal: FxRateSignal;
  className?: string;
}) {
  const { from, to, rate, avg30d, percentVsAvg, foreignDebt } = signal;
  const isCheap = percentVsAvg !== null && percentVsAvg <= -FX_RATE_SIGNAL_THRESHOLD_PCT;
  const isExpensive = percentVsAvg !== null && percentVsAvg >= FX_RATE_SIGNAL_THRESHOLD_PCT;
  const Icon = isCheap ? TrendingDown : isExpensive ? TrendingUp : DollarSign;

  const title = isCheap
    ? `${from} en tasa baja · ${formatCurrency(rate, to)}`
    : `${from} hoy · ${formatCurrency(rate, to)}`;

  const detail =
    avg30d === null || percentVsAvg === null
      ? `Debes ${formatCurrency(foreignDebt, from)} en ${from}.`
      : isCheap
        ? `${formatPct(percentVsAvg)} bajo el promedio de 30 días (${formatCurrency(avg30d, to)}). Buen momento para pagar ${formatCurrency(foreignDebt, from)}.`
        : isExpensive
          ? `${formatPct(percentVsAvg)} sobre el promedio de 30 días (${formatCurrency(avg30d, to)}). Si puedes, espera para pagar en ${from}.`
          : `En línea con el promedio de 30 días (${formatCurrency(avg30d, to)}). Debes ${formatCurrency(foreignDebt, from)}.`;

  return (
    <Link
      href="/deudas"
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-white/6 p-4 transition-colors",
        isCheap
          ? "bg-z-income/10 hover:bg-z-income/15"
          : "bg-z-surface-2/80 hover:bg-z-surface-3",
        className,
      )}
    >
      <Icon
        className={cn(
          "size-5 shrink-0",
          isCheap ? "text-z-income" : isExpensive ? "text-z-expense" : "text-z-sage-dark",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium tabular-nums", isCheap ? "text-z-income" : "text-z-white")}>
          {title}
        </p>
        <p className="mt-0.5 text-xs tabular-nums text-z-sage-dark">{detail}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-z-sage-dark" aria-hidden="true" />
    </Link>
  );
}

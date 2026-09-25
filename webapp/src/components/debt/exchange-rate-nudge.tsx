import Link from "next/link";
import { ChevronRight, DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import { FX_TIMING_THRESHOLD_PCT } from "@/lib/debt/usd-debt-insights";
import type { CurrencyCode } from "@/types/domain";

interface Props {
  rate: number;
  avg30d: number | null;
  percentVsAvg: number | null;
  from: CurrencyCode;
  to: CurrencyCode;
}

/** /deudas rate line — links to the /deudas/dolares timing page. */
export function ExchangeRateNudge({ rate, avg30d, percentVsAvg, from, to }: Props) {
  const formattedRate = formatCurrency(rate, to);
  const isCheap = percentVsAvg !== null && percentVsAvg <= -FX_TIMING_THRESHOLD_PCT;
  const isExpensive = percentVsAvg !== null && percentVsAvg >= FX_TIMING_THRESHOLD_PCT;

  if (isCheap) {
    return (
      <Link href="/deudas/dolares" className="block">
        <Card style={{
          borderColor: "color-mix(in srgb, var(--z-income) 30%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--z-income) 10%, transparent)",
        }}>
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <TrendingDown className="h-5 w-5 text-z-income shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium tabular-nums text-z-income">
                  1 {from} = {formattedRate} — {Math.abs(percentVsAvg!).toFixed(1)}% más barato que el promedio
                </p>
                <p className="text-xs tabular-nums text-muted-foreground mt-1">
                  Buen momento para pagar tus deudas en {from}. Promedio 30 días: {formatCurrency(avg30d!, to)}.
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 self-center text-z-sage-dark" aria-hidden="true" />
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  const Icon = isExpensive ? TrendingUp : DollarSign;
  return (
    <Link
      href="/deudas/dolares"
      className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground hover:text-z-white"
    >
      <Icon className={isExpensive ? "h-3.5 w-3.5 text-z-expense" : "h-3.5 w-3.5"} />
      <span>
        {from} hoy: {formattedRate}
        {isExpensive ? ` · ${percentVsAvg!.toFixed(1)}% sobre el promedio` : ""}
      </span>
      <ChevronRight className="size-3.5" aria-hidden="true" />
    </Link>
  );
}

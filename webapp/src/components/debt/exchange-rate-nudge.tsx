import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

interface Props {
  rate: number;
  avg30d: number | null;
  percentVsAvg: number | null;
  from: CurrencyCode;
  to: CurrencyCode;
}

export function ExchangeRateNudge({ rate, avg30d, percentVsAvg, from, to }: Props) {
  const formattedRate = formatCurrency(rate, to);
  const isCheap = percentVsAvg !== null && percentVsAvg < -2;

  // Don't show when expensive (>2% above average)
  if (percentVsAvg !== null && percentVsAvg > 2) {
    return null;
  }

  if (isCheap) {
    return (
      <Card style={{
        borderColor: "color-mix(in srgb, var(--z-income) 30%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--z-income) 10%, transparent)",
      }}>
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <TrendingDown className="h-5 w-5 text-z-income shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-z-income">
                1 {from} = {formattedRate} — {Math.abs(percentVsAvg!).toFixed(1)}% mas barato que tu promedio
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Buen momento para pagar tus deudas en {from}. Promedio 30 dias: {formatCurrency(avg30d!, to)}.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Neutral — just show the rate
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <DollarSign className="h-3.5 w-3.5" />
      <span>{from} hoy: {formattedRate}</span>
    </div>
  );
}

import { TrendingDown, CreditCard, Calendar, Unlock } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { ImpactEvent, CurrencyCode } from "@/types/domain";

interface MetricLine {
  icon: React.ElementType;
  text: string;
}

function buildMetricLines(event: ImpactEvent): MetricLine[] {
  const lines: MetricLine[] = [];
  const { metrics } = event;
  const currency = event.currencyCode as CurrencyCode;

  // Utilization change
  if (metrics.utilizationBefore != null && metrics.utilizationAfter != null) {
    lines.push({
      icon: CreditCard,
      text: `Uso de cupo: ${metrics.utilizationBefore}% → ${metrics.utilizationAfter}%`,
    });
  }

  // Interest reduction
  if (metrics.monthlyInterestBefore != null && metrics.monthlyInterestAfter != null) {
    const saved = metrics.monthlyInterestBefore - metrics.monthlyInterestAfter;
    lines.push({
      icon: TrendingDown,
      text: `Interés mensual: -${formatCurrency(saved, currency)}/mes`,
    });
  }

  // Months to freedom
  if (metrics.monthsToFreedomBefore != null && metrics.monthsToFreedomAfter != null) {
    const monthsSaved = metrics.monthsToFreedomBefore - metrics.monthsToFreedomAfter;
    if (monthsSaved > 0) {
      lines.push({
        icon: Calendar,
        text: `Libre de deuda: ${monthsSaved} ${monthsSaved === 1 ? "mes" : "meses"} antes`,
      });
    }
  }

  // Available credit gained
  if (metrics.availableCreditBefore != null && metrics.availableCreditAfter != null) {
    const gained = metrics.availableCreditAfter - metrics.availableCreditBefore;
    if (gained > 0) {
      lines.push({
        icon: Unlock,
        text: `+${formatCurrency(gained, currency)} de cupo disponible`,
      });
    }
  }

  return lines;
}

interface ImpactEventCardProps {
  event: ImpactEvent;
  compact?: boolean;
}

export function ImpactEventCard({ event, compact = false }: ImpactEventCardProps) {
  const lines = buildMetricLines(event);
  if (lines.length === 0) return null;

  const currency = event.currencyCode as CurrencyCode;
  const displayLines = compact ? lines.slice(0, 2) : lines;

  if (compact) {
    return (
      <div className="rounded-lg border border-z-income/20 bg-z-income/5 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{event.accountName}</span>
          <span className="text-xs text-muted-foreground">{formatDate(event.date, "dd MMM")}</span>
        </div>
        <div className="text-sm font-semibold text-z-income">
          -{formatCurrency(event.amountPaid, currency)}
        </div>
        <div className="space-y-1">
          {displayLines.map((line, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <line.icon className="h-3 w-3 shrink-0" />
              <span>{line.text}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-z-income/20 bg-z-income/5 p-4 space-y-3">
      <div className="space-y-1">
        <span className="text-xs font-medium uppercase tracking-wide text-z-income">
          Buen movimiento
        </span>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{event.accountName}</span>
          <span className="text-xs text-muted-foreground">{formatDate(event.date)}</span>
        </div>
      </div>
      <div className="text-lg font-bold text-z-income">
        -{formatCurrency(event.amountPaid, currency)}
      </div>
      <div className="space-y-1.5">
        {displayLines.map((line, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
            <line.icon className="h-4 w-4 shrink-0 text-z-income/70" />
            <span>{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

import Link from "next/link";
import { ArrowRight, CalendarClock, Repeat2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { CurrencyCode } from "@/types/domain";
import type { PlanRecurringSummary } from "@/types/plan";

interface PlanRecurringSectionProps {
  recurring: PlanRecurringSummary;
  currency: CurrencyCode;
}

export function PlanRecurringSection({
  recurring,
  currency,
}: PlanRecurringSectionProps) {
  return (
    <Card className="border-white/6 bg-card/90">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          <Repeat2 className="size-4" />
          Cadencia futura
        </div>
        <CardTitle className="text-xl">Lo que ya viene en camino y no deberías olvidar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/6 bg-z-surface-2/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              Fijos mensuales
            </p>
            <p className="mt-3 text-2xl font-semibold">
              {formatCurrency(recurring.totalMonthlyExpenses, currency)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/6 bg-z-surface-2/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              Próximos eventos
            </p>
            <p className="mt-3 text-2xl font-semibold">{recurring.dueSoonCount}</p>
          </div>
          <div className="rounded-2xl border border-white/6 bg-z-surface-2/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              Plantillas activas
            </p>
            <p className="mt-3 text-2xl font-semibold">{recurring.activeCount}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarClock className="size-4 text-z-brass" />
            Próximas obligaciones
          </div>

          {recurring.upcoming.length > 0 ? (
            <div className="space-y-2">
              {recurring.upcoming.slice(0, 4).map((entry) => (
                <div
                  key={`${entry.template.id}-${entry.next_date}`}
                  className="flex items-center justify-between rounded-2xl border border-white/6 bg-z-surface-2/30 px-4 py-3"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{entry.template.merchant_name ?? "Recurrente"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(entry.next_date, "dd MMM")} · {entry.template.account.name}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatCurrency(entry.template.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/6 bg-z-surface-2/30 px-4 py-4 text-sm text-muted-foreground">
              No hay obligaciones próximas registradas en la moneda activa.
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild className="bg-z-brass text-z-ink hover:bg-z-brass/90">
            <Link href="/recurrentes">
              Ver recurrentes
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-white/8 bg-black/10 text-z-sage-light hover:bg-white/5 hover:text-z-sage-light"
          >
            <Link href="/recurrentes">Ajustar timeline</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

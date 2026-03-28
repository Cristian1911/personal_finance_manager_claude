import Link from "next/link";
import { ArrowRight, CalendarClock, Repeat2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { CurrencyCode } from "@/types/domain";
import type { PlanRecurringSummary } from "@/types/plan";
import { PlanStatCard, BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "./plan-stat-card";

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
          <PlanStatCard
            label="Fijos mensuales"
            value={formatCurrency(recurring.totalMonthlyExpenses, currency)}
          />
          <PlanStatCard
            label="Próximos eventos"
            value={recurring.dueSoonCount}
          />
          <PlanStatCard
            label="Plantillas activas"
            value={recurring.activeCount}
          />
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
          <Button asChild className={BRASS_BUTTON_CLASS}>
            <Link href="/recurrentes">
              Ver recurrentes
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className={GHOST_BUTTON_CLASS}
          >
            <Link href="/recurrentes">Ver todas</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

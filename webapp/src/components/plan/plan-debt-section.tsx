import Link from "next/link";
import { ArrowRight, Landmark, Percent, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import { formatMonthLabel, parseMonth } from "@/lib/utils/date";
import type { CurrencyCode } from "@/types/domain";
import type { PlanDebtSummary } from "@/types/plan";

interface PlanDebtSectionProps {
  debt: PlanDebtSummary;
  currency: CurrencyCode;
}

export function PlanDebtSection({ debt, currency }: PlanDebtSectionProps) {
  const projectedLabel = debt.countdown ? formatMonthLabel(parseMonth(debt.countdown.projectedDate)) : null;

  return (
    <Card className="border-white/6 bg-card/90">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          <Landmark className="size-4" />
          Deuda
        </div>
        <CardTitle className="text-xl">La presión financiera que define la velocidad del plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/6 bg-z-surface-2/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              Deuda total
            </p>
            <p className="mt-3 text-2xl font-semibold">{formatCurrency(debt.overview.totalDebt, currency)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {debt.activeDebtCount > 0 ? `${debt.activeDebtCount} cuentas activas siguen en juego` : "No hay deuda activa"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/6 bg-z-surface-2/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              Interés estimado mensual
            </p>
            <p className="mt-3 text-2xl font-semibold">{formatCurrency(debt.overview.monthlyInterestEstimate, currency)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Costo aproximado por seguir en la misma trayectoria
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/6 bg-z-surface-2/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Percent className="size-4 text-z-brass" />
              Utilización total
            </div>
            <p className="mt-3 text-2xl font-semibold">{Math.round(debt.overview.overallUtilization)}%</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Basada en tarjetas de crédito de la moneda activa
            </p>
          </div>

          <div className="rounded-2xl border border-white/6 bg-z-surface-2/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldAlert className="size-4 text-z-brass" />
              Mayor presión
            </div>
            <p className="mt-3 text-lg font-semibold">
              {debt.highestInterestAccountName ?? "Sin cuenta dominante"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              La cuenta con mayor costo relativo para priorizar en el plan
            </p>
          </div>
        </div>

        {debt.countdown ? (
          <div className="rounded-2xl border border-z-brass/20 bg-z-brass/10 p-4">
            <p className="text-sm font-medium text-foreground">
              Si mantienes la trayectoria actual, podrías salir en {projectedLabel}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {debt.countdown.extraPaymentScenario
                ? `Un aporte extra de ${formatCurrency(debt.countdown.extraPaymentScenario.extraAmount, currency)} podría ahorrarte ${debt.countdown.extraPaymentScenario.monthsSaved} ${debt.countdown.extraPaymentScenario.monthsSaved === 1 ? "mes" : "meses"}.`
                : "No hay aún un escenario extra calculado para acelerar el payoff."}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button asChild className="bg-z-brass text-z-ink hover:bg-z-brass/90">
            <Link href="/deudas/planificador">
              Abrir planificador
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-white/8 bg-black/10 text-z-sage-light hover:bg-white/5 hover:text-z-sage-light"
          >
            <Link href="/deudas">Ver detalle de deuda</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

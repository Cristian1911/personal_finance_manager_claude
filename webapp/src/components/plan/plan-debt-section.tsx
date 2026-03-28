import Link from "next/link";
import { ArrowRight, Landmark, Percent, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import { formatMonthLabel, parseMonth } from "@/lib/utils/date";
import type { CurrencyCode } from "@/types/domain";
import type { PlanDebtSummary } from "@/types/plan";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { PlanStatCard } from "./plan-stat-card";

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
          <PlanStatCard
            label="Deuda total"
            value={formatCurrency(debt.overview.totalDebt, currency)}
            description={debt.activeDebtCount > 0 ? `${debt.activeDebtCount} cuentas activas siguen en juego` : "No hay deuda activa"}
          />
          <PlanStatCard
            label="Interés estimado mensual"
            value={formatCurrency(debt.overview.monthlyInterestEstimate, currency)}
            description="Costo aproximado por seguir en la misma trayectoria"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <PlanStatCard
            variant="secondary"
            label={
              <div className="flex items-center gap-2 text-sm font-medium">
                <Percent className="size-4 text-z-brass" />
                Utilización total
              </div>
            }
            value={<>{Math.round(debt.overview.overallUtilization)}%</>}
            description="Basada en tarjetas de crédito de la moneda activa"
          />
          <PlanStatCard
            variant="secondary"
            label={
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldAlert className="size-4 text-z-brass" />
                Mayor presión
              </div>
            }
            value={
              <span className="text-lg">
                {debt.highestInterestAccountName ?? "Sin cuenta dominante"}
              </span>
            }
            description="La cuenta con mayor costo relativo para priorizar en el plan"
          />
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
          <Button asChild className={BRASS_BUTTON_CLASS}>
            <Link href="/deudas/planificador">
              Abrir planificador
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className={GHOST_BUTTON_CLASS}
          >
            <Link href="/deudas">Ver detalle de deuda</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

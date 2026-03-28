import Link from "next/link";
import { ArrowRight, Landmark, PiggyBank } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";
import type { AllocationData } from "@/actions/allocation";
import type { DebtCountdownData } from "@/actions/debt-countdown";
import { PlanStatCard, BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/components/plan/plan-stat-card";

export function PlanTeaserCard({
  allocationData,
  debtCountdownData,
  currency,
  monthLabel,
  variant = "desktop",
}: {
  allocationData: AllocationData | null;
  debtCountdownData: DebtCountdownData | null;
  currency: CurrencyCode;
  monthLabel: string;
  variant?: "desktop" | "mobile";
}) {
  const spentPercent = allocationData
    ? Math.round(allocationData.needs.percent + allocationData.wants.percent)
    : null;
  const budgetLabel =
    spentPercent == null
      ? "Sin base suficiente"
      : spentPercent > 100
        ? "Fuera de margen"
        : spentPercent >= 90
          ? "Muy justo"
          : "Con margen";
  const debtLabel = debtCountdownData
    ? `${debtCountdownData.monthsToFree} ${debtCountdownData.monthsToFree === 1 ? "mes" : "meses"}`
    : "Sin deuda activa";

  return (
    <Card className="border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <CardHeader className={variant === "mobile" ? "space-y-2 pb-3" : "space-y-2"}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Plan del mes
        </p>
        <CardTitle className={variant === "mobile" ? "text-lg" : "text-xl"}>
          La parte estratégica vive ahora en un solo lugar
        </CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          {monthLabel} reúne presupuesto, obligaciones y deuda para decidir antes de bajar a detalle.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`grid gap-3 ${variant === "mobile" ? "grid-cols-1" : "sm:grid-cols-2"}`}>
          <PlanStatCard
            className="bg-black/10"
            label={
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                <PiggyBank className="size-4" />
                Presupuesto
              </div>
            }
            value={<span className="text-xl">{budgetLabel}</span>}
            description={
              spentPercent == null
                ? "Aún no hay base suficiente para calcular el ritmo del mes."
                : `${spentPercent}% del ingreso ya está comprometido entre necesidades y deseos.`
            }
          />

          <PlanStatCard
            className="bg-black/10"
            label={
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                <Landmark className="size-4" />
                Deuda
              </div>
            }
            value={<span className="text-xl">{debtLabel}</span>}
            description={
              debtCountdownData
                ? `La proyección actual usa ${formatCurrency(debtCountdownData.totalDebt, currency)} como saldo pendiente.`
                : "Sin una presión de deuda que domine el plan actual."
            }
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild className={BRASS_BUTTON_CLASS}>
            <Link href="/plan">
              Abrir Plan
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className={GHOST_BUTTON_CLASS}
          >
            <Link href="/categories">
              {allocationData ? "Ajustar presupuesto" : "Ver detalle"}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

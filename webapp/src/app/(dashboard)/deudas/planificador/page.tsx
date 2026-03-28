import { connection } from "next/server";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Landmark, Sparkles } from "lucide-react";
import { getDebtOverview } from "@/actions/debt";
import { getEstimatedIncome } from "@/actions/income";
import { getPreferredCurrency } from "@/actions/profile";
import { getScenarios } from "@/actions/scenarios";
import { ScenarioPlanner } from "@/components/debt/scenario-planner";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { PageHero, HeroAccentPill } from "@/components/ui/page-hero";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";

export default async function PlanificadorPage() {
  await connection();
  const currency = await getPreferredCurrency();
  const [overview, savedScenarios, incomeEstimate] = await Promise.all([
    getDebtOverview(currency),
    getScenarios(),
    getEstimatedIncome(currency),
  ]);
  const activeDebts = overview.accounts.filter((a) => a.balance > 0);
  const totalDebt = activeDebts.reduce((sum, account) => sum + account.balance, 0);

  if (activeDebts.length === 0) {
    return (
      <div className="space-y-6 lg:space-y-8">
        <MobilePageHeader title="Planificador" backHref="/plan" />
        <PageHero
          variant="brass"
          pills={<>
            <Link
              href="/plan"
              className="inline-flex items-center gap-2 rounded-full border border-white/6 bg-black/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-light hover:bg-white/5"
            >
              <ArrowLeft className="size-3.5" />
              Volver a Plan
            </Link>
            <HeroAccentPill>Simulación</HeroAccentPill>
          </>}
          title="No hay deudas activas para planificar"
          description="El planificador solo aporta cuando todavía hay saldo pendiente que ordenar. Por ahora, vuelve a la capa de deuda o al plan principal."
          actions={<>
            <Button asChild className={BRASS_BUTTON_CLASS}>
              <Link href="/deudas">
                Ver deuda
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className={GHOST_BUTTON_CLASS}
            >
              <Link href="/plan">Volver al plan</Link>
            </Button>
          </>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <MobilePageHeader title="Planificador" backHref="/plan" />

      <PageHero
        variant="brass"
        pills={<>
          <Link
            href="/plan"
            className="inline-flex items-center gap-2 rounded-full border border-white/6 bg-black/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-light hover:bg-white/5"
          >
            <ArrowLeft className="size-3.5" />
            Volver a Plan
          </Link>
          <HeroAccentPill>Simulación de deuda</HeroAccentPill>
        </>}
        title="Prueba escenarios antes de comprometer el próximo paso"
        description="Define efectivo extra, compara estrategias y aterriza una trayectoria de pago que puedas sostener sin perder claridad sobre el resto del plan."
        actions={<>
          <Button asChild className={BRASS_BUTTON_CLASS}>
            <Link href="/deudas">
              Ver deuda
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </>}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Deudas activas"
            value={activeDebts.length}
            description="Cuentas con saldo pendiente que aún requieren estrategia."
          />
          <StatCard
            label="Saldo total"
            value={formatCurrency(totalDebt, currency)}
            description="Magnitud actual de la presión financiera que estás simulando."
          />
          <StatCard
            label="Escenarios guardados"
            value={savedScenarios.length}
            description="Planes disponibles para comparar sin rehacer el trabajo."
          />
          <StatCard
            label={<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark"><Landmark className="size-4 text-z-brass" />Ingreso base</div>}
            value={incomeEstimate?.monthlyAverage
              ? formatCurrency(incomeEstimate.monthlyAverage, currency)
              : "Sin dato"}
            description="Referencia usada para evaluar cuánto margen real tienes para acelerar pagos."
          />
        </div>
      </PageHero>

      <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
              <Sparkles className="size-4 text-z-brass" />
            </div>
            <div className="space-y-1">
              <CardTitle>Constructor de escenarios</CardTitle>
              <p className="text-sm text-muted-foreground">
                Define efectivo, estrategia y comparación en una sola superficie.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScenarioPlanner
            accounts={activeDebts}
            currency={currency}
            savedScenarios={savedScenarios}
            income={incomeEstimate?.monthlyAverage}
          />
        </CardContent>
      </Card>
    </div>
  );
}

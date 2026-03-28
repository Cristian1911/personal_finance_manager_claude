import Link from "next/link";
import { ArrowRight, GitCompareArrows } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils/date";
import type { PlanScenarioSummary } from "@/types/plan";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { PlanStatCard } from "./plan-stat-card";

interface PlanScenarioPreviewProps {
  scenarios: PlanScenarioSummary;
}

export function PlanScenarioPreview({
  scenarios,
}: PlanScenarioPreviewProps) {
  return (
    <Card className="border-white/6 bg-card/90">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          <GitCompareArrows className="size-4" />
          Escenarios
        </div>
        <CardTitle className="text-xl">La parte experimental del plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <PlanStatCard
            label="Guardados"
            value={<span className="text-3xl">{scenarios.count}</span>}
            description="Planes listos para comparar"
          />

          <div className="rounded-2xl border border-white/6 bg-z-surface-2/30 p-4">
            {scenarios.latestScenario ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Último escenario guardado</p>
                <p className="text-lg font-semibold">{scenarios.latestScenario.name ?? "Escenario sin nombre"}</p>
                <p className="text-sm text-muted-foreground">
                  Actualizado {formatDate(scenarios.latestScenario.updated_at ?? scenarios.latestScenario.created_at)}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">Aún no hay simulaciones guardadas</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Cuando quieras probar otra velocidad de pago o más efectivo extra, esta es la herramienta para comparar trayectorias.
                </p>
              </div>
            )}
          </div>
        </div>

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
            <Link href="/deudas">Volver a deuda</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

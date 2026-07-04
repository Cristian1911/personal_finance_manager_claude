import Link from "next/link";
import { ArrowRight, Landmark, Receipt, TriangleAlert, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Verdict, type VerdictState } from "@/components/ui/verdict";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import type { IncomeEstimate } from "@/actions/income";
import type { CurrencyCode } from "@/types/domain";
import type { PlanHeroSummary } from "@/types/plan";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { PlanStatCard } from "./plan-stat-card";

interface PlanHeroProps {
  summary: PlanHeroSummary & { state?: VerdictState };
  currency: CurrencyCode;
  monthLabel: string;
  incomeEstimate: IncomeEstimate | null;
}

/** Fallback for summaries built before `state` existed (compatibility only). */
const PRESSURE_FALLBACK_STATE: Record<PlanHeroSummary["pressure"], VerdictState> = {
  stable: "vas-bien",
  watch: "atencion",
  critical: "te-pasaste",
};

export function PlanHero({
  summary,
  currency,
  monthLabel,
  incomeEstimate,
}: PlanHeroProps) {
  const state = summary.state ?? PRESSURE_FALLBACK_STATE[summary.pressure];

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/6 bg-[radial-gradient(circle_at_top_left,rgba(63,70,50,0.3),transparent_52%),linear-gradient(180deg,rgba(30,34,30,0.96),rgba(18,20,18,0.98))] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/6 bg-black/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-light">
            Plan del mes
          </span>
          <span className="rounded-full border border-white/6 px-3 py-1 text-[11px] font-medium capitalize text-muted-foreground">
            {monthLabel}
          </span>
        </div>

        {/* Hero slot — eyebrow → number → verdict → detail → meta */}
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              Margen actual
            </p>
            <p className={cn("mt-2 text-4xl font-bold tracking-tight md:text-5xl", summary.availableToSpend < 0 ? "text-z-debt" : "text-z-sage-light")}>
              {formatCurrency(summary.availableToSpend, currency)}
            </p>
            <Verdict className="mt-2" state={state} detail={summary.headline} />
          </div>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {summary.guidance}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild className={cn(BRASS_BUTTON_CLASS, "shadow-none")}>
            <Link href={summary.recommendedAction.href}>
              {summary.recommendedAction.label}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className={cn(GHOST_BUTTON_CLASS, "shadow-none")}
          >
            <Link href="/dashboard">Volver a Inicio</Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <PlanStatCard
            className="rounded-[18px] border-0 bg-black/15 ring-1 ring-white/5"
            label={
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                <Wallet className="size-4" />
                Ingreso base
              </div>
            }
            value={incomeEstimate ? formatCurrency(incomeEstimate.monthlyAverage, currency) : "Sin dato"}
            description={
              <span className="text-xs">
                {incomeEstimate
                  ? incomeEstimate.source === "profile"
                    ? "Tomado de tu perfil"
                    : incomeEstimate.source === "recurring"
                      ? "Basado en tus ingresos recurrentes"
                      : `Estimado con ${incomeEstimate.monthsOfData} ${incomeEstimate.monthsOfData === 1 ? "mes" : "meses"} de movimientos`
                  : "Configura o detecta ingresos para afinar el plan"}
              </span>
            }
          />

          <PlanStatCard
            className="rounded-[18px] border-0 bg-black/15 ring-1 ring-white/5"
            label={
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                <Receipt className="size-4" />
                Obligaciones cerca
              </div>
            }
            value={formatCurrency(summary.pendingTotal, currency)}
            description={
              <span className="text-xs">
                Lo que puede mover tu margen en el corto plazo
              </span>
            }
          />

          <PlanStatCard
            className="rounded-[18px] border-0 bg-black/15 ring-1 ring-white/5"
            label={
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                <Landmark className="size-4" />
                Deudas activas
              </div>
            }
            value={summary.activeDebtCount}
            description={
              <span className="text-xs">
                {summary.activeDebtCount > 0 ? "Cuentas que siguen afectando tu estrategia" : "No hay deuda activa presionando el plan"}
              </span>
            }
          />
        </div>

        {summary.pressure !== "stable" ? (
          <div className="flex items-start gap-3 rounded-2xl border border-z-brass/15 bg-black/10 px-4 py-3 text-sm text-muted-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-z-brass" />
            <p>
              Usa esta vista para decidir antes de entrar a detalle. Si aquí el plan se ve tenso, evita ir directo a métricas aisladas.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

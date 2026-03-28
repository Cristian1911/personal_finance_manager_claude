import Link from "next/link";
import { ArrowRight, Landmark, Receipt, TriangleAlert, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import type { IncomeEstimate } from "@/actions/income";
import type { CurrencyCode } from "@/types/domain";
import type { PlanHeroSummary } from "@/types/plan";

interface PlanHeroProps {
  summary: PlanHeroSummary;
  currency: CurrencyCode;
  monthLabel: string;
  incomeEstimate: IncomeEstimate | null;
}

const pressureStyles = {
  stable: {
    badge: "border-z-income/30 bg-z-income/10 text-z-income",
    label: "Estable",
  },
  watch: {
    badge: "border-z-alert/30 bg-z-alert/10 text-z-alert",
    label: "Atención",
  },
  critical: {
    badge: "border-z-debt/30 bg-z-debt/10 text-z-debt",
    label: "Crítico",
  },
} as const;

export function PlanHero({
  summary,
  currency,
  monthLabel,
  incomeEstimate,
}: PlanHeroProps) {
  const pressure = pressureStyles[summary.pressure];

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/6 bg-[radial-gradient(circle_at_top_left,rgba(63,70,50,0.3),transparent_52%),linear-gradient(180deg,rgba(30,34,30,0.96),rgba(18,20,18,0.98))] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/6 bg-black/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-light">
            Plan del mes
          </span>
          <span className={cn("rounded-full border px-3 py-1 text-[11px] font-medium", pressure.badge)}>
            {pressure.label}
          </span>
          <span className="rounded-full border border-white/6 px-3 py-1 text-[11px] font-medium capitalize text-muted-foreground">
            {monthLabel}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-z-sage-dark">
              Margen actual
            </p>
            <p className={cn("mt-2 text-4xl font-bold tracking-tight md:text-5xl", summary.availableToSpend < 0 ? "text-z-debt" : "text-z-sage-light")}>
              {formatCurrency(summary.availableToSpend, currency)}
            </p>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {summary.headline}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {summary.guidance}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild className="bg-z-brass text-z-ink shadow-none hover:bg-z-brass/90">
            <Link href={summary.recommendedAction.href}>
              {summary.recommendedAction.label}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-white/8 bg-black/10 text-z-sage-light shadow-none hover:bg-white/5 hover:text-z-sage-light"
          >
            <Link href="/dashboard">Volver a Inicio</Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[18px] bg-black/15 p-4 ring-1 ring-white/5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              <Wallet className="size-4" />
              Ingreso base
            </div>
            <p className="mt-3 text-2xl font-semibold">
              {incomeEstimate ? formatCurrency(incomeEstimate.monthlyAverage, currency) : "Sin dato"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {incomeEstimate
                ? incomeEstimate.source === "profile"
                  ? "Tomado de tu perfil"
                  : `Estimado con ${incomeEstimate.monthsOfData} ${incomeEstimate.monthsOfData === 1 ? "mes" : "meses"} de movimientos`
                : "Configura o detecta ingresos para afinar el plan"}
            </p>
          </div>

          <div className="rounded-[18px] bg-black/15 p-4 ring-1 ring-white/5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              <Receipt className="size-4" />
              Obligaciones cerca
            </div>
            <p className="mt-3 text-2xl font-semibold">
              {formatCurrency(summary.pendingTotal, currency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Lo que puede mover tu margen en el corto plazo
            </p>
          </div>

          <div className="rounded-[18px] bg-black/15 p-4 ring-1 ring-white/5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              <Landmark className="size-4" />
              Deudas activas
            </div>
            <p className="mt-3 text-2xl font-semibold">{summary.activeDebtCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.activeDebtCount > 0 ? "Cuentas que siguen afectando tu estrategia" : "No hay deuda activa presionando el plan"}
            </p>
          </div>
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

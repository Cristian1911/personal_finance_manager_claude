import Link from "next/link";
import { ArrowRight, BadgeAlert, CalendarClock, PiggyBank, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";
import type {
  PlanBudgetSummary,
  PlanDebtSummary,
  PlanRecurringSummary,
  PlanScenarioSummary,
} from "@/types/plan";

interface PlanDecisionRailProps {
  budget: PlanBudgetSummary;
  debt: PlanDebtSummary;
  recurring: PlanRecurringSummary;
  scenarios: PlanScenarioSummary;
  currency: CurrencyCode;
}

const modules = [
  {
    key: "budget",
    title: "Presupuesto",
    href: "/categories",
    icon: PiggyBank,
  },
  {
    key: "recurring",
    title: "Obligaciones",
    href: "/recurrentes",
    icon: CalendarClock,
  },
  {
    key: "debt",
    title: "Deuda",
    href: "/deudas",
    icon: BadgeAlert,
  },
  {
    key: "scenarios",
    title: "Escenarios",
    href: "/deudas/planificador",
    icon: Sparkles,
  },
] as const;

export function PlanDecisionRail({
  budget,
  debt,
  recurring,
  scenarios,
  currency,
}: PlanDecisionRailProps) {
  const content = {
    budget: {
      value:
        budget.overLimitCount > 0
          ? `${budget.overLimitCount} en alerta`
          : budget.nearLimitCount > 0
            ? `${budget.nearLimitCount} cerca del límite`
            : "Bajo control",
      detail:
        budget.uncategorizedCount > 0
          ? `${budget.uncategorizedCount} categorías sin clasificar bien`
          : `Gastado ${formatCurrency(budget.totalSpent, currency)}`,
    },
    recurring: {
      value:
        recurring.dueSoonCount > 0
          ? `${recurring.dueSoonCount} próximos`
          : "Sin presión inmediata",
      detail:
        recurring.dueSoonCount > 0
          ? `${formatCurrency(recurring.dueSoonTotal, currency)} por revisar`
          : "Tus obligaciones cercanas no están empujando el margen",
    },
    debt: {
      value:
        debt.activeDebtCount > 0
          ? `${debt.activeDebtCount} activas`
          : "Sin deuda activa",
      detail:
        debt.highestInterestAccountName
          ? `Mayor presión: ${debt.highestInterestAccountName}`
          : "No hay una cuenta dominando la estrategia",
    },
    scenarios: {
      value: scenarios.count > 0 ? `${scenarios.count} guardados` : "Sin escenarios",
      detail: scenarios.latestScenario?.name ?? "Aún no has guardado simulaciones",
    },
  } as const;

  return (
    <Card className="border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <CardHeader className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Siguiente decisión
        </p>
        <CardTitle className="text-xl leading-tight">
          Recorre el plan por módulos, no por páginas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {modules.map((module) => {
          const Icon = module.icon;
          const meta = content[module.key];
          return (
            <Link
              key={module.key}
              href={module.href}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/6 bg-black/10 px-4 py-4 transition-colors hover:bg-white/5"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-10 items-center justify-center rounded-xl bg-z-olive-deep/25 text-z-sage-light">
                  <Icon className="size-4" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium">{module.title}</p>
                  <p className="text-sm text-foreground">{meta.value}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{meta.detail}</p>
                </div>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

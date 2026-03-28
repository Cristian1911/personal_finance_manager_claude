import Link from "next/link";
import { ArrowRight, Inbox, PiggyBank } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";
import type { PlanBudgetSummary } from "@/types/plan";
import { PlanStatCard, BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "./plan-stat-card";

interface PlanBudgetSectionProps {
  budget: PlanBudgetSummary;
  currency: CurrencyCode;
}

function ProgressRow({
  label,
  amount,
  percent,
  currency,
  colorClass,
}: {
  label: string;
  amount: number;
  percent: number;
  currency: CurrencyCode;
  colorClass: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{Math.round(percent)}%</span>
      </div>
      <div className="h-2 rounded-full bg-z-surface-3">
        <div
          className={`h-2 rounded-full ${colorClass}`}
          style={{ width: `${Math.max(6, Math.min(percent, 100))}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{formatCurrency(amount, currency)} del ingreso del mes</p>
    </div>
  );
}

export function PlanBudgetSection({
  budget,
  currency,
}: PlanBudgetSectionProps) {
  return (
    <Card className="border-white/6 bg-card/90">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          <PiggyBank className="size-4" />
          Presupuesto
        </div>
        <CardTitle className="text-xl">La parte del plan que define tu margen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <PlanStatCard
            label="Presupuestado"
            value={formatCurrency(budget.totalBudgeted, currency)}
            description={`${budget.categories.length} categorías con seguimiento mensual`}
          />
          <PlanStatCard
            label="Ejecutado"
            value={formatCurrency(budget.totalSpent, currency)}
            description={
              budget.overLimitCount > 0
                ? `${budget.overLimitCount} categorías ya van por encima`
                : budget.nearLimitCount > 0
                  ? `${budget.nearLimitCount} categorías están cerca del límite`
                  : "Tus categorías no muestran alertas fuertes"
            }
          />
        </div>

        {budget.allocation ? (
          <div className="space-y-4 rounded-2xl border border-white/6 bg-z-surface-2/40 p-4">
            <p className="text-sm font-medium">Distribución actual 50/30/20</p>
            <div className="space-y-4">
              <ProgressRow
                label="Necesidades"
                amount={budget.allocation.needs.amount}
                percent={budget.allocation.needs.percent}
                currency={currency}
                colorClass="bg-z-olive-deep"
              />
              <ProgressRow
                label="Deseos"
                amount={budget.allocation.wants.amount}
                percent={budget.allocation.wants.percent}
                currency={currency}
                colorClass="bg-z-brass"
              />
              <ProgressRow
                label="Ahorro"
                amount={budget.allocation.savings.amount}
                percent={Math.abs(budget.allocation.savings.percent)}
                currency={currency}
                colorClass={budget.allocation.savings.amount >= 0 ? "bg-z-income" : "bg-z-debt"}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/8 p-4 text-sm text-muted-foreground">
            Aún no hay suficiente base para calcular la distribución 50/30/20 de este mes.
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Categorías que merecen revisión</p>
            <Link href="/categories" className="text-sm text-z-brass hover:underline">
              Ver presupuesto completo
            </Link>
          </div>

          {budget.attentionCategories.length > 0 ? (
            <div className="space-y-2">
              {budget.attentionCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between rounded-2xl border border-white/6 bg-z-surface-2/30 px-4 py-3"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{category.name_es ?? category.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(category.spent, currency)} de {formatCurrency(category.budget ?? 0, currency)}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold ${category.percentUsed > 100 ? "text-z-debt" : "text-z-alert"}`}>
                    {Math.round(category.percentUsed)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/6 bg-z-surface-2/30 px-4 py-4 text-sm text-muted-foreground">
              No hay categorías con presión relevante en este momento.
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild className={BRASS_BUTTON_CLASS}>
            <Link href="/categories">
              Ajustar presupuesto
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          {budget.uncategorizedCount > 0 ? (
            <Button
              asChild
              variant="outline"
              className={GHOST_BUTTON_CLASS}
            >
              <Link href="/categorizar">
                <Inbox className="size-4" />
                Resolver categorías pendientes
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

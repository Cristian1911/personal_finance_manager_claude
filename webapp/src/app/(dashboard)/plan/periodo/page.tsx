import { connection } from "next/server";
import { getActivePeriod } from "@/actions/cashflow-planner";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { getPreferredCurrency } from "@/actions/profile";
import { PeriodHeader } from "@/components/cashflow-planner/period-header";
import { EnvelopeBoard } from "@/components/cashflow-planner/envelope-board";
import { PeriodSetupDialog } from "@/components/cashflow-planner/period-setup-dialog";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { PAGE_STACK_CLASS } from "@/lib/constants/styles";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import Link from "next/link";

export default async function PeriodoPage() {
  await connection();

  const [periodResult, accountsResult, categoriesResult, currency] =
    await Promise.all([
      getActivePeriod(),
      getAccounts(),
      getCategories("OUTFLOW"),
      getPreferredCurrency(),
    ]);

  const planData = periodResult.success ? periodResult.data : null;
  const accounts = accountsResult.success
    ? accountsResult.data.map((a) => ({
        id: a.id,
        name: a.name,
        icon: a.icon,
        color: a.color,
      }))
    : [];
  const categories = categoriesResult.success
    ? categoriesResult.data.map((c) => ({
        id: c.id,
        name: c.name,
        name_es: c.name_es,
        icon: c.icon,
        color: c.color,
      }))
    : [];

  const isExpired = planData
    ? planData.period.end_date < new Date().toISOString().split("T")[0]
    : false;

  let suggestedStart: string | undefined;
  if (planData && isExpired) {
    const next = new Date(planData.period.end_date);
    next.setDate(next.getDate() + 1);
    suggestedStart = next.toISOString().split("T")[0];
  }

  return (
    <div className={PAGE_STACK_CLASS}>
      {/* Mobile header */}
      <MobileHeader
        variant="sub"
        title="Planear periodo"
        backHref="/plan"
        action={
          planData && !isExpired ? (
            <PeriodSetupDialog currency={currency} />
          ) : undefined
        }
      />

      {/* Desktop header */}
      <div className="hidden lg:flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/plan"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Plan
          </Link>
          <SectionEyebrow>Periodo</SectionEyebrow>
          <h1 className="text-3xl font-semibold tracking-tight">
            Planear tu dinero
          </h1>
          <p className="text-muted-foreground text-sm">
            Asigna cada gasto a un ingreso para saber de dónde sale cada peso
          </p>
        </div>
        {planData && !isExpired && (
          <PeriodSetupDialog currency={currency} />
        )}
      </div>

      {/* Expired period banner */}
      {planData && isExpired && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-amber-400">
              Tu periodo terminó
            </p>
            <p className="text-xs text-muted-foreground">
              Crea uno nuevo para seguir planeando tu dinero
            </p>
          </div>
          <PeriodSetupDialog
            currency={currency}
            suggestedStartDate={suggestedStart}
            trigger={
              <button className="flex items-center justify-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-400/20 w-full sm:w-auto">
                <CalendarPlus className="h-4 w-4" />
                Nuevo periodo
              </button>
            }
          />
        </div>
      )}

      {/* No active period */}
      {!planData && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-16 px-8 text-center space-y-4">
          <div className="rounded-full bg-card p-4">
            <CalendarPlus className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">No tienes un periodo activo</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Crea un periodo para planear tus ingresos y gastos, y asignar cada
              compromiso a un ingreso específico.
            </p>
          </div>
          <PeriodSetupDialog currency={currency} />
        </div>
      )}

      {planData && (
        <div className={isExpired ? "opacity-60" : undefined}>
          <PeriodHeader data={planData} isExpired={isExpired} />
          {!isExpired && (
            <EnvelopeBoard
              data={planData}
              accounts={accounts}
              categories={categories}
            />
          )}
        </div>
      )}
    </div>
  );
}

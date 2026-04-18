import { getActivePeriod } from "@/actions/cashflow-planner";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { getPreferredCurrency } from "@/actions/profile";
import { getPlanTimelineData } from "@/actions/plan-timeline";
import { PeriodHeader } from "@/components/cashflow-planner/period-header";
import { DragEnvelopeBoard } from "@/components/cashflow-planner/drag-envelope-board";
import { PeriodSetupDialog } from "@/components/cashflow-planner/period-setup-dialog";
import { MobilePeriodoView } from "@/components/mobile/v2/plan/mobile-periodo-view";
import { CalendarPlus } from "lucide-react";

export async function PlanTabPeriodo() {
  const [periodResult, accountsResult, categoriesResult, currency, timelineData] =
    await Promise.all([
      getActivePeriod(),
      getAccounts(),
      getCategories("OUTFLOW"),
      getPreferredCurrency(),
      getPlanTimelineData(),
    ]);

  const planData = periodResult.success ? periodResult.data : null;
  const accounts = accountsResult.success
    ? accountsResult.data.map((a) => ({
        id: a.id,
        name: a.name,
        icon: a.icon,
        color: a.color,
        account_type: a.account_type,
        current_balance: a.current_balance,
        currency_code: a.currency_code,
        mask: a.mask,
        bank_key: a.bank_key,
      }))
    : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];

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
    <>
      {/* ── Mobile view ── */}
      {planData && !isExpired && (
        <div className="lg:hidden pb-20">
          <MobilePeriodoView
            planData={planData}
            timelineData={timelineData}
            accounts={accounts}
            categories={categories}
          />
        </div>
      )}

      {/* ── Desktop view (+ mobile fallbacks for empty/expired states) ── */}
      <div className={planData && !isExpired ? "hidden lg:block" : undefined}>
        <div className="space-y-6">
          {/* Desktop header */}
          <div className="hidden lg:flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Planear tu dinero</h2>
              <p className="text-sm text-muted-foreground">
                Asigna cada gasto a un ingreso para saber de dónde sale cada peso
              </p>
            </div>
            {planData && !isExpired && (
              <PeriodSetupDialog currency={currency} />
            )}
          </div>

          {/* Mobile header */}
          <div className="lg:hidden flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Planear periodo</h2>
              <p className="text-xs text-muted-foreground">
                Asigna cada gasto a un ingreso
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
                <DragEnvelopeBoard
                  data={planData}
                  accounts={accounts}
                  categories={categories}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

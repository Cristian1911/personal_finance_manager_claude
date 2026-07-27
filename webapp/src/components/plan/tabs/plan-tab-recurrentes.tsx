import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getAccounts } from "@/actions/accounts";
import { getPreferredCurrency } from "@/actions/profile";
import { getAttentionSnapshot } from "@/actions/attention";
import {
  getRecurringTemplates,
  getRecurringSummary,
} from "@/actions/recurring-templates";
import { getOccurrencesForMonth } from "@/actions/occurrences";
import { RecurringFormDialog } from "@/components/recurring/recurring-form-dialog";
import { RecurringList } from "@/components/recurring/recurring-list";
import { RecurringTimelineView } from "@/components/recurring/recurring-timeline-view";
import { MobileRecurrentesView } from "@/components/mobile/v2/plan/mobile-recurrentes-view";
import { Button } from "@/components/ui/button";
import { GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { DesktopOnly } from "@/components/ui/responsive-render";
import { SummaryCard } from "@/components/ui/summary-card";
import { AttentionCard } from "@/components/ui/attention-card";
import { Verdict } from "@/components/ui/verdict";
import { getCategories } from "@/actions/categories";
import { formatCurrency } from "@/lib/utils/currency";
import { countOccurrences } from "@/lib/utils/occurrence-counts";
import type { CurrencyCode } from "@/types/domain";

interface PlanTabRecurrentesProps {
  month?: string;
}

export async function PlanTabRecurrentes({ month }: PlanTabRecurrentesProps = {}) {
  const [templatesResult, accountsResult, categoriesResult, summary, currency, attentionSnapshot, occurrencesResult] =
    await Promise.all([
      getRecurringTemplates(),
      getAccounts(),
      getCategories(),
      getRecurringSummary(),
      getPreferredCurrency(),
      getAttentionSnapshot(),
      getOccurrencesForMonth(month),
    ]);

  const templates = templatesResult.success ? templatesResult.data : [];
  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];
  const initialOccurrences = occurrencesResult.success ? occurrencesResult.data : undefined;

  // Same helper the mobile view uses, so the two headers can't drift apart.
  const todayStr = new Date().toISOString().split("T")[0];
  const counts = countOccurrences(initialOccurrences ?? [], todayStr);
  const { paid: paidCount, due: dueCount, overdue: overdueCount } = counts;

  // Overdue occurrences are a real attention item, but nothing was emitting
  // them into the snapshot — so the card rendered "Vas bien · Sin pendientes
  // por resolver" right beside the red overdue rows. Synthesize the signal.
  const snapshotSignals = attentionSnapshot.signals.filter(
    (s) => s.page === "recurrentes"
  );
  const recurrentesSignals =
    overdueCount > 0
      ? [
          {
            page: "recurrentes" as const,
            key: "recurrentes-overdue",
            count: overdueCount,
            label: overdueCount === 1 ? "pago vencido" : "pagos vencidos",
            priority: "action" as const,
            actionHref: "/plan?tab=recurrentes",
          },
          ...snapshotSignals,
        ]
      : snapshotSignals;
  const topSignal = recurrentesSignals[0];

  return (
    <div className="space-y-6">
      {/* Mobile — unified checklist + templates. The tab header comes from
          plan/page.tsx — don't render a second MobileHeader here. */}
      <div className="lg:hidden">
        <MobileRecurrentesView
          templates={templates}
          accounts={accounts}
          currency={currency as CurrencyCode}
          initialOccurrences={initialOccurrences}
        />
      </div>

      {/* Desktop */}
      <DesktopOnly>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Recurrentes</h2>
            <p className="text-sm text-muted-foreground">
              {summary.activeCount} plantillas activas
            </p>
            <Verdict
              className="mt-2"
              state={topSignal ? "atencion" : "vas-bien"}
              detail={
                // Progress stays in the detail either way — it's the one place
                // the "X de Y pagados" figure is shown on desktop.
                dueCount === 0
                  ? "Sin cobros programados este mes."
                  : topSignal
                    ? `${topSignal.count} ${topSignal.label} · ${paidCount} de ${dueCount} pagados este mes.`
                    : `${paidCount} de ${dueCount} pagados este mes.`
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className={GHOST_BUTTON_CLASS}>
              <Link href="/suscripciones">
                Suscripciones
                <ChevronRight className="size-4" />
              </Link>
            </Button>
            <RecurringFormDialog accounts={accounts} categories={categories} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SummaryCard
            metrics={[
              { label: "Plantillas activas", value: summary.activeCount, context: "rutinas recurrentes" },
              { label: "Salidas/mes", value: formatCurrency(summary.totalMonthlyExpenses, currency as CurrencyCode), context: "compromiso fijo" },
              { label: "Entradas/mes", value: formatCurrency(summary.totalMonthlyIncome, currency as CurrencyCode), context: "ingreso recurrente" },
            ]}
          />
          <AttentionCard signals={recurrentesSignals} />
        </div>

        <RecurringTimelineView templates={templates} accounts={accounts} />

        <RecurringList
          templates={templates}
          accounts={accounts}
          categories={categories}
        />
      </DesktopOnly>
    </div>
  );
}

import Link from "next/link";
import { getAccounts } from "@/actions/accounts";
import { getSubscriptions } from "@/actions/subscriptions";
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
import { SubscriptionSuggestions } from "@/components/subscriptions/subscription-suggestions";
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
  const [templatesResult, accountsResult, categoriesResult, summary, currency, attentionSnapshot, occurrencesResult, subscriptionsResult] =
    await Promise.all([
      getRecurringTemplates(),
      getAccounts(),
      getCategories(),
      getRecurringSummary(),
      getPreferredCurrency(),
      getAttentionSnapshot(),
      getOccurrencesForMonth(month),
      getSubscriptions(),
    ]);

  const templates = templatesResult.success ? templatesResult.data : [];
  // Suscripciones viven dentro de Recurrentes: sugerencias arriba de la lista,
  // chip en la plantilla vinculada. /suscripciones queda como página de gestión.
  const subscriptions = subscriptionsResult.success ? subscriptionsResult.data : [];
  const subscriptionSuggestions = subscriptions.filter((s) => s.status === "suggested");
  const subscriptionTemplateIds = subscriptions
    .filter((s) => s.status !== "suggested" && s.recurring_template_id)
    .map((s) => s.recurring_template_id as string);
  const hasTrackedSubscriptions = subscriptionTemplateIds.length > 0;
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
          subscriptionSuggestions={subscriptionSuggestions}
          subscriptionTemplateIds={subscriptionTemplateIds}
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
          <RecurringFormDialog accounts={accounts} categories={categories} />
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

        <SubscriptionSuggestions
          suggestions={subscriptionSuggestions}
          currency={currency as CurrencyCode}
        />

        <RecurringList
          templates={templates}
          accounts={accounts}
          categories={categories}
          subscriptionTemplateIds={subscriptionTemplateIds}
        />

        {hasTrackedSubscriptions && (
          <p className="text-right text-xs">
            <Link
              href="/suscripciones"
              className="font-semibold text-z-brass transition-colors hover:text-z-brass-hot"
            >
              Gestionar suscripciones
            </Link>
          </p>
        )}
      </DesktopOnly>
    </div>
  );
}

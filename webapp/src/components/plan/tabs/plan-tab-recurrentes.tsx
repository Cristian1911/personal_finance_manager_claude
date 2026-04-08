import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { getPreferredCurrency } from "@/actions/profile";
import { getAttentionSnapshot } from "@/actions/attention";
import {
  getRecurringTemplates,
  getRecurringSummary,
  getUpcomingRecurrences,
} from "@/actions/recurring-templates";
import { RecurringFormDialog } from "@/components/recurring/recurring-form-dialog";
import { RecurringList } from "@/components/recurring/recurring-list";
import { RecurringTimelineView } from "@/components/recurring/recurring-timeline-view";
import { MobileRecurrentesView } from "@/components/mobile/v2/plan/mobile-recurrentes-view";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { SummaryCard } from "@/components/ui/summary-card";
import { AttentionCard } from "@/components/ui/attention-card";
import { formatCurrency } from "@/lib/utils/currency";
import type { PlanRecurringSummary } from "@/types/plan";

export async function PlanTabRecurrentes() {
  const [templatesResult, accountsResult, categoriesResult, summary, currency, attentionSnapshot, upcomingRecurrences] =
    await Promise.all([
      getRecurringTemplates(),
      getAccounts(),
      getCategories(),
      getRecurringSummary(),
      getPreferredCurrency(),
      getAttentionSnapshot(),
      getUpcomingRecurrences(30),
    ]);

  const templates = templatesResult.success ? templatesResult.data : [];
  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];

  // Build PlanRecurringSummary for mobile view
  const dueSoon = upcomingRecurrences
    .filter((entry) =>
      entry.template.direction === "OUTFLOW" ||
      entry.template.account.account_type === "CREDIT_CARD" ||
      entry.template.account.account_type === "LOAN"
    )
    .slice(0, 6);
  const dueSoonTotal = dueSoon.reduce((sum, entry) => sum + entry.template.amount, 0);

  const recurringSummary: PlanRecurringSummary = {
    upcoming: dueSoon,
    totalMonthlyExpenses: summary.totalMonthlyExpenses,
    totalMonthlyIncome: summary.totalMonthlyIncome,
    activeCount: summary.activeCount,
    dueSoonCount: dueSoon.length,
    dueSoonTotal,
  };

  return (
    <div className="space-y-6">
      {/* Mobile view */}
      <div className="lg:hidden">
        <MobileHeader variant="sub" title="Recurrentes" backHref="/plan" />
        <MobileRecurrentesView summary={recurringSummary} currency={currency} />
      </div>

      {/* Desktop header */}
      <div className="hidden lg:flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Recurrentes</h2>
          <p className="text-sm text-muted-foreground">
            {summary.activeCount} plantillas activas
          </p>
        </div>
        <RecurringFormDialog accounts={accounts} categories={categories} />
      </div>

      {/* Desktop view */}
      <div className="hidden lg:block space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <SummaryCard
            metrics={[
              { label: "Plantillas activas", value: summary.activeCount, context: "rutinas recurrentes" },
              { label: "Salidas/mes", value: formatCurrency(summary.totalMonthlyExpenses, currency), context: "compromiso fijo" },
              { label: "Entradas/mes", value: formatCurrency(summary.totalMonthlyIncome, currency), context: "ingreso recurrente" },
            ]}
          />
          <AttentionCard
            signals={attentionSnapshot.signals.filter((s: { page: string }) => s.page === "recurrentes")}
          />
        </div>

        <RecurringTimelineView templates={templates} accounts={accounts} />

        <RecurringList
          templates={templates}
          accounts={accounts}
          categories={categories}
        />
      </div>
    </div>
  );
}

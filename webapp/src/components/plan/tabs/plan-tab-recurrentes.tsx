import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { getPreferredCurrency } from "@/actions/profile";
import { getAttentionSnapshot } from "@/actions/attention";
import {
  getRecurringTemplates,
  getRecurringSummary,
} from "@/actions/recurring-templates";
import { RecurringFormDialog } from "@/components/recurring/recurring-form-dialog";
import { RecurringList } from "@/components/recurring/recurring-list";
import { RecurringTimelineView } from "@/components/recurring/recurring-timeline-view";
import { SummaryCard } from "@/components/ui/summary-card";
import { AttentionCard } from "@/components/ui/attention-card";
import { formatCurrency } from "@/lib/utils/currency";

export async function PlanTabRecurrentes() {
  const [templatesResult, accountsResult, categoriesResult, summary, currency, attentionSnapshot] =
    await Promise.all([
      getRecurringTemplates(),
      getAccounts(),
      getCategories(),
      getRecurringSummary(),
      getPreferredCurrency(),
      getAttentionSnapshot(),
    ]);

  const templates = templatesResult.success ? templatesResult.data : [];
  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold hidden lg:block">Recurrentes</h2>
          <h2 className="text-lg font-semibold lg:hidden">Recurrentes</h2>
          <p className="text-sm text-muted-foreground">
            {summary.activeCount} plantillas activas
          </p>
        </div>
        <RecurringFormDialog accounts={accounts} categories={categories} />
      </div>

      <div className="hidden lg:grid gap-4 lg:grid-cols-2">
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
  );
}

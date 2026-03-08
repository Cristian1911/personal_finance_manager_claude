import { getRecurringTemplates } from "@/actions/recurring-templates";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { RecurringFormDialog } from "@/components/recurring/recurring-form-dialog";
import { RecurringList } from "@/components/recurring/recurring-list";
import { RecurringTimelineView } from "@/components/recurring/recurring-timeline-view";

export default async function RecurrentesPage() {
  const [templatesResult, accountsResult, categoriesResult] =
    await Promise.all([
      getRecurringTemplates(),
      getAccounts(),
      getCategories(),
    ]);

  const templates = templatesResult.success ? templatesResult.data : [];
  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Transacciones Recurrentes</h1>
        <RecurringFormDialog accounts={accounts} categories={categories} />
      </div>

      {/* Timeline-first layout: summary bar + mini calendar + pending timeline + completed */}
      <RecurringTimelineView templates={templates} accounts={accounts} />

      {/* Divider */}
      <hr className="border-border" />

      {/* Template management list */}
      <RecurringList
        templates={templates}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}

import { connection } from "next/server";
import { getRecurringTemplates } from "@/actions/recurring-templates";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { RecurringFormDialog } from "@/components/recurring/recurring-form-dialog";
import { RecurringList } from "@/components/recurring/recurring-list";
import { RecurringTimelineView } from "@/components/recurring/recurring-timeline-view";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function RecurrentesPage() {
  await connection();
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
      <MobilePageHeader title="Recurrentes" backHref="/plan" />

      {/* Header */}
      <div className="hidden lg:flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Detalle del plan
          </p>
          <h1 className="text-2xl font-bold">Transacciones recurrentes</h1>
          <p className="text-muted-foreground">
            La cadencia operativa que sostiene tu plan y anticipa presión futura.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/plan">Volver a Plan</Link>
          </Button>
          <RecurringFormDialog accounts={accounts} categories={categories} />
        </div>
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

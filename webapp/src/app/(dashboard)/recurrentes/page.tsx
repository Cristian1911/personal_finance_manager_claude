import { connection } from "next/server";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { getPreferredCurrency } from "@/actions/profile";
import { getAttentionSnapshot } from "@/actions/attention";
import {
  getRecurringTemplates,
  getRecurringSummary,
  getUpcomingRecurrences,
} from "@/actions/recurring-templates";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { RecurringFormDialog } from "@/components/recurring/recurring-form-dialog";
import { RecurringList } from "@/components/recurring/recurring-list";
import { RecurringTimelineView } from "@/components/recurring/recurring-timeline-view";
import { Button } from "@/components/ui/button";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { SummaryCard } from "@/components/ui/summary-card";
import { AttentionCard } from "@/components/ui/attention-card";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";

export default async function RecurrentesPage() {
  await connection();
  const [templatesResult, accountsResult, categoriesResult, summary, upcoming, currency, attentionSnapshot] =
    await Promise.all([
      getRecurringTemplates(),
      getAccounts(),
      getCategories(),
      getRecurringSummary(),
      getUpcomingRecurrences(14),
      getPreferredCurrency(),
      getAttentionSnapshot(),
    ]);

  const templates = templatesResult.success ? templatesResult.data : [];
  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];

  return (
    <div className="space-y-6 lg:space-y-8">
      <MobileHeader variant="sub" title="Recurrentes" backHref="/plan" />

      <PageHeaderRow
        title="Recurrentes"
        subtitle={`${summary.activeCount} plantillas activas`}
        actions={
          <>
            <Button asChild className={BRASS_BUTTON_CLASS}>
              <Link href="/plan">
                Volver a Plan
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <RecurringFormDialog accounts={accounts} categories={categories} />
          </>
        }
      />

      <div className="hidden lg:grid gap-4 lg:grid-cols-2">
        <SummaryCard
          metrics={[
            { label: "Plantillas activas", value: summary.activeCount, context: "rutinas recurrentes" },
            { label: "Salidas/mes", value: formatCurrency(summary.totalMonthlyExpenses, currency), context: "compromiso fijo" },
            { label: "Entradas/mes", value: formatCurrency(summary.totalMonthlyIncome, currency), context: "ingreso recurrente" },
          ]}
        />
        <AttentionCard
          signals={attentionSnapshot.signals.filter((s) => s.page === "recurrentes")}
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

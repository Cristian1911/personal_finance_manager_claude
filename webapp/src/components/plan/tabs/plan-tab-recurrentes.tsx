import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { getPreferredCurrency } from "@/actions/profile";
import { getAttentionSnapshot } from "@/actions/attention";
import {
  getRecurringTemplates,
  getRecurringSummary,
} from "@/actions/recurring-templates";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { RecurringFormDialog } from "@/components/recurring/recurring-form-dialog";
import { RecurringList } from "@/components/recurring/recurring-list";
import { RecurringTimelineView } from "@/components/recurring/recurring-timeline-view";
import { MobileRecurrentesView } from "@/components/mobile/v2/plan/mobile-recurrentes-view";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { DesktopOnly } from "@/components/ui/responsive-render";
import { SummaryCard } from "@/components/ui/summary-card";
import { AttentionCard } from "@/components/ui/attention-card";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

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
      {/* Mobile — checklist + link to manager */}
      <div className="lg:hidden">
        <MobileHeader variant="sub" title="Recurrentes" backHref="/plan" />
        {/* Link to template manager */}
        <div className="px-4 pb-3">
          <Link
            href="/recurrentes"
            className="flex items-center justify-between rounded-xl border border-z-brass/20 bg-z-brass/5 px-4 py-2.5"
          >
            <div>
              <p className="text-xs font-semibold text-z-brass">Administrar plantillas</p>
              <p className="text-[10px] text-muted-foreground">
                {summary.activeCount} activos · {formatCurrency(summary.totalMonthlyExpenses + summary.totalMonthlyIncome, currency as CurrencyCode)}/mes
              </p>
            </div>
            <ChevronRight className="size-4 text-z-brass/60" />
          </Link>
        </div>
        {/* Payment checklist */}
        <MobileRecurrentesView
          templates={templates}
          accounts={accounts}
          currency={currency as CurrencyCode}
        />
      </div>

      {/* Desktop — only mounted on desktop viewports */}
      <DesktopOnly>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Recurrentes</h2>
            <p className="text-sm text-muted-foreground">
              {summary.activeCount} plantillas activas
            </p>
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
      </DesktopOnly>
    </div>
  );
}

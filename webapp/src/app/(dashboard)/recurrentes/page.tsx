import { getRecurringTemplates, getRecurringSummary } from "@/actions/recurring-templates";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { RecurringFormDialog } from "@/components/recurring/recurring-form-dialog";
import { RecurringList } from "@/components/recurring/recurring-list";
import { RecurringCalendarChecklist } from "@/components/recurring/recurring-calendar-checklist";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import { ArrowUpRight, ArrowDownLeft, Repeat2 } from "lucide-react";

export default async function RecurrentesPage() {
  const [templatesResult, accountsResult, categoriesResult, summary] =
    await Promise.all([
      getRecurringTemplates(),
      getAccounts(),
      getCategories(),
      getRecurringSummary(),
    ]);

  const templates = templatesResult.success ? templatesResult.data : [];
  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transacciones Recurrentes</h1>
          <p className="text-muted-foreground">
            {summary.activeCount} recurrente{summary.activeCount !== 1 ? "s" : ""} activa{summary.activeCount !== 1 ? "s" : ""}
          </p>
        </div>
        <RecurringFormDialog accounts={accounts} categories={categories} />
      </div>

      {/* Summary cards */}
      {summary.activeCount > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <ArrowUpRight className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Gastos fijos mensuales
                  </p>
                  <p className="text-xl font-bold">
                    {formatCurrency(summary.totalMonthlyExpenses)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <ArrowDownLeft className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Ingresos fijos mensuales
                  </p>
                  <p className="text-xl font-bold">
                    {formatCurrency(summary.totalMonthlyIncome)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Repeat2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Recurrentes activas
                  </p>
                  <p className="text-xl font-bold">{summary.activeCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <RecurringCalendarChecklist templates={templates} accounts={accounts} />

      <RecurringList
        templates={templates}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}

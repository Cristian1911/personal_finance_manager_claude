import { connection } from "next/server";
import { Suspense } from "react";
import { getTransactions } from "@/actions/transactions";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { getAllTags } from "@/actions/tags";
import { getPendingEmailTransactions } from "@/actions/email-ingest";
import { Button } from "@/components/ui/button";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { SummaryCard } from "@/components/ui/summary-card";
import { AttentionCard } from "@/components/ui/attention-card";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { PendingEmailTransactions } from "@/components/transactions/pending-email-transactions";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import { QuickCaptureBar } from "@/components/transactions/quick-capture-bar";
import { Pagination } from "@/components/transactions/pagination";
import { MonthSelector } from "@/components/month-selector";
import { MobileMovimientos } from "@/components/mobile/mobile-movimientos";
import { parseMonth, formatMonthParam, formatMonthLabel } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/currency";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, Tags } from "lucide-react";

const PurchaseDecisionCard = dynamic(
  () => import("@/components/dashboard/purchase-decision-card").then((m) => ({ default: m.PurchaseDecisionCard })),
  { loading: () => <div className="h-64 rounded-xl bg-muted animate-pulse" /> }
);

function buildFiltersHref(params: Record<string, string | undefined>, keepMonthOnly = false) {
  const next = new URLSearchParams();
  if (params.month) {
    next.set("month", params.month);
  }

  if (!keepMonthOnly) {
    for (const [key, value] of Object.entries(params)) {
      if (!value || key === "month" || key === "page") continue;
      next.set(key, value);
    }
  }

  const query = next.toString();
  return query ? `/transactions?${query}` : "/transactions";
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await connection();
  const params = await searchParams;

  const [transactionsResult, accountsResult, categoriesResult, outflowCategoriesResult, allTags, pendingEmailResult] =
    await Promise.all([
      getTransactions(params),
      getAccounts(),
      getCategories(),
      getCategories("OUTFLOW"),
      getAllTags(),
      getPendingEmailTransactions(),
    ]);

  const pendingTransactions = pendingEmailResult.success ? pendingEmailResult.data : [];

  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];
  const outflowCategories = outflowCategoriesResult.success ? outflowCategoriesResult.data ?? [] : [];
  const month = params.month;
  const target = parseMonth(month);
  const defaultMonth = month ?? formatMonthParam(target);
  const monthLabel = formatMonthLabel(target);
  const activeFilterCount = [
    params.search,
    params.accountId,
    params.tagId,
    params.direction,
    params.dateFrom,
    params.dateTo,
    params.amountMin,
    params.amountMax,
    params.showExcluded === "true" ? "true" : undefined,
  ].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;
  const visibleTransactions = transactionsResult.data.filter((tx) => !tx.is_excluded);
  const summaryCurrency = (visibleTransactions[0]?.currency_code ?? "COP");
  const inflowVisible = visibleTransactions
    .filter((tx) => tx.direction === "INFLOW")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const outflowVisible = visibleTransactions
    .filter((tx) => tx.direction === "OUTFLOW")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const uncategorizedVisible = visibleTransactions.filter(
    (tx) => tx.direction === "OUTFLOW" && !tx.category_id
  ).length;
  const scopeLabel =
    transactionsResult.totalPages > 1
      ? "en esta página"
      : hasActiveFilters
        ? "en esta vista"
        : "visibles";
  const clearHref = buildFiltersHref(params, true);

  return (
    <div className="space-y-6">
      {/* Mobile: compact header + controls + date-grouped feed */}
      <div className="lg:hidden">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                Movimientos
              </p>
              <h1 className="text-2xl font-semibold">Movimientos</h1>
            </div>
            <div className="rounded-full border border-white/6 bg-z-surface-2 px-3 py-1 text-xs text-muted-foreground">
              {monthLabel}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/6 bg-black/10 px-4 py-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Vista actual</p>
              <p className="font-medium">
                {transactionsResult.count} movimientos {scopeLabel}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Suspense>
                <TransactionFilters accounts={accounts} tags={allTags} />
              </Suspense>
              <Suspense>
                <MonthSelector />
              </Suspense>
            </div>
          </div>
        </div>

        <PendingEmailTransactions transactions={pendingTransactions} accounts={accounts} />

        <MobileMovimientos
          transactions={transactionsResult.data}
          categories={categories}
        />
      </div>

      {/* Desktop: action-first layout with two-card zone */}
      <div className="hidden lg:block space-y-6">
        <PageHeaderRow
          title="Movimientos"
          subtitle={`${monthLabel} · ${transactionsResult.count} ${scopeLabel}`}
          actions={
            <>
              <Suspense>
                <MonthSelector />
              </Suspense>
              <TransactionFormDialog accounts={accounts} categories={categories} tags={allTags} />
            </>
          }
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <SummaryCard
            metrics={[
              { label: "Movimientos", value: transactionsResult.count, context: scopeLabel },
              { label: "Ingresos", value: formatCurrency(inflowVisible, summaryCurrency), context: "en la vista" },
              { label: "Gastos", value: formatCurrency(outflowVisible, summaryCurrency), context: "en la vista" },
            ]}
          />
          <AttentionCard
            signals={
              uncategorizedVisible > 0
                ? [{
                    page: "transactions",
                    key: "uncategorized_visible",
                    count: uncategorizedVisible,
                    label: "sin categoría en pantalla",
                    priority: "action" as const,
                    actionHref: "/categorizar",
                  }]
                : []
            }
          />
        </div>

        <Suspense>
          <TransactionFilters accounts={accounts} tags={allTags} />
        </Suspense>

        <QuickCaptureBar accounts={accounts} categories={categories} />

        <PurchaseDecisionCard
          accounts={accounts}
          categories={outflowCategories}
          defaultMonth={defaultMonth}
        />

        <PendingEmailTransactions transactions={pendingTransactions} accounts={accounts} />

        <TransactionTable transactions={transactionsResult.data} categories={categories} />

        <Suspense>
          <Pagination
            page={transactionsResult.page}
            totalPages={transactionsResult.totalPages}
            count={transactionsResult.count}
          />
        </Suspense>
      </div>
    </div>
  );
}

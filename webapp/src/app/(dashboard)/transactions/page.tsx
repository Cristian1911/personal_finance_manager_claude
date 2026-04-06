import { connection } from "next/server";
import { Suspense } from "react";
import { getTransactions } from "@/actions/transactions";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { getAllTags } from "@/actions/tags";
import { getPendingEmailTransactions } from "@/actions/email-ingest";
import { AttentionCard } from "@/components/ui/attention-card";
import { HeroAccentPill, HeroPill, PageHero } from "@/components/ui/page-hero";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { PendingEmailTransactions } from "@/components/transactions/pending-email-transactions";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import { QuickCaptureBar } from "@/components/transactions/quick-capture-bar";
import { Pagination } from "@/components/transactions/pagination";
import { MonthSelector } from "@/components/month-selector";
import { MovimientosRoot } from "@/components/mobile/v2/movimientos/movimientos-root";
import { parseMonth, formatMonthParam, formatMonthLabel } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/currency";
import dynamic from "next/dynamic";
import { PAGE_STACK_CLASS, PANEL_INSET_CLASS } from "@/lib/constants/styles";

const PurchaseDecisionCard = dynamic(
  () => import("@/components/dashboard/purchase-decision-card").then((m) => ({ default: m.PurchaseDecisionCard })),
  { loading: () => <div className="h-64 rounded-xl bg-muted animate-pulse" /> }
);

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
  const description = hasActiveFilters
    ? `Estás viendo ${transactionsResult.count} movimientos filtrados ${scopeLabel}. Úsalos para limpiar ruido y corregir criterio antes de que afecten presupuesto y plan.`
    : `${monthLabel} en una sola vista: ingresos, gastos y excepciones para leer rápido qué pasó antes de bajar al detalle.`;

  return (
    <div className={PAGE_STACK_CLASS}>
      <div className="lg:hidden">
        <MovimientosRoot
          transactions={transactionsResult.data}
          outflowCategories={outflowCategories}
          accounts={accounts}
          tags={allTags}
          count={transactionsResult.count}
          totalInflow={inflowVisible}
          totalOutflow={outflowVisible}
          uncategorizedCount={uncategorizedVisible}
          pendingEmails={pendingTransactions}
          currency={summaryCurrency}
        />
      </div>

      {/* Desktop: action-first layout with two-card zone */}
      <div className="hidden lg:block space-y-6">
        <PageHero
          pills={
            <>
              <HeroPill>Movimientos</HeroPill>
              {hasActiveFilters && (
                <HeroAccentPill>{activeFilterCount} filtros activos</HeroAccentPill>
              )}
              <HeroPill>{monthLabel}</HeroPill>
            </>
          }
          title="Movimientos"
          description={description}
          actions={
            <div className="flex flex-wrap gap-3">
              <Suspense>
                <MonthSelector />
              </Suspense>
              <TransactionFormDialog accounts={accounts} categories={categories} tags={allTags} />
            </div>
          }
        >
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
            <div className={`${PANEL_INSET_CLASS} p-4`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Vista</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{transactionsResult.count}</p>
              <p className="mt-1 text-xs text-muted-foreground">{scopeLabel}</p>
            </div>
            <div className={`${PANEL_INSET_CLASS} p-4`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ingresos</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-z-income">
                {formatCurrency(inflowVisible, summaryCurrency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">en la vista</p>
            </div>
            <div className={`${PANEL_INSET_CLASS} p-4`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Gastos</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-z-alert">
                {formatCurrency(outflowVisible, summaryCurrency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">en la vista</p>
            </div>
            <div className={`${PANEL_INSET_CLASS} p-4`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sin categoría</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {uncategorizedVisible}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {uncategorizedVisible > 0 ? "requieren criterio" : "todo limpio"}
              </p>
            </div>
          </div>
        </PageHero>

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

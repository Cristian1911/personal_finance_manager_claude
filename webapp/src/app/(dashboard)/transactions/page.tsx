import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Brain } from "lucide-react";
import { getTransactions, getMonthlyAggregates } from "@/actions/transactions";
import { getUncategorizedTransactions } from "@/actions/categorize";
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
import { getPreferredCurrency } from "@/actions/profile";
import { computeMonthlyAggregates,
  isDebtAccountType,
} from "@zeta/shared";
import { parseMonth, formatMonthLabel } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import {
  BRASS_BUTTON_CLASS,
  MOBILE_TAB_BAR_CLEARANCE_CLASS,
  PAGE_STACK_CLASS,
  PANEL_INSET_CLASS,
  PANEL_SURFACE_CLASS,
  SECTION_EYEBROW_CLASS,
} from "@/lib/constants/styles";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await connection();
  const params = await searchParams;

  // The hero labels every total with one currency, so that currency has to be
  // stable. Deriving it from the first visible row made the label flip as the
  // user paginated while the number stayed put.
  const summaryCurrency = await getPreferredCurrency();

  const [
    transactionsResult,
    accountsResult,
    categoriesResult,
    allTags,
    pendingEmailResult,
    monthlyAggregatesResult,
    uncategorizedTxs,
  ] = await Promise.all([
    getTransactions(params),
    getAccounts(),
    getCategories(),
    getAllTags(),
    getPendingEmailTransactions(),
    getMonthlyAggregates(params.month, params.accountId, summaryCurrency),
    getUncategorizedTransactions(),
  ]);

  const pendingTransactions = pendingEmailResult.success ? pendingEmailResult.data : [];

  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];
  const month = params.month;
  const target = parseMonth(month);
  const monthLabel = formatMonthLabel(target);
  const activeFilterCount = [
    params.search,
    params.accountId,
    params.categoryId,
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
  const debtAccountIds = new Set(
    accounts
      .filter((a) => isDebtAccountType(a.account_type))
      .map((a) => a.id)
  );
  // Filtered view totals, computed with the SAME helper and the same exclusions
  // as the month-scoped card, so toggling a filter changes the scope of the
  // numbers and never their meaning. Scoped to the labelled currency, and
  // personal-debt movements are balance moves, not income/expense.
  const viewAggregates = computeMonthlyAggregates(
    visibleTransactions.filter(
      (tx) => tx.currency_code === summaryCurrency && !tx.personal_debt_id,
    ),
    { debtAccountIds, withDaysByDate: false },
  );

  // Mobile LECTURA card ("Resumen del mes") is scoped to the full selected
  // month via `computeMonthlyAggregates`, not derived from the paginated
  // `transactionsResult.data`. This ensures the card agrees with the displayed
  // month label and matches mobile native by construction (same shared helper).
  const monthlyAggregates = monthlyAggregatesResult.success
    ? monthlyAggregatesResult.data
    : { count: 0, totalInflow: 0, totalOutflow: 0, uncategorizedCount: 0, daysByDate: [] };
  const scopeLabel = hasActiveFilters ? "en esta vista" : monthLabel.toLowerCase();

  // Unfiltered, the hero describes the whole month — the same scope as the
  // "Vista" count next to it and as the mobile LECTURA card. It used to sum
  // only the 20 rows of the current page while showing the full-month count
  // beside them, so a busy month showed a count of 340 next to totals covering
  // 20 movimientos. With filters on, the view sums are what the user asked for.
  const heroSource = hasActiveFilters ? viewAggregates : monthlyAggregates;
  const heroInflow = heroSource.totalInflow;
  const heroOutflow = heroSource.totalOutflow;
  const heroUncategorized = heroSource.uncategorizedCount;
  const description = hasActiveFilters
    ? `Estás viendo ${transactionsResult.count} movimientos filtrados ${scopeLabel}. Úsalos para limpiar ruido y corregir criterio antes de que afecten presupuesto y plan.`
    : `${monthLabel} en una sola vista: ingresos, gastos y excepciones para leer rápido qué pasó antes de bajar al detalle.`;

  return (
    <div className={PAGE_STACK_CLASS}>
      <div className={cn(MOBILE_TAB_BAR_CLEARANCE_CLASS, "lg:hidden lg:pb-0")}>
        <MovimientosRoot
          transactions={transactionsResult.data}
          page={transactionsResult.page}
          totalPages={transactionsResult.totalPages}
          filterParams={params}
          categories={categories}
          accounts={accounts}
          tags={allTags}
          count={monthlyAggregates.count}
          totalInflow={monthlyAggregates.totalInflow}
          totalOutflow={monthlyAggregates.totalOutflow}
          uncategorizedCount={monthlyAggregates.uncategorizedCount}
          uncategorizedTransactions={uncategorizedTxs.slice(0, 12)}
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
                {formatCurrency(heroInflow, summaryCurrency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{scopeLabel}</p>
            </div>
            <div className={`${PANEL_INSET_CLASS} p-4`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Gastos</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-z-alert">
                {formatCurrency(heroOutflow, summaryCurrency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{scopeLabel}</p>
            </div>
            <div className={`${PANEL_INSET_CLASS} p-4`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sin categoría</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {heroUncategorized}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {heroUncategorized > 0 ? "requieren criterio" : "todo limpio"}
              </p>
            </div>
          </div>
        </PageHero>

        <AttentionCard
          signals={
            heroUncategorized > 0
              ? [{
                  page: "transactions",
                  key: "uncategorized_visible",
                  count: heroUncategorized,
                  label: hasActiveFilters ? "sin categoría en pantalla" : "sin categoría este mes",
                  priority: "action" as const,
                  actionHref: "/categorizar",
                }]
              : []
          }
        />

        <Suspense>
          <TransactionFilters accounts={accounts} tags={allTags} categories={categories} />
        </Suspense>

        <QuickCaptureBar accounts={accounts} categories={categories} />

        <Link
          href="/puedo-pagar"
          className={cn(
            PANEL_SURFACE_CLASS,
            "flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-z-surface-2",
          )}
        >
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-z-brass/12 text-z-brass">
              <Brain className="size-5" strokeWidth={2} />
            </span>
            <div>
              <p className={SECTION_EYEBROW_CLASS}>Compra consciente</p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                ¿Debería comprar esto?
              </p>
              <p className="text-xs text-muted-foreground">
                Evalúa impacto en liquidez, deuda y presupuesto antes de
                decidir.
              </p>
            </div>
          </div>
          <span
            className={cn(
              BRASS_BUTTON_CLASS,
              "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold",
            )}
          >
            Analizar
            <ArrowRight className="size-4" />
          </span>
        </Link>

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

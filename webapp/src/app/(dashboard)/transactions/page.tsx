import { connection } from "next/server";
import { Suspense } from "react";
import { getTransactions } from "@/actions/transactions";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import { QuickCaptureBar } from "@/components/transactions/quick-capture-bar";
import { Pagination } from "@/components/transactions/pagination";
import { MonthSelector } from "@/components/month-selector";
import { MobileMovimientos } from "@/components/mobile/mobile-movimientos";
import { parseMonth, formatMonthParam } from "@/lib/utils/date";
import dynamic from "next/dynamic";

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

  const [transactionsResult, accountsResult, categoriesResult, outflowCategoriesResult] =
    await Promise.all([
      getTransactions(params),
      getAccounts(),
      getCategories(),
      getCategories("OUTFLOW"),
    ]);

  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];
  const outflowCategories = outflowCategoriesResult.success ? outflowCategoriesResult.data ?? [] : [];
  const month = params.month;
  const target = parseMonth(month);
  const defaultMonth = month ?? formatMonthParam(target);

  return (
    <div className="space-y-6">
      {/* Mobile: summary + date-grouped feed */}
      <div className="lg:hidden">
        <MobileMovimientos
          transactions={transactionsResult.data}
          categories={categories}
        />
      </div>

      {/* Desktop: full table with filters, quick capture, etc. */}
      <div className="hidden lg:block space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Transacciones</h1>
            <p className="text-muted-foreground">
              {transactionsResult.count} transacciones en total
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Suspense>
              <MonthSelector />
            </Suspense>
            <TransactionFormDialog accounts={accounts} categories={categories} />
          </div>
        </div>

        <Suspense>
          <TransactionFilters accounts={accounts} />
        </Suspense>

        <QuickCaptureBar accounts={accounts} categories={categories} />

        <PurchaseDecisionCard
          accounts={accounts}
          categories={outflowCategories}
          defaultMonth={defaultMonth}
        />

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

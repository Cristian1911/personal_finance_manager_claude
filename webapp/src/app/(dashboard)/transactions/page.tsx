import { Suspense } from "react";
import { getTransactions } from "@/actions/transactions";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { TransactionTable } from "@/components/transactions/transaction-table";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import { Pagination } from "@/components/transactions/pagination";
import { MonthSelector } from "@/components/month-selector";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const [transactionsResult, accountsResult, categoriesResult] =
    await Promise.all([
      getTransactions(params),
      getAccounts(),
      getCategories(),
    ]);

  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success
    ? categoriesResult.data.flatMap((c) => [c, ...c.children])
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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

      <TransactionTable transactions={transactionsResult.data} />

      <Suspense>
        <Pagination
          page={transactionsResult.page}
          totalPages={transactionsResult.totalPages}
          count={transactionsResult.count}
        />
      </Suspense>
    </div>
  );
}

import { notFound } from "next/navigation";
import { getTransaction, deleteTransaction } from "@/actions/transactions";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import { DeleteTransactionButton } from "@/components/transactions/delete-transaction-button";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight } from "lucide-react";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [txResult, accountsResult, categoriesResult] = await Promise.all([
    getTransaction(id),
    getAccounts(),
    getCategories(),
  ]);

  if (!txResult.success) notFound();

  const tx = txResult.data;
  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link
          href="/transactions"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {tx.merchant_name || tx.clean_description || "Transacción"}
          </h1>
          <p className="text-muted-foreground">
            {formatDate(tx.transaction_date, "dd MMMM yyyy")}
          </p>
        </div>
        <TransactionFormDialog
          transaction={tx}
          accounts={accounts}
          categories={categories}
        />
        <DeleteTransactionButton transactionId={tx.id} />
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {tx.direction === "INFLOW" ? (
                <ArrowDownLeft className="h-5 w-5 text-green-500" />
              ) : (
                <ArrowUpRight className="h-5 w-5 text-orange-500" />
              )}
              <Badge>{tx.direction === "INFLOW" ? "Ingreso" : "Gasto"}</Badge>
            </div>
            <span
              className={`text-3xl font-bold ${tx.direction === "INFLOW" ? "text-green-600" : ""}`}
            >
              {tx.direction === "INFLOW" ? "+" : "-"}
              {formatCurrency(tx.amount, tx.currency_code)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-muted-foreground">Estado</p>
              <Badge variant="secondary" className="mt-1">
                {tx.status === "POSTED"
                  ? "Confirmada"
                  : tx.status === "PENDING"
                    ? "Pendiente"
                    : "Cancelada"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fuente</p>
              <p className="text-sm font-medium mt-1">{tx.provider}</p>
            </div>
          </div>

          {tx.raw_description && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Descripción original
              </p>
              <p className="text-sm font-mono mt-1">{tx.raw_description}</p>
            </div>
          )}

          {tx.notes && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">Notas</p>
              <p className="text-sm mt-1">{tx.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

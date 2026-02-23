import { notFound } from "next/navigation";
import { getAccount } from "@/actions/accounts";
import { getStatementSnapshots } from "@/actions/statement-snapshots";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { DeleteAccountButton } from "@/components/accounts/delete-account-button";
import { StatementHistoryTimeline } from "@/components/accounts/statement-history-timeline";
import { formatCurrency } from "@/lib/utils/currency";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BalanceHistoryChart } from "@/components/charts/balance-history-chart";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: "Cuenta Corriente",
  SAVINGS: "Cuenta de Ahorros",
  CREDIT_CARD: "Tarjeta de Credito",
  CASH: "Efectivo",
  INVESTMENT: "Inversion",
  LOAN: "Prestamo",
  OTHER: "Otro",
};

const TYPES_WITH_HISTORY = ["CREDIT_CARD", "LOAN", "SAVINGS"];

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getAccount(id);

  if (!result.success) notFound();

  const account = result.data;

  const showHistory = TYPES_WITH_HISTORY.includes(account.account_type);
  const snapshotsResult = showHistory
    ? await getStatementSnapshots(account.id)
    : null;
  const snapshots =
    snapshotsResult?.success ? snapshotsResult.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/accounts"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{account.name}</h1>
          {account.institution_name && (
            <p className="text-muted-foreground">{account.institution_name}</p>
          )}
        </div>
        <AccountFormDialog account={account} />
        <DeleteAccountButton accountId={account.id} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Saldo actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(account.current_balance, account.currency_code)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Tipo de cuenta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">
              {ACCOUNT_TYPE_LABELS[account.account_type]}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Moneda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">{account.currency_code}</p>
          </CardContent>
        </Card>
      </div>

      {showHistory && (
        <div className="space-y-6">
          <BalanceHistoryChart snapshots={snapshots} currency={account.currency_code} />

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Historial de extractos</h2>
            <StatementHistoryTimeline
              snapshots={snapshots}
              currency={account.currency_code}
              accountType={account.account_type}
            />
          </div>
        </div>
      )}
    </div>
  );
}

import { getAccounts } from "@/actions/accounts";
import { AccountCard } from "@/components/accounts/account-card";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { formatCurrency } from "@/lib/utils/currency";

export default async function AccountsPage() {
  const result = await getAccounts();
  const accounts = result.success ? result.data : [];

  const totalBalance = accounts.reduce((sum, acc) => {
    if (acc.account_type === "CREDIT_CARD" || acc.account_type === "LOAN") {
      return sum - acc.current_balance;
    }
    return sum + acc.current_balance;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cuentas</h1>
          <p className="text-muted-foreground">
            Patrimonio neto: {formatCurrency(totalBalance)}
          </p>
        </div>
        <AccountFormDialog />
      </div>

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground mb-4">
            No tienes cuentas registradas
          </p>
          <AccountFormDialog />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  );
}

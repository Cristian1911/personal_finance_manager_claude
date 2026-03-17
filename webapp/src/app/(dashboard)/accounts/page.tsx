import { getAccounts } from "@/actions/accounts";
import { getPreferredCurrency } from "@/actions/profile";
import { AccountCard } from "@/components/accounts/account-card";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

export default async function AccountsPage() {
  const [result, currency] = await Promise.all([
    getAccounts(),
    getPreferredCurrency(),
  ]);
  const accounts = result.success ? result.data : [];

  // Net worth in preferred currency only
  const primaryAccounts = accounts.filter((a) => a.currency_code === currency);
  const totalBalance = primaryAccounts.reduce((sum, acc) => {
    if (acc.account_type === "CREDIT_CARD" || acc.account_type === "LOAN") {
      return sum - acc.current_balance;
    }
    return sum + acc.current_balance;
  }, 0);

  // Detect secondary currencies
  const secondaryCurrencies = new Map<string, number>();
  for (const acc of accounts) {
    if (acc.currency_code !== currency) {
      const prev = secondaryCurrencies.get(acc.currency_code) ?? 0;
      const val = (acc.account_type === "CREDIT_CARD" || acc.account_type === "LOAN")
        ? -acc.current_balance : acc.current_balance;
      secondaryCurrencies.set(acc.currency_code, prev + val);
    }
  }

  return (
    <div className="space-y-6">
      <MobilePageHeader title="Cuentas" backHref="/gestionar" />
      <div className="hidden lg:flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Cuentas</h1>
          <p className="text-muted-foreground">
            Patrimonio neto: {formatCurrency(totalBalance, currency)}
            {secondaryCurrencies.size > 0 && (
              <span className="ml-2 text-xs">
                {Array.from(secondaryCurrencies.entries())
                  .map(([cur, bal]) => `${formatCurrency(bal, cur as CurrencyCode)} ${cur}`)
                  .join(" · ")}
              </span>
            )}
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

import Link from "next/link";
import { getAccounts } from "@/actions/accounts";
import { AccountCard } from "@/components/accounts/account-card";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { ArrowRight } from "lucide-react";

export async function PlanAccountsSection() {
  const result = await getAccounts();
  const accounts = result.success ? result.data : [];

  if (accounts.length === 0) return null;

  const debtAccounts = accounts.filter(
    (a) => a.account_type === "CREDIT_CARD" || a.account_type === "LOAN"
  );
  const liquidAccounts = accounts.filter((a) =>
    ["CHECKING", "SAVINGS", "CASH", "INVESTMENT"].includes(a.account_type)
  );

  const allMinimal = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    account_type: a.account_type,
    currency_code: a.currency_code,
  }));

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionEyebrow>Mis cuentas</SectionEyebrow>
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1 text-xs font-medium text-z-brass hover:underline"
        >
          Ver todas
          <ArrowRight className="size-3" />
        </Link>
      </div>

      {liquidAccounts.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Liquidez y ahorro</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {liquidAccounts.map((account) => (
              <AccountCard key={account.id} account={account} allAccounts={allMinimal} />
            ))}
          </div>
        </div>
      )}

      {debtAccounts.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Deuda</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {debtAccounts.map((account) => (
              <AccountCard key={account.id} account={account} allAccounts={allMinimal} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

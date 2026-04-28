import { connection } from "next/server";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { getAccounts } from "@/actions/accounts";
import { getAttentionSnapshot } from "@/actions/attention";
import { getPreferredCurrency } from "@/actions/profile";
import { AccountCard } from "@/components/accounts/account-card";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { Button } from "@/components/ui/button";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { SummaryCard } from "@/components/ui/summary-card";
import { AttentionCard } from "@/components/ui/attention-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

export default async function AccountsPage() {
  await connection();
  const [result, currency, attentionSnapshot] = await Promise.all([
    getAccounts(),
    getPreferredCurrency(),
    getAttentionSnapshot(),
  ]);
  const accounts = result.success ? result.data : [];
  const debtAccounts = accounts.filter(
    (account) => account.account_type === "CREDIT_CARD" || account.account_type === "LOAN"
  );
  const liquidAccounts = accounts.filter((account) =>
    ["CHECKING", "SAVINGS", "CASH", "INVESTMENT"].includes(account.account_type)
  );
  const otherAccounts = accounts.filter((account) => account.account_type === "OTHER");
  const debtPressureCount = debtAccounts.filter((account) => account.current_balance > 0).length;

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

  const accountSections = [
    {
      key: "liquidez",
      title: "Liquidez y ahorro",
      accounts: liquidAccounts,
    },
    {
      key: "deuda",
      title: "Crédito y deuda",
      accounts: debtAccounts,
    },
    {
      key: "otras",
      title: "Otras cuentas",
      accounts: otherAccounts,
    },
  ].filter((section) => section.accounts.length > 0);

  return (
    <div className="space-y-6 lg:space-y-8">
      <MobileHeader variant="sub" title="Cuentas" backHref="/gestionar" />

      <PageHeaderRow
        title="Cuentas"
        subtitle={`${accounts.length} activas · ${formatCurrency(totalBalance, currency)} patrimonio`}
        actions={
          <>
            <Button asChild className={BRASS_BUTTON_CLASS}>
              <Link href="/import">
                Importar extracto
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <AccountFormDialog />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryCard
          label="Base financiera"
          metrics={[
            { label: "Patrimonio neto", value: formatCurrency(totalBalance, currency), context: `en ${currency}` },
            { label: "Cuentas activas", value: accounts.length, context: `${liquidAccounts.length} liquidez · ${debtAccounts.length} deuda` },
            { label: "Presión de deuda", value: debtPressureCount, context: "con saldo pendiente" },
          ]}
        />
        <AttentionCard signals={attentionSnapshot.signals} />
      </div>

      {secondaryCurrencies.size > 0 && (
        <div className="rounded-2xl border border-white/6 bg-z-surface-2/60 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-4 text-z-brass" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-z-white">Monedas secundarias</p>
              <p className="text-sm text-muted-foreground">
                {Array.from(secondaryCurrencies.entries())
                  .map(([cur, bal]) => `${formatCurrency(bal, cur as CurrencyCode)} ${cur}`)
                  .join(" · ")}
              </p>
            </div>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl">Todavía no hay cuentas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Crea cualquier cuenta a mano —tarjeta, app, efectivo— en segundos.
              Si tu banco aparece en la lista de soportados, también puedes importar un extracto.
            </p>
            <div className="flex flex-wrap gap-3">
              <AccountFormDialog
                triggerLabel="Crear cuenta manual"
                triggerClassName={BRASS_BUTTON_CLASS}
              />
              <Button
                asChild
                variant="outline"
                className={GHOST_BUTTON_CLASS}
              >
                <Link href="/import">Importar extracto</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {accountSections.map((section) => (
            <section key={section.key} className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {section.accounts.map((account) => (
                  <AccountCard key={account.id} account={account} allAccounts={accounts} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

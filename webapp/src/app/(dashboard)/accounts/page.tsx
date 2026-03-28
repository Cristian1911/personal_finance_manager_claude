import { connection } from "next/server";
import Link from "next/link";
import { ArrowRight, Landmark, Sparkles, WalletCards } from "lucide-react";
import { getAccounts } from "@/actions/accounts";
import { getPreferredCurrency } from "@/actions/profile";
import { AccountCard } from "@/components/accounts/account-card";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { Button } from "@/components/ui/button";
import { PageHero, HeroPill, HeroAccentPill } from "@/components/ui/page-hero";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

export default async function AccountsPage() {
  await connection();
  const [result, currency] = await Promise.all([
    getAccounts(),
    getPreferredCurrency(),
  ]);
  const accounts = result.success ? result.data : [];
  const debtAccounts = accounts.filter(
    (account) => account.account_type === "CREDIT_CARD" || account.account_type === "LOAN"
  );
  const liquidAccounts = accounts.filter((account) =>
    ["CHECKING", "SAVINGS", "CASH", "INVESTMENT"].includes(account.account_type)
  );
  const otherAccounts = accounts.filter((account) => account.account_type === "OTHER");
  const dashboardVisibleCount = accounts.filter((account) => account.show_in_dashboard).length;
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
      description: "Cuentas que sostienen tu día a día, tu colchón y tu base operativa.",
      accounts: liquidAccounts,
    },
    {
      key: "deuda",
      title: "Crédito y deuda",
      description: "Cuentas que hoy pueden presionar el patrimonio o el plan del mes.",
      accounts: debtAccounts,
    },
    {
      key: "otras",
      title: "Otras cuentas",
      description: "Vehículos auxiliares que no entran en los grupos principales.",
      accounts: otherAccounts,
    },
  ].filter((section) => section.accounts.length > 0);

  return (
    <div className="space-y-6 lg:space-y-8">
      <MobilePageHeader title="Cuentas" backHref="/gestionar" />

      <PageHero
        pills={<><HeroPill>Base financiera</HeroPill><HeroAccentPill>{accounts.length === 0 ? "Falta estructura" : "Control operativo"}</HeroAccentPill></>}
        title="Dónde vive tu dinero y qué está empujando tu patrimonio"
        description="Usa esta vista para mantener clara tu base: qué cuentas sostienen el día a día, cuáles entran en Inicio y qué líneas de crédito siguen afectando el plan."
        actions={<>
          <Button asChild className={BRASS_BUTTON_CLASS}>
            <Link href="/import">
              Importar extracto
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <AccountFormDialog />
        </>}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Patrimonio base"
            value={<span className="text-z-sage-light">{formatCurrency(totalBalance, currency)}</span>}
            description="Neto en tu moneda principal para decidir sin ruido extra."
          />
          <StatCard
            label="Cuentas activas"
            value={accounts.length}
            description={`${liquidAccounts.length} sostienen liquidez y ${debtAccounts.length} presionan deuda.`}
          />
          <StatCard
            label="Visibles en Inicio"
            value={dashboardVisibleCount}
            description="Las cuentas que alimentan la foto rápida del workspace principal."
          />
          <StatCard
            label="Presión de deuda"
            value={debtPressureCount}
            description="Tarjetas o préstamos con saldo pendiente que siguen tirando del plan."
          />
        </div>

        {secondaryCurrencies.size > 0 ? (
          <div className="rounded-2xl border border-white/6 bg-z-surface-2/60 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-4 text-z-brass" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-z-white">Monedas secundarias detectadas</p>
                <p className="text-sm text-muted-foreground">
                  {Array.from(secondaryCurrencies.entries())
                    .map(([cur, bal]) => `${formatCurrency(bal, cur as CurrencyCode)} ${cur}`)
                    .join(" · ")}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </PageHero>

      {accounts.length === 0 ? (
        <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <CardHeader className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              Primer paso
            </p>
            <CardTitle className="text-xl">Todavía no hay cuentas que sostengan la foto financiera</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Puedes crear la primera cuenta ahora o dejar que el flujo de importación te ayude a
              asociar el extracto correcto durante la revisión.
            </p>
            <div className="flex flex-wrap gap-3">
              <AccountFormDialog />
              <Button
                asChild
                variant="outline"
                className={GHOST_BUTTON_CLASS}
              >
                <Link href="/import">Importar y crear durante la revisión</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {accountSections.map((section) => (
            <section key={section.key} className="space-y-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                </div>
                {section.key === "deuda" ? (
                  <Link
                    href="/plan"
                    className="inline-flex items-center gap-2 text-sm font-medium text-z-brass hover:text-z-brass/85"
                  >
                    <Landmark className="size-4" />
                    Abrir Plan
                  </Link>
                ) : section.key === "liquidez" ? (
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 text-sm font-medium text-z-brass hover:text-z-brass/85"
                  >
                    <WalletCards className="size-4" />
                    Ver impacto en Inicio
                  </Link>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {section.accounts.map((account) => (
                  <AccountCard key={account.id} account={account} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

import { connection } from "next/server";
import Link from "next/link";
import { ArrowRight, Plus, Sparkles } from "lucide-react";
import { getAccounts } from "@/actions/accounts";
import { getPreferredCurrency } from "@/actions/profile";
import { AccountCard } from "@/components/accounts/account-card";
import { AccountFormDialog } from "@/components/accounts/account-form-dialog";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { Button } from "@/components/ui/button";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BRASS_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  PANEL_SURFACE_CLASS,
} from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { isDebtAccountType } from "@/lib/utils/account-balance";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils/currency";
import type { Account, CurrencyCode } from "@/types/domain";

export default async function AccountsPage() {
  await connection();
  const [result, currency] = await Promise.all([
    getAccounts(),
    getPreferredCurrency(),
  ]);
  const accounts = result.success ? result.data : [];
  const debtAccounts = accounts.filter((account) => isDebtAccountType(account.account_type));
  const liquidAccounts = accounts.filter((account) =>
    ["CHECKING", "SAVINGS", "CASH", "INVESTMENT"].includes(account.account_type)
  );
  const otherAccounts = accounts.filter((account) => account.account_type === "OTHER");
  const debtPressureCount = debtAccounts.filter((account) => account.current_balance > 0).length;

  // Net worth in preferred currency only
  const primaryAccounts = accounts.filter((a) => a.currency_code === currency);
  const totalBalance = primaryAccounts.reduce((sum, acc) => {
    if (isDebtAccountType(acc.account_type)) {
      return sum - acc.current_balance;
    }
    return sum + acc.current_balance;
  }, 0);

  // Detect secondary currencies
  const secondaryCurrencies = new Map<string, number>();
  for (const acc of accounts) {
    if (acc.currency_code !== currency) {
      const prev = secondaryCurrencies.get(acc.currency_code) ?? 0;
      const val = isDebtAccountType(acc.account_type)
        ? -acc.current_balance : acc.current_balance;
      secondaryCurrencies.set(acc.currency_code, prev + val);
    }
  }

  // Section subtotal in preferred currency (debt negative); null when the
  // section has no account in the preferred currency.
  const sectionSubtotal = (sectionAccounts: Account[]) => {
    const inCurrency = sectionAccounts.filter((a) => a.currency_code === currency);
    if (inCurrency.length === 0) return null;
    return inCurrency.reduce(
      (sum, a) =>
        isDebtAccountType(a.account_type) ? sum - a.current_balance : sum + a.current_balance,
      0
    );
  };

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
  ]
    .filter((section) => section.accounts.length > 0)
    .map((section) => ({ ...section, subtotal: sectionSubtotal(section.accounts) }));

  const debtJudgment =
    debtPressureCount > 0
      ? `${debtPressureCount} ${debtPressureCount === 1 ? "deuda" : "deudas"} con saldo`
      : `${accounts.length} ${accounts.length === 1 ? "cuenta activa" : "cuentas activas"}`;

  return (
    <div className="space-y-6 lg:space-y-8">
      <MobileHeader
        variant="sub"
        title="Cuentas"
        backHref="/gestionar"
        action={
          <AccountFormDialog
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-full text-z-brass hover:bg-z-brass/10 hover:text-z-brass"
                aria-label="Nueva cuenta"
              >
                <Plus className="size-4" />
              </Button>
            }
          />
        }
      />

      <PageHeaderRow
        className="hidden lg:flex"
        title="Cuentas"
        subtitle={`Patrimonio ${formatCurrency(totalBalance, currency)} · ${debtJudgment}`}
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

      {/* Mobile: judgment line + single primary CTA — first card stays above the fold */}
      {accounts.length > 0 && (
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            Patrimonio{" "}
            <span
              className={cn(
                "font-semibold tabular-nums",
                totalBalance < 0 ? "text-z-debt" : "text-z-sage-light"
              )}
            >
              {formatCurrencyCompact(totalBalance, currency)}
            </span>
            {" · "}
            {debtJudgment}
          </p>
          <Button asChild size="sm" className={cn(BRASS_BUTTON_CLASS, "shrink-0")}>
            <Link href="/import">Importar extracto</Link>
          </Button>
        </div>
      )}

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
        <Card className={PANEL_SURFACE_CLASS}>
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
                trigger={
                  <Button className={BRASS_BUTTON_CLASS}>
                    <Plus className="size-4" />
                    Crear cuenta manual
                  </Button>
                }
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
        <div className="space-y-6 lg:space-y-8">
          {accountSections.map((section) => (
            <section key={section.key} className="space-y-3 lg:space-y-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-base font-semibold tracking-tight lg:text-xl">
                  {section.title}
                  <span className="ml-2 text-xs font-medium text-muted-foreground">
                    {section.accounts.length}
                  </span>
                </h2>
                {section.subtotal != null && (
                  <p
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      section.subtotal < 0 ? "text-z-debt" : "text-z-sage-light"
                    )}
                  >
                    {formatCurrencyCompact(section.subtotal, currency)}
                  </p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-3">
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

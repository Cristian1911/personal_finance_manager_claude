import Link from "next/link";
import { ArrowRight, Wallet } from "lucide-react";
import { AccountIcon } from "@/components/accounts/account-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";
import type { PlanMainAccountsSummary } from "@/types/plan";

interface PlanMainAccountsSectionProps {
  mainAccounts: PlanMainAccountsSummary;
  currency: CurrencyCode;
}

export function PlanMainAccountsSection({
  mainAccounts,
  currency,
}: PlanMainAccountsSectionProps) {
  const { accounts, totalInBase, hasUnconvertibleAccounts } = mainAccounts;
  const hasAccounts = accounts.length > 0;

  return (
    <Card className="border-white/6 bg-card/90">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          <Wallet className="size-4" />
          Saldos actuales
        </div>
        <div className="flex items-end justify-between gap-3">
          <CardTitle className="text-xl">El dinero con el que cuentas hoy</CardTitle>
          {hasAccounts && (
            <span className="text-2xl font-semibold tabular-nums">
              {formatCurrency(totalInBase, currency)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasAccounts ? (
          <div className="space-y-2">
            {accounts.map((account) => {
              const showBaseConversion = account.currency_code !== currency;
              return (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-2xl border border-white/6 bg-z-surface-2/30 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <AccountIcon
                      bank_key={account.bank_key}
                      account_type={account.account_type}
                      color={account.color}
                      size="md"
                    />
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate font-medium">{account.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {account.mask ? `····${account.mask} · ` : ""}
                        {account.currency_code}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCurrency(account.current_balance, account.currency_code)}
                    </p>
                    {showBaseConversion && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        ≈ {formatCurrency(account.balance_in_base, currency)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/6 bg-z-surface-2/30 px-4 py-4 text-sm text-muted-foreground">
            No tienes cuentas principales activas en la moneda del plan. Activa
            «Mostrar en panel» en alguna cuenta de ahorros, corriente o efectivo.
          </div>
        )}

        {hasUnconvertibleAccounts && (
          <p className="text-xs text-muted-foreground">
            Algunas cuentas en otra moneda no se pudieron convertir y no se
            incluyen en el total.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" className={GHOST_BUTTON_CLASS}>
            <Link href="/accounts">
              Ver cuentas
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { CreditCard, Landmark, Wallet } from "lucide-react";
import { ReconcileBalanceDialog } from "@/components/accounts/reconcile-balance-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getTrackedCurrencyBalances } from "@/lib/utils/currency-balances";
import { formatCurrency } from "@/lib/utils/currency";
import type { Json } from "@/types/database";
import { ACCOUNT_TYPE_DASHBOARD_LABELS } from "@/lib/constants/account-types";
import type { AccountType, CurrencyCode } from "@/types/domain";

export type QuickValueUpdateAccount = {
  id: string;
  name: string;
  accountType: AccountType;
  currentBalance: number;
  currencyBalances?: Json | null;
  currencyCode: string;
  displayOrder: number | null;
};

interface QuickValueUpdatesProps {
  accounts: QuickValueUpdateAccount[];
  id?: string;
  variant?: "desktop" | "mobile";
}

const PRIMARY_LIQUID_TYPES = new Set<AccountType>(["CHECKING", "SAVINGS", "CASH"]);


function sortByDashboardPriority(a: QuickValueUpdateAccount, b: QuickValueUpdateAccount) {
  return (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER);
}

function getCardBalanceLabel(account: QuickValueUpdateAccount) {
  const trackedBalances = getTrackedCurrencyBalances({
    currencyCode: account.currencyCode,
    currentBalance: account.currentBalance,
    currencyBalances: account.currencyBalances,
  });

  if (trackedBalances.length > 1) {
    return trackedBalances
      .map((balance) => {
        if (balance.currentBalance > 0) {
          return `${formatCurrency(balance.currentBalance, balance.currency)} de deuda`;
        }

        if (balance.currentBalance < 0) {
          return `${formatCurrency(Math.abs(balance.currentBalance), balance.currency)} a favor`;
        }

        return `${balance.currency} sin deuda`;
      })
      .join(" · ");
  }

  const code = account.currencyCode as CurrencyCode;

  if (account.currentBalance > 0) {
    return `${formatCurrency(account.currentBalance, code)} de deuda registrada`;
  }

  if (account.currentBalance < 0) {
    return `${formatCurrency(Math.abs(account.currentBalance), code)} a favor`;
  }

  return "Sin deuda registrada";
}

export function QuickValueUpdates({
  accounts,
  id,
  variant = "desktop",
}: QuickValueUpdatesProps) {
  const primaryLiquidAccount = [...accounts]
    .filter((account) => PRIMARY_LIQUID_TYPES.has(account.accountType))
    .sort(sortByDashboardPriority)[0];

  const creditCards = [...accounts]
    .filter((account) => account.accountType === "CREDIT_CARD")
    .sort(sortByDashboardPriority);

  if (!primaryLiquidAccount && creditCards.length === 0) return null;

  const isMobile = variant === "mobile";

  return (
    <Card id={id} className={isMobile ? "border-border/70" : undefined}>
      <CardHeader className={isMobile ? "pb-3" : undefined}>
        <CardTitle className={isMobile ? "text-base" : "text-lg"}>
          Actualizar valores
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Sobrescribe el saldo real y Zeta crea un ajuste temporal hasta que llegue tu próximo extracto.
        </p>
      </CardHeader>
      <CardContent className={isMobile ? "space-y-3" : "space-y-4"}>
        {primaryLiquidAccount ? (
          <div className="rounded-xl border bg-card/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {primaryLiquidAccount.accountType === "CASH" ? (
                    <Wallet className="h-4 w-4" />
                  ) : (
                    <Landmark className="h-4 w-4" />
                  )}
                  <span>{ACCOUNT_TYPE_DASHBOARD_LABELS[primaryLiquidAccount.accountType]}</span>
                </div>
                <div>
                  <p className="font-medium">{primaryLiquidAccount.name}</p>
                  <p className="text-2xl font-semibold tracking-tight">
                    {formatCurrency(
                      primaryLiquidAccount.currentBalance,
                      primaryLiquidAccount.currencyCode as CurrencyCode
                    )}
                  </p>
                </div>
              </div>
              <ReconcileBalanceDialog
                accountId={primaryLiquidAccount.id}
                accountName={primaryLiquidAccount.name}
                accountType={primaryLiquidAccount.accountType}
                currentBalance={primaryLiquidAccount.currentBalance}
                currencyBalances={primaryLiquidAccount.currencyBalances}
                currencyCode={primaryLiquidAccount.currencyCode}
                trigger={
                  <Button size={isMobile ? "sm" : "default"} className="shrink-0">
                    Sobrescribir saldo
                  </Button>
                }
              />
            </div>
          </div>
        ) : null}

        {creditCards.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              <span>Tarjetas</span>
            </div>
            <div className="grid gap-3">
              {creditCards.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between gap-3 rounded-xl border p-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{account.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {getCardBalanceLabel(account)}
                    </p>
                  </div>
                  <ReconcileBalanceDialog
                    accountId={account.id}
                    accountName={account.name}
                    accountType={account.accountType}
                    currentBalance={account.currentBalance}
                    currencyBalances={account.currencyBalances}
                    currencyCode={account.currencyCode}
                    trigger={
                      <Button variant="outline" size="sm" className="shrink-0">
                        Actualizar
                      </Button>
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

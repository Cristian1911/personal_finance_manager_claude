"use client";

import { formatCurrency } from "@/lib/utils/currency";
import { getTrackedCurrencyBalances } from "@/lib/utils/currency-balances";
import {
  getFreshnessLevel,
  getAccountSemanticColor,
  getCreditUtilizationColor,
  semanticColorMap,
  freshnessMap,
} from "@/lib/utils/dashboard";
import { CreditCard, Landmark, RefreshCw, Wallet } from "lucide-react";
import dynamic from "next/dynamic";

const Sparkline = dynamic(
  () => import("@/components/charts/sparkline").then((m) => ({ default: m.Sparkline })),
  {
    ssr: false,
    loading: () => <div className="h-8 w-24 rounded bg-muted animate-pulse" />,
  }
);
import { ReconcileBalanceDialog } from "@/components/accounts/reconcile-balance-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { PrefetchLink } from "@/components/ui/prefetch-link";
import type { AccountWithSparkline, GroupedAccounts } from "@/actions/charts";
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

interface AccountsOverviewProps {
  data: GroupedAccounts;
  picker?: React.ReactNode;
}

function AccountRow({ account }: { account: AccountWithSparkline }) {
  const isDebt = account.account_type === "CREDIT_CARD" || account.account_type === "LOAN";
  const kind = isDebt ? "debt" : "deposit";

  const changeColor = getAccountSemanticColor(account.changePercent, kind);
  const freshness = getFreshnessLevel(account.updated_at);
  const sparklineData = account.sparkline.map((p) => ({ value: p.balance }));

  // For credit cards, use utilization color for sparkline
  const sparklineColor = account.utilization != null
    ? getCreditUtilizationColor(account.utilization)
    : changeColor;

  const cc = semanticColorMap[changeColor];
  const fc = freshnessMap[freshness];

  return (
    <div className="flex items-center justify-between py-2 px-2 -mx-2 rounded-md group">
      <PrefetchLink
        href={`/accounts/${account.id}`}
        className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80 transition-opacity"
      >
        <div className={`h-2 w-2 rounded-full shrink-0 ${fc.dot}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{account.name}</p>
          {account.utilization != null && (
            <div className="flex items-center gap-2 mt-0.5">
              <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${semanticColorMap[getCreditUtilizationColor(account.utilization)].dot}`}
                  style={{ width: `${Math.min(account.utilization, 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {Math.round(account.utilization)}%
              </span>
            </div>
          )}
          {account.installmentProgress && (
            <p className="text-xs text-muted-foreground">
              Cuota {account.installmentProgress}
            </p>
          )}
          {(() => {
            const importableTypes = new Set(["CREDIT_CARD", "LOAN", "SAVINGS"]);
            if (!importableTypes.has(account.account_type) || !account.updated_at) return null;
            const daysAgo = Math.floor(
              (Date.now() - new Date(account.updated_at).getTime()) / (24 * 60 * 60 * 1000)
            );
            if (daysAgo < 30) return null;
            const color = daysAgo >= 60 ? "text-destructive" : "text-z-alert";
            return (
              <p className={`text-xs ${color}`}>
                hace {daysAgo} días
              </p>
            );
          })()}
        </div>
      </PrefetchLink>

      <div className="flex items-center gap-2">
        <Sparkline data={sparklineData} color={sparklineColor} />
        <div className="text-right">
          <p className="text-sm font-medium">
            {formatCurrency(
              Math.abs(account.current_balance),
              account.currency_code as CurrencyCode
            )}
          </p>
          {account.changePercent !== 0 && (
            <p className={`text-xs ${cc.text}`}>
              {account.changePercent > 0 ? "+" : ""}
              {account.changePercent.toFixed(1)}%
            </p>
          )}
        </div>
        <ReconcileBalanceDialog
          accountId={account.id}
          accountName={account.name}
          accountType={account.account_type}
          currentBalance={account.current_balance}
          currencyBalances={account.currency_balances}
          currencyCode={account.currency_code}
          trigger={
            <button className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-all" aria-label={`Actualizar saldo de ${account.name}`}>
              <RefreshCw className="h-3 w-3 text-muted-foreground" />
            </button>
          }
        />
      </div>
    </div>
  );
}

function GroupedAccountList({ accounts }: { accounts: AccountWithSparkline[] }) {
  const grouped = Object.entries(Object.groupBy(accounts, (a) => a.currency_code));
  const multiCurrency = grouped.length > 1;
  return (
    <div>
      {grouped.map(([curr, accts]) => (
        <div key={curr}>
          {multiCurrency && (
            <p className="text-xs text-muted-foreground mt-2 mb-1">{curr}</p>
          )}
          <div className="divide-y">
            {accts!.map((a) => (
              <AccountRow key={a.id} account={a} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const MAX_PREVIEW = 4;

export function AccountsOverview({ data, picker }: AccountsOverviewProps) {
  const hasDeposits = data.deposits.length > 0;
  const hasDebt = data.debt.length > 0;

  if (!hasDeposits && !hasDebt) return null;

  // Show at most MAX_PREVIEW accounts total, prioritizing deposits
  const previewDeposits = data.deposits.slice(0, MAX_PREVIEW);
  const remainingSlots = MAX_PREVIEW - previewDeposits.length;
  const previewDebt = data.debt.slice(0, Math.max(remainingSlots, 2));
  const totalAccounts = data.deposits.length + data.debt.length;
  const showing = previewDeposits.length + previewDebt.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Mis cuentas</CardTitle>
        <div className="flex items-center gap-2">
          {picker}
          <Link href="/accounts" className="text-xs text-primary hover:underline">
            Ver todas
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {previewDeposits.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Cuentas de depósito</p>
            <GroupedAccountList accounts={previewDeposits} />
          </div>
        )}
        {previewDebt.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Deuda</p>
            <GroupedAccountList accounts={previewDebt} />
          </div>
        )}
        {totalAccounts > showing && (
          <Link href="/accounts" className="block text-center text-xs text-muted-foreground hover:text-primary">
            +{totalAccounts - showing} cuentas más
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

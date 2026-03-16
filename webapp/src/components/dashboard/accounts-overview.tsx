"use client";

import { formatCurrency } from "@/lib/utils/currency";
import {
  getFreshnessLevel,
  getAccountSemanticColor,
  getCreditUtilizationColor,
  semanticColorMap,
  freshnessMap,
} from "@/lib/utils/dashboard";
import { RefreshCw } from "lucide-react";
import { Sparkline } from "@/components/charts/sparkline";
import { ReconcileBalanceDialog } from "@/components/accounts/reconcile-balance-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import type { AccountWithSparkline, GroupedAccounts } from "@/actions/charts";
import type { CurrencyCode } from "@/types/domain";

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
      <Link
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
      </Link>

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
          currentBalance={account.current_balance}
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
  return grouped.map(([curr, accts]) => (
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
  ));
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

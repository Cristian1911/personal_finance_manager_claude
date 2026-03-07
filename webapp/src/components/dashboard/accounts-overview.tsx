"use client";

import { formatCurrency } from "@/lib/utils/currency";
import {
  getFreshnessLevel,
  getAccountSemanticColor,
  getCreditUtilizationColor,
  semanticColorMap,
  freshnessMap,
} from "@/lib/utils/dashboard";
import { Sparkline } from "@/components/charts/sparkline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import type { AccountWithSparkline, GroupedAccounts } from "@/actions/charts";
import type { CurrencyCode } from "@/types/domain";

interface AccountsOverviewProps {
  data: GroupedAccounts;
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
    <Link
      href={`/accounts/${account.id}`}
      className="flex items-center justify-between py-2 px-2 -mx-2 rounded-md hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
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
        </div>
      </div>

      <div className="flex items-center gap-3">
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
      </div>
    </Link>
  );
}

export function AccountsOverview({ data }: AccountsOverviewProps) {
  const hasDeposits = data.deposits.length > 0;
  const hasDebt = data.debt.length > 0;

  if (!hasDeposits && !hasDebt) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Mis cuentas</CardTitle>
        <Link href="/accounts" className="text-xs text-primary hover:underline">
          Ver todas
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasDeposits && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Cuentas de deposito</p>
            <div className="divide-y">
              {data.deposits.map((a) => (
                <AccountRow key={a.id} account={a} />
              ))}
            </div>
          </div>
        )}
        {hasDebt && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Deuda</p>
            <div className="divide-y">
              {data.debt.map((a) => (
                <AccountRow key={a.id} account={a} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuickPaymentDialog } from "@/components/accounts/quick-payment-dialog";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import { ACCOUNT_TYPE_SHORT_LABELS } from "@/lib/constants/account-types";
import {
  PANEL_INSET_CLASS,
  PANEL_SURFACE_CLASS,
  SECTION_EYEBROW_CLASS,
} from "@/lib/constants/styles";
import { InfoHint } from "@/components/ui/info-hint";
import { isDebtAccountType } from "@/lib/utils/account-balance";
import type { Account } from "@/types/domain";
import {
  Wallet,
  CreditCard,
  PiggyBank,
  Banknote,
  TrendingUp,
  Landmark,
  CircleDot,
  HandCoins,
} from "lucide-react";

const ACCOUNT_TYPE_ICONS: Record<string, React.ElementType> = {
  CHECKING: Wallet,
  SAVINGS: PiggyBank,
  CREDIT_CARD: CreditCard,
  CASH: Banknote,
  INVESTMENT: TrendingUp,
  LOAN: Landmark,
  OTHER: CircleDot,
};

/** Credit utilization at or above this fraction earns an attention badge. */
const UTILIZATION_ALERT_THRESHOLD = 0.8;
/** Days without a sync before the balance is flagged as stale. */
const STALE_BALANCE_DAYS = 10;

interface AccountCardProps {
  account: Account;
  /** All accounts (for QuickPaymentDialog source picker) */
  allAccounts?: Pick<Account, "id" | "name" | "account_type" | "currency_code">[];
}

export function AccountCard({ account, allAccounts }: AccountCardProps) {
  const Icon = ACCOUNT_TYPE_ICONS[account.account_type] ?? Wallet;
  const isDebt = isDebtAccountType(account.account_type);
  const availableCredit =
    account.credit_limit != null ? account.credit_limit - account.current_balance : null;
  const accentColor = account.color ?? (isDebt ? "var(--z-brass)" : "var(--z-olive-deep)");
  const accentSurface = account.color
    ? `${account.color}20`
    : isDebt
      ? "color-mix(in srgb, var(--z-brass) 12.5%, transparent)"
      : "color-mix(in srgb, var(--z-olive-deep) 12.5%, transparent)";

  // Per-account attention — computed from data already on the row, no queries.
  const utilization =
    isDebt && account.credit_limit != null && account.credit_limit > 0
      ? account.current_balance / account.credit_limit
      : null;
  const utilizationAlert = utilization != null && utilization >= UTILIZATION_ALERT_THRESHOLD;
  const staleDays = account.last_synced_at
    ? differenceInCalendarDays(new Date(), new Date(account.last_synced_at))
    : null;
  const staleBalance = staleDays != null && staleDays >= STALE_BALANCE_DAYS;

  return (
    <Link href={`/accounts/${account.id}`} className="block h-full">
      <Card
        className={cn(
          PANEL_SURFACE_CLASS,
          "h-full cursor-pointer gap-3 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-z-brass/25"
        )}
      >
        <CardHeader className="px-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/6"
                style={{ backgroundColor: accentSurface }}
              >
                <Icon className="size-5" style={{ color: accentColor }} />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-base font-semibold">{account.name}</CardTitle>
                {account.institution_name && (
                  <p className="truncate text-xs text-muted-foreground">
                    {account.institution_name}
                    {account.mask && ` ••${account.mask}`}
                  </p>
                )}
                {!account.institution_name && account.mask ? (
                  <p className="text-xs text-muted-foreground">Terminación ••{account.mask}</p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="secondary" className="border-white/6 bg-black/15 text-[11px] text-z-white">
                {ACCOUNT_TYPE_SHORT_LABELS[account.account_type]}
              </Badge>
              {allAccounts && allAccounts.length > 0 && (
                <div
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  className="shrink-0"
                >
                  <QuickPaymentDialog
                    accountId={account.id}
                    accountName={account.name}
                    accountType={account.account_type}
                    currentBalance={account.current_balance}
                    currencyCode={account.currency_code}
                    accounts={allAccounts}
                    trigger={
                      <Button variant="ghost" size="icon" className="size-8 rounded-full">
                        <HandCoins className="size-4" />
                      </Button>
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 px-4">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-1.5">
                <span className={SECTION_EYEBROW_CLASS}>
                  {isDebt ? "Saldo pendiente" : "Saldo actual"}
                </span>
                <InfoHint label="Sobre el saldo">
                  {isDebt
                    ? "Cantidad que debes en esta cuenta."
                    : "Dinero disponible en esta cuenta."}
                </InfoHint>
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">
                {account.currency_code}
              </span>
            </div>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold tracking-tight",
                isDebt && account.current_balance > 0 ? "text-z-debt" : "text-z-sage-light"
              )}
            >
              {formatCurrency(account.current_balance, account.currency_code)}
            </p>
          </div>

          {(utilizationAlert || staleBalance) && (
            <div className="flex flex-wrap gap-1.5">
              {utilizationAlert && utilization != null && (
                <span className="inline-flex items-center rounded-full border border-z-alert/20 bg-z-alert/10 px-2 py-0.5 text-[10px] font-medium text-z-alert">
                  Cupo al {Math.round(utilization * 100)}%
                </span>
              )}
              {staleBalance && (
                <span className="inline-flex items-center rounded-full border border-white/6 bg-black/15 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Sin actualizar {staleDays}d
                </span>
              )}
            </div>
          )}

          {account.credit_limit != null ? (
            <div className={cn(PANEL_INSET_CLASS, "px-3 py-2 text-sm")}>
              <div className="flex items-center justify-between gap-3 text-muted-foreground">
                <span>{isDebt ? "Cupo total" : "Límite"}</span>
                <span className="font-medium text-z-white">
                  {formatCurrency(account.credit_limit, account.currency_code)}
                </span>
              </div>
              {availableCredit != null ? (
                <div className="mt-1.5 flex items-center justify-between gap-3 text-muted-foreground">
                  <span>Disponible</span>
                  <span className="font-medium text-z-sage-light">
                    {formatCurrency(Math.max(availableCredit, 0), account.currency_code)}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}

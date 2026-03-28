"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import { ACCOUNT_TYPE_SHORT_LABELS } from "@/lib/constants/account-types";
import type { Account } from "@/types/domain";
import {
  ArrowRight,
  Wallet,
  CreditCard,
  PiggyBank,
  Banknote,
  TrendingUp,
  Landmark,
  CircleDot,
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


export function AccountCard({ account }: { account: Account }) {
  const Icon = ACCOUNT_TYPE_ICONS[account.account_type] ?? Wallet;
  const isDebt = account.account_type === "CREDIT_CARD" || account.account_type === "LOAN";
  const availableCredit =
    account.credit_limit != null ? account.credit_limit - account.current_balance : null;
  const accentColor = account.color ?? (isDebt ? "var(--z-brass)" : "var(--z-olive-deep)");
  const accentSurface = account.color
    ? `${account.color}20`
    : isDebt
      ? "color-mix(in srgb, var(--z-brass) 18%, transparent)"
      : "color-mix(in srgb, var(--z-olive-deep) 18%, transparent)";

  return (
    <Link href={`/accounts/${account.id}`} className="block h-full">
      <Card
        className={cn(
          "h-full cursor-pointer border-white/6 bg-z-surface-2/75 transition-all duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:-translate-y-0.5 hover:border-z-brass/25 hover:shadow-[0_18px_40px_rgba(0,0,0,0.18)]",
          isDebt
            ? "bg-[radial-gradient(circle_at_top_left,rgba(147,120,68,0.12),transparent_38%),linear-gradient(180deg,rgba(34,28,24,0.92),rgba(21,20,18,0.96))]"
            : "bg-[radial-gradient(circle_at_top_left,rgba(63,70,50,0.18),transparent_40%),linear-gradient(180deg,rgba(28,31,28,0.92),rgba(19,21,19,0.96))]"
        )}
      >
        <CardHeader className="space-y-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/6"
                style={{ backgroundColor: accentSurface }}
              >
                <Icon className="h-5 w-5" style={{ color: accentColor }} />
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
            <div className="flex flex-wrap justify-end gap-2">
              <Badge variant="secondary" className="border-white/6 bg-black/15 text-[11px] text-z-white">
                {ACCOUNT_TYPE_SHORT_LABELS[account.account_type]}
              </Badge>
              {account.show_in_dashboard ? (
                <Badge className="border-z-brass/30 bg-z-brass/10 text-[11px] font-medium text-z-brass hover:bg-z-brass/10">
                  Inicio
                </Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              {isDebt ? "Saldo pendiente" : "Saldo actual"}
            </p>
            <p
              className={cn(
                "mt-3 text-2xl font-semibold tracking-tight",
                isDebt && account.current_balance > 0 ? "text-z-debt" : "text-z-sage-light"
              )}
            >
              {formatCurrency(account.current_balance, account.currency_code)}
            </p>
          </div>

          {account.credit_limit != null ? (
            <div className="rounded-2xl border border-white/6 bg-black/10 px-3 py-3 text-sm">
              <div className="flex items-center justify-between gap-3 text-muted-foreground">
                <span>{isDebt ? "Cupo total" : "Límite"}</span>
                <span className="font-medium text-z-white">
                  {formatCurrency(account.credit_limit, account.currency_code)}
                </span>
              </div>
              {availableCredit != null ? (
                <div className="mt-2 flex items-center justify-between gap-3 text-muted-foreground">
                  <span>Disponible</span>
                  <span className="font-medium text-z-sage-light">
                    {formatCurrency(Math.max(availableCredit, 0), account.currency_code)}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              {account.currency_code}
              {account.mask ? ` · ••${account.mask}` : ""}
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-z-brass">
              Ver detalle
              <ArrowRight className="size-3.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

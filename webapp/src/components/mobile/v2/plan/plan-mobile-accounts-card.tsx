"use client";

import { Wallet } from "lucide-react";
import Link from "next/link";
import { MOBILE_ACTION_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";
import type { PlanMainAccountsSummary } from "@/types/plan";

interface PlanMobileAccountsCardProps {
  mainAccounts: PlanMainAccountsSummary;
  currency: CurrencyCode;
  expanded: boolean;
  onToggle: () => void;
}

export function PlanMobileAccountsCard({
  mainAccounts,
  currency,
  expanded,
  onToggle,
}: PlanMobileAccountsCardProps) {
  const { accounts, totalInBase, hasUnconvertibleAccounts } = mainAccounts;
  const hasAccounts = accounts.length > 0;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={expanded ? "Ocultar saldos de cuentas principales" : "Mostrar saldos de cuentas principales"}
        className={cn(
          "w-full rounded-xl border p-3 text-left transition-all",
          expanded
            ? "border-z-brass/50 bg-z-brass/10"
            : "border-white/6 bg-z-brass/5"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-z-brass">
              <Wallet className="size-3.5" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                Saldo actual
              </p>
            </div>
            <p className="mt-1 text-lg font-bold tabular-nums text-z-brass">
              {formatCurrency(totalInBase, currency)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {hasAccounts
                ? `${accounts.length} ${accounts.length === 1 ? "cuenta principal" : "cuentas principales"}`
                : "Sin cuentas principales"}
            </p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="rounded-xl border border-z-brass/20 bg-z-brass/5 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-z-brass">
            Cuentas principales
          </p>

          {hasAccounts ? (
            <>
              <div className="divide-y divide-white/6">
                {accounts.map((account) => {
                  const showBaseConversion = account.currency_code !== currency;
                  return (
                    <div
                      key={account.id}
                      className="flex items-center justify-between py-2"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="truncate text-xs font-medium">{account.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {account.mask ? `····${account.mask} · ` : ""}
                          {account.currency_code}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-z-brass">
                          {formatCurrency(account.current_balance, account.currency_code)}
                        </p>
                        {showBaseConversion && (
                          <p className="text-[10px] text-muted-foreground tabular-nums">
                            ≈ {formatCurrency(account.balance_in_base, currency)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-white/6 pt-2 text-xs">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold tabular-nums text-z-brass">
                  {formatCurrency(totalInBase, currency)}
                </span>
              </div>
              {hasUnconvertibleAccounts && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Algunas cuentas en otra moneda no se pudieron convertir.
                </p>
              )}
            </>
          ) : (
            <div className="py-3 text-center">
              <p className="mb-2 text-xs text-muted-foreground">
                No tienes cuentas principales activas
              </p>
              <Link
                href="/accounts"
                className={cn(MOBILE_ACTION_BUTTON_CLASS, "inline-flex items-center gap-1")}
              >
                Ver cuentas
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

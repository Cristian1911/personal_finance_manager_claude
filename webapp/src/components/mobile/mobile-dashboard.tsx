"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  CalendarClock,
  CircleAlert,
} from "lucide-react";
import { toISODateString } from "@/lib/utils/date";
import type { CurrencyCode } from "@/types/domain";
import type { BurnRateResponse } from "@/actions/burn-rate";
import { BurnRateCard, BurnRateCardEmpty } from "@/components/dashboard/burn-rate-card";

interface MobileDashboardProps {
  heroData: {
    availableToSpend: number;
    totalBalance: number;
    pendingFixed: number;
    currency: string;
  };
  upcomingPayments: Array<{
    id: string;
    name: string;
    dueDate: string;
    amount: number;
    currencyCode: string;
  }>;
  recentTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    currency_code: string;
    direction: "INFLOW" | "OUTFLOW";
    date: string;
    category_name?: string;
  }>;
  burnRateData?: BurnRateResponse | null;
}

export function MobileDashboard({
  heroData,
  upcomingPayments,
  recentTransactions,
  burnRateData,
}: MobileDashboardProps) {
  const code = heroData.currency as CurrencyCode;

  return (
    <div className="space-y-5">
      {/* 1. Hero card */}
      <div className="rounded-xl border bg-card p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Disponible para gastar
        </p>
        <p
          className={cn(
            "text-3xl font-bold mt-1",
            heroData.availableToSpend < 0 && "text-z-debt"
          )}
        >
          {formatCurrency(heroData.availableToSpend, code)}
        </p>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span>Saldo: {formatCurrency(heroData.totalBalance, code)}</span>
          <span>Fijos: {formatCurrency(heroData.pendingFixed, code)}</span>
        </div>
      </div>

      {/* 1.5. Burn Rate Card */}
      {burnRateData ? (
        <BurnRateCard data={burnRateData} />
      ) : (
        <BurnRateCardEmpty />
      )}

      {/* 2. Próximos pagos — prominent */}
      {upcomingPayments.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Próximos pagos
            </h2>
            <Link
              href="/recurrentes"
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              Ver todos
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="rounded-xl border divide-y">
            {upcomingPayments.slice(0, 5).map((payment) => {
              const today = toISODateString(new Date());
              const isOverdue = payment.dueDate < today;
              const isToday = payment.dueDate === today;

              return (
                <Link
                  key={payment.id}
                  href="/recurrentes"
                  className={cn(
                    "flex items-center justify-between px-4 py-3.5 active:bg-muted transition-colors",
                    isOverdue && "bg-z-alert/[0.08] border-l-2 border-l-z-alert",
                    isToday && "bg-z-debt/[0.08] border-l-2 border-l-z-debt",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 mr-3">
                    {(isOverdue || isToday) && (
                      <CircleAlert className={cn(
                        "h-4 w-4 shrink-0",
                        isOverdue ? "text-z-alert" : "text-z-debt"
                      )} />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {payment.name}
                      </p>
                      <p className={cn(
                        "text-xs",
                        isOverdue ? "text-z-alert font-medium" : isToday ? "text-z-debt font-medium" : "text-muted-foreground"
                      )}>
                        {isOverdue ? "Vencido — " : isToday ? "Hoy — " : ""}
                        {formatDate(payment.dueDate, "dd MMM")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      "text-sm font-semibold",
                      (isOverdue || isToday) && "text-z-debt"
                    )}>
                      {formatCurrency(
                        payment.amount,
                        payment.currencyCode as CurrencyCode
                      )}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Actividad reciente — compact */}
      {recentTransactions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Actividad reciente
            </h2>
            <Link
              href="/transactions"
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              Ver todos
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-0.5">
            {recentTransactions.slice(0, 3).map((tx) => (
              <Link
                key={tx.id}
                href={`/transactions/${tx.id}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 -mx-2 active:bg-muted transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {tx.direction === "INFLOW" ? (
                    <ArrowDownLeft className="h-3.5 w-3.5 text-z-income shrink-0" />
                  ) : (
                    <ArrowUpRight className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                  )}
                  <span className="text-sm truncate">{tx.description}</span>
                </div>
                <span
                  className={cn(
                    "text-sm font-medium shrink-0 ml-2",
                    tx.direction === "INFLOW" && "text-z-income"
                  )}
                >
                  {tx.direction === "INFLOW" ? "+" : "-"}
                  {formatCurrency(
                    tx.amount,
                    tx.currency_code as CurrencyCode
                  )}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

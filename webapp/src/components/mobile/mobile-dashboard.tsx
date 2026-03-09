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
} from "lucide-react";
import type { CurrencyCode } from "@/types/domain";

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
}

export function MobileDashboard({
  heroData,
  upcomingPayments,
  recentTransactions,
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
            heroData.availableToSpend < 0 && "text-red-600"
          )}
        >
          {formatCurrency(heroData.availableToSpend, code)}
        </p>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span>Saldo: {formatCurrency(heroData.totalBalance, code)}</span>
          <span>Fijos: {formatCurrency(heroData.pendingFixed, code)}</span>
        </div>
      </div>

      {/* 2. Próximos pagos */}
      {upcomingPayments.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4" />
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
          <div className="rounded-lg border p-3 space-y-2">
            {upcomingPayments.slice(0, 5).map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between"
              >
                <span className="text-sm truncate max-w-[50%]">
                  {payment.name}
                </span>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(payment.dueDate, "dd MMM")}
                  </span>
                  <span className="font-medium">
                    {formatCurrency(
                      payment.amount,
                      payment.currencyCode as CurrencyCode
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Actividad reciente */}
      {recentTransactions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Actividad reciente</h2>
            <Link
              href="/transactions"
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              Ver todos
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-1">
            {recentTransactions.slice(0, 5).map((tx) => (
              <Link
                key={tx.id}
                href={`/transactions/${tx.id}`}
                className="flex items-center justify-between rounded-lg px-2 py-2 -mx-2 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      tx.direction === "INFLOW"
                        ? "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400"
                        : "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
                    )}
                  >
                    {tx.direction === "INFLOW" ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {tx.description}
                    </p>
                    {tx.category_name && (
                      <p className="text-xs text-muted-foreground truncate">
                        {tx.category_name}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={cn(
                    "text-sm font-medium shrink-0 ml-2",
                    tx.direction === "INFLOW" && "text-green-600"
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

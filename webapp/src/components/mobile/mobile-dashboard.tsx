"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  CircleAlert,
  FileUp,
} from "lucide-react";
import { toISODateString } from "@/lib/utils/date";
import type { CurrencyCode } from "@/types/domain";
import { HealthMetersCard } from "@/components/dashboard/health-meters-card";
import type { HealthMetersData } from "@/actions/health-meters";
import {
  QuickValueUpdates,
  type QuickValueUpdateAccount,
} from "@/components/dashboard/accounts-overview";

// Tier 1 props only — tier 2 data (burn rate, allocation, debt, cashflow strip)
// is now streamed in via Suspense sub-components from the dashboard page.
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
  quickUpdateAccounts: QuickValueUpdateAccount[];
  healthMetersData?: HealthMetersData | null;
}

export function MobileDashboard({
  heroData,
  upcomingPayments,
  recentTransactions,
  quickUpdateAccounts,
  healthMetersData,
}: MobileDashboardProps) {
  const today = toISODateString(new Date());
  const code = heroData.currency as CurrencyCode;
  const hasUpcomingPayments = upcomingPayments.length > 0;

  return (
    <div className="space-y-5">
      {/* 1. Hero card */}
      <div>
        <div className="rounded-[24px] border border-white/6 bg-[radial-gradient(circle_at_top_left,rgba(63,70,50,0.28),transparent_55%),linear-gradient(180deg,rgba(30,34,30,0.96),rgba(18,20,18,0.98))] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Estado del día
          </p>
          <p
            className={cn(
              "mt-2 text-3xl font-bold tracking-tight",
              heroData.availableToSpend < 0 && "text-z-debt"
            )}
          >
            {formatCurrency(heroData.availableToSpend, code)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {hasUpcomingPayments
              ? `Tienes ${upcomingPayments.length} ${upcomingPayments.length === 1 ? "pago que revisar" : "pagos que revisar"} antes de comprometer más gasto.`
              : "Tu margen está listo para ayudarte a decidir el siguiente paso sin abrir más ruido."}
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span>Saldo: {formatCurrency(heroData.totalBalance, code)}</span>
            <span>Fijos: {formatCurrency(heroData.pendingFixed, code)}</span>
          </div>
          <div className="mt-4 flex gap-2">
            <Link
              href={hasUpcomingPayments ? "/recurrentes" : "/transactions"}
              className="flex min-h-9 flex-1 items-center justify-center gap-2 rounded-full bg-z-brass px-3 text-sm font-medium text-z-ink"
            >
              {hasUpcomingPayments ? (
                <>
                  <CalendarClock className="h-4 w-4" />
                  Revisar pagos
                </>
              ) : (
                <>
                  <ChevronRight className="h-4 w-4" />
                  Ver movimientos
                </>
              )}
            </Link>
            <Link
              href="/import"
              className="flex min-h-9 flex-1 items-center justify-center gap-2 rounded-full border border-white/8 bg-black/10 px-3 text-sm font-medium text-z-sage-light"
            >
              <FileUp className="h-4 w-4" />
              Importar
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Próximos pagos — prominent */}
      {hasUpcomingPayments && (
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
            {upcomingPayments.map((payment) => {
              const isOverdue = payment.dueDate < today;
              const isToday = payment.dueDate === today;

              return (
                <div key={payment.id}>
                <Link
                  href="/recurrentes"
                  className={cn(
                    "flex items-center justify-between px-4 py-3.5 active:bg-muted transition-colors",
                    isOverdue && "bg-z-debt/[0.08] border-l-2 border-l-z-debt",
                    isToday && "bg-z-alert/[0.08] border-l-2 border-l-z-alert",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 mr-3">
                    {(isOverdue || isToday) && (
                      <CircleAlert className={cn(
                        "h-4 w-4 shrink-0",
                        isOverdue ? "text-z-debt" : "text-z-alert"
                      )} />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {payment.name}
                      </p>
                      <p className={cn(
                        "text-xs",
                        isOverdue ? "text-z-debt font-medium" : isToday ? "text-z-alert font-medium" : "text-muted-foreground"
                      )}>
                        {isOverdue ? "Vencido — " : isToday ? "Hoy — " : ""}
                        {formatDate(payment.dueDate, "dd MMM")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      "text-sm font-semibold",
                      isOverdue && "text-z-debt",
                      isToday && "text-z-alert"
                    )}>
                      {formatCurrency(
                        payment.amount,
                        payment.currencyCode as CurrencyCode
                      )}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <QuickValueUpdates accounts={quickUpdateAccounts} variant="mobile" />

      {/* 3. Health Meters — compact 4-bar card */}
      {healthMetersData && (
        <HealthMetersCard data={healthMetersData} />
      )}

      {/* 4. Actividad reciente — compact */}
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
              <div key={tx.id}>
              <Link
                href={`/transactions/${tx.id}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 -mx-2 active:bg-muted transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {tx.direction === "INFLOW" ? (
                    <ArrowDownLeft className="h-3.5 w-3.5 text-z-income shrink-0" />
                  ) : (
                    <ArrowUpRight className="h-3.5 w-3.5 text-z-expense shrink-0" />
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
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

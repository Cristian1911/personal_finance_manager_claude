"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, toISODateString } from "@/lib/utils/date";
import {
  ChevronRight,
  CalendarClock,
  CircleAlert,
  Landmark,
  TrendingDown,
} from "lucide-react";
import { FadeIn, StaggerList, StaggerItem } from "./motion";
import type { CurrencyCode } from "@/types/domain";

interface MobileDebtRecurrentesProps {
  totalDebt: number;
  monthlyInterest: number;
  currency: string;
  upcomingPayments: Array<{
    id: string;
    name: string;
    dueDate: string;
    amount: number;
    currencyCode: string;
  }>;
  debtAccounts: Array<{
    id: string;
    name: string;
    balance: number;
    interestRate: number | null;
    minimumPayment: number | null;
    currencyCode: string;
  }>;
}

export function MobileDebtRecurrentes({
  totalDebt,
  monthlyInterest,
  currency,
  upcomingPayments,
  debtAccounts,
}: MobileDebtRecurrentesProps) {
  const today = toISODateString(new Date());
  const code = currency as CurrencyCode;

  return (
    <div className="space-y-5">
      {/* 1. Hero card — total debt + monthly interest */}
      <FadeIn>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Deuda total
          </p>
          <p className="text-3xl font-bold mt-1 text-z-debt">
            {formatCurrency(totalDebt, code)}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5 text-z-alert" />
            <span>
              Intereses mensuales:{" "}
              <span className="font-medium text-z-alert">
                {formatCurrency(monthlyInterest, code)}
              </span>
            </span>
          </div>
        </div>
      </FadeIn>

      {/* 2. Upcoming debt payments timeline */}
      {upcomingPayments.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Próximos pagos de deuda
            </h2>
            <Link
              href="/recurrentes"
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              Ver todos
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <StaggerList className="rounded-xl border divide-y">
            {upcomingPayments.map((payment) => {
              const isOverdue = payment.dueDate < today;
              const isToday = payment.dueDate === today;

              return (
                <StaggerItem key={payment.id}>
                  <Link
                    href="/recurrentes"
                    className={cn(
                      "flex items-center justify-between px-4 py-3.5 active:bg-muted transition-colors",
                      isOverdue && "bg-z-debt/[0.08] border-l-2 border-l-z-debt",
                      isToday && "bg-z-alert/[0.08] border-l-2 border-l-z-alert"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 mr-3">
                      {(isOverdue || isToday) && (
                        <CircleAlert
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isOverdue ? "text-z-debt" : "text-z-alert"
                          )}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {payment.name}
                        </p>
                        <p
                          className={cn(
                            "text-xs",
                            isOverdue
                              ? "text-z-debt font-medium"
                              : isToday
                                ? "text-z-alert font-medium"
                                : "text-muted-foreground"
                          )}
                        >
                          {isOverdue ? "Vencido \u2014 " : isToday ? "Hoy \u2014 " : ""}
                          {formatDate(payment.dueDate, "dd MMM")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          isOverdue && "text-z-debt",
                          isToday && "text-z-alert"
                        )}
                      >
                        {formatCurrency(
                          payment.amount,
                          payment.currencyCode as CurrencyCode
                        )}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                </StaggerItem>
              );
            })}
          </StaggerList>
        </div>
      )}

      {/* 3. Per-account debt cards */}
      {debtAccounts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              Cuentas con deuda
            </h2>
            <Link
              href="/deudas"
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              Ver todos
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <StaggerList className="space-y-3">
            {debtAccounts.map((account) => (
              <StaggerItem key={account.id}>
                <Link
                  href="/deudas"
                  className="block rounded-xl border bg-card p-4 active:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium truncate mr-2">
                      {account.name}
                    </p>
                    <span className="text-sm font-semibold text-z-debt shrink-0">
                      {formatCurrency(
                        account.balance,
                        account.currencyCode as CurrencyCode
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {account.interestRate != null && (
                      <span>
                        Tasa:{" "}
                        <span className="font-medium">
                          {account.interestRate.toFixed(1)}%
                        </span>
                      </span>
                    )}
                    {account.minimumPayment != null && (
                      <span>
                        Pago mín:{" "}
                        <span className="font-medium">
                          {formatCurrency(
                            account.minimumPayment,
                            account.currencyCode as CurrencyCode
                          )}
                        </span>
                      </span>
                    )}
                    {account.interestRate == null &&
                      account.minimumPayment == null && (
                        <span className="italic">Sin datos adicionales</span>
                      )}
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerList>
        </div>
      )}
    </div>
  );
}

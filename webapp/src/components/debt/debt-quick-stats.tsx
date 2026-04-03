"use client";

import { Card } from "@/components/ui/card";
import { CreditCard, HandCoins, Layers } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { StatTile } from "./stat-tile";
import type { DebtStats } from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";

interface DebtQuickStatsProps {
  stats: DebtStats;
  currency: CurrencyCode;
  overallUtilization: number;
  totalCreditUsed: number;
  totalCreditLimit: number;
}

function UtilizationRing({ percentage }: { percentage: number }) {
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - percentage / 100);

  const color = percentage <= 30
    ? "var(--z-income)"
    : percentage <= 70
      ? "var(--z-alert)"
      : "var(--z-debt)";

  return (
    <div className="relative w-12 h-12 mx-auto mb-1">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        <circle
          cx="24" cy="24" r={r}
          fill="none" stroke="hsl(var(--muted))" strokeWidth="4"
        />
        <circle
          cx="24" cy="24" r={r}
          fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-sm font-bold"
        style={{ color }}
      >
        {percentage.toFixed(0)}%
      </div>
    </div>
  );
}

function PopoverList({
  items,
}: {
  items: { label: string; value: string; detail?: string }[];
}) {
  return (
    <div className="space-y-0.5">
      {items.map((item, i) => (
        <div
          key={i}
          className={`flex justify-between items-center gap-4 rounded-md px-2.5 py-2 ${
            i === 0 ? "bg-muted/50" : ""
          }`}
        >
          <div className="min-w-0">
            <p className={`text-sm truncate ${i === 0 ? "font-semibold" : "font-medium text-muted-foreground"}`}>
              {item.label}
            </p>
            {item.detail && (
              <p className="text-xs text-muted-foreground/70">{item.detail}</p>
            )}
          </div>
          <p className={`text-sm shrink-0 ${i === 0 ? "font-bold" : "font-medium text-muted-foreground"}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function UtilizationPopoverList({
  items,
  currency,
}: {
  items: { accountName: string; utilization: number; used: number; limit: number }[];
  currency: CurrencyCode;
}) {
  function getColor(pct: number) {
    if (pct <= 30) return "var(--z-income)";
    if (pct <= 70) return "var(--z-alert)";
    return "var(--z-debt)";
  }

  return (
    <div className="space-y-3 min-w-[240px]">
      {items.map((item, i) => (
        <div key={i} className="space-y-1.5 px-1">
          <div className="flex justify-between items-baseline">
            <p className={`text-sm truncate ${i === 0 ? "font-semibold" : "font-medium text-muted-foreground"}`}>
              {item.accountName}
            </p>
            <p
              className={`text-sm shrink-0 ml-3 ${i === 0 ? "font-bold" : "font-medium"}`}
              style={{ color: getColor(item.utilization) }}
            >
              {item.utilization.toFixed(0)}%
            </p>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(item.utilization, 100)}%`,
                backgroundColor: getColor(item.utilization),
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground/70">
            {formatCurrency(item.used, currency)} / {formatCurrency(item.limit, currency)}
          </p>
        </div>
      ))}
    </div>
  );
}

function ProgressPopoverList({
  items,
  currency,
}: {
  items: { accountName: string; percentage: number; paid: number; original: number }[];
  currency: CurrencyCode;
}) {
  return (
    <div className="space-y-3 min-w-[240px]">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider px-1">
        Estimado
      </p>
      {items.map((item, i) => (
        <div key={i} className="space-y-1.5 px-1">
          <div className="flex justify-between items-baseline">
            <p className={`text-sm truncate ${i === 0 ? "font-semibold" : "font-medium text-muted-foreground"}`}>
              {item.accountName}
            </p>
            <p className={`text-sm shrink-0 ml-3 ${i === 0 ? "font-bold text-z-income" : "font-medium"}`}>
              {item.percentage.toFixed(0)}%
            </p>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-z-income rounded-full transition-all"
              style={{ width: `${Math.min(item.percentage, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground/70">
            {formatCurrency(item.paid, currency)} de {formatCurrency(item.original, currency)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function DebtQuickStats({
  stats,
  currency,
  overallUtilization,
  totalCreditUsed,
  totalCreditLimit,
}: DebtQuickStatsProps) {
  const hasCreditCards = stats.creditCards.count > 0;
  const hasLoans = stats.loans.count > 0;

  return (
    <Card className="rounded-2xl p-4">
      {/* ── General Row ── */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <Layers className="h-3 w-3 text-muted-foreground" />
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
            General
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Mayor cuota */}
          {stats.highestPayment.amount > 0 && (
            <StatTile
              label="Mayor cuota"
              popoverContent={
                <PopoverList
                  items={stats.allByPayment.map((e) => ({
                    label: e.accountName,
                    value: formatCurrency(e.amount, currency),
                  }))}
                />
              }
            >
              <p className="text-xl font-bold">
                {formatCurrency(stats.highestPayment.amount, currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.highestPayment.accountName}
              </p>
            </StatTile>
          )}

          {/* Deuda más cara — by actual monthly interest cost */}
          {stats.mostExpensive && (
            <StatTile
              label="Deuda más cara"
              popoverContent={
                <PopoverList
                  items={stats.allByCost.map((e) => ({
                    label: e.accountName,
                    value: `${formatCurrency(e.interest, currency)} en intereses`,
                  }))}
                />
              }
            >
              <p className="text-xl font-bold text-z-expense">
                {formatCurrency(stats.mostExpensive.monthlyCost, currency)}
              </p>
              <p className="text-xs text-z-expense/70 mt-0.5">
                solo en intereses / mes
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.mostExpensive.accountName} · {stats.mostExpensive.rate.toFixed(1)}% EA
              </p>
            </StatTile>
          )}

          {/* Próximo pago */}
          {stats.nextPayment && (
            <StatTile
              label="Próximo pago"
              popoverContent={
                <PopoverList
                  items={stats.upcomingPayments.slice(0, 3).map((e) => ({
                    label: e.accountName,
                    value: e.daysUntil === 0
                      ? "Hoy"
                      : `${e.daysUntil} día${e.daysUntil === 1 ? "" : "s"}`,
                    detail: `Día ${e.paymentDay} del mes`,
                  }))}
                />
              }
            >
              <p className="text-xl font-bold">
                {stats.nextPayment.daysUntil}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {stats.nextPayment.daysUntil === 1 ? "día" : "días"}
                </span>
              </p>
              <p
                className={`text-xs mt-1 ${
                  stats.nextPayment.daysUntil <= 5
                    ? "text-z-alert"
                    : "text-muted-foreground"
                }`}
              >
                {stats.nextPayment.accountName}
              </p>
            </StatTile>
          )}
        </div>
      </div>

      {/* ── Tarjetas Row ── */}
      {hasCreditCards && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <CreditCard className="h-3 w-3 text-[#8b5cf6]" />
            <p className="text-[11px] text-[#8b5cf6] uppercase tracking-wider">
              Tarjetas de crédito
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Uso de tarjetas */}
            <StatTile
              label="Uso de tarjetas"
              popoverContent={
                <UtilizationPopoverList
                  items={stats.creditCards.utilization}
                  currency={currency}
                />
              }
            >
              <div className="text-center">
                <UtilizationRing percentage={overallUtilization} />
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(totalCreditUsed, currency)} /{" "}
                  {formatCurrency(totalCreditLimit, currency)}
                </p>
              </div>
            </StatTile>

            {/* Tarjetas / mes */}
            <StatTile
              label="Tarjetas / mes"
              popoverContent={
                <PopoverList
                  items={stats.creditCards.payments.map((e) => ({
                    label: e.accountName,
                    value: formatCurrency(e.amount, currency),
                  }))}
                />
              }
            >
              <p className="text-xl font-bold">
                {formatCurrency(stats.creditCards.monthlyPayment, currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.creditCards.count} tarjeta
                {stats.creditCards.count !== 1 ? "s" : ""}
              </p>
            </StatTile>

            {/* Intereses TC / mes */}
            <StatTile
              label="Intereses TC / mes"
              popoverContent={
                <PopoverList
                  items={stats.creditCards.interests.map((e) => ({
                    label: e.accountName,
                    value: formatCurrency(e.interest, currency),
                  }))}
                />
              }
            >
              <p className="text-xl font-bold text-z-expense">
                {formatCurrency(stats.creditCards.monthlyInterest, currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                de {stats.creditCards.count} tarjeta
                {stats.creditCards.count !== 1 ? "s" : ""}
              </p>
            </StatTile>
          </div>
        </div>
      )}

      {/* ── Préstamos Row ── */}
      {hasLoans && (
        <div>
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <HandCoins className="h-3 w-3 text-[#3b82f6]" />
            <p className="text-[11px] text-[#3b82f6] uppercase tracking-wider">
              Préstamos
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Préstamos / mes */}
            <StatTile
              label="Préstamos / mes"
              popoverContent={
                <PopoverList
                  items={stats.loans.payments.map((e) => ({
                    label: e.accountName,
                    value: formatCurrency(e.amount, currency),
                  }))}
                />
              }
            >
              <p className="text-xl font-bold">
                {formatCurrency(stats.loans.monthlyPayment, currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.loans.count} préstamo
                {stats.loans.count !== 1 ? "s" : ""}
              </p>
            </StatTile>

            {/* Plazo restante */}
            {stats.loans.remainingMonths ? (
              <StatTile
                label="Plazo restante"
                popoverContent={
                  <>
                    <p className="text-xs text-muted-foreground mb-2">
                      Estimado
                    </p>
                    <PopoverList
                      items={stats.loans.remainingList.map((e) => ({
                        label: e.accountName,
                        value: `${e.months} meses`,
                      }))}
                    />
                  </>
                }
              >
                <p className="text-xl font-bold">
                  {stats.loans.remainingMonths.months}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    meses
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.loans.remainingMonths.accountName}
                </p>
              </StatTile>
            ) : (
              <StatTile label="Plazo restante">
                <p className="text-sm text-muted-foreground">Sin datos</p>
              </StatTile>
            )}

            {/* Progreso */}
            {stats.loans.progress ? (
              <StatTile
                label="Progreso"
                popoverContent={
                  <ProgressPopoverList
                    items={stats.loans.progressList}
                    currency={currency}
                  />
                }
              >
                <div className="flex items-baseline gap-1.5 mb-2">
                  <p className="text-xl font-bold text-z-income">
                    {stats.loans.progress.percentage.toFixed(0)}%
                  </p>
                  <span className="text-xs text-muted-foreground">pagado</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-z-income rounded-full"
                    style={{
                      width: `${Math.min(stats.loans.progress.percentage, 100)}%`,
                    }}
                  />
                </div>
              </StatTile>
            ) : (
              <StatTile label="Progreso">
                <p className="text-sm text-muted-foreground">Sin datos</p>
              </StatTile>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

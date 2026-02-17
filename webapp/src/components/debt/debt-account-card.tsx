"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import {
  calcUtilization,
  estimateMonthlyInterest,
  daysUntilPayment,
  type DebtAccount,
} from "@/lib/utils/debt";
import type { CurrencyCode } from "@/types/domain";
import { CreditCard, HandCoins, Calendar } from "lucide-react";

export function DebtAccountCard({ account }: { account: DebtAccount }) {
  const utilization =
    account.type === "CREDIT_CARD"
      ? calcUtilization(account.balance, account.creditLimit)
      : null;
  const monthlyInterest = estimateMonthlyInterest(
    account.balance,
    account.interestRate
  );
  const daysUntil = daysUntilPayment(account.paymentDay);
  const hasBreakdown = account.currencyBreakdown && account.currencyBreakdown.length > 1;

  const Icon = account.type === "CREDIT_CARD" ? CreditCard : HandCoins;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{
                backgroundColor: `${account.color ?? "#6366f1"}20`,
              }}
            >
              <Icon
                className="h-4 w-4"
                style={{ color: account.color ?? "#6366f1" }}
              />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">
                {account.name}
              </CardTitle>
              {account.institutionName && (
                <p className="text-xs text-muted-foreground">
                  {account.institutionName}
                </p>
              )}
            </div>
          </div>
          <Badge
            variant="outline"
            className="text-xs"
          >
            {account.type === "CREDIT_CARD" ? "Tarjeta" : "Préstamo"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Balance — show primary + secondary currencies */}
        {hasBreakdown ? (
          <div className="space-y-1">
            {account.currencyBreakdown!.map((cb) => (
              <div key={cb.currency} className="flex items-baseline justify-between">
                <p className={cb.currency === account.currency ? "text-2xl font-bold" : "text-lg font-semibold text-muted-foreground"}>
                  {formatCurrency(cb.balance, cb.currency as CurrencyCode)}
                </p>
                <span className="text-xs text-muted-foreground">{cb.currency}</span>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <p className="text-2xl font-bold">
              {formatCurrency(account.balance, account.currency as CurrencyCode)}
            </p>
          </div>
        )}

        {/* Utilization bar for credit cards */}
        {hasBreakdown && account.type === "CREDIT_CARD" ? (
          <div className="space-y-2">
            {account.currencyBreakdown!
              .filter((cb) => cb.creditLimit && cb.creditLimit > 0)
              .map((cb) => {
                const util = calcUtilization(cb.balance, cb.creditLimit);
                return (
                  <div key={cb.currency} className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Uso {cb.currency}</span>
                      <span>{util.toFixed(0)}%</span>
                    </div>
                    <Progress
                      value={util}
                      className="h-1.5"
                    />
                    <p className="text-xs text-muted-foreground">
                      Cupo: {formatCurrency(cb.creditLimit!, cb.currency as CurrencyCode)}
                    </p>
                  </div>
                );
              })}
          </div>
        ) : utilization !== null && account.creditLimit ? (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Utilización</span>
              <span>{utilization.toFixed(0)}%</span>
            </div>
            <Progress
              value={utilization}
              className="h-1.5"
            />
            <p className="text-xs text-muted-foreground">
              Cupo: {formatCurrency(account.creditLimit, account.currency as CurrencyCode)}
            </p>
          </div>
        ) : null}

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {account.interestRate !== null && (
            <div>
              <p className="text-xs text-muted-foreground">Tasa</p>
              <p className="text-sm font-medium">{account.interestRate}% EA</p>
            </div>
          )}
          {monthlyInterest > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">Interés/mes</p>
              <p className="text-sm font-medium text-amber-600">
                {formatCurrency(monthlyInterest, account.currency as CurrencyCode)}
              </p>
            </div>
          )}
          {account.monthlyPayment !== null && (
            <div>
              <p className="text-xs text-muted-foreground">Cuota</p>
              <p className="text-sm font-medium">
                {formatCurrency(account.monthlyPayment, account.currency as CurrencyCode)}
              </p>
            </div>
          )}
          {daysUntil !== null && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Próximo pago</p>
                <p
                  className={`text-sm font-medium ${daysUntil <= 3 ? "text-amber-600" : ""}`}
                >
                  {daysUntil === 0
                    ? "Hoy"
                    : `${daysUntil} día${daysUntil === 1 ? "" : "s"}`}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

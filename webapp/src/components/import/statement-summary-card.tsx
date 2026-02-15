"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";
import type { ParsedStatement } from "@/types/import";

const STATEMENT_TYPE_LABELS: Record<string, string> = {
  savings: "Ahorros",
  credit_card: "Tarjeta de crédito",
};

export function StatementSummaryCard({
  statement,
}: {
  statement: ParsedStatement;
}) {
  const currency = statement.currency as CurrencyCode;
  const fmt = (n: number | null) =>
    n != null ? formatCurrency(n, currency) : "—";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base capitalize">
            {statement.bank}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{statement.currency}</Badge>
            <Badge variant="secondary">
              {STATEMENT_TYPE_LABELS[statement.statement_type] ??
                statement.statement_type}
            </Badge>
          </div>
        </div>
        {(statement.period_from || statement.period_to) && (
          <p className="text-xs text-muted-foreground">
            {statement.period_from} → {statement.period_to}
          </p>
        )}
        {statement.account_number && (
          <p className="text-xs text-muted-foreground">
            Cuenta: ****{statement.account_number.slice(-4)}
          </p>
        )}
        {statement.card_last_four && (
          <p className="text-xs text-muted-foreground">
            Tarjeta: ****{statement.card_last_four}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {statement.summary && (
            <>
              <div>
                <p className="text-muted-foreground text-xs">Saldo anterior</p>
                <p className="font-medium">
                  {fmt(statement.summary.previous_balance)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Abonos</p>
                <p className="font-medium text-emerald-600">
                  {fmt(statement.summary.total_credits)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Cargos</p>
                <p className="font-medium text-red-600">
                  {fmt(statement.summary.total_debits)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Saldo final</p>
                <p className="font-medium">
                  {fmt(statement.summary.final_balance)}
                </p>
              </div>
            </>
          )}
        </div>
        {statement.credit_card_metadata && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mt-3 pt-3 border-t">
            {statement.credit_card_metadata.credit_limit != null && (
              <div>
                <p className="text-muted-foreground text-xs">Cupo total</p>
                <p className="font-medium">
                  {fmt(statement.credit_card_metadata.credit_limit)}
                </p>
              </div>
            )}
            {statement.credit_card_metadata.available_credit != null && (
              <div>
                <p className="text-muted-foreground text-xs">Cupo disponible</p>
                <p className="font-medium text-emerald-600">
                  {fmt(statement.credit_card_metadata.available_credit)}
                </p>
              </div>
            )}
            {statement.credit_card_metadata.interest_rate != null && (
              <div>
                <p className="text-muted-foreground text-xs">Tasa de interés</p>
                <p className="font-medium">
                  {statement.credit_card_metadata.interest_rate}%
                </p>
              </div>
            )}
            {statement.credit_card_metadata.total_payment_due != null && (
              <div>
                <p className="text-muted-foreground text-xs">Total a pagar</p>
                <p className="font-medium text-red-600">
                  {fmt(statement.credit_card_metadata.total_payment_due)}
                </p>
              </div>
            )}
            {statement.credit_card_metadata.minimum_payment != null && (
              <div>
                <p className="text-muted-foreground text-xs">Pago mínimo</p>
                <p className="font-medium">
                  {fmt(statement.credit_card_metadata.minimum_payment)}
                </p>
              </div>
            )}
            {statement.credit_card_metadata.payment_due_date && (
              <div>
                <p className="text-muted-foreground text-xs">Fecha límite de pago</p>
                <p className="font-medium">
                  {statement.credit_card_metadata.payment_due_date}
                </p>
              </div>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          {statement.transactions.length} transacciones encontradas
        </p>
      </CardContent>
    </Card>
  );
}

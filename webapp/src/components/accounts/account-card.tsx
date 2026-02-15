"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import type { Account } from "@/types/domain";
import Link from "next/link";
import {
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

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: "Corriente",
  SAVINGS: "Ahorros",
  CREDIT_CARD: "Tarjeta de Crédito",
  CASH: "Efectivo",
  INVESTMENT: "Inversión",
  LOAN: "Préstamo",
  OTHER: "Otro",
};

export function AccountCard({ account }: { account: Account }) {
  const Icon = ACCOUNT_TYPE_ICONS[account.account_type] ?? Wallet;
  const isDebt = account.account_type === "CREDIT_CARD" || account.account_type === "LOAN";

  return (
    <Link href={`/accounts/${account.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${account.color}20` }}
            >
              <Icon className="h-5 w-5" style={{ color: account.color ?? undefined }} />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">{account.name}</CardTitle>
              {account.institution_name && (
                <p className="text-xs text-muted-foreground">
                  {account.institution_name}
                  {account.mask && ` ••${account.mask}`}
                </p>
              )}
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            {ACCOUNT_TYPE_LABELS[account.account_type]}
          </Badge>
        </CardHeader>
        <CardContent>
          <p
            className={`text-2xl font-bold ${isDebt && account.current_balance > 0 ? "text-orange-500" : ""}`}
          >
            {formatCurrency(account.current_balance, account.currency_code)}
          </p>
          {account.credit_limit && (
            <p className="text-xs text-muted-foreground mt-1">
              Límite: {formatCurrency(account.credit_limit, account.currency_code)}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

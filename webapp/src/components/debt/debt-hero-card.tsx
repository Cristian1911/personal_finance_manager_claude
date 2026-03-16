"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import { Landmark } from "lucide-react";
import type { CurrencyCode } from "@/types/domain";
import type { DebtByCurrency } from "@zeta/shared";

interface DebtHeroCardProps {
  totalDebt: number;
  secondaryCurrencies?: DebtByCurrency[];
}

export function DebtHeroCard({ totalDebt, secondaryCurrencies }: DebtHeroCardProps) {
  return (
    <Card className="border-z-expense/20 bg-gradient-to-br from-z-expense/5 to-z-expense/5">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-z-expense/10">
            <Landmark className="h-8 w-8 text-z-expense" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Deuda total</p>
            <p className="text-3xl font-bold">
              {formatCurrency(totalDebt)}
            </p>
            {secondaryCurrencies && secondaryCurrencies.length > 0 && (
              <div className="flex gap-2 mt-1">
                {secondaryCurrencies.map((d) => (
                  <p key={d.currency} className="text-sm text-muted-foreground">
                    + {formatCurrency(d.totalDebt, d.currency as CurrencyCode)}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

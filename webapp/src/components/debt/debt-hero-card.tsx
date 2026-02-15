"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import { Landmark } from "lucide-react";

export function DebtHeroCard({ totalDebt }: { totalDebt: number }) {
  return (
    <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10">
            <Landmark className="h-8 w-8 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Deuda total</p>
            <p className="text-3xl font-bold">
              {formatCurrency(totalDebt)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

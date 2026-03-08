"use client";

import { formatCurrency } from "@/lib/utils/currency";
import { freshnessMap } from "@/lib/utils/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Receipt, Banknote, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { DashboardHeroData } from "@/actions/charts";
import type { CurrencyCode } from "@/types/domain";

interface DashboardHeroProps {
  data: DashboardHeroData;
}

export function DashboardHero({ data }: DashboardHeroProps) {
  const { totalLiquid, totalPending, availableToSpend, freshness, pendingObligations, currency } = data;
  const f = freshnessMap[freshness];
  const code = currency as CurrencyCode;

  return (
    <div className="space-y-3">
      {/* Main number */}
      <div>
        <p className="text-sm text-muted-foreground">Disponible para gastar</p>
        <p className={`text-4xl font-bold tracking-tight ${availableToSpend < 0 ? "text-red-600" : ""}`}>
          {formatCurrency(availableToSpend, code)}
        </p>
      </div>

      {/* 3 sub-cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Saldo total</span>
            </div>
            <p className="text-lg font-semibold">
              {formatCurrency(totalLiquid, code)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Fijos pendientes</span>
            </div>
            <p className="text-lg font-semibold">
              {formatCurrency(totalPending, code)}
            </p>
            <p className="text-xs text-muted-foreground">
              {pendingObligations.length} {pendingObligations.length === 1 ? "pago" : "pagos"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Libre</span>
            </div>
            <p className={`text-lg font-semibold ${availableToSpend < 0 ? "text-red-600" : "text-emerald-600"}`}>
              {formatCurrency(availableToSpend, code)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Freshness indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${f.dot}`} />
          <span className="text-xs text-muted-foreground">{f.label}</span>
        </div>
        {freshness === "outdated" && (
          <Link href="/import">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              <RefreshCw className="h-3 w-3" />
              Actualizar saldos
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

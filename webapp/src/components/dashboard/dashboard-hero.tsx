import { formatCurrency } from "@/lib/utils/currency";
import { freshnessMap } from "@/lib/utils/dashboard";
import { KPIWidget } from "@/components/ui/kpi-widget";
import { Button } from "@/components/ui/button";
import { Wallet, Receipt, Banknote, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { DashboardHeroData } from "@/actions/charts";
import type { CurrencyCode } from "@/types/domain";

interface DashboardHeroProps {
  data: DashboardHeroData;
}

export function DashboardHero({ data }: DashboardHeroProps) {
  const { totalLiquid, totalPending, availableToSpend, freshness, pendingObligations, currency, hasOtherCurrencies } = data;
  const f = freshnessMap[freshness];
  const code = currency as CurrencyCode;

  return (
    <div className="space-y-3">
      {/* Main number */}
      <div>
        <p className="text-sm text-muted-foreground">
          Disponible para gastar
          <span className="text-sm font-normal text-muted-foreground ml-2">En {data.currency}</span>
        </p>
        <p className={`text-4xl font-bold tracking-tight ${availableToSpend < 0 ? "text-z-debt" : ""}`}>
          {formatCurrency(availableToSpend, code)}
        </p>
        {hasOtherCurrencies && (
          <p className="text-xs text-muted-foreground mt-1">
            Tienes cuentas en otras monedas no incluidas en estos totales.
          </p>
        )}
      </div>

      {/* 3 sub-cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KPIWidget
          label="Saldo total"
          value={formatCurrency(totalLiquid, code)}
          icon={<Wallet className="size-4" />}
          semanticColor="neutral"
        />
        <KPIWidget
          label="Fijos pendientes"
          value={formatCurrency(totalPending, code)}
          trend={{ direction: "flat", text: `${pendingObligations.length} ${pendingObligations.length === 1 ? "pago" : "pagos"}` }}
          icon={<Receipt className="size-4" />}
          semanticColor="expense"
        />
        <KPIWidget
          label="Libre"
          value={formatCurrency(availableToSpend, code)}
          icon={<Banknote className="size-4" />}
          semanticColor={availableToSpend < 0 ? "debt" : "income"}
        />
      </div>

      {/* Freshness indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${f.dot}`} />
          <span className="text-xs text-muted-foreground">{f.label}</span>
        </div>
        {freshness === "outdated" && (
          <Link href="#quick-update-values">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              <RefreshCw className="h-3 w-3" />
              Actualizar valores
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

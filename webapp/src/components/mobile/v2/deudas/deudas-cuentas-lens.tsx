import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS, MOBILE_EYEBROW_CLASS } from "@/lib/constants/styles";
import { DebtAccountRow } from "@/components/debt/debt-account-row";
import { ExchangeRateNudge } from "@/components/debt/exchange-rate-nudge";
import type { CurrencyCode } from "@/types/domain";
import type { DebtOverview, DebtStats } from "@zeta/shared";
import type { PersonasSummary, ExchangeRateInfo } from "./deudas-lens-root";

interface DeudasCuentasLensProps {
  overview: DebtOverview;
  stats: DebtStats;
  personasSummary: PersonasSummary | null;
  exchangeRate: ExchangeRateInfo | null;
  currency: CurrencyCode;
}

export function DeudasCuentasLens({
  overview,
  stats,
  personasSummary,
  exchangeRate,
  currency,
}: DeudasCuentasLensProps) {
  const remainingByName = new Map(
    stats.loans.remainingList.map((e) => [e.accountName, e.months])
  );

  const secondaryCurrencies = overview.debtByCurrency.filter(
    (d) => d.currency !== currency && d.totalDebt > 0
  );

  return (
    <div className="space-y-3">
      {/* Header tiles: cupo ring + total debt */}
      <div className="grid grid-cols-2 gap-3">
        <div className={cn(PANEL_INSET_CLASS, "flex flex-col items-center p-3.5")}>
          <UtilizationRing percentage={overview.overallUtilization} />
          <p className={cn(MOBILE_EYEBROW_CLASS, "mt-2")}>
            Uso del cupo
          </p>
        </div>
        <div className={cn(PANEL_INSET_CLASS, "flex flex-col items-center justify-center p-3.5")}>
          <p className="text-[18px] font-[680] tabular-nums tracking-[-0.03em]">
            {formatCurrency(overview.totalDebt, currency)}
          </p>
          <p className={cn(MOBILE_EYEBROW_CLASS, "mt-2")}>
            Deuda total
          </p>
        </div>
      </div>

      {/* Canonical account list */}
      <div className="space-y-2">
        {overview.accounts.map((a) => (
          <DebtAccountRow
            key={a.id}
            href="/accounts"
            account={{
              id: a.id,
              name: a.name,
              type: a.type as "CREDIT_CARD" | "LOAN",
              balance: a.balance,
              currency: a.currency,
              creditLimit: a.creditLimit ?? null,
              interestRate: a.interestRate ?? null,
              monthlyPayment: a.monthlyPayment ?? null,
              cutoffDay: a.cutoffDay ?? null,
              remainingMonths: remainingByName.get(a.name) ?? null,
              otherCurrencies: a.currencyBreakdown
                ?.filter((cb) => cb.currency !== a.currency && cb.balance > 0)
                .map((cb) => ({ currency: cb.currency, balance: cb.balance })),
            }}
          />
        ))}
      </div>

      {/* Personas chip */}
      {personasSummary && personasSummary.activeCount > 0 && (
        <Link
          href="/deudas-personales"
          className={cn(
            PANEL_INSET_CLASS,
            "flex items-center justify-between p-3 active:opacity-80"
          )}
        >
          <div className="flex items-center gap-2">
            <Users className="size-4 text-z-brass" />
            <span className="text-xs">
              {personasSummary.activeCount} deuda
              {personasSummary.activeCount !== 1 ? "s" : ""} con personas
            </span>
          </div>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {personasSummary.owedToMeTotal > 0 &&
              `te deben ${formatCurrency(personasSummary.owedToMeTotal, currency)}`}
            {personasSummary.owedToMeTotal > 0 && personasSummary.iOweTotal > 0 && " · "}
            {personasSummary.iOweTotal > 0 &&
              `debes ${formatCurrency(personasSummary.iOweTotal, currency)}`}
            <ArrowRight className="size-3" />
          </span>
        </Link>
      )}

      {/* Multi-currency context */}
      {exchangeRate && secondaryCurrencies.length > 0 && (
        <ExchangeRateNudge
          rate={exchangeRate.rate}
          avg30d={exchangeRate.avg30d}
          percentVsAvg={exchangeRate.percentVsAvg}
          from={exchangeRate.from}
          to={currency}
        />
      )}
    </div>
  );
}

function UtilizationRing({ percentage }: { percentage: number }) {
  const r = 16;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(100, percentage) / 100);
  const hot = percentage > 60;
  return (
    <div className="relative shrink-0" style={{ width: 44, height: 44 }}>
      <svg width="44" height="44" viewBox="0 0 40 40" className="-rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" className="stroke-white/6" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          className={hot ? "stroke-z-debt" : "stroke-z-brass"}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center text-[10px] font-bold",
          hot ? "text-z-debt" : "text-z-brass"
        )}
      >
        {percentage.toFixed(0)}%
      </div>
    </div>
  );
}

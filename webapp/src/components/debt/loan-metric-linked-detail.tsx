"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { LinkedMetricDetailPanel, type MetricChip } from "@/components/mobile/v2/linked-metric-detail-panel";
import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import type { DebtStats } from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";

interface LoanMetricLinkedDetailProps {
  stats: DebtStats;
  currency: CurrencyCode;
}

export function LoanMetricLinkedDetail({
  stats,
  currency,
}: LoanMetricLinkedDetailProps) {
  const { activeZone, toggle } = useExpandableZone<string>();
  const hasLoans = stats.loans.count > 0;

  if (!hasLoans) return null;

  const chips: MetricChip[] = [
    {
      id: "prestamos-mes",
      label: "Préstamos / mes",
      value: formatCurrency(stats.loans.monthlyPayment, currency),
      accent: "brass",
    },
    {
      id: "mas-cerca",
      label: "Más cerca de salir",
      value: stats.loans.remainingMonths
        ? `${stats.loans.remainingMonths.months}m`
        : "—",
      accent: "income",
    },
  ];

  function renderDetail(chipId: string) {
    if (chipId === "prestamos-mes") {
      return (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-brass">
            Desglose por préstamo
          </p>
          {stats.loans.payments.map((p) => (
            <div
              key={p.accountName}
              className="flex items-center justify-between text-xs text-z-sage-light"
            >
              <span className="truncate mr-2">{p.accountName}</span>
              <span className="shrink-0">
                {formatCurrency(p.amount, currency)}
              </span>
            </div>
          ))}
          <div className="flex justify-between border-t border-white/10 pt-1.5 text-xs font-semibold text-z-white">
            <span>Total</span>
            <span>
              {formatCurrency(stats.loans.monthlyPayment, currency)}
            </span>
          </div>
        </div>
      );
    }

    if (chipId === "mas-cerca") {
      return (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-income">
            Plazo restante estimado
          </p>
          {stats.loans.remainingList.length > 0 ? (
            stats.loans.remainingList.map((r) => (
              <div
                key={r.accountName}
                className="space-y-1"
              >
                <div className="flex justify-between text-xs text-z-sage-light">
                  <span className="truncate mr-2">{r.accountName}</span>
                  <span className="shrink-0">{r.months} meses</span>
                </div>
                {stats.loans.progressList.find(
                  (p) => p.accountName === r.accountName
                ) && (
                  <div className="h-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-z-income"
                      style={{
                        width: `${Math.min(
                          stats.loans.progressList.find(
                            (p) => p.accountName === r.accountName
                          )?.percentage ?? 0,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">
              Sin datos de plazo
            </p>
          )}
        </div>
      );
    }

    return null;
  }

  return (
    <LinkedMetricDetailPanel
      chips={chips}
      activeChip={activeZone}
      onToggle={toggle}
      renderDetail={renderDetail}
    />
  );
}

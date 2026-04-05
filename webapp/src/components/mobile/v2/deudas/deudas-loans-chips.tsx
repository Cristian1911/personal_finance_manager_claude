"use client";

import { useCallback } from "react";
import { formatCurrency } from "@/lib/utils/currency";
import { LinkedMetricDetailPanel, type MetricChip } from "@/components/mobile/v2/linked-metric-detail-panel";
import { useExpandableZone } from "@/components/mobile/v2/use-expandable-zone";
import type { DebtStats } from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";

interface DeudasLoansChipsProps {
  stats: DebtStats;
  currency: CurrencyCode;
  sectionActive: boolean;
  onActivate: () => void;
}

export function DeudasLoansChips({
  stats,
  currency,
  sectionActive,
  onActivate,
}: DeudasLoansChipsProps) {
  const { activeZone, toggle: internalToggle } = useExpandableZone<string>();

  // When the section is deactivated by the parent, force collapse
  const effectiveActiveZone = sectionActive ? activeZone : null;

  const toggle = useCallback(
    (id: string) => {
      // Tell the parent this section is now active
      if (!sectionActive) onActivate();
      internalToggle(id);
    },
    [sectionActive, onActivate, internalToggle]
  );

  if (stats.loans.count === 0) return null;

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
        ? `${stats.loans.progress?.percentage.toFixed(0) ?? 0}%`
        : "—",
      accent: "income",
    },
  ];

  function renderDetail(chipId: string) {
    if (chipId === "prestamos-mes") {
      return (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-brass">
            Desglose por préstamo
          </p>
          {stats.loans.payments.map((p) => (
            <div key={p.accountName} className="flex justify-between text-xs text-z-sage-light">
              <span className="truncate mr-2">{p.accountName}</span>
              <span className="shrink-0">{formatCurrency(p.amount, currency)}</span>
            </div>
          ))}
        </div>
      );
    }

    if (chipId === "mas-cerca" && stats.loans.remainingMonths) {
      return (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-income">
            Progreso de préstamos
          </p>
          {stats.loans.progressList.map((progress) => {
            const pct = progress.percentage ?? 0;
            const remaining = stats.loans.remainingList.find(
              (r) => r.accountName === progress.accountName
            );
            return (
              <div key={progress.accountName} className="space-y-1">
                <p className="text-[11px] font-medium text-z-sage-light">
                  {progress.accountName}
                </p>
                {/* Progress bar */}
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-z-brass"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {pct.toFixed(0)}% pagado · {formatCurrency(progress.original - progress.paid, currency)} restantes
                  {remaining ? ` · ${remaining.months}m` : ""}
                </p>
              </div>
            );
          })}
        </div>
      );
    }

    return null;
  }

  return (
    <LinkedMetricDetailPanel
      chips={chips}
      activeChip={effectiveActiveZone}
      onToggle={toggle}
      renderDetail={renderDetail}
    />
  );
}

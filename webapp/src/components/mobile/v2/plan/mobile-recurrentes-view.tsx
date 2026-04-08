"use client";

import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { HERO_CARD_GRADIENT_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode, UpcomingRecurrence } from "@/types/domain";
import type { PlanRecurringSummary } from "@/types/plan";

interface MobileRecurrentesViewProps {
  summary: PlanRecurringSummary;
  currency: CurrencyCode;
}

export function MobileRecurrentesView({ summary, currency }: MobileRecurrentesViewProps) {
  // All upcoming items are pending — "confirmed" state is tracked client-side
  // in the desktop checklist and not available in the server summary
  const pending: UpcomingRecurrence[] = summary.upcoming;

  return (
    <div className="space-y-4 pb-20">
      {/* Hero card */}
      <div className={`rounded-2xl border border-white/6 ${HERO_CARD_GRADIENT_CLASS} p-4`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-brass">
          Compromiso mensual
        </p>
        <p className="mt-1 text-3xl font-bold">
          {formatCurrency(summary.totalMonthlyExpenses, currency)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {summary.activeCount} plantillas activas
        </p>

        <div className="my-3 h-px bg-white/6" />

        <div className="flex justify-between text-center">
          <div>
            <p className="text-[10px] text-amber-400">Pendientes</p>
            <p className="text-lg font-semibold text-amber-400">{summary.dueSoonCount}</p>
          </div>
          <div>
            <p className="text-[10px] text-emerald-400">Ingresos/mes</p>
            <p className="text-lg font-semibold text-emerald-400">
              {formatCurrency(summary.totalMonthlyIncome, currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Proximo</p>
            {pending[0] ? (
              <p className="text-xs font-semibold">
                {pending[0].template.description} · {formatDate(new Date(pending[0].next_date), "dd MMM")}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">—</p>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming list */}
      {pending.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
            Proximos
          </p>
          <div className="divide-y divide-white/5">
            {pending.map((item, i) => (
              <div key={`${item.template.id}-${i}`} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-xs font-medium">{item.template.description}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDate(new Date(item.next_date), "dd MMM yyyy")}
                    {item.template.account && ` · ${item.template.account.name}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-red-400">
                    {formatCurrency(item.template.amount ?? 0, currency)}
                  </p>
                  <span className="rounded-md bg-z-brass/10 px-2 py-0.5 text-[10px] text-z-brass">
                    Confirmar
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

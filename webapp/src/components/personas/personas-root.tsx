"use client";

import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { summaryCurrencies, totalForCurrency } from "@/lib/personal-debts/totals";
import { PersonDebtCard } from "./person-debt-card";
import { NewDebtMenu } from "./new-debt-menu";
import type { HierarchyOverview, PersonDebtSummary } from "@/lib/personal-debts/hierarchy";
import type { CurrencyCode } from "@/types/domain";

interface PersonasRootProps {
  people: PersonDebtSummary[];
  overview: HierarchyOverview;
  currency: CurrencyCode;
  /** Person to open on arrival (deep link from the /deudas summary). */
  focusId?: string | null;
}

/**
 * Deudas personales: one card per person, their viajes collapsed inside,
 * every expense a row you can open. The three totals on top answer "¿cómo
 * voy?" before any card is opened.
 */
export function PersonasRoot({ people, overview, currency, focusId = null }: PersonasRootProps) {
  const currencyRows = summaryCurrencies(overview.iOwe.totals, overview.owedToMe.totals, currency).map((code) => {
    const owe = totalForCurrency(overview.iOwe.totals, code);
    const owed = totalForCurrency(overview.owedToMe.totals, code);
    return { code, owe, owed, neto: owed - owe };
  });
  const activePeople = people.filter((p) => p.activeCount > 0).length;

  if (people.length === 0) {
    return (
      <EmptyState
        icon={<Users className="size-6" strokeWidth={1.5} />}
        title="¿Quién te debe y a quién le debes?"
        description="Registra el dinero que pediste prestado o que prestaste a una persona, o reparte un gasto entre varios, para no perderle el rastro."
        footer={<NewDebtMenu currency={currency} />}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Resumen — una fila por moneda, nunca sumadas entre sí */}
      <div className="space-y-3">
        {currencyRows.map((row, i) => (
          <div key={row.code}>
            {currencyRows.length > 1 && <p className={cn(SECTION_EYEBROW_CLASS, "mb-1.5")}>{row.code}</p>}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <SummaryStat label="Me deben" value={formatCurrency(row.owed, row.code as CurrencyCode)} tone="positive" />
              <SummaryStat label="Debo" value={formatCurrency(row.owe, row.code as CurrencyCode)} tone="danger" />
              <SummaryStat
                label="Neto"
                value={formatCurrency(row.neto, row.code as CurrencyCode)}
                tone={row.neto < 0 ? "danger" : "positive"}
              />
            </div>
            {i === 0 && currencyRows.length > 1 && (
              <p className="mt-2 text-[11px] text-muted-foreground">Los totales no se suman entre monedas.</p>
            )}
          </div>
        ))}
      </div>

      {overview.overdue.length > 0 && (
        <div className="rounded-xl border border-z-alert/25 bg-z-alert/8 px-4 py-3">
          <p className={cn(SECTION_EYEBROW_CLASS, "text-z-alert")}>
            {overview.overdue.length === 1 ? "1 deuda vencida" : `${overview.overdue.length} deudas vencidas`}
          </p>
          <ul className="mt-2 space-y-1">
            {overview.overdue.map((d, i) => (
              <li key={`${d.destinatario_name}-${d.due_date}-${i}`} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{d.destinatario_name}</span>
                <span className="shrink-0 tabular-nums text-z-alert">
                  {formatCurrency(d.amount, d.currency_code as CurrencyCode)} · venció {formatDate(d.due_date)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className={SECTION_EYEBROW_CLASS}>
          {people.length} {people.length === 1 ? "persona" : "personas"}
          {activePeople > 0 && activePeople < people.length ? ` · ${activePeople} con saldo` : ""}
        </p>
      </div>

      <div className="space-y-3">
        {people.map((p, i) => (
          <PersonDebtCard
            key={p.destinatario_id}
            person={p}
            currency={currency}
            // Open the people with something pending (up to three) so the
            // page lands on the answer; the rest are one tap away. A deep
            // link from /deudas opens that person too.
            defaultOpen={p.destinatario_id === focusId || (p.activeCount > 0 && i < 3)}
          />
        ))}
      </div>
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone: "danger" | "positive" }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/6 bg-black/10 p-3 sm:p-4">
      <p className={SECTION_EYEBROW_CLASS}>{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-base font-semibold tabular-nums sm:text-lg",
          tone === "danger" ? "text-z-debt" : "text-z-sage-light",
        )}
      >
        {value}
      </p>
    </div>
  );
}

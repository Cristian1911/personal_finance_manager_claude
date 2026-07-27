"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BRASS_BUTTON_CLASS,
  BRASS_GHOST_BUTTON_CLASS,
  SECTION_EYEBROW_CLASS,
  SEGMENTED_TAB_CLASS,
  SEGMENTED_TAB_ACTIVE_CLASS,
} from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { summaryCurrencies, totalForCurrency } from "@/lib/personal-debts/totals";
import { PersonaCard } from "./persona-card";
import { CreatePersonalDebtSheet } from "./create-personal-debt-sheet";
import { SharedPaymentCard } from "./shared-payment-card";
import type {
  PersonalDebtWithDetails,
  CurrencyCode,
  SharedPaymentGroup,
} from "@/types/domain";
import type { PersonalDebtsOverview } from "@/actions/personal-debts";

interface PersonasRootProps {
  debts: PersonalDebtWithDetails[];
  overview: PersonalDebtsOverview;
  currency: CurrencyCode;
  sharedGroups: SharedPaymentGroup[];
}

export function PersonasRoot({ debts, overview, currency, sharedGroups }: PersonasRootProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  // Shared-payment debts live in their own grouped cards — keep them out of the
  // standalone Debo / Me deben lists to avoid showing each person twice.
  const standalone = debts.filter((d) => !d.split_group_id);
  const debo = standalone.filter((d) => d.direction === "borrowed" && d.status === "active");
  const meDeben = standalone.filter((d) => d.direction === "lent" && d.status === "active");
  const settled = standalone.filter((d) => d.status !== "active");
  // One summary row per currency — Debo/Me deben/Neto are only meaningful
  // within a single currency, never as a COP+USD sum.
  const currencyRows = summaryCurrencies(
    overview.iOwe.totals,
    overview.owedToMe.totals,
    currency,
  ).map((code) => {
    const owe = totalForCurrency(overview.iOwe.totals, code);
    const owed = totalForCurrency(overview.owedToMe.totals, code);
    return { code, owe, owed, neto: owed - owe };
  });
  const hasContent = debts.length > 0 || sharedGroups.length > 0;
  const personalesCount = debo.length + meDeben.length;

  // Land on Compartidas only when there's nothing person-to-person to show.
  const [tab, setTab] = useState<"personales" | "compartidas">(
    personalesCount === 0 && sharedGroups.length > 0 ? "compartidas" : "personales",
  );

  return (
    <div className="space-y-6">
      {/* Resumen — una fila por moneda */}
      <div className="space-y-3">
        {currencyRows.map((row, i) => (
          <div key={row.code}>
            {currencyRows.length > 1 && (
              <p className={cn(SECTION_EYEBROW_CLASS, "mb-1.5")}>{row.code}</p>
            )}
            <div className="grid grid-cols-3 gap-3">
              <SummaryStat
                label="Debo"
                value={formatCurrency(row.owe, row.code as CurrencyCode)}
                tone="danger"
              />
              <SummaryStat
                label="Me deben"
                value={formatCurrency(row.owed, row.code as CurrencyCode)}
                tone="positive"
              />
              <SummaryStat
                label="Neto"
                value={formatCurrency(row.neto, row.code as CurrencyCode)}
                tone={row.neto < 0 ? "danger" : "positive"}
              />
            </div>
            {i === 0 && currencyRows.length > 1 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Los totales no se suman entre monedas.
              </p>
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

      {!hasContent ? (
        <>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              className={cn(BRASS_GHOST_BUTTON_CLASS)}
              onClick={() => router.push("/deudas-personales/pago-compartido/nuevo")}
            >
              <Receipt className="mr-1.5 size-4" />
              Pago compartido
            </Button>
            <Button className={cn(BRASS_BUTTON_CLASS)} onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              Nueva deuda personal
            </Button>
          </div>
          <EmptyState />
        </>
      ) : (
        <>
          {/* División: deudas persona-a-persona vs. facturas compartidas */}
          <div
            role="tablist"
            aria-label="Tipo de deuda"
            className="flex gap-1 rounded-full border border-white/6 bg-black/10 p-1"
            onKeyDown={(e) => {
              // Roving-tabindex nav: arrows move (and activate) between the two
              // tabs so keyboard users don't Tab through each one.
              let next: "personales" | "compartidas" | null = null;
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                next = tab === "personales" ? "compartidas" : "personales";
              } else if (e.key === "Home") next = "personales";
              else if (e.key === "End") next = "compartidas";
              if (!next) return;
              e.preventDefault();
              setTab(next);
              document.getElementById(`deudas-tab-${next}`)?.focus();
            }}
          >
            <button
              role="tab"
              type="button"
              id="deudas-tab-personales"
              aria-controls="deudas-panel-personales"
              aria-selected={tab === "personales"}
              tabIndex={tab === "personales" ? 0 : -1}
              onClick={() => setTab("personales")}
              className={cn(tab === "personales" ? SEGMENTED_TAB_ACTIVE_CLASS : SEGMENTED_TAB_CLASS)}
            >
              Personales
              {personalesCount > 0 && (
                <span className="ml-1.5 text-[10px] tabular-nums opacity-70">{personalesCount}</span>
              )}
            </button>
            <button
              role="tab"
              type="button"
              id="deudas-tab-compartidas"
              aria-controls="deudas-panel-compartidas"
              aria-selected={tab === "compartidas"}
              tabIndex={tab === "compartidas" ? 0 : -1}
              onClick={() => setTab("compartidas")}
              className={cn(tab === "compartidas" ? SEGMENTED_TAB_ACTIVE_CLASS : SEGMENTED_TAB_CLASS)}
            >
              Compartidas
              {sharedGroups.length > 0 && (
                <span className="ml-1.5 text-[10px] tabular-nums opacity-70">{sharedGroups.length}</span>
              )}
            </button>
          </div>

          {tab === "personales" ? (
            <div
              role="tabpanel"
              id="deudas-panel-personales"
              aria-labelledby="deudas-tab-personales"
              className="space-y-6"
            >
              <div className="flex justify-end">
                <Button className={cn(BRASS_BUTTON_CLASS)} onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1.5 size-4" />
                  Nueva deuda personal
                </Button>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <Section
                  title="Debo"
                  items={debo}
                  currency={currency}
                  emptyLabel="No le debes a nadie."
                />
                <Section
                  title="Me deben"
                  items={meDeben}
                  currency={currency}
                  emptyLabel="Nadie te debe."
                />
              </div>
              {settled.length > 0 && (
                <Section title="Saldadas y canceladas" items={settled} currency={currency} muted />
              )}
            </div>
          ) : (
            <div
              role="tabpanel"
              id="deudas-panel-compartidas"
              aria-labelledby="deudas-tab-compartidas"
              className="space-y-4"
            >
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  className={cn(BRASS_GHOST_BUTTON_CLASS)}
                  onClick={() => router.push("/deudas-personales/pago-compartido/nuevo")}
                >
                  <Receipt className="mr-1.5 size-4" />
                  Nuevo pago compartido
                </Button>
              </div>
              {sharedGroups.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {sharedGroups.map((g) => (
                    <SharedPaymentCard key={g.split_group_id} group={g} currency={currency} />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-white/6 px-4 py-8 text-center text-sm text-muted-foreground">
                  Aún no tienes facturas compartidas. Reparte un gasto entre varias personas.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Conditionally mounted so internal state resets on every open. */}
      {createOpen && (
        <CreatePersonalDebtSheet open={createOpen} onOpenChange={setCreateOpen} currency={currency} />
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "danger" | "positive";
}) {
  return (
    <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
      <p className={SECTION_EYEBROW_CLASS}>{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          tone === "danger" ? "text-z-debt" : "text-z-sage-light",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Section({
  title,
  items,
  currency,
  emptyLabel,
  muted,
}: {
  title: string;
  items: PersonalDebtWithDetails[];
  currency: CurrencyCode;
  emptyLabel?: string;
  muted?: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className={cn(SECTION_EYEBROW_CLASS, muted && "opacity-70")}>
        {title}
      </h2>
      {items.length === 0 ? (
        emptyLabel ? <p className="text-sm text-muted-foreground">{emptyLabel}</p> : null
      ) : (
        <div className="space-y-3">
          {items.map((d) => (
            <PersonaCard key={d.id} persona={d} currency={currency} />
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-z-brass/12 text-z-brass">
        <Users className="size-6" />
      </span>
      <p className="text-base font-medium">¿Quién te debe y a quién le debes?</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Registra el dinero que pediste prestado o que prestaste a una persona para
        no perderle el rastro.
      </p>
    </div>
  );
}

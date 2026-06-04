"use client";

import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { PersonaCard } from "./persona-card";
import { CreatePersonalDebtSheet } from "./create-personal-debt-sheet";
import type { PersonalDebtWithDetails, CurrencyCode } from "@/types/domain";
import type { PersonalDebtsOverview } from "@/actions/personal-debts";

interface PersonasRootProps {
  debts: PersonalDebtWithDetails[];
  overview: PersonalDebtsOverview;
  currency: CurrencyCode;
}

export function PersonasRoot({ debts, overview, currency }: PersonasRootProps) {
  const [createOpen, setCreateOpen] = useState(false);

  const debo = debts.filter((d) => d.direction === "borrowed" && d.status === "active");
  const meDeben = debts.filter((d) => d.direction === "lent" && d.status === "active");
  const settled = debts.filter((d) => d.status !== "active");
  const neto = overview.owedToMe.total - overview.iOwe.total;

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryStat label="Debo" value={formatCurrency(overview.iOwe.total, currency)} tone="danger" />
        <SummaryStat
          label="Me deben"
          value={formatCurrency(overview.owedToMe.total, currency)}
          tone="positive"
        />
        <SummaryStat
          label="Neto"
          value={formatCurrency(neto, currency)}
          tone={neto < 0 ? "danger" : "positive"}
        />
      </div>

      <div className="flex justify-end">
        <Button className={cn(BRASS_BUTTON_CLASS)} onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 size-4" />
          Nueva cuenta con persona
        </Button>
      </div>

      {debts.length === 0 ? (
        <EmptyState />
      ) : (
        <>
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
        </>
      )}

      <CreatePersonalDebtSheet open={createOpen} onOpenChange={setCreateOpen} currency={currency} />
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
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
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
      <h2
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.18em]",
          muted ? "text-muted-foreground" : "text-z-sage-light",
        )}
      >
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

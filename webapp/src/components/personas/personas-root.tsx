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
} from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
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
  const neto = overview.owedToMe.total - overview.iOwe.total;
  const hasContent = debts.length > 0 || sharedGroups.length > 0;

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

      {!hasContent ? (
        <EmptyState />
      ) : (
        <>
          {sharedGroups.length > 0 && (
            <section className="space-y-3">
              <h2 className={SECTION_EYEBROW_CLASS}>Pagos compartidos</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {sharedGroups.map((g) => (
                  <SharedPaymentCard key={g.split_group_id} group={g} currency={currency} />
                ))}
              </div>
            </section>
          )}
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

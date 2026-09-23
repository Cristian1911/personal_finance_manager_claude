"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BRASS_GHOST_BUTTON_CLASS,
  ICON_TRIGGER_CLASS,
  INLINE_EXPAND_TOGGLE_CLASS,
  PANEL_INSET_CLASS,
  PANEL_SURFACE_SUBTLE_CLASS,
  SECTION_EYEBROW_CLASS,
} from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { promoteAdHocDestinatario } from "@/actions/destinatarios";
import { PersonAvatar } from "./person-avatar";
import { DebtGroupSection } from "./debt-group-section";
import { DebtRow } from "./debt-row";
import { RecordGroupedRepaymentDialog } from "./record-grouped-repayment-dialog";
import { BALANCE_TONE_CLASS as TONE_CLASS, balanceLine } from "@/lib/personal-debts/person-rollup";
import type { PersonCurrencyTotals, PersonDebtSummary } from "@/lib/personal-debts/hierarchy";
import type { CurrencyCode } from "@/types/domain";

interface PersonDebtCardProps {
  person: PersonDebtSummary;
  currency: CurrencyCode;
  defaultOpen: boolean;
}

/**
 * Level 1 of the hierarchy: the person. Header = who and how much is
 * still open; body = their viajes (each collapsible) and their loose debts.
 */
export function PersonDebtCard({ person, currency, defaultOpen }: PersonDebtCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [showSettled, setShowSettled] = useState(false);
  const [repayAll, setRepayAll] = useState<PersonCurrencyTotals | null>(null);
  const [pending, startTransition] = useTransition();

  const multiCurrency = person.totals.length > 1;
  const [primary, ...others] = person.totals;
  const headline = primary ? balanceLine(primary) : { label: "Al día", amount: 0, tone: "even" as const };
  const tripCount = new Set(person.groups.map((g) => g.modo.id)).size;
  const metaParts: string[] = [];
  if (tripCount > 0) metaParts.push(`${tripCount} ${tripCount === 1 ? "viaje" : "viajes"}`);
  if (person.loose.length > 0) metaParts.push(`${person.loose.length} ${person.loose.length === 1 ? "deuda suelta" : "deudas sueltas"}`);
  if (person.overdueCount > 0) metaParts.push(`${person.overdueCount} vencida${person.overdueCount === 1 ? "" : "s"}`);
  if (person.activeCount === 0) metaParts.push("Todo saldado");

  // "Pagar todo lo pendiente" only makes sense in one direction per currency —
  // the grouped abono refuses to mix what you owe with what they owe you.
  function repayAllTargets(t: PersonCurrencyTotals) {
    const direction: "lent" | "borrowed" = t.owedToMe >= t.iOwe ? "lent" : "borrowed";
    const ids = [
      ...person.groups.filter((g) => g.currency_code === t.currency_code && g.direction === direction).flatMap((g) => g.items),
      ...person.loose.filter((i) => i.currency_code === t.currency_code && i.direction === direction),
    ]
      .filter((i) => i.status === "active")
      .map((i) => i.id);
    const outstanding = direction === "lent" ? t.owedToMe : t.iOwe;
    return { ids, direction, outstanding };
  }
  const primaryRepay = primary ? repayAllTargets(primary) : null;
  const showRepayAll =
    !!primaryRepay && primaryRepay.ids.length > 1 && primaryRepay.outstanding > 0 && !(primary!.owedToMe > 0 && primary!.iOwe > 0);

  return (
    <section
      id={`persona-${person.destinatario_id}`}
      className={cn(PANEL_SURFACE_SUBTLE_CLASS, "scroll-mt-20 overflow-hidden")}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <PersonAvatar name={person.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-z-sage-light">{person.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{metaParts.join(" · ")}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className={cn(SECTION_EYEBROW_CLASS, "block", TONE_CLASS[headline.tone])}>{headline.label}</span>
          <span className={cn("block text-lg font-semibold tabular-nums leading-tight", TONE_CLASS[headline.tone])}>
            {headline.tone === "even"
              ? "—"
              : formatCurrency(headline.amount, (primary?.currency_code ?? currency) as CurrencyCode)}
          </span>
          {others.map((t) => {
            const line = balanceLine(t);
            return (
              <span key={t.currency_code} className={cn("block text-xs tabular-nums", TONE_CLASS[line.tone])}>
                {line.tone === "even" ? null : `${line.label === "Le debes" || line.label === "Le debes (neto)" ? "−" : "+"}${formatCurrency(line.amount, t.currency_code as CurrencyCode)}`}
              </span>
            );
          })}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-white/6 px-3 pb-3 pt-3 sm:px-4">
          {(showRepayAll || person.is_ad_hoc) && (
            <div className="flex flex-wrap items-center gap-2">
              {showRepayAll && primary && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={cn(BRASS_GHOST_BUTTON_CLASS)}
                  onClick={() => setRepayAll(primary)}
                >
                  {primaryRepay!.direction === "borrowed" ? "Pagar todo" : "Registrar pago total"}
                  {multiCurrency ? ` (${primary.currency_code})` : ""}
                </Button>
              )}
              {person.is_ad_hoc && (
                <button
                  type="button"
                  disabled={pending}
                  className={cn(ICON_TRIGGER_CLASS, "inline-flex items-center gap-1 text-xs")}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await promoteAdHocDestinatario(person.destinatario_id);
                      if (res.success) {
                        toast.success(`${person.name} guardado como contacto`);
                        router.refresh();
                      } else toast.error(res.error ?? "No se pudo guardar el contacto");
                    })
                  }
                >
                  <UserPlus className="size-3.5" />
                  Guardar como contacto
                </button>
              )}
            </div>
          )}

          {person.groups.map((g) => (
            <DebtGroupSection
              key={g.key}
              group={g}
              personName={person.name}
              currency={currency}
              showCurrency={multiCurrency}
            />
          ))}

          {person.loose.length > 0 && (
            <div>
              {person.groups.length > 0 && (
                <p className={cn(SECTION_EYEBROW_CLASS, "px-3 pb-1.5")}>Otras deudas</p>
              )}
              <div className={cn(PANEL_INSET_CLASS, "divide-y divide-white/6")}>
                {person.loose.map((item) => (
                  <DebtRow key={item.id} item={item} currency={currency} />
                ))}
              </div>
            </div>
          )}

          {person.settled.length > 0 && (
            <div className={PANEL_INSET_CLASS}>
              <button
                type="button"
                className={cn(INLINE_EXPAND_TOGGLE_CLASS, "border-t-0 text-muted-foreground")}
                onClick={() => setShowSettled((v) => !v)}
                aria-expanded={showSettled}
              >
                {showSettled ? "Ocultar saldadas" : `Saldadas y canceladas (${person.settled.length})`}
              </button>
              {showSettled && (
                <div className="divide-y divide-white/6 border-t border-white/6">
                  {person.settled.map((item) => (
                    <DebtRow key={item.id} item={item} currency={currency} muted />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {repayAll && primaryRepay && (
        <RecordGroupedRepaymentDialog
          open={!!repayAll}
          onOpenChange={(o) => !o && setRepayAll(null)}
          debtIds={primaryRepay.ids}
          personName={person.name}
          scopeLabel="todo lo pendiente"
          outstandingAmount={primaryRepay.outstanding}
          currency={repayAll.currency_code as CurrencyCode}
          direction={primaryRepay.direction}
          defaultAccountId={person.groups[0]?.origin_account_id ?? null}
        />
      )}
    </section>
  );
}

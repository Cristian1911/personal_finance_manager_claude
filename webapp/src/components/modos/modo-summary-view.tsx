"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { settleUpByPerson, type ModoSummary, type ModoTxRow } from "@/lib/utils/modo-summary";
import { shareModoTransactions, unshareModoTransactions } from "@/actions/modos";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RecordRepaymentDialog } from "@/components/personas/record-repayment-dialog";
import { useDestinatarios } from "@/components/providers/app-data-provider";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import type { CurrencyCode, Modo, ModoParticipant, SharedPaymentGroup } from "@/types/domain";

export function ModoSummaryView({
  modo,
  summary,
  sharedGroups,
  transactions,
  participants,
}: {
  modo: Modo;
  summary: ModoSummary;
  sharedGroups: SharedPaymentGroup[];
  transactions: ModoTxRow[];
  participants: ModoParticipant[];
}) {
  const applyHref = `/transactions?tags=${modo.tag_ids.join(",")}&dateFrom=${modo.date_from}&dateTo=${modo.date_to}`;
  const destinatarios = useDestinatarios();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [repayFor, setRepayFor] = useState<
    { debtId: string; name: string; outstanding: number; currency: CurrencyCode } | null
  >(null);

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runShareAll() {
    startTransition(async () => {
      const r = await shareModoTransactions(modo.id);
      if (r.success) {
        toast.success(
          `${r.data.shared} repartidos · ${r.data.skipped.length} omitidos · ${r.data.failed.length} con error`,
        );
      } else toast.error(r.error);
    });
  }
  function runShareSelected() {
    startTransition(async () => {
      const r = await shareModoTransactions(modo.id, [...selected]);
      if (r.success) {
        toast.success(`${r.data.shared} repartidos`);
        setSelected(new Set());
      } else toast.error(r.error);
    });
  }
  function runUnshareSelected() {
    startTransition(async () => {
      const r = await unshareModoTransactions(modo.id, [...selected]);
      if (r.success) {
        toast.success(`${r.data.unshared} quitados de compartidos`);
        setSelected(new Set());
      } else toast.error(r.error);
    });
  }

  const people = modo.is_shared
    ? settleUpByPerson(sharedGroups, transactions.map((t) => t.id))
    : [];
  // Miembros del pool aún sin pagos compartidos → mostrarlos en $0 para que el
  // modo compartido revele con quién se comparte antes de repartir nada.
  const nameById = new Map(destinatarios.map((d) => [d.id, d.name]));
  const withDebts = new Set(people.map((p) => p.destinatarioId));
  const emptyMembers = modo.is_shared
    ? participants.filter((mp) => !withDebts.has(mp.destinatario_id))
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      {/* Bloque 1: header total + conteo */}
      <header className="space-y-1">
        <Link href={applyHref} className="text-sm text-z-brass hover:underline">
          Ver en Movimientos →
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
          {modo.emoji ?? "📍"} {modo.name}
        </h1>
        <p className="text-3xl font-bold tabular-nums">{formatCurrency(summary.total)}</p>
        <p className="text-sm text-muted-foreground">
          {summary.count} transacciones ·{" "}
          {formatDate(summary.observedFrom ?? modo.date_from, "d MMM")} –{" "}
          {formatDate(summary.observedTo ?? modo.date_to, "d MMM yyyy")}
        </p>
        {modo.is_shared && (
          <Button
            type="button"
            onClick={runShareAll}
            disabled={pending}
            className={cn(BRASS_BUTTON_CLASS, "mt-2 disabled:opacity-60")}
          >
            Compartir todos los pagos
          </Button>
        )}
      </header>

      {/* Bloque 2: por categoría */}
      {summary.byCategory.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">Por categoría</h2>
          {summary.byCategory.map((b) => (
            <div key={b.categoryId ?? b.name} className="flex justify-between text-sm">
              <span>
                {b.name} <span className="text-muted-foreground">({b.count})</span>
              </span>
              <span className="tabular-nums">{formatCurrency(b.total)}</span>
            </div>
          ))}
        </section>
      )}

      {/* Bloque 3: saldo por persona (solo pagos de este modo) + miembros sin pagos aún */}
      {modo.is_shared && (people.length > 0 || emptyMembers.length > 0) && (
        <section className="space-y-2">
          <h2 className="font-medium">Saldo por persona</h2>
          {people.map((p) => (
            <div
              key={`${p.destinatarioId}|${p.currency}`}
              className="flex items-center justify-between rounded-xl border border-white/6 bg-z-surface-2 px-3 py-2 text-sm"
            >
              <span>{p.name}</span>
              <span className="flex items-center gap-3">
                <span className="tabular-nums text-muted-foreground">
                  pendiente {formatCurrency(p.outstanding, p.currency as CurrencyCode)}
                </span>
                {/* ponytail: abono a la deuda activa más antigua de la persona en el modo (FIFO);
                    tope = saldo de ESA deuda (no el agregado); allocation multi-deuda si se pide. */}
                {p.oldestActiveDebtId && p.oldestActiveDebtOutstanding > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={GHOST_BUTTON_CLASS}
                    onClick={() =>
                      setRepayFor({
                        debtId: p.oldestActiveDebtId!,
                        name: p.name,
                        outstanding: p.oldestActiveDebtOutstanding,
                        currency: p.currency as CurrencyCode,
                      })
                    }
                  >
                    Registrar abono
                  </Button>
                )}
              </span>
            </div>
          ))}
          {emptyMembers.map((mp) => (
            <div
              key={mp.id}
              className="flex items-center justify-between rounded-xl border border-white/6 bg-z-surface-2 px-3 py-2 text-sm"
            >
              <span>{nameById.get(mp.destinatario_id) ?? "Persona"}</span>
              <span className="text-muted-foreground">Sin pagos compartidos aún</span>
            </div>
          ))}
        </section>
      )}

      {/* Bloque 4: lista de transacciones */}
      {transactions.length > 0 && (
        <section className="space-y-1">
          <h2 className="font-medium">Transacciones</h2>
          {transactions.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 border-b border-white/6 py-1.5 text-sm"
            >
              {modo.is_shared && t.direction === "OUTFLOW" && (
                <Checkbox
                  checked={selected.has(t.id)}
                  onCheckedChange={() => toggle(t.id)}
                  aria-label={`Seleccionar ${t.category?.name_es ?? t.category?.name ?? "transacción"} del ${formatDate(t.transaction_date, "d MMM")}`}
                />
              )}
              <span className="flex-1">
                {t.category?.name_es ?? t.category?.name ?? "Sin categoría"} ·{" "}
                {formatDate(t.transaction_date, "d MMM")}
              </span>
              <span className="tabular-nums">{formatCurrency(t.amount ?? 0)}</span>
            </div>
          ))}
        </section>
      )}

      {/* Barra de selección (mínima; el BulkActionBar de categorizar es específico).
          Anclada sobre el tab bar + FAB con el mismo calc que MOBILE_TAB_BAR_CLEARANCE. */}
      {modo.is_shared && selected.size > 0 && (
        <div className="fixed bottom-[calc(var(--z-mobile-tab-bar-h)_+_var(--z-mobile-fab-overshoot)_+_env(safe-area-inset-bottom))] left-1/2 z-[var(--z-layer-nav)] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-white/6 bg-z-surface-2 px-4 py-3 shadow-lg">
          <span className="text-sm">
            {selected.size} {selected.size === 1 ? "seleccionada" : "seleccionadas"}
          </span>
          <span className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={runShareSelected}
              disabled={pending}
              className={cn(BRASS_BUTTON_CLASS, "disabled:opacity-60")}
            >
              Compartir
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={runUnshareSelected}
              disabled={pending}
              className={cn(GHOST_BUTTON_CLASS, "disabled:opacity-60")}
            >
              Quitar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
              className={GHOST_BUTTON_CLASS}
            >
              Limpiar
            </Button>
          </span>
        </div>
      )}

      {repayFor && (
        <RecordRepaymentDialog
          open={!!repayFor}
          onOpenChange={(o) => !o && setRepayFor(null)}
          personalDebtId={repayFor.debtId}
          personName={repayFor.name}
          outstandingAmount={repayFor.outstanding}
          currency={repayFor.currency}
        />
      )}
    </div>
  );
}

"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ExternalLink, MoreHorizontal, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import {
  classifyModoTx,
  describeModoTx,
  indexSharedGroups,
  isModoSpend,
  modoDatePosition,
  settleUpByPerson,
  summarizeShared,
  summarizeSpendSplit,
  txCurrency,
  type ModoTxRow,
} from "@/lib/utils/modo-summary";
import { removeFromModo, shareModoTransactions, unshareModoTransactions, type ModoDetail } from "@/actions/modos";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CompactMetricBox } from "@/components/ui/stat-card";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { TagChip } from "@/components/tags/tag-chip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RecordRepaymentDialog } from "@/components/personas/record-repayment-dialog";
import { ModoActions } from "@/components/modos/modo-actions";
import { useAllTags, useDestinatarios } from "@/components/providers/app-data-provider";
import {
  BRASS_BUTTON_CLASS,
  BRASS_GHOST_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  ICON_TRIGGER_CLASS,
  PANEL_INSET_CLASS,
  PANEL_SURFACE_CLASS,
  chipToggleClass,
} from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import type { CurrencyCode, SharedPaymentGroup } from "@/types/domain";

type Filter = "all" | "unshared" | "shared" | "other";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "unshared", label: "Solo míos" },
  { id: "shared", label: "Compartidos" },
  { id: "other", label: "Otros" },
];

const cur = (c: string) => c as CurrencyCode;

export function ModoSummaryView({
  modo,
  summary,
  sharedGroups,
  transactions,
  participants,
  candidatesCount,
  reviewSources,
}: ModoDetail) {
  const router = useRouter();
  const destinatarios = useDestinatarios();
  const allTags = useAllTags();
  // No date bounds: a tagged row outside the trip's dates is still the trip's.
  const applyHref = `/transactions?tags=${modo.tag_ids.join(",")}`;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, startTransition] = useTransition();
  const [repayFor, setRepayFor] = useState<
    { debtId: string; name: string; outstanding: number; currency: CurrencyCode; accountId: string | null } | null
  >(null);

  // ── Derived numbers ────────────────────────────────────────────────────
  const txIds = useMemo(() => transactions.map((t) => t.id), [transactions]);
  const groupsBySplit = useMemo(() => indexSharedGroups(sharedGroups), [sharedGroups]);
  const sharedTotals = useMemo(() => summarizeShared(sharedGroups, txIds), [sharedGroups, txIds]);
  const people = modo.is_shared ? settleUpByPerson(sharedGroups, txIds) : [];
  const spendRows = useMemo(() => transactions.filter(isModoSpend), [transactions]);
  const spendSplit = useMemo(() => summarizeSpendSplit(spendRows, sharedTotals), [spendRows, sharedTotals]);
  const listRef = useRef<HTMLElement>(null);
  function chooseWhatToShare() {
    setFilter("unshared");
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const sharedRows = spendRows.filter((t) => !!t.split_group_id);
  const unsharedIds = spendRows.filter((t) => !t.split_group_id).map((t) => t.id);
  const modoTagIds = new Set(modo.tag_ids);
  const modoTags = allTags.filter((t) => modoTagIds.has(t.id));
  const nameById = new Map((destinatarios ?? []).map((d) => [d.id, d.name]));
  const withDebts = new Set(people.map((p) => p.destinatarioId));
  const emptyMembers = modo.is_shared ? participants.filter((mp) => !withDebts.has(mp.destinatario_id)) : [];
  const otherTotals = summary.totals.slice(1);
  const multiCurrency = summary.totals.length > 1;

  // Category share bars are per currency; the max is taken within each.
  const categoryMax = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of summary.byCategory) m.set(b.currency, Math.max(m.get(b.currency) ?? 0, b.total));
    return m;
  }, [summary.byCategory]);

  // ── Rows (filter + day grouping) ───────────────────────────────────────
  const visibleRows = useMemo(() => {
    return transactions.filter((t) => {
      const kind = classifyModoTx(t);
      if (filter === "all") return true;
      if (filter === "other") return kind !== "spend";
      if (kind !== "spend") return false;
      return filter === "shared" ? !!t.split_group_id : !t.split_group_id;
    });
  }, [transactions, filter]);
  const byDay = useMemo(() => {
    const map = new Map<string, ModoTxRow[]>();
    for (const t of visibleRows) {
      const arr = map.get(t.transaction_date) ?? [];
      arr.push(t);
      map.set(t.transaction_date, arr);
    }
    return [...map.entries()];
  }, [visibleRows]);

  // ── Actions ────────────────────────────────────────────────────────────
  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function run(work: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const r = await work();
      if (r.ok) {
        toast.success(r.message);
        setSelected(new Set());
        router.refresh();
      } else toast.error(r.message);
    });
  }
  const share = (ids: string[]) =>
    run(async () => {
      const r = await shareModoTransactions(modo.id, ids);
      if (!r.success) return { ok: false, message: r.error };
      const parts = [`${r.data.shared} ${r.data.shared === 1 ? "repartido" : "repartidos"}`];
      if (r.data.skipped.length) parts.push(`${r.data.skipped.length} ya estaban`);
      if (r.data.failed.length) parts.push(`${r.data.failed.length} con error`);
      return { ok: true, message: parts.join(" · ") };
    });
  const unshare = (ids: string[]) =>
    run(async () => {
      const r = await unshareModoTransactions(modo.id, ids);
      return r.success ? { ok: true, message: `${r.data.unshared} sin repartir` } : { ok: false, message: r.error };
    });
  const remove = (ids: string[]) =>
    run(async () => {
      const r = await removeFromModo(modo.id, ids);
      return r.success
        ? { ok: true, message: `${r.data.removed} ${r.data.removed === 1 ? "movimiento quitado" : "movimientos quitados"} del viaje` }
        : { ok: false, message: r.error };
    });

  const range = `${formatDate(summary.observedFrom ?? modo.date_from, "d MMM")} – ${formatDate(summary.observedTo ?? modo.date_to, "d MMM yyyy")}`;
  const actions = <ModoActions modo={modo} applyHref={applyHref} />;

  return (
    <div className="space-y-6">
      {/* Desktop header */}
      <div className="hidden lg:flex lg:items-start lg:justify-between lg:gap-4">
        <div className="min-w-0">
          <SectionEyebrow>Viajes y eventos</SectionEyebrow>
          <h1 className="text-3xl font-semibold tracking-tight">
            <span aria-hidden>{modo.emoji ?? "📍"}</span> {modo.name}
          </h1>
          <p className="text-muted-foreground">
            {formatDate(modo.date_from, "d MMM")} – {formatDate(modo.date_to, "d MMM yyyy")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="ghost" className={GHOST_BUTTON_CLASS}>
            <Link href={`/transactions/new?modo=${modo.id}`}>
              <Plus className="size-4" />
              Agregar gasto
            </Link>
          </Button>
          {actions}
        </div>
      </div>
      {/* Mobile header actions live in the page's MobileHeader; keep the
          title line here so the emoji/name/tags read the same on both. */}
      <div className="flex items-start justify-between gap-3 lg:hidden">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            <span aria-hidden>{modo.emoji ?? "📍"}</span> {modo.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(modo.date_from, "d MMM")} – {formatDate(modo.date_to, "d MMM yyyy")}
          </p>
        </div>
        {actions}
      </div>
      {modoTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {modoTags.map((t) => (
            <TagChip key={t.id} tag={t} size="sm" />
          ))}
          <Link href={applyHref} className="ml-1 inline-flex items-center gap-1 text-xs text-z-brass hover:underline">
            Ver en Movimientos <ExternalLink className="size-3" />
          </Link>
        </div>
      )}

      {/* Hero */}
      <section className={cn(PANEL_SURFACE_CLASS, "space-y-4 p-4 lg:p-5")}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <SectionEyebrow>Total del viaje</SectionEyebrow>
            <p className="text-3xl font-bold tabular-nums tracking-tight lg:text-4xl">
              {formatCurrency(summary.total, cur(summary.currency))}
            </p>
            {otherTotals.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {otherTotals.map((t) => `+ ${formatCurrency(t.total, cur(t.currency))} en ${t.currency}`).join(" · ")}
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.count} {summary.count === 1 ? "gasto" : "gastos"}
              {summary.count > 0 ? ` · ${range}` : ""}
            </p>
          </div>
          {modo.is_active && (
            <span className="rounded-full border border-z-brass/30 bg-z-brass/10 px-2.5 py-1 text-xs font-medium text-z-brass">
              Viaje activo
            </span>
          )}
        </div>

        {modo.is_shared ? (
          <div className="space-y-3">
            {spendSplit.length === 0 ? (
              <p className="text-sm text-muted-foreground">Cuando haya gastos, aquí verás cuánto es tuyo y cuánto te deben.</p>
            ) : (
              spendSplit.map((sp) => (
                <div key={sp.currency} className="space-y-2">
                  {spendSplit.length > 1 && <p className="text-xs text-muted-foreground">{sp.currency}</p>}
                  <div className="grid grid-cols-3 gap-2">
                    <CompactMetricBox
                      label="Tu parte"
                      value={<span className="tabular-nums">{formatCurrency(sp.yourPart, cur(sp.currency))}</span>}
                      context={
                        sp.sharedCount > 0
                          ? `${formatCurrency(sp.ownOnlyTotal, cur(sp.currency))} solo tuyos`
                          : "nada compartido aún"
                      }
                    />
                    <CompactMetricBox
                      label="Te deben"
                      value={
                        <span className={cn("tabular-nums", sp.outstanding > 0 ? "text-z-brass" : "text-z-income")}>
                          {formatCurrency(sp.outstanding, cur(sp.currency))}
                        </span>
                      }
                      context={sp.sharedCount === 0 ? "—" : sp.outstanding > 0 ? "pendiente" : "todo saldado"}
                    />
                    <CompactMetricBox
                      label="Recuperado"
                      value={<span className="tabular-nums">{formatCurrency(sp.recovered, cur(sp.currency))}</span>}
                      context={sp.sharedCount > 0 ? `de ${formatCurrency(sp.owedToUser, cur(sp.currency))}` : "—"}
                    />
                  </div>
                </div>
              ))
            )}
            {spendRows.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  {sharedRows.length} {sharedRows.length === 1 ? "compartido" : "compartidos"} · {unsharedIds.length}{" "}
                  {unsharedIds.length === 1 ? "solo mío" : "solo míos"}
                </span>
                {unsharedIds.length > 0 && (
                  <span className="flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" onClick={chooseWhatToShare} className={GHOST_BUTTON_CLASS}>
                      Elegir qué repartir
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => share(unsharedIds)}
                      disabled={pending}
                      className={BRASS_GHOST_BUTTON_CLASS}
                    >
                      Repartir todos los pendientes
                    </Button>
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className={cn(PANEL_INSET_CLASS, "flex flex-wrap items-center justify-between gap-3 p-3")}>
            <p className="text-sm text-muted-foreground">
              <Users className="mr-1.5 inline size-4 text-z-brass" />
              ¿Lo compartiste con alguien? Reparte estos gastos y lleva la cuenta de lo que te deben.
            </p>
            <Button asChild variant="ghost" size="sm" className={BRASS_GHOST_BUTTON_CLASS}>
              <Link href={`/modos/${modo.id}/edit?step=2`}>Repartir con alguien</Link>
            </Button>
          </div>
        )}
      </section>

      {/* Por revisar */}
      {candidatesCount > 0 && (
        <Link
          href={`/modos/${modo.id}/revisar`}
          className={cn(PANEL_SURFACE_CLASS, "flex items-center justify-between gap-3 border-z-alert/30 p-4 transition-colors hover:bg-z-surface-3")}
        >
          <div>
            <p className="font-medium">
              {candidatesCount} {candidatesCount === 1 ? "movimiento" : "movimientos"} en estas fechas{" "}
              {candidatesCount === 1 ? "podría ser" : "podrían ser"} del viaje
            </p>
            <p className="text-sm text-muted-foreground">Importados o sin etiqueta. Revísalos en un toque.</p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-z-alert" />
        </Link>
      )}

      {/* Saldo por persona */}
      {modo.is_shared && (people.length > 0 || emptyMembers.length > 0) && (
        <section className="space-y-2">
          <SectionEyebrow>Saldo por persona</SectionEyebrow>
          {people.map((p) => (
            <div
              key={`${p.destinatarioId}|${p.currency}`}
              className={cn(PANEL_INSET_CLASS, "flex items-center justify-between gap-3 px-3 py-2.5 text-sm")}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  le corresponde {formatCurrency(p.principal, cur(p.currency))}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={cn("tabular-nums", p.outstanding > 0 ? "text-z-brass" : "text-z-income")}>
                  {p.outstanding > 0 ? `debe ${formatCurrency(p.outstanding, cur(p.currency))}` : "al día"}
                </span>
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
                        currency: cur(p.currency),
                        accountId:
                          sharedGroups.find((g) => g.debts.some((d) => d.id === p.oldestActiveDebtId))
                            ?.origin_account_id ?? null,
                      })
                    }
                  >
                    Registrar abono
                  </Button>
                )}
              </div>
            </div>
          ))}
          {emptyMembers.map((mp) => (
            <div key={mp.id} className={cn(PANEL_INSET_CLASS, "flex items-center justify-between px-3 py-2.5 text-sm")}>
              <span>{nameById.get(mp.destinatario_id) ?? "Persona"}</span>
              <span className="text-muted-foreground">Sin gastos repartidos aún</span>
            </div>
          ))}
        </section>
      )}

      {/* Por categoría */}
      {summary.byCategory.length > 0 && (
        <section className="space-y-2">
          <SectionEyebrow>Por categoría</SectionEyebrow>
          <div className={cn(PANEL_INSET_CLASS, "divide-y divide-white/6")}>
            {summary.byCategory.map((b) => {
              const max = categoryMax.get(b.currency) ?? b.total;
              const pct = max > 0 ? Math.max(4, Math.round((b.total / max) * 100)) : 0;
              return (
                <div key={`${b.currency}|${b.categoryId ?? b.name}`} className="space-y-1.5 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      {b.name} <span className="text-muted-foreground">({b.count})</span>
                      {multiCurrency && <span className="ml-1 text-xs text-muted-foreground">{b.currency}</span>}
                    </span>
                    <span className="shrink-0 tabular-nums">{formatCurrency(b.total, cur(b.currency))}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/6">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: b.color ?? "var(--z-brass)" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Gastos */}
      <section ref={listRef} className="scroll-mt-16 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionEyebrow>Movimientos del viaje</SectionEyebrow>
          {modo.is_shared && (
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                  className={chipToggleClass(filter === f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {transactions.length === 0 ? (
          <div className={cn(PANEL_INSET_CLASS, "space-y-3 p-4 text-sm text-muted-foreground")}>
            <p>
              Todavía no hay movimientos con {modoTags.length === 1 ? "la etiqueta" : "las etiquetas"} del viaje en
              estas fechas.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" className={BRASS_BUTTON_CLASS}>
                <Link href={`/transactions/new?modo=${modo.id}`}>Agregar gasto</Link>
              </Button>
              {candidatesCount > 0 && (
                <Button asChild variant="ghost" size="sm" className={GHOST_BUTTON_CLASS}>
                  <Link href={`/modos/${modo.id}/revisar`}>Revisar {candidatesCount} del rango</Link>
                </Button>
              )}
            </div>
          </div>
        ) : visibleRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada en este filtro.</p>
        ) : (
          <div className="space-y-4">
            {byDay.map(([day, rows]) => (
              <div key={day} className="space-y-1">
                <p className="px-1 text-xs font-medium text-muted-foreground">{formatDate(day, "EEEE d MMM")}</p>
                <div className={cn(PANEL_INSET_CLASS, "divide-y divide-white/6")}>
                  {rows.map((t) => (
                    <ModoTxItem
                      key={t.id}
                      tx={t}
                      datePosition={modoDatePosition(t.transaction_date, modo)}
                      isShared={modo.is_shared}
                      selected={selected.has(t.id)}
                      onToggle={() => toggle(t.id)}
                      group={t.split_group_id ? groupsBySplit.get(t.split_group_id) : undefined}
                      modoTagIds={modoTagIds}
                      reviewSource={reviewSources[t.id]}
                      pending={pending}
                      onShare={() => share([t.id])}
                      onUnshare={() => unshare([t.id])}
                      onRemove={() => remove([t.id])}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Selection bar — anchored above the tab bar + FAB */}
      {selected.size > 0 && (
        <div className="fixed bottom-[calc(var(--z-mobile-tab-bar-h)_+_var(--z-mobile-fab-overshoot)_+_env(safe-area-inset-bottom))] left-1/2 z-[var(--z-layer-nav)] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border border-white/6 bg-z-surface-2 px-4 py-3 shadow-lg lg:bottom-6">
          <span className="text-sm">
            {selected.size} {selected.size === 1 ? "seleccionado" : "seleccionados"}
          </span>
          {modo.is_shared && (
            <>
              <Button size="sm" onClick={() => share([...selected])} disabled={pending} className={cn(BRASS_BUTTON_CLASS, "disabled:opacity-60")}>
                Repartir
              </Button>
              <Button variant="ghost" size="sm" onClick={() => unshare([...selected])} disabled={pending} className={GHOST_BUTTON_CLASS}>
                Quitar reparto
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => remove([...selected])} disabled={pending} className={GHOST_BUTTON_CLASS}>
            Quitar del viaje
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} className={GHOST_BUTTON_CLASS}>
            Limpiar
          </Button>
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
          defaultAccountId={repayFor.accountId}
        />
      )}
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────
function statusChip(
  tx: ModoTxRow,
  isShared: boolean,
  group: SharedPaymentGroup | undefined,
): { label: string; tone: "brass" | "income" | "muted" } | null {
  const kind = classifyModoTx(tx);
  if (kind === "transfer") return { label: "Transferencia", tone: "muted" };
  if (kind === "person") return { label: "Deuda personal", tone: "muted" };
  if (kind === "excluded") return { label: "Excluido", tone: "muted" };
  if (kind === "inflow") return { label: "Ingreso", tone: "muted" };
  if (tx.split_group_id) {
    const outstanding = group?.outstanding_total ?? 0;
    return outstanding > 0
      ? { label: `Compartido · te deben ${formatCurrency(outstanding, cur(group?.currency_code ?? txCurrency(tx)))}`, tone: "brass" }
      : { label: "Compartido · saldado", tone: "income" };
  }
  return isShared ? { label: "Solo mío", tone: "muted" } : null;
}

function ModoTxItem({
  tx,
  datePosition,
  isShared,
  selected,
  onToggle,
  group,
  modoTagIds,
  reviewSource,
  pending,
  onShare,
  onUnshare,
  onRemove,
}: {
  tx: ModoTxRow;
  datePosition: "before" | "during" | "after";
  isShared: boolean;
  selected: boolean;
  onToggle: () => void;
  group?: SharedPaymentGroup;
  modoTagIds: Set<string>;
  reviewSource?: "auto" | "suggested" | "manual";
  pending: boolean;
  onShare: () => void;
  onUnshare: () => void;
  onRemove: () => void;
}) {
  const kind = classifyModoTx(tx);
  const selectable = kind === "spend";
  const chip = statusChip(tx, isShared, group);
  const extraTags = (tx.transaction_tags ?? [])
    .map((tt) => tt.tag)
    .filter((t): t is NonNullable<typeof t> => !!t && !modoTagIds.has(t.id));
  const meta = [tx.account?.name, tx.category?.name_es ?? tx.category?.name, tx.destinatario?.name].filter(Boolean);
  const amountClass =
    kind === "inflow" ? "text-z-income" : kind === "spend" ? "text-foreground" : "text-muted-foreground";

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      {selectable ? (
        <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Seleccionar ${describeModoTx(tx)}`} />
      ) : (
        <span className="size-4 shrink-0" aria-hidden />
      )}
      <Link href={`/transactions/${tx.id}`} className="min-w-0 flex-1">
        <span className="block truncate text-sm">{describeModoTx(tx)}</span>
        <span className="block truncate text-xs text-muted-foreground">{meta.join(" · ") || "Sin cuenta"}</span>
        {(extraTags.length > 0 || reviewSource === "auto" || datePosition !== "during") && (
          <span className="mt-1 flex flex-wrap items-center gap-1">
            {datePosition !== "during" && (
              <span className="rounded-full border border-white/6 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {datePosition === "before" ? "Antes del viaje" : "Después del viaje"}
              </span>
            )}
            {reviewSource === "auto" && (
              <span className="rounded-full border border-z-brass/30 bg-z-brass/10 px-1.5 py-0.5 text-[10px] text-z-brass">
                Auto ✈️
              </span>
            )}
            {extraTags.map((t) => (
              <TagChip key={t.id} tag={t} size="sm" />
            ))}
          </span>
        )}
      </Link>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={cn("text-sm tabular-nums", amountClass)}>
          {kind === "inflow" ? "+" : ""}
          {formatCurrency(tx.amount ?? 0, cur(txCurrency(tx)))}
        </span>
        {chip && isShared && kind === "spend" ? (
          // One tap decides whether THIS expense is shared with the trip's
          // people or stays yours — not every buy on a trip is a shared one.
          <button
            type="button"
            onClick={tx.split_group_id ? onUnshare : onShare}
            disabled={pending}
            aria-pressed={!!tx.split_group_id}
            aria-label={tx.split_group_id ? "Compartido · tocar para dejarlo solo mío" : "Solo mío · tocar para compartirlo"}
            className={cn(
              "max-w-[46vw] truncate rounded-full border px-1.5 py-0.5 text-[10px] transition-colors disabled:opacity-60 lg:max-w-none",
              chip.tone === "brass" && "border-z-brass/30 bg-z-brass/10 text-z-brass hover:bg-z-brass/20",
              chip.tone === "income" && "border-z-income/30 bg-z-income/10 text-z-income hover:bg-z-income/20",
              chip.tone === "muted" && "border-white/10 text-muted-foreground hover:border-z-brass/30 hover:text-z-brass",
            )}
          >
            {chip.label}
          </button>
        ) : chip && (
          <span
            className={cn(
              "max-w-[46vw] truncate rounded-full border px-1.5 py-0.5 text-[10px] lg:max-w-none",
              chip.tone === "brass" && "border-z-brass/30 bg-z-brass/10 text-z-brass",
              chip.tone === "income" && "border-z-income/30 bg-z-income/10 text-z-income",
              chip.tone === "muted" && "border-white/6 text-muted-foreground",
            )}
          >
            {chip.label}
          </span>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Acciones del movimiento" className={cn(ICON_TRIGGER_CLASS, "shrink-0 p-1.5")} disabled={pending}>
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/transactions/${tx.id}`}>Ver movimiento</Link>
          </DropdownMenuItem>
          {isShared && kind === "spend" && (
            tx.split_group_id ? (
              <DropdownMenuItem onSelect={onUnshare}>Quitar reparto</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={onShare}>Repartir</DropdownMenuItem>
            )
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onRemove}>
            No fue del viaje
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

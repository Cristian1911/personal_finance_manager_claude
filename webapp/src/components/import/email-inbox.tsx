"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  Inbox,
  Loader2,
  Mail,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import { TagZonePicker } from "@/components/tags/tag-zone-picker";
import { EmailReconcileDialog } from "@/components/import/email-reconcile-dialog";
import {
  useAccounts,
  useCategories,
} from "@/components/providers/app-data-provider";
import {
  approveEmailTransaction,
  checkEmailReconciliation,
  dismissEmailTransaction,
  updatePendingEmailTransaction,
  type PendingEmailEnrichment,
  type ReconciliationCandidatePreview,
} from "@/actions/email-ingest";
import { resolveSuggestedEmailAccountId } from "@/lib/email-ingest/account-matching";
import { getEmailPatternLabel } from "@/lib/email-ingest/pattern-labels";
import {
  BRASS_BUTTON_CLASS,
  CHIP_NEUTRAL_CLASS,
  DESTRUCTIVE_GHOST_BUTTON_CLASS,
  MOBILE_CARD_TIGHT_CLASS,
  SECTION_EYEBROW_CLASS,
} from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, formatTime } from "@/lib/utils/date";
import type { ParsedEmailTransaction } from "@/lib/parsers/bancolombia-email";
import type { CurrencyCode, PendingEmailTransaction } from "@/types/domain";

/** Compact pill shared by the three per-row pickers (cuenta · categoría · etiquetas). */
const ROW_PICKER_CLASS =
  "h-8 max-w-full rounded-full border-white/6 bg-white/[0.03] px-2.5 text-xs font-normal text-muted-foreground shadow-none";

interface EmailInboxProps {
  transactions: PendingEmailTransaction[];
}

function parseTx(raw: unknown): ParsedEmailTransaction | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as ParsedEmailTransaction;
}

export function EmailInbox({ transactions: initialTransactions }: EmailInboxProps) {
  const router = useRouter();
  const accounts = useAccounts();
  const categories = useCategories();

  const [rows, setRows] = useState(initialTransactions);
  const [accountOverrides, setAccountOverrides] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [reconMatch, setReconMatch] = useState<{
    pendingId: string;
    candidate: ReconciliationCandidatePreview;
  } | null>(null);
  const [, startTransition] = useTransition();

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // Rows the server couldn't match to an account: try the card mask client-side.
  const clientMatches = useMemo(() => {
    const matches: Record<string, string> = {};
    for (const tx of initialTransactions) {
      if (tx.suggested_account_id) continue;
      const parsed = parseTx(tx.parsed_data);
      if (!parsed?.card_last4) continue;
      const matched = resolveSuggestedEmailAccountId({
        accounts,
        parsed,
        defaultAccountId: null,
      });
      if (matched) matches[tx.id] = matched;
    }
    return matches;
  }, [initialTransactions, accounts]);

  const resolveAccountId = useCallback(
    (tx: PendingEmailTransaction): string | undefined =>
      accountOverrides[tx.id] ?? tx.suggested_account_id ?? clientMatches[tx.id] ?? undefined,
    [accountOverrides, clientMatches],
  );

  const importableIds = useMemo(
    () => rows.filter((tx) => resolveAccountId(tx)).map((tx) => tx.id),
    [rows, resolveAccountId],
  );

  // Newest first, grouped by the day the bank reported — the queue can span
  // several days when the user hasn't opened the app in a while.
  const groups = useMemo(() => {
    const byDate = new Map<string, PendingEmailTransaction[]>();
    for (const tx of rows) {
      const parsed = parseTx(tx.parsed_data);
      const key = parsed?.transaction_date ?? tx.created_at.slice(0, 10);
      const list = byDate.get(key) ?? [];
      list.push(tx);
      byDate.set(key, list);
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => ({ date, items }));
  }, [rows]);

  function removeRow(id: string) {
    setRows((prev) => prev.filter((t) => t.id !== id));
    setAccountOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (expandedId === id) setExpandedId(null);
  }

  /** Optimistic enrichment save; reverts the row on failure. */
  function patchRow(id: string, patch: PendingEmailEnrichment) {
    const previous = rows.find((t) => t.id === id);
    if (!previous) return;
    setRows((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              ...(patch.categoryId !== undefined ? { category_id: patch.categoryId } : {}),
              ...(patch.tagIds !== undefined ? { tag_ids: patch.tagIds } : {}),
              ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
            }
          : t,
      ),
    );
    startTransition(async () => {
      const result = await updatePendingEmailTransaction(id, patch);
      if (!result.success) {
        setRows((prev) => prev.map((t) => (t.id === id ? previous : t)));
        toast.error(result.error);
      }
    });
  }

  function commitNote(id: string) {
    const draft = noteDrafts[id];
    if (draft === undefined) return;
    const current = rows.find((t) => t.id === id)?.notes ?? "";
    const trimmed = draft.trim();
    if (trimmed === (current ?? "")) return;
    patchRow(id, { notes: trimmed ? trimmed : null });
  }

  async function importOne(id: string, reconcileWithId?: string): Promise<boolean> {
    const tx = rows.find((t) => t.id === id);
    if (!tx) return false;
    const override = accountOverrides[id] ?? clientMatches[id];
    const result = await approveEmailTransaction(id, override, reconcileWithId);
    if (result.success) {
      removeRow(id);
      return true;
    }
    toast.error(result.error);
    return false;
  }

  function handleImport(id: string) {
    const override = accountOverrides[id] ?? clientMatches[id];
    setBusyId(id);
    startTransition(async () => {
      try {
        const recon = await checkEmailReconciliation(id, override);
        if (recon.success && recon.data) {
          setBusyId(null);
          setReconMatch({ pendingId: id, candidate: recon.data.candidate });
          return;
        }
        const ok = await importOne(id);
        setBusyId(null);
        if (ok) {
          router.refresh();
          toast.success("Transacción importada");
        }
      } catch {
        setBusyId(null);
        toast.error("Error al importar. Inténtalo de nuevo.");
      }
    });
  }

  function handleReconChoice(reconcile: boolean) {
    if (!reconMatch) return;
    const { pendingId, candidate } = reconMatch;
    setReconMatch(null);
    setBusyId(pendingId);
    startTransition(async () => {
      try {
        const ok = await importOne(pendingId, reconcile ? candidate.id : undefined);
        setBusyId(null);
        if (ok) {
          router.refresh();
          toast.success(reconcile ? "Transacción reconciliada" : "Transacción importada");
        }
      } catch {
        setBusyId(null);
        toast.error("Error al importar. Inténtalo de nuevo.");
      }
    });
  }

  function handleDismiss(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const result = await dismissEmailTransaction(id);
      setBusyId(null);
      if (result.success) {
        removeRow(id);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleBulkImport() {
    const ids = importableIds;
    if (ids.length === 0) return;
    setBulkLoading(true);
    startTransition(async () => {
      let imported = 0;
      let failed = 0;
      let needsReview = 0;
      for (const id of ids) {
        const override = accountOverrides[id] ?? clientMatches[id];
        try {
          // Rows with a possible duplicate stay in the queue — bulk never
          // decides a merge silently; the user resolves those one by one.
          const recon = await checkEmailReconciliation(id, override);
          if (recon.success && recon.data) {
            needsReview++;
            continue;
          }
          const result = await approveEmailTransaction(id, override);
          if (result.success) {
            imported++;
            removeRow(id);
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }
      setBulkLoading(false);
      router.refresh();
      if (failed === 0 && needsReview === 0) {
        toast.success(`${imported} transacciones importadas`);
      } else if (needsReview > 0) {
        toast.warning(
          `${imported} importadas · ${needsReview} con posible duplicado — impórtalas una por una${failed > 0 ? ` · ${failed} con error` : ""}`,
        );
      } else {
        toast.warning(`${imported} importadas, ${failed} con error`);
      }
    });
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="size-6" strokeWidth={1.5} />}
        title="Bandeja al día"
        description="Cada alerta de Bancolombia que llegue por correo aparecerá aquí para revisarla, categorizarla e importarla."
      />
    );
  }

  const withoutAccount = rows.length - importableIds.length;

  return (
    <div className="space-y-4">
      {/* Summary + bulk action */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? "movimiento" : "movimientos"} por importar
            {withoutAccount > 0 && (
              <span className="text-z-alert"> · {withoutAccount} sin cuenta</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground/80">
            Categoría, etiquetas y nota se guardan solas y viajan con el movimiento al importarlo.
          </p>
        </div>
        <Button
          size="sm"
          className={cn(BRASS_BUTTON_CLASS, "h-8 gap-1.5 rounded-lg px-3 text-xs")}
          onClick={handleBulkImport}
          disabled={bulkLoading || importableIds.length === 0}
        >
          {bulkLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CheckCheck className="size-3.5" />
          )}
          Importar {importableIds.length}
        </Button>
      </div>

      {groups.map((group) => (
        <section key={group.date} className="space-y-2">
          <p className={cn(SECTION_EYEBROW_CLASS, "px-1")}>
            {formatDate(group.date, "EEEE d 'de' MMMM")}
          </p>
          <div className={cn(MOBILE_CARD_TIGHT_CLASS, "divide-y divide-white/6")}>
            {group.items.map((tx) => {
              const parsed = parseTx(tx.parsed_data);
              const merchant = parsed?.merchant || parsed?.destination || "Transacción";
              const direction = parsed?.direction ?? "OUTFLOW";
              const isInflow = direction === "INFLOW";
              const currency = (parsed?.currency ?? "COP") as CurrencyCode;
              const amount = parsed?.amount ?? 0;
              const time = parsed ? formatTime(parsed.transaction_time) : null;
              const pattern = parsed ? getEmailPatternLabel(parsed.pattern_type) : null;
              const PatternIcon = pattern?.icon ?? Mail;
              const accountId = resolveAccountId(tx);
              const account = accountId ? accountMap.get(accountId) : undefined;
              const isBusy = busyId === tx.id || bulkLoading;
              const isExpanded = expandedId === tx.id;
              const noteValue = noteDrafts[tx.id] ?? tx.notes ?? "";

              return (
                <article key={tx.id} className={cn("px-3 py-3 sm:px-4", isBusy && "opacity-60")}>
                  {/* Header — tap to reveal the email detail + nota + descartar */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                    aria-expanded={isExpanded}
                    className="flex w-full items-start gap-3 text-left"
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                        isInflow ? "bg-z-income/10 text-z-income" : "bg-white/5 text-muted-foreground",
                      )}
                    >
                      {isInflow ? (
                        <ArrowDownLeft className="size-4" />
                      ) : (
                        <ArrowUpRight className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{merchant}</p>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                        {time && <span>{time}</span>}
                        {parsed?.card_last4 && (
                          <>
                            {time && <span>·</span>}
                            <span>
                              {parsed.card_type === "Cta" ? "Cuenta" : parsed.card_type} *
                              {parsed.card_last4}
                            </span>
                          </>
                        )}
                        {pattern && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <PatternIcon className="size-3" />
                              {pattern.label}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <p
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          isInflow && "text-z-income",
                        )}
                      >
                        {isInflow ? "+" : ""}
                        {formatCurrency(amount, currency)}
                      </p>
                      <ChevronDown
                        className={cn(
                          "size-3.5 text-muted-foreground/60 transition-transform",
                          isExpanded && "rotate-180",
                        )}
                      />
                    </div>
                  </button>

                  {/* Enrichment row — always visible so a long queue can be
                      worked top to bottom without opening each row. */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <Select
                      value={accountId}
                      onValueChange={(v) =>
                        setAccountOverrides((prev) => ({ ...prev, [tx.id]: v }))
                      }
                      disabled={isBusy}
                    >
                      <SelectTrigger
                        aria-label="Cuenta"
                        className={cn(
                          ROW_PICKER_CLASS,
                          "w-auto gap-1.5",
                          !account && "border-z-alert/30 bg-z-alert/5 text-z-alert",
                        )}
                      >
                        {!account && <AlertTriangle className="size-3" />}
                        <SelectValue placeholder="Sin cuenta" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.name} ({acc.currency_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <CategoryZonePicker
                      categories={categories}
                      value={tx.category_id}
                      onValueChange={(id) => patchRow(tx.id, { categoryId: id })}
                      direction={direction}
                      placeholder="Categoría"
                      transactionDescription={merchant}
                      triggerClassName={cn(ROW_PICKER_CLASS, "w-auto")}
                    />

                    <TagZonePicker
                      selectedTagIds={tx.tag_ids ?? []}
                      onSelectedTagIdsChange={(ids) => patchRow(tx.id, { tagIds: ids })}
                      placeholder="Etiquetas"
                      triggerClassName={cn(ROW_PICKER_CLASS, "w-auto")}
                    />

                    <Button
                      size="sm"
                      className="ml-auto h-8 gap-1.5 rounded-full bg-z-income/15 px-3 text-xs font-medium text-z-income hover:bg-z-income/25"
                      onClick={() => handleImport(tx.id)}
                      disabled={isBusy || !account}
                      title={!account ? "Selecciona una cuenta primero" : undefined}
                    >
                      {busyId === tx.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                      Importar
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-3">
                      {parsed?.raw_line && (
                        <p className="rounded-xl border border-white/6 bg-black/10 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                          {parsed.raw_line}
                        </p>
                      )}
                      <input
                        type="text"
                        value={noteValue}
                        maxLength={500}
                        placeholder="Nota (opcional)"
                        aria-label="Nota"
                        onChange={(e) =>
                          setNoteDrafts((prev) => ({ ...prev, [tx.id]: e.target.value }))
                        }
                        onBlur={() => commitNote(tx.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        className="w-full rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-z-brass/40"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(CHIP_NEUTRAL_CLASS, "text-muted-foreground")}>
                          <Mail className="size-3.5 text-z-sage-dark" />
                          Recibido {formatDate(tx.created_at.slice(0, 10), "d MMM")}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={cn(DESTRUCTIVE_GHOST_BUTTON_CLASS, "h-8 gap-1.5 text-xs")}
                          onClick={() => handleDismiss(tx.id)}
                          disabled={isBusy}
                        >
                          <X className="size-3.5" />
                          Descartar
                        </Button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <EmailReconcileDialog
        candidate={reconMatch?.candidate ?? null}
        currency="COP"
        loading={!!reconMatch && busyId === reconMatch.pendingId}
        onClose={() => setReconMatch(null)}
        onChoose={handleReconChoice}
      />
    </div>
  );
}

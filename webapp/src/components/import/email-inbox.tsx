"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
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
  updatePendingEmailTransaction,
  type PendingEmailEnrichment,
} from "@/actions/email-ingest";
import { useEmailQueueActions } from "@/hooks/use-email-queue-actions";
import { resolveSuggestedEmailAccountId } from "@/lib/email-ingest/account-matching";
import { getEmailPatternLabel } from "@/lib/email-ingest/pattern-labels";
import {
  BRASS_BUTTON_CLASS,
  CHIP_NEUTRAL_CLASS,
  CONFIRM_BUTTON_CLASS,
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
  // Rows imported/dismissed in this session — a stale refresh must not resurrect them.
  const removedIdsRef = useRef(new Set<string>());
  // In-flight enrichment saves per row, awaited before that row is imported so
  // the approve action always reads what the user last set.
  const pendingSavesRef = useRef(new Map<string, Promise<unknown>>());

  // Re-sync with the server after router.refresh(): new emails appear, but
  // enrichment already edited locally is kept (it's saved optimistically).
  useEffect(() => {
    setRows((prev) => {
      const prevById = new Map(prev.map((t) => [t.id, t]));
      return initialTransactions
        .filter((t) => !removedIdsRef.current.has(t.id))
        .map((t) => prevById.get(t.id) ?? t);
    });
  }, [initialTransactions]);
  const [accountOverrides, setAccountOverrides] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
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

  const rowsById = useMemo(() => new Map(rows.map((t) => [t.id, t])), [rows]);

  const resolveAccountId = useCallback(
    (pendingId: string): string | undefined =>
      accountOverrides[pendingId] ??
      rowsById.get(pendingId)?.suggested_account_id ??
      clientMatches[pendingId] ??
      undefined,
    [accountOverrides, rowsById, clientMatches],
  );

  const importableIds = useMemo(
    () => rows.filter((tx) => resolveAccountId(tx.id)).map((tx) => tx.id),
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

  const removeRow = useCallback((id: string) => {
    removedIdsRef.current.add(id);
    setRows((prev) => prev.filter((t) => t.id !== id));
    setAccountOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setExpandedId((current) => (current === id ? null : current));
  }, []);

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
    const save = updatePendingEmailTransaction(id, patch);
    pendingSavesRef.current.set(id, save);
    startTransition(async () => {
      const result = await save;
      if (pendingSavesRef.current.get(id) === save) pendingSavesRef.current.delete(id);
      if (!result.success) {
        setRows((prev) => prev.map((t) => (t.id === id ? previous : t)));
        toast.error(result.error);
      }
    });
  }

  /** Blocks until the row's last enrichment save has landed. */
  const flushSaves = useCallback(async (id: string) => {
    const save = pendingSavesRef.current.get(id);
    if (save) await save.catch(() => undefined);
  }, []);

  const refresh = useCallback(() => router.refresh(), [router]);

  const {
    busyId,
    bulkLoading,
    isPending,
    reconMatch,
    closeRecon,
    importOne,
    chooseRecon,
    dismiss,
    bulkImport,
  } = useEmailQueueActions({
    resolveAccountId,
    onProcessed: removeRow,
    beforeApprove: flushSaves,
    afterChange: refresh,
  });

  function commitNote(id: string) {
    const draft = noteDrafts[id];
    if (draft === undefined) return;
    const current = rows.find((t) => t.id === id)?.notes ?? "";
    const trimmed = draft.trim();
    if (trimmed === (current ?? "")) return;
    patchRow(id, { notes: trimmed ? trimmed : null });
  }

  function handleBulkImport() {
    // A note still focused when the user taps "Importar N" hasn't blurred yet.
    for (const id of Object.keys(noteDrafts)) commitNote(id);
    bulkImport(importableIds);
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
              const accountId = resolveAccountId(tx.id);
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
                    className="flex w-full items-start gap-3 rounded-lg text-left transition-colors hover:bg-white/[0.02] active:opacity-70"
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
                      className={cn(CONFIRM_BUTTON_CLASS, "ml-auto h-8 gap-1.5 rounded-full px-3 text-xs font-medium")}
                      onClick={() => importOne(tx.id)}
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
                      <Input
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
                        className="h-10 rounded-xl border-white/6 bg-white/[0.03] px-3 text-sm shadow-none focus-visible:border-z-brass/40 focus-visible:ring-0"
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
                          onClick={() => dismiss(tx.id)}
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
        loading={isPending}
        onClose={closeRecon}
        onChoose={chooseRecon}
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, ArrowDownLeft, ArrowRight, Mail, Hash, UserRound, Pencil, FileUp, Clock, Tag } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MobileZone } from "@/components/mobile/v2/mobile-zone";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import { PANEL_INSET_CLASS, BRASS_BUTTON_CLASS, CONFIRM_BUTTON_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, formatTime } from "@/lib/utils/date";
import { categorizeTransaction, uncategorizeTransaction } from "@/actions/categorize";
import { useEmailQueueActions } from "@/hooks/use-email-queue-actions";
import { EmailReconcileDialog } from "@/components/import/email-reconcile-dialog";
import { getEmailPatternLabel } from "@/lib/email-ingest/pattern-labels";
import { toast } from "sonner";
import type {
  Transaction,
  PendingEmailTransaction,
  CategoryWithChildren,
  Account,
  CurrencyCode,
} from "@/types/domain";
import type { ParsedEmailTransaction } from "@/lib/parsers/bancolombia-email";

const MAX_ITEMS = 5;

interface MovimientosHerramientasProps {
  uncategorizedTransactions: Transaction[];
  uncategorizedCount: number;
  pendingEmails: PendingEmailTransaction[];
  categories: CategoryWithChildren[];
  accounts: Pick<Account, "id" | "name" | "currency_code">[];
  currency: CurrencyCode;
  expandedTool: string | null;
  onToggleTool: (id: string) => void;
}

type ToolZone = "categorizar" | "importar";

const accentStyles = {
  categorizar: {
    chip: "border-z-brass/30 bg-[linear-gradient(180deg,rgba(var(--z-brass-rgb,183,165,122),0.08),transparent)]",
    panel: "border-z-brass/20",
    eyebrow: "text-z-brass",
    link: "text-z-brass",
  },
  importar: {
    chip: "border-z-sage/30 bg-[linear-gradient(180deg,rgba(var(--z-sage-rgb,142,168,130),0.08),transparent)]",
    panel: "border-z-sage/20",
    eyebrow: "text-z-sage",
    link: "text-z-sage-light",
  },
} as const;

export function MovimientosHerramientas({
  uncategorizedTransactions,
  uncategorizedCount,
  pendingEmails,
  categories,
  accounts,
  currency,
  expandedTool,
  onToggleTool,
}: MovimientosHerramientasProps) {
  const activeZone = expandedTool as ToolZone | null;
  const toggle = onToggleTool;
  const isActive = (zone: ToolZone) => activeZone === zone;

  const activeAccent = activeZone ? accentStyles[activeZone] : null;

  // Optimistic: track IDs categorized from the detail panel so both
  // the chip count and the item list update immediately.
  const [categorizedIds, setCategorizedIds] = useState(() => new Set<string>());

  // Optimistic: track IDs imported/dismissed so chip count + list update immediately.
  const [importProcessedIds, setImportProcessedIds] = useState(() => new Set<string>());

  // Only reset optimistic state when server confirms the categorization
  // (processed IDs no longer appear in the incoming uncategorized list).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- categorizedIds read is synchronous
  useEffect(() => {
    if (categorizedIds.size === 0) return;
    const incomingIds = new Set(uncategorizedTransactions.map((tx) => tx.id));
    const anyStillUncategorized = [...categorizedIds].some((id) => incomingIds.has(id));
    if (!anyStillUncategorized) {
      setCategorizedIds(new Set());
    }
  }, [uncategorizedTransactions]);

  // Only reset optimistic state when server confirms changes (processed IDs
  // are no longer in the incoming data). If stale data still includes them,
  // keep the optimistic state to avoid visual flicker.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- importProcessedIds read is synchronous; re-running on its change would cause extra cycles
  useEffect(() => {
    if (importProcessedIds.size === 0) return;
    const incomingIds = new Set(pendingEmails.map((e) => e.id));
    const anyStillPending = [...importProcessedIds].some((id) => incomingIds.has(id));
    if (!anyStillPending) {
      setImportProcessedIds(new Set());
    }
  }, [pendingEmails]);

  const optimisticCount = Math.max(0, uncategorizedCount - categorizedIds.size);
  const optimisticPendingCount = Math.max(0, pendingEmails.length - importProcessedIds.size);

  return (
    <MobileZone eyebrow="HERRAMIENTAS">
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => toggle("categorizar")}
          className={cn(
            "rounded-[14px] border p-2.5 text-center transition-colors",
            isActive("categorizar")
              ? accentStyles.categorizar.chip
              : cn(
                  "border-z-brass/30",
                  "bg-[linear-gradient(180deg,rgba(var(--z-brass-rgb,183,165,122),0.08),transparent)]"
                )
          )}
          aria-expanded={isActive("categorizar")}
        >
          <p className="text-[22px] font-[680] leading-tight text-z-brass">
            {optimisticCount}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
            Categorizar
          </p>
          {optimisticCount > 0 && (
            <p className="mt-1 flex items-center justify-center gap-1 text-[9px] text-z-debt">
              <span className="inline-block size-1.5 rounded-full bg-z-debt" />
              {optimisticCount} por resolver
            </p>
          )}
        </button>

        <button
          type="button"
          onClick={() => toggle("importar")}
          className={cn(
            "rounded-[14px] border p-2.5 text-center transition-colors",
            accentStyles.importar.chip
          )}
          aria-expanded={isActive("importar")}
        >
          <p className="text-[22px] font-[680] leading-tight text-z-sage">
            {optimisticPendingCount}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
            Importar
          </p>
          <p className="mt-1 text-[9px] text-z-sage">
            {optimisticPendingCount > 0 ? `${optimisticPendingCount} emails` : "Subir PDF"}
          </p>
        </button>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: activeZone ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "mt-1.5 transition-opacity duration-150",
              activeZone ? "opacity-100 delay-75" : "opacity-0"
            )}
          >
            {activeZone && (
              <div
                className={cn(
                  PANEL_INSET_CLASS,
                  "border-white/8 bg-black/20 p-3",
                  activeAccent?.panel
                )}
              >
                {activeZone === "categorizar" && (
                  <CategorizarDetail
                    transactions={uncategorizedTransactions}
                    totalCount={uncategorizedCount}
                    categories={categories}
                    currency={currency}
                    categorizedIds={categorizedIds}
                    onOptimisticCategorize={(txId: string) =>
                      setCategorizedIds((prev) => new Set(prev).add(txId))
                    }
                    onOptimisticRollback={(txId: string) =>
                      setCategorizedIds((prev) => {
                        const next = new Set(prev);
                        next.delete(txId);
                        return next;
                      })
                    }
                  />
                )}
                {activeZone === "importar" && (
                  <ImportarDetail
                    pendingEmails={pendingEmails}
                    accounts={accounts}
                    currency={currency}
                    processedIds={importProcessedIds}
                    onProcess={(ids: string[]) =>
                      setImportProcessedIds((prev) => {
                        const next = new Set(prev);
                        for (const id of ids) next.add(id);
                        return next;
                      })
                    }
                    onRollback={(ids: string[]) =>
                      setImportProcessedIds((prev) => {
                        const next = new Set(prev);
                        for (const id of ids) next.delete(id);
                        return next;
                      })
                    }
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </MobileZone>
  );
}

/* ─── Direction icon ─────────────────────────────────────────────────────── */

function DirectionIcon({ direction }: { direction: "OUTFLOW" | "INFLOW" }) {
  const isOutflow = direction === "OUTFLOW";
  return (
    <div
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md",
        isOutflow ? "bg-z-debt/10 text-z-expense" : "bg-z-income/10 text-z-income"
      )}
    >
      {isOutflow ? (
        <ArrowUpRight className="size-3" />
      ) : (
        <ArrowDownLeft className="size-3" />
      )}
    </div>
  );
}

/* ─── Action pill ────────────────────────────────────────────────────────── */

function ActionPill({
  children,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "rounded-lg border px-2 py-0.5 text-[10px] transition-colors",
        variant === "danger"
          ? "border-z-debt/20 bg-z-debt/5 text-z-expense"
          : "border-white/10 bg-white/[0.03] text-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}

/* ─── Categorizar detail ─────────────────────────────────────────────────── */

function CategorizarDetail({
  transactions,
  totalCount,
  categories,
  currency,
  categorizedIds,
  onOptimisticCategorize,
  onOptimisticRollback,
}: {
  transactions: Transaction[];
  totalCount: number;
  categories: CategoryWithChildren[];
  currency: CurrencyCode;
  categorizedIds: Set<string>;
  onOptimisticCategorize: (txId: string) => void;
  onOptimisticRollback: (txId: string) => void;
}) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleTransactions = transactions.filter((tx) => !categorizedIds.has(tx.id));
  const items = visibleTransactions.slice(0, MAX_ITEMS);
  const visibleCount = Math.max(0, totalCount - categorizedIds.size);

  function handleCategorize(tx: Transaction, categoryId: string | null) {
    if (!categoryId) return;
    const previousCategoryId = tx.category_id ?? null;

    // Optimistic: remove from list immediately (updates chip count too)
    onOptimisticCategorize(tx.id);

    startTransition(async () => {
      const result = await categorizeTransaction(tx.id, categoryId);
      if (result.success) {
        toast.success("Categorizada", {
          action: {
            label: "Deshacer",
            onClick: () => {
              if (previousCategoryId) {
                void categorizeTransaction(tx.id, previousCategoryId);
              } else {
                void uncategorizeTransaction(tx.id);
              }
            },
          },
        });
      } else {
        onOptimisticRollback(tx.id);
        toast.error(result.error ?? "Error al categorizar");
      }
    });
  }

  if (visibleCount <= 0) {
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-brass">
          Transacciones sin categoría
        </p>
        <p className="text-xs text-z-sage-light">
          Todas las transacciones están categorizadas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-brass">
        Transacciones sin categoría
      </p>

      <div className={cn("space-y-0.5", isPending && "pointer-events-none opacity-60")}>
        {items.map((tx) => {
          const isExpanded = expandedRow === tx.id;
          const label = tx.merchant_name || tx.clean_description || tx.raw_description || "Sin descripción";
          return (
            <div key={tx.id}>
              <div
                className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/[0.03]"
                onClick={() => setExpandedRow(isExpanded ? null : tx.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setExpandedRow(isExpanded ? null : tx.id);
                }}
              >
                <DirectionIcon direction={tx.direction} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs">{label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDate(tx.transaction_date, "dd MMM")}
                  </p>
                </div>
                <p className="shrink-0 text-xs font-semibold tabular-nums">
                  {formatCurrency(tx.amount, currency)}
                </p>
                <span
                  className={cn(
                    "text-muted-foreground/50 text-xs transition-transform shrink-0",
                    isExpanded && "rotate-90"
                  )}
                >
                  ›
                </span>
              </div>
              {isExpanded && (
                <div className="flex items-center gap-1.5 pb-2 pl-7" onClick={(e) => e.stopPropagation()}>
                  <CategoryZonePicker
                    categories={categories}
                    value={null}
                    onValueChange={(catId) => handleCategorize(tx, catId)}
                    direction={tx.direction}
                    placeholder="Categoría"
                    variant="drawer"
                    triggerClassName="text-[10px] h-auto py-1 px-2.5 rounded-lg border border-white/10 bg-white/[0.03] text-z-brass hover:bg-white/[0.06]"
                  />
                  <Link
                    href={`/transactions/${tx.id}`}
                    className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.06]"
                  >
                    <UserRound className="size-3" />
                  </Link>
                  <Link
                    href={`/transactions/${tx.id}`}
                    className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.06]"
                  >
                    <Hash className="size-3" />
                  </Link>
                  <div className="flex-1" />
                  <Link
                    href={`/transactions/${tx.id}`}
                    className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.06]"
                  >
                    <Pencil className="size-3" />
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] text-muted-foreground">
          Mostrando {items.length} de {visibleCount}
        </p>
        <Link
          href="/categorizar"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-z-brass"
        >
          Categorizar todas
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

/* ─── Pattern labels ─────────────────────────────────────────────────────── */

/* ─── Importar detail ────────────────────────────────────────────────────── */

function ImportarDetail({
  pendingEmails,
  accounts,
  currency,
  processedIds,
  onProcess,
  onRollback,
}: {
  pendingEmails: PendingEmailTransaction[];
  accounts: Pick<Account, "id" | "name" | "currency_code">[];
  currency: CurrencyCode;
  processedIds: Set<string>;
  onProcess: (ids: string[]) => void;
  onRollback: (ids: string[]) => void;
}) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [accountOverrides, setAccountOverrides] = useState<Record<string, string>>({});

  const visibleEmails = pendingEmails.filter((e) => !processedIds.has(e.id));
  const items = visibleEmails.slice(0, MAX_ITEMS);
  const totalCount = visibleEmails.length;

  const resolveAccountId = useCallback(
    (id: string): string | undefined =>
      accountOverrides[id] ??
      pendingEmails.find((e) => e.id === id)?.suggested_account_id ??
      undefined,
    [accountOverrides, pendingEmails],
  );
  const processOne = useCallback((id: string) => onProcess([id]), [onProcess]);
  const rollbackOne = useCallback((id: string) => onRollback([id]), [onRollback]);

  // Optimistic: rows leave the list on tap and come back only if the server
  // rejects the change — the parent owns `processedIds`.
  const { isPending, reconMatch, closeRecon, importOne, chooseRecon, dismiss, bulkImport } =
    useEmailQueueActions({
      resolveAccountId,
      mode: "optimistic",
      onProcessed: processOne,
      onRollback: rollbackOne,
    });

  function parseTx(raw: unknown): ParsedEmailTransaction | null {
    if (!raw || typeof raw !== "object") return null;
    return raw as ParsedEmailTransaction;
  }

  if (totalCount === 0) {
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-sage">
          Importar extracto
        </p>
        <Link
          href="/import"
          className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/[0.03]"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-z-sage/20 bg-z-sage/10">
            <FileUp className="size-4 text-z-sage" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold">Subir PDF del banco</p>
            <p className="text-[9px] text-muted-foreground">Extracto mensual de cualquier banco</p>
          </div>
          <span className={cn("shrink-0 rounded-lg px-3 py-1 text-[10px] font-semibold", BRASS_BUTTON_CLASS)}>
            Subir
          </span>
        </Link>
        <p className="text-[10px] text-muted-foreground">
          0 emails pendientes de revisión
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-sage">
        Pendientes por correo
      </p>

      {/* PDF upload CTA */}
      <Link
        href="/import"
        className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/[0.03]"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-z-sage/20 bg-z-sage/10">
          <FileUp className="size-4 text-z-sage" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold">Subir PDF del banco</p>
          <p className="text-[9px] text-muted-foreground">Extracto mensual de cualquier banco</p>
        </div>
        <span className={cn("shrink-0 rounded-lg px-3 py-1 text-[10px] font-semibold", BRASS_BUTTON_CLASS)}>
          Subir
        </span>
      </Link>

      <div className="h-px bg-white/6" />

      <div className={cn("space-y-0.5", isPending && "pointer-events-none opacity-60")}>
        {items.map((email) => {
          const parsed = parseTx(email.parsed_data);
          const isExpanded = expandedRow === email.id;
          const label = parsed?.merchant || parsed?.destination || "Sin descripción";
          const dateStr = parsed?.transaction_date ?? email.created_at.slice(0, 10);
          const timeStr = parsed ? formatTime(parsed.transaction_time) : null;
          const cardInfo = parsed ? `*${parsed.card_last4}` : null;
          const amount = parsed?.amount ?? 0;
          const direction = parsed?.direction ?? "OUTFLOW";
          const pattern = parsed ? getEmailPatternLabel(parsed.pattern_type) : null;
          const PatternIcon = pattern?.icon ?? Mail;
          const hasEnrichment = !!email.category_id || (email.tag_ids?.length ?? 0) > 0;

          const resolvedAccountId = accountOverrides[email.id] ?? email.suggested_account_id;
          const resolvedAccount = resolvedAccountId
            ? accounts.find((a) => a.id === resolvedAccountId)
            : null;

          return (
            <div key={email.id}>
              <div
                className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/[0.03]"
                onClick={() => setExpandedRow(isExpanded ? null : email.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setExpandedRow(isExpanded ? null : email.id);
                }}
              >
                <DirectionIcon direction={direction} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs">{label}</p>
                  <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span>{formatDate(dateStr, "dd MMM")}</span>
                    {cardInfo && <span>{cardInfo}</span>}
                    {email.conflict_transaction_id && (
                      <span className="inline-flex items-center gap-0.5 text-z-alert">
                        <AlertTriangle className="size-2.5" />
                        Posible duplicado
                      </span>
                    )}
                    {hasEnrichment && (
                      <span className="inline-flex items-center gap-0.5 text-z-brass">
                        <Tag className="size-2.5" />
                        {email.category_id ? "Categorizada" : "Etiquetada"}
                      </span>
                    )}
                  </p>
                </div>
                <p className="shrink-0 text-xs font-semibold tabular-nums">
                  {formatCurrency(amount, currency)}
                </p>
                {!isExpanded && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      importOne(email.id);
                    }}
                    className={cn(CONFIRM_BUTTON_CLASS, "shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-colors")}
                  >
                    Importar
                  </button>
                )}
              </div>
              {isExpanded && (
                <div className="flex flex-wrap items-center gap-1.5 pb-2 pl-7">
                  {pattern && (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-muted-foreground">
                      <PatternIcon className="size-2.5" />
                      {pattern.label}
                    </span>
                  )}
                  {timeStr && (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-muted-foreground">
                      <Clock className="size-2.5" />
                      {timeStr}
                    </span>
                  )}
                  <div onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={resolvedAccountId ?? undefined}
                      onValueChange={(v) => setAccountOverrides((prev) => ({ ...prev, [email.id]: v }))}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-auto gap-1 rounded-lg px-2.5 py-1 text-[10px]",
                          resolvedAccount
                            ? "border-white/10 bg-white/[0.03] text-muted-foreground"
                            : "border-z-alert/30 bg-z-alert/5 text-z-alert"
                        )}
                      >
                        <SelectValue placeholder="Sin cuenta" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id} className="text-xs">
                            {a.name} ({a.currency_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <ActionPill onClick={() => dismiss(email.id)} variant="danger">
                      Descartar
                    </ActionPill>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        importOne(email.id);
                      }}
                      className={cn(CONFIRM_BUTTON_CLASS, "rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-colors")}
                    >
                      Importar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <Link
          href="/import/correo"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-z-brass"
        >
          {totalCount} pendiente{totalCount !== 1 ? "s" : ""} · Ver bandeja
          <ArrowRight className="size-3" />
        </Link>
        <button
          type="button"
          onClick={() => bulkImport(visibleEmails.map((e) => e.id))}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-z-sage-light"
        >
          Importar todas
          <ArrowRight className="size-3" />
        </button>
      </div>

      <EmailReconcileDialog
        candidate={reconMatch?.candidate ?? null}
        currency={currency}
        loading={isPending}
        onClose={closeRecon}
        onChoose={chooseRecon}
      />
    </div>
  );
}

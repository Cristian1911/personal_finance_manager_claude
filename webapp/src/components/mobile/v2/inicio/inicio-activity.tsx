"use client";

import { startTransition, useEffect, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  ChevronLeft,
  Eye,
  Hash,
  Link2,
  MoreHorizontal,
  Repeat,
  Tag,
  Trash2,
  UserRound,
} from "lucide-react";
import { AccountRowIdentity } from "@/components/accounts/account-row-identity";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { CategoryIcon } from "@/components/categories/category-icon";
import { TagChip } from "@/components/tags/tag-chip";
import { LinkPickerSheet } from "@/components/recurring/link-picker-sheet";
import { DestinatarioZonePicker } from "@/components/destinatarios/destinatario-zone-picker";
import { TagZonePicker } from "@/components/tags/tag-zone-picker";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCategories } from "@/components/providers/app-data-provider";
import { categorizeTransaction, assignDestinatario } from "@/actions/categorize";
import { deleteTransaction } from "@/actions/transactions";
import {
  DESTRUCTIVE_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  MOBILE_TAB_BAR_CLEARANCE_CLASS,
  PANEL_INSET_CLASS,
  SECTION_EYEBROW_CLASS,
} from "@/lib/constants/styles";
import {
  getAccountIdsWithPendingOccurrences,
  getCandidateOccurrencesForTransaction,
  linkExistingTransactionToOccurrence,
} from "@/actions/occurrences";
import type { CandidateOccurrence } from "@/actions/occurrences";
import { toast } from "sonner";
import type { CategoryWithChildren, CurrencyCode } from "@/types/domain";

// Dynamic import — CategoryPickerBody's tree (~804 LOC with Radix Command/Popover,
// inline create form, etc.) is heavy. Lazy-*mount* via openedOnceIds below defers
// rendering; dynamic import also defers the JS bundle cost.
const CategoryPickerBody = dynamic(
  () => import("@/components/categories/category-zone-picker").then((m) => m.CategoryPickerBody),
  { ssr: false },
);

type AccountTypeEnum = "CHECKING" | "SAVINGS" | "CREDIT_CARD" | "CASH" | "INVESTMENT" | "LOAN" | "OTHER";
type RowPhase = "actions" | "categorize";

interface RecentTransactionMobile {
  id: string;
  description: string;
  amount: number;
  currency_code: CurrencyCode;
  direction: "INFLOW" | "OUTFLOW";
  transaction_date: string;
  account_id: string;
  account_name: string;
  account_color: string | null;
  account_mask: string | null;
  account_bank_key: string | null;
  account_type: AccountTypeEnum;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  destinatario_id: string | null;
  destinatario_name: string | null;
  recurrence_group_id: string | null;
  personal_debt_id: string | null;
  transfer_group_id: string | null;
  tags: Array<{ id: string; name: string; color: string | null; group_color: string | null }>;
}

interface InicioActivityProps {
  transactions: RecentTransactionMobile[];
}

function findCategoryById(
  categories: CategoryWithChildren[],
  id: string,
): { id: string; name: string; icon: string | null } | null {
  for (const parent of categories) {
    if (parent.id === id) {
      return { id: parent.id, name: parent.name_es ?? parent.name ?? "", icon: parent.icon ?? null };
    }
    const child = parent.children.find((c) => c.id === id);
    if (child) {
      return { id: child.id, name: child.name_es ?? child.name ?? "", icon: child.icon ?? null };
    }
  }
  return null;
}

const CHIP_BASE_CLASS =
  "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-[11px] font-semibold transition-colors active:opacity-70";

export function InicioActivity({ transactions }: InicioActivityProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rowPhase, setRowPhase] = useState<Record<string, RowPhase>>({});
  // Track which rows have been opened at least once so we can defer mounting
  // the heavy CategoryPickerBody until the user actually taps Categorizar.
  const [openedCategorizeIds, setOpenedCategorizeIds] = useState<Set<string>>(new Set());
  const categories = useCategories();
  // Refs for each row so we can scroll the expanded panel into view above the tab bar.
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /* ---- Linkable account IDs (loaded client-side) ---- */
  const [linkableAccountIds, setLinkableAccountIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    getAccountIdsWithPendingOccurrences().then((ids) => setLinkableAccountIds(new Set(ids)));
  }, []);

  /* ---- Optimistic category assignment ---- */
  const [optimisticCategories, setOptimisticCategories] = useState<
    Record<string, { id: string; name: string; icon: string | null }>
  >({});
  const [, startCategoryTransition] = useTransition();

  function handleAssignCategory(txId: string, categoryId: string) {
    const category = findCategoryById(categories, categoryId);
    if (!category) return;
    setOptimisticCategories((prev) => ({ ...prev, [txId]: category }));
    setExpandedId(null);
    setRowPhase((prev) => ({ ...prev, [txId]: "actions" }));
    startCategoryTransition(async () => {
      const result = await categorizeTransaction(txId, categoryId);
      if (!result.success) {
        setOptimisticCategories((prev) => {
          const next = { ...prev };
          delete next[txId];
          return next;
        });
        toast.error(result.error ?? "Error al asignar categoría");
      } else {
        toast.success(`Categoría: ${category.name}`);
      }
    });
  }

  /* ---- Link to recurring flow ---- */
  const [linkingTxId, setLinkingTxId] = useState<string | null>(null);
  const [occurrenceCandidates, setOccurrenceCandidates] = useState<CandidateOccurrence[]>([]);
  const [isLinking, startLinkTransition] = useTransition();

  const handleOpenLinkPicker = async (txId: string) => {
    setLinkingTxId(txId);
    const result = await getCandidateOccurrencesForTransaction(txId);
    if (result.success) {
      setOccurrenceCandidates(result.data);
    } else {
      toast.error(result.error ?? "Error al buscar recurrentes");
      setLinkingTxId(null);
    }
  };

  const handleConfirmLink = (occurrenceId: string) => {
    if (!linkingTxId) return;
    const txId = linkingTxId;
    setLinkingTxId(null);
    startLinkTransition(async () => {
      const result = await linkExistingTransactionToOccurrence(occurrenceId, txId);
      if (result.success) {
        toast.success("Transacción vinculada a recurrente");
        getAccountIdsWithPendingOccurrences().then((ids) => setLinkableAccountIds(new Set(ids)));
      } else {
        toast.error(result.error ?? "No se pudo vincular");
      }
    });
  };

  /* ---- "Más" sheet + nested-picker state ----
     Only one surface may be open at a time: the Más bottom-sheet OR one of the
     nested pickers (destinatario/etiquetas drawer). Opening a picker from the
     sheet closes the sheet first so they never stack. */
  const router = useRouter();
  const [moreSheetTxId, setMoreSheetTxId] = useState<string | null>(null);
  const [nestedPicker, setNestedPicker] = useState<
    | { txId: string; kind: "destinatario" | "tags" }
    | null
  >(null);
  const [, startDestinatarioTransition] = useTransition();

  const moreSheetTx = moreSheetTxId
    ? transactions.find((t) => t.id === moreSheetTxId) ?? null
    : null;
  const nestedPickerTx = nestedPicker
    ? transactions.find((t) => t.id === nestedPicker.txId) ?? null
    : null;

  function openNestedPicker(txId: string, kind: "destinatario" | "tags") {
    setMoreSheetTxId(null);
    setNestedPicker({ txId, kind });
  }

  function closeNestedPicker() {
    setNestedPicker(null);
    startTransition(() => router.refresh());
  }

  function handleAssignDestinatario(destId: string | null) {
    const active = nestedPicker;
    if (!destId || !active) return;
    startDestinatarioTransition(async () => {
      const result = await assignDestinatario(active.txId, destId);
      if (result.success) {
        toast.success("Destinatario asignado");
        closeNestedPicker();
      } else {
        toast.error(result.error ?? "No se pudo asignar el destinatario");
      }
    });
  }

  if (transactions.length === 0) return null;

  const visible = transactions.slice(0, 3);

  function toggleExpand(txId: string) {
    const willOpen = expandedId !== txId;
    setExpandedId(willOpen ? txId : null);
    if (willOpen) {
      setRowPhase((prev) => ({ ...prev, [txId]: "actions" }));
      requestAnimationFrame(() => {
        rowRefs.current[txId]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  }

  function openCategorizePhase(txId: string) {
    setRowPhase((prev) => ({ ...prev, [txId]: "categorize" }));
    setOpenedCategorizeIds((prev) => {
      if (prev.has(txId)) return prev;
      const next = new Set(prev);
      next.add(txId);
      return next;
    });
  }

  function returnToActionsPhase(txId: string) {
    setRowPhase((prev) => ({ ...prev, [txId]: "actions" }));
  }

  return (
    <div>
      <p className={cn(SECTION_EYEBROW_CLASS, "mb-1.5")}>Reciente</p>

      <div>
        {visible.map((tx) => {
          const isOpen = expandedId === tx.id;
          const phase: RowPhase = rowPhase[tx.id] ?? "actions";
          const optimisticCat = optimisticCategories[tx.id];
          const categoryIcon = optimisticCat?.icon ?? tx.category_icon;
          const categoryName = optimisticCat?.name ?? tx.category_name;
          const vincularEligible =
            linkableAccountIds.has(tx.account_id) && !tx.recurrence_group_id;
          const categoryResolved = Boolean(optimisticCat?.id ?? tx.category_id);

          return (
            <div
              key={tx.id}
              ref={(el) => {
                rowRefs.current[tx.id] = el;
              }}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-label={isOpen ? `Cerrar detalles de ${tx.description}` : `Ver acciones para ${tx.description}`}
                onClick={() => toggleExpand(tx.id)}
                className={cn(
                  "flex w-full gap-2 px-1 py-2 text-left transition-colors active:bg-white/[0.03]",
                  isOpen && "border-l-2 border-l-z-brass pl-2",
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-md",
                    tx.direction === "INFLOW"
                      ? "bg-z-income/12 text-z-income"
                      : "bg-z-expense/12 text-z-expense",
                  )}
                >
                  {tx.direction === "INFLOW" ? (
                    <ArrowDownLeft className="size-3" />
                  ) : (
                    <ArrowUpRight className="size-3" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-xs font-medium">
                    {tx.recurrence_group_id && (
                      <>
                        <Repeat
                          className="size-3 shrink-0 text-z-brass/70"
                          aria-hidden="true"
                        />
                        <span className="sr-only">Vinculado a recurrente:</span>
                      </>
                    )}
                    <span className="truncate">{tx.description}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <AccountRowIdentity
                      account={{
                        name: tx.account_name,
                        mask: tx.account_mask,
                        bank_key: tx.account_bank_key,
                        account_type: tx.account_type,
                        color: tx.account_color,
                      }}
                      density="compact"
                      className="truncate"
                    />
                    {categoryIcon && categoryName && (
                      <>
                        <span className="text-white/15">&middot;</span>
                        <span className="inline-flex items-center gap-0.5 truncate">
                          <CategoryIcon icon={categoryIcon} className="size-3 shrink-0" />
                          {categoryName}
                        </span>
                      </>
                    )}
                  </p>
                  {tx.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tx.tags.map((t) => (
                        <TagChip
                          key={t.id}
                          tag={{ name: t.name, color: t.color }}
                          groupColor={t.group_color}
                          size="sm"
                        />
                      ))}
                    </div>
                  )}
                </div>

                <span
                  className={cn(
                    "shrink-0 text-xs font-medium tabular-nums",
                    tx.direction === "INFLOW" && "text-z-income",
                  )}
                >
                  {tx.direction === "INFLOW" ? "+" : "-"}
                  {formatCurrency(tx.amount, tx.currency_code)}
                </span>
              </button>

              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div className={cn("py-1.5 transition-opacity duration-150", isOpen ? "opacity-100" : "opacity-0")}>
                    <div className={cn(PANEL_INSET_CLASS, "border-z-brass/15 bg-black/20 p-3")}>
                      {phase === "actions" ? (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              openCategorizePhase(tx.id);
                            }}
                            className={cn(
                              CHIP_BASE_CLASS,
                              categoryResolved
                                ? "border-white/8 bg-white/[0.03] text-foreground"
                                : "border-z-brass/25 bg-z-brass/10 text-z-brass",
                            )}
                          >
                            <Tag className="size-3" />
                            Categorizar
                          </button>
                          {vincularEligible && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                handleOpenLinkPicker(tx.id);
                              }}
                              className={cn(
                                CHIP_BASE_CLASS,
                                "border-white/8 bg-white/[0.03] text-foreground",
                              )}
                            >
                              <Link2 className="size-3" />
                              Vincular
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setMoreSheetTxId(tx.id);
                            }}
                            className={cn(
                              CHIP_BASE_CLASS,
                              "border-white/8 bg-white/[0.03] text-foreground",
                              // When 3 chips fit, shrink "Más" slightly so labels stay readable
                              vincularEligible && "flex-[0.8]",
                            )}
                          >
                            <MoreHorizontal className="size-3" />
                            Más
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="mb-2 flex items-center gap-2 border-b border-white/6 pb-2">
                            <button
                              type="button"
                              onClick={() => returnToActionsPhase(tx.id)}
                              aria-label="Volver a acciones"
                              className="inline-flex size-6 items-center justify-center rounded-md bg-white/[0.05] text-muted-foreground transition-colors active:bg-white/[0.08]"
                            >
                              <ChevronLeft className="size-3.5" />
                            </button>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              Asignar categoría
                            </p>
                          </div>
                          {openedCategorizeIds.has(tx.id) && (
                            <CategoryPickerBody
                              categories={categories}
                              value={optimisticCat?.id ?? tx.category_id}
                              onSelect={(id) => {
                                if (id) handleAssignCategory(tx.id, id);
                              }}
                              onCategoryCreated={() => {
                                /* no-op inline — user creates via /categories */
                              }}
                              suggestion={null}
                              direction={tx.direction}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Link
        href="/transactions"
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-z-brass"
      >
        Ver todos
        <ArrowRight className="size-3" />
      </Link>

      {/* Link to recurring sheet */}
      {linkingTxId && (
        <LinkPickerSheet
          open={!!linkingTxId}
          onOpenChange={(open) => {
            if (!open) setLinkingTxId(null);
          }}
          title="Vincular a recurrente"
          subtitle={(() => {
            const tx = transactions.find((t) => t.id === linkingTxId);
            return tx ? `${tx.description} · ${formatCurrency(tx.amount, tx.currency_code)}` : "";
          })()}
          candidates={occurrenceCandidates.map((o) => ({
            id: o.id,
            label: o.merchant,
            sublabel: `${formatDate(o.occurrenceDate)} · ${formatCurrency(o.expectedAmount, o.currencyCode as CurrencyCode)} esperado`,
            amount: o.expectedAmount,
            currencyCode: o.currencyCode,
            direction: transactions.find((t) => t.id === linkingTxId)?.direction ?? "OUTFLOW",
            matchScore: o.matchScore,
          }))}
          onConfirm={handleConfirmLink}
          isPending={isLinking}
        />
      )}

      {/* Secondary-actions sheet opened via "Más" chip. On close we refresh the
          Dashboard segment so any destinatario/tag/delete mutations are
          reflected in the row immediately (server cache is already invalidated
          by the underlying actions via updateTag). */}
      {moreSheetTx && (
        <MoreActionsSheet
          tx={moreSheetTx}
          open={!!moreSheetTxId}
          onOpenChange={(open) => {
            if (!open) {
              setMoreSheetTxId(null);
              startTransition(() => router.refresh());
            }
          }}
          onOpenNestedPicker={(kind) => openNestedPicker(moreSheetTx.id, kind)}
        />
      )}

      {/* Nested pickers — rendered at root so they never stack on the Más sheet.
          Opening a picker closes Más; picker close refreshes the segment. */}
      {nestedPickerTx && nestedPicker?.kind === "destinatario" && (
        <DestinatarioZonePicker
          hideTrigger
          controlledOpen
          onControlledOpenChange={(open) => {
            if (!open) closeNestedPicker();
          }}
          value={nestedPickerTx.destinatario_id}
          selectedName={nestedPickerTx.destinatario_name}
          onValueChange={handleAssignDestinatario}
          variant="drawer"
          categories={categories}
          rawDescription={nestedPickerTx.description}
          amount={nestedPickerTx.amount}
          currencyCode={nestedPickerTx.currency_code}
        />
      )}
      {nestedPickerTx && nestedPicker?.kind === "tags" && (
        <TagZonePicker
          hideTrigger
          controlledOpen
          onControlledOpenChange={(open) => {
            if (!open) closeNestedPicker();
          }}
          entityType="transaction"
          entityId={nestedPickerTx.id}
          variant="drawer"
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  MoreActionsSheet                                                          */
/* -------------------------------------------------------------------------- */

interface MoreActionsSheetProps {
  tx: RecentTransactionMobile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenNestedPicker: (kind: "destinatario" | "tags") => void;
}

const SHEET_ROW_CLASS =
  "flex w-full items-center gap-3 border-t border-white/6 px-1 py-3 text-left text-sm transition-colors active:bg-white/[0.03]";
const SHEET_ROW_ICON_CLASS =
  "inline-flex size-8 items-center justify-center rounded-lg bg-white/[0.04] text-muted-foreground";

function MoreActionsSheet({ tx, open, onOpenChange, onOpenNestedPicker }: MoreActionsSheetProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteTransaction(tx.id);
    setDeleting(false);
    if (result.success) {
      toast.success("Transacción eliminada");
      setDeleteConfirmOpen(false);
      onOpenChange(false);
    } else {
      toast.error(result.error ?? "No se pudo eliminar");
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(
            "max-h-[85dvh] rounded-t-2xl border-t border-white/6 bg-z-surface-2",
            MOBILE_TAB_BAR_CLEARANCE_CLASS,
          )}
        >
          <SheetHeader className="gap-1 border-b border-white/6 pb-3">
            <SheetTitle className="text-sm">{tx.description}</SheetTitle>
            <p className="text-[11px] text-muted-foreground">
              {tx.direction === "INFLOW" ? "Ingreso" : "Gasto"} ·{" "}
              {formatCurrency(tx.amount, tx.currency_code)} · {formatDate(tx.transaction_date)}
            </p>
          </SheetHeader>

          <div className="px-4 pb-2">
            <Link
              href={`/transactions/${tx.id}`}
              onClick={() => onOpenChange(false)}
              className={SHEET_ROW_CLASS}
            >
              <span className={SHEET_ROW_ICON_CLASS}>
                <Eye className="size-4" />
              </span>
              <span className="flex-1">Ver detalle</span>
              <ArrowRight className="size-3.5 text-muted-foreground" />
            </Link>

            <button
              type="button"
              onClick={() => onOpenNestedPicker("destinatario")}
              className={SHEET_ROW_CLASS}
            >
              <span className={SHEET_ROW_ICON_CLASS}>
                <UserRound className="size-4" />
              </span>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm">Destinatario</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {tx.destinatario_name ?? "Sin asignar"}
                </p>
              </div>
              <ArrowRight className="size-3.5 text-muted-foreground" />
            </button>

            <button
              type="button"
              onClick={() => onOpenNestedPicker("tags")}
              className={SHEET_ROW_CLASS}
            >
              <span className={SHEET_ROW_ICON_CLASS}>
                <Hash className="size-4" />
              </span>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm">Etiquetas</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {tx.tags.length > 0
                    ? `${tx.tags.length} aplicada${tx.tags.length === 1 ? "" : "s"}`
                    : "Ninguna"}
                </p>
              </div>
              <ArrowRight className="size-3.5 text-muted-foreground" />
            </button>

            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              className={cn(SHEET_ROW_CLASS, "text-z-debt")}
            >
              <span
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-lg bg-z-debt/10 text-z-debt",
                )}
              >
                <Trash2 className="size-4" />
              </span>
              <span className="flex-1">Eliminar transacción</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar transacción</DialogTitle>
            <DialogDescription>
              ¿Estás seguro? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(false)}
              className={cn(
                "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                GHOST_BUTTON_CLASS,
              )}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50",
                DESTRUCTIVE_BUTTON_CLASS,
              )}
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

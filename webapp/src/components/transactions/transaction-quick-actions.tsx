"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Tag as TagIcon,
  Link2,
  Link2Off,
  Trash2,
  AlertTriangle,
  Users,
  EyeOff,
  Eye,
  Pencil,
  Banknote,
  Repeat,
  UserPlus,
  UserRound,
  Receipt,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { chipBackground, zoneTextColor } from "@/lib/utils/zone-colors";
import { GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";
import { CategoryIcon } from "@/components/categories/category-icon";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import { DestinatarioZonePicker } from "@/components/destinatarios/destinatario-zone-picker";
import { TagZonePicker } from "@/components/tags/tag-zone-picker";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LinkPickerSheet, type LinkCandidate } from "@/components/recurring/link-picker-sheet";
import { CreatePersonalDebtSheet } from "@/components/personas/create-personal-debt-sheet";
import { useDestinatarios } from "@/components/providers/app-data-provider";
import {
  categorizeTransaction,
  assignDestinatario,
  removeDestinatarioFromTransaction,
} from "@/actions/categorize";
import { toggleExcludeTransaction } from "@/actions/transactions";
import {
  getCandidateOccurrencesForTransaction,
  getLinkedRecurringForTransaction,
  linkExistingTransactionToOccurrence,
  revertOccurrence,
  type CandidateOccurrence,
  type LinkedRecurringInfo,
} from "@/actions/occurrences";
import { getPersonalDebts, linkTransactionToPersonalDebt } from "@/actions/personal-debts";
import type { CategoryWithChildren, CurrencyCode } from "@/types/domain";

/** Trio action button (Categoría · Destinatario · Más) — ghost, equal thirds. */
const TRIO_BTN_CLASS = cn(
  "inline-flex h-[34px] min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
  GHOST_BUTTON_CLASS,
);

/** "Más" sheet action tile — fixed 2×2 grid slot. */
const SHEET_TILE_CLASS =
  "flex h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-3.5 py-2.5 text-center";

/** Actionable (unassigned) state of a sheet tile — ghost surface + tile extras. */
const SHEET_TILE_ACTION_CLASS = cn(
  GHOST_BUTTON_CLASS,
  "transition-colors disabled:opacity-40",
);

/** Resolve a category's display color (parent zone color, like the picker). */
export function resolveCategoryColor(
  categories: CategoryWithChildren[],
  id: string,
): string | null {
  for (const parent of categories) {
    if (parent.id === id) return parent.color ?? null;
    const child = parent.children?.find((c) => c.id === id);
    if (child) return parent.color ?? child.color ?? null;
  }
  return null;
}

/** Compact account label for pills/meta: "····4398", "VISA ····7022", or a
 *  truncated name when it carries no trailing digits. */
export function accountTail(name: string): string {
  const match = name.match(/(\d{4})\s*$/);
  if (!match) return name.length > 14 ? `${name.slice(0, 13)}…` : name;
  return `${/visa/i.test(name) ? "VISA " : ""}····${match[1]}`;
}

/** 38px category icon tile — zone-colored background + category icon.
 *  Uncategorized falls back to a sage Banknote. Shared by the Movimientos
 *  card row and the "Más" sheet header. */
export function TransactionIconTile({
  category,
  categories,
}: {
  category: { id: string; icon: string | null } | null;
  categories: CategoryWithChildren[];
}) {
  const color = category ? resolveCategoryColor(categories, category.id) : null;
  return (
    <div
      className="flex size-[38px] shrink-0 items-center justify-center rounded-xl"
      style={{
        backgroundColor: color
          ? chipBackground(color)
          : "color-mix(in srgb, var(--z-sage) 14%, transparent)",
      }}
    >
      {category?.icon ? (
        <span className="flex" style={{ color: color ? zoneTextColor(color) : "var(--z-sage-light)" }}>
          <CategoryIcon icon={category.icon} className="size-[17px]" />
        </span>
      ) : (
        <Banknote className="size-[17px] text-z-sage-light" />
      )}
    </div>
  );
}

/**
 * Minimal transaction contract the action surface needs — a structural subset
 * of `TransactionWithAccount` (so the Movimientos row passes its full tx as-is)
 * that lighter sources (dashboard recent activity) can also satisfy via a small
 * adapter. Keep this lean: only fields actually read below.
 */
export interface QuickActionTransaction {
  id: string;
  account_id: string;
  direction: "INFLOW" | "OUTFLOW";
  amount: number;
  currency_code: string;
  transaction_date: string;
  transaction_time?: string | null;
  raw_description: string | null;
  merchant_name: string | null;
  clean_description: string | null;
  account?: { name: string; color: string | null } | null;
  category: {
    id: string;
    name: string;
    name_es: string | null;
    icon: string | null;
    color: string | null;
  } | null;
  destinatario: { id: string; name: string } | null;
  is_excluded: boolean;
  recurrence_group_id: string | null;
  personal_debt_id: string | null;
  transfer_group_id: string | null;
  split_group_id?: string | null;
}

export interface TransactionQuickActionsProps {
  transaction: QuickActionTransaction;
  categories: CategoryWithChildren[];
  tags?: Array<{ id: string; name: string; color: string | null; group_color: string | null }>;
  /** Account IDs with pending recurring occurrences — enables "Vincular a recurrente". */
  linkableAccountIds?: Set<string>;
  /** Called after a successful category assignment (e.g. categorizar inbox removes the row). */
  onCategorized?: (txId: string, categoryId: string) => void;
}

/**
 * Canonical expanded action surface for a transaction row, shared by Inicio
 * (recent activity), Movimientos, and the Categorizar inbox. Prototipo
 * "Movimientos" de Claude Design: un trío fijo de botones ghost (Categoría ·
 * Destinatario · Más); todo lo secundario vive en la hoja "Más" — cabecera con
 * la transacción, fila de etiquetas, tiles de acciones 2×2 y "Ver / editar".
 */
export function TransactionQuickActions({
  transaction: tx,
  categories,
  onCategorized,
}: TransactionQuickActionsProps) {
  const router = useRouter();
  const destinatarios = useDestinatarios();
  const [, startTransition] = useTransition();

  // Optimistic local state mirrors the row's category/destinatario/excluded.
  const [localCategory, setLocalCategory] = useState(tx.category);
  const [localDestinatario, setLocalDestinatario] = useState(tx.destinatario);
  const [excluded, setExcluded] = useState(tx.is_excluded);

  const [moreOpen, setMoreOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [destOpen, setDestOpen] = useState(false);

  // Link-to-recurring + link-to-persona sheets (same flow as before).
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [occurrenceCandidates, setOccurrenceCandidates] = useState<CandidateOccurrence[]>([]);
  const [isLinking, startLinkTransition] = useTransition();
  const [personaPickerOpen, setPersonaPickerOpen] = useState(false);
  const [personaCandidates, setPersonaCandidates] = useState<LinkCandidate[]>([]);
  const [personaCreateOpen, setPersonaCreateOpen] = useState(false);

  // Linked-recurrente state is local so the tile flips without a refresh.
  // `undefined` = not fetched yet; `null` = fetched and none found — the
  // distinction stops the effect from re-firing the fetch on every render
  // when a recurrence_group_id has no occurrence row behind it.
  const [isLinkedRecurring, setIsLinkedRecurring] = useState(!!tx.recurrence_group_id);
  const [linkedRecurring, setLinkedRecurring] = useState<LinkedRecurringInfo | null | undefined>(undefined);
  const [recurringActionsOpen, setRecurringActionsOpen] = useState(false);
  // Confirmation for the destructive "desasociar" of a payment registered from
  // Plan — reverting it deletes the auto-created transaction.
  const [confirmRevertOpen, setConfirmRevertOpen] = useState(false);

  // Lazy-resolve the linked recurrente's name when the sheet opens; reset on
  // close so a reopen never shows stale data (the server fn is cached).
  useEffect(() => {
    if (!moreOpen) {
      setLinkedRecurring(undefined);
      return;
    }
    if (isLinkedRecurring && linkedRecurring === undefined) {
      getLinkedRecurringForTransaction(tx.id).then((info) => {
        setLinkedRecurring(info);
      });
    }
  }, [moreOpen, isLinkedRecurring, linkedRecurring, tx.id]);

  // The linked transaction was created by registering the payment from Plan
  // (MANUAL_FORM, not linked by hand) — reverting deletes it. Anything else
  // (EMAIL_IMPORT, PDF_IMPORT, OCR…, TEXT_QUICK_CAPTURE) existed on its own
  // and auto-matched the occurrence, so the drawer also offers unlink-and-keep.
  // `null` capture (still loading / legacy row) falls back to the
  // destructive-confirm path.
  const paymentCreatedTx =
    linkedRecurring != null &&
    !linkedRecurring.linkedManually &&
    (linkedRecurring.transactionCaptureMethod === "MANUAL_FORM" ||
      linkedRecurring.transactionCaptureMethod === null);

  const canLinkPersona = !tx.personal_debt_id && !tx.transfer_group_id;
  // A shared payment splits a spend the user fronted: only OUTFLOWs, not already
  // linked to a person/transfer, and not already split.
  const canSplit =
    tx.direction === "OUTFLOW" &&
    !tx.personal_debt_id &&
    !tx.transfer_group_id &&
    !tx.split_group_id;

  const description =
    tx.merchant_name || tx.clean_description || tx.raw_description || "Sin descripción";

  const debtCounterparty =
    localDestinatario &&
    destinatarios?.some((d) => d.id === localDestinatario.id && d.kind === "person")
      ? localDestinatario
      : null;

  function handleCategorize(categoryId: string | null) {
    if (!categoryId) return;
    const cat = categories
      .flatMap((c) => [c, ...(c.children ?? [])])
      .find((c) => c.id === categoryId);
    if (cat) {
      setLocalCategory({ id: cat.id, name: cat.name, name_es: cat.name_es, icon: cat.icon, color: cat.color });
    }
    startTransition(async () => {
      const result = await categorizeTransaction(tx.id, categoryId);
      if (!result.success) {
        setLocalCategory(tx.category);
        toast.error("Error al categorizar");
      } else {
        onCategorized?.(tx.id, categoryId);
      }
    });
  }

  function handleDestinatarioChange(id: string | null, name: string | null) {
    if (id) {
      setLocalDestinatario({ id, name: name ?? "" });
      startTransition(async () => {
        const result = await assignDestinatario(tx.id, id);
        if (!result.success) {
          setLocalDestinatario(tx.destinatario);
          toast.error("Error al asignar destinatario");
        } else if (result.data.appliedCategoryId) {
          // The destinatario carried a default category and the transaction had
          // none, so the action just categorized it server-side. Reflect that
          // optimistically — the category chip here and the collapsed-row
          // subtitle (via onCategorized) — instead of waiting for a refresh.
          const appliedId = result.data.appliedCategoryId;
          const cat = categories
            .flatMap((c) => [c, ...(c.children ?? [])])
            .find((c) => c.id === appliedId);
          if (cat) {
            setLocalCategory({ id: cat.id, name: cat.name, name_es: cat.name_es, icon: cat.icon, color: cat.color });
          }
          onCategorized?.(tx.id, appliedId);
        }
      });
    } else {
      setLocalDestinatario(null);
      startTransition(async () => {
        const result = await removeDestinatarioFromTransaction(tx.id);
        if (!result.success) {
          setLocalDestinatario(tx.destinatario);
          toast.error("Error al quitar destinatario");
        }
      });
    }
  }

  function handleUseDestAsTitle() {
    if (!localDestinatario) return;
    startTransition(async () => {
      const result = await assignDestinatario(tx.id, localDestinatario.id, true);
      if (result.success) {
        toast.success("Título actualizado");
        router.refresh();
      } else {
        toast.error(result.error ?? "No se pudo actualizar el título");
      }
    });
  }

  function handleToggleExclude() {
    const next = !excluded;
    setExcluded(next);
    setMoreOpen(false);
    startTransition(async () => {
      const result = await toggleExcludeTransaction(tx.id, next);
      if (!result.success) {
        setExcluded(!next);
        toast.error("No se pudo actualizar");
      }
    });
  }

  function handleOpenLinkPicker() {
    setMoreOpen(false);
    setLinkPickerOpen(true);
    getCandidateOccurrencesForTransaction(tx.id).then((result) => {
      if (result.success) {
        setOccurrenceCandidates(result.data);
      } else {
        toast.error(result.error ?? "Error al buscar recurrentes");
        setLinkPickerOpen(false);
      }
    });
  }

  function handleConfirmLink(occurrenceId: string) {
    setLinkPickerOpen(false);
    startLinkTransition(async () => {
      const result = await linkExistingTransactionToOccurrence(occurrenceId, tx.id);
      if (result.success) {
        // Flip the tile to its linked state; the name resolves on next sheet open.
        setIsLinkedRecurring(true);
        toast.success("Transacción vinculada a recurrente");
      } else {
        toast.error(result.error ?? "No se pudo vincular");
      }
    });
  }

  function handleDissociateRecurring(keepTransaction = false) {
    if (!linkedRecurring) return;
    const occurrenceId = linkedRecurring.occurrenceId;
    // A payment registered from Plan created its transaction — reverting it
    // deletes that transaction, so confirm first via the AlertDialog. Manual
    // links and explicit keep-transaction unlinks only detach the pre-existing
    // transaction, so they run immediately.
    const willDeleteTransaction = !linkedRecurring.linkedManually && !keepTransaction;
    if (willDeleteTransaction && !confirmRevertOpen) {
      setConfirmRevertOpen(true);
      return;
    }
    startLinkTransition(async () => {
      const result = await revertOccurrence(occurrenceId, { keepTransaction });
      if (result.success) {
        // Close the overlays only on success: the loading state stays visible
        // during the request, and a failure keeps the user in context to retry.
        setConfirmRevertOpen(false);
        setRecurringActionsOpen(false);
        setMoreOpen(false);
        setIsLinkedRecurring(false);
        setLinkedRecurring(undefined);
        toast.success(
          willDeleteTransaction
            ? "Pago deshecho y transacción eliminada"
            : "Transacción desvinculada de la recurrente",
        );
        // Refresh so a deleted transaction drops out of the current list.
        router.refresh();
      } else {
        toast.error(result.error ?? "No se pudo desasociar");
      }
    });
  }

  function handleOpenPersonaPicker() {
    setMoreOpen(false);
    setPersonaPickerOpen(true);
    getPersonalDebts()
      .then((result) => {
        if (!result.success) {
          toast.error(result.error ?? "Error al buscar personas");
          setPersonaPickerOpen(false);
          return;
        }
        const candidates: LinkCandidate[] = result.data
          .filter((d) => d.status === "active")
          .map((d) => ({
            id: d.id,
            label: d.destinatario_name,
            // Distinguish debts that belong to a shared payment from standalone
            // ones: linking here also updates the shared payment's recovered/spend.
            sublabel: d.split_group_id
              ? d.notes || "Parte de un pago compartido"
              : d.direction === "borrowed"
                ? "Le debes"
                : "Te debe",
            badge: d.split_group_id ? "Pago compartido" : undefined,
            amount: d.outstanding_amount,
            currencyCode: d.currency_code,
            direction: d.direction === "borrowed" ? "OUTFLOW" : "INFLOW",
            matchScore: 0,
          }));
        setPersonaCandidates(candidates);
      })
      .catch((err) => {
        console.error("Failed to fetch personal debts:", err);
        toast.error("Error de red al buscar personas");
        setPersonaPickerOpen(false);
      });
  }

  function handleConfirmPersonaLink(debtId: string, fromCreate = false) {
    setPersonaPickerOpen(false);
    const danglingMsg =
      "Deuda creada, pero no se pudo vincular. Búscala en Deudas personales para vincularla.";
    startLinkTransition(async () => {
      try {
        const result = await linkTransactionToPersonalDebt(debtId, tx.id);
        if (result.success) {
          toast.success("Transacción vinculada a deuda personal");
          router.refresh();
        } else if (fromCreate) {
          toast.error(danglingMsg);
          router.refresh();
        } else {
          toast.error(result.error ?? "No se pudo vincular");
        }
      } catch {
        toast.error(fromCreate ? danglingMsg : "No se pudo vincular");
        if (fromCreate) router.refresh();
      }
    });
  }

  const sheetMeta = [
    formatDate(tx.transaction_date, "EEEE, dd MMM"),
    tx.transaction_time ? tx.transaction_time.slice(0, 5) : null,
    tx.account ? accountTail(tx.account.name) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-2">
      {/* Primary trio — fixed labels; assigned state lives on the card itself */}
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => setCatOpen(true)} className={TRIO_BTN_CLASS}>
          <TagIcon className="size-3.5 shrink-0" />
          Categoría
        </button>
        <button type="button" onClick={() => setDestOpen(true)} className={TRIO_BTN_CLASS}>
          <UserRound className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate">{localDestinatario?.name ?? "Destinatario"}</span>
        </button>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="Más acciones"
          className={TRIO_BTN_CLASS}
        >
          <MoreHorizontal className="size-3.5 shrink-0" />
          Más
        </button>
      </div>

      {/* Hidden controlled pickers driven by the trio buttons */}
      <CategoryZonePicker
        categories={categories}
        value={localCategory?.id ?? null}
        onValueChange={handleCategorize}
        direction={tx.direction}
        hideTrigger
        controlledOpen={catOpen}
        onControlledOpenChange={setCatOpen}
      />
      <DestinatarioZonePicker
        value={localDestinatario?.id ?? null}
        onValueChange={handleDestinatarioChange}
        selectedName={localDestinatario?.name}
        hideTrigger
        controlledOpen={destOpen}
        onControlledOpenChange={setDestOpen}
        categories={categories}
        onUseAsTitle={localDestinatario ? handleUseDestAsTitle : undefined}
        rawDescription={tx.raw_description}
        merchantName={tx.merchant_name}
        amount={tx.amount}
        currencyCode={tx.currency_code as CurrencyCode}
      />

      {/* "Más" sheet — tx header + etiquetas + action tiles */}
      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent>
          <DrawerHeader className="sr-only">
            <DrawerTitle>Más acciones</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="pb-[calc(3rem_+_env(safe-area-inset-bottom))]">
            {/* Transaction header */}
            <div className="flex items-center gap-3 border-b border-white/6 px-1 pb-3.5">
              <TransactionIconTile category={localCategory} categories={categories} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{description}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-z-sage-dark first-letter:uppercase">{sheetMeta}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-[15px] font-medium tabular-nums",
                  tx.direction === "INFLOW" ? "text-z-income" : "text-z-expense",
                )}
              >
                {tx.direction === "INFLOW" ? "+" : "−"}
                {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
              </span>
            </div>

            {/* Etiquetas */}
            <div className="px-1 py-3">
              <TagZonePicker
                entityType="transaction"
                entityId={tx.id}
                variant="drawer"
                triggerClassName="w-full justify-start rounded-lg border border-white/6 bg-white/[0.03] px-3 py-2.5 text-sm"
              />
            </div>

            {/* Acciones — 4 posiciones FIJAS: Recurrente · Deuda personal ·
                Repartir · Excluir. Un slot ya asignado cambia de estado en su
                sitio (nunca desaparece), para que la memoria muscular no se
                rompa entre transacciones. */}
            <p className={cn(SECTION_EYEBROW_CLASS, "px-1 pb-2")}>Acciones</p>
            <div className="grid grid-cols-2 gap-2 px-1">
              {isLinkedRecurring ? (
                <button
                  type="button"
                  onClick={() => setRecurringActionsOpen(true)}
                  className={cn(SHEET_TILE_CLASS, "border-z-brass/20 bg-z-brass/8 transition-colors hover:bg-z-brass/12")}
                >
                  <Repeat className="size-[18px] text-z-brass" />
                  <span className="max-w-full truncate px-1 text-[13px] leading-tight text-z-brass">
                    {linkedRecurring?.templateMerchant ?? "Recurrente"}
                  </span>
                  <span className="text-[10px] text-z-sage-dark">Vinculada a recurrente</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenLinkPicker}
                  disabled={isLinking}
                  className={cn(SHEET_TILE_CLASS, SHEET_TILE_ACTION_CLASS)}
                >
                  <Link2 className="size-[18px] text-z-brass-hot" />
                  <span className="text-[13px] leading-tight text-z-sage-light">Vincular a recurrente</span>
                </button>
              )}

              {tx.personal_debt_id ? (
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    router.push("/deudas-personales");
                  }}
                  className={cn(SHEET_TILE_CLASS, "border-z-brass/20 bg-z-brass/8 transition-colors hover:bg-z-brass/12")}
                >
                  <Users className="size-[18px] text-z-brass" />
                  <span className="text-[13px] leading-tight text-z-brass">Deuda personal</span>
                  <span className="text-[10px] text-z-sage-dark">Vinculada · ver</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenPersonaPicker}
                  disabled={!canLinkPersona || isLinking}
                  className={cn(SHEET_TILE_CLASS, SHEET_TILE_ACTION_CLASS)}
                >
                  <Users className="size-[18px] text-z-brass-hot" />
                  <span className="text-[13px] leading-tight text-z-sage-light">Vincular a deuda personal</span>
                </button>
              )}

              {tx.split_group_id ? (
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    router.push("/deudas-personales");
                  }}
                  className={cn(SHEET_TILE_CLASS, "border-z-brass/20 bg-z-brass/8 transition-colors hover:bg-z-brass/12")}
                >
                  <Receipt className="size-[18px] text-z-brass" />
                  <span className="text-[13px] leading-tight text-z-brass">Gasto repartido</span>
                  <span className="text-[10px] text-z-sage-dark">Pago compartido · ver</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    router.push(`/deudas-personales/pago-compartido/nuevo?from_tx=${tx.id}`);
                  }}
                  disabled={!canSplit}
                  className={cn(SHEET_TILE_CLASS, SHEET_TILE_ACTION_CLASS)}
                >
                  <Receipt className="size-[18px] text-z-brass-hot" />
                  <span className="text-[13px] leading-tight text-z-sage-light">Repartir gasto</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleExclude}
                className={cn(SHEET_TILE_CLASS, SHEET_TILE_ACTION_CLASS)}
              >
                {excluded ? (
                  <Eye className="size-[18px] text-z-brass-hot" />
                ) : (
                  <EyeOff className="size-[18px] text-z-brass-hot" />
                )}
                <span className="text-[13px] leading-tight text-z-sage-light">
                  {excluded ? "Incluir en métricas" : "Excluir de métricas"}
                </span>
              </button>
            </div>

            <Link
              href={`/transactions/${tx.id}`}
              className={cn(
                "mx-1 mt-3.5 flex h-10 items-center justify-center gap-2 rounded-lg border text-sm",
                GHOST_BUTTON_CLASS,
              )}
            >
              <Pencil className="size-[15px]" />
              Ver / editar detalle
            </Link>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Linked-recurrente actions — opened from the assigned tile */}
      <Drawer open={recurringActionsOpen} onOpenChange={setRecurringActionsOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{linkedRecurring?.templateMerchant ?? "Recurrente"}</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="pb-[calc(3rem_+_env(safe-area-inset-bottom))]">
            <div className="px-1">
              <button
                type="button"
                onClick={() => {
                  setRecurringActionsOpen(false);
                  setMoreOpen(false);
                  if (linkedRecurring) router.push(`/recurrentes/${linkedRecurring.templateId}/edit`);
                }}
                disabled={!linkedRecurring}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-white/5 disabled:opacity-50"
              >
                <Repeat className="size-4 text-muted-foreground" />
                Ver recurrente
              </button>
              {linkedRecurring?.linkedManually ? (
                <button
                  type="button"
                  onClick={() => handleDissociateRecurring()}
                  disabled={isLinking}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-z-expense transition-colors hover:bg-white/5 disabled:opacity-50"
                >
                  <Link2Off className="size-4" />
                  Desvincular de la recurrente
                </button>
              ) : linkedRecurring && !paymentCreatedTx ? (
                <>
                  {/* Imported/captured tx that auto-matched the occurrence: the
                      safe unlink keeps the bank record; delete stays available
                      behind its confirm dialog. */}
                  <button
                    type="button"
                    onClick={() => handleDissociateRecurring(true)}
                    disabled={isLinking}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-white/5 disabled:opacity-50"
                  >
                    <Link2Off className="size-4 text-muted-foreground" />
                    Desvincular de la recurrente
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDissociateRecurring()}
                    disabled={isLinking}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-z-expense transition-colors hover:bg-white/5 disabled:opacity-50"
                  >
                    <Trash2 className="size-4" />
                    Deshacer pago y eliminar transacción
                  </button>
                  <div className="mt-1 flex items-start gap-2 rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2.5">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-z-brass" />
                    <p className="text-xs text-muted-foreground">
                      Esta transacción no se creó desde el pago de la recurrente, sino
                      que se vinculó automáticamente. Al desvincularla{" "}
                      <span className="font-medium text-foreground">
                        la transacción se conserva
                      </span>{" "}
                      y el pago volverá a quedar pendiente en Plan.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleDissociateRecurring()}
                    disabled={isLinking || !linkedRecurring}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-z-expense transition-colors hover:bg-white/5 disabled:opacity-50"
                  >
                    <Trash2 className="size-4" />
                    Deshacer pago y eliminar transacción
                  </button>
                  <div className="mt-1 flex items-start gap-2 rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2.5">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-z-brass" />
                    <p className="text-xs text-muted-foreground">
                      Esta transacción se creó al registrar el pago de la recurrente. Al
                      desasociarla se{" "}
                      <span className="font-medium text-foreground">eliminará la transacción</span>{" "}
                      y el pago volverá a quedar pendiente en Plan.
                    </p>
                  </div>
                </>
              )}
            </div>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Confirm destructive revert — payment registered from Plan */}
      <AlertDialog open={confirmRevertOpen} onOpenChange={setConfirmRevertOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Deshacer este pago?</AlertDialogTitle>
            <AlertDialogDescription>
              {paymentCreatedTx
                ? `Esta transacción se creó al registrar el pago de ${linkedRecurring?.templateMerchant ?? "la recurrente"}.`
                : `Esta transacción está vinculada al pago de ${linkedRecurring?.templateMerchant ?? "la recurrente"}.`}{" "}
              Al deshacer el pago se eliminará la transacción, se revertirá su efecto en
              el saldo y el pago volverá a quedar pendiente en Plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLinking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isLinking}
              onClick={(e) => {
                // Keep the dialog logic in our handler; prevent the default
                // auto-close so the pending state stays visible and the dialog
                // only closes once the revert succeeds.
                e.preventDefault();
                handleDissociateRecurring();
              }}
            >
              {isLinking ? "Eliminando…" : "Eliminar transacción"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Link-to-recurring picker */}
      {linkPickerOpen && (
        <LinkPickerSheet
          open={linkPickerOpen}
          onOpenChange={setLinkPickerOpen}
          title="Vincular a recurrente"
          subtitle={`${description} · ${formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}`}
          candidates={occurrenceCandidates.map((o) => ({
            id: o.id,
            label: o.merchant,
            sublabel: `${formatDate(o.occurrenceDate)} · ${formatCurrency(o.expectedAmount, o.currencyCode as CurrencyCode)} esperado`,
            amount: o.expectedAmount,
            currencyCode: o.currencyCode,
            direction: tx.direction,
            matchScore: o.matchScore,
          }))}
          onConfirm={handleConfirmLink}
          isPending={isLinking}
          onCreateNew={() => {
            setLinkPickerOpen(false);
            router.push(`/transactions/${tx.id}?promote=1`);
          }}
        />
      )}

      {/* Link-to-deuda-personal picker */}
      {personaPickerOpen && (
        <LinkPickerSheet
          open={personaPickerOpen}
          onOpenChange={setPersonaPickerOpen}
          title="Vincular a deuda personal"
          subtitle={`${description} · ${formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}`}
          candidates={personaCandidates}
          onConfirm={handleConfirmPersonaLink}
          isPending={isLinking}
          onCreateNew={() => {
            setPersonaPickerOpen(false);
            setPersonaCreateOpen(true);
          }}
          createNewLabel="Crear deuda personal nueva"
          createNewSublabel="Registra la deuda y vincula esta transacción"
          createNewIcon={<UserPlus className="size-4 text-z-brass" aria-hidden="true" />}
        />
      )}

      {/* Create deuda personal + auto-link */}
      {personaCreateOpen && (
        <CreatePersonalDebtSheet
          open={personaCreateOpen}
          onOpenChange={setPersonaCreateOpen}
          currency={tx.currency_code as CurrencyCode}
          defaultDirection={tx.direction === "INFLOW" ? "borrowed" : "lent"}
          defaultAmount={tx.amount}
          defaultDestinatarioId={debtCounterparty?.id ?? null}
          defaultDestinatarioName={debtCounterparty?.name ?? null}
          defaultOpenedOn={tx.transaction_date}
          onCreated={(debtId) => handleConfirmPersonaLink(debtId, true)}
        />
      )}
    </div>
  );
}

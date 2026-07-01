"use client";

import { startTransition, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  EyeOff,
  Eye,
  Link2,
  MapPin,
  Pencil,
  Plus,
  Receipt,
  Repeat,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { chipBackground, zoneTextColor } from "@/lib/utils/zone-colors";
import {
  BRASS_BUTTON_CLASS,
  DESTRUCTIVE_BUTTON_CLASS,
  DETAIL_ACTION_CHIP_CLASS,
  GHOST_BUTTON_CLASS,
  MOBILE_SHEET_SAFE_AREA_CLASS,
  SECTION_EYEBROW_CLASS,
} from "@/lib/constants/styles";
import { CategoryIcon } from "@/components/categories/category-icon";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import { DestinatarioZonePicker } from "@/components/destinatarios/destinatario-zone-picker";
import { TagZonePicker } from "@/components/tags/tag-zone-picker";
import { LinkPickerSheet } from "@/components/recurring/link-picker-sheet";
import { PromoteToRecurringButton } from "@/components/transactions/promote-to-recurring-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  categorizeTransaction,
  uncategorizeTransaction,
  assignDestinatario,
  removeDestinatarioFromTransaction,
} from "@/actions/categorize";
import {
  deleteTransaction,
  getTransactionLocation,
  toggleExcludeTransaction,
  updateTransactionAccount,
  updateTransactionAmountAndDate,
  updateTransactionNotes,
  updateTransactionTitle,
} from "@/actions/transactions";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerTitle,
} from "@/components/ui/drawer";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { removeTagFromEntity } from "@/actions/tags";
import {
  getCandidateOccurrencesForTransaction,
  linkExistingTransactionToOccurrence,
  type CandidateOccurrence,
  type LinkedRecurringInfo,
} from "@/actions/occurrences";
import type {
  Account,
  CategoryWithChildren,
  CurrencyCode,
  SharedPaymentGroup,
  Tag as TagType,
  Transaction,
  TransactionLocation,
} from "@/types/domain";

/** Fallback category chip color when a category has no `color` set. Hex literal
 * is intentional — `chipBackground()` / `zoneTextColor()` in `zone-colors.ts`
 * process raw hex, not CSS variables. Matches --z-sage (#768053). */
const FALLBACK_CAT_COLOR = "#768053";

interface TransactionDetailClientProps {
  transaction: Transaction;
  /** Current destinatario name — fetched alongside the tx to avoid a type extension. */
  currentDestinatarioName: string | null;
  accounts: Account[];
  categories: CategoryWithChildren[];
  initialTags: TagType[];
  isLinkedToOccurrence: boolean;
  /** Recurring template + occurrence linked to this tx, if any. */
  linkedRecurring: LinkedRecurringInfo | null;
  /** Account IDs that have at least one pending occurrence — enables "Vincular". */
  linkableAccountIds: string[];
  /** Set when this tx is a shared-payment origin — surfaces a summary block. */
  sharedPayment: SharedPaymentGroup | null;
}

function findLeafCategory(
  categories: CategoryWithChildren[],
  id: string | null,
): { id: string; name: string; icon: string | null; color: string | null } | null {
  if (!id) return null;
  for (const zone of categories) {
    if (zone.id === id) {
      return { id: zone.id, name: zone.name_es ?? zone.name ?? "", icon: zone.icon ?? null, color: zone.color ?? null };
    }
    const child = zone.children.find((c) => c.id === id);
    if (child) {
      // child inherits zone color when it doesn't have its own
      return {
        id: child.id,
        name: child.name_es ?? child.name ?? "",
        icon: child.icon ?? null,
        color: child.color ?? zone.color ?? null,
      };
    }
  }
  return null;
}

export function TransactionDetailClient({
  transaction: tx,
  currentDestinatarioName,
  accounts,
  categories,
  initialTags,
  isLinkedToOccurrence,
  linkedRecurring,
  linkableAccountIds,
  sharedPayment,
}: TransactionDetailClientProps) {
  const router = useRouter();
  const isInflow = tx.direction === "INFLOW";

  /* ─── Cuenta (optimistic; balance-safe change via updateTransactionAccount) ─ */
  const [optAccountId, setOptAccountId] = useState(tx.account_id);
  const [accountOpen, setAccountOpen] = useState(false);
  const [, startAccountTransition] = useTransition();
  const account = useMemo(
    () => accounts.find((a) => a.id === optAccountId) ?? null,
    [accounts, optAccountId],
  );

  function handleAccountSelect(accountId: string) {
    setAccountOpen(false);
    if (accountId === optAccountId) return;
    const prev = optAccountId;
    setOptAccountId(accountId);
    startAccountTransition(async () => {
      const result = await updateTransactionAccount(tx.id, accountId);
      if (result.success) {
        toast.success("Cuenta actualizada");
        router.refresh();
      } else {
        setOptAccountId(prev);
        toast.error(result.error ?? "No se pudo cambiar la cuenta");
      }
    });
  }

  /* ─── Monto / Fecha · Hora — staged critical edit ──────────────────── */
  const [optAmount, setOptAmount] = useState(tx.amount);
  const [optDate, setOptDate] = useState(tx.transaction_date);
  const [optTime, setOptTime] = useState<string | null>(tx.transaction_time);
  const [editDataOpen, setEditDataOpen] = useState(false);
  const [sharedExpanded, setSharedExpanded] = useState(false);
  const [draftAmount, setDraftAmount] = useState(String(tx.amount));
  const [draftDate, setDraftDate] = useState(tx.transaction_date);
  const [draftTime, setDraftTime] = useState(tx.transaction_time?.slice(0, 5) ?? "");
  const [savingData, startDataTransition] = useTransition();

  function openEditData() {
    setDraftAmount(String(optAmount));
    setDraftDate(optDate);
    setDraftTime(optTime?.slice(0, 5) ?? "");
    setEditDataOpen(true);
  }

  function handleSaveData() {
    const amount = Number(draftAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }
    const time = draftTime ? `${draftTime}:00` : null;
    startDataTransition(async () => {
      const result = await updateTransactionAmountAndDate(tx.id, {
        amount,
        transaction_date: draftDate,
        transaction_time: time,
      });
      if (result.success) {
        setOptAmount(amount);
        setOptDate(draftDate);
        setOptTime(time);
        setEditDataOpen(false);
        toast.success("Datos actualizados");
        router.refresh();
      } else {
        toast.error(result.error ?? "No se pudieron guardar los cambios");
      }
    });
  }

  const dataDirty =
    Number(draftAmount.replace(",", ".")) !== optAmount ||
    draftDate !== optDate ||
    (draftTime ? `${draftTime}:00` : null) !== optTime;

  /* ─── Linked location (lazy fetch — only when tx.location_id is set) ─── */
  const [location, setLocation] = useState<TransactionLocation | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  useEffect(() => {
    if (!tx.location_id) return;
    let cancelled = false;
    void (async () => {
      const result = await getTransactionLocation(tx.location_id!);
      if (!cancelled && result.success) setLocation(result.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [tx.location_id]);

  /* ─── Optimistic category ─────────────────────────────────────────── */
  const [optCategoryId, setOptCategoryId] = useState<string | null>(tx.category_id);
  const [catOpen, setCatOpen] = useState(false);
  const [, startCategoryTransition] = useTransition();
  const selectedCategory = findLeafCategory(categories, optCategoryId);

  function handleCategorySelect(id: string | null) {
    setOptCategoryId(id);
    setCatOpen(false);
    startCategoryTransition(async () => {
      const result = id
        ? await categorizeTransaction(tx.id, id)
        : await uncategorizeTransaction(tx.id);
      if (!result.success) {
        setOptCategoryId(tx.category_id);
        toast.error(result.error ?? "Error al asignar categoría");
      } else {
        toast.success(
          id && selectedCategory
            ? `Categoría: ${selectedCategory.name}`
            : "Categoría removida",
        );
      }
    });
  }

  /* ─── Editable title ─────────────────────────────────────────────── */
  const titleFallback = tx.merchant_name || tx.clean_description || "";
  const [title, setTitle] = useState(titleFallback);
  const [titleLocked, setTitleLocked] = useState<boolean>(tx.title_locked ?? false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDirty, setTitleDirty] = useState(false);
  const [, startTitleSave] = useTransition();
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  function handleTitleOpen() {
    setTitleEditing(true);
    requestAnimationFrame(() => titleInputRef.current?.focus());
  }

  function handleTitleBlur() {
    setTitleEditing(false);
    if (!titleDirty) return;
    const next = title.trim();
    startTitleSave(async () => {
      const result = await updateTransactionTitle(tx.id, next || null);
      if (result.success) {
        setTitleDirty(false);
        setTitleLocked(next.length > 0);
        // Cleared title → DB falls back to clean_description; match it locally
        // so the UI doesn't flash the generic placeholder until reload.
        if (!next) setTitle(tx.clean_description || "");
        toast.success("Título actualizado");
      } else {
        setTitle(titleFallback);
        setTitleDirty(false);
        toast.error(result.error ?? "No se pudo guardar el título");
      }
    });
  }

  /* ─── Optimistic destinatario ────────────────────────────────────── */
  const [optDestId, setOptDestId] = useState<string | null>(tx.destinatario_id);
  const [optDestName, setOptDestName] = useState<string | null>(currentDestinatarioName);
  const [destOpen, setDestOpen] = useState(false);
  const [, startDestTransition] = useTransition();
  // When the user has a locked (manually edited) title, assigning a destinatario
  // whose name differs prompts before replacing the title.
  const [pendingAssign, setPendingAssign] = useState<{ id: string; name: string } | null>(null);

  function runAssign(id: string, name: string | null, overwriteTitle: boolean) {
    const prevId = optDestId;
    const prevName = optDestName;
    setOptDestId(id);
    setOptDestName(name);
    startDestTransition(async () => {
      const result = await assignDestinatario(tx.id, id, overwriteTitle);
      if (result.success) {
        toast.success(`Destinatario: ${name}`);
        if (overwriteTitle && name) {
          setTitle(name);
          setTitleLocked(true);
        }
      } else {
        setOptDestId(prevId);
        setOptDestName(prevName);
        toast.error(result.error ?? "No se pudo asignar destinatario");
      }
    });
  }

  function runRemoveDestinatario() {
    const prevId = optDestId;
    const prevName = optDestName;
    setOptDestId(null);
    setOptDestName(null);
    startDestTransition(async () => {
      const result = await removeDestinatarioFromTransaction(tx.id);
      if (result.success) {
        toast.success("Destinatario quitado");
      } else {
        setOptDestId(prevId);
        setOptDestName(prevName);
        toast.error(result.error ?? "No se pudo quitar el destinatario");
      }
    });
  }

  function handleUseDestAsTitle() {
    if (!optDestId) return;
    runAssign(optDestId, optDestName, true);
  }

  function handleDestSelect(id: string | null, name: string | null) {
    setDestOpen(false);
    if (!id) {
      runRemoveDestinatario();
      return;
    }
    if (titleLocked && name && name !== title) {
      setPendingAssign({ id, name });
      return;
    }
    runAssign(id, name, false);
  }

  /* ─── Tags — optimistic add/remove ────────────────────────────────── */
  const [tagOpen, setTagOpen] = useState(false);
  const [tags, setTags] = useState<TagType[]>(initialTags);
  const [, startTagTransition] = useTransition();

  useEffect(() => {
    setTags(initialTags);
  }, [initialTags]);

  function handleRemoveTag(tagId: string) {
    const prev = tags;
    setTags((current) => current.filter((t) => t.id !== tagId));
    startTagTransition(async () => {
      const result = await removeTagFromEntity(tagId, "transaction", tx.id);
      if (!result.success) {
        setTags(prev);
        toast.error(result.error ?? "No se pudo quitar la etiqueta");
      }
    });
  }

  /* ─── Notes — inline textarea, autosave on blur ───────────────────── */
  const [notes, setNotes] = useState(tx.notes ?? "");
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const notesTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [notesEditing, setNotesEditing] = useState(false);

  async function handleNotesBlur() {
    if (!notesDirty) {
      setNotesEditing(false);
      return;
    }
    setNotesSaving(true);
    const result = await updateTransactionNotes(tx.id, notes.trim() || null);
    setNotesSaving(false);
    setNotesEditing(false);
    if (result.success) {
      setNotesDirty(false);
      toast.success("Nota guardada");
    } else {
      // Revert to server value so the UI doesn't silently show unsaved text.
      setNotes(tx.notes ?? "");
      setNotesDirty(false);
      toast.error(result.error ?? "No se pudo guardar la nota");
    }
  }

  function handleNotesOpen() {
    setNotesEditing(true);
    requestAnimationFrame(() => notesTextareaRef.current?.focus());
  }

  /* ─── Raw description disclosure ─────────────────────────────────── */
  const [rawOpen, setRawOpen] = useState(false);

  /* ─── Link to recurring ──────────────────────────────────────────── */
  const [linking, setLinking] = useState(false);
  const [occurrenceCandidates, setOccurrenceCandidates] = useState<CandidateOccurrence[]>([]);
  const [isLinkingPending, startLinkTransition] = useTransition();
  const vincularEligible =
    !isLinkedToOccurrence && linkableAccountIds.includes(tx.account_id);

  async function handleOpenLinkPicker() {
    setLinking(true);
    const result = await getCandidateOccurrencesForTransaction(tx.id);
    if (result.success) {
      setOccurrenceCandidates(result.data);
    } else {
      toast.error(result.error ?? "Error al buscar recurrentes");
      setLinking(false);
    }
  }

  function handleConfirmLink(occurrenceId: string) {
    setLinking(false);
    startLinkTransition(async () => {
      const result = await linkExistingTransactionToOccurrence(occurrenceId, tx.id);
      if (result.success) {
        toast.success("Transacción vinculada a recurrente");
        startTransition(() => router.refresh());
      } else {
        toast.error(result.error ?? "No se pudo vincular");
      }
    });
  }

  /* ─── Secondary actions ────────────────────────────────────────────── */
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [optExcluded, setOptExcluded] = useState(tx.is_excluded);
  const [excluding, setExcluding] = useState(false);

  async function handleToggleExclude() {
    const nextExcluded = !optExcluded;
    setOptExcluded(nextExcluded);
    setExcluding(true);
    const result = await toggleExcludeTransaction(tx.id, nextExcluded);
    setExcluding(false);
    if (result.success) {
      toast.success(nextExcluded ? "Excluida de métricas" : "Incluida en métricas");
    } else {
      setOptExcluded(!nextExcluded);
      toast.error(result.error ?? "No se pudo actualizar");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteTransaction(tx.id);
    setDeleting(false);
    if (result.success) {
      toast.success("Transacción eliminada");
      setDeleteConfirmOpen(false);
      router.push("/transactions");
    } else {
      toast.error(result.error ?? "No se pudo eliminar");
    }
  }

  /* ─── Render ─────────────────────────────────────────────────────── */

  const catChipColor = selectedCategory?.color ?? FALLBACK_CAT_COLOR;

  return (
    <div className="space-y-0">
      {/* ── Hero (centered metadata) ─────────────────────────────────── */}
      <header
        className={cn(
          "relative px-4 pb-4 pt-6 text-center",
          "bg-[radial-gradient(circle_at_top,rgba(200,181,96,0.06),transparent_60%)]",
        )}
      >
        {/* Direction avatar */}
        <span
          className={cn(
            "mx-auto flex size-12 items-center justify-center rounded-full",
            isInflow ? "bg-z-income/14 text-z-income" : "bg-z-expense/14 text-z-expense",
          )}
        >
          {isInflow ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
        </span>

        {/* Amount */}
        <p
          className={cn(
            "mt-3 text-[32px] font-bold leading-none tabular-nums tracking-[-0.01em]",
            isInflow ? "text-z-income" : "text-z-white",
          )}
        >
          {isInflow ? "+" : "-"}
          {formatCurrency(optAmount, tx.currency_code as CurrencyCode)}
        </p>

        {/* Title (editable) */}
        {titleEditing ? (
          <input
            ref={titleInputRef}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleDirty(true);
            }}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                titleInputRef.current?.blur();
              }
            }}
            maxLength={200}
            placeholder="Título de la transacción"
            className="mx-auto mt-2 w-full max-w-xs border-b border-z-brass/40 bg-transparent text-center text-base font-semibold text-z-white outline-none placeholder:text-muted-foreground focus:border-z-brass"
          />
        ) : (
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={handleTitleOpen}
              aria-label="Editar título"
              className="relative max-w-full px-5"
            >
              <h1 className="truncate text-center text-base font-semibold text-z-white">
                {title || "Transacción"}
              </h1>
              <Pencil className="absolute right-0 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/40" />
            </button>
          </div>
        )}

        {/* Status badges */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]",
              isInflow ? "bg-z-income/14 text-z-income" : "bg-z-expense/14 text-z-expense",
            )}
          >
            {isInflow ? "Ingreso" : "Gasto"}
          </span>
          {tx.status === "PENDING" && (
            <span className="inline-flex items-center rounded-full bg-z-brass/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-z-brass">
              Pendiente
            </span>
          )}
          {tx.status === "CANCELLED" && (
            <span className="inline-flex items-center rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Cancelada
            </span>
          )}
          {optExcluded && (
            <span className="inline-flex items-center rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Excluida
            </span>
          )}
        </div>

      </header>

      {/* ── Contexto (read-only facts) ───────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 pt-3 text-[11px] text-muted-foreground">
        <span className="uppercase tracking-wider">{tx.provider}</span>
        <span className="text-white/15">·</span>
        <span>{formatDate(optDate, "dd MMM yyyy")}</span>
        {optTime && (
          <>
            <span className="text-white/15">·</span>
            <span className="tabular-nums">{optTime.slice(0, 5)}</span>
          </>
        )}
      </div>
      <div className="flex justify-center pt-2.5">
        <button
          type="button"
          onClick={openEditData}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/6 bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-white/[0.06]"
        >
          <Pencil className="size-3" />
          Editar datos
        </button>
      </div>

      {/* ── Clasificación (actionable controls) ──────────────────────── */}
      <section className="px-4 pt-5">
        <p className={cn(SECTION_EYEBROW_CLASS, "mb-2")}>Clasificación</p>
        <div className="overflow-hidden rounded-2xl border border-white/6 bg-z-surface-2/60">
          {/* Cuenta */}
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-white/[0.03]"
          >
            <span className="text-sm text-muted-foreground">Cuenta</span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: account?.color ?? undefined }}
              />
              <span className="truncate text-sm font-medium">{account?.name ?? "Sin cuenta"}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
            </span>
          </button>

          {/* Categoría */}
          <button
            type="button"
            onClick={() => setCatOpen(true)}
            className="flex w-full items-center justify-between gap-3 border-t border-white/6 px-3.5 py-3 text-left transition-colors hover:bg-white/[0.03]"
          >
            <span className="text-sm text-muted-foreground">Categoría</span>
            <span className="flex min-w-0 items-center gap-1.5">
              {selectedCategory ? (
                <span
                  className="inline-flex min-w-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{ backgroundColor: chipBackground(catChipColor), color: zoneTextColor(catChipColor) }}
                >
                  {selectedCategory.icon && <CategoryIcon icon={selectedCategory.icon} className="size-3.5 shrink-0" />}
                  <span className="truncate">{selectedCategory.name}</span>
                </span>
              ) : (
                <span className="text-sm text-z-brass">Categorizar</span>
              )}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
            </span>
          </button>

          {/* Destinatario */}
          <button
            type="button"
            onClick={() => setDestOpen(true)}
            className="flex w-full items-center justify-between gap-3 border-t border-white/6 px-3.5 py-3 text-left transition-colors hover:bg-white/[0.03]"
          >
            <span className="text-sm text-muted-foreground">Destinatario</span>
            <span className="flex min-w-0 items-center gap-1.5">
              {optDestName ? (
                <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-z-brass/12 px-2 py-0.5 text-xs font-semibold text-z-brass">
                  <UserRound className="size-3.5 shrink-0" />
                  <span className="truncate">{optDestName}</span>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Asignar</span>
              )}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
            </span>
          </button>

          {/* Etiquetas */}
          <div className="border-t border-white/6 px-3.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Etiquetas</span>
              <button
                type="button"
                onClick={() => setTagOpen(true)}
                className="inline-flex items-center gap-1 text-sm text-z-brass"
              >
                <Plus className="size-3.5" />
                {tags.length > 0 ? "Editar" : "Agregar"}
              </button>
            </div>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 rounded-full border border-z-brass/20 bg-z-brass/10 py-0.5 pl-2.5 pr-1 text-[11px] font-medium text-z-brass"
                  >
                    <span className="truncate">{t.name}</span>
                    <button
                      type="button"
                      aria-label={`Quitar etiqueta ${t.name}`}
                      onClick={() => handleRemoveTag(t.id)}
                      className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full text-z-brass/60 transition-colors hover:bg-z-brass/15 hover:text-z-brass"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Controlled pickers driven by the rows above */}
        <CategoryZonePicker
          categories={categories}
          value={optCategoryId}
          onValueChange={handleCategorySelect}
          direction={tx.direction}
          hideTrigger
          controlledOpen={catOpen}
          onControlledOpenChange={setCatOpen}
        />
        <DestinatarioZonePicker
          value={optDestId}
          selectedName={optDestName}
          onValueChange={handleDestSelect}
          hideTrigger
          controlledOpen={destOpen}
          onControlledOpenChange={setDestOpen}
          categories={categories}
          onUseAsTitle={optDestId ? handleUseDestAsTitle : undefined}
          rawDescription={tx.raw_description}
          merchantName={tx.merchant_name}
          amount={tx.amount}
          currencyCode={tx.currency_code as CurrencyCode}
        />
        <TagZonePicker
          entityType="transaction"
          entityId={tx.id}
          hideTrigger
          controlledOpen={tagOpen}
          onControlledOpenChange={(open) => {
            setTagOpen(open);
            if (!open) startTransition(() => router.refresh());
          }}
        />

        {/* Account picker */}
        <Drawer open={accountOpen} onOpenChange={setAccountOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Cuenta</DrawerTitle>
            </DrawerHeader>
            <DrawerBody className={cn("px-2", MOBILE_SHEET_SAFE_AREA_CLASS)}>
              {accounts
                .filter((a) => a.currency_code === tx.currency_code)
                .map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleAccountSelect(a.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: a.color ?? undefined }}
                    />
                    <span className="truncate">{a.name}</span>
                  </span>
                  {a.id === optAccountId && <Check className="size-4 shrink-0 text-z-brass" />}
                </button>
              ))}
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      </section>

      {/* ── Acciones (uniform grid, reachable above the fold) ────────── */}
      <section className="px-4 pt-5">
        <p className={cn(SECTION_EYEBROW_CLASS, "mb-2")}>Acciones</p>
        <div className="grid grid-cols-2 gap-2">
          <PromoteToRecurringButton
            transaction={{
              id: tx.id,
              account_id: tx.account_id,
              amount: tx.amount,
              currency_code: tx.currency_code as CurrencyCode,
              direction: tx.direction,
              merchant_name: tx.merchant_name,
              clean_description: tx.clean_description,
              category_id: tx.category_id,
              destinatario_id: tx.destinatario_id,
              transaction_date: tx.transaction_date,
            }}
            isLinkedToOccurrence={isLinkedToOccurrence}
            accounts={accounts}
            categories={categories}
            triggerClassName={cn(DETAIL_ACTION_CHIP_CLASS, "w-full")}
          />
          {vincularEligible && (
            <button
              type="button"
              onClick={handleOpenLinkPicker}
              disabled={isLinkingPending}
              className={cn(DETAIL_ACTION_CHIP_CLASS, "w-full")}
            >
              <Link2 className="size-3.5" />
              Vincular
            </button>
          )}
          <button
            type="button"
            onClick={handleToggleExclude}
            disabled={excluding}
            className={cn(DETAIL_ACTION_CHIP_CLASS, "w-full")}
          >
            {optExcluded ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            {optExcluded ? "Incluir en métricas" : "Excluir de métricas"}
          </button>
          <button
            type="button"
            onClick={() => setDeleteConfirmOpen(true)}
            className={cn(DETAIL_ACTION_CHIP_CLASS, "w-full border-z-debt/20 bg-z-debt/8 text-z-debt")}
          >
            <Trash2 className="size-3.5" />
            Eliminar
          </button>
        </div>
      </section>

      {/* ── Vinculado a recurrente ─────────────────────────────────── */}
      {linkedRecurring && (
        <section className="px-4 pt-4">
          <p className={cn(SECTION_EYEBROW_CLASS, "mb-2")}>Recurrente vinculada</p>
          <Link
            href={`/recurrentes/${linkedRecurring.templateId}/edit`}
            className="flex items-center gap-3 rounded-xl border border-z-brass/20 bg-z-brass/8 px-3 py-2.5 transition-colors hover:bg-z-brass/12"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-z-brass/15 text-z-brass">
              <Repeat className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-z-brass">
                {linkedRecurring.templateMerchant}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                Pago de {formatDate(linkedRecurring.occurrenceDate, "dd MMM yyyy")} ·
                {" "}
                {formatCurrency(
                  linkedRecurring.expectedAmount,
                  linkedRecurring.currencyCode as CurrencyCode,
                )}{" "}esperado
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-z-brass/60" />
          </Link>
        </section>
      )}

      {/* ── Pago compartido ────────────────────────────────────────── */}
      {sharedPayment && (
        <section className="px-4 pt-4">
          <p className={cn(SECTION_EYEBROW_CLASS, "mb-2")}>Pago compartido</p>
          <div className="overflow-hidden rounded-xl border border-z-brass/20 bg-z-brass/8">
            <button
              type="button"
              onClick={() => setSharedExpanded((v) => !v)}
              aria-expanded={sharedExpanded}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-z-brass/12"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-z-brass/15 text-z-brass">
                <Receipt className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold tabular-nums text-z-brass">
                  {sharedPayment.debts.length}{" "}
                  {sharedPayment.debts.length === 1 ? "persona" : "personas"} · Te deben{" "}
                  {formatCurrency(sharedPayment.outstanding_total, sharedPayment.currency_code as CurrencyCode)}
                </span>
                <span className="block truncate text-[11px] tabular-nums text-muted-foreground">
                  Recuperado{" "}
                  {formatCurrency(sharedPayment.recovered, sharedPayment.currency_code as CurrencyCode)} ·
                  {" "}Gasto actual{" "}
                  {formatCurrency(
                    Math.max(0, sharedPayment.total - sharedPayment.recovered),
                    sharedPayment.currency_code as CurrencyCode,
                  )}
                </span>
              </span>
              <ChevronRight
                className={cn(
                  "size-4 shrink-0 text-z-brass/60 transition-transform",
                  sharedExpanded && "rotate-90",
                )}
              />
            </button>
            {sharedExpanded && (
              <div className="space-y-1 border-t border-z-brass/20 px-3 py-2.5">
                {sharedPayment.debts.map((d) => {
                  const settled = d.status !== "active";
                  return (
                    <div key={d.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 flex-1 truncate">{d.destinatario_name}</span>
                      <span
                        className={cn(
                          "shrink-0 tabular-nums",
                          settled ? "text-muted-foreground line-through" : "text-z-sage-light",
                        )}
                      >
                        {formatCurrency(
                          settled ? d.principal_amount : d.outstanding_amount,
                          d.currency_code as CurrencyCode,
                        )}
                      </span>
                    </div>
                  );
                })}
                <Link
                  href="/deudas-personales"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-z-brass hover:underline"
                >
                  Ver en Deudas personales
                  <ChevronRight className="size-3" />
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Ubicación ──────────────────────────────────────────────── */}
      {location && (
        <section className="px-4 pt-4">
          <p className={cn(SECTION_EYEBROW_CLASS, "mb-2")}>Ubicación</p>
          <div className="rounded-xl border border-white/6 bg-z-surface-2/60 p-3">
            <div className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-z-brass/15 text-z-brass">
                <MapPin className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {location.place_name ?? "Ubicación registrada"}
                </p>
                {(location.place_locality || location.place_country) && (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {[location.place_locality, location.place_country]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMapOpen((v) => !v)}
                className="shrink-0 text-[11px] font-semibold text-z-brass hover:underline"
              >
                {mapOpen ? "Ocultar mapa" : "Ver mapa"}
              </button>
            </div>
            {mapOpen && (
              <div className="mt-3 overflow-hidden rounded-lg border border-white/6">
                {/* OSM's default `embed.html` only serves the light Mapnik
                 *  layer, which sits awkwardly inside the dark UI. Use OSM's
                 *  built-in `?layer=cyclosm` is also light, so we go with the
                 *  `cyclemap` layer here — still light but slightly less
                 *  bright — and let the user tap through to a full-screen
                 *  map for fidelity. The sandbox attr stops the embedded
                 *  page from running its own scripts against our origin. */}
                <iframe
                  title="Mapa de la transacción"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.longitude - 0.005},${location.latitude - 0.003},${location.longitude + 0.005},${location.latitude + 0.003}&layer=mapnik&marker=${location.latitude},${location.longitude}`}
                  className="h-48 w-full border-0 [color-scheme:light]"
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin"
                  referrerPolicy="no-referrer"
                />
                <a
                  href={`https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=17/${location.latitude}/${location.longitude}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block border-t border-white/6 bg-white/[0.04] px-3 py-2 text-[11px] text-z-brass hover:underline"
                >
                  Abrir en OpenStreetMap →
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Notas ──────────────────────────────────────────────────── */}
      <section className="px-4 pt-4">
        <p className={cn(SECTION_EYEBROW_CLASS, "mb-2")}>Notas</p>
        {notesEditing ? (
          <textarea
            ref={notesTextareaRef}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setNotesDirty(true);
            }}
            onBlur={handleNotesBlur}
            placeholder="Agrega una nota…"
            rows={3}
            className="w-full rounded-xl border border-z-brass/20 bg-black/20 px-3 py-2 text-sm text-z-white placeholder:text-muted-foreground focus:border-z-brass/40 focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={handleNotesOpen}
            className={cn(
              "block w-full rounded-xl border border-white/6 bg-z-surface-2/60 px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/[0.04]",
              !notes && "italic text-muted-foreground",
            )}
          >
            {notes || "Toca para agregar una nota…"}
          </button>
        )}
        {notesSaving && (
          <p className="mt-1 text-[10px] text-muted-foreground">Guardando…</p>
        )}

        {(() => {
          const rawDesc = tx.raw_description;
          if (!rawDesc) return null;
          return (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setRawOpen((prev) => !prev)}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-z-sage-light"
              >
                {rawOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                Ver descripción original
              </button>
              {rawOpen && (
                <p className="mt-2 rounded-lg border border-white/6 bg-black/20 px-3 py-2 font-mono text-[11px] leading-relaxed text-z-sage-light break-all">
                  {rawDesc}
                </p>
              )}
            </div>
          );
        })()}
      </section>

      {/* ── Editar datos (monto · fecha · hora — staged critical edit) ── */}
      <Drawer open={editDataOpen} onOpenChange={setEditDataOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Editar datos</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="space-y-4 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                Monto ({tx.currency_code})
              </label>
              <CurrencyInput
                value={draftAmount}
                onChange={(e) => setDraftAmount(e.target.value)}
                inputMode="decimal"
                className="h-auto rounded-xl border-white/6 bg-white/[0.03] px-3 py-2.5 text-base font-semibold tabular-nums focus-visible:border-z-brass/40 focus-visible:ring-0"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                  Fecha
                </label>
                <DatePicker
                  value={draftDate}
                  onChange={(v) => setDraftDate(v ?? "")}
                  placeholder="Fecha"
                  className="w-full"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                  Hora
                </label>
                <TimePicker
                  value={draftTime}
                  onChange={(v) => setDraftTime(v ?? "")}
                  className="h-auto rounded-xl border-white/6 bg-white/[0.03] py-2.5"
                />
              </div>
            </div>
            <p className="rounded-lg border border-z-expense/25 bg-z-expense/5 px-3 py-2 text-[11px] text-z-expense">
              Cambiar el monto recalcula los saldos de la cuenta y las métricas.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditDataOpen(false)}
                disabled={savingData}
                className={cn(GHOST_BUTTON_CLASS, "flex-1 rounded-xl py-2.5")}
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={handleSaveData}
                disabled={savingData || !dataDirty}
                className={cn(BRASS_BUTTON_CLASS, "flex-1 rounded-xl py-2.5 disabled:opacity-50")}
              >
                {savingData ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* ── Link picker sheet ─────────────────────────────────────── */}
      {linking && (
        <LinkPickerSheet
          open={linking}
          onOpenChange={(open) => {
            if (!open) setLinking(false);
          }}
          title="Vincular a recurrente"
          subtitle={`${tx.merchant_name || tx.clean_description || ""} · ${formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}`}
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
          isPending={isLinkingPending}
        />
      )}

      {/* ── Replace-title confirm (locked title + differing destinatario) ── */}
      <Dialog
        open={!!pendingAssign}
        onOpenChange={(open) => {
          if (!open) setPendingAssign(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Actualizar el título?</DialogTitle>
            <DialogDescription>
              Reemplazar el título «{title}» por «{pendingAssign?.name}».
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              className={GHOST_BUTTON_CLASS}
              onClick={() => {
                if (pendingAssign) runAssign(pendingAssign.id, pendingAssign.name, false);
                setPendingAssign(null);
              }}
            >
              Mantener título
            </Button>
            <Button
              type="button"
              className={cn(BRASS_BUTTON_CLASS, "font-semibold")}
              onClick={() => {
                if (pendingAssign) runAssign(pendingAssign.id, pendingAssign.name, true);
                setPendingAssign(null);
              }}
            >
              Reemplazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ────────────────────────────────────────── */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar transacción</DialogTitle>
            <DialogDescription>
              ¿Estás seguro? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className={GHOST_BUTTON_CLASS}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={cn(DESTRUCTIVE_BUTTON_CLASS, "font-semibold")}
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

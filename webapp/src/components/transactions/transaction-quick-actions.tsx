"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Tag as TagIcon,
  Link2,
  Users,
  EyeOff,
  Eye,
  Pencil,
  Repeat,
  UserPlus,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { Chip } from "@/components/ui/chip";
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
  linkExistingTransactionToOccurrence,
  type CandidateOccurrence,
} from "@/actions/occurrences";
import { getPersonalDebts, linkTransactionToPersonalDebt } from "@/actions/personal-debts";
import type {
  TransactionWithAccount,
  CategoryWithChildren,
  CurrencyCode,
} from "@/types/domain";

export interface TransactionQuickActionsProps {
  transaction: TransactionWithAccount;
  categories: CategoryWithChildren[];
  tags?: Array<{ id: string; name: string; color: string | null; group_color: string | null }>;
  /** Account IDs with pending recurring occurrences — enables "Vincular a recurrente". */
  linkableAccountIds?: Set<string>;
  /** Called after a successful category assignment (e.g. categorizar inbox removes the row). */
  onCategorized?: (txId: string, categoryId: string) => void;
}

/**
 * Canonical expanded action surface for a transaction row, shared by Inicio
 * (recent activity), Movimientos, and the Categorizar inbox. Variante B:
 * a primary trio (Categoría · Destinatario · Más) using the Chip token, with
 * a compact meta-línea above it that surfaces already-assigned secondary state
 * (recurrente · etiquetas · excluida) without re-cramming the action row.
 * Everything secondary lives in the "Más" sheet.
 */
export function TransactionQuickActions({
  transaction: tx,
  categories,
  tags = [],
  linkableAccountIds,
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

  // Link-to-recurring + link-to-persona sheets (same flow as before).
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [occurrenceCandidates, setOccurrenceCandidates] = useState<CandidateOccurrence[]>([]);
  const [isLinking, startLinkTransition] = useTransition();
  const [personaPickerOpen, setPersonaPickerOpen] = useState(false);
  const [personaCandidates, setPersonaCandidates] = useState<LinkCandidate[]>([]);
  const [personaCreateOpen, setPersonaCreateOpen] = useState(false);

  const canLinkRecurring = linkableAccountIds?.has(tx.account_id) && !tx.recurrence_group_id;
  const canLinkPersona = !tx.personal_debt_id && !tx.transfer_group_id;

  const description =
    tx.merchant_name || tx.clean_description || tx.raw_description || "Sin descripción";
  const categoryName = localCategory?.name_es ?? localCategory?.name ?? null;

  const debtCounterparty =
    localDestinatario &&
    destinatarios.some((d) => d.id === localDestinatario.id && d.kind === "person")
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
        toast.success("Transacción vinculada a recurrente");
      } else {
        toast.error(result.error ?? "No se pudo vincular");
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
            sublabel: d.direction === "borrowed" ? "Le debes" : "Te debe",
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

  // ── Meta-línea: compact read-only/shortcut status of assigned secondary state ──
  const metaItems: React.ReactNode[] = [];
  if (tx.recurrence_group_id) {
    metaItems.push(
      <span key="rec" className="inline-flex items-center gap-1">
        <Repeat className="size-3" /> Recurrente
      </span>,
    );
  }
  if (tags.length > 0) {
    metaItems.push(
      <button
        key="tags"
        type="button"
        onClick={() => setMoreOpen(true)}
        className="inline-flex items-center gap-1 hover:text-z-brass"
      >
        <TagIcon className="size-3" /> {tags.length} etiqueta{tags.length === 1 ? "" : "s"}
      </button>,
    );
  }
  if (excluded) {
    metaItems.push(
      <span key="exc" className="inline-flex items-center gap-1 text-z-expense">
        <EyeOff className="size-3" /> Excluida
      </span>,
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Meta-línea */}
      {metaItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          {metaItems.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-2">
              {i > 0 && <span className="opacity-40">·</span>}
              {item}
            </span>
          ))}
        </div>
      )}

      {/* Primary trio — Categoría · Destinatario · Más */}
      <div className="flex flex-wrap items-center gap-1.5">
        <CategoryZonePicker
          categories={categories}
          value={localCategory?.id ?? null}
          onValueChange={handleCategorize}
          direction={tx.direction}
          placeholder="Categoría"
          variant="drawer"
          triggerClassName={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
            categoryName
              ? "border-z-brass/30 bg-z-brass/10 text-z-brass hover:bg-z-brass/15"
              : "border-white/6 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]",
          )}
        />
        <DestinatarioZonePicker
          value={localDestinatario?.id ?? null}
          onValueChange={handleDestinatarioChange}
          selectedName={localDestinatario?.name}
          variant="drawer"
          compact
          categories={categories}
          rawDescription={tx.raw_description}
          merchantName={tx.merchant_name}
          amount={tx.amount}
          currencyCode={tx.currency_code as CurrencyCode}
          triggerClassName={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium",
            localDestinatario
              ? "border-z-brass/30 bg-z-brass/10 text-z-brass hover:bg-z-brass/15"
              : "border-white/6 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]",
          )}
        />
        <Chip asChild>
          <button type="button" onClick={() => setMoreOpen(true)}>
            <MoreHorizontal /> Más
          </button>
        </Chip>
      </div>

      {/* "Más" sheet — secondary actions */}
      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Más acciones</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="px-1">
              <div className="mb-2 px-2">
                <TagZonePicker
                  entityType="transaction"
                  entityId={tx.id}
                  variant="drawer"
                  triggerClassName="w-full justify-start rounded-lg border border-white/6 bg-white/[0.03] px-3 py-2.5 text-sm"
                />
              </div>
              {canLinkRecurring && (
                <ActionRow icon={<Link2 className="size-4" />} label="Vincular a recurrente" onClick={handleOpenLinkPicker} disabled={isLinking} />
              )}
              {canLinkPersona && (
                <ActionRow icon={<Users className="size-4" />} label="Vincular a deuda personal" onClick={handleOpenPersonaPicker} disabled={isLinking} />
              )}
              <ActionRow
                icon={excluded ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                label={excluded ? "Incluir en métricas" : "Excluir de métricas"}
                onClick={handleToggleExclude}
              />
              <ActionRow
                asLink
                href={`/transactions/${tx.id}`}
                icon={<Pencil className="size-4" />}
                label="Ver / editar detalle"
              />
            </div>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

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

function ActionRow({
  icon,
  label,
  onClick,
  disabled,
  asLink,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  asLink?: boolean;
  href?: string;
}) {
  const className =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-white/5 disabled:opacity-50";
  if (asLink && href) {
    return (
      <Link href={href} className={className}>
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      <span className="text-muted-foreground">{icon}</span>
      {label}
    </button>
  );
}

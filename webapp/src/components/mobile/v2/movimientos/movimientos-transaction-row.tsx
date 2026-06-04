"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Pencil, ArrowDownLeft, ArrowUpRight, Link2, Repeat, Users, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import { TagChip } from "@/components/tags/tag-chip";
import { CategoryIcon } from "@/components/categories/category-icon";
import { LinkPickerSheet, type LinkCandidate } from "@/components/recurring/link-picker-sheet";
import { MOBILE_ACTION_BUTTON_CLASS } from "@/lib/constants/styles";
import { categorizeTransaction, assignDestinatario, removeDestinatarioFromTransaction } from "@/actions/categorize";
import {
  getCandidateOccurrencesForTransaction,
  linkExistingTransactionToOccurrence,
} from "@/actions/occurrences";
import type { CandidateOccurrence } from "@/actions/occurrences";
import { getPersonalDebts, linkTransactionToPersonalDebt } from "@/actions/personal-debts";
import { toast } from "sonner";
import type { TransactionWithAccount, CategoryWithChildren, CurrencyCode } from "@/types/domain";

const DestinatarioZonePicker = dynamic(
  () => import("@/components/destinatarios/destinatario-zone-picker").then(m => ({ default: m.DestinatarioZonePicker })),
  { ssr: false }
);
const TagZonePicker = dynamic(
  () => import("@/components/tags/tag-zone-picker").then(m => ({ default: m.TagZonePicker })),
  { ssr: false }
);
const CreatePersonalDebtSheet = dynamic(
  () => import("@/components/personas/create-personal-debt-sheet").then(m => ({ default: m.CreatePersonalDebtSheet })),
  { ssr: false }
);

interface MovimientosTransactionRowProps {
  transaction: TransactionWithAccount;
  categories: CategoryWithChildren[];
  tags?: Array<{ id: string; name: string; color: string | null; group_color: string | null }>;
  /** Account IDs that have pending recurring occurrences — enables "Vincular a recurrente" button */
  linkableAccountIds?: Set<string>;
  /** Called after a successful category assignment — used by categorizar to remove from list / prompt bulk apply */
  onCategorized?: (txId: string, categoryId: string) => void;
}

export function MovimientosTransactionRow({
  transaction: tx,
  categories,
  tags = [],
  linkableAccountIds,
  onCategorized,
}: MovimientosTransactionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  // Link to recurring state
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [occurrenceCandidates, setOccurrenceCandidates] = useState<CandidateOccurrence[]>([]);
  const [isLinking, startLinkTransition] = useTransition();

  // Link to deuda personal (personal debt) state — reuses isLinking/startLinkTransition
  const [personaPickerOpen, setPersonaPickerOpen] = useState(false);
  const [personaCandidates, setPersonaCandidates] = useState<LinkCandidate[]>([]);
  const [personaCreateOpen, setPersonaCreateOpen] = useState(false);

  const canLink = linkableAccountIds?.has(tx.account_id) && !tx.recurrence_group_id;
  const canLinkPersona = !tx.personal_debt_id && !tx.transfer_group_id;

  function handleOpenLinkPicker() {
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
    setPersonaPickerOpen(true);
    getPersonalDebts().then((result) => {
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
    }).catch((err) => {
      console.error("Failed to fetch personal debts:", err);
      toast.error("Error de red al buscar personas");
      setPersonaPickerOpen(false);
    });
  }

  function handleConfirmPersonaLink(debtId: string) {
    setPersonaPickerOpen(false);
    startLinkTransition(async () => {
      const result = await linkTransactionToPersonalDebt(debtId, tx.id);
      if (result.success) {
        toast.success("Transacción vinculada a deuda personal");
      } else {
        toast.error(result.error ?? "No se pudo vincular");
      }
    });
  }

  // Optimistic local state
  const [localCategory, setLocalCategory] = useState(tx.category);
  const [localDestinatario, setLocalDestinatario] = useState(tx.destinatario);

  const description =
    tx.merchant_name ||
    tx.clean_description ||
    tx.raw_description ||
    "Sin descripción";

  const categoryName = localCategory?.name_es ?? localCategory?.name ?? null;

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

  return (
    <div
      className={cn(
        "rounded-xl transition-colors",
        expanded && "border-l-2 border-z-brass pl-2"
      )}
    >
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          "flex w-full items-center gap-2 px-2 py-2.5 text-left transition-colors hover:bg-white/5",
          tx.is_excluded && "opacity-40"
        )}
      >
        <div className={cn(
          "flex size-[22px] shrink-0 items-center justify-center rounded-md",
          tx.direction === "INFLOW" ? "bg-z-income/12 text-z-income" : "bg-z-expense/12 text-z-expense"
        )}>
          {tx.direction === "INFLOW" ? <ArrowDownLeft className="size-3" /> : <ArrowUpRight className="size-3" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium flex items-center gap-1">
            {tx.recurrence_group_id && (
              <>
                <Repeat
                  className="size-3 shrink-0 text-z-brass/70"
                  aria-hidden="true"
                />
                <span className="sr-only">Vinculado a recurrente:</span>
              </>
            )}
            <span className="truncate">{description}</span>
          </p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: tx.account.color ?? undefined }}
            />
            <span className="truncate">{tx.account.name}</span>
            <span className="text-white/15">·</span>
            {categoryName ? (
              <span className="inline-flex items-center gap-0.5 truncate">
                {localCategory?.icon && <CategoryIcon icon={localCategory.icon} className="size-3 shrink-0" />}
                {categoryName}
              </span>
            ) : (
              <span className="text-z-brass">Sin cat.</span>
            )}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 text-sm font-medium tabular-nums",
            tx.direction === "INFLOW" && "text-z-income",
            tx.is_excluded && "line-through"
          )}
        >
          {tx.direction === "INFLOW" ? "+" : "-"}
          {formatCurrency(tx.amount, tx.currency_code)}
        </span>
      </button>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 pb-1.5 pl-[38px]">
          {tags.map((t) => (
            <TagChip
              key={t.id}
              tag={{ name: t.name, color: t.color }}
              groupColor={t.group_color}
              size="sm"
            />
          ))}
        </div>
      )}

      {/* Expanded: action chips */}
      {expanded && (
        <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2.5 pt-0.5">
          <CategoryZonePicker
            categories={categories}
            value={localCategory?.id ?? null}
            onValueChange={handleCategorize}
            direction={tx.direction}
            placeholder="Categoría"
            variant="drawer"
            triggerClassName={cn(
              "text-[10px] h-auto py-1 px-2.5 rounded-full border font-medium",
              categoryName
                ? "border-z-brass/20 bg-z-brass/8 text-z-brass hover:bg-z-brass/12"
                : "border-white/8 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]",
            )}
          />

          {/* Destinatario chip */}
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
              "rounded-full text-[10px] h-auto py-1 px-2.5 font-medium",
              localDestinatario
                ? "border-z-brass/20 bg-z-brass/8 text-z-brass hover:bg-z-brass/12"
                : "border-white/8 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]"
            )}
          />

          {/* Tag chip */}
          <TagZonePicker
            entityType="transaction"
            entityId={tx.id}
            variant="drawer"
            compact
            triggerClassName="rounded-full text-[10px] h-auto py-1 px-2.5"
          />

          <div className="flex-1" />

          {/* Link to recurring */}
          {canLink && (
            <button
              type="button"
              onClick={handleOpenLinkPicker}
              disabled={isLinking}
              className={cn(MOBILE_ACTION_BUTTON_CLASS, "inline-flex items-center gap-1 rounded-full hover:bg-z-brass/12")}
            >
              <Link2 className="size-2.5" />
              Vincular
            </button>
          )}

          {/* Link to persona (personal debt) */}
          {canLinkPersona && (
            <button
              type="button"
              onClick={handleOpenPersonaPicker}
              disabled={isLinking}
              className={cn(MOBILE_ACTION_BUTTON_CLASS, "inline-flex items-center gap-1 rounded-full hover:bg-z-brass/12")}
            >
              <Users className="size-2.5" />
              Vincular a deuda personal
            </button>
          )}

          {/* Edit link */}
          <Link
            href={`/transactions/${tx.id}`}
            className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-white/[0.06]"
          >
            <Pencil className="size-2.5" />
            Editar
          </Link>
        </div>
      )}

      {/* Link to recurring picker sheet */}
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

      {/* Link to deuda personal picker sheet */}
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

      {/* Create deuda personal + auto-link this transaction */}
      {personaCreateOpen && (
        <CreatePersonalDebtSheet
          open={personaCreateOpen}
          onOpenChange={setPersonaCreateOpen}
          currency={tx.currency_code as CurrencyCode}
          onCreated={handleConfirmPersonaLink}
        />
      )}
    </div>
  );
}

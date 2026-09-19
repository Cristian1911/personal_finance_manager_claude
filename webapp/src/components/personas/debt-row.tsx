"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ExternalLink, Pencil, Split, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import {
  BRASS_GHOST_BUTTON_CLASS,
  DESTRUCTIVE_GHOST_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  ROW_EXPAND_TRIGGER_CLASS,
} from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import {
  cancelPersonalDebt,
  deletePersonalDebt,
  reopenPersonalDebt,
} from "@/actions/personal-debts";
import { deleteSharedPayment } from "@/actions/shared-payments";
import { RecordRepaymentDialog } from "./record-repayment-dialog";
import { EditPersonalDebtSheet } from "./edit-personal-debt-sheet";
import type { PersonDebtItem } from "@/lib/personal-debts/hierarchy";
import type { CurrencyCode } from "@/types/domain";

/**
 * Loaded on demand: one row renders per debt and the split sheet drags the
 * whole DestinatarioZonePicker graph with it — nobody needs that until they
 * actually split something.
 */
const SplitPersonalDebtSheet = dynamic(() =>
  import("./split-personal-debt-sheet").then((m) => ({ default: m.SplitPersonalDebtSheet })),
);

interface DebtRowProps {
  item: PersonDebtItem;
  currency: CurrencyCode;
  /** Hide the note when it just repeats the group's title. */
  hideNote?: string | null;
  /** Default account for a repayment (where the trip's expenses were paid from). */
  defaultAccountId?: string | null;
  muted?: boolean;
}

function describeItem(item: PersonDebtItem, hideNote?: string | null): string {
  const o = item.origin;
  const fromTx = o?.merchant_name || o?.clean_description || o?.raw_description;
  if (fromTx) return fromTx;
  const note = item.notes?.trim();
  if (note && note.toLowerCase() !== hideNote?.trim().toLowerCase()) return note;
  return item.direction === "borrowed" ? "Préstamo recibido" : "Préstamo";
}

export function DebtRow({ item, currency, hideNote, defaultAccountId, muted }: DebtRowProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [repayOpen, setRepayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const code = (item.currency_code ?? currency) as CurrencyCode;
  const isBorrowed = item.direction === "borrowed";
  const isActive = item.status === "active";
  const isShared = !!item.split_group_id;
  const when = item.origin?.transaction_date ?? item.opened_on;
  const title = describeItem(item, hideNote);
  const repaid = Number(item.total_repaid ?? 0);
  const partiallyPaid = isActive && repaid > 0;
  const note = item.notes?.trim();
  const showNote =
    !!note && note.toLowerCase() !== hideNote?.trim().toLowerCase() && note !== title;
  // Splitting rewrites the debt into one row per person, so only before any
  // abono and only for what OTHERS owe you.
  const canSplit =
    isActive && !isBorrowed && !isShared && repaid === 0 && Number(item.principal_amount) > 0;

  function run(action: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    startTransition(async () => {
      const res = await action();
      if (res.success) {
        toast.success(ok);
        router.refresh();
      } else {
        toast.error(res.error ?? "Ocurrió un error");
      }
    });
  }

  return (
    <div className={cn(muted && "opacity-70")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(ROW_EXPAND_TRIGGER_CLASS, "px-3")}
      >
        <span className="w-12 shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {formatDate(when, "dd MMM")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 truncate text-sm">{title}</span>
            {item.is_overdue && (
              <Badge className="border-transparent bg-z-debt/15 text-z-debt">Vencida</Badge>
            )}
            {!isActive && (
              <Badge variant="secondary">{item.status === "settled" ? "Saldada" : "Cancelada"}</Badge>
            )}
          </span>
          {(isShared || partiallyPaid) && (
            <span className="block truncate text-[11px] text-muted-foreground">
              {isShared && item.split_total != null && (
                <>
                  Pago de {formatCurrency(item.split_total, code)}
                  {item.split_size > 1 ? ` · ${item.split_size} personas` : ""}
                </>
              )}
              {isShared && item.split_total != null && partiallyPaid ? " · " : ""}
              {partiallyPaid && <>abonó {formatCurrency(repaid, code)}</>}
            </span>
          )}
        </span>
        <span className="shrink-0 text-right">
          <span
            className={cn(
              "block text-sm font-semibold tabular-nums",
              !isActive
                ? "text-muted-foreground line-through"
                : isBorrowed
                  ? "text-z-debt"
                  : "text-z-sage-light",
            )}
          >
            {formatCurrency(isActive ? item.outstanding_amount : item.principal_amount, code)}
          </span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="space-y-3 px-3 pb-3 pt-1">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
            {isShared && item.split_total != null && (
              <Cell label="Pago total" value={formatCurrency(item.split_total, code)} />
            )}
            <Cell
              label={isShared ? "Su parte" : "Principal"}
              value={formatCurrency(item.principal_amount, code)}
            />
            <Cell label="Abonado" value={formatCurrency(repaid, code)} />
            <Cell label="Pendiente" value={formatCurrency(item.outstanding_amount, code)} />
            {item.installment_total != null && item.installment_total > 0 && (
              <Cell
                label="Cuotas"
                value={`${item.installment_total} · ${formatCurrency(item.principal_amount / item.installment_total, code)}/mes`}
              />
            )}
            {item.due_date && <Cell label="Vence" value={formatDate(item.due_date)} />}
            {!item.origin && <Cell label="Abierta" value={formatDate(item.opened_on)} />}
          </dl>
          {showNote && <p className="text-xs text-muted-foreground">{note}</p>}

          <div className="flex flex-wrap gap-2">
            {isActive ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(BRASS_GHOST_BUTTON_CLASS)}
                  disabled={pending}
                  onClick={() => setRepayOpen(true)}
                >
                  Registrar pago
                </Button>
                {canSplit && (
                  <Button size="sm" variant="ghost" className={cn(GHOST_BUTTON_CLASS)} disabled={pending} onClick={() => setSplitOpen(true)}>
                    <Split className="mr-1 size-3.5" />
                    Dividir
                  </Button>
                )}
                {!isShared && (
                  <Button size="sm" variant="ghost" className={cn(GHOST_BUTTON_CLASS)} disabled={pending} onClick={() => setEditOpen(true)}>
                    <Pencil className="mr-1 size-3.5" />
                    Editar
                  </Button>
                )}
                {!isShared && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className={cn(GHOST_BUTTON_CLASS)}
                    disabled={pending}
                    onClick={() => run(() => cancelPersonalDebt(item.id), "Deuda cancelada")}
                  >
                    Cancelar
                  </Button>
                )}
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className={cn(GHOST_BUTTON_CLASS)}
                disabled={pending}
                onClick={() => run(() => reopenPersonalDebt(item.id), "Deuda reabierta")}
              >
                Reabrir
              </Button>
            )}
            {item.origin && (
              <Button asChild size="sm" variant="ghost" className={cn(GHOST_BUTTON_CLASS)}>
                <Link href={`/transactions/${item.origin.id}`}>
                  <ExternalLink className="mr-1 size-3.5" />
                  Ver movimiento
                </Link>
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className={cn(DESTRUCTIVE_GHOST_BUTTON_CLASS, "ml-auto")}
              disabled={pending}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-1 size-3.5" />
              {isShared ? "Quitar reparto" : "Eliminar"}
            </Button>
          </div>
        </div>
      )}

      {/* Conditionally mounted so each open starts from the debt's current values. */}
      {splitOpen && (
        <SplitPersonalDebtSheet open={splitOpen} onOpenChange={setSplitOpen} debt={item} currency={currency} />
      )}
      {editOpen && (
        <EditPersonalDebtSheet open={editOpen} onOpenChange={setEditOpen} debt={item} currency={currency} />
      )}
      {repayOpen && (
        <RecordRepaymentDialog
          open={repayOpen}
          onOpenChange={setRepayOpen}
          personalDebtId={item.id}
          personName={item.destinatario_name}
          outstandingAmount={item.outstanding_amount}
          currency={code}
          defaultAccountId={item.origin?.account_id ?? defaultAccountId ?? null}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isShared ? "¿Quitar este reparto?" : "¿Eliminar esta deuda?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isShared
                ? `Se eliminará lo que ${item.split_size > 1 ? "cada persona" : item.destinatario_name} debe de este pago. El movimiento se conserva y deja de estar marcado como compartido. Los abonos ya registrados se conservan como movimientos. Esta acción no se puede deshacer.`
                : `Se eliminará la deuda con ${item.destinatario_name} de forma permanente. Las transacciones vinculadas se conservan, pero dejarán de estar asociadas a esta deuda. Esta acción no se puede deshacer.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="ghost"
              className={cn(DESTRUCTIVE_GHOST_BUTTON_CLASS)}
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    isShared
                      ? deleteSharedPayment(item.split_group_id!)
                      : deletePersonalDebt(item.id),
                  isShared ? "Reparto eliminado" : "Deuda eliminada",
                )
              }
            >
              {isShared ? "Quitar reparto" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate tabular-nums">{value}</dd>
    </div>
  );
}

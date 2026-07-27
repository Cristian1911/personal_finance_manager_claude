"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  GHOST_BUTTON_CLASS,
  DESTRUCTIVE_GHOST_BUTTON_CLASS,
} from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import {
  cancelPersonalDebt,
  deletePersonalDebt,
  reopenPersonalDebt,
} from "@/actions/personal-debts";
import { RecordRepaymentDialog } from "./record-repayment-dialog";
import { EditPersonalDebtSheet } from "./edit-personal-debt-sheet";
import type { PersonalDebtWithDetails, CurrencyCode } from "@/types/domain";

interface PersonaCardProps {
  persona: PersonalDebtWithDetails;
  currency: CurrencyCode;
}

export function PersonaCard({ persona, currency }: PersonaCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [repayOpen, setRepayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const code = (persona.currency_code ?? currency) as CurrencyCode;
  const initial = persona.destinatario_name?.trim().charAt(0).toUpperCase() || "?";
  const isBorrowed = persona.direction === "borrowed";
  const isActive = persona.status === "active";
  const progress =
    persona.principal_amount > 0
      ? Math.min(100, Math.round((persona.total_repaid / persona.principal_amount) * 100))
      : 0;

  function runAction(action: () => Promise<{ success: boolean; error?: string }>, okMsg: string) {
    startTransition(async () => {
      const res = await action();
      if (res.success) {
        toast.success(okMsg);
        router.refresh();
      } else {
        toast.error(res.error ?? "Ocurrió un error");
      }
    });
  }

  return (
    <div className="rounded-xl border border-white/6 bg-[#111]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-z-brass/15 text-sm font-semibold text-z-brass">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{persona.destinatario_name}</span>
            {persona.is_overdue && (
              <Badge className="border-transparent bg-z-debt/15 text-z-debt">Vencida</Badge>
            )}
            {!isActive && (
              <Badge variant="secondary">
                {persona.status === "settled" ? "Saldada" : "Cancelada"}
              </Badge>
            )}
          </div>
          {persona.due_date && isActive && (
            <p className="text-xs text-muted-foreground">vence {formatDate(persona.due_date)}</p>
          )}
        </div>
        <div className="text-right">
          <p
            className={cn(
              "text-sm font-semibold tabular-nums",
              isBorrowed ? "text-z-debt" : "text-z-sage-light",
            )}
          >
            {formatCurrency(persona.outstanding_amount, code)}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-white/6 px-4 py-3">
          {persona.total_repaid > 0 && <Progress value={progress} />}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <Row label="Principal" value={formatCurrency(persona.principal_amount, code)} />
            <Row label="Abonado" value={formatCurrency(persona.total_repaid, code)} />
            <Row label="Abierta" value={formatDate(persona.opened_on)} />
            {persona.due_date && <Row label="Vence" value={formatDate(persona.due_date)} />}
          </dl>
          {persona.notes && <p className="text-xs text-muted-foreground">{persona.notes}</p>}

          <div className="flex flex-wrap gap-2 pt-1">
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
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(GHOST_BUTTON_CLASS)}
                  disabled={pending}
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="mr-1 size-3.5" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(GHOST_BUTTON_CLASS)}
                  disabled={pending}
                  onClick={() => runAction(() => cancelPersonalDebt(persona.id), "Deuda cancelada")}
                >
                  Cancelar
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className={cn(GHOST_BUTTON_CLASS)}
                disabled={pending}
                onClick={() => runAction(() => reopenPersonalDebt(persona.id), "Deuda reabierta")}
              >
                Reabrir
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className={cn(DESTRUCTIVE_GHOST_BUTTON_CLASS)}
              disabled={pending}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-1 size-3.5" />
              Eliminar
            </Button>
          </div>
        </div>
      )}

      <EditPersonalDebtSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        debt={persona}
        currency={currency}
      />

      <RecordRepaymentDialog
        open={repayOpen}
        onOpenChange={setRepayOpen}
        personalDebtId={persona.id}
        personName={persona.destinatario_name}
        outstandingAmount={persona.outstanding_amount}
        currency={code}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta deuda?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la deuda con {persona.destinatario_name} de forma permanente.
              Las transacciones vinculadas se conservan, pero dejarán de estar asociadas a
              esta deuda. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="ghost"
              className={cn(DESTRUCTIVE_GHOST_BUTTON_CLASS)}
              disabled={pending}
              onClick={() => runAction(() => deletePersonalDebt(persona.id), "Deuda eliminada")}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </>
  );
}

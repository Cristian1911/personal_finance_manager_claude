"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { GHOST_BUTTON_CLASS, DESTRUCTIVE_GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { settlePersonalDebt, cancelPersonalDebt } from "@/actions/personal-debts";
import { RecordRepaymentDialog } from "./record-repayment-dialog";
import type { PersonalDebtWithDetails, CurrencyCode } from "@/types/domain";

interface PersonaCardProps {
  persona: PersonalDebtWithDetails;
  currency: CurrencyCode;
}

export function PersonaCard({ persona, currency }: PersonaCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [repayOpen, setRepayOpen] = useState(false);
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
    <div className="rounded-xl border border-white/6 bg-z-surface-2">
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
              <Badge className="border-transparent bg-z-danger/15 text-z-danger">Vencida</Badge>
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
              isBorrowed ? "text-z-danger" : "text-z-sage-light",
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

          {isActive && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                className={cn(GHOST_BUTTON_CLASS)}
                disabled={pending}
                onClick={() => setRepayOpen(true)}
              >
                Registrar abono
              </Button>
              <Button
                size="sm"
                className={cn(GHOST_BUTTON_CLASS)}
                disabled={pending}
                onClick={() => runAction(() => settlePersonalDebt(persona.id), "Cuenta saldada")}
              >
                Saldar
              </Button>
              <Button
                size="sm"
                className={cn(DESTRUCTIVE_GHOST_BUTTON_CLASS)}
                disabled={pending}
                onClick={() => runAction(() => cancelPersonalDebt(persona.id), "Cuenta cancelada")}
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>
      )}

      <RecordRepaymentDialog
        open={repayOpen}
        onOpenChange={setRepayOpen}
        personalDebtId={persona.id}
        personName={persona.destinatario_name}
      />
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

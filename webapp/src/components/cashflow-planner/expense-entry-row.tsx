"use client";

import { useState, useTransition } from "react";
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
import {
  ArrowRightLeft,
  Ban,
  Check,
  ChevronDown,
  Pencil,
  Trash2,
  Undo2,
} from "lucide-react";
import { deletePlanningEntry, toggleEntryStatus } from "@/actions/cashflow-planner";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import {
  BRASS_GHOST_BUTTON_CLASS,
  DESTRUCTIVE_GHOST_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
} from "@/lib/constants/styles";
import { getEnvelopeColor } from "@/lib/constants/envelope-colors";
import { CategoryIcon } from "@/components/categories/category-icon";
import { toast } from "sonner";
import type { CurrencyCode, PlanningEntryStatus } from "@/types/domain";
import type { PlanningEntryWithRelations } from "@/types/cashflow-planner";
import type { ExpenseCommitment } from "@/lib/utils/plan-commitments";

interface ExpenseEntryRowProps {
  entry: PlanningEntryWithRelations;
  currency: CurrencyCode;
  assignedAmount?: number;
  assignmentChips?: { colorIndex: number; amount: number; label: string }[];
  onAssign?: () => void;
  onEdit?: (entry: PlanningEntryWithRelations) => void;
  onPay?: () => void;
  /** Time-aware commitment classification for this expense (when pending). */
  commitment?: ExpenseCommitment;
  showAssignButton?: boolean;
}

// PLANNED has no badge: every row in the pending list is pending, so labeling
// each one "Pendiente" is noise that steals width from the expense name.
const STATUS_BADGE: Partial<
  Record<PlanningEntryStatus, { label: string; className: string }>
> = {
  COMPLETED: { label: "Pagado", className: "border-z-income/30 text-z-income" },
  SKIPPED: { label: "Omitido", className: "border-white/10 text-muted-foreground line-through" },
};

function commitTag(commitment: ExpenseCommitment | undefined) {
  if (!commitment) return null;
  if (commitment.cuentaAhora > 0)
    return { label: "cuenta ahora", className: "border-z-alert/30 text-z-alert" };
  if (commitment.cubierto > 0)
    return { label: "cubierto", className: "border-z-income/30 text-z-income" };
  if (commitment.sinAsignar > 0)
    return { label: "sin asignar", className: "border-white/10 text-muted-foreground" };
  return null;
}

const ACTION_BUTTON_CLASS = "h-8 gap-1.5 px-2.5 text-xs";

export function ExpenseEntryRow({
  entry,
  currency,
  assignedAmount = 0,
  assignmentChips,
  onAssign,
  onEdit,
  onPay,
  commitment,
  showAssignButton = true,
}: ExpenseEntryRowProps) {
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Assignments are in period currency, so remaining uses converted_amount
  const remaining = entry.converted_amount - assignedAmount;
  const isForeignCurrency = entry.currency_code !== currency;
  const tag = entry.status === "PLANNED" ? commitTag(commitment) : null;

  function setStatus(nextStatus: PlanningEntryStatus) {
    startTransition(async () => {
      const result = await toggleEntryStatus(entry.id, nextStatus);
      if (!result.success) toast.error(result.error);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePlanningEntry(entry.id);
      if (result.success) {
        toast.success("Gasto eliminado");
      } else {
        toast.error(result.error);
      }
    });
  }

  const badge = STATUS_BADGE[entry.status];
  const canAssign = showAssignButton && remaining > 0 && entry.status !== "SKIPPED" && !!onAssign;

  return (
    <div
      className={cn(
        "rounded-xl border border-white/6 bg-card/50",
        entry.status === "SKIPPED" && "opacity-50",
      )}
    >
      {/* Header — the whole row toggles the detail panel. Marking as paid is
          NOT here on purpose: paying goes through PayExpenseDialog so it always
          records/links a real transaction and asks for confirmation. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {entry.category && (
              <CategoryIcon
                icon={entry.category.icon}
                className="h-3.5 w-3.5 shrink-0 text-xs text-muted-foreground"
              />
            )}
            <span className="min-w-0 truncate text-sm font-medium">{entry.label}</span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5">
            {badge && (
              <Badge variant="outline" className={cn("shrink-0 px-1.5 text-[10px]", badge.className)}>
                {badge.label}
              </Badge>
            )}
            {tag && (
              <Badge variant="outline" className={cn("shrink-0 px-1.5 text-[10px]", tag.className)}>
                {tag.label}
              </Badge>
            )}
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              {formatDate(entry.expected_date, "d MMM")}
              {entry.account && ` · ${entry.account.name}`}
            </span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums">
            {formatCurrency(Number(entry.amount), entry.currency_code)}
          </p>
          {isForeignCurrency && (
            <p className="text-[10px] text-muted-foreground tabular-nums">
              ≈ {formatCurrency(entry.converted_amount, currency)}
            </p>
          )}
          {assignedAmount > 0 && remaining > 0 && (
            <p className="text-[10px] text-z-alert tabular-nums">
              Falta: {formatCurrency(remaining, currency)}
            </p>
          )}
        </div>

        <ChevronDown
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-white/6 px-3 pb-3 pt-2.5">
          {/* Full detail — nothing truncated here */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{entry.label}</p>
            <dl className="space-y-1 text-xs">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Fecha esperada</dt>
                <dd className="text-right">{formatDate(entry.expected_date, "d 'de' MMMM yyyy")}</dd>
              </div>
              {entry.account && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Cuenta</dt>
                  <dd className="text-right">{entry.account.name}</dd>
                </div>
              )}
              {entry.category && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Categoría</dt>
                  <dd className="text-right">{entry.category.name_es ?? entry.category.name}</dd>
                </div>
              )}
              {isForeignCurrency && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Equivalente</dt>
                  <dd className="text-right tabular-nums">
                    {formatCurrency(entry.converted_amount, currency)}
                  </dd>
                </div>
              )}
              {assignedAmount > 0 && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Asignado</dt>
                  <dd className="text-right tabular-nums">
                    {formatCurrency(assignedAmount, currency)}
                  </dd>
                </div>
              )}
              {assignedAmount > 0 && remaining > 0 && (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Falta por asignar</dt>
                  <dd className="text-right tabular-nums text-z-alert">
                    {formatCurrency(remaining, currency)}
                  </dd>
                </div>
              )}
            </dl>
            {assignmentChips && assignmentChips.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {assignmentChips.map((chip, i) => {
                  const c = getEnvelopeColor(chip.colorIndex);
                  return (
                    <span
                      key={i}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                        c.bg,
                        c.text,
                      )}
                    >
                      <span className="size-1.5 rounded-full" style={{ backgroundColor: c.hex }} />
                      {chip.label} · {formatCurrency(chip.amount, currency)}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions — explicit buttons; paying always confirms via dialog */}
          <div className="flex flex-wrap gap-2">
            {onPay && entry.status === "PLANNED" && (
              <Button
                variant="outline"
                size="sm"
                onClick={onPay}
                disabled={isPending}
                className={cn(ACTION_BUTTON_CLASS, BRASS_GHOST_BUTTON_CLASS)}
              >
                <Check className="h-3.5 w-3.5" />
                Pagar
              </Button>
            )}
            {canAssign && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAssign}
                disabled={isPending}
                className={cn(ACTION_BUTTON_CLASS, GHOST_BUTTON_CLASS)}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Asignar
              </Button>
            )}
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(entry)}
                disabled={isPending}
                className={cn(ACTION_BUTTON_CLASS, GHOST_BUTTON_CLASS)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Button>
            )}
            {entry.status === "PLANNED" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatus("SKIPPED")}
                disabled={isPending}
                className={cn(ACTION_BUTTON_CLASS, GHOST_BUTTON_CLASS)}
              >
                <Ban className="h-3.5 w-3.5" />
                Omitir
              </Button>
            )}
            {entry.status === "SKIPPED" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatus("PLANNED")}
                disabled={isPending}
                className={cn(ACTION_BUTTON_CLASS, GHOST_BUTTON_CLASS)}
              >
                <Undo2 className="h-3.5 w-3.5" />
                Reactivar
              </Button>
            )}
            {entry.status === "COMPLETED" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatus("PLANNED")}
                disabled={isPending}
                className={cn(ACTION_BUTTON_CLASS, GHOST_BUTTON_CLASS)}
              >
                <Undo2 className="h-3.5 w-3.5" />
                Volver a pendiente
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              disabled={isPending}
              className={cn(ACTION_BUTTON_CLASS, DESTRUCTIVE_GHOST_BUTTON_CLASS)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este gasto del plan?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{entry.label}» del plan del periodo. Las transacciones
              reales no se ven afectadas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="ghost"
              className={cn(DESTRUCTIVE_GHOST_BUTTON_CLASS)}
              disabled={isPending}
              onClick={handleDelete}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

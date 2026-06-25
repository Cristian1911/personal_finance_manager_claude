"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { deleteAssignment, deletePlanningEntry, toggleEntryStatus } from "@/actions/cashflow-planner";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getEnvelopeColor } from "@/lib/constants/envelope-colors";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { cn } from "@/lib/utils";
import type { CurrencyCode, PlanningEntryStatus } from "@/types/domain";
import type { IncomeEnvelope, PlanningEntryWithRelations } from "@/types/cashflow-planner";

interface IncomeEnvelopeCardProps {
  envelope: IncomeEnvelope;
  currency: CurrencyCode;
  colorIndex: number;
  onEdit?: (entry: PlanningEntryWithRelations) => void;
  /** When provided, income confirmation replaces the manual status toggle. */
  onConfirm?: (entry: PlanningEntryWithRelations) => void;
}

const STATE_CHIP: Record<string, { label: string; className: string }> = {
  confirmado: { label: "Confirmado", className: "border-z-income/30 text-z-income" },
  esperado: { label: "Esperado", className: "border-white/10 text-muted-foreground" },
  atrasado: { label: "Atrasado", className: "border-z-expense/30 text-z-expense" },
  omitido: { label: "Omitido", className: "border-white/10 text-muted-foreground" },
};

export function IncomeEnvelopeCard({ envelope, currency, colorIndex, onEdit, onConfirm }: IncomeEnvelopeCardProps) {
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const { entry, total_amount, assigned_amount, remaining_amount, assignments, state } = envelope;
  const percentUsed = total_amount > 0
    ? Math.round((assigned_amount / total_amount) * 100)
    : 0;
  const isForeignCurrency = entry.currency_code !== currency;
  const envelopeColor = getEnvelopeColor(colorIndex);

  // In the living timeline, income confirmation (onConfirm) replaces the manual
  // PLANNED↔COMPLETED check; the left border is tinted by lifecycle state.
  const chip = STATE_CHIP[state] ?? STATE_CHIP.esperado;
  const showConfirm = !!onConfirm && state !== "confirmado";
  const borderLeftColor =
    state === "confirmado"
      ? "var(--z-income)"
      : state === "atrasado"
        ? "var(--z-expense)"
        : envelopeColor.hex;

  function handleRemoveAssignment(assignmentId: string) {
    startTransition(async () => {
      await deleteAssignment(assignmentId);
    });
  }

  function handleToggleStatus() {
    const nextStatus: PlanningEntryStatus =
      entry.status === "PLANNED" ? "COMPLETED" : "PLANNED";
    startTransition(async () => {
      await toggleEntryStatus(entry.id, nextStatus);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePlanningEntry(entry.id);
      if (result.success) {
        toast.success("Ingreso eliminado");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-white/6 bg-card p-4 space-y-3 border-l-2" style={{ borderLeftColor }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {!showConfirm && (
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={isPending}
              className="shrink-0 rounded-md border border-white/10 p-1 transition-colors hover:border-white/20"
            >
              <Check
                className={`h-3.5 w-3.5 ${entry.status === "COMPLETED" ? "" : "text-muted-foreground"}`}
                style={entry.status === "COMPLETED" ? { color: envelopeColor.hex } : undefined}
              />
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-left min-w-0"
          >
            <p className="text-sm font-semibold truncate">{entry.label}</p>
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant="outline" className={cn("text-[10px] shrink-0", chip.className)}>
                {chip.label}
              </Badge>
              <p className="text-xs text-muted-foreground truncate min-w-0">
                {formatDate(entry.expected_date)}
                {entry.account && ` · ${entry.account.name}`}
              </p>
            </div>
          </button>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="text-right shrink-0">
            <p className={`text-sm sm:text-lg font-semibold tabular-nums ${envelopeColor.text}`}>
              {formatCurrency(Number(entry.amount), entry.currency_code)}
            </p>
            {isForeignCurrency && (
              <p className="text-[10px] text-muted-foreground tabular-nums">
                ≈ {formatCurrency(entry.converted_amount, currency)}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(entry)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Editar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-z-debt focus:text-z-debt"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Asignado: {formatCurrency(assigned_amount, currency)}</span>
          <span>Disponible: {formatCurrency(remaining_amount, currency)}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/6 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${percentUsed}%`, backgroundColor: envelopeColor.hex }} />
        </div>
      </div>

      {showConfirm && (
        <Button
          size="sm"
          className={cn("h-8 gap-1.5 text-xs", BRASS_BUTTON_CLASS)}
          disabled={isPending}
          onClick={() => onConfirm?.(entry)}
        >
          <Check className="h-3.5 w-3.5" />
          {state === "atrasado" ? "¿Llegó? Confirmar" : "Confirmar recibido"}
        </Button>
      )}

      {expanded && assignments.length > 0 && (
        <div className="space-y-1.5">
          <SectionEyebrow>Gastos asignados</SectionEyebrow>
          {assignments.map(({ assignment, expense_entry }) => (
            <div
              key={assignment.id}
              className="flex items-center justify-between gap-2 rounded-md border border-white/6 bg-background/50 px-3 py-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                {expense_entry.category && (
                  <span className="text-xs">{expense_entry.category.icon}</span>
                )}
                <span className="text-sm truncate">
                  {expense_entry.label}
                </span>
                <Badge variant="outline" className="text-[10px] shrink-0 hidden sm:inline-flex">
                  {formatDate(expense_entry.expected_date)}
                </Badge>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-medium tabular-nums">
                  {formatCurrency(Number(assignment.assigned_amount), currency)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-z-debt"
                  onClick={() => handleRemoveAssignment(assignment.id)}
                  disabled={isPending}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {assignments.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? "Ocultar asignaciones" : `Ver ${assignments.length} asignación${assignments.length !== 1 ? "es" : ""}`}
        </button>
      )}
    </div>
  );
}

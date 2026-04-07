"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, MoreHorizontal, Pencil, Trash2, Undo2 } from "lucide-react";
import { deletePlanningEntry, toggleEntryStatus } from "@/actions/cashflow-planner";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { toast } from "sonner";
import type { CurrencyCode, PlanningEntryStatus } from "@/types/domain";
import type { PlanningEntryWithRelations } from "@/types/cashflow-planner";

interface ExpenseEntryRowProps {
  entry: PlanningEntryWithRelations;
  currency: CurrencyCode;
  assignedAmount?: number;
  onAssign?: () => void;
  onEdit?: (entry: PlanningEntryWithRelations) => void;
  showAssignButton?: boolean;
}

const STATUS_BADGE: Record<
  PlanningEntryStatus,
  { label: string; className: string }
> = {
  PLANNED: { label: "Pendiente", className: "border-white/10 text-muted-foreground" },
  COMPLETED: { label: "Pagado", className: "border-z-income/30 text-z-income" },
  SKIPPED: { label: "Omitido", className: "border-white/10 text-muted-foreground line-through" },
};

export function ExpenseEntryRow({
  entry,
  currency,
  assignedAmount = 0,
  onAssign,
  onEdit,
  showAssignButton = true,
}: ExpenseEntryRowProps) {
  const [isPending, startTransition] = useTransition();
  // Assignments are in period currency, so remaining uses converted_amount
  const remaining = entry.converted_amount - assignedAmount;
  const isForeignCurrency = entry.currency_code !== currency;

  function cycleStatus() {
    const nextStatus: PlanningEntryStatus =
      entry.status === "PLANNED"
        ? "COMPLETED"
        : entry.status === "COMPLETED"
          ? "SKIPPED"
          : "PLANNED";

    startTransition(async () => {
      await toggleEntryStatus(entry.id, nextStatus);
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

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-white/6 bg-card/50 p-3 ${
        entry.status === "SKIPPED" ? "opacity-50" : ""
      }`}
    >
      <button
        type="button"
        onClick={cycleStatus}
        disabled={isPending}
        className="shrink-0 rounded-md border border-white/10 p-1.5 transition-colors hover:border-white/20"
        title="Cambiar estado"
      >
        {entry.status === "PLANNED" && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
        {entry.status === "COMPLETED" && <Check className="h-3.5 w-3.5 text-z-income" />}
        {entry.status === "SKIPPED" && <Undo2 className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {entry.category && (
            <span className="text-xs">{entry.category.icon}</span>
          )}
          <span className="text-sm font-medium truncate">{entry.label}</span>
          <Badge variant="outline" className={`text-[10px] ${badge.className}`}>
            {badge.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatDate(entry.expected_date)}</span>
          {entry.account && <span>· {entry.account.name}</span>}
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-semibold tabular-nums">
          {formatCurrency(Number(entry.amount), entry.currency_code)}
        </p>
        {isForeignCurrency && (
          <p className="text-[10px] text-muted-foreground tabular-nums">
            ≈ {formatCurrency(entry.converted_amount, currency)}
          </p>
        )}
        {assignedAmount > 0 && remaining > 0 && (
          <p className="text-[10px] text-amber-400 tabular-nums">
            Falta: {formatCurrency(remaining, currency)}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {showAssignButton && remaining > 0 && entry.status !== "SKIPPED" && onAssign && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onAssign}
            className="shrink-0 text-xs"
          >
            Asignar
          </Button>
        )}
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
              className="text-red-400 focus:text-red-400"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ExpenseRibbon, type RibbonSegment } from "./expense-ribbon";
import { RestoChip } from "./resto-chip";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { getEnvelopeColor } from "@/lib/constants/envelope-colors";
import type { CurrencyCode } from "@/types/domain";
import type { PlanningEntryWithRelations } from "@/types/cashflow-planner";
import type { AssignmentChip } from "@/lib/utils/cashflow-planner";

export interface ExpenseCardDraggableProps {
  entry: PlanningEntryWithRelations;
  currency: CurrencyCode;
  assignmentChips: AssignmentChip[];
  assignedAmount: number;
  onEdit?: (entry: PlanningEntryWithRelations) => void;
  onDelete?: (id: string) => void;
  onRestoClick?: (entry: PlanningEntryWithRelations) => void;
  /** Mobile long-press handler — triggered after 400ms pointer-hold. */
  onLongPress?: (entry: PlanningEntryWithRelations) => void;
}

export function ExpenseCardDraggable({
  entry,
  currency,
  assignmentChips,
  assignedAmount,
  onEdit,
  onDelete,
  onRestoClick,
  onLongPress,
}: ExpenseCardDraggableProps) {
  const remainder = Math.max(0, entry.converted_amount - assignedAmount);
  const isUnassigned = assignedAmount === 0;
  const isPartial = !isUnassigned && remainder > 0;
  const isForeignCurrency = entry.currency_code !== currency;

  const segments = useMemo<RibbonSegment[]>(() => {
    if (isUnassigned) return [{ colorIndex: -1, portion: 1 }];
    const total = entry.converted_amount || 1;
    const chipSegments: RibbonSegment[] = assignmentChips.map((c) => ({
      colorIndex: c.colorIndex,
      portion: c.amount / total,
    }));
    if (remainder > 0) {
      chipSegments.push({ colorIndex: -1, portion: remainder / total });
    }
    return chipSegments;
  }, [assignmentChips, remainder, entry.converted_amount, isUnassigned]);

  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `expense-${entry.id}`,
    data: { kind: "expense", entry, remainder },
  });

  function makeLongPressHandlers() {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    return {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType !== "touch") return;
        timer = setTimeout(() => {
          onLongPress?.(entry);
          clear();
        }, 400);
      },
      onPointerMove: clear,
      onPointerUp: clear,
      onPointerCancel: clear,
    };
  }

  const longPressHandlers = makeLongPressHandlers();

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className={cn(
        "relative flex items-center gap-3 rounded-lg border bg-card/60 p-3 pl-4 transition-all",
        isDragging && "opacity-55 scale-[0.98] shadow-lg",
        isUnassigned && "border-dashed border-z-expense/40 bg-z-expense/[0.04]",
        !isUnassigned && "border-white/6",
      )}
      data-expense-id={entry.id}
      aria-label={`Gasto ${entry.label}, ${isUnassigned ? "sin asignar" : isPartial ? "parcialmente asignado" : "asignado"}`}
    >
      <ExpenseRibbon segments={segments} />

      <button
        type="button"
        className="shrink-0 text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
        aria-label="Arrastrar para asignar"
        {...listeners}
        {...longPressHandlers}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {entry.category?.icon && (
        <span className="shrink-0 text-base" aria-hidden>
          {entry.category.icon}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{entry.label}</p>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{formatDate(entry.expected_date)}</span>
          {assignmentChips.length > 0 && <span>·</span>}
          {assignmentChips.map((chip, i) => {
            const c = getEnvelopeColor(chip.colorIndex);
            return (
              <span
                key={i}
                className="font-semibold"
                style={{ color: c.hex }}
              >
                {chip.label} {formatCurrency(chip.amount, currency)}
                {i < assignmentChips.length - 1 ? " +" : ""}
              </span>
            );
          })}
        </p>
        {remainder > 0 && !isUnassigned && (
          <div className="mt-1">
            <RestoChip
              remainder={remainder}
              currency={currency}
              compact
              onClick={() => onRestoClick?.(entry)}
            />
          </div>
        )}
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums">
          {formatCurrency(entry.converted_amount, currency)}
        </p>
        {isForeignCurrency && (
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {formatCurrency(Number(entry.amount), entry.currency_code)}
          </p>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            aria-label="Acciones"
          >
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
          {onDelete && (
            <DropdownMenuItem
              onClick={() => onDelete(entry.id)}
              className="text-red-400 focus:text-red-400"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Eliminar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

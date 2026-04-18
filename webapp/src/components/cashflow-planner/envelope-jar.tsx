"use client";

import { useMemo } from "react";
import { Check, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { getEnvelopeColor } from "@/lib/constants/envelope-colors";
import { cn } from "@/lib/utils";
import type { CurrencyCode, PlanningEntryStatus } from "@/types/domain";
import type { IncomeEnvelope, PlanningEntryWithRelations } from "@/types/cashflow-planner";

export interface EnvelopeJarProps {
  envelope: IncomeEnvelope;
  colorIndex: number;
  currency: CurrencyCode;
  /** True when a drag is hovering this jar. */
  isDropTarget?: boolean;
  /** Preview of what the drop would do — drives the fill animation + stripe. */
  preview?: { absorbs: number; jarWouldFill: boolean } | null;
  /** DnD plumbing: ref from useDroppable, tabIndex, etc. */
  dropRef?: (el: HTMLDivElement | null) => void;
  onToggleStatus?: (entry: PlanningEntryWithRelations, next: PlanningEntryStatus) => void;
  onEdit?: (entry: PlanningEntryWithRelations) => void;
  onDelete?: (id: string) => void;
}

export function EnvelopeJar({
  envelope,
  colorIndex,
  currency,
  isDropTarget,
  preview,
  dropRef,
  onToggleStatus,
  onEdit,
  onDelete,
}: EnvelopeJarProps) {
  const { entry, total_amount, assigned_amount, remaining_amount } = envelope;
  const color = getEnvelopeColor(colorIndex);

  const currentFill = total_amount > 0 ? assigned_amount / total_amount : 0;
  const previewFill = preview
    ? Math.min(1, (assigned_amount + preview.absorbs) / Math.max(1, total_amount))
    : currentFill;
  const effectiveFill = isDropTarget ? previewFill : currentFill;
  const fillTop = `${(1 - effectiveFill) * 100}%`;
  const pct = Math.round(effectiveFill * 100);

  const isFull = remaining_amount === 0;
  const status = entry.status;
  const nextStatus: PlanningEntryStatus = status === "PLANNED" ? "COMPLETED" : "PLANNED";

  const tone = useMemo(() => {
    if (isFull) return { label: "lleno", color: "text-z-income" };
    if (assigned_amount > 0) return { label: "parcial", color: "text-muted-foreground" };
    return { label: "libre", color: "text-muted-foreground" };
  }, [isFull, assigned_amount]);

  return (
    <div
      ref={dropRef}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-4 transition-all duration-200",
        "min-h-[140px] lg:min-h-[140px]",
        isDropTarget ? "shadow-[0_0_0_3px_color-mix(in_srgb,var(--jar-color)_22%,transparent)]" : "",
      )}
      style={
        {
          borderColor: isDropTarget ? color.hex : undefined,
          ["--jar-color" as never]: color.hex,
        } as React.CSSProperties
      }
      data-envelope-id={entry.id}
      role="group"
      aria-label={`Envelope ${entry.label}, ${pct}% asignado`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-all duration-300"
        style={{
          background: `linear-gradient(180deg, transparent 0%, transparent ${fillTop}, ${color.hex} 100%)`,
          opacity: isDropTarget ? 0.32 : 0.16,
        }}
      />
      {isDropTarget && preview?.jarWouldFill && !isFull && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 right-0 top-0 h-[6px]"
          style={{
            background:
              "repeating-linear-gradient(45deg, var(--z-expense) 0 4px, transparent 4px 8px)",
            opacity: 0.55,
          }}
        />
      )}

      <span
        className={cn(
          "absolute right-3 top-3 text-[10px] font-semibold tabular-nums",
          tone.color,
        )}
      >
        {pct}%
      </span>

      <button
        type="button"
        onClick={() => onToggleStatus?.(entry, nextStatus)}
        className="absolute left-3 top-3 rounded-md border border-white/10 p-1 transition-colors hover:border-white/20"
        aria-label={status === "COMPLETED" ? "Marcar como pendiente" : "Marcar como recibido"}
      >
        <Check
          className="h-3 w-3"
          style={
            status === "COMPLETED"
              ? { color: color.hex }
              : { color: "var(--z-muted-foreground, rgba(246,240,227,0.55))" }
          }
        />
      </button>

      <div className="absolute right-8 top-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              aria-label="Acciones del envelope"
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

      <div className="relative z-[1] mt-6 space-y-1">
        <p className="text-sm font-semibold truncate">{entry.label}</p>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {formatCurrency(total_amount, currency)} · {formatDate(entry.expected_date)}
        </p>
      </div>

      <div className="relative z-[1] mt-4">
        <p
          className="text-lg font-bold tabular-nums"
          style={{ color: isFull ? undefined : color.hex }}
        >
          {formatCurrency(remaining_amount, currency)}
        </p>
        <p className={cn("text-[10px]", tone.color)}>{isFull ? "envelope lleno" : "disponible"}</p>
      </div>
    </div>
  );
}

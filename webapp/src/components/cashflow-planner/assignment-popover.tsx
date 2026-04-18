"use client";

import { useEffect, useState, useTransition } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Slider } from "@/components/ui/slider";
import {
  createAssignment,
  updateAssignment,
  deleteAssignment,
} from "@/actions/cashflow-planner";
import { clampAssignmentAmount } from "@/lib/utils/envelope-assignment";
import { formatCurrency } from "@/lib/utils/currency";
import { getEnvelopeColor } from "@/lib/constants/envelope-colors";
import { toast } from "sonner";
import type { CurrencyCode } from "@/types/domain";

export type AssignmentPopoverMode =
  | { kind: "create"; incomeEntryId: string; expenseEntryId: string }
  | { kind: "update"; assignmentId: string };

interface AssignmentPopoverProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Anchor element for the popover. */
  anchor: React.ReactNode;
  envelopeLabel: string;
  envelopeColorIndex: number;
  /** Max this popover can assign = min(envelopeRemaining, expenseRemaining) after accounting for an existing row. */
  maxAmount: number;
  /** Initial amount — typically the clamped default. */
  initialAmount: number;
  currency: CurrencyCode;
  mode: AssignmentPopoverMode;
  /** When true, show "Quitar" button that deletes the assignment. */
  allowRemove?: boolean;
  assignmentIdToRemove?: string;
}

export function AssignmentPopover({
  open,
  onOpenChange,
  anchor,
  envelopeLabel,
  envelopeColorIndex,
  maxAmount,
  initialAmount,
  currency,
  mode,
  allowRemove,
  assignmentIdToRemove,
}: AssignmentPopoverProps) {
  const color = getEnvelopeColor(envelopeColorIndex);
  const [amount, setAmount] = useState(initialAmount);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) setAmount(initialAmount);
  }, [open, initialAmount]);

  const clamped = clampAssignmentAmount({
    envelopeRemaining: maxAmount,
    expenseRemaining: maxAmount,
    requested: amount,
  });

  function handleSave() {
    if (clamped <= 0) return;
    startTransition(async () => {
      const result =
        mode.kind === "create"
          ? await createAssignment(mode.incomeEntryId, mode.expenseEntryId, clamped)
          : await updateAssignment(mode.assignmentId, clamped);
      if (result.success) {
        toast.success("Asignación guardada");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRemove() {
    if (!assignmentIdToRemove) return;
    startTransition(async () => {
      const result = await deleteAssignment(assignmentIdToRemove);
      if (result.success) {
        toast.success("Asignación eliminada");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{anchor}</PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-3 space-y-3">
        <div className="flex items-baseline justify-between">
          <p
            className="font-mono text-[10px] font-bold uppercase tracking-widest"
            style={{ color: color.hex }}
          >
            {envelopeLabel}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Máx {formatCurrency(maxAmount, currency)}
          </p>
        </div>
        <p
          className="text-2xl font-bold tabular-nums"
          style={{ color: color.hex }}
        >
          {formatCurrency(clamped, currency)}
        </p>
        <Slider
          value={[clamped]}
          max={maxAmount}
          step={Math.max(1, Math.floor(maxAmount / 100))}
          onValueChange={(v) => setAmount(v[0] ?? 0)}
        />
        <CurrencyInput
          value={amount}
          onChange={(e) => {
            const raw = e.target.value;
            const n = raw === "" ? 0 : parseFloat(raw);
            setAmount(Number.isFinite(n) ? n : 0);
          }}
        />
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={clamped <= 0 || isPending}
            className="flex-1"
          >
            {mode.kind === "create" ? "Asignar" : "Guardar"}
          </Button>
          {allowRemove && (
            <Button
              variant="ghost"
              onClick={handleRemove}
              disabled={isPending}
              className="text-red-400 hover:text-red-400"
            >
              Quitar
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

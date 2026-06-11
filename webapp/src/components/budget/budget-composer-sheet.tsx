"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { BudgetGroupLines } from "./budget-group-lines";
import { applyBudgetComposition } from "@/actions/budgets";
import { computeCompositionDiff } from "@/lib/utils/budget-rollup";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { BRASS_BUTTON_CLASS, MOBILE_SHEET_SAFE_AREA_CLASS } from "@/lib/constants/styles";
import type { CategoryBudgetData, CurrencyCode } from "@/types/domain";

interface BudgetComposerSheetProps {
  group: CategoryBudgetData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: CurrencyCode;
  /** Called after a successful save — parent refreshes server data. */
  onSaved: () => void;
}

function groupDraft(group: CategoryBudgetData | null): Record<string, string> {
  if (!group) return {};
  const draft: Record<string, string> = {};
  if (group.baseBudget && group.baseBudget > 0) draft[group.id] = String(group.baseBudget);
  for (const [id, amount] of Object.entries(group.childBudgets)) draft[id] = String(amount);
  return draft;
}

export function BudgetComposerSheet({
  group,
  open,
  onOpenChange,
  currency,
  onSaved,
}: BudgetComposerSheetProps) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(groupDraft(group));
  }, [open, group]);

  const initial = useMemo(() => {
    const numbers: Record<string, number> = {};
    for (const [id, v] of Object.entries(groupDraft(group))) numbers[id] = parseFloat(v) || 0;
    return numbers;
  }, [group]);

  if (!group) return null;

  const total = Object.values(draft).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const diff = computeCompositionDiff(
    initial,
    Object.fromEntries(Object.entries(draft).map(([id, v]) => [id, parseFloat(v) || 0]))
  );
  const dirty = diff.upserts.length > 0 || diff.deletes.length > 0;

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const result = await applyBudgetComposition(diff);
      if (!result.success) {
        toast.error(result.error || "No se pudo guardar");
        return;
      }
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn("max-h-[85vh] overflow-y-auto", MOBILE_SHEET_SAFE_AREA_CLASS)}
      >
        <SheetHeader>
          <SheetTitle>
            {group.name_es ?? group.name} — {formatCurrency(total, currency)}/mes
          </SheetTitle>
          <SheetDescription>
            Gastaste {formatCurrency(group.spent, currency)} este mes · cada línea muestra su
            gasto real
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-2">
          <BudgetGroupLines
            group={group}
            currency={currency}
            draft={draft}
            onChange={(id, v) => setDraft((p) => ({ ...p, [id]: v }))}
            onAddLine={(id, prefill) => setDraft((p) => ({ ...p, [id]: prefill }))}
            showSpend
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className={cn(
              "h-10 w-full rounded-md text-sm font-semibold transition-colors disabled:opacity-50",
              BRASS_BUTTON_CLASS
            )}
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

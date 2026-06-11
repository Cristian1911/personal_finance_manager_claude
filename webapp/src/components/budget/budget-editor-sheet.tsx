"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { CurrencyInput } from "@/components/ui/currency-input";
import { CategoryIcon } from "@/components/categories/category-icon";
import { upsertBudget, deleteBudgetForCategory } from "@/actions/budgets";
import { updateCategoryExpenseType } from "@/actions/categories";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import {
  BRASS_BUTTON_CLASS,
  DESTRUCTIVE_GHOST_BUTTON_CLASS,
  MOBILE_SHEET_SAFE_AREA_CLASS,
  SEGMENTED_TAB_CLASS,
  SEGMENTED_TAB_ACTIVE_CLASS,
} from "@/lib/constants/styles";
import type { CategoryBudgetData, CurrencyCode, ExpenseType } from "@/types/domain";

interface BudgetEditorSheetProps {
  category: CategoryBudgetData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: CurrencyCode;
  /** Called after a successful save so the parent can update optimistically. */
  onSaved: (categoryId: string, amount: number, expenseType: ExpenseType | null) => void;
  /** Called after a successful delete. */
  onDeleted: (categoryId: string) => void;
}

export function BudgetEditorSheet({
  category,
  open,
  onOpenChange,
  currency,
  onSaved,
  onDeleted,
}: BudgetEditorSheetProps) {
  const [amount, setAmount] = useState("");
  const [expenseType, setExpenseType] = useState<ExpenseType | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && category) {
      // Edits the parent's OWN row ("Base") — `budget` is the combined group total.
      setAmount(category.baseBudget && category.baseBudget > 0 ? String(category.baseBudget) : "");
      setExpenseType(category.expense_type);
    }
  }, [open, category]);

  if (!category) return null;

  const hasBudget = category.baseBudget !== null && category.baseBudget > 0;
  const name = category.name_es ?? category.name;

  async function handleSave() {
    if (!category || busy) return;
    const value = parseFloat(amount);
    if (!value || value <= 0) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("category_id", category.id);
      formData.append("amount", amount);
      formData.append("period", "monthly");
      const [budgetResult] = await Promise.all([
        upsertBudget({ success: false, error: "" }, formData),
        updateCategoryExpenseType(category.id, expenseType),
      ]);
      if (!budgetResult.success) {
        toast.error(budgetResult.error || "No se pudo guardar el límite");
        return;
      }
      onSaved(category.id, value, expenseType);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!category || busy) return;
    setBusy(true);
    try {
      const result = await deleteBudgetForCategory(category.id);
      if (!result.success) {
        toast.error(result.error || "No se pudo eliminar el límite");
        return;
      }
      onDeleted(category.id);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={MOBILE_SHEET_SAFE_AREA_CLASS}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: `${category.color}20`, color: category.color }}
            >
              <CategoryIcon icon={category.icon} className="size-3.5" />
            </span>
            {name}
          </SheetTitle>
          <SheetDescription>
            Gastaste {formatCurrency(category.spent, currency)} este mes
            {category.average3m > 0 &&
              ` · promedio ${formatCurrency(Math.round(category.average3m), currency)}`}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-2">
          <div className="space-y-2">
            <label
              htmlFor="budget-editor-amount"
              className="text-xs font-medium text-muted-foreground"
            >
              Límite mensual
            </label>
            <div className="flex items-center gap-2">
              <CurrencyInput
                id="budget-editor-amount"
                className="flex-1"
                placeholder="Ej: 500.000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {category.average3m > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(Math.round(category.average3m)))}
                  className="h-9 shrink-0 rounded-md border border-white/6 bg-black/10 px-3 text-xs font-medium text-z-sage-light transition-colors active:bg-white/5"
                >
                  Usar promedio
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-1.5 rounded-full border border-white/6 bg-black/10 p-1">
            <button
              type="button"
              onClick={() => setExpenseType(expenseType === "fixed" ? null : "fixed")}
              className={expenseType === "fixed" ? SEGMENTED_TAB_ACTIVE_CLASS : SEGMENTED_TAB_CLASS}
            >
              Fijo
            </button>
            <button
              type="button"
              onClick={() => setExpenseType(expenseType === "variable" ? null : "variable")}
              className={
                expenseType === "variable" ? SEGMENTED_TAB_ACTIVE_CLASS : SEGMENTED_TAB_CLASS
              }
            >
              Variable
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {hasBudget && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors disabled:opacity-50",
                  DESTRUCTIVE_GHOST_BUTTON_CLASS
                )}
              >
                <Trash2 className="size-3.5" strokeWidth={1.5} />
                Eliminar límite
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || !amount || parseFloat(amount) <= 0}
              className={cn(
                "h-10 flex-1 rounded-md text-sm font-semibold transition-colors disabled:opacity-50",
                BRASS_BUTTON_CLASS
              )}
            >
              {busy ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

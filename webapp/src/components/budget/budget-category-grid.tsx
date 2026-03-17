"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { upsertBudget } from "@/actions/budgets";
import { updateCategoryExpenseType } from "@/actions/categories";
import { BudgetCategoryCard } from "./budget-category-card";
import type { CategoryBudgetData } from "@/types/domain";
import type { ExpenseType } from "@/types/domain";

interface BudgetCategoryGridProps {
  categories: CategoryBudgetData[];
}

export function BudgetCategoryGrid({ categories }: BudgetCategoryGridProps) {
  const [localCategories, setLocalCategories] = useState(categories);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [expenseType, setExpenseType] = useState<ExpenseType | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  function handleSetBudget(categoryId: string) {
    const cat = localCategories.find((c) => c.id === categoryId);
    setAmount(cat?.budget ? cat.budget.toString() : "");
    setExpenseType(cat?.expense_type ?? null);
    setSaveError(null);
    setEditingId(categoryId);
  }

  async function handleSave() {
    if (!editingId || !amount) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const formData = new FormData();
      formData.append("category_id", editingId);
      formData.append("amount", amount);
      formData.append("period", "monthly");

      // Optimistic update
      const budgetAmount = parseFloat(amount);
      setLocalCategories(prev => prev.map(c =>
        c.id === editingId ? { ...c, budget: budgetAmount, percentUsed: budgetAmount > 0 ? c.spent / budgetAmount * 100 : 0 } : c
      ));
      setEditingId(null);
      setAmount("");

      const [budgetResult] = await Promise.all([
        upsertBudget({ success: false, error: "" }, formData),
        updateCategoryExpenseType(editingId, expenseType),
      ]);
      if (!budgetResult.success) {
        setLocalCategories(categories);
        setSaveError(budgetResult.error ?? "Error al guardar");
      }
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setEditingId(null);
    setAmount("");
    setSaveError(null);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {localCategories.map((cat) => (
        <Popover
          key={cat.id}
          open={editingId === cat.id}
          onOpenChange={(open) => {
            if (!open) handleCancel();
          }}
        >
          <PopoverTrigger asChild>
            <div>
              <BudgetCategoryCard
                category={cat}
                onSetBudget={handleSetBudget}
              />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Presupuesto mensual
              </p>
              <CurrencyInput
                placeholder="Ej: 500.000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="flex gap-1">
                <Button
                  variant={expenseType === "fixed" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs"
                  type="button"
                  onClick={() => setExpenseType(expenseType === "fixed" ? null : "fixed")}
                >
                  Fijo
                </Button>
                <Button
                  variant={expenseType === "variable" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs"
                  type="button"
                  onClick={() => setExpenseType(expenseType === "variable" ? null : "variable")}
                >
                  Variable
                </Button>
              </div>
              {saveError && (
                <p className="text-xs text-destructive">{saveError}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving || !amount}
                >
                  {isSaving ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}

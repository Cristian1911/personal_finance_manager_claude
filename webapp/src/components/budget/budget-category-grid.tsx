"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { upsertBudget } from "@/actions/budgets";
import { BudgetCategoryCard } from "./budget-category-card";
import type { CategoryBudgetData } from "@/types/domain";

interface BudgetCategoryGridProps {
  categories: CategoryBudgetData[];
}

export function BudgetCategoryGrid({ categories }: BudgetCategoryGridProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function handleSetBudget(categoryId: string) {
    const cat = categories.find((c) => c.id === categoryId);
    setAmount(cat?.budget ? cat.budget.toString() : "");
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

      const result = await upsertBudget({ success: false, error: "" }, formData);
      if (result.success) {
        setEditingId(null);
        setAmount("");
        startTransition(() => {
          router.refresh();
        });
      } else {
        setSaveError(result.error ?? "Error al guardar");
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
      {categories.map((cat) => (
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
              {saveError && (
                <p className="text-xs text-destructive">{saveError}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving || isPending}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving || isPending || !amount}
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

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  function handleSetBudget(categoryId: string) {
    const cat = categories.find((c) => c.id === categoryId);
    setAmount(cat?.budget ? cat.budget.toString() : "");
    setEditingId(categoryId);
  }

  async function handleSave() {
    if (!editingId || !amount) return;
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
    }
  }

  function handleCancel() {
    setEditingId(null);
    setAmount("");
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
              <Input
                type="number"
                placeholder="Ej: 500000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={0}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isPending || !amount}
                >
                  Guardar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { Settings2 } from "lucide-react";
import { BudgetPerCategory } from "./budget-per-category";
import { BudgetZeroBased } from "./budget-zero-based";
import { CurrencyInput } from "@/components/ui/currency-input";
import { MonthSelector } from "@/components/month-selector";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { setBudgetMode, updateEstimatedIncome } from "@/actions/budget";
import type { CategoryBudgetData, CurrencyCode } from "@/types/domain";

interface BudgetPageClientProps {
  mode: "per_category" | "zero_based";
  categories: CategoryBudgetData[];
  income: number;
  currency: CurrencyCode;
  monthLabel: string;
}

export function BudgetPageClient({
  mode,
  categories,
  income,
  currency,
  monthLabel,
}: BudgetPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleModeSwitch() {
    const newMode = mode === "per_category" ? "zero_based" : "per_category";
    startTransition(async () => {
      await setBudgetMode(newMode);
      router.refresh();
    });
  }

  function handleIncomeUpdate(amount: number) {
    startTransition(async () => {
      await updateEstimatedIncome(amount);
      router.refresh();
    });
  }

  const modeLabel = mode === "per_category" ? "Por categoria" : "Base cero";
  const otherModeLabel =
    mode === "per_category" ? "Base cero" : "Por categoria";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Presupuesto
          </p>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
              Tu plan mensual
            </h1>
            <Badge variant="secondary" className="text-xs">
              {modeLabel}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {monthLabel} · ajusta limites y revisa el progreso de cada categoria
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Suspense>
            <MonthSelector />
          </Suspense>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={isPending}>
                <Settings2 className="size-4 mr-2" />
                Ajustes
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-3">
              <div>
                <p className="text-sm font-medium">Modo</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Actualmente: {modeLabel}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleModeSwitch}
                  disabled={isPending}
                >
                  Cambiar a {otherModeLabel}
                </Button>
              </div>
              <IncomeEditor
                currentIncome={income}
                currency={currency}
                onSave={handleIncomeUpdate}
                isPending={isPending}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Budget view based on mode */}
      {mode === "per_category" ? (
        <BudgetPerCategory
          categories={categories}
          income={income}
          currency={currency}
        />
      ) : (
        <BudgetZeroBased
          categories={categories}
          income={income}
          currency={currency}
        />
      )}
    </div>
  );
}

// Small income editor for the settings popover
function IncomeEditor({
  currentIncome,
  currency,
  onSave,
  isPending,
}: {
  currentIncome: number;
  currency: CurrencyCode;
  onSave: (amount: number) => void;
  isPending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(currentIncome));

  if (!editing) {
    return (
      <div>
        <p className="text-sm font-medium">Ingreso mensual</p>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {new Intl.NumberFormat("es-CO").format(currentIncome)}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Editar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Ingreso mensual</p>
      <CurrencyInput
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 text-sm"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={() => {
            const num = parseFloat(
              value.replace(/\./g, "").replace(",", ".")
            );
            if (!isNaN(num) && num > 0) onSave(num);
            setEditing(false);
          }}
          disabled={isPending}
        >
          Guardar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setValue(String(currentIncome));
            setEditing(false);
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}

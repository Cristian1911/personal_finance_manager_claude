"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { CurrencyInput } from "@/components/ui/currency-input";
import { CategoryIcon } from "@/components/categories/category-icon";
import { Button } from "@/components/ui/button";
import {
  setBudgetMode,
  updateEstimatedIncome,
  bulkUpsertBudgets,
} from "@/actions/budget";
import { Loader2, CheckCircle2, ListChecks, Target } from "lucide-react";
import type { CategoryBudgetData, CurrencyCode } from "@/types/domain";

// ── Types ───────────────────────────────────────────────────

type BudgetMode = "per_category" | "zero_based";

interface BudgetWizardProps {
  categories: CategoryBudgetData[];
  estimatedIncome: number;
  currency: CurrencyCode;
  onComplete?: () => void;
}

// ── Main Component ──────────────────────────────────────────

export function BudgetWizard({
  categories,
  estimatedIncome,
  currency,
  onComplete,
}: BudgetWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedMode, setSelectedMode] = useState<BudgetMode | null>(null);
  const [income, setIncome] = useState(estimatedIncome);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();

  const outflowParents = categories.filter((c) => c.direction === "OUTFLOW");

  // Pre-fill allocations with 50/30/20 when entering step 3
  function initAllocations() {
    const fixed = outflowParents.filter((c) => c.expense_type === "fixed");
    const variable = outflowParents.filter(
      (c) => c.expense_type === "variable" || c.expense_type === null
    );
    const savings = outflowParents.filter(
      (c) => c.slug === "ahorro-e-inversion"
    );

    // Remove savings from variable if they ended up there
    const variableMinusSavings = variable.filter(
      (c) => c.slug !== "ahorro-e-inversion"
    );

    const fixedTotal = income * 0.5;
    const variableTotal = income * 0.3;
    const savingsTotal = income * 0.2;

    const allocs: Record<string, number> = {};

    // Distribute proportionally within each group
    const distributeEvenly = (
      cats: CategoryBudgetData[],
      total: number
    ) => {
      if (cats.length === 0) return;
      const perCat = Math.round(total / cats.length);
      cats.forEach((c) => {
        allocs[c.id] = perCat;
      });
    };

    distributeEvenly(fixed, fixedTotal);
    distributeEvenly(variableMinusSavings, variableTotal);
    distributeEvenly(savings, savingsTotal);

    // Categories not in any group get 0
    outflowParents.forEach((c) => {
      if (!(c.id in allocs)) {
        allocs[c.id] = 0;
      }
    });

    setAllocations(allocs);
  }

  function handleGoToStep3() {
    initAllocations();
    setStep(3);
  }

  function handleFinalize() {
    startTransition(async () => {
      if (!selectedMode) return;

      const budgets = Object.entries(allocations)
        .filter(([, amount]) => amount > 0)
        .map(([category_id, amount]) => ({ category_id, amount }));

      await Promise.all([
        setBudgetMode(selectedMode),
        updateEstimatedIncome(income),
        bulkUpsertBudgets(budgets),
      ]);
      router.refresh();
      onComplete?.();
    });
  }

  const totalAllocated = Object.values(allocations).reduce(
    (sum, v) => sum + v,
    0
  );
  const remaining = income - totalAllocated;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              "size-2 rounded-full transition-colors",
              s === step
                ? "bg-z-brass"
                : s < step
                  ? "bg-z-brass/50"
                  : "bg-muted"
            )}
          />
        ))}
        <span className="ml-2 text-xs text-muted-foreground">
          Paso {step} de 3
        </span>
      </div>

      {/* Step 1: Choose mode */}
      {step === 1 && (
        <StepChooseMode
          selectedMode={selectedMode}
          onSelect={setSelectedMode}
          onContinue={() => setStep(2)}
        />
      )}

      {/* Step 2: Confirm income */}
      {step === 2 && (
        <StepConfirmIncome
          income={income}
          currency={currency}
          onIncomeChange={setIncome}
          onContinue={handleGoToStep3}
          onBack={() => setStep(1)}
        />
      )}

      {/* Step 3: Initial allocation */}
      {step === 3 && (
        <StepAllocation
          mode={selectedMode!}
          categories={outflowParents}
          allocations={allocations}
          income={income}
          totalAllocated={totalAllocated}
          remaining={remaining}
          currency={currency}
          isPending={isPending}
          onUpdateAllocation={(id, amount) =>
            setAllocations((prev) => ({ ...prev, [id]: amount }))
          }
          onFinalize={handleFinalize}
          onBack={() => setStep(2)}
        />
      )}
    </div>
  );
}

// ── Step 1: Choose Mode ─────────────────────────────────────

function StepChooseMode({
  selectedMode,
  onSelect,
  onContinue,
}: {
  selectedMode: BudgetMode | null;
  onSelect: (mode: BudgetMode) => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold">Elige tu estilo</h2>
        <p className="text-sm text-muted-foreground">
          No hay respuesta incorrecta. Puedes cambiarlo después.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ModeCard
          title="Por categoría"
          description="Pon límites a lo que más importa. Flexible, sin presión de cuadrar todo."
          badge="Recomendado para empezar"
          icon={<ListChecks className="size-5" />}
          selected={selectedMode === "per_category"}
          onSelect={() => onSelect("per_category")}
        />
        <ModeCard
          title="Base cero"
          description="Cada peso de tu ingreso tiene un trabajo asignado. Más control, más intención."
          badge="Estilo YNAB"
          icon={<Target className="size-5" />}
          selected={selectedMode === "zero_based"}
          onSelect={() => onSelect("zero_based")}
        />
      </div>

      <div className="flex justify-end">
        <Button
          onClick={onContinue}
          disabled={!selectedMode}
          className="bg-z-brass text-z-ink hover:bg-z-brass/90"
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}

function ModeCard({
  title,
  description,
  badge,
  icon,
  selected,
  onSelect,
}: {
  title: string;
  description: string;
  badge: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative rounded-2xl border border-white/6 bg-card p-6 text-left transition-all",
        "hover:border-z-brass/30",
        selected && "ring-2 ring-z-brass border-z-brass/40"
      )}
    >
      <div className="space-y-3">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-xl",
            selected
              ? "bg-z-brass/20 text-z-brass"
              : "bg-muted text-muted-foreground"
          )}
        >
          {icon}
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <span className="inline-block rounded-full bg-z-brass/10 px-2.5 py-0.5 text-xs font-medium text-z-brass">
          {badge}
        </span>
      </div>
      {selected && (
        <div className="absolute top-3 right-3 text-z-brass">
          <CheckCircle2 className="size-5" />
        </div>
      )}
    </button>
  );
}

// ── Step 2: Confirm Income ──────────────────────────────────

function StepConfirmIncome({
  income,
  currency,
  onIncomeChange,
  onContinue,
  onBack,
}: {
  income: number;
  currency: CurrencyCode;
  onIncomeChange: (v: number) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold">¿Cuánto entra al mes?</h2>
        <p className="text-sm text-muted-foreground">
          Usaremos este número para calcular tus márgenes y sugerencias.
        </p>
      </div>

      <div className="mx-auto max-w-xs space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Ingreso mensual ({currency})
        </label>
        <CurrencyInput
          value={income}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onIncomeChange(v);
          }}
          className="h-12 text-center text-lg font-semibold"
        />
        {income > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            {formatCurrency(income, currency)}
          </p>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Atrás
        </Button>
        <Button
          onClick={onContinue}
          disabled={income <= 0}
          className="bg-z-brass text-z-ink hover:bg-z-brass/90"
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}

// ── Step 3: Allocation ──────────────────────────────────────

function StepAllocation({
  mode,
  categories,
  allocations,
  income,
  totalAllocated,
  remaining,
  currency,
  isPending,
  onUpdateAllocation,
  onFinalize,
  onBack,
}: {
  mode: BudgetMode;
  categories: CategoryBudgetData[];
  allocations: Record<string, number>;
  income: number;
  totalAllocated: number;
  remaining: number;
  currency: CurrencyCode;
  isPending: boolean;
  onUpdateAllocation: (id: string, amount: number) => void;
  onFinalize: () => void;
  onBack: () => void;
}) {
  const remainingPct = income > 0 ? (remaining / income) * 100 : 0;

  const remainingColor =
    mode === "zero_based"
      ? remaining === 0
        ? "text-z-income"
        : remaining < 0
          ? "text-z-debt"
          : remainingPct <= 10
            ? "text-z-expense"
            : "text-z-income"
      : "text-muted-foreground";

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold">Asigna tu primer presupuesto</h2>
        <p className="text-sm text-muted-foreground">
          {mode === "per_category"
            ? "Asigna lo que quieras a cada categoría. No necesitas cuadrar todo."
            : "Asigna cada peso de tu ingreso. El objetivo es llegar a $0 disponible."}
        </p>
      </div>

      {/* Zero-based: sticky remaining bar */}
      {mode === "zero_based" && (
        <div
          className={cn(
            "sticky top-0 z-10 flex items-center justify-between rounded-xl border bg-card px-4 py-3",
            remaining === 0 && "border-z-income/30",
            remaining < 0 && "border-z-debt/30"
          )}
        >
          <span className="text-sm font-medium">Disponible para asignar</span>
          <div className="flex items-center gap-2">
            <span className={cn("text-lg font-bold", remainingColor)}>
              {formatCurrency(remaining, currency)}
            </span>
            {remaining === 0 && (
              <CheckCircle2 className="size-5 text-z-income" />
            )}
          </div>
        </div>
      )}

      {/* Category list */}
      <div className="space-y-2">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center gap-3 rounded-xl border border-white/6 bg-card px-4 py-3"
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg"
              style={{
                backgroundColor: `${cat.color}20`,
                color: cat.color,
              }}
            >
              <CategoryIcon icon={cat.icon} className="size-4" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {cat.name_es ?? cat.name}
              </p>
              {cat.expense_type && (
                <p className="text-xs text-muted-foreground">
                  {cat.expense_type === "fixed" ? "Fijo" : "Variable"}
                </p>
              )}
            </div>

            <div className="w-32 shrink-0">
              <CurrencyInput
                value={allocations[cat.id] ?? 0}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  onUpdateAllocation(cat.id, isNaN(v) ? 0 : v);
                }}
                className="h-9 text-right text-sm"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
        <span className="text-sm text-muted-foreground">Total asignado</span>
        <span className="text-sm font-semibold">
          {formatCurrency(totalAllocated, currency)}{" "}
          <span className="font-normal text-muted-foreground">
            de {formatCurrency(income, currency)}
          </span>
        </span>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isPending}>
          Atrás
        </Button>
        <Button
          onClick={onFinalize}
          disabled={isPending}
          className="bg-z-brass text-z-ink hover:bg-z-brass/90"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Guardando...
            </>
          ) : (
            "Finalizar"
          )}
        </Button>
      </div>
    </div>
  );
}

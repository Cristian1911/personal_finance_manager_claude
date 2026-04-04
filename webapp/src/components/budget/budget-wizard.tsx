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
import {
  Loader2,
  CheckCircle2,
  Feather,
  Gauge,
  AlertTriangle,
} from "lucide-react";
import type { AllocationData } from "@/actions/allocation";
import type { CategoryBudgetData, CurrencyCode } from "@/types/domain";

// ── Types ───────────────────────────────────────────────────

type BudgetMode = "per_category" | "zero_based";

interface BudgetWizardProps {
  categories: CategoryBudgetData[];
  estimatedIncome: number;
  currency: CurrencyCode;
  allocationData?: AllocationData | null;
  onComplete?: () => void;
}

// ── Main Component ──────────────────────────────────────────

export function BudgetWizard({
  categories,
  estimatedIncome,
  currency,
  allocationData,
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

    const variableMinusSavings = variable.filter(
      (c) => c.slug !== "ahorro-e-inversion"
    );

    const fixedTotal = income * 0.5;
    const variableTotal = income * 0.3;
    const savingsTotal = income * 0.2;

    const allocs: Record<string, number> = {};

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

      {/* Step 1: Income */}
      {step === 1 && (
        <StepIncome
          income={income}
          currency={currency}
          onIncomeChange={setIncome}
          onContinue={() => setStep(2)}
        />
      )}

      {/* Step 2: Style + Preview */}
      {step === 2 && (
        <StepStylePreview
          selectedMode={selectedMode}
          onSelect={setSelectedMode}
          income={income}
          currency={currency}
          allocationData={allocationData ?? null}
          onContinue={handleGoToStep3}
          onBack={() => setStep(1)}
        />
      )}

      {/* Step 3: Allocation */}
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

// ── Step 1: Income ──────────────────────────────────────────

function StepIncome({
  income,
  currency,
  onIncomeChange,
  onContinue,
}: {
  income: number;
  currency: CurrencyCode;
  onIncomeChange: (v: number) => void;
  onContinue: () => void;
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

      <div className="flex justify-end">
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

// ── Step 2: Style + Preview ─────────────────────────────────

function StepStylePreview({
  selectedMode,
  onSelect,
  income,
  currency,
  allocationData,
  onContinue,
  onBack,
}: {
  selectedMode: BudgetMode | null;
  onSelect: (mode: BudgetMode) => void;
  income: number;
  currency: CurrencyCode;
  allocationData: AllocationData | null;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold">
          ¿Qué tan estricto quieres ser?
        </h2>
        <p className="text-sm text-muted-foreground">
          No hay respuesta incorrecta. Puedes cambiarlo después.
        </p>
      </div>

      {/* Style cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StyleCard
          mode="per_category"
          title="Flexible"
          description="Pon límites a lo que más importa. Sin presión de cuadrar cada peso."
          badge="Recomendado para empezar"
          icon={<Feather className="size-5" />}
          selected={selectedMode === "per_category"}
          onSelect={() => onSelect("per_category")}
        />
        <StyleCard
          mode="zero_based"
          title="Estricto"
          description="Cada peso tiene un trabajo asignado. Más control, más intención."
          badge="Máximo control"
          icon={<Gauge className="size-5" />}
          selected={selectedMode === "zero_based"}
          onSelect={() => onSelect("zero_based")}
        />
      </div>

      {/* 50/30/20 Reference */}
      {income > 0 && (
        <ReferenceBreakdown
          income={income}
          currency={currency}
          allocationData={allocationData}
        />
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Atrás
        </Button>
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

// ── Style Card ──────────────────────────────────────────────

function StyleCard({
  mode,
  title,
  description,
  badge,
  icon,
  selected,
  onSelect,
}: {
  mode: BudgetMode;
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
        "relative rounded-2xl border border-white/6 bg-card p-5 text-left transition-all",
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

        {/* Mini preview of what the budget page looks like */}
        <StylePreview mode={mode} />

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

// ── Style Preview (mini mockup) ─────────────────────────────

function StylePreview({ mode }: { mode: BudgetMode }) {
  if (mode === "per_category") {
    // Flexible: simple bars with no remaining tracker
    return (
      <div className="space-y-1.5 rounded-lg border border-white/6 bg-z-surface-2 p-3">
        <div className="text-[10px] font-medium text-muted-foreground">
          Vista previa
        </div>
        {[
          { label: "Hogar", w: "65%", color: "bg-z-sage-dark/60" },
          { label: "Comida", w: "40%", color: "bg-z-sage-dark/60" },
          { label: "Transporte", w: "80%", color: "bg-z-expense/60" },
        ].map((item) => (
          <div key={item.label} className="space-y-0.5">
            <div className="flex items-center justify-between text-[9px] text-muted-foreground">
              <span>{item.label}</span>
              <span>{item.w}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/50">
              <div
                className={cn("h-full rounded-full", item.color)}
                style={{ width: item.w }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Strict: bars plus a "remaining" tracker
  return (
    <div className="space-y-1.5 rounded-lg border border-white/6 bg-z-surface-2 p-3">
      <div className="text-[10px] font-medium text-muted-foreground">
        Vista previa
      </div>
      <div className="flex items-center justify-between rounded bg-z-income/10 px-1.5 py-0.5 text-[9px] font-medium text-z-income">
        <span>Disponible</span>
        <span>$120k</span>
      </div>
      {[
        { label: "Hogar", w: "55%", color: "bg-z-sage-dark/60" },
        { label: "Comida", w: "35%", color: "bg-z-sage-dark/60" },
      ].map((item) => (
        <div key={item.label} className="space-y-0.5">
          <div className="flex items-center justify-between text-[9px] text-muted-foreground">
            <span>{item.label}</span>
            <span>{item.w}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/50">
            <div
              className={cn("h-full rounded-full", item.color)}
              style={{ width: item.w }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 50/30/20 Reference Breakdown ────────────────────────────

function ReferenceBreakdown({
  income,
  currency,
  allocationData,
}: {
  income: number;
  currency: CurrencyCode;
  allocationData: AllocationData | null;
}) {
  const segments: {
    label: string;
    targetPct: number;
    targetAmount: number;
    actualPct: number | null;
    color: string;
  }[] = [
    {
      label: "Necesidades",
      targetPct: 50,
      targetAmount: income * 0.5,
      actualPct: allocationData?.needs.percent ?? null,
      color: "bg-z-sage-dark",
    },
    {
      label: "Deseos",
      targetPct: 30,
      targetAmount: income * 0.3,
      actualPct: allocationData?.wants.percent ?? null,
      color: "bg-z-brass",
    },
    {
      label: "Ahorro",
      targetPct: 20,
      targetAmount: income * 0.2,
      actualPct: allocationData?.savings.percent ?? null,
      color: "bg-z-income",
    },
  ];

  return (
    <div className="space-y-3 rounded-2xl border border-white/6 bg-card p-4">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold">Referencia 50/30/20</h4>
        <p className="text-xs text-muted-foreground">
          Distribución ideal para tu ingreso de{" "}
          {formatCurrency(income, currency)}
        </p>
      </div>

      <div className="space-y-3">
        {segments.map((seg) => {
          const barWidth = Math.min(seg.targetPct, 100);
          const actualWidth =
            seg.actualPct !== null ? Math.min(Math.max(seg.actualPct, 0), 100) : null;

          return (
            <div key={seg.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{seg.label}</span>
                <span className="text-muted-foreground">
                  {seg.targetPct}% ={" "}
                  {formatCurrency(seg.targetAmount, currency)}
                </span>
              </div>

              {/* Target bar */}
              <div className="relative h-2 rounded-full bg-muted/50">
                <div
                  className={cn("h-full rounded-full opacity-40", seg.color)}
                  style={{ width: `${barWidth}%` }}
                />
                {/* Actual overlay */}
                {actualWidth !== null && (
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full",
                      seg.color
                    )}
                    style={{ width: `${actualWidth}%` }}
                  />
                )}
              </div>

              {/* Actual vs target label */}
              {seg.actualPct !== null && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span>
                    Tu gasto actual: {Math.round(seg.actualPct)}%
                  </span>
                  {seg.actualPct > seg.targetPct && (
                    <span className="text-z-expense">
                      (+{Math.round(seg.actualPct - seg.targetPct)}%)
                    </span>
                  )}
                  {seg.actualPct <= seg.targetPct && (
                    <span className="text-z-income">
                      ({Math.round(seg.actualPct - seg.targetPct)}%)
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Untagged categories warning */}
      {allocationData && allocationData.untaggedCategories > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-z-expense/10 px-3 py-2">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-z-expense" />
          <p className="text-[11px] text-z-expense">
            {allocationData.untaggedCategories} categoría
            {allocationData.untaggedCategories > 1 ? "s" : ""} sin tipo
            asignado (fijo/variable). Asígnalas para mejorar la distribución.
          </p>
        </div>
      )}
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
            "sticky top-0 z-10 flex items-center justify-between rounded-xl border border-white/6 bg-card px-4 py-3",
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

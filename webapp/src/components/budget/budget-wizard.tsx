"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateEstimatedIncome } from "@/actions/budget";
import {
  CheckCircle2,
  Feather,
  Gauge,
  PieChart,
} from "lucide-react";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import type { BudgetMode, CurrencyCode } from "@/types/domain";

interface BudgetWizardProps {
  estimatedIncome: number;
  currency: CurrencyCode;
}

// ── Main Component ──────────────────────────────────────────

export function BudgetWizard({
  estimatedIncome,
  currency,
}: BudgetWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedMode, setSelectedMode] = useState<BudgetMode | null>(null);
  const [income, setIncome] = useState(estimatedIncome);
  const [, startTransition] = useTransition();

  function handleStartBuilding() {
    if (!selectedMode) return;
    startTransition(async () => {
      // Persist income now; budget_mode is set only when the builder saves a
      // real budget (avoids the "mode set, zero budgets" limbo). The chosen
      // mode travels to the builder via the query string.
      const result = await updateEstimatedIncome(income);
      if (!result.success) {
        toast.error(result.error || "No se pudo guardar el ingreso");
        return;
      }
      router.push(`/presupuesto/armar?mode=${selectedMode}`);
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2].map((s) => (
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
          Paso {step} de 2
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
          onContinue={handleStartBuilding}
          onBack={() => setStep(1)}
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
          className={BRASS_BUTTON_CLASS}
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
  onContinue,
  onBack,
}: {
  selectedMode: BudgetMode | null;
  onSelect: (mode: BudgetMode) => void;
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

      {/* Style options — horizontal swipe on mobile, grid on desktop */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0">
        <StyleCard
          mode="per_category"
          title="Flexible"
          description="Pon límites a lo que más importa. Sin presión de cuadrar cada peso."
          badge="Recomendado para empezar"
          icon={<Feather className="size-5" />}
          selected={selectedMode === "per_category"}
          onSelect={() => onSelect("per_category")}
          className="min-w-[82%] snap-center sm:min-w-0"
        />
        <StyleCard
          mode="zero_based"
          title="Estricto"
          description="Cada peso tiene un trabajo asignado. Más control, más intención."
          badge="Máximo control"
          icon={<Gauge className="size-5" />}
          selected={selectedMode === "zero_based"}
          onSelect={() => onSelect("zero_based")}
          className="min-w-[82%] snap-center sm:min-w-0"
        />
        <StyleCard
          mode="50_30_20"
          title="50/30/20"
          description="Reparte por sets: 50% necesidades, 30% deseos, 20% ahorro y deuda."
          badge="Equilibrio simple"
          icon={<PieChart className="size-5" />}
          selected={selectedMode === "50_30_20"}
          onSelect={() => onSelect("50_30_20")}
          className="min-w-[82%] snap-center sm:min-w-0"
        />
      </div>

      <div className="flex justify-between">
        <Button type="button" onClick={onBack} className={GHOST_BUTTON_CLASS}>
          Atrás
        </Button>
        <Button
          onClick={onContinue}
          disabled={!selectedMode}
          className={BRASS_BUTTON_CLASS}
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
  className,
}: {
  mode: BudgetMode;
  title: string;
  description: string;
  badge: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative rounded-2xl border border-white/6 bg-card p-5 text-left transition-all",
        "hover:border-z-brass/30",
        selected && "ring-2 ring-z-brass border-z-brass/40",
        className
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
            <div className="h-2 rounded-full bg-muted/50">
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

  if (mode === "50_30_20") {
    // 50/30/20: the three sets at their target weights
    return (
      <div className="space-y-1.5 rounded-lg border border-white/6 bg-z-surface-2 p-3">
        <div className="text-[10px] font-medium text-muted-foreground">
          Vista previa
        </div>
        {[
          { label: "Necesidades", w: "50%", color: "bg-z-sage-dark/60" },
          { label: "Deseos", w: "30%", color: "bg-z-sage-dark/60" },
          { label: "Ahorro", w: "20%", color: "bg-z-income/60" },
        ].map((item) => (
          <div key={item.label} className="space-y-0.5">
            <div className="flex items-center justify-between text-[9px] text-muted-foreground">
              <span>{item.label}</span>
              <span>{item.w}</span>
            </div>
            <div className="h-2 rounded-full bg-muted/50">
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
          <div className="h-2 rounded-full bg-muted/50">
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

// ponytail: the 50/30/20 reference breakdown was dropped from Step 2 — the
// 50/30/20 style card preview + the builder's per-set caps cover it without
// adding vertical scroll to the style picker.

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { CurrencyInput } from "@/components/ui/currency-input";
import { setBudgetMode, updateEstimatedIncome } from "@/actions/budget";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import {
  BRASS_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  MOBILE_SHEET_SAFE_AREA_CLASS,
  SECTION_EYEBROW_CLASS,
} from "@/lib/constants/styles";
import type { BudgetMode, CurrencyCode } from "@/types/domain";
import type { IncomeEstimate } from "@/actions/income";

interface BudgetAjustesSheetProps {
  mode: BudgetMode | null;
  income: number;
  incomeSource: IncomeEstimate["source"] | null;
  currency: CurrencyCode;
  /** "icon" renders a round header icon button; "button" a labeled ghost button. */
  variant: "icon" | "button";
}

const MODES: { value: BudgetMode; label: string; detail: string }[] = [
  { value: "per_category", label: "Flexible", detail: "Cada categoría con su límite" },
  { value: "zero_based", label: "Estricto", detail: "Cada peso tiene destino" },
  { value: "50_30_20", label: "50/30/20", detail: "Por sets: necesidades, deseos, ahorro" },
];

export function BudgetAjustesSheet({
  mode,
  income,
  incomeSource,
  currency,
  variant,
}: BudgetAjustesSheetProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<BudgetMode | null>(mode);
  const [incomeValue, setIncomeValue] = useState(income > 0 ? String(Math.round(income)) : "");
  const [busy, setBusy] = useState(false);

  async function handleModeChange(next: BudgetMode) {
    if (busy || next === selectedMode) return;
    const previous = selectedMode;
    setSelectedMode(next);
    const result = await setBudgetMode(next);
    if (!result.success) {
      setSelectedMode(previous);
      toast.error(result.error || "No se pudo cambiar el modo");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function handleIncomeSave() {
    const value = parseFloat(incomeValue);
    if (busy || !value || value <= 0) return;
    setBusy(true);
    try {
      const result = await updateEstimatedIncome(value);
      if (!result.success) {
        toast.error(result.error || "No se pudo guardar el ingreso");
        return;
      }
      toast.success("Ingreso actualizado");
      setOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ajustes del presupuesto"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-z-sage-light transition-colors hover:bg-white/5"
        >
          <Settings2 className="size-4" strokeWidth={1.5} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors",
            GHOST_BUTTON_CLASS
          )}
        >
          <Settings2 className="size-3.5" strokeWidth={1.5} />
          Ajustes
        </button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className={MOBILE_SHEET_SAFE_AREA_CLASS}>
          <SheetHeader>
            <SheetTitle>Ajustes del presupuesto</SheetTitle>
            <SheetDescription>Modo de control e ingreso base del mes.</SheetDescription>
          </SheetHeader>

          <div className="space-y-5 px-4 pb-2">
            <div className="space-y-2">
              <p className={SECTION_EYEBROW_CLASS}>Modo</p>
              <div className="grid grid-cols-2 gap-2">
                {MODES.map((m) => {
                  const active = selectedMode === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => handleModeChange(m.value)}
                      aria-pressed={active}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        active
                          ? "border-z-brass/30 bg-z-brass/10"
                          : "border-white/6 bg-black/10 active:bg-white/5"
                      )}
                    >
                      <span
                        className={cn(
                          "block text-[13px] font-semibold",
                          active ? "text-z-brass" : "text-foreground"
                        )}
                      >
                        {m.label}
                      </span>
                      <span className="block text-[10px] text-z-sage-dark">{m.detail}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className={SECTION_EYEBROW_CLASS}>Ingreso mensual estimado</p>
              <div className="flex items-center gap-2">
                <CurrencyInput
                  className="flex-1"
                  placeholder={income > 0 ? formatCurrency(Math.round(income), currency) : "Ej: 3.500.000"}
                  value={incomeValue}
                  onChange={(e) => setIncomeValue(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleIncomeSave}
                  disabled={busy || !incomeValue || parseFloat(incomeValue) <= 0}
                  className={cn(
                    "h-9 shrink-0 rounded-md px-4 text-xs font-semibold transition-colors disabled:opacity-50",
                    BRASS_BUTTON_CLASS
                  )}
                >
                  {busy ? "Guardando..." : "Guardar"}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {incomeSource && incomeSource !== "profile"
                  ? "Hoy se calcula de tus movimientos. Al guardar quedará fijo."
                  : "Base del presupuesto y del simulador de cambios."}
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

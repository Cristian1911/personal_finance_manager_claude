"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { upsertBudget } from "@/actions/budgets";
import { formatCurrency } from "@/lib/utils/currency";
import type { CategoryBudgetData } from "@/types/domain";

interface Props {
  categories: CategoryBudgetData[];
}

export function MonthPlanner({ categories }: Props) {
  const [open, setOpen] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function handleOpen() {
    const initial: Record<string, string> = {};
    for (const cat of categories) {
      if (cat.budget && cat.budget > 0) {
        initial[cat.id] = cat.budget.toString();
      }
    }
    setAmounts(initial);
    setOpen(true);
  }

  function useAverage(catId: string, average3m: number) {
    setAmounts((prev) => ({ ...prev, [catId]: Math.round(average3m).toString() }));
  }

  async function handleSaveAll() {
    setSaving(true);
    try {
      const entries = Object.entries(amounts).filter(([, v]) => v && parseFloat(v) > 0);
      const results = await Promise.all(
        entries.map(([catId, amt]) => {
          const fd = new FormData();
          fd.append("category_id", catId);
          fd.append("amount", amt);
          fd.append("period", "monthly");
          return upsertBudget({ success: false, error: "" }, fd);
        })
      );
      setOpen(false);
      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        toast.error(`${failures.length} presupuestos no se guardaron`);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={handleOpen} className="gap-1.5">
        <CalendarCheck className="h-4 w-4" />
        Planificar mes
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarCheck className="h-4 w-4" />
          Planificar presupuesto del mes
        </CardTitle>
        <CardDescription>
          Revisa el gasto real del mes pasado y ajusta tus metas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {categories
          .filter((c) => c.direction === "OUTFLOW")
          .map((cat) => (
            <div key={cat.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {cat.name_es ?? cat.name}
                  </span>
                  {cat.expense_type && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                      {cat.expense_type === "fixed" ? "Fijo" : "Var"}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Gastaste {formatCurrency(cat.spent)} · Promedio: {formatCurrency(cat.average3m)}
                </p>
              </div>
              <CurrencyInput
                className="w-32"
                value={amounts[cat.id] ?? ""}
                onChange={(e) =>
                  setAmounts((prev) => ({ ...prev, [cat.id]: e.target.value }))
                }
                placeholder="0"
              />
              {cat.average3m > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs shrink-0"
                  onClick={() => useAverage(cat.id, cat.average3m)}
                >
                  Usar promedio
                </Button>
              )}
            </div>
          ))}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSaveAll} disabled={saving} className="gap-1">
            {saving ? "Guardando..." : "Guardar todo"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

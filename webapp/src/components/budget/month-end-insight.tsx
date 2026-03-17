import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import type { CategoryBudgetData } from "@/types/domain";

interface Props {
  categories: CategoryBudgetData[];
  daysRemaining: number;
}

export function MonthEndInsight({ categories, daysRemaining }: Props) {
  // Show in last 5 days of month (daysRemaining <= 5) or first 3 days of next month (negative values)
  if (daysRemaining > 5 || daysRemaining < -3) return null;

  const fixed = categories.filter((c) => c.expense_type === "fixed" && c.budget && c.budget > 0);
  const variable = categories.filter((c) => c.expense_type === "variable" && c.budget && c.budget > 0);

  if (fixed.length === 0 && variable.length === 0) return null;

  const fixedBudget = fixed.reduce((s, c) => s + (c.budget ?? 0), 0);
  const fixedSpent = fixed.reduce((s, c) => s + c.spent, 0);
  const varBudget = variable.reduce((s, c) => s + (c.budget ?? 0), 0);
  const varSpent = variable.reduce((s, c) => s + c.spent, 0);

  const fixedPct = fixedBudget > 0 ? Math.round((fixedSpent / fixedBudget) * 100) : 0;
  const varRemaining = Math.max(0, varBudget - varSpent);

  return (
    <Card style={{
      borderColor: "color-mix(in srgb, var(--z-alert) 30%, transparent)",
      backgroundColor: "color-mix(in srgb, var(--z-alert) 8%, transparent)",
    }}>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-z-alert shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Resumen del mes</p>
            <p className="text-xs text-muted-foreground">
              {fixedBudget > 0 && `Gastaste ${fixedPct}% de lo fijo. `}
              {varBudget > 0 && varSpent <= varBudget
                ? `Tu gasto variable tiene margen de ${formatCurrency(varRemaining)}.`
                : varBudget > 0
                  ? `Gastaste ${formatCurrency(varSpent - varBudget)} mas de lo planeado en gastos variables.`
                  : ""}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

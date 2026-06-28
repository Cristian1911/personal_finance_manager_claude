import { categoryBudgetGroup } from "@zeta/shared";
import type { CategoryBudgetData } from "@/types/domain";

export type AllocationSet = "needs" | "wants" | "savings";

export interface AllocationSetGroup {
  set: AllocationSet;
  label: string;
  cap: number;
  groups: CategoryBudgetData[];
}

const SETS: { set: AllocationSet; label: string; fraction: number }[] = [
  { set: "needs", label: "Necesidades", fraction: 0.5 },
  { set: "wants", label: "Deseos", fraction: 0.3 },
  { set: "savings", label: "Ahorro/Deuda", fraction: 0.2 },
];

export function groupCategoriesByAllocationSet(
  groups: CategoryBudgetData[],
  income: number,
): AllocationSetGroup[] {
  return SETS.map(({ set, label, fraction }) => ({
    set,
    label,
    cap: Math.round(income * fraction),
    groups: groups.filter((g) =>
      categoryBudgetGroup({ slug: g.slug, expense_type: g.expense_type, is_essential: g.is_essential }) === set
    ),
  }));
}

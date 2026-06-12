/**
 * Group-budget invariant: total = parent's own budget row ("Base")
 * + Σ subcategory budget rows. A group with no rows at all has no budget (null).
 */
export interface GroupRollup {
  totalBudget: number | null;
  totalSpent: number;
  percentUsed: number;
}

export function rollupGroup(input: {
  baseBudget: number | null;
  childBudgets: Record<string, number>;
  parentSpent: number;
  childrenSpent: Record<string, number>;
}): GroupRollup {
  const childIds = Object.keys(input.childBudgets);
  const childSum = childIds.reduce((s, id) => s + input.childBudgets[id], 0);
  const hasAnyRow = input.baseBudget !== null || childIds.length > 0;
  const totalBudget = hasAnyRow ? (input.baseBudget ?? 0) + childSum : null;
  const totalSpent =
    input.parentSpent + Object.values(input.childrenSpent).reduce((s, v) => s + v, 0);
  const percentUsed = totalBudget && totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  return { totalBudget, totalSpent, percentUsed };
}

export interface CompositionDiff {
  upserts: { category_id: string; amount: number }[];
  deletes: string[];
}

/** Both maps are category_id → amount; the parent's id keys its Base line. */
export function computeCompositionDiff(
  initial: Record<string, number>,
  draft: Record<string, number>
): CompositionDiff {
  const upserts: CompositionDiff["upserts"] = [];
  for (const [category_id, amount] of Object.entries(draft)) {
    if (amount > 0 && initial[category_id] !== amount) upserts.push({ category_id, amount });
  }
  const deletes = Object.keys(initial).filter(
    (id) => initial[id] > 0 && !(draft[id] > 0)
  );
  return { upserts, deletes };
}

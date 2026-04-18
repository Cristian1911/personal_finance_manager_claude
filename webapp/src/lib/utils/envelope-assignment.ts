import type { AssignmentDetail, IncomeEnvelope } from "@/types/cashflow-planner";
import type { PlanningAssignment } from "@/types/domain";

/** Clamp a requested assignment amount so neither side ever overflows. */
export function clampAssignmentAmount(params: {
  envelopeRemaining: number;
  expenseRemaining: number;
  requested: number;
}): number {
  const { envelopeRemaining, expenseRemaining, requested } = params;
  if (requested <= 0) return 0;
  return Math.max(0, Math.min(requested, envelopeRemaining, expenseRemaining));
}

/** Find an assignment from this envelope that already targets the given expense. */
export function findExistingAssignment(
  envelope: Pick<IncomeEnvelope, "assignments">,
  expenseEntryId: string,
): PlanningAssignment | null {
  const match = envelope.assignments.find(
    (a: AssignmentDetail) => a.assignment.expense_entry_id === expenseEntryId,
  );
  return match ? match.assignment : null;
}

/** How much of an expense is still unassigned (≥ 0). */
export function computeExpenseRemainder(params: {
  converted_amount: number;
  assignmentsToThisExpense: number[];
}): number {
  const used = params.assignmentsToThisExpense.reduce((s, n) => s + n, 0);
  return Math.max(0, params.converted_amount - used);
}

export interface JarCapacityPreview {
  /** Amount the envelope would absorb if dropped now (after clamping). */
  absorbs: number;
  /** Amount of the expense that would remain unassigned. */
  leftover: number;
  /** True if the envelope can cover the entire expense remainder. */
  coversFull: boolean;
  /** True if this drop would fill the envelope to 100%. */
  jarWouldFill: boolean;
}

/** Compute what a drop would do — used for the hover tooltip. */
export function buildJarCapacityPreview(params: {
  envelopeRemaining: number;
  expenseRemainder: number;
}): JarCapacityPreview {
  const { envelopeRemaining, expenseRemainder } = params;
  const absorbs = Math.max(0, Math.min(envelopeRemaining, expenseRemainder));
  const leftover = expenseRemainder - absorbs;
  return {
    absorbs,
    leftover,
    coversFull: absorbs === expenseRemainder && expenseRemainder > 0,
    jarWouldFill: absorbs > 0 && absorbs === envelopeRemaining,
  };
}

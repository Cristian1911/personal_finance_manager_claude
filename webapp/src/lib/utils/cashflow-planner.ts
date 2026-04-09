import type { PlanningEntryStatus } from "@/types/domain";
import type { IncomeEnvelope } from "@/types/cashflow-planner";

// ─── Status cycling ─────────────────────────────────────────────────────────

export function nextExpenseStatus(current: PlanningEntryStatus): PlanningEntryStatus {
  return current === "PLANNED" ? "COMPLETED" : current === "COMPLETED" ? "SKIPPED" : "PLANNED";
}

export function nextIncomeStatus(current: PlanningEntryStatus): PlanningEntryStatus {
  return current === "PLANNED" ? "COMPLETED" : "PLANNED";
}

// ─── Envelope computed data ─────────────────────────────────────────────────

export type AssignmentChip = { colorIndex: number; amount: number; label: string };

export interface EnvelopeComputedData {
  assignedPerExpense: Map<string, number>;
  incomeColorMap: Map<string, number>;
  expenseAssignmentChips: Map<string, AssignmentChip[]>;
}

/** Single-pass computation of assignment maps from income envelopes. */
export function buildEnvelopeMaps(incomeEnvelopes: IncomeEnvelope[]): EnvelopeComputedData {
  const assignedPerExpense = new Map<string, number>();
  const incomeColorMap = new Map<string, number>();
  const expenseAssignmentChips = new Map<string, AssignmentChip[]>();

  incomeEnvelopes.forEach((env, colorIdx) => {
    incomeColorMap.set(env.entry.id, colorIdx);
    for (const { assignment } of env.assignments) {
      assignedPerExpense.set(
        assignment.expense_entry_id,
        (assignedPerExpense.get(assignment.expense_entry_id) ?? 0) + Number(assignment.assigned_amount),
      );
      const chips = expenseAssignmentChips.get(assignment.expense_entry_id) ?? [];
      chips.push({ colorIndex: colorIdx, amount: Number(assignment.assigned_amount), label: env.entry.label });
      expenseAssignmentChips.set(assignment.expense_entry_id, chips);
    }
  });

  return { assignedPerExpense, incomeColorMap, expenseAssignmentChips };
}

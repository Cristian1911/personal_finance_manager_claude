import type { PlanningEntryStatus } from "@/types/domain";

export type IncomeState = "esperado" | "confirmado" | "atrasado" | "omitido";

/** Date args are YYYY-MM-DD; compared as strings (no Date/timezone). */
export function deriveIncomeState(
  status: PlanningEntryStatus,
  expectedDate: string,
  todayISO: string,
): IncomeState {
  if (status === "COMPLETED") return "confirmado";
  if (status === "SKIPPED") return "omitido";
  return expectedDate < todayISO ? "atrasado" : "esperado";
}

export interface CommitmentIncomeRef {
  entryId: string;
  state: IncomeState;
  expectedDate: string;
  isOpeningBalance: boolean;
}

export interface CommitmentExpenseInput {
  entryId: string;
  dueDate: string;
  unpaidAmount: number;
  assignments: { incomeEntryId: string; amount: number }[];
}

export interface ExpenseCommitment {
  cuentaAhora: number;
  cubierto: number;
  sinAsignar: number;
}

export interface CommitmentSummary {
  saldoActual: number;
  comprometidoAhora: number;
  comprometidoCubierto: number;
  puedoGastar: number;
  nextIncomeDate: string | null;
  perExpense: Record<string, ExpenseCommitment>;
}

/**
 * Time-aware commitment classifier. A committed amount is "cuenta ahora" (it
 * subtracts from Puedo gastar) when it must come out of money already in hand:
 * funded from the opening balance or a confirmado income, funded from an
 * atrasado income (the money never arrived), or due before its funder lands.
 * Otherwise it is "cubierto" — an upcoming income covers it in time. An
 * unassigned remainder is "cuenta ahora" if due before the next expected
 * income, else "sin asignar" (surfaced, not subtracted).
 */
export function classifyCommitments(
  expenses: CommitmentExpenseInput[],
  incomeRefs: CommitmentIncomeRef[],
  saldoActual: number,
  todayISO: string,
): CommitmentSummary {
  const incomeById = new Map(incomeRefs.map((i) => [i.entryId, i]));
  const upcoming = incomeRefs
    .filter((i) => i.state === "esperado" && i.expectedDate >= todayISO)
    .map((i) => i.expectedDate)
    .sort();
  const nextIncomeDate = upcoming.length ? upcoming[0] : null;
  const dueBeforeNext = (due: string) =>
    nextIncomeDate === null || due < nextIncomeDate;

  const perExpense: Record<string, ExpenseCommitment> = {};
  let comprometidoAhora = 0;
  let comprometidoCubierto = 0;

  for (const exp of expenses) {
    let ahora = 0;
    let cubierto = 0;
    let sinAsignar = 0;
    let assignedTotal = 0;

    for (const a of exp.assignments) {
      assignedTotal += a.amount;
      const inc = incomeById.get(a.incomeEntryId);
      if (
        !inc ||
        inc.isOpeningBalance ||
        inc.state === "confirmado" ||
        inc.state === "atrasado"
      ) {
        ahora += a.amount; // funded from money in hand, or funder is late/unknown
      } else if (exp.dueDate < inc.expectedDate) {
        ahora += a.amount; // due before the funder lands
      } else {
        cubierto += a.amount; // funder lands in time
      }
    }

    const remainder = Math.max(0, exp.unpaidAmount - assignedTotal);
    if (remainder > 0) {
      if (dueBeforeNext(exp.dueDate)) ahora += remainder;
      else sinAsignar += remainder;
    }

    perExpense[exp.entryId] = { cuentaAhora: ahora, cubierto, sinAsignar };
    comprometidoAhora += ahora;
    comprometidoCubierto += cubierto;
  }

  return {
    saldoActual,
    comprometidoAhora,
    comprometidoCubierto,
    puedoGastar: saldoActual - comprometidoAhora,
    nextIncomeDate,
    perExpense,
  };
}

import { describe, it, expect } from "vitest";
import {
  deriveIncomeState,
  classifyCommitments,
  type CommitmentIncomeRef,
} from "./plan-commitments";

describe("deriveIncomeState", () => {
  const today = "2026-06-25";
  it("COMPLETED → confirmado", () => {
    expect(deriveIncomeState("COMPLETED", "2026-06-23", today)).toBe("confirmado");
  });
  it("SKIPPED → omitido", () => {
    expect(deriveIncomeState("SKIPPED", "2026-06-10", today)).toBe("omitido");
  });
  it("PLANNED with future date → esperado", () => {
    expect(deriveIncomeState("PLANNED", "2026-06-26", today)).toBe("esperado");
  });
  it("PLANNED with today's date → esperado", () => {
    expect(deriveIncomeState("PLANNED", "2026-06-25", today)).toBe("esperado");
  });
  it("PLANNED with past date → atrasado", () => {
    expect(deriveIncomeState("PLANNED", "2026-06-20", today)).toBe("atrasado");
  });
});

describe("classifyCommitments", () => {
  const today = "2026-06-25";
  const opening: CommitmentIncomeRef = { entryId: "saldo", state: "confirmado", expectedDate: "2026-06-01", isOpeningBalance: true };
  const nomina26: CommitmentIncomeRef = { entryId: "n26", state: "esperado", expectedDate: "2026-06-26", isOpeningBalance: false };
  const nominaLate: CommitmentIncomeRef = { entryId: "nlate", state: "atrasado", expectedDate: "2026-06-20", isOpeningBalance: false };

  it("nextIncomeDate is the earliest esperado on/after today", () => {
    const r = classifyCommitments([], [opening, nomina26, nominaLate], 0, today);
    expect(r.nextIncomeDate).toBe("2026-06-26");
  });

  it("assigned to opening/current balance → cuenta ahora", () => {
    const r = classifyCommitments(
      [{ entryId: "rent", dueDate: "2026-06-25", unpaidAmount: 300000, assignments: [{ incomeEntryId: "saldo", amount: 300000 }] }],
      [opening, nomina26], 399554, today);
    expect(r.perExpense.rent.cuentaAhora).toBe(300000);
    expect(r.comprometidoAhora).toBe(300000);
    expect(r.puedoGastar).toBe(99554);
  });

  it("assigned to a future income, due after it lands → cubierto", () => {
    const r = classifyCommitments(
      [{ entryId: "exito", dueDate: "2026-06-28", unpaidAmount: 355891, assignments: [{ incomeEntryId: "n26", amount: 355891 }] }],
      [opening, nomina26], 399554, today);
    expect(r.perExpense.exito.cubierto).toBe(355891);
    expect(r.comprometidoCubierto).toBe(355891);
    expect(r.comprometidoAhora).toBe(0);
    expect(r.puedoGastar).toBe(399554);
  });

  it("assigned to a future income but due BEFORE it lands → cuenta ahora", () => {
    const r = classifyCommitments(
      [{ entryId: "early", dueDate: "2026-06-25", unpaidAmount: 100000, assignments: [{ incomeEntryId: "n26", amount: 100000 }] }],
      [opening, nomina26], 399554, today);
    expect(r.perExpense.early.cuentaAhora).toBe(100000);
  });

  it("assigned to an ATRASADO income → cuenta ahora (funding didn't arrive)", () => {
    const r = classifyCommitments(
      [{ entryId: "x", dueDate: "2026-06-30", unpaidAmount: 50000, assignments: [{ incomeEntryId: "nlate", amount: 50000 }] }],
      [opening, nominaLate], 399554, today);
    expect(r.perExpense.x.cuentaAhora).toBe(50000);
  });

  it("unassigned remainder due before next income → cuenta ahora; due after → sin asignar", () => {
    const r = classifyCommitments(
      [
        { entryId: "soon", dueDate: "2026-06-25", unpaidAmount: 40000, assignments: [] },
        { entryId: "later", dueDate: "2026-06-29", unpaidAmount: 80000, assignments: [] },
      ],
      [opening, nomina26], 399554, today);
    expect(r.perExpense.soon.cuentaAhora).toBe(40000);
    expect(r.perExpense.later.sinAsignar).toBe(80000);
    expect(r.comprometidoAhora).toBe(40000);
  });

  it("no upcoming income → everything pending is cuenta ahora", () => {
    const r = classifyCommitments(
      [{ entryId: "a", dueDate: "2026-06-30", unpaidAmount: 90000, assignments: [] }],
      [opening], 50000, today);
    expect(r.nextIncomeDate).toBeNull();
    expect(r.perExpense.a.cuentaAhora).toBe(90000);
    expect(r.puedoGastar).toBe(-40000);
  });

  it("partial assignment splits across buckets", () => {
    const r = classifyCommitments(
      [{ entryId: "sub", dueDate: "2026-06-30", unpaidAmount: 200000, assignments: [{ incomeEntryId: "n26", amount: 120000 }] }],
      [opening, nomina26], 399554, today);
    expect(r.perExpense.sub.cubierto).toBe(120000);
    expect(r.perExpense.sub.sinAsignar).toBe(80000);
  });
});

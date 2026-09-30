import { describe, expect, it } from "vitest";
import { computeVerdict, findBillAtRisk, formatPesos, verdictMessage, type DisponibleVerdictInput } from "../verdict";

// Laura: started at $34.700 al día; next payday 30 Sep.
const base: DisponibleVerdictInput = {
  disponible: 421_100, perDay: 35_000, startingPerDay: 34_700, nextPayday: "2026-09-30",
  now: "2026-09-18T15:00:00.000Z",
};

describe("computeVerdict (S3-4)", () => {
  it("Laura on 18 Sep: Vas bien ($35.000 ≥ 85% of $34.700)", () => {
    const v = computeVerdict(base);
    expect(v.state).toBe("vas_bien");
    expect(verdictMessage(v.reason)).toBe("Puedes gastar hasta $35.000 al día.");
  });

  it("with $250.000 spent: Cuidado, para llegar al 30 gasta máximo $22.500 al día", () => {
    const v = computeVerdict({ ...base, disponible: 271_100, perDay: 22_500 });
    expect(v.state).toBe("cuidado");
    expect(verdictMessage(v.reason)).toBe("Para llegar al 30, gasta máximo $22.500 al día.");
  });

  it("exactly at 85% is still Vas bien", () => {
    expect(computeVerdict({ ...base, perDay: 34_000, startingPerDay: 40_000 }).state).toBe("vas_bien");
    expect(computeVerdict({ ...base, perDay: 33_900, startingPerDay: 40_000 }).state).toBe("cuidado");
  });

  it("below 0: Te pasaste, and the amount is carried to the next cycle", () => {
    const v = computeVerdict({ ...base, disponible: -85_000, perDay: 0 });
    expect(v.state).toBe("te_pasaste");
    expect(verdictMessage(v.reason)).toBe("Te pasaste por $85.000. Lo restamos del próximo ciclo.");
  });

  it("a bill at risk within 3 days: Cuidado even at a good pace", () => {
    const v = computeVerdict({ ...base, billAtRisk: { label: "Arriendo", dueDate: "2026-09-19" } });
    expect(v.state).toBe("cuidado");
    expect(verdictMessage(v.reason)).toBe("Tu saldo no alcanza para Arriendo, que vence el 19.");
  });

  it("next cycle would go below 0 because of a card bill (S3-5): Cuidado with the reason", () => {
    const v = computeVerdict({ ...base, nextCycleShortBy: 120_000 });
    expect(v.state).toBe("cuidado");
    expect(verdictMessage(v.reason)).toBe("El próximo ciclo quedaría corto por $120.000.");
  });

  it("irregular income: 'a fin de mes'", () => {
    const v = computeVerdict({ ...base, perDay: 10_000, nextPayday: null });
    expect(verdictMessage(v.reason)).toBe("Para llegar a fin de mes, gasta máximo $10.000 al día.");
  });

  it("nothing left to spend until payday (per day $0): Cuidado", () => {
    const v = computeVerdict({ ...base, disponible: 0, perDay: 0, startingPerDay: 0 });
    expect(v.state).toBe("cuidado");
    expect(verdictMessage(v.reason)).toBe("No te queda para gastar hasta el 30.");
  });
});

describe("computeVerdict — no flicker (worsens now, improves after 24 h)", () => {
  const cuidado = { ...base, disponible: 271_100, perDay: 22_500 };

  it("worsens immediately", () => {
    const first = computeVerdict(base);
    const v = computeVerdict({ ...cuidado, memo: first.memo, now: "2026-09-18T16:00:00.000Z" });
    expect(v.state).toBe("cuidado");
  });

  it("a refund that lifts it back doesn't make the pill jump before 24 h", () => {
    const worse = computeVerdict(cuidado);
    const early = computeVerdict({ ...base, memo: worse.memo, now: "2026-09-18T20:00:00.000Z" });
    expect(early).toMatchObject({ state: "cuidado", raw: "vas_bien" });
    expect(verdictMessage(early.reason)).toBe("Vas mejorando. Lo confirmamos en 24 horas.");
    const later = computeVerdict({ ...base, memo: early.memo, now: "2026-09-19T20:00:00.000Z" });
    expect(later.state).toBe("vas_bien");
  });

  it("the 24 h restart if it gets worse again in between", () => {
    const worse = computeVerdict(cuidado);
    const up = computeVerdict({ ...base, memo: worse.memo, now: "2026-09-18T20:00:00.000Z" });
    const down = computeVerdict({ ...cuidado, memo: up.memo, now: "2026-09-19T08:00:00.000Z" });
    const up2 = computeVerdict({ ...base, memo: down.memo, now: "2026-09-19T21:00:00.000Z" });
    expect(up2.state).toBe("cuidado");
  });

  it("the clock restarts when the better state changes (no jump on a state that barely held)", () => {
    const over = computeVerdict({ ...base, disponible: -10_000, perDay: 0 });
    const toCuidado = computeVerdict({ ...cuidado, memo: over.memo, now: "2026-09-18T16:00:00.000Z" });
    // Cuidado held since 16:00; Vas bien appears 24.5 h later and has held for 0 h.
    const toBien = computeVerdict({ ...base, memo: toCuidado.memo, now: "2026-09-19T16:30:00.000Z" });
    expect(toBien.state).toBe("te_pasaste");
    expect(computeVerdict({ ...base, memo: toBien.memo, now: "2026-09-20T16:30:00.000Z" }).state).toBe("vas_bien");
  });

  it("from Te pasaste, improving to Cuidado also waits", () => {
    const over = computeVerdict({ ...base, disponible: -10_000, perDay: 0 });
    expect(computeVerdict({ ...cuidado, memo: over.memo, now: "2026-09-18T18:00:00.000Z" }).state).toBe("te_pasaste");
  });
});

describe("findBillAtRisk", () => {
  const today = "2026-09-18";

  it("a bill due within 3 days that the balance won't cover", () => {
    expect(findBillAtRisk({
      today,
      bills: [{ label: "Arriendo", dueDate: "2026-09-19", amount: 700_000 }],
      balances: [{ accountId: "debit", balance: 500_000 }, { accountId: "savings", balance: 100_000 }],
    })).toEqual({ label: "Arriendo", dueDate: "2026-09-19" });
  });

  it("bills are covered in due order; the one that runs out is at risk", () => {
    expect(findBillAtRisk({
      today,
      bills: [
        { label: "Tarjeta Nu", dueDate: "2026-09-21", amount: 640_000 },
        { label: "Arriendo", dueDate: "2026-09-19", amount: 700_000 },
      ],
      balances: [{ accountId: "debit", balance: 1_000_000 }],
    })).toEqual({ label: "Tarjeta Nu", dueDate: "2026-09-21" });
  });

  it("a bill paid from a specific account is checked against that account", () => {
    expect(findBillAtRisk({
      today,
      bills: [{ label: "Crédito", dueDate: "2026-09-20", amount: 300_000, payFromAccountId: "savings" }],
      balances: [{ accountId: "debit", balance: 2_000_000 }, { accountId: "savings", balance: 100_000 }],
    })?.label).toBe("Crédito");
  });

  it("an overdue unpaid bill is the most at risk", () => {
    expect(findBillAtRisk({
      today,
      bills: [{ label: "Claro", dueDate: "2026-09-15", amount: 90_000 }],
      balances: [{ accountId: "debit", balance: 50_000 }],
    })?.label).toBe("Claro");
  });

  it("bills further than 3 days out aren't at risk yet", () => {
    expect(findBillAtRisk({
      today,
      bills: [{ label: "Netflix", dueDate: "2026-09-24", amount: 38_900 }],
      balances: [{ accountId: "debit", balance: 0 }],
    })).toBeNull();
  });
});

describe("formatPesos", () => {
  it("Colombian thousands separator, no decimals", () => {
    expect(formatPesos(22_500)).toBe("$22.500");
    expect(formatPesos(1_850_000)).toBe("$1.850.000");
    expect(formatPesos(900)).toBe("$900");
    expect(formatPesos(34_740.6)).toBe("$34.741");
  });
});

import { describe, expect, it } from "vitest";
import { captureActive, setupProgress, setupLevel, type SetupInput } from "../setup";
import { firstPagoDate, pagosFijosSugeridos } from "../revisar";
import type { StoredTransaction } from "../movements";
import type { CycleSettings } from "../../types";

const settings: CycleSettings = {
  schedule: { kind: "semimonthly", paydays: [15, 30] },
  incomePerCycle: 2_400_000,
  savingsPerCycle: 0,
  balanceAnchor: { balance: 1_500_000, at: "2026-10-03T12:00:00Z" },
  bigPurchaseThreshold: 300_000,
};

const base: SetupInput = {
  settings, accounts: [], templates: [], transactions: [], hasStatement: false,
  pendingBills: [], noCards: false, noBills: false, today: "2026-10-03",
};

const pct = (over: Partial<SetupInput>) => setupProgress({ ...base, ...over }).percent;

describe("setupProgress (S10-4: how real the Disponible is)", () => {
  it("basics alone are a Borrador at 20%", () => {
    const p = setupProgress(base);
    expect(p.percent).toBe(20);
    expect(p.level).toBe("borrador");
    expect(p.tasks.filter((t) => !t.done).map((t) => t.id)).toEqual(["statement", "bills", "cards"]);
  });

  it("no settings is 0%; irregular income needs no amount", () => {
    expect(pct({ settings: null })).toBe(0);
    expect(pct({ settings: { ...settings, schedule: { kind: "irregular" }, incomePerCycle: null } })).toBe(20);
    expect(pct({ settings: { ...settings, incomePerCycle: null } })).toBe(0);
  });

  it("a statement makes it Aproximado; everything makes it Real 100%", () => {
    expect(setupProgress({ ...base, hasStatement: true }).level).toBe("aproximado");
    const all = setupProgress({
      ...base, hasStatement: true,
      templates: [{ isActive: true, direction: "OUTFLOW" }],
      accounts: [{ accountType: "CREDIT_CARD" }],
    });
    expect(all.percent).toBe(100);
    expect(all.level).toBe("real");
  });

  it("pending bill names keep the task open even with other bills", () => {
    const p = setupProgress({ ...base, templates: [{ isActive: true }], pendingBills: ["Arriendo", "Internet"] });
    const bills = p.tasks.find((t) => t.id === "bills")!;
    expect(bills.done).toBe(false);
    expect(bills.detail).toContain("Arriendo y Internet");
    expect(bills.declineLabel).toBe("Ya no los pago");
  });

  it("'No tengo' closes cards and bills; archived or income templates don't count", () => {
    expect(pct({ noCards: true, noBills: true })).toBe(60);
    expect(pct({ templates: [{ isActive: false }, { isActive: true, direction: "INFLOW" }] })).toBe(20);
  });

  it("automatic capture is its own guide: active only inside 14 days, not for manual or PDF", () => {
    expect(captureActive([{ date: "2026-09-10", captureMethod: "EMAIL_IMPORT" }], "2026-10-03")).toBe(false);
    expect(captureActive([{ date: "2026-10-01", captureMethod: "MANUAL_FORM" }, { date: "2026-10-01", captureMethod: "PDF_IMPORT" }, { date: "2026-10-01", captureMethod: "EMAIL_PDF_IMPORT" }], "2026-10-03")).toBe(false);
    expect(captureActive([{ date: "2026-10-01", captureMethod: "NOTIFICATION" }], "2026-10-03")).toBe(true);
    expect(pct({ transactions: [{ date: "2026-10-01", captureMethod: "NOTIFICATION" }] })).toBe(20);
  });

  it("'No uso extractos' closes the statement task (optional, S10-5)", () => {
    expect(pct({ noStatements: true, noCards: true, noBills: true })).toBe(100);
    expect(setupProgress(base).tasks.find((t) => t.id === "statement")!.declineLabel).toBe("No uso extractos");
  });

  it("levels: <40 Borrador, 40–79 Aproximado, ≥80 Real", () => {
    expect([39, 40, 79, 80].map(setupLevel)).toEqual(["borrador", "aproximado", "aproximado", "real"]);
  });
});

describe("firstPagoDate", () => {
  it("this month when the day hasn't passed, else next month; clamps to 1–28", () => {
    expect(firstPagoDate(5, "2026-10-03")).toBe("2026-10-05");
    expect(firstPagoDate(3, "2026-10-03")).toBe("2026-10-03");
    expect(firstPagoDate(2, "2026-10-03")).toBe("2026-11-02");
    expect(firstPagoDate(31, "2026-10-03")).toBe("2026-10-28");
    expect(firstPagoDate(1, "2026-12-20")).toBe("2027-01-01");
  });
});

const tx = (id: string, date: string, over: Partial<StoredTransaction> = {}): StoredTransaction => ({
  id, accountId: "a", date, amount: 38_900, direction: "OUTFLOW", currencyCode: "COP", flowClass: null, description: "NETFLIX.COM", ...over,
});

describe("pagosFijosSugeridos (S10-6: ¿Pagas X cada mes?)", () => {
  const input = (transactions: StoredTransaction[], over: Partial<Parameters<typeof pagosFijosSugeridos>[0]> = {}) =>
    pagosFijosSugeridos({ transactions, templates: [], occurrences: [], destinatarios: [], dismissed: [], today: "2026-10-03", ...over });

  it("proposes a monthly charge with its day and first due date", () => {
    const [s] = input([tx("1", "2026-08-18"), tx("2", "2026-09-18")]);
    expect(s).toMatchObject({ name: "Netflix.com", amount: 38_900, dayOfMonth: 18, startDate: "2026-10-18", transactionIds: ["1", "2"] });
    expect(s.seen).toMatch(/18 .+ y 18 .+/);
  });

  it("uses the destinatario's name and moves day 31 to 28", () => {
    const [s] = input(
      [tx("1", "2026-08-31", { destinatarioId: "d", amount: 1_350_000 }), tx("2", "2026-09-30", { destinatarioId: "d", amount: 1_350_000 })],
      { destinatarios: [{ id: "d", name: "Arriendo Laura" }] },
    );
    expect(s.name).toBe("Arriendo Laura");
    expect(s.dayOfMonth).toBe(28);
  });

  it("skips what is already a bill, linked, dismissed, a transfer, a debt payment or not COP", () => {
    const pair = [tx("1", "2026-08-18"), tx("2", "2026-09-18")];
    expect(input(pair, { templates: [{ label: "netflix.com" }] })).toEqual([]);
    expect(input(pair, { occurrences: [{ transactionId: "2" }] })).toEqual([]);
    const key = input(pair)[0].key;
    expect(input(pair, { dismissed: [key] })).toEqual([]);
    expect(input(pair.map((t) => ({ ...t, transferGroupId: "g" })))).toEqual([]);
    expect(input(pair.map((t) => ({ ...t, flowClass: "DEBT_PAYMENT" })))).toEqual([]);
    expect(input(pair.map((t) => ({ ...t, currencyCode: "USD" })))).toEqual([]);
  });

  it("ignores one-off and irregular charges", () => {
    expect(input([tx("1", "2026-09-18")])).toEqual([]);
    expect(input([tx("1", "2026-08-01"), tx("2", "2026-09-20")])).toEqual([]);
  });
});

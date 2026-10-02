import { describe, expect, it } from "vitest";
import type { CycleSettings } from "../../types";
import { buildInicio, inicioSince, type InicioAccount } from "../inicio";
import type { StoredTransaction } from "../movements";

const DEBIT = "debit";
const CARD = "card";
const ACCOUNTS: InicioAccount[] = [
  { id: DEBIT, accountType: "CHECKING", currentBalance: 0, countsInDisponible: null },
  { id: CARD, accountType: "CREDIT_CARD", currentBalance: 0, countsInDisponible: null },
];

/** Semimonthly 15/30, $2.100.000 per cycle, $200.000 saved; "¿Cuánto tienes hoy?" answered on the 16th. */
function settings(over: Partial<CycleSettings> = {}): CycleSettings {
  return {
    schedule: { kind: "semimonthly", paydays: [15, 30] },
    incomePerCycle: 2_100_000,
    savingsPerCycle: 200_000,
    balanceAnchor: { balance: 1_500_000, at: "2026-09-16T14:00:00.000Z" },
    bigPurchaseThreshold: 300_000,
    ...over,
  };
}

let n = 0;
function tx(date: string, amount: number, direction: "INFLOW" | "OUTFLOW" = "OUTFLOW", over: Partial<StoredTransaction> = {}): StoredTransaction {
  return { id: `t${++n}`, accountId: DEBIT, date, amount, direction, currencyCode: "COP", flowClass: null, ...over };
}

function build(today: string, transactions: StoredTransaction[], over: Partial<Parameters<typeof buildInicio>[0]> = {}) {
  const r = buildInicio({ today, now: `${today}T15:00:00.000Z`, settings: settings(), accounts: ACCOUNTS, transactions, ...over });
  if (r.status !== "ready") throw new Error("expected ready");
  return r;
}

describe("buildInicio — first run", () => {
  it.each([
    ["no settings", null],
    ["no payday", settings({ schedule: null })],
    ["no income (not irregular)", settings({ incomePerCycle: null })],
    ["no balance today", settings({ balanceAnchor: null })],
  ])("asks the first-run questions when there's %s", (_why, s) => {
    expect(buildInicio({ today: "2026-09-18", now: "2026-09-18T15:00:00.000Z", settings: s, accounts: ACCOUNTS, transactions: [] }))
      .toEqual({ status: "needs_setup" });
  });

  it("irregular income needs no amount", () => {
    const r = buildInicio({
      today: "2026-09-18", now: "2026-09-18T15:00:00.000Z",
      settings: settings({ schedule: { kind: "irregular" }, incomePerCycle: null }), accounts: ACCOUNTS, transactions: [],
    });
    expect(r.status).toBe("ready");
  });
});

describe("buildInicio — the Tarjeta widget reads the cards", () => {
  it("a card with its days shows its next bill (purchases of its period), due date and what you owe", () => {
    const card = { id: CARD, name: "Visa", accountType: "CREDIT_CARD", currentBalance: 900_000, countsInDisponible: null, cutoffDay: 27, paymentDay: 12 };
    const r = build("2026-09-18", [tx("2026-09-17", 300_000, "OUTFLOW", { accountId: CARD }), tx("2026-08-20", 50_000, "OUTFLOW", { accountId: CARD })],
      { accounts: [ACCOUNTS[0], card] });
    if (r.status !== "ready") throw new Error(r.status);
    const w = r.widgets.find((x) => x.id === `tarjeta:${CARD}`);
    expect(w).toMatchObject({ title: "Visa", hint: "próxima factura" });
    // Cut on the 27th → this bill is Aug 28–Sep 27 (the 300.000), due Oct 12.
    expect(w!.rows).toEqual(expect.arrayContaining([expect.objectContaining({ id: "total", amount: "$900.000" })]));
    expect(w!.lead).toContain("300.000");
    expect(r.widgets.some((x) => x.empty && x.id.startsWith("tarjeta"))).toBe(false);
  });

  const card = { id: CARD, name: "Visa", accountType: "CREDIT_CARD", currentBalance: 0, countsInDisponible: null, cutoffDay: 27, paymentDay: 12 };
  const tarjeta = (r: ReturnType<typeof build>) => {
    if (r.status !== "ready") throw new Error(r.status);
    return r.widgets.find((x) => x.id === `tarjeta:${CARD}`)!;
  };

  it("with its statement, the card's bill in Disponible is the minimum, not everything bought (D24)", () => {
    const r = build("2026-10-02", [tx("2026-09-17", 300_000, "OUTFLOW", { accountId: CARD })], {
      accounts: [ACCOUNTS[0], { ...card, cutoffDay: 30, paymentDay: 12 }],
      statements: [{ accountId: CARD, cutDate: "2026-09-30", dueDate: "2026-10-12", minimum: 45_000, totalDue: 300_000, rate: 24.33 }],
    });
    if (r.status !== "ready") throw new Error(r.status);
    expect(r.bills.find((b) => b.kind === "card")).toMatchObject({ amount: 45_000, dueDate: "2026-10-12", estimated: false });
    expect(tarjeta(r).rows).toEqual(expect.arrayContaining([expect.objectContaining({ id: "minimum", amount: "$45.000" })]));
  });

  it("a bill paid this cycle isn't shown as owed (no red on its due day)", () => {
    const r = build("2026-10-12", [
      tx("2026-09-17", 300_000, "OUTFLOW", { accountId: CARD }),
      tx("2026-10-01", 300_000, "INFLOW", { accountId: CARD }), // paid
    ], { accounts: [ACCOUNTS[0], card] });
    const w = tarjeta(r);
    expect(w.lead).not.toContain("300.000");
    expect(w.attention).toBeFalsy();
  });

  it("after the due date with nothing new bought, no old bill comes back as 'Pago vencido'", () => {
    const r = build("2026-10-20", [tx("2026-09-17", 300_000, "OUTFLOW", { accountId: CARD })], { accounts: [ACCOUNTS[0], card] });
    expect(tarjeta(r).attention?.reason ?? "").not.toBe("Pago vencido");
  });

  it("a card without its payment day asks for it instead of showing ≈ $0", () => {
    const r = build("2026-09-18", [], { accounts: [ACCOUNTS[0], { ...card, cutoffDay: null, paymentDay: null }] });
    expect(tarjeta(r)).toMatchObject({ hint: "Falta el día de pago" });
  });
});

describe("buildInicio — the first cycle starts from the balance told", () => {
  it("balance − Ahorro − what went out after it; card purchases don't count", () => {
    const r = build("2026-09-18", [
      tx("2026-09-16", 50_000, "OUTFLOW", { createdAt: "2026-09-16T13:00:00.000Z" }), // before the anchor: inside the balance
      tx("2026-09-17", 100_000),
      tx("2026-09-17", 300_000, "OUTFLOW", { accountId: CARD }),
    ]);
    expect(r.cycle).toMatchObject({ start: "2026-09-15", end: "2026-09-29", payday: "2026-09-15", daysLeft: 12 });
    expect(r.result.llega.total).toBe(1_500_000);
    expect(r.result.ahorro.total).toBe(200_000);
    expect(r.result.yaSalio.total).toBe(100_000);
    expect(r.view.amount).toBe("$1.200.000");
    expect(r.view.perDay).toBe("$100.000 al día · 12 días");
    expect(r.verdict.state).toBe("vas_bien");
    // Counted money now (Mis cuentas' header): the balance told minus what left the debit after it.
    expect(r.balanceToday).toBe(1_400_000);
  });

  it("a statement row (no time) is placed by its date, not by when it was imported", () => {
    const imported = "2026-09-18T15:00:00.000Z";
    const r = build("2026-09-18", [
      tx("2026-09-16", 50_000, "OUTFLOW", { captureMethod: "PDF_IMPORT", createdAt: imported }), // the anchor's day: inside the balance
      tx("2026-09-17", 20_000, "OUTFLOW", { captureMethod: "PDF_IMPORT", createdAt: imported }),
    ]);
    expect(r.result.yaSalio.total).toBe(20_000);
  });

  it("a movement captured later the same day counts", () => {
    const r = build("2026-09-18", [tx("2026-09-16", 50_000, "OUTFLOW", { createdAt: "2026-09-16T20:00:00.000Z" })]);
    expect(r.result.yaSalio.total).toBe(50_000);
  });

  it("the anchor's day is Colombia's: told at 8 p.m. on the 15th, a 9 p.m. expense counts", () => {
    const r = build("2026-09-18", [tx("2026-09-15", 40_000, "OUTFLOW", { createdAt: "2026-09-16T02:00:00.000Z" })], {
      settings: settings({ balanceAnchor: { balance: 1_500_000, at: "2026-09-16T01:00:00.000Z" } }),
    });
    expect(r.result.yaSalio.total).toBe(40_000);
  });

  it("told on payday: the salary is taken as inside the balance, not added again", () => {
    const r = build("2026-09-30", [], {
      settings: settings({ balanceAnchor: { balance: 1_500_000, at: "2026-09-30T14:00:00.000Z" } }),
    });
    expect(r.cycle.payday).toBe("2026-09-30");
    expect(r.result.llega.total).toBe(1_500_000);
    expect(r.result.approximate).toBe(false);
  });

  it("…and if it lands later that day after all, it counts once", () => {
    const r = build("2026-09-30", [tx("2026-09-30", 2_100_000, "INFLOW", { createdAt: "2026-09-30T18:00:00.000Z" })], {
      settings: settings({ balanceAnchor: { balance: 1_500_000, at: "2026-09-30T14:00:00.000Z" } }),
    });
    expect(r.result.llega.total).toBe(3_600_000);
  });

  it("an account the user left out doesn't count", () => {
    const r = build("2026-09-18", [tx("2026-09-17", 100_000)], {
      accounts: [{ ...ACCOUNTS[0], countsInDisponible: false }, ACCOUNTS[1]],
    });
    expect(r.result.yaSalio.total).toBe(0);
  });
});

describe("buildInicio — later cycles start from the salary", () => {
  it("a salary seen on payday replaces the expected one", () => {
    const r = build("2026-10-05", [tx("2026-09-30", 2_100_000, "INFLOW"), tx("2026-10-02", 100_000)]);
    expect(r.cycle).toMatchObject({ start: "2026-09-30", end: "2026-10-14", payday: "2026-09-30", startsOnExpectedDate: false });
    expect(r.result.llega.total).toBe(2_100_000);
    expect(r.result.approximate).toBe(false);
    expect(r.view.amount).toBe("$1.800.000");
  });

  it("no salary yet: the expected amount counts with a '~'", () => {
    const r = build("2026-10-05", [tx("2026-10-02", 100_000)]);
    expect(r.result.llega.total).toBe(2_100_000);
    expect(r.view.amount).toBe("~$1.800.000");
    expect(r.view.approxNote).toBe("Tu salario aún no llega");
  });

  it("a small inflow is Otros ingresos, not the salary", () => {
    const r = build("2026-10-05", [tx("2026-10-01", 80_000, "INFLOW")]);
    expect(r.result.llega.lines.find((l) => l.id === "income")?.amount).toBe(80_000);
    expect(r.result.approximate).toBe(true);
  });

  it("a salary a few days early opens the cycle that day", () => {
    const r = build("2026-09-28", [tx("2026-09-27", 2_000_000, "INFLOW")]);
    expect(r.cycle).toMatchObject({ start: "2026-09-27", payday: "2026-09-30" });
    expect(r.result.llega.total).toBe(2_000_000);
    expect(r.view.payday).toBe("Te pagan en 17 días");
  });

  it("a big Ingreso extra written by hand on payday isn't taken as the salary (Anotar)", () => {
    const r = build("2026-10-05", [tx("2026-09-30", 2_000_000, "INFLOW", { captureMethod: "MANUAL_FORM", description: "Bono", flowClass: "INCOME" })]);
    expect(r.result.llega.lines.find((l) => l.id === "income")?.amount).toBe(2_000_000);
    expect(r.result.approximate).toBe(true); // the salary is still expected
  });

  it("'Mi sueldo' written by hand is the salary", () => {
    const r = build("2026-10-05", [tx("2026-09-30", 2_100_000, "INFLOW", { captureMethod: "MANUAL_FORM", description: "Sueldo", flowClass: "INCOME" })]);
    expect(r.result.llega.total).toBe(2_100_000);
    expect(r.result.approximate).toBe(false);
  });

  it("a big refund mid-cycle isn't taken as the salary", () => {
    const r = build("2026-10-10", [tx("2026-09-30", 2_100_000, "INFLOW"), tx("2026-10-08", 1_200_000, "INFLOW")]);
    expect(r.cycle.start).toBe("2026-09-30");
    expect(r.result.llega.lines.find((l) => l.id === "income")?.amount).toBe(1_200_000);
  });
});

describe("buildInicio — irregular income", () => {
  it("the month from the counted balance at its start; only received money counts", () => {
    const r = build("2026-10-05", [tx("2026-10-03", 400_000, "INFLOW"), tx("2026-10-04", 100_000)], {
      settings: settings({ schedule: { kind: "irregular" }, incomePerCycle: 1_000_000, savingsPerCycle: 0 }),
      accounts: [{ ...ACCOUNTS[0], currentBalance: 1_000_000 }, ACCOUNTS[1]],
    });
    expect(r.cycle).toMatchObject({ start: "2026-10-01", end: "2026-10-31", irregular: true });
    expect(r.result.disponible).toBe(1_000_000); // 700.000 at the start + 400.000 − 100.000
    expect(r.result.expectedApart).toBe(1_000_000);
    expect(r.view.payday).toBe("Quedan 27 días del mes");
  });
});

describe("buildInicio — verdict memory", () => {
  it("a better state waits 24 h (the stored memo comes back in)", () => {
    const memo = { shown: "cuidado" as const };
    const r = build("2026-10-05", [tx("2026-09-30", 2_100_000, "INFLOW")], { memo });
    expect(r.verdict.raw).toBe("vas_bien");
    expect(r.verdict.state).toBe("cuidado");
    expect(r.verdict.memo.better?.state).toBe("vas_bien");
  });
});

describe("buildInicio — Tu flujo screen", () => {
  it("reads the whole past cycle: its first shaded day is inside Inicio's lookback (monthly, last day of a long month)", () => {
    const today = "2026-08-31";
    const r = build(today, [tx("2026-07-10", 80_000)], {
      settings: settings({ schedule: { kind: "monthly", paydays: [1] }, balanceAnchor: { balance: 900_000, at: "2026-08-03T14:00:00.000Z" } }),
    });
    expect(r.flow.map((t) => t.key)).toEqual(["pasado", "este", "proximo"]);
    expect(r.flow[0].chart.days[0].date >= inicioSince(today)).toBe(true);
    expect(r.flow[0].chart.days.some((d) => d.spent === 80_000)).toBe(true);
    expect(r.flow[2].range).toMatch(/sep/);
  });
});

describe("buildInicio — Pagos (promised money is subtracted before it's paid)", () => {
  const rent = {
    id: "rent", label: "Arriendo", amount: 500_000, direction: "OUTFLOW" as const, frequency: "MONTHLY",
    startDate: "2026-09-20", endDate: null, accountId: null, isActive: true,
  };
  it("a fixed payment due this cycle lowers Disponible now", () => {
    const without = build("2026-09-18", []);
    const withRent = build("2026-09-18", [], { templates: [rent] });
    expect(withRent.result.disponible).toBe(without.result.disponible - 500_000);
    expect(withRent.bills.map((b) => [b.title, b.dueDate, b.status])).toEqual([["Arriendo", "2026-09-20", "pending"]]);
  });

  it("paying it doesn't count twice", () => {
    const pay = tx("2026-09-20", 500_000, "OUTFLOW", { id: "pay" });
    const r = build("2026-09-21", [pay], {
      templates: [rent],
      occurrences: [{ templateId: "rent", date: "2026-09-20", expectedAmount: 500_000, status: "paid", transactionId: "pay", linkedManually: false }],
    });
    const before = build("2026-09-21", [], { templates: [rent] });
    expect(r.result.disponible).toBe(before.result.disponible);
  });
});

describe("buildInicio — Pagos edge cases (review)", () => {
  const bill = (startDate: string, amount = 500_000) => ({
    id: "rent", label: "Arriendo", amount, direction: "OUTFLOW" as const, frequency: "MONTHLY",
    startDate, endDate: null, accountId: null, isActive: true,
  });
  const paid = (date: string, transactionId: string) =>
    [{ templateId: "rent", date, expectedAmount: 500_000, status: "paid" as const, transactionId, linkedManually: false }];

  it("a bill paid with the card is settled now (the card bill carries it later), not subtracted twice", () => {
    const onCard = tx("2026-09-20", 500_000, "OUTFLOW", { id: "c1", accountId: CARD });
    const r = build("2026-09-21", [onCard], { templates: [bill("2026-09-20")], occurrences: paid("2026-09-20", "c1") });
    const baseline = build("2026-09-21", []);
    expect(r.result.disponible).toBe(baseline.result.disponible);
  });

  it("a bill due early in the cycle but paid just before it started is settled", () => {
    // Cycle 30 sep–14 oct; rent due 1 oct, paid 29 sep (previous cycle).
    const early = tx("2026-09-29", 500_000, "OUTFLOW", { id: "p1" });
    const r = build("2026-10-05", [tx("2026-09-30", 2_100_000, "INFLOW"), early], { templates: [bill("2026-09-01")], occurrences: paid("2026-10-01", "p1") });
    const baseline = build("2026-10-05", [tx("2026-09-30", 2_100_000, "INFLOW")]);
    expect(r.result.disponible).toBe(baseline.result.disponible);
  });

  it("a small payment toward the card bill doesn't erase the rest of it", () => {
    const card = { ...ACCOUNTS[1], name: "Tarjeta", cutoffDay: 10, paymentDay: 25 };
    const purchases = [tx("2026-09-05", 500_000, "OUTFLOW", { accountId: CARD })];
    const withBill = build("2026-09-18", purchases, { accounts: [ACCOUNTS[0], { ...card, currentBalance: 500_000 }] });
    const partial = build("2026-09-18", [...purchases, tx("2026-09-17", 10_000, "OUTFLOW", { id: "pay", transferGroupId: "g" }), tx("2026-09-17", 10_000, "INFLOW", { id: "payin", accountId: CARD, transferGroupId: "g" })],
      { accounts: [ACCOUNTS[0], { ...card, currentBalance: 490_000 }] });
    // Paying 10.000 lowers what's left to pay by 10.000; the money left the debit: Disponible doesn't jump up.
    expect(partial.result.porPagar.total).toBe(withBill.result.porPagar.total - 10_000);
  });
});

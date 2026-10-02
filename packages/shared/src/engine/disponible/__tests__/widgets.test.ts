import { describe, expect, it } from "vitest";
import type { PayCycle } from "../cycle";
import { computeDisponible, type Obligation } from "../disponible";
import { toDisponibleMovements, type StoredTransaction } from "../movements";
import {
  applyInicioLayout,
  buildInicioWidgets,
  layoutOf,
  flowChart,
  flowDayView,
  flowScreenView,
  flujoWidget,
  hoyWidget,
  pagoWidget,
  pickAutoOpen,
  tarjetaWidget,
  teDebenWidget,
  ultimosWidget,
  type InicioWidgetsInput,
} from "../widgets";

// Laura's cycle (session 3): 15–29 sep, today 18 sep, $2.100.000 salary,
// bills $1.378.900, $200.000 saved → $421.100 after $100.000 spent.
const TODAY = "2026-09-18";
const CYCLE: PayCycle = {
  start: "2026-09-15", end: "2026-09-29", payday: "2026-09-15", nextPayday: "2026-09-30",
  days: 15, daysLeft: 12, startsOnExpectedDate: false, irregular: false,
};
const DEBIT = "debit";
const BILLS: Obligation[] = [
  { id: "rent", kind: "bill", label: "Arriendo", dueDate: "2026-09-19", amount: 700_000 },
  { id: "nu", kind: "card_bill", label: "Tarjeta Nu", dueDate: "2026-09-22", amount: 640_000, estimated: true },
  { id: "nf", kind: "bill", label: "Netflix", dueDate: "2026-09-24", amount: 38_900 },
];

let n = 0;
function tx(date: string, amount: number, over: Partial<StoredTransaction> = {}): StoredTransaction {
  return { id: `t${++n}`, accountId: DEBIT, date, amount, direction: "OUTFLOW", currencyCode: "COP", flowClass: null, ...over };
}

function input(spends: StoredTransaction[], over: Partial<InicioWidgetsInput> = {}, obligations = BILLS): InicioWidgetsInput {
  const salary = tx("2026-09-15", 2_100_000, { direction: "INFLOW" });
  const transactions = [salary, ...spends];
  const movements = toDisponibleMovements({ transactions, accounts: [{ id: DEBIT, accountType: "CHECKING" }] })
    .map((m) => (m.id === salary.id ? { ...m, kind: "salary" as const, expectedIncomeId: "salary" } : m));
  const result = computeDisponible({
    cycle: CYCLE, today: TODAY,
    accounts: [{ id: DEBIT, countsInDisponible: true }],
    expectedIncomes: [{ id: "salary", label: "Salario", amount: 2_100_000, expectedDate: "2026-09-15" }],
    movements, obligations, savingsTarget: 200_000,
  });
  return {
    today: TODAY, cycle: CYCLE, result, movements, counted: new Set([DEBIT]), transactions, obligations,
    balances: [{ accountId: DEBIT, balance: 2_000_000 }],
    ...over,
  };
}

describe("Hoy", () => {
  it("normal: what's left of this morning's per-day, bar = share spent", () => {
    const w = hoyWidget(input([tx("2026-09-17", 87_000), tx(TODAY, 13_000)]));
    // (421.100 + 13.000) / 12 → $36.100 this morning.
    expect(w.value).toBe("$23.100");
    expect(w.visual).toEqual({ kind: "bar", percent: 36, level: null });
    expect(w.attention).toBeNull();
    expect(w.lead).toBe("Llevas $13.000 de $36.100 hoy.");
    expect(w.rows).toHaveLength(1);
  });

  it("amber at 85% of today's allowance", () => {
    const w = hoyWidget(input([tx("2026-09-17", 67_000), tx(TODAY, 33_000)]));
    expect(w.attention).toEqual({ level: "amber", reason: "Casi al tope" });
    expect(w.visual).toMatchObject({ percent: 87, level: "amber" });
  });

  it("red above today's allowance, value negative", () => {
    const w = hoyWidget(input([tx("2026-09-17", 59_000), tx(TODAY, 41_000)]));
    expect(w.attention).toEqual({ level: "red", reason: "Te pasaste hoy" });
    expect(w.value).toBe("−$2.500");
    expect(w.visual).toMatchObject({ percent: 100, level: "red" });
    expect(w.lead).toBe("Llevas $41.000 de $38.500. Mañana tendrás un poco menos por día.");
  });

  it("empty day: the whole allowance, no bar", () => {
    const w = hoyWidget(input([]));
    expect(w.value).toBe("$43.400"); // 521.100 / 12, down to $100
    expect(w.visual).toMatchObject({ percent: 0 });
  });
});

describe("Tu flujo", () => {
  it("normal: no alert, totals end above zero at today's pace", () => {
    const w = flujoWidget(input([tx("2026-09-16", 100_000)]));
    expect(w.attention).toBeNull();
    expect(w.lead).toBeNull();
    // pace 100.000 / 4 days = 25.000; 11 days after today → 421.100 − 275.000.
    expect(w.totals.map((t) => t.amount)).toEqual(["$2.100.000", "$1.953.900", "$146.100"]);
  });

  it("chart: the cycle ± 2 shaded days, today's balance, bills on their dates, salary expected on payday", () => {
    const c = flowChart(input([tx("2026-09-16", 100_000)], { balanceToday: 2_000_000, nextIncome: 2_100_000 }));
    expect(c.days).toHaveLength(19); // 13 sep … 1 oct
    expect(c.days[0]).toMatchObject({ date: "2026-09-13", edge: true });
    expect(c.days[18]).toMatchObject({ date: "2026-10-01", edge: true });
    expect(c.todayIndex).toBe(5);
    expect(c.days[5].balance).toBe(2_000_000);
    expect(c.days[2]).toMatchObject({ date: "2026-09-15", income: 2_100_000 });
    expect(c.days[3]).toMatchObject({ date: "2026-09-16", spent: 100_000 });
    // Before the salary the balance is backed out of what moved since.
    expect(c.days[1].balance).toBe(0);
    expect(c.days[6]).toMatchObject({ date: "2026-09-19", bill: 700_000, estimated: 25_000, balance: 1_275_000 });
    expect(c.days[17]).toMatchObject({ date: "2026-09-30", incomeExpected: 2_100_000 });
    expect(c.bad).toBe(false);
    expect(c.days[c.markIndex].date).toBe("2026-09-29"); // lowest point before payday
  });

  it("a selected day reads as its date, end-of-day balance and items", () => {
    const c = flowChart(input([tx("2026-09-16", 100_000, { description: "Éxito" })], { balanceToday: 2_000_000, nextIncome: 2_100_000 }));
    const past = flowDayView(c.days[3], TODAY);
    expect(past).toMatchObject({ label: "Mié 16 sep", projected: false });
    expect(past.items).toEqual([{ id: expect.any(String), title: "Éxito", detail: "Hecho", amount: "−$100.000" }]);
    expect(flowDayView(c.days[5], TODAY).label).toBe("Vie 18 sep · hoy");
    const rent = flowDayView(c.days[6], TODAY);
    expect(rent.balance).toBe("≈\u00a0$1.275.000");
    expect(rent.items.map((x) => `${x.title}|${x.detail}|${x.amount}`)).toEqual([
      "Arriendo|Pendiente|−$700.000", "Gasto diario estimado|Tu ritmo habitual|−$25.000",
    ]);
    expect(flowDayView(c.days[17], TODAY).items[0]).toMatchObject({ title: "Salario", detail: "Esperado", amount: "$2.100.000" });
  });

  it("red: the day the balance runs out (bills on their dates) and the per-day cut", () => {
    const w = flujoWidget(input([tx("2026-09-17", 400_000)]));
    // $1.721.100 left today; Arriendo (19) and Tarjeta Nu (22) plus $100.000 a day empty it on the 22nd.
    expect(w.attention).toEqual({ level: "red", reason: "No llegas al 30" });
    expect(w.lead).toBe("A tu ritmo te quedas sin plata el 22 sep · gasta ≈\u00a0$89.000 menos al día.");
    expect((w.visual as { bad: boolean }).bad).toBe(true);
  });

  it("already below zero today: runs out today", () => {
    const w = flujoWidget(input([tx("2026-09-17", 600_000)], { balanceToday: -20_000 }));
    expect(w.lead).toMatch(/^A tu ritmo te quedas sin plata hoy · gasta/);
  });
});

describe("Tu flujo screen", () => {
  const CYCLES = {
    prev: { ...CYCLE, start: "2026-08-30", end: "2026-09-14", payday: "2026-08-30", nextPayday: "2026-09-15", days: 16, daysLeft: 0 },
    next: { ...CYCLE, start: "2026-09-30", end: "2026-10-14", payday: "2026-09-30", nextPayday: "2026-10-15", days: 15, daysLeft: 15 },
  };
  const screen = (spends: StoredTransaction[], obligations = BILLS) =>
    flowScreenView(input(spends, { balanceToday: 2_000_000, nextIncome: 2_100_000, cycles: CYCLES }, obligations));

  it("three cycles; Este ciclo has the widget's totals", () => {
    const tabs = screen([tx("2026-09-16", 100_000)]);
    expect(tabs.map((t) => `${t.label}|${t.range}|${t.status}`)).toEqual([
      "Pasado|30 ago – 14 sep|Terminado", "Este ciclo|15 – 29 sep|Quedan 12 días", "Próximo|30 sep – 14 oct|Empieza el 30 sep",
    ]);
    const w = flujoWidget(input([tx("2026-09-16", 100_000)]));
    expect(tabs[1].totals.map((t) => t.amount)).toEqual(w.totals.map((t) => t.amount));
    expect(tabs[1].nextShort).toBeNull();
  });

  it("past: all solid, no mark, the balance backed out of what moved", () => {
    const [pasado] = screen([tx("2026-09-05", 50_000), tx("2026-09-16", 100_000)]);
    const c = pasado.chart;
    expect(c.days[0].date).toBe("2026-08-28");
    expect(c.todayIndex).toBeGreaterThanOrEqual(c.days.length);
    expect(c.markIndex).toBe(-1);
    expect(c.days.filter((d) => d.edge).map((d) => d.date)).toEqual(["2026-08-28", "2026-08-29", "2026-09-15", "2026-09-16"]);
    // 2.000.000 today, + 100.000 spent on the 16th, − 2.100.000 salary on the 15th.
    expect(c.days.find((d) => d.date === "2026-09-14")!.balance).toBe(0);
    expect(c.days.find((d) => d.date === "2026-09-04")!.balance).toBe(50_000);
    expect(pasado.totals.map((t) => `${t.label} ${t.amount}`)).toEqual(["Llegó $0", "Salió $50.000", "Terminaste con $0"]);
  });

  it("next: all projected, its salary and the one after on the shaded edge", () => {
    const proximo = screen([tx("2026-09-16", 100_000)])[2];
    const c = proximo.chart;
    expect(c.todayIndex).toBeLessThan(0);
    expect(c.days[2]).toMatchObject({ date: "2026-09-30", incomeExpected: 2_100_000, edge: false });
    expect(c.days[17]).toMatchObject({ date: "2026-10-15", incomeExpected: 2_100_000, edge: true });
    expect(c.days[3].estimated).toBe(25_000);
    // 146.100 left + 2.100.000 − (15 × 25.000 + 200.000 saved).
    expect(proximo.totals.map((t) => t.amount)).toEqual(["$2.100.000", "$575.000", "$1.671.100"]);
  });

  it("amber: a big bill next cycle warns now, with the per-day amount to set aside", () => {
    const tabs = screen([tx("2026-09-16", 100_000)], [...BILLS,
      { id: "mat", kind: "bill", label: "Matrícula", dueDate: "2026-10-09", amount: 3_000_000 }]);
    // 146.100 + 2.100.000 − (3.000.000 + 375.000 + 200.000) = −1.328.900; ÷ 12 days, up to $100.
    expect(tabs[1].nextShort).toEqual({
      title: "El próximo ciclo no alcanza por ≈\u00a0$1.328.900 (Matrícula, 9 oct)",
      body: "Si apartas $110.800 al día desde hoy, llegas.",
    });
    expect(tabs[2].totals[2]).toMatchObject({ amount: "−$1.328.900", bad: true });
    expect(tabs[2].chart.bad).toBe(true);
  });

  it("red: this cycle runs out, with the cut that gets you to payday", () => {
    const este = flowScreenView(input([tx("2026-09-17", 400_000)], { cycles: CYCLES }))[1];
    expect(este.runOut).toEqual({
      title: "A tu ritmo te quedas sin plata el 22 sep",
      body: "Gasta ≈\u00a0$89.000 menos al día y llegas al 30.",
    });
    expect(este.totals[2].bad).toBe(true);
  });

  it("without the cycles around it, only Este ciclo", () => {
    expect(flowScreenView(input([])).map((t) => t.key)).toEqual(["este"]);
  });
});

describe("Próximo pago", () => {
  it("amber when the next bill is due tomorrow", () => {
    const w = pagoWidget(input([tx("2026-09-17", 100_000)]));
    expect(w.value).toBe("$700.000");
    expect(w.hint).toBe("Arriendo, 19 sep");
    expect(w.attention).toEqual({ level: "amber", reason: "Mañana" });
    expect(w.lead).toBe("Por pagar antes del 30: $1.378.900");
    expect(w.rows.map((r) => [r.title, r.amount, r.level])).toEqual([
      ["Arriendo", "$700.000", "amber"],
      ["Tarjeta Nu", "≈\u00a0$640.000", null],
      ["Netflix", "$38.900", null],
    ]);
  });

  it("red when the counted balance won't cover it", () => {
    const w = pagoWidget(input([], { balances: [{ accountId: DEBIT, balance: 500_000 }] }));
    expect(w.attention).toEqual({ level: "red", reason: "No alcanza" });
    expect(w.rows[0].level).toBe("red");
  });

  it("nothing due this cycle but a bill coming next: says so, doesn't ask to add bills", () => {
    const w = pagoWidget(input([], {}, [{ id: "r", kind: "bill", label: "Arriendo", dueDate: "2026-10-05", amount: 700_000 }]));
    expect(w).toMatchObject({ empty: false, value: null, hint: "Nada antes del 30", lead: "Lo siguiente: Arriendo, 5 oct, $700.000", seeAll: "see_bills" });
    expect(w.actions).toEqual([]);
  });

  it("empty: no bills on the phone yet", () => {
    const w = pagoWidget(input([], {}, []));
    expect(w).toMatchObject({ empty: true, value: null, hint: "Sin pagos aún", attention: null });
  });
});

describe("Te deben", () => {
  const people = [
    { id: "a", name: "Ana", amount: 60_000, since: "2026-09-15" },
    { id: "j", name: "Juan", amount: 180_000, since: "2026-08-15" },
    { id: "c", name: "Caro", amount: 140_000, since: "2026-09-06" },
  ];

  it("total + initials, oldest first; amber at 30 days", () => {
    const w = teDebenWidget(input([], { people, youOwe: [{ name: "Mateo", amount: 50_000 }] }));
    expect(w.value).toBe("$380.000");
    expect(w.visual).toEqual({ kind: "initials", letters: ["J", "C", "A"] });
    expect(w.attention).toEqual({ level: "amber", reason: "Hace 34 días" });
    expect(w.rows.map((r) => r.detail)).toEqual(["Hace 34 días", "Hace 12 días", "Hace 3 días"]);
    expect(w.note).toBe("Tú le debes a Mateo $50.000 · está en Pagos.");
  });

  it("red at 60 days; long amounts keep every digit", () => {
    const w = teDebenWidget(input([], { people: [{ id: "x", name: "Xi", amount: 14_250_000, since: "2026-07-20" }] }));
    expect(w.attention).toEqual({ level: "red", reason: "Hace 60 días" });
    expect(w.value).toBe("$14.250.000");
    expect(w.valueShort).toBe("$14,3 M");
  });

  it("empty", () => {
    expect(teDebenWidget(input([]))).toMatchObject({ empty: true, hint: "Nadie te debe", visual: null });
  });
});

describe("Tarjeta", () => {
  const card = { accountId: "nu", name: "Tarjeta Nu", estimatedBill: 480_000, projectedAtCut: 620_000, usedPercent: 37, cutDate: "2026-09-20", dueDate: "2026-09-22", minimum: 640_000, totalOwed: 1_850_000 };

  it("estimated bill + credit used; amber 2 days before the cut", () => {
    const w = tarjetaWidget(input([]), card);
    expect(w).toMatchObject({ id: "tarjeta:nu", title: "Tarjeta Nu", value: "≈\u00a0$480.000", hint: "próxima factura" });
    expect(w.visual).toEqual({ kind: "bar", percent: 37, level: null });
    expect(w.attention).toEqual({ level: "amber", reason: "Corte en 2 días" });
    expect(w.lead).toBe("≈\u00a0$480.000 · al corte ≈\u00a0$620.000 si sigues a este ritmo. Comprar con tarjeta no baja tu Disponible; pagarla sí.");
    expect(w.rows.map((r) => r.title)).toEqual(["Pago mínimo", "Debes en total"]);
  });

  it("red on the due date", () => {
    expect(tarjetaWidget(input([]), { ...card, dueDate: TODAY }).attention).toEqual({ level: "red", reason: "Pago vence hoy" });
  });
});

describe("Últimos movimientos", () => {
  it("newest first by capture time; 3 collapsed, 5 expanded", () => {
    const rows = [
      tx("2026-09-17", 64_000, { description: "Éxito", createdAt: "2026-09-17T20:00:00.000Z" }),
      tx(TODAY, 8_000, { description: "Tostao", createdAt: "2026-09-18T13:10:00.000Z" }),
      tx(TODAY, 32_000, { description: "Rappi", createdAt: "2026-09-18T17:41:00.000Z" }),
      tx("2026-09-16", 5_000, { description: "Uber" }),
    ];
    const w = ultimosWidget(input(rows));
    expect(w.previewRows.map((r) => `${r.title}|${r.detail}|${r.amount}`)).toEqual([
      "Rappi|Hoy · 12:41|−$32.000",
      "Tostao|Hoy · 8:10|−$8.000",
      "Éxito|Ayer · 15:00|−$64.000",
    ]);
    expect(w.rows).toHaveLength(5); // + Uber + the salary
    expect(w.rows[4]).toMatchObject({ title: "Ingreso", amount: "$2.100.000", detail: "15 sep" });
  });

  it("excluded rows never show", () => {
    const w = ultimosWidget(input([tx(TODAY, 9_000, { isExcluded: true, description: "Oculto" })]));
    expect(w.rows.map((r) => r.title)).not.toContain("Oculto");
  });
});

describe("empty states offer actions", () => {
  it("no cards: an empty Tarjeta with ways to add one; empty Próximo pago and Te deben too", () => {
    const ws = buildInicioWidgets(input([], {}, []));
    const byKey = Object.fromEntries(ws.map((w) => [w.key, w]));
    expect(byKey.tarjeta).toMatchObject({ id: "tarjeta", empty: true, hint: "Sin tarjetas aún" });
    expect(byKey.tarjeta.actions.map((a) => a.id)).toEqual(["add_card", "import_statement"]);
    expect(byKey.pago.actions.map((a) => a.id)).toEqual(["add_bill", "import_statement"]);
    expect(byKey.teDeben.actions.map((a) => a.id)).toEqual(["split_purchase", "lend"]);
    expect(byKey.hoy.seeAll).toBe("see_movements");
  });
});

describe("Organizar", () => {
  const ws = () => buildInicioWidgets(input([tx("2026-09-17", 100_000)]));

  it("no layout: the default", () => {
    expect(applyInicioLayout(ws(), null).map((w) => w.id)).toEqual(ws().map((w) => w.id));
  });

  it("order, sizes and hidden widgets; unknown widgets keep their default place at the end", () => {
    const out = applyInicioLayout(ws(), {
      items: [{ id: "pago", size: "full" }, { id: "hoy", size: "full" }, { id: "flujo", size: "half" }],
      hidden: ["teDeben"],
    });
    expect(out.map((w) => `${w.id}:${w.size}`)).toEqual([
      "pago:full", "hoy:half", "flujo:half", "tarjeta:half", "ultimos:full",
    ]);
    // A full Próximo pago shows its next rows collapsed.
    expect(out[0].previewRows.map((r) => r.title)).toEqual(["Arriendo", "Tarjeta Nu", "Netflix"]);
  });

  it("round-trips through layoutOf", () => {
    const out = applyInicioLayout(ws(), { items: [{ id: "ultimos", size: "full" }], hidden: ["hoy"] });
    expect(applyInicioLayout(ws(), layoutOf(out, ["hoy"])).map((w) => w.id)).toEqual(out.map((w) => w.id));
  });
});

describe("grid and auto-open", () => {
  it("default layout: Tu flujo · Hoy, Próximo pago · Te deben, cards · Últimos", () => {
    const ws = buildInicioWidgets(input([], { cards: [{ accountId: "nu", name: "Tarjeta Nu", estimatedBill: 1 }] }));
    expect(ws.map((w) => `${w.id}:${w.size}`)).toEqual([
      "flujo:full", "hoy:half", "pago:half", "teDeben:half", "tarjeta:nu:half", "ultimos:full",
    ]);
  });

  it("opens the most critical once a day: red before amber, then layout order", () => {
    const ws = buildInicioWidgets(input([tx("2026-09-17", 59_000), tx(TODAY, 41_000)]));
    // Hoy is red, Próximo pago amber.
    expect(pickAutoOpen(ws, null, TODAY)).toBe("hoy");
    expect(pickAutoOpen(ws, "2026-09-17", TODAY)).toBe("hoy");
    expect(pickAutoOpen(ws, TODAY, TODAY)).toBeNull();
    const calm = buildInicioWidgets(input([], {}, []));
    expect(pickAutoOpen(calm, null, TODAY)).toBeNull();
  });
});

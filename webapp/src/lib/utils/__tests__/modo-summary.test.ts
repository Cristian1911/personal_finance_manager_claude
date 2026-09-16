import { describe, expect, it } from "vitest";
import {
  summarizeModo,
  filterSharedGroupsByOrigin,
  settleUpByPerson,
  summarizeShared,
  summarizeSpendSplit,
  isModoSpend,
  classifyModoTx,
  describeModoTx,
  assignTransactionsToModos,
  findModoForTags,
  modoOverlapsWindow,
  modoDatePosition,
  isModoOngoing,
} from "@/lib/utils/modo-summary";
import type { ModoTxRow } from "@/lib/utils/modo-summary";
import type { SharedPaymentGroup } from "@/types/domain";

const cat = (id: string, name: string) => ({ id, name, name_es: name, color: "#fff" });

const txs: ModoTxRow[] = [
  { id: "t1", amount: 100, direction: "OUTFLOW", transaction_date: "2026-07-02", category: cat("c1", "Comida") },
  { id: "t2", amount: 50, direction: "OUTFLOW", transaction_date: "2026-07-01", category: cat("c1", "Comida") },
  { id: "t3", amount: 200, direction: "OUTFLOW", transaction_date: "2026-07-04", category: cat("c2", "Hotel") },
  { id: "t4", amount: 999, direction: "INFLOW", transaction_date: "2026-07-03", category: null },
];

describe("summarizeModo", () => {
  it("suma solo OUTFLOW y cuenta esas tx", () => {
    const s = summarizeModo(txs);
    expect(s.total).toBe(350);
    expect(s.count).toBe(3);
    expect(s.currency).toBe("COP");
    expect(s.totals).toEqual([{ currency: "COP", total: 350, count: 3 }]);
  });
  it("calcula rango observado (min/max) sobre OUTFLOW", () => {
    const s = summarizeModo(txs);
    expect(s.observedFrom).toBe("2026-07-01");
    expect(s.observedTo).toBe("2026-07-04");
  });
  it("agrupa por categoría ordenado desc por total", () => {
    const s = summarizeModo(txs);
    expect(s.byCategory.map((b) => [b.name, b.total])).toEqual([
      ["Hotel", 200],
      ["Comida", 150],
    ]);
  });
  it("maneja lista vacía", () => {
    const s = summarizeModo([]);
    expect(s).toEqual({
      currency: "COP",
      total: 0,
      count: 0,
      totals: [],
      observedFrom: null,
      observedTo: null,
      byCategory: [],
    });
  });
  it("no mezcla monedas: totales por moneda, la principal es la de más filas", () => {
    const multi: ModoTxRow[] = [
      { id: "a", amount: 10, direction: "OUTFLOW", transaction_date: "2026-07-01", currency_code: "USD", category: cat("c1", "Comida") },
      { id: "b", amount: 20, direction: "OUTFLOW", transaction_date: "2026-07-02", currency_code: "USD", category: cat("c2", "Hotel") },
      { id: "c", amount: 90000, direction: "OUTFLOW", transaction_date: "2026-07-02", currency_code: "COP", category: cat("c1", "Comida") },
    ];
    const s = summarizeModo(multi);
    expect(s.currency).toBe("USD");
    expect(s.total).toBe(30);
    expect(s.count).toBe(3);
    expect(s.totals).toEqual([
      { currency: "USD", total: 30, count: 2 },
      { currency: "COP", total: 90000, count: 1 },
    ]);
    expect(s.byCategory.map((b) => [b.currency, b.name, b.total])).toEqual([
      ["USD", "Hotel", 20],
      ["USD", "Comida", 10],
      ["COP", "Comida", 90000],
    ]);
  });
  it("excluye transferencias, excluidas y movimientos de deuda personal", () => {
    const rows: ModoTxRow[] = [
      { id: "a", amount: 10, direction: "OUTFLOW", transaction_date: "2026-07-01", category: null, transfer_group_id: "tg" },
      { id: "b", amount: 20, direction: "OUTFLOW", transaction_date: "2026-07-01", category: null, is_excluded: true },
      { id: "c", amount: 30, direction: "OUTFLOW", transaction_date: "2026-07-01", category: null, personal_debt_id: "pd" },
      { id: "d", amount: 40, direction: "OUTFLOW", transaction_date: "2026-07-01", category: null, split_group_id: "sg" },
    ];
    expect(rows.map(isModoSpend)).toEqual([false, false, false, true]);
    const s = summarizeModo(rows);
    expect(s.total).toBe(40);
    expect(s.count).toBe(1);
  });
});

describe("classifyModoTx / describeModoTx", () => {
  it("clasifica por prioridad transferencia > persona > excluido > ingreso > gasto", () => {
    expect(classifyModoTx({ id: "1", amount: 1, direction: "OUTFLOW", transaction_date: "d", category: null, transfer_group_id: "x" })).toBe("transfer");
    expect(classifyModoTx({ id: "1", amount: 1, direction: "INFLOW", transaction_date: "d", category: null, personal_debt_id: "x" })).toBe("person");
    expect(classifyModoTx({ id: "1", amount: 1, direction: "OUTFLOW", transaction_date: "d", category: null, is_excluded: true })).toBe("excluded");
    expect(classifyModoTx({ id: "1", amount: 1, direction: "INFLOW", transaction_date: "d", category: null })).toBe("inflow");
    expect(classifyModoTx({ id: "1", amount: 1, direction: "OUTFLOW", transaction_date: "d", category: null })).toBe("spend");
  });
  it("titula con comercio, luego descripción, luego categoría", () => {
    const base: ModoTxRow = { id: "1", amount: 1, direction: "OUTFLOW", transaction_date: "d", category: cat("c", "Comida") };
    expect(describeModoTx({ ...base, merchant_name: "Café Tortoni", raw_description: "CAFE TORT" })).toBe("Café Tortoni");
    expect(describeModoTx({ ...base, clean_description: "Cena", raw_description: "CENA 123" })).toBe("Cena");
    expect(describeModoTx({ ...base, raw_description: "  CENA 123 " })).toBe("CENA 123");
    expect(describeModoTx(base)).toBe("Comida");
    expect(describeModoTx({ ...base, category: null })).toBe("Movimiento");
  });
});

describe("filterSharedGroupsByOrigin", () => {
  it("mantiene solo grupos cuyo origin_transaction_id está en el set", () => {
    const groups = [
      { split_group_id: "g1", debts: [{ origin_transaction_id: "t1" }] },
      { split_group_id: "g2", debts: [{ origin_transaction_id: "tX" }] },
    ] as unknown as import("@/types/domain").SharedPaymentGroup[];
    const out = filterSharedGroupsByOrigin(groups, ["t1", "t2"]);
    expect(out.map((g) => g.split_group_id)).toEqual(["g1"]);
  });
});

describe("filterSharedGroupsByOrigin con cuotas", () => {
  it("también empareja por split_group_id cuando el origen no está en el viaje", () => {
    const groups = [
      { split_group_id: "sg-cuotas", installment_group_id: "ig1", debts: [{ origin_transaction_id: "cuota1-fuera" }] },
      { split_group_id: "sg-otro", debts: [{ origin_transaction_id: "tX" }] },
    ] as unknown as SharedPaymentGroup[];
    const out = filterSharedGroupsByOrigin(groups, ["cuota3"], ["sg-cuotas", null]);
    expect(out.map((g) => g.split_group_id)).toEqual(["sg-cuotas"]);
  });
});

describe("summarizeSpendSplit con una compra a cuotas compartida", () => {
  it("cuenta las cuotas que están en el viaje y tu parte proporcional, no la compra entera", () => {
    const rows: ModoTxRow[] = [
      { id: "c1", amount: 100, direction: "OUTFLOW", transaction_date: "d", category: null, split_group_id: "sg", installment_current: 1, installment_total: 24 },
      { id: "c2", amount: 100, direction: "OUTFLOW", transaction_date: "d", category: null, split_group_id: "sg", installment_current: 2, installment_total: 24 },
      { id: "own", amount: 50, direction: "OUTFLOW", transaction_date: "d", category: null },
    ];
    // Whole purchase: total 2400 (precio + interés), user keeps half.
    const shared = [
      { currency: "COP", sharedTotal: 2400, userShare: 1200, owedToUser: 1200, recovered: 0, outstanding: 1200, count: 1 },
    ];
    const groupsBySplit = new Map([
      ["sg", { split_group_id: "sg", total: 2400, userShare: 1200, installment_total: 24 } as unknown as SharedPaymentGroup],
    ]);
    const [cop] = summarizeSpendSplit(rows, shared, groupsBySplit);
    expect(cop).toMatchObject({ spendTotal: 250, sharedTotal: 200, sharedCount: 2, ownOnlyTotal: 50, ownOnlyCount: 1, yourPart: 150, owedToUser: 1200 });
  });

  it("sin el mapa de grupos conserva el cálculo anterior", () => {
    const rows: ModoTxRow[] = [
      { id: "a", amount: 100, direction: "OUTFLOW", transaction_date: "d", category: null, split_group_id: "g1" },
    ];
    const [cop] = summarizeSpendSplit(rows, [{ currency: "COP", sharedTotal: 100, userShare: 40, owedToUser: 60, recovered: 0, outstanding: 60, count: 1 }]);
    expect(cop.yourPart).toBe(40);
  });
});

describe("summarizeShared", () => {
  it("agrega por moneda solo los grupos del modo", () => {
    const groups = [
      { split_group_id: "g1", currency_code: "COP", total: 100, userShare: 50, recovered: 20, outstanding_total: 30, debts: [{ origin_transaction_id: "t1" }] },
      { split_group_id: "g2", currency_code: "COP", total: 60, userShare: 30, recovered: 0, outstanding_total: 30, debts: [{ origin_transaction_id: "t2" }] },
      { split_group_id: "g3", currency_code: "USD", total: 10, userShare: 5, recovered: 5, outstanding_total: 0, debts: [{ origin_transaction_id: "t3" }] },
      { split_group_id: "g4", currency_code: "COP", total: 999, userShare: 1, recovered: 0, outstanding_total: 998, debts: [{ origin_transaction_id: "fuera" }] },
    ] as unknown as SharedPaymentGroup[];
    const res = summarizeShared(groups, ["t1", "t2", "t3"]);
    expect(res).toEqual([
      { currency: "COP", sharedTotal: 160, userShare: 80, owedToUser: 80, recovered: 20, outstanding: 60, count: 2 },
      { currency: "USD", sharedTotal: 10, userShare: 5, owedToUser: 5, recovered: 5, outstanding: 0, count: 1 },
    ]);
  });
});

describe("summarizeSpendSplit", () => {
  it("separa lo compartido de lo solo mío y calcula tu parte real", () => {
    const rows: ModoTxRow[] = [
      { id: "a", amount: 100, direction: "OUTFLOW", transaction_date: "d", category: null, split_group_id: "g1" },
      { id: "b", amount: 60, direction: "OUTFLOW", transaction_date: "d", category: null, split_group_id: "g2" },
      { id: "c", amount: 40, direction: "OUTFLOW", transaction_date: "d", category: null },
      { id: "usd", amount: 10, direction: "OUTFLOW", transaction_date: "d", category: null, currency_code: "USD" },
    ];
    const shared = [
      { currency: "COP", sharedTotal: 160, userShare: 80, owedToUser: 80, recovered: 20, outstanding: 60, count: 2 },
    ];
    const res = summarizeSpendSplit(rows, shared);
    expect(res).toHaveLength(2);
    const cop = res.find((r) => r.currency === "COP")!;
    expect(cop).toMatchObject({ spendTotal: 200, spendCount: 3, sharedTotal: 160, sharedCount: 2, ownOnlyTotal: 40, ownOnlyCount: 1, yourPart: 120, outstanding: 60 });
    const usd = res.find((r) => r.currency === "USD")!;
    expect(usd).toMatchObject({ spendTotal: 10, sharedCount: 0, ownOnlyTotal: 10, yourPart: 10, outstanding: 0 });
  });
});

describe("settleUpByPerson", () => {
  const groups = [
    { split_group_id: "g1", debts: [
      { destinatario_id: "p1", destinatario_name: "Estefa", principal_amount: 100, outstanding_amount: 60, total_repaid: 40, status: "active", origin_transaction_id: "tx1", id: "d1" },
    ] },
    { split_group_id: "g2", debts: [
      { destinatario_id: "p1", destinatario_name: "Estefa", principal_amount: 50, outstanding_amount: 0, status: "settled", origin_transaction_id: "tx2", id: "d2" },
    ] },
    { split_group_id: "g3", debts: [
      { destinatario_id: "p2", destinatario_name: "Ana", principal_amount: 30, outstanding_amount: 30, status: "active", origin_transaction_id: "txZ", id: "d3" },
    ] },
  ] as unknown as SharedPaymentGroup[];

  it("agrega pendiente por persona solo de tx del modo", () => {
    const res = settleUpByPerson(groups, ["tx1", "tx2"]); // txZ fuera del modo
    expect(res).toHaveLength(1);
    expect(res[0].destinatarioId).toBe("p1");
    expect(res[0].principal).toBe(150);
    expect(res[0].outstanding).toBe(60);
    expect(res[0].count).toBe(2);
    // 40 abonados de la activa + 50 de la saldada
    expect(res[0].repaid).toBe(90);
    expect(res[0].oldestActiveDebtId).toBe("d1");
    // tope del abono = saldo de ESA deuda, no el agregado (evita sobre-abono)
    expect(res[0].oldestActiveDebtOutstanding).toBe(60);
  });

  it("ordena por pendiente desc e incluye varias personas", () => {
    const res = settleUpByPerson(groups, ["tx1", "txZ"]);
    expect(res.map((r) => r.destinatarioId)).toEqual(["p1", "p2"]);
  });

  it("no mezcla monedas: una fila por persona+moneda", () => {
    const multi = [
      { split_group_id: "g1", debts: [
        { destinatario_id: "p1", destinatario_name: "Estefa", currency_code: "COP", principal_amount: 100, outstanding_amount: 100, status: "active", origin_transaction_id: "tx1", id: "d1", opened_on: "2026-07-01" },
      ] },
      { split_group_id: "g2", debts: [
        { destinatario_id: "p1", destinatario_name: "Estefa", currency_code: "USD", principal_amount: 20, outstanding_amount: 20, status: "active", origin_transaction_id: "tx2", id: "d2", opened_on: "2026-07-02" },
      ] },
    ] as unknown as SharedPaymentGroup[];
    const res = settleUpByPerson(multi, ["tx1", "tx2"]);
    expect(res).toHaveLength(2);
    expect(res.map((r) => r.currency).sort()).toEqual(["COP", "USD"]);
    // cada fila mantiene su propio saldo, sin sumar COP+USD
    expect(res.find((r) => r.currency === "COP")!.outstanding).toBe(100);
    expect(res.find((r) => r.currency === "USD")!.outstanding).toBe(20);
  });

  it("elige la deuda activa más antigua (opened_on) como objetivo del abono", () => {
    const g = [
      { split_group_id: "gA", debts: [
        { destinatario_id: "p1", destinatario_name: "Estefa", currency_code: "COP", principal_amount: 100, outstanding_amount: 100, status: "active", origin_transaction_id: "txA", id: "dNew", opened_on: "2026-07-05" },
      ] },
      { split_group_id: "gB", debts: [
        { destinatario_id: "p1", destinatario_name: "Estefa", currency_code: "COP", principal_amount: 100, outstanding_amount: 40, status: "active", origin_transaction_id: "txB", id: "dOld", opened_on: "2026-07-01" },
      ] },
    ] as unknown as SharedPaymentGroup[];
    const res = settleUpByPerson(g, ["txA", "txB"]);
    expect(res).toHaveLength(1);
    expect(res[0].outstanding).toBe(140);
    expect(res[0].oldestActiveDebtId).toBe("dOld");
    expect(res[0].oldestActiveDebtOutstanding).toBe(40);
  });
});

describe("assignTransactionsToModos", () => {
  const modos = [
    { id: "m1", date_from: "2026-07-01", date_to: "2026-07-05", tag_ids: ["tagA"] },
    { id: "m2", date_from: "2026-07-03", date_to: "2026-07-10", tag_ids: ["tagA", "tagB"] },
    { id: "m3", date_from: "2026-07-01", date_to: "2026-07-10", tag_ids: [] },
  ];
  const tagRows = [
    { transaction_id: "t1", tag_id: "tagA" },
    { transaction_id: "t2", tag_id: "tagB" },
    { transaction_id: "t3", tag_id: "tagA" },
    { transaction_id: "t3", tag_id: "tagB" },
  ];
  const rows = [
    { id: "t1", transaction_date: "2026-07-02" },
    { id: "t2", transaction_date: "2026-07-04" },
    { id: "t3", transaction_date: "2026-07-09" },
    { id: "t4", transaction_date: "2026-07-04" }, // sin etiqueta
  ];
  it("aplica tags OR por modo sin mirar la fecha (un vuelo pagado antes cuenta), sin duplicar", () => {
    const out = assignTransactionsToModos(modos, tagRows, rows);
    expect(out.get("m1")!.map((t) => t.id)).toEqual(["t1", "t3"]);
    expect(out.get("m2")!.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
    expect(out.get("m3")).toEqual([]);
  });
});

describe("findModoForTags", () => {
  const modos = [
    { id: "old", tag_ids: ["a"], date_from: "2026-01-01" },
    { id: "new", tag_ids: ["a"], date_from: "2026-06-01" },
    { id: "both", tag_ids: ["a", "b"], date_from: "2025-01-01" },
  ];
  it("prefiere el mayor solape y, en empate, el más reciente", () => {
    expect(findModoForTags(modos, ["a", "b"])?.id).toBe("both");
    expect(findModoForTags(modos, ["a"])?.id).toBe("new");
    expect(findModoForTags(modos, ["zzz"])).toBeNull();
    expect(findModoForTags(modos, [])).toBeNull();
  });
});

describe("rangos", () => {
  it("modoOverlapsWindow es inclusivo en ambos extremos", () => {
    const m = { date_from: "2026-07-01", date_to: "2026-07-05" };
    expect(modoOverlapsWindow(m, "2026-07-05", "2026-08-01")).toBe(true);
    expect(modoOverlapsWindow(m, "2026-06-01", "2026-07-01")).toBe(true);
    expect(modoOverlapsWindow(m, "2026-07-06", "2026-08-01")).toBe(false);
  });
  it("modoDatePosition ubica una fila respecto a las fechas del viaje", () => {
    const m = { date_from: "2026-07-01", date_to: "2026-07-05" };
    expect(modoDatePosition("2026-05-20", m)).toBe("before");
    expect(modoDatePosition("2026-07-03", m)).toBe("during");
    expect(modoDatePosition("2026-07-09", m)).toBe("after");
  });
  it("isModoOngoing compara contra hoy", () => {
    expect(isModoOngoing({ date_to: "2026-07-05" }, "2026-07-05")).toBe(true);
    expect(isModoOngoing({ date_to: "2026-07-05" }, "2026-07-06")).toBe(false);
  });
});

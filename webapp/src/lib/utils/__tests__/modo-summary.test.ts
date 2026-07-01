import { describe, expect, it } from "vitest";
import { summarizeModo, filterSharedGroupsByOrigin, settleUpByPerson } from "@/lib/utils/modo-summary";
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
    expect(s).toEqual({ total: 0, count: 0, observedFrom: null, observedTo: null, byCategory: [] });
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

describe("settleUpByPerson", () => {
  const groups = [
    { split_group_id: "g1", debts: [
      { destinatario_id: "p1", destinatario_name: "Estefa", principal_amount: 100, outstanding_amount: 60, status: "active", origin_transaction_id: "tx1", id: "d1" },
    ] },
    { split_group_id: "g2", debts: [
      { destinatario_id: "p1", destinatario_name: "Estefa", principal_amount: 50, outstanding_amount: 0, status: "paid", origin_transaction_id: "tx2", id: "d2" },
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

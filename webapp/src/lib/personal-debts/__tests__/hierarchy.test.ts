import { describe, it, expect } from "vitest";
import {
  allocatePaymentAcrossDebts,
  buildPersonHierarchy,
  resolveDebtModo,
  type DebtOriginTx,
  type HierarchyModo,
} from "../hierarchy";
import type { PersonalDebtWithDetails } from "@/types/domain";

const ESTEFA = "11111111-1111-4111-8111-111111111111";
const JUAN = "22222222-2222-4222-8222-222222222222";
const TAG_AR = "tag-argentina";
const TAG_CT = "tag-cartagena";
const TAG_CT2 = "tag-cartagena-junio";

const argentina: HierarchyModo = {
  id: "modo-ar", name: "Argentina con Estefa", emoji: "⛷️", color: null,
  tag_ids: [TAG_AR], date_from: "2026-08-23", date_to: "2026-09-13",
};
const cartagenaA: HierarchyModo = {
  id: "modo-ct-a", name: "Cartagena con estefa", emoji: null, color: null,
  tag_ids: [TAG_CT, TAG_CT2], date_from: "2026-05-29", date_to: "2026-06-16",
};
const cartagenaB: HierarchyModo = {
  id: "modo-ct-b", name: "Cartagena compartido", emoji: "🏖️", color: null,
  tag_ids: [TAG_CT, TAG_CT2], date_from: "2026-06-12", date_to: "2026-06-15",
};

let seq = 0;
function debt(over: Partial<PersonalDebtWithDetails> & { destinatario_id: string }): PersonalDebtWithDetails {
  seq += 1;
  return {
    id: `debt-${seq}`,
    user_id: "u",
    direction: "lent",
    principal_amount: 100,
    outstanding_amount: 100,
    currency_code: "COP",
    opened_on: "2026-09-01",
    due_date: null,
    status: "active",
    origin_transaction_id: null,
    split_group_id: null,
    installment_group_id: null,
    installment_total: null,
    group_total_amount: null,
    interest_amount: null,
    notes: null,
    is_demo: false,
    created_at: `2026-09-16T00:00:${String(seq).padStart(2, "0")}Z`,
    updated_at: "2026-09-16T00:00:00Z",
    destinatario_name: over.destinatario_id === ESTEFA ? "Estefa" : "Juan",
    destinatario_default_category_id: null,
    destinatario_is_ad_hoc: false,
    total_repaid: 0,
    is_overdue: false,
    ...over,
  } as PersonalDebtWithDetails;
}

function origin(id: string, date: string, amount = 200, extra: Partial<DebtOriginTx> = {}): DebtOriginTx {
  return {
    id, amount, transaction_date: date, merchant_name: "Hotel", clean_description: null,
    raw_description: null, account_id: "acct-1", split_group_id: `sg-${id}`,
    installment_current: null, installment_total: null, ...extra,
  };
}

describe("resolveDebtModo", () => {
  it("picks the modo whose tag the origin carries", () => {
    expect(resolveDebtModo({ notes: null, opened_on: "2026-09-01" }, new Set([TAG_AR]), "2026-09-01", [argentina, cartagenaA])).toBe(argentina);
  });

  it("breaks a shared-tag tie by the note stamped with the modo name", () => {
    const m = resolveDebtModo({ notes: "Cartagena compartido", opened_on: "2026-06-13" }, new Set([TAG_CT]), "2026-06-13", [cartagenaA, cartagenaB]);
    expect(m).toBe(cartagenaB);
  });

  it("then by the trip whose dates contain the payment, newest first", () => {
    const m = resolveDebtModo({ notes: "Pachas", opened_on: "2026-06-14" }, new Set([TAG_CT]), "2026-06-14", [cartagenaA, cartagenaB]);
    expect(m).toBe(cartagenaB);
    const early = resolveDebtModo({ notes: "Vuelos", opened_on: "2026-05-30" }, new Set([TAG_CT2]), "2026-05-30", [cartagenaA, cartagenaB]);
    expect(early).toBe(cartagenaA);
  });

  it("falls back to the note when the debt has no tagged origin", () => {
    expect(resolveDebtModo({ notes: "argentina con estefa", opened_on: "2026-09-01" }, null, null, [argentina])).toBe(argentina);
    expect(resolveDebtModo({ notes: "Compras Argentina", opened_on: "2026-09-01" }, null, null, [argentina])).toBeNull();
  });
});

describe("buildPersonHierarchy", () => {
  it("groups one person's trip debts under the viaje and keeps loose ones apart", () => {
    const debts = [
      debt({ destinatario_id: ESTEFA, origin_transaction_id: "tx-1", split_group_id: "sg-tx-1", principal_amount: 12, outstanding_amount: 12, opened_on: "2026-09-12", notes: "Argentina con Estefa" }),
      debt({ destinatario_id: ESTEFA, origin_transaction_id: "tx-2", split_group_id: "sg-tx-2", principal_amount: 23, outstanding_amount: 23, opened_on: "2026-09-13", notes: "Argentina con Estefa" }),
      debt({ destinatario_id: ESTEFA, origin_transaction_id: "tx-3", split_group_id: "sg-tx-3", principal_amount: 5, outstanding_amount: 5, currency_code: "USD", opened_on: "2026-09-10", notes: "Argentina con Estefa" }),
      debt({ destinatario_id: ESTEFA, principal_amount: 196500, outstanding_amount: 196500, notes: "Droguitas", opened_on: "2026-08-22" }),
      debt({ destinatario_id: ESTEFA, direction: "borrowed", principal_amount: 350000, outstanding_amount: 350000, notes: "Compras Argentina", opened_on: "2026-08-01" }),
      debt({ destinatario_id: JUAN, principal_amount: 40, outstanding_amount: 0, status: "settled", total_repaid: 40, notes: "Almuerzo" }),
    ];
    const out = buildPersonHierarchy(
      {
        debts,
        originTxs: [origin("tx-1", "2026-09-12", 25), origin("tx-2", "2026-09-13", 45), origin("tx-3", "2026-09-10", 10)],
        tagRows: [
          { transaction_id: "tx-1", tag_id: TAG_AR },
          { transaction_id: "tx-2", tag_id: TAG_AR },
          { transaction_id: "tx-3", tag_id: TAG_AR },
        ],
        modos: [argentina, cartagenaA, cartagenaB],
      },
      "COP",
    );

    expect(out.map((p) => p.name)).toEqual(["Estefa", "Juan"]);
    const estefa = out[0];
    // One group per (modo, currency); COP first (primary), never summed with USD.
    expect(estefa.groups.map((g) => g.key)).toEqual(["modo-ar|COP", "modo-ar|USD"]);
    const cop = estefa.groups[0];
    expect(cop.count).toBe(2);
    expect(cop.principal).toBe(35);
    expect(cop.outstanding).toBe(35);
    expect(cop.first_on).toBe("2026-09-12");
    expect(cop.last_on).toBe("2026-09-13");
    expect(cop.origin_account_id).toBe("acct-1");
    // Newest first inside the group; the split total comes from the origin.
    expect(cop.items.map((i) => i.split_total)).toEqual([45, 25]);
    expect(cop.items[0].split_size).toBe(1);
    // Loose debts stay outside the viaje, both directions, newest first.
    expect(estefa.loose.map((i) => i.notes)).toEqual(["Droguitas", "Compras Argentina"]);
    expect(estefa.totals).toEqual([
      { currency_code: "COP", owedToMe: 196535, iOwe: 350000, principal: 546535, repaid: 0 },
      { currency_code: "USD", owedToMe: 5, iOwe: 0, principal: 5, repaid: 0 },
    ]);
    // Settled-only people sink to the bottom with their debt under "settled".
    const juan = out[1];
    expect(juan.activeCount).toBe(0);
    expect(juan.settled).toHaveLength(1);
    expect(juan.totals).toEqual([]);
  });

  it("keeps settled trip shares inside the group so recovered reads right", () => {
    const debts = [
      debt({ destinatario_id: ESTEFA, origin_transaction_id: "tx-1", split_group_id: "sg", principal_amount: 100, outstanding_amount: 0, status: "settled", total_repaid: 0, opened_on: "2026-06-13" }),
      debt({ destinatario_id: ESTEFA, origin_transaction_id: "tx-2", split_group_id: "sg2", principal_amount: 50, outstanding_amount: 20, total_repaid: 30, opened_on: "2026-06-14" }),
      debt({ destinatario_id: JUAN, origin_transaction_id: "tx-1", split_group_id: "sg", principal_amount: 100, outstanding_amount: 100, opened_on: "2026-06-13" }),
    ];
    const out = buildPersonHierarchy(
      {
        debts,
        originTxs: [origin("tx-1", "2026-06-13", 300, { split_group_id: "sg" }), origin("tx-2", "2026-06-14", 100, { split_group_id: "sg2" })],
        tagRows: [{ transaction_id: "tx-1", tag_id: TAG_CT }, { transaction_id: "tx-2", tag_id: TAG_CT }],
        modos: [cartagenaB],
      },
      "COP",
    );
    const estefa = out.find((p) => p.name === "Estefa")!;
    expect(estefa.groups).toHaveLength(1);
    const g = estefa.groups[0];
    expect(g.count).toBe(2);
    expect(g.activeCount).toBe(1);
    expect(g.principal).toBe(150);
    expect(g.repaid).toBe(130);
    expect(g.outstanding).toBe(20);
    expect(g.items[1].split_size).toBe(2);
    expect(estefa.settled).toHaveLength(0);
  });
});

describe("allocatePaymentAcrossDebts", () => {
  const d = (id: string, outstanding: number, opened_on: string, created_at = "2026-09-16T00:00:00Z") => ({
    id, outstanding_amount: outstanding, opened_on, created_at,
  });

  it("fills the oldest debt first, each up to its pending balance", () => {
    const { allocations, unallocated } = allocatePaymentAcrossDebts(
      [d("new", 50, "2026-09-13"), d("old", 30, "2026-09-10"), d("mid", 40, "2026-09-12")],
      60,
    );
    expect(allocations).toEqual([{ id: "old", amount: 30 }, { id: "mid", amount: 30 }]);
    expect(unallocated).toBe(0);
  });

  it("reports what could not be placed instead of over-paying", () => {
    const { allocations, unallocated } = allocatePaymentAcrossDebts([d("a", 10, "2026-09-10"), d("b", 5, "2026-09-11")], 20);
    expect(allocations).toEqual([{ id: "a", amount: 10 }, { id: "b", amount: 5 }]);
    expect(unallocated).toBe(5);
  });

  it("rounds to the currency's decimals and skips empty debts", () => {
    const { allocations } = allocatePaymentAcrossDebts(
      [d("zero", 0, "2026-09-01"), d("a", 12.41, "2026-09-12"), d("b", 5.99, "2026-09-13")],
      15.0,
    );
    expect(allocations).toEqual([{ id: "a", amount: 12.41 }, { id: "b", amount: 2.59 }]);
  });
});

describe("deuda general", () => {
  it("stays loose even when a loan happened during a viaje", () => {
    const out = buildPersonHierarchy(
      {
        debts: [
          debt({
            destinatario_id: ESTEFA,
            direction: "borrowed",
            origin_transaction_id: "tx-g",
            notes: "Deuda general",
            is_general: true,
          } as Partial<PersonalDebtWithDetails> & { destinatario_id: string }),
        ],
        originTxs: [origin("tx-g", "2026-09-01", 100, { split_group_id: null })],
        tagRows: [{ transaction_id: "tx-g", tag_id: TAG_AR }],
        modos: [argentina],
      },
      "COP",
    );
    expect(out[0].groups).toHaveLength(0);
    expect(out[0].loose).toHaveLength(1);
  });
});

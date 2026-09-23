import { describe, it, expect } from "vitest";
import { buildPersonHierarchy, type DebtOriginTx, type HierarchyModo } from "../hierarchy";
import { balanceLine, personDebtsHref, rollupPeople } from "../person-rollup";
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

function build(debts: PersonalDebtWithDetails[], originTxs: DebtOriginTx[], tagRows: { transaction_id: string; tag_id: string }[]) {
  return buildPersonHierarchy({ debts, originTxs, tagRows, modos: [argentina, cartagenaA, cartagenaB] }, "COP");
}

describe("rollupPeople", () => {
  it("collapses many debts with one person into ONE row with viajes and loose debts inside", () => {
    const trip = Array.from({ length: 5 }, (_, i) =>
      debt({
        destinatario_id: ESTEFA,
        origin_transaction_id: `tx-${i}`,
        split_group_id: `sg-tx-${i}`,
        principal_amount: 10 * (i + 1),
        outstanding_amount: 10 * (i + 1),
        opened_on: "2026-09-12",
      }),
    );
    const people = build(
      [
        ...trip,
        debt({ destinatario_id: ESTEFA, principal_amount: 7, outstanding_amount: 7, notes: "Droguitas" }),
        debt({ destinatario_id: ESTEFA, direction: "borrowed", principal_amount: 3, outstanding_amount: 3, notes: "Taxi" }),
        debt({ destinatario_id: JUAN, principal_amount: 500, outstanding_amount: 500 }),
      ],
      trip.map((d) => origin(d.origin_transaction_id!, "2026-09-12")),
      trip.map((d) => ({ transaction_id: d.origin_transaction_id!, tag_id: TAG_AR })),
    );

    const rows = rollupPeople(people, "COP");
    expect(rows.map((r) => r.name)).toEqual(["Juan", "Estefa"]);
    const estefa = rows[1];
    expect(estefa.activeCount).toBe(7);
    // 150 (viaje) + 7 lent − 3 borrowed → net
    expect(estefa.headline).toEqual({ label: "Te debe (neto)", amount: 154, tone: "lent" });
    expect(estefa.children).toEqual([
      { key: "modo-ar|COP", kind: "viaje", label: "Argentina con Estefa", emoji: "⛷️", count: 5, amount: 150, tone: "lent" },
      { key: "sueltas|COP", kind: "sueltas", label: "Otras deudas", emoji: null, count: 2, amount: 4, tone: "lent" },
    ]);
    // Juan has only loose debts → labelled as such.
    expect(rows[0].children[0].label).toBe("Deuda suelta");
  });

  it("drops people with nothing open and falls back to their own currency", () => {
    const people = build(
      [
        debt({ destinatario_id: JUAN, principal_amount: 40, outstanding_amount: 0, status: "settled", total_repaid: 40 }),
        debt({ destinatario_id: ESTEFA, principal_amount: 20, outstanding_amount: 20, currency_code: "USD" }),
      ],
      [],
      [],
    );
    const rows = rollupPeople(people, "COP");
    expect(rows).toHaveLength(1);
    expect(rows[0].currency_code).toBe("USD");
    expect(rows[0].otherCurrencies).toEqual([]);
    expect(rows[0].headline).toEqual({ label: "Te debe", amount: 20, tone: "lent" });
  });

  it("never sums currencies: other currencies are listed, not added", () => {
    const people = build(
      [
        debt({ destinatario_id: ESTEFA, principal_amount: 100, outstanding_amount: 100 }),
        debt({ destinatario_id: ESTEFA, principal_amount: 5, outstanding_amount: 5, currency_code: "USD" }),
      ],
      [],
      [],
    );
    const [row] = rollupPeople(people, "COP");
    expect(row.headline.amount).toBe(100);
    expect(row.otherCurrencies).toEqual(["USD"]);
    expect(row.children).toHaveLength(1);
  });
});

describe("balanceLine", () => {
  it("reads one direction, the net, or al día", () => {
    const t = (owedToMe: number, iOwe: number) => ({ currency_code: "COP", owedToMe, iOwe, principal: 0, repaid: 0 });
    expect(balanceLine(t(10, 0)).label).toBe("Te debe");
    expect(balanceLine(t(0, 10)).label).toBe("Le debes");
    expect(balanceLine(t(3, 10))).toEqual({ label: "Le debes (neto)", amount: 7, tone: "borrowed" });
    expect(balanceLine(t(0, 0)).tone).toBe("even");
  });
});

describe("personDebtsHref", () => {
  it("opens and scrolls to the person's card", () => {
    expect(personDebtsHref(ESTEFA)).toBe(`/deudas-personales?persona=${ESTEFA}#persona-${ESTEFA}`);
  });
});

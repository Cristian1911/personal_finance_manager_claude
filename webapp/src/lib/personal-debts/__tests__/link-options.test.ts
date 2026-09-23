import { describe, it, expect } from "vitest";
import { buildPersonHierarchy, type DebtOriginTx, type HierarchyModo } from "../hierarchy";
import { buildLinkOptions, describeDebtItem } from "../link-options";
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

const trip = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    debt({
      destinatario_id: ESTEFA,
      origin_transaction_id: `tx-${i}`,
      split_group_id: `sg-tx-${i}`,
      principal_amount: 10,
      outstanding_amount: 10,
      opened_on: `2026-09-1${i}`,
    }),
  );

function people(debts: PersonalDebtWithDetails[]) {
  const origins = debts.filter((d) => d.origin_transaction_id);
  return build(
    debts,
    origins.map((d) => origin(d.origin_transaction_id!, d.opened_on)),
    origins.map((d) => ({ transaction_id: d.origin_transaction_id!, tag_id: TAG_AR })),
  );
}

const inflow = (amount: number) => ({ amount, currency_code: "COP", direction: "INFLOW" as const });

describe("buildLinkOptions", () => {
  it("offers the person as a whole, the viaje and each debt", () => {
    const debts = [
      ...trip(3),
      debt({ destinatario_id: ESTEFA, principal_amount: 50, outstanding_amount: 50, notes: "Droguitas" }),
    ];
    const [estefa] = buildLinkOptions(people(debts), inflow(40));
    expect(estefa.name).toBe("Estefa");
    expect(estefa.pending).toBe(80);
    expect(estefa.scopes.map((s) => [s.kind, s.debtIds.length, s.pending, s.exceeds])).toEqual([
      ["persona", 4, 80, false],
      ["viaje", 3, 30, true],
    ]);
    expect(estefa.sections.map((s) => [s.title, s.debts.length])).toEqual([
      ["Argentina con Estefa", 3],
      ["Otras deudas", 1],
    ]);
    expect(estefa.sections[1].debts[0].role).toBe("repayment");
  });

  it("drops the viaje scope when it is the whole person", () => {
    const [estefa] = buildLinkOptions(people(trip(3)), inflow(5));
    expect(estefa.scopes.map((s) => s.kind)).toEqual(["persona"]);
  });

  it("never spreads a new loan: only one-debt options for origin-role links", () => {
    // An OUTFLOW toward a `lent` debt is more money lent — origin, not abono.
    const debts = [
      debt({ destinatario_id: ESTEFA, principal_amount: 50, outstanding_amount: 50 }),
      debt({ destinatario_id: ESTEFA, principal_amount: 20, outstanding_amount: 20 }),
    ];
    const [estefa] = buildLinkOptions(people(debts), { amount: 10, currency_code: "COP", direction: "OUTFLOW" });
    expect(estefa.scopes).toEqual([]);
    expect(estefa.pending).toBe(0);
    expect(estefa.sections[0].debts.map((d) => d.role)).toEqual(["origin", "origin"]);
  });

  it("hides shared-payment debts as origin targets and other currencies", () => {
    const debts = [
      ...trip(1),
      debt({ destinatario_id: JUAN, principal_amount: 9, outstanding_amount: 9, currency_code: "USD" }),
    ];
    const out = buildLinkOptions(people(debts), { amount: 10, currency_code: "COP", direction: "OUTFLOW" });
    expect(out).toEqual([]);
  });

  it("puts people you can abonar to first", () => {
    const debts = [
      debt({ destinatario_id: JUAN, principal_amount: 5, outstanding_amount: 5 }),
      debt({ destinatario_id: ESTEFA, principal_amount: 90, outstanding_amount: 90 }),
    ];
    expect(buildLinkOptions(people(debts), inflow(1)).map((p) => p.name)).toEqual(["Estefa", "Juan"]);
  });
});

describe("describeDebtItem", () => {
  it("prefers the origin movement, then the note", () => {
    const [p] = people([...trip(1), debt({ destinatario_id: ESTEFA, notes: "Taxi" })]);
    expect(describeDebtItem(p.groups[0].items[0])).toBe("Hotel");
    expect(describeDebtItem(p.loose[0])).toBe("Taxi");
  });
});

import { describe, expect, it } from "vitest";
import { computeDisponible, type DisponibleInput, type DisponibleMovement } from "../disponible";

// Laura (session 3): paid $2.100.000 on the 15th and 30th; debit + savings count, the Nu card
// doesn't (debt), a savings account kept apart doesn't. Cycle 15–29 Sep, today 18 Sep.
const CYCLE = { start: "2026-09-15", end: "2026-09-29", days: 15, daysLeft: 12 };

let n = 0;
const mv = (m: Partial<DisponibleMovement> & Pick<DisponibleMovement, "kind" | "amount">): DisponibleMovement => ({
  id: `m${++n}`, accountId: "debit", date: "2026-09-16", direction: "OUTFLOW", ...m,
});

function laura(over: Partial<DisponibleInput> = {}, extra: DisponibleMovement[] = []): DisponibleInput {
  return {
    cycle: CYCLE,
    today: "2026-09-18",
    accounts: [
      { id: "debit", countsInDisponible: true },
      { id: "savings", countsInDisponible: true },
      { id: "apart", countsInDisponible: false },
      { id: "nu", countsInDisponible: false, isDebt: true },
    ],
    expectedIncomes: [{ id: "salary", label: "Salario", amount: 2_100_000, expectedDate: "2026-09-15" }],
    movements: [
      mv({ kind: "salary", amount: 2_100_000, direction: "INFLOW", date: "2026-09-15", expectedIncomeId: "salary" }),
      mv({ kind: "spend", amount: 60_000, date: "2026-09-15" }), // Éxito
      mv({ kind: "spend", amount: 25_000, date: "2026-09-17" }), // Uber
      mv({ kind: "spend", amount: 15_000, date: "2026-09-18" }), // Tostao
      ...extra,
    ],
    obligations: [
      { id: "rent", kind: "bill", label: "Arriendo", dueDate: "2026-09-19", amount: 700_000 },
      { id: "netflix", kind: "bill", label: "Netflix", dueDate: "2026-09-24", amount: 38_900 },
      { id: "nu-a", kind: "card_bill", label: "Tarjeta Nu", dueDate: "2026-09-22", amount: 640_000, accountId: "nu" },
      { id: "nu-b", kind: "card_bill", label: "Tarjeta Nu", dueDate: "2026-10-22", amount: 480_000, accountId: "nu" },
    ],
    savingsTarget: 200_000,
    ...over,
  };
}

const LAURA = 421_100;

describe("computeDisponible — Laura's worked example", () => {
  it("$421.100, $35.000 al día; started at $521.100, $34.700 al día", () => {
    const r = computeDisponible(laura());
    expect(r.disponible).toBe(421_100);
    expect(r.perDay).toBe(35_000);
    expect(r.daysLeft).toBe(12);
    expect(r.startingDisponible).toBe(521_100);
    expect(r.startingPerDay).toBe(34_700);
    expect(r.llega.total).toBe(2_100_000);
    expect(r.porPagar.total).toBe(1_378_900);
    expect(r.ahorro.total).toBe(200_000);
    expect(r.yaSalio.total).toBe(100_000);
    expect(r.approximate).toBe(false);
  });

  it("with $250.000 spent: $271.100, $22.500 al día", () => {
    const r = computeDisponible(laura({}, [mv({ kind: "spend", amount: 150_000 })]));
    expect(r.disponible).toBe(271_100);
    expect(r.perDay).toBe(22_500);
  });

  it("lists Por pagar with Spanish labels, only bills due by the cycle end (Bill B is next cycle)", () => {
    const r = computeDisponible(laura());
    expect(r.porPagar.lines.map((l) => [l.label, l.amount])).toEqual([
      ["Arriendo", 700_000], ["Tarjeta Nu", 640_000], ["Netflix", 38_900],
    ]);
  });
});

describe("computeDisponible — every kind of movement (session 3 table)", () => {
  it("credit card purchase: no change now", () => {
    expect(computeDisponible(laura({}, [mv({ kind: "spend", amount: 400_000, accountId: "nu" })])).disponible).toBe(LAURA);
  });

  it("debit or cash purchase: down now, in Ya salió", () => {
    const r = computeDisponible(laura({}, [mv({ kind: "spend", amount: 30_000 })]));
    expect(r.disponible).toBe(LAURA - 30_000);
    expect(r.yaSalio.total).toBe(130_000);
  });

  it("card bill payment: no change, moves Por pagar → Ya salió", () => {
    const r = computeDisponible(laura({}, [mv({ kind: "payment", amount: 640_000, obligationId: "nu-a" })]));
    expect(r.disponible).toBe(LAURA);
    expect(r.porPagar.total).toBe(738_900);
    expect(r.yaSalio.total).toBe(740_000);
  });

  it("a transfer to the card account is its bill payment", () => {
    const r = computeDisponible(laura({}, [mv({ kind: "transfer", amount: 640_000, counterpartAccountId: "nu" })]));
    expect(r.disponible).toBe(LAURA);
  });

  it("card payment above the bill: the extra lowers Disponible now", () => {
    const r = computeDisponible(laura({}, [mv({ kind: "payment", amount: 800_000, obligationId: "nu-a" })]));
    expect(r.disponible).toBe(LAURA - 160_000);
  });

  it("paying a known bill: no change", () => {
    expect(computeDisponible(laura({}, [mv({ kind: "payment", amount: 700_000, obligationId: "rent" })])).disponible).toBe(LAURA);
  });

  it("partial bill payment (D5): no change; shows pagado X de Y and the rest stays in Por pagar", () => {
    const input = laura();
    input.obligations = [{ id: "rent", kind: "bill", label: "Arriendo", dueDate: "2026-09-19", amount: 1_100_000 }];
    const before = computeDisponible(input).disponible;
    input.movements.push(mv({ kind: "payment", amount: 600_000, obligationId: "rent" }));
    const r = computeDisponible(input);
    expect(r.disponible).toBe(before);
    expect(r.porPagar.lines[0]).toMatchObject({ amount: 500_000, paid: 600_000, total: 1_100_000 });
  });

  it("a bill paid in an earlier cycle only counts what's left", () => {
    const input = laura();
    input.obligations = [{ id: "rent", kind: "bill", label: "Arriendo", dueDate: "2026-09-19", amount: 700_000, paidBefore: 700_000 }];
    const r = computeDisponible(input);
    expect(r.porPagar.total).toBe(0);
    expect(r.startingDisponible).toBe(2_100_000 - 200_000);
  });

  it("loan cuota: no change when paid (it was in Por pagar)", () => {
    const input = laura();
    input.obligations.push({ id: "loan", kind: "loan", label: "Crédito carro", dueDate: "2026-09-25", amount: 510_000 });
    const before = computeDisponible(input).disponible;
    expect(before).toBe(LAURA - 510_000);
    input.movements.push(mv({ kind: "payment", amount: 510_000, obligationId: "loan" }));
    expect(computeDisponible(input).disponible).toBe(before);
  });

  it("extra payment / pay-off (D6): down by the extra", () => {
    expect(computeDisponible(laura({}, [mv({ kind: "payment", amount: 300_000 })])).disponible).toBe(LAURA - 300_000);
  });

  it("transfer between two counted accounts: no effect", () => {
    const r = computeDisponible(laura({}, [
      mv({ kind: "transfer", amount: 50_000, counterpartAccountId: "savings" }),
      mv({ kind: "transfer", amount: 50_000, accountId: "savings", direction: "INFLOW", counterpartAccountId: "debit" }),
    ]));
    expect(r.disponible).toBe(LAURA);
  });

  it("counted → not counted fills Ahorro first (no double subtraction)", () => {
    const r = computeDisponible(laura({}, [mv({ kind: "transfer", amount: 200_000, counterpartAccountId: "apart" })]));
    expect(r.disponible).toBe(LAURA);
    expect(r.ahorro.filledByTransfers).toBe(200_000);
  });

  it("counted → not counted beyond Ahorro: the excess goes down", () => {
    const r = computeDisponible(laura({}, [mv({ kind: "transfer", amount: 300_000, counterpartAccountId: "apart" })]));
    expect(r.disponible).toBe(LAURA - 100_000);
  });

  it("not counted → counted: up (Traje de mis ahorros)", () => {
    const r = computeDisponible(laura({}, [mv({ kind: "transfer", amount: 150_000, direction: "INFLOW", counterpartAccountId: "apart" })]));
    expect(r.disponible).toBe(LAURA + 150_000);
    expect(r.llega.lines.find((l) => l.label === "Traje de mis ahorros")?.amount).toBe(150_000);
  });

  it("refund: up, nets against Ya salió", () => {
    const r = computeDisponible(laura({}, [mv({ kind: "refund", amount: 20_000, direction: "INFLOW" })]));
    expect(r.disponible).toBe(LAURA + 20_000);
    expect(r.yaSalio.total).toBe(80_000);
    expect(r.llega.total).toBe(2_100_000);
  });

  it("salary: the real amount replaces the expected one", () => {
    const input = laura();
    input.movements[0].amount = 2_050_000;
    const r = computeDisponible(input);
    expect(r.disponible).toBe(LAURA - 50_000);
    expect(r.llega.lines[0]).toMatchObject({ label: "Salario", amount: 2_050_000, pending: false });
  });

  it("salary not seen yet: the expected amount counts and the number gets a '~'", () => {
    const input = laura();
    input.movements.shift();
    const r = computeDisponible(input);
    expect(r.disponible).toBe(LAURA);
    expect(r.llega.lines[0]).toMatchObject({ amount: 2_100_000, pending: true });
    expect(r.approximate).toBe(true);
    expect(r.reasons).toContain("salary_pending");
  });

  it("income expected later in the cycle counts without a '~' until its date passes", () => {
    const input = laura({ expectedIncomes: [...laura().expectedIncomes, { id: "side", label: "Clases", amount: 300_000, expectedDate: "2026-09-25" }] });
    const r = computeDisponible(input);
    expect(r.disponible).toBe(LAURA + 300_000);
    expect(r.llega.lines[1]).toMatchObject({ label: "Clases", pending: true });
    expect(r.approximate).toBe(false);
    expect(computeDisponible({ ...input, today: "2026-09-26", cycle: { ...CYCLE, daysLeft: 4 } }).reasons).toEqual(["salary_pending"]);
  });

  it("a salary that doesn't name its expected income replaces the first one", () => {
    const input = laura();
    delete input.movements[0].expectedIncomeId;
    expect(computeDisponible(input).approximate).toBe(false);
  });

  it("other income (bonus, freelance): up", () => {
    const r = computeDisponible(laura({}, [mv({ kind: "income", amount: 300_000, direction: "INFLOW" })]));
    expect(r.disponible).toBe(LAURA + 300_000);
  });

  it("shared purchase: you paid $240.000 → down $240.000", () => {
    expect(computeDisponible(laura({}, [mv({ kind: "spend", amount: 240_000 })])).disponible).toBe(LAURA - 240_000);
  });

  it("a friend repays you: up (Te pagaron)", () => {
    const r = computeDisponible(laura({}, [mv({ kind: "repayment", amount: 60_000, direction: "INFLOW" })]));
    expect(r.disponible).toBe(LAURA + 60_000);
    expect(r.llega.lines.find((l) => l.label === "Te pagaron")?.amount).toBe(60_000);
  });

  it("money lent directly: down", () => {
    expect(computeDisponible(laura({}, [mv({ kind: "spend", amount: 100_000 })])).disponible).toBe(LAURA - 100_000);
  });

  it("someone paid $50.000 for you (Tú debes, D8): down; paying it back: no change", () => {
    const input = laura();
    input.obligations.push({ id: "ana", kind: "owed_to_person", label: "Le debes a Ana", dueDate: "2026-09-29", amount: 50_000 });
    expect(computeDisponible(input).disponible).toBe(LAURA - 50_000);
    input.movements.push(mv({ kind: "payment", amount: 50_000, obligationId: "ana" }));
    expect(computeDisponible(input).disponible).toBe(LAURA - 50_000);
  });

  it("ATM withdrawal counts when made (S3-1); logging that cash later changes nothing", () => {
    const r = computeDisponible(laura({}, [
      mv({ kind: "spend", amount: 200_000 }),
      mv({ kind: "ignored", amount: 50_000, accountId: "savings" }),
    ]));
    expect(r.disponible).toBe(LAURA - 200_000);
  });

  it("movements outside the cycle don't count", () => {
    expect(computeDisponible(laura({}, [mv({ kind: "spend", amount: 99_000, date: "2026-09-14" })])).disponible).toBe(LAURA);
  });
});

describe("computeDisponible — special cases", () => {
  it("an unpaid bill from before the cycle is still Por pagar", () => {
    const input = laura();
    input.obligations.push({ id: "old", kind: "bill", label: "Claro", dueDate: "2026-09-10", amount: 90_000 });
    expect(computeDisponible(input).disponible).toBe(LAURA - 90_000);
  });

  it("estimated bills are marked ≈ on their line", () => {
    const input = laura();
    input.obligations[1] = { ...input.obligations[1], estimated: true };
    expect(computeDisponible(input).porPagar.lines.find((l) => l.label === "Netflix")?.estimated).toBe(true);
  });

  it("apartar (S3-7): the reservation is subtracted like Ahorro", () => {
    const r = computeDisponible(laura({ reservations: [{ id: "soat", label: "SOAT", amount: 150_000 }] }));
    expect(r.disponible).toBe(LAURA - 150_000);
    expect(r.ahorro.total).toBe(350_000);
  });

  it("previous cycle ended negative: a line 'Te pasaste el ciclo pasado'", () => {
    const r = computeDisponible(laura({ carryOver: -85_000 }));
    expect(r.disponible).toBe(LAURA - 85_000);
    expect(r.ajustes.lines).toEqual([{ id: "carry", label: "Te pasaste el ciclo pasado", amount: -85_000 }]);
  });

  it("previous cycle's leftover kept (S3-3): 'Te sobró el ciclo pasado'", () => {
    const r = computeDisponible(laura({ carryOver: 50_000 }));
    expect(r.disponible).toBe(LAURA + 50_000);
    expect(r.ajustes.lines[0].label).toBe("Te sobró el ciclo pasado");
  });

  it("'Cuadrar con mi saldo': one visible adjustment line", () => {
    const r = computeDisponible(laura({ balanceAdjustments: [{ id: "adj1", amount: -12_000 }] }));
    expect(r.disponible).toBe(LAURA - 12_000);
    expect(r.ajustes.lines).toEqual([{ id: "adj1", label: "Ajuste de saldo", amount: -12_000 }]);
  });

  it("first cycle: the balance told today − bills before payday − savings, then what moves after", () => {
    const r = computeDisponible(laura({
      anchor: { at: "2026-09-18T14:00:00.000Z", balance: 1_000_000 },
      savingsTarget: 0,
      obligations: laura().obligations.slice(0, 2),
    }, [
      mv({ kind: "spend", amount: 30_000, date: "2026-09-18", at: "2026-09-18T15:00:00.000Z" }),
      mv({ kind: "spend", amount: 5_000, date: "2026-09-18", at: "2026-09-18T13:00:00.000Z" }),
    ]));
    // Salary (15 Sep) and spending before the anchor are already in the balance.
    expect(r.disponible).toBe(1_000_000 - 738_900 - 30_000);
    expect(r.llega.lines).toEqual([{ id: "anchor", label: "Saldo inicial", amount: 1_000_000 }]);
  });

  it("irregular income: only received money + the opening balance; the usual income apart", () => {
    const r = computeDisponible({
      cycle: { start: "2026-09-01", end: "2026-09-30", days: 30, daysLeft: 13 },
      today: "2026-09-18",
      irregular: true,
      openingBalance: 500_000,
      accounts: [{ id: "debit", countsInDisponible: true }],
      expectedIncomes: [{ id: "usual", label: "Ingresos", amount: 3_000_000, expectedDate: "2026-09-20" }],
      movements: [
        mv({ kind: "income", amount: 1_200_000, direction: "INFLOW", date: "2026-09-05" }),
        mv({ kind: "spend", amount: 300_000, date: "2026-09-10" }),
      ],
      obligations: [],
    });
    expect(r.disponible).toBe(1_400_000);
    expect(r.expectedApart).toBe(3_000_000);
    expect(r.approximate).toBe(false);
  });

  it("foreign-currency estimates and quiet sources make the number approximate, never hidden", () => {
    const r = computeDisponible(laura({ staleSources: ["gmail"] }, [mv({ kind: "spend", amount: 41_200, approx: true })]));
    expect(r.disponible).toBe(LAURA - 41_200);
    expect(r.reasons).toEqual(["foreign_currency", "source_quiet"]);
  });

  it("per day rounds down to $100 and is 0 when the number is negative", () => {
    expect(computeDisponible(laura({}, [mv({ kind: "spend", amount: 1_150 })])).perDay).toBe(34_900);
    const r = computeDisponible(laura({}, [mv({ kind: "spend", amount: 506_100 })]));
    expect(r.disponible).toBe(-85_000);
    expect(r.perDay).toBe(0);
  });

  it("keeps cents exact (0,1 + 0,2)", () => {
    const r = computeDisponible(laura({}, [mv({ kind: "spend", amount: 0.1 }), mv({ kind: "spend", amount: 0.2 })]));
    expect(r.disponible).toBe(LAURA - 0.3);
  });
});

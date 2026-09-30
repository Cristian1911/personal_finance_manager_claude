import { describe, expect, it } from "vitest";
import { computeDisponible } from "../disponible";
import { occurrencesToCycleInputs, toDisponibleMovements, type StoredTransaction } from "../movements";

const ACCOUNTS = [
  { id: "debit", accountType: "CHECKING" },
  { id: "savings", accountType: "SAVINGS" },
  { id: "nu", accountType: "CREDIT_CARD" },
  { id: "loan", accountType: "LOAN" },
];

let n = 0;
const tx = (over: Partial<StoredTransaction>): StoredTransaction => ({
  id: `t${++n}`, accountId: "debit", date: "2026-09-16", amount: 10_000, direction: "OUTFLOW",
  currencyCode: "COP", flowClass: "SPEND", ...over,
});
const one = (t: StoredTransaction, extra: Parameters<typeof toDisponibleMovements>[0] extends infer I ? Partial<I> : never = {}) =>
  toDisponibleMovements({ transactions: [t], accounts: ACCOUNTS, ...extra })[0];

describe("toDisponibleMovements — flow class", () => {
  it.each([
    ["SPEND", "OUTFLOW", "spend"],
    ["CASH_WITHDRAWAL", "OUTFLOW", "spend"],
    ["BANK_FEE", "OUTFLOW", "spend"],
    ["INCOME", "INFLOW", "income"],
    ["SPEND", "INFLOW", "refund"],
    ["DEBT_PAYMENT", "OUTFLOW", "payment"],
    ["DEBT_CREDIT", "INFLOW", "ignored"],
    [null, "OUTFLOW", "spend"],
    ["UNCLASSIFIED", "INFLOW", "income"],
  ] as const)("%s %s → %s", (flowClass, direction, kind) => {
    expect(one(tx({ flowClass, direction }))?.kind).toBe(kind);
  });

  it("keeps id, account, date and a positive amount", () => {
    expect(one(tx({ id: "x", amount: 25_000, date: "2026-09-18" }))).toMatchObject({
      id: "x", accountId: "debit", date: "2026-09-18", amount: 25_000, direction: "OUTFLOW",
    });
  });
});

describe("toDisponibleMovements — what never counts", () => {
  it.each([
    ["excluded", { isExcluded: true }],
    ["merged into another (duplicate)", { reconciledIntoTransactionId: "t-other" }],
    ["cancelled", { status: "CANCELLED" }],
  ] as const)("%s rows are dropped", (_l, over) => {
    expect(toDisponibleMovements({ transactions: [tx(over)], accounts: ACCOUNTS })).toEqual([]);
  });
});

describe("toDisponibleMovements — transfers", () => {
  it("both legs of a transfer group know the other account", () => {
    const out = toDisponibleMovements({
      accounts: ACCOUNTS,
      transactions: [
        tx({ id: "a", flowClass: "SELF_TRANSFER", transferGroupId: "g1" }),
        tx({ id: "b", accountId: "savings", direction: "INFLOW", flowClass: "SELF_TRANSFER", transferGroupId: "g1" }),
      ],
    });
    expect(out.map((m) => [m.id, m.kind, m.counterpartAccountId])).toEqual([
      ["a", "transfer", "savings"], ["b", "transfer", "debit"],
    ]);
  });

  it("a card payment paired with its card leg becomes a transfer to the card (pays its bill)", () => {
    const [pay] = toDisponibleMovements({
      accounts: ACCOUNTS,
      transactions: [
        tx({ id: "p", flowClass: "DEBT_PAYMENT", transferGroupId: "g2", amount: 640_000 }),
        tx({ id: "c", accountId: "nu", direction: "INFLOW", flowClass: "DEBT_CREDIT", transferGroupId: "g2", amount: 640_000 }),
      ],
    });
    expect(pay).toMatchObject({ kind: "transfer", counterpartAccountId: "nu" });
  });

  it("a counterpart resolved by the caller (matchOwnAccount) is used when there's no group", () => {
    expect(one(tx({ flowClass: "DEBT_PAYMENT", counterpartAccountId: "nu" }))).toMatchObject({ kind: "transfer", counterpartAccountId: "nu" });
  });

  it("a cash advance or loan disbursed into a counted account is a transfer in from the debt", () => {
    expect(one(tx({ direction: "INFLOW", flowClass: "DEBT_DRAWDOWN", counterpartAccountId: "loan" }))).toMatchObject({
      kind: "transfer", counterpartAccountId: "loan",
    });
  });
});

describe("toDisponibleMovements — recurring bills and salary", () => {
  it("a movement linked to an income occurrence is that salary", () => {
    const m = one(tx({ id: "s", direction: "INFLOW", flowClass: "INCOME" }), {
      occurrenceLinks: [{ transactionId: "s", occurrenceId: "occ-salary", isIncome: true }],
    });
    expect(m).toMatchObject({ kind: "salary", expectedIncomeId: "occ-salary" });
  });

  it("a movement linked to a bill occurrence pays that bill", () => {
    const m = one(tx({ id: "r" }), { occurrenceLinks: [{ transactionId: "r", occurrenceId: "occ-rent", isIncome: false }] });
    expect(m).toMatchObject({ kind: "payment", obligationId: "occ-rent" });
  });
});

describe("toDisponibleMovements — debt payments without a named card", () => {
  it("with a single card or loan, an unnamed debt payment goes to it", () => {
    const m = toDisponibleMovements({
      transactions: [tx({ flowClass: "DEBT_PAYMENT" })],
      accounts: [{ id: "debit", accountType: "CHECKING" }, { id: "nu", accountType: "CREDIT_CARD" }],
    })[0];
    expect(m).toMatchObject({ kind: "transfer", counterpartAccountId: "nu" });
  });

  it("with several, it stays a payment (computeDisponible pays the earliest card/loan bill)", () => {
    expect(one(tx({ flowClass: "DEBT_PAYMENT" }))).toMatchObject({ kind: "payment" });
    expect(one(tx({ flowClass: "DEBT_PAYMENT" }))?.counterpartAccountId).toBeUndefined();
  });
});

describe("toDisponibleMovements — people (Te deben / Tú debes)", () => {
  it("the debt's direction is derived when it wasn't joined (hand-set DEBT_CREDIT repayments)", () => {
    expect(one(tx({ direction: "INFLOW", flowClass: "DEBT_CREDIT", personalDebtId: "d1", pdRole: "repayment" }))?.kind).toBe("repayment");
    expect(one(tx({ flowClass: "DEBT_PAYMENT", personalDebtId: "d2", pdRole: "repayment" }))).toMatchObject({ kind: "payment", obligationId: "d2" });
  });

  it("money lent is spending", () => {
    expect(one(tx({ flowClass: "SPEND", personalDebtId: "d1", pdRole: "origin", personalDebtDirection: "lent" }))?.kind).toBe("spend");
  });
  it("a friend repaying you is Te pagaron", () => {
    expect(one(tx({ direction: "INFLOW", flowClass: "INCOME", personalDebtId: "d1", pdRole: "repayment", personalDebtDirection: "lent" }))?.kind)
      .toBe("repayment");
  });
  it("paying back what you owe settles that Tú debes", () => {
    expect(one(tx({ personalDebtId: "d2", pdRole: "repayment", personalDebtDirection: "borrowed" }))).toMatchObject({
      kind: "payment", obligationId: "d2",
    });
  });
  it("money someone lent you arrives as income", () => {
    expect(one(tx({ direction: "INFLOW", flowClass: "INCOME", personalDebtId: "d3", pdRole: "origin", personalDebtDirection: "borrowed" }))?.kind)
      .toBe("income");
  });
});

describe("toDisponibleMovements — amounts and time", () => {
  it("foreign currency uses the COP amount and is approximate until the PDF", () => {
    expect(one(tx({ currencyCode: "USD", amount: 10, amountInBaseCurrency: 41_200 }))).toMatchObject({ amount: 41_200, approx: true });
    expect(one(tx({ currencyCode: "USD", amount: 10, amountInBaseCurrency: 40_000, captureMethod: "PDF_IMPORT" }))?.approx).toBeUndefined();
  });

  it("a foreign amount without its COP value is still counted, marked approximate", () => {
    expect(one(tx({ currencyCode: "USD", amount: 10, amountInBaseCurrency: null }))).toMatchObject({ amount: 10, approx: true });
  });

  it("the capture instant comes from the Colombian wall time, else created_at", () => {
    expect(one(tx({ date: "2026-09-18", time: "19:30:00" }))?.at).toBe("2026-09-19T00:30:00.000Z");
    expect(one(tx({ date: "2026-09-18", time: "08:05" }))?.at).toBe("2026-09-18T13:05:00.000Z");
    expect(one(tx({ time: null, createdAt: "2026-09-18T15:00:00.000Z" }))?.at).toBe("2026-09-18T15:00:00.000Z");
  });
});

describe("occurrencesToCycleInputs", () => {
  const templates = [
    { id: "tpl-salary", direction: "INFLOW" as const, label: "Salario" },
    { id: "tpl-rent", direction: "OUTFLOW" as const, label: "Arriendo" },
  ];

  it("income occurrences are expected incomes; bill occurrences are obligations; skipped ones vanish", () => {
    const r = occurrencesToCycleInputs({
      templates,
      transactions: [],
      occurrences: [
        { id: "o1", templateId: "tpl-salary", date: "2026-09-15", amount: 2_100_000, status: "pending", transactionId: null },
        { id: "o2", templateId: "tpl-rent", date: "2026-09-19", amount: 700_000, status: "pending", transactionId: null },
        { id: "o3", templateId: "tpl-rent", date: "2026-10-19", amount: 700_000, status: "skipped", transactionId: null },
      ],
    });
    expect(r.expectedIncomes).toEqual([{ id: "o1", label: "Salario", amount: 2_100_000, expectedDate: "2026-09-15" }]);
    expect(r.obligations).toEqual([{ id: "o2", kind: "bill", label: "Arriendo", dueDate: "2026-09-19", amount: 700_000 }]);
    expect(r.occurrenceLinks).toEqual([]);
  });

  it("a paid occurrence whose movement isn't passed counts as paid before (bill) or received (income)", () => {
    const r = occurrencesToCycleInputs({
      templates,
      transactions: [tx({ id: "t-other" })],
      occurrences: [
        { id: "o2", templateId: "tpl-rent", date: "2026-09-19", amount: 700_000, status: "paid", transactionId: "t-rent" },
        { id: "o1", templateId: "tpl-salary", date: "2026-09-15", amount: 2_100_000, status: "paid", transactionId: "t-sal" },
      ],
    });
    expect(r.obligations[0]).toMatchObject({ id: "o2", paidBefore: 700_000 });
    expect(r.expectedIncomes[0]).toMatchObject({ id: "o1", received: true });
    expect(r.occurrenceLinks).toEqual([]);
  });

  it("a paid occurrence whose movement is passed links it", () => {
    const r = occurrencesToCycleInputs({
      templates,
      transactions: [tx({ id: "t-rent" })],
      occurrences: [{ id: "o2", templateId: "tpl-rent", date: "2026-09-19", amount: 700_000, status: "paid", transactionId: "t-rent" }],
    });
    expect(r.obligations[0].paidBefore).toBeUndefined();
    expect(r.occurrenceLinks).toEqual([{ transactionId: "t-rent", occurrenceId: "o2", isIncome: false }]);
  });

  it("a link to a merged duplicate follows it to the row that survived", () => {
    const r = occurrencesToCycleInputs({
      templates,
      transactions: [tx({ id: "manual", reconciledIntoTransactionId: "pdf" }), tx({ id: "pdf", captureMethod: "PDF_IMPORT" })],
      occurrences: [{ id: "o2", templateId: "tpl-rent", date: "2026-09-19", amount: 700_000, status: "paid", transactionId: "manual" }],
    });
    expect(r.occurrenceLinks).toEqual([{ transactionId: "pdf", occurrenceId: "o2", isIncome: false }]);
  });

  it("one movement that paid two bills settles both, its money counted once", () => {
    const r = occurrencesToCycleInputs({
      templates: [...templates, { id: "tpl-luz", direction: "OUTFLOW" as const, label: "Luz" }],
      transactions: [tx({ id: "both", amount: 800_000 })],
      occurrences: [
        { id: "o2", templateId: "tpl-rent", date: "2026-09-19", amount: 700_000, status: "paid", transactionId: "both" },
        { id: "o4", templateId: "tpl-luz", date: "2026-09-20", amount: 100_000, status: "paid", transactionId: "both" },
      ],
    });
    expect(r.occurrenceLinks).toHaveLength(1);
    expect(r.obligations.find((o) => o.id === "o4")).toMatchObject({ paidBefore: 100_000 });
  });
});

describe("end to end: stored rows → computeDisponible (Laura)", () => {
  it("gives $421.100 from stored transactions and occurrences", () => {
    const templates = [
      { id: "tpl-salary", direction: "INFLOW" as const, label: "Salario" },
      { id: "tpl-rent", direction: "OUTFLOW" as const, label: "Arriendo" },
      { id: "tpl-netflix", direction: "OUTFLOW" as const, label: "Netflix" },
    ];
    const transactions = [
      tx({ id: "sal", direction: "INFLOW", flowClass: "INCOME", amount: 2_100_000, date: "2026-09-15" }),
      tx({ amount: 60_000, date: "2026-09-15" }),
      tx({ amount: 25_000, date: "2026-09-17" }),
      tx({ amount: 15_000, date: "2026-09-18" }),
      tx({ accountId: "nu", amount: 400_000, date: "2026-09-17" }), // card purchase: never counts
      tx({ amount: 999_000, isExcluded: true }),
    ];
    const cycle = occurrencesToCycleInputs({
      templates,
      transactions,
      occurrences: [
        { id: "o-sal", templateId: "tpl-salary", date: "2026-09-15", amount: 2_100_000, status: "paid", transactionId: "sal" },
        { id: "o-rent", templateId: "tpl-rent", date: "2026-09-19", amount: 700_000, status: "pending", transactionId: null },
        { id: "o-nf", templateId: "tpl-netflix", date: "2026-09-24", amount: 38_900, status: "pending", transactionId: null },
      ],
    });
    const r = computeDisponible({
      cycle: { start: "2026-09-15", end: "2026-09-29", days: 15, daysLeft: 12 },
      today: "2026-09-18",
      accounts: [
        { id: "debit", countsInDisponible: true },
        { id: "nu", countsInDisponible: false, isDebt: true },
      ],
      movements: toDisponibleMovements({ transactions, accounts: ACCOUNTS, occurrenceLinks: cycle.occurrenceLinks }),
      expectedIncomes: cycle.expectedIncomes,
      obligations: [...cycle.obligations, { id: "nu-a", kind: "card_bill", label: "Tarjeta Nu", dueDate: "2026-09-22", amount: 640_000, accountId: "nu" }],
      savingsTarget: 200_000,
    });
    expect(r.disponible).toBe(421_100);
    expect(r.perDay).toBe(35_000);
    expect(r.approximate).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { expandCashEntries, getMinPayment, runScenario } from "../scenario-engine";
import type { CashEntry } from "../scenario-types";
import { makeAccount } from "./helpers";

describe("expandCashEntries", () => {
  it("returns non-recurring entries unchanged", () => {
    const entries: CashEntry[] = [
      { id: "e1", amount: 2_000_000, month: "2026-04", currency: "COP" },
    ];
    const result = expandCashEntries(entries);
    expect(result).toHaveLength(1);
    expect(result[0].month).toBe("2026-04");
  });

  it("expands a recurring entry into individual months", () => {
    const entries: CashEntry[] = [
      { id: "e1", amount: 500_000, month: "2026-04", currency: "COP", recurring: { months: 3 } },
    ];
    const result = expandCashEntries(entries);
    expect(result).toHaveLength(3);
    expect(result[0].month).toBe("2026-04");
    expect(result[1].month).toBe("2026-05");
    expect(result[2].month).toBe("2026-06");
    expect(result[0].recurring).toBeUndefined();
  });

  it("handles year boundary correctly", () => {
    const entries: CashEntry[] = [
      { id: "e1", amount: 100_000, month: "2026-11", currency: "COP", recurring: { months: 3 } },
    ];
    const result = expandCashEntries(entries);
    expect(result[0].month).toBe("2026-11");
    expect(result[1].month).toBe("2026-12");
    expect(result[2].month).toBe("2027-01");
  });

  it("preserves label across expanded entries", () => {
    const entries: CashEntry[] = [
      { id: "e1", amount: 500_000, month: "2026-04", label: "Freelance", currency: "COP", recurring: { months: 2 } },
    ];
    const result = expandCashEntries(entries);
    expect(result[0].label).toBe("Freelance");
    expect(result[1].label).toBe("Freelance");
  });

  it("mixes recurring and non-recurring entries", () => {
    const entries: CashEntry[] = [
      { id: "e1", amount: 2_000_000, month: "2026-04", currency: "COP" },
      { id: "e2", amount: 500_000, month: "2026-04", currency: "COP", recurring: { months: 2 } },
    ];
    const result = expandCashEntries(entries);
    expect(result).toHaveLength(3);
  });
});

describe("getMinPayment", () => {
  it("uses monthlyPayment when set", () => {
    const acc = makeAccount({ monthlyPayment: 300_000 });
    expect(getMinPayment(acc)).toBe(300_000);
  });

  it("falls back to 5% of balance for COP", () => {
    const acc = makeAccount({ balance: 2_000_000, monthlyPayment: null, currency: "COP" });
    expect(getMinPayment(acc)).toBe(100_000);
  });

  it("uses COP floor of 50,000 when 5% is less", () => {
    const acc = makeAccount({ balance: 500_000, monthlyPayment: null, currency: "COP" });
    expect(getMinPayment(acc)).toBe(50_000);
  });

  it("uses USD floor of 25 when 5% is less", () => {
    const acc = makeAccount({ balance: 200, monthlyPayment: null, currency: "USD" });
    expect(getMinPayment(acc)).toBe(25);
  });

  it("uses 5% for USD when balance is high enough", () => {
    const acc = makeAccount({ balance: 1_000, monthlyPayment: null, currency: "USD" });
    expect(getMinPayment(acc)).toBe(50);
  });
});

describe("runScenario", () => {
  const accounts: DebtAccount[] = [
    makeAccount({ id: "visa", name: "Visa", balance: 2_000_000, interestRate: 28, monthlyPayment: 150_000 }),
    makeAccount({ id: "master", name: "Master", balance: 3_000_000, interestRate: 22, monthlyPayment: 200_000 }),
  ];

  it("with no cash entries, only pays minimums", () => {
    const result = runScenario({
      accounts,
      cashEntries: [],
      strategy: "avalanche",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
      startMonth: "2026-04",
    });

    expect(result.totalMonths).toBeGreaterThan(0);
    expect(result.timeline[0].calendarMonth).toBe("2026-04");
    expect(result.debtFreeDate).toBeDefined();
  });

  it("cash injection reduces total months vs baseline", () => {
    const baseline = runScenario({
      accounts,
      cashEntries: [],
      strategy: "avalanche",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
      startMonth: "2026-04",
    });

    const withCash = runScenario({
      accounts,
      cashEntries: [
        { id: "e1", amount: 2_000_000, month: "2026-05", currency: "COP" },
      ],
      strategy: "avalanche",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
      startMonth: "2026-04",
    });

    expect(withCash.totalMonths).toBeLessThan(baseline.totalMonths);
    expect(withCash.totalInterestPaid).toBeLessThan(baseline.totalInterestPaid);
  });

  it("avalanche prioritizes highest rate account", () => {
    const result = runScenario({
      accounts,
      cashEntries: [
        { id: "e1", amount: 1_000_000, month: "2026-04", currency: "COP" },
      ],
      strategy: "avalanche",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
      startMonth: "2026-04",
    });

    const visaPayoff = result.payoffOrder.find((p) => p.accountId === "visa");
    const masterPayoff = result.payoffOrder.find((p) => p.accountId === "master");
    expect(visaPayoff!.month).toBeLessThanOrEqual(masterPayoff!.month);
  });

  it("snowball prioritizes lowest balance account", () => {
    const result = runScenario({
      accounts,
      cashEntries: [
        { id: "e1", amount: 1_000_000, month: "2026-04", currency: "COP" },
      ],
      strategy: "snowball",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
      startMonth: "2026-04",
    });

    const visaPayoff = result.payoffOrder.find((p) => p.accountId === "visa");
    const masterPayoff = result.payoffOrder.find((p) => p.accountId === "master");
    expect(visaPayoff!.month).toBeLessThanOrEqual(masterPayoff!.month);
  });

  it("records cash injection events", () => {
    const result = runScenario({
      accounts,
      cashEntries: [
        { id: "e1", amount: 2_000_000, month: "2026-05", label: "Prima", currency: "COP" },
      ],
      strategy: "avalanche",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
      startMonth: "2026-04",
    });

    const month2 = result.timeline.find((m) => m.calendarMonth === "2026-05");
    const injectionEvent = month2?.events.find((e) => e.type === "cash_injection");
    expect(injectionEvent).toBeDefined();
    expect(injectionEvent!.amount).toBe(2_000_000);
  });

  it("records cascade events when an account is paid off", () => {
    const smallVisa = makeAccount({ id: "visa", name: "Visa", balance: 200_000, interestRate: 28, monthlyPayment: 150_000 });
    const result = runScenario({
      accounts: [smallVisa, accounts[1]],
      cashEntries: [
        { id: "e1", amount: 500_000, month: "2026-04", currency: "COP" },
      ],
      strategy: "avalanche",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
      startMonth: "2026-04",
    });

    const payoffEvent = result.timeline.flatMap((m) => m.events).find(
      (e) => e.type === "account_paid_off" && e.accountId === "visa"
    );
    expect(payoffEvent).toBeDefined();
  });

  it("respects manual overrides", () => {
    const result = runScenario({
      accounts,
      cashEntries: [
        { id: "e1", amount: 1_000_000, month: "2026-04", currency: "COP" },
      ],
      strategy: "avalanche",
      allocations: {
        manualOverrides: [
          { month: "2026-04", cashEntryId: "e1", accountId: "master", amount: 1_000_000 },
        ],
        cascadeRedirects: [],
      },
      startMonth: "2026-04",
    });

    const month1 = result.timeline[0];
    const masterDetail = month1.accounts.find((a) => a.accountId === "master");
    expect(masterDetail!.extraPaymentApplied).toBe(1_000_000);
  });

  it("respects cascade redirects", () => {
    const smallVisa = makeAccount({ id: "visa", name: "Visa", balance: 100_000, interestRate: 28, monthlyPayment: 150_000 });
    const result = runScenario({
      accounts: [smallVisa, accounts[1]],
      cashEntries: [
        { id: "e1", amount: 500_000, month: "2026-04", currency: "COP" },
      ],
      strategy: "avalanche",
      allocations: {
        manualOverrides: [],
        cascadeRedirects: [
          { fromAccountId: "visa", toAccountId: "master" },
        ],
      },
      startMonth: "2026-04",
    });

    const cascadeEvent = result.timeline.flatMap((m) => m.events).find(
      (e) => e.type === "cascade_redirect" && e.fromAccountId === "visa"
    );
    expect(cascadeEvent).toBeDefined();
    expect(cascadeEvent!.toAccountId).toBe("master");
  });

  it("timeline uses correct calendar months", () => {
    const result = runScenario({
      accounts: [makeAccount({ balance: 500_000, monthlyPayment: 200_000 })],
      cashEntries: [],
      strategy: "avalanche",
      allocations: { manualOverrides: [], cascadeRedirects: [] },
      startMonth: "2026-11",
    });

    expect(result.timeline[0].calendarMonth).toBe("2026-11");
    if (result.timeline.length > 1) {
      expect(result.timeline[1].calendarMonth).toBe("2026-12");
    }
    if (result.timeline.length > 2) {
      expect(result.timeline[2].calendarMonth).toBe("2027-01");
    }
  });
});

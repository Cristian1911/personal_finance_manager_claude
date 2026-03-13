import { describe, it, expect } from "vitest";
import { expandCashEntries, getMinPayment } from "../scenario-engine";
import type { CashEntry } from "../scenario-types";
import type { DebtAccount } from "../debt";

function makeAccount(overrides: Partial<DebtAccount> = {}): DebtAccount {
  return {
    id: "acc-1",
    name: "Tarjeta Visa",
    type: "CREDIT_CARD",
    balance: 5_000_000,
    creditLimit: 10_000_000,
    interestRate: 28,
    monthlyPayment: null,
    paymentDay: 15,
    cutoffDay: 5,
    currency: "COP",
    color: null,
    institutionName: null,
    currencyBreakdown: null,
    ...overrides,
  };
}

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

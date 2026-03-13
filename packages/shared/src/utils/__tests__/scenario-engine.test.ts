import { describe, it, expect } from "vitest";
import { expandCashEntries } from "../scenario-engine";
import type { CashEntry } from "../scenario-types";

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

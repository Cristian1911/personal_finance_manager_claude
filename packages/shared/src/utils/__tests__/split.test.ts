import { describe, it, expect } from "vitest";
import {
  splitEqual,
  validateAmountSplit,
  percentToAmounts,
  computeSplit,
} from "../split";

const sum = (xs: number[]) => xs.reduce((s, n) => s + n, 0);

describe("splitEqual", () => {
  it("splits exactly, distributing the remainder (COP, decimals=0)", () => {
    const shares = splitEqual(114098, 3, 0);
    expect(shares).toHaveLength(3);
    expect(sum(shares)).toBe(114098);
    // largest-remainder: first shares get the extra peso
    expect(shares).toEqual([38033, 38033, 38032]);
    expect(shares.every(Number.isInteger)).toBe(true);
  });

  it("handles an even split with no remainder", () => {
    const shares = splitEqual(100, 4, 0);
    expect(shares).toEqual([25, 25, 25, 25]);
  });

  it("supports 2-decimal currencies and still sums exactly", () => {
    const shares = splitEqual(10, 3, 2);
    expect(sum(shares)).toBeCloseTo(10, 10);
  });
});

describe("percentToAmounts", () => {
  it("converts percentages to amounts that sum exactly to total", () => {
    const amounts = percentToAmounts(114098, [50, 25, 25], 0);
    expect(sum(amounts)).toBe(114098);
  });

  it("distributes rounding so the total is preserved with awkward percents", () => {
    const amounts = percentToAmounts(100, [33.33, 33.33, 33.34], 0);
    expect(sum(amounts)).toBe(100);
  });
});

describe("validateAmountSplit", () => {
  it("accepts amounts that sum exactly", () => {
    expect(validateAmountSplit(100, [40, 60], 0)).toEqual({ ok: true });
  });
  it("rejects a mismatch and reports the diff", () => {
    const res = validateAmountSplit(100, [40, 50], 0);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.diff).toBe(-10);
  });
});

describe("computeSplit", () => {
  it("equal split including the payer sums exactly to total", () => {
    const res = computeSplit({
      total: 114098,
      method: "equal",
      participants: [{ destinatario_id: "a" }, { destinatario_id: "b" }],
      userIncluded: true,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.userShare + sum(res.shares.map((s) => s.amount))).toBe(114098);
      expect(res.shares).toHaveLength(2);
    }
  });

  it("equal split excluding the payer assigns nothing to the user", () => {
    const res = computeSplit({
      total: 90,
      method: "equal",
      participants: [{ destinatario_id: "a" }, { destinatario_id: "b" }],
      userIncluded: false,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.userShare).toBe(0);
      expect(sum(res.shares.map((s) => s.amount))).toBe(90);
    }
  });

  it("amount method derives the user's share as the remainder", () => {
    const res = computeSplit({
      total: 100000,
      method: "amount",
      participants: [
        { destinatario_id: "a", value: 30000 },
        { destinatario_id: "b", value: 20000 },
      ],
      userIncluded: true,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.userShare).toBe(50000);
      expect(res.shares.map((s) => s.amount)).toEqual([30000, 20000]);
    }
  });

  it("amount method rejects participant amounts that exceed the total", () => {
    const res = computeSplit({
      total: 40000,
      method: "amount",
      participants: [{ destinatario_id: "a", value: 50000 }],
      userIncluded: true,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("amount_sum_exceeds_total");
  });

  it("amount method (user excluded) requires an exact sum", () => {
    const res = computeSplit({
      total: 100,
      method: "amount",
      participants: [
        { destinatario_id: "a", value: 40 },
        { destinatario_id: "b", value: 50 },
      ],
      userIncluded: false,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("amount_sum_mismatch");
  });

  it("percent method including the payer fills the remaining percent", () => {
    const res = computeSplit({
      total: 100000,
      method: "percent",
      participants: [
        { destinatario_id: "a", value: 25 },
        { destinatario_id: "b", value: 25 },
      ],
      userIncluded: true,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      // user gets the remaining 50%
      expect(res.userShare).toBe(50000);
      expect(res.userShare + sum(res.shares.map((s) => s.amount))).toBe(100000);
    }
  });

  it("percent method (user excluded) rejects sums that aren't 100", () => {
    const res = computeSplit({
      total: 100,
      method: "percent",
      participants: [
        { destinatario_id: "a", value: 40 },
        { destinatario_id: "b", value: 40 },
      ],
      userIncluded: false,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("percent_sum_mismatch");
  });

  it("rejects empty participants and non-positive totals", () => {
    expect(computeSplit({ total: 100, method: "equal", participants: [], userIncluded: true }).ok).toBe(false);
    expect(
      computeSplit({
        total: 0,
        method: "equal",
        participants: [{ destinatario_id: "a" }],
        userIncluded: true,
      }).ok,
    ).toBe(false);
  });
});

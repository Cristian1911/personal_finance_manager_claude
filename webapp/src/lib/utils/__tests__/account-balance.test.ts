import { describe, expect, it } from "vitest";
import {
  applyAccountBalanceDelta,
  getDirectionForBalanceDelta,
  reverseAccountBalanceDelta,
} from "../account-balance";

describe("applyAccountBalanceDelta", () => {
  it("increases deposit balances on inflow", () => {
    expect(
      applyAccountBalanceDelta({
        currentBalance: 100,
        accountType: "SAVINGS",
        direction: "INFLOW",
        amount: 25,
      })
    ).toBe(125);
  });

  it("decreases deposit balances on outflow", () => {
    expect(
      applyAccountBalanceDelta({
        currentBalance: 100,
        accountType: "SAVINGS",
        direction: "OUTFLOW",
        amount: 25,
      })
    ).toBe(75);
  });

  it("increases debt balances on outflow", () => {
    expect(
      applyAccountBalanceDelta({
        currentBalance: 100,
        accountType: "CREDIT_CARD",
        direction: "OUTFLOW",
        amount: 25,
      })
    ).toBe(125);
  });

  it("decreases debt balances on inflow", () => {
    expect(
      applyAccountBalanceDelta({
        currentBalance: 100,
        accountType: "CREDIT_CARD",
        direction: "INFLOW",
        amount: 25,
      })
    ).toBe(75);
  });
});

describe("reverseAccountBalanceDelta", () => {
  it("reverts a deposit outflow", () => {
    expect(
      reverseAccountBalanceDelta({
        currentBalance: 75,
        accountType: "SAVINGS",
        direction: "OUTFLOW",
        amount: 25,
      })
    ).toBe(100);
  });

  it("reverts a debt outflow", () => {
    expect(
      reverseAccountBalanceDelta({
        currentBalance: 125,
        accountType: "CREDIT_CARD",
        direction: "OUTFLOW",
        amount: 25,
      })
    ).toBe(100);
  });
});

describe("getDirectionForBalanceDelta", () => {
  it("uses inflow for positive deposit adjustments", () => {
    expect(
      getDirectionForBalanceDelta({
        accountType: "SAVINGS",
        delta: 50,
      })
    ).toBe("INFLOW");
  });

  it("uses outflow for negative deposit adjustments", () => {
    expect(
      getDirectionForBalanceDelta({
        accountType: "SAVINGS",
        delta: -50,
      })
    ).toBe("OUTFLOW");
  });

  it("uses outflow for positive debt adjustments", () => {
    expect(
      getDirectionForBalanceDelta({
        accountType: "CREDIT_CARD",
        delta: 50,
      })
    ).toBe("OUTFLOW");
  });

  it("uses inflow for negative debt adjustments", () => {
    expect(
      getDirectionForBalanceDelta({
        accountType: "CREDIT_CARD",
        delta: -50,
      })
    ).toBe("INFLOW");
  });
});

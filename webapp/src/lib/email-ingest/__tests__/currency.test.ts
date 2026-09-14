import { describe, expect, it } from "vitest";
import { resolveEmailTransactionCurrency } from "../currency";

describe("resolveEmailTransactionCurrency", () => {
  it("uses the account currency for peso alerts", () => {
    expect(resolveEmailTransactionCurrency({ currency: "COP" }, "COP")).toBe("COP");
    expect(resolveEmailTransactionCurrency({ currency: "COP" }, "USD")).toBe("USD");
  });

  it("falls back to the alert currency when the account has none", () => {
    expect(resolveEmailTransactionCurrency({ currency: "COP" }, null)).toBe("COP");
    expect(resolveEmailTransactionCurrency({ currency: "COP" }, undefined)).toBe("COP");
  });

  it("keeps a foreign currency stated by the alert even on a COP account", () => {
    expect(resolveEmailTransactionCurrency({ currency: "USD" }, "COP")).toBe("USD");
    expect(resolveEmailTransactionCurrency({ currency: "USD" }, null)).toBe("USD");
  });

  it("treats queued rows parsed before currency existed as pesos", () => {
    expect(
      resolveEmailTransactionCurrency({ currency: undefined as unknown as "COP" }, "COP")
    ).toBe("COP");
  });
});

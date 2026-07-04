import { describe, it, expect } from "vitest";
import { deriveDebtVerdict } from "../debt-verdict";
import { formatCurrency } from "../currency";

const base = {
  totalDebt: 5_000_000,
  totalMonthlyPayment: 500_000,
  monthlyInterest: 100_000,
  currency: "COP" as const,
};

describe("deriveDebtVerdict", () => {
  it("returns vas-bien with no debt", () => {
    expect(deriveDebtVerdict({ ...base, totalDebt: 0 })).toEqual({
      state: "vas-bien",
      detail: "No tienes deudas activas.",
    });
  });

  it("returns vas-bien when payments cover interest (capital falling)", () => {
    const result = deriveDebtVerdict(base);
    expect(result.state).toBe("vas-bien");
    expect(result.delta).toBe(`−${formatCurrency(400_000, "COP")}`);
  });

  it("returns te-pasaste when interest exceeds payments (debt growing)", () => {
    const result = deriveDebtVerdict({
      ...base,
      totalMonthlyPayment: 100_000,
      monthlyInterest: 300_000,
    });
    expect(result.state).toBe("te-pasaste");
    expect(result.delta).toBe(`+${formatCurrency(200_000, "COP")}`);
  });

  it("returns atencion when payments exactly cover interest (no progress)", () => {
    const result = deriveDebtVerdict({
      ...base,
      totalMonthlyPayment: 200_000,
      monthlyInterest: 200_000,
    });
    expect(result.state).toBe("atencion");
    expect(result.delta).toBeUndefined();
  });

  it("returns atencion when there is no payment data yet", () => {
    const result = deriveDebtVerdict({
      ...base,
      totalMonthlyPayment: 0,
      monthlyInterest: 0,
    });
    expect(result.state).toBe("atencion");
    expect(result.detail).toBe(
      "Registra los pagos mensuales de tus deudas para ver tu avance.",
    );
  });
});

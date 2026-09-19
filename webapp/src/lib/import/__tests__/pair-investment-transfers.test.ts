import { describe, expect, it } from "vitest";
import { isInvestmentTransferLeg } from "../pair-investment-transfers";

describe("isInvestmentTransferLeg", () => {
  it("recognises the fund side only on an investment account", () => {
    expect(isInvestmentTransferLeg("APERTURA", true)).toBe(true);
    expect(isInvestmentTransferLeg("ADICIÓN", true)).toBe(true);
    expect(isInvestmentTransferLeg("RETIRO", true)).toBe(true);
    expect(isInvestmentTransferLeg("APERTURA", false)).toBe(false);
    expect(isInvestmentTransferLeg("RENDIMIENTOS NETOS", true)).toBe(false);
  });

  it("recognises the savings side by the fund wording, on any account", () => {
    expect(isInvestmentTransferLeg("TRASLADO A FONDO DE INVERSION", false)).toBe(true);
    expect(isInvestmentTransferLeg("TRASLADO DE FONDO DE INVERS", false)).toBe(true);
    expect(isInvestmentTransferLeg("TRANSFERENCIA CTA SUC VIRTUAL", false)).toBe(false);
  });
});

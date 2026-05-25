import { describe, it, expect } from "vitest";
import { tokenizeDescription } from "./tokenize-description";

describe("tokenizeDescription", () => {
  it("splits a noisy bank line into meaningful, de-duplicated tokens", () => {
    expect(tokenizeDescription("PAGO PSE NEQUI S.A. 12345 REF#998")).toEqual([
      "PAGO",
      "PSE",
      "NEQUI",
      "REF",
    ]);
  });

  it("drops pure-numeric and short noise tokens, preserves order", () => {
    expect(tokenizeDescription("Compra RAPPI*Bogota 00012")).toEqual([
      "Compra",
      "RAPPI",
      "Bogota",
    ]);
  });

  it("returns an empty array for null/empty input", () => {
    expect(tokenizeDescription(null)).toEqual([]);
    expect(tokenizeDescription("   ")).toEqual([]);
  });

  it("caps the number of chips at 12", () => {
    const long = Array.from({ length: 30 }, (_, i) => `WORD${i}`).join(" ");
    expect(tokenizeDescription(long)).toHaveLength(12);
  });
});

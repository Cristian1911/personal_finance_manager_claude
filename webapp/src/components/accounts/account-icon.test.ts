import { describe, it, expect } from "vitest";
import { BANK_LOGOS } from "@/lib/icons/bank-logos";

describe("BANK_LOGOS registry", () => {
  it("has entries for the 9 Colombian banks", () => {
    expect(BANK_LOGOS.bancolombia).toBeDefined();
    expect(BANK_LOGOS.nu).toBeDefined();
    expect(BANK_LOGOS.davivienda).toBeDefined();
    expect(BANK_LOGOS.falabella).toBeDefined();
    expect(BANK_LOGOS["banco-de-bogota"]).toBeDefined();
    expect(BANK_LOGOS.lulo).toBeDefined();
    expect(BANK_LOGOS.confiar).toBeDefined();
    expect(BANK_LOGOS.popular).toBeDefined();
    expect(BANK_LOGOS.nequi).toBeDefined();
  });

  it("has no entry for unknown slugs (falls back to account_type glyph)", () => {
    expect(BANK_LOGOS.unknown).toBeUndefined();
    expect(BANK_LOGOS[""]).toBeUndefined();
  });
});

import { describe, it, expect } from "vitest";
import {
  defaultModoFor,
  effectiveEnrichment,
  matchesReviewFilter,
  describeRowShare,
  EMPTY_ENRICHMENT,
} from "../review-enrichment";
import type { ActiveModo } from "@/types/domain";

const trip: ActiveModo = {
  id: "m1", name: "Argentina", emoji: "✈️", color: null, auto_tag_id: "t1",
  date_from: "2026-07-10", date_to: "2026-07-20",
};

describe("defaultModoFor", () => {
  it("files spend inside the trip dates", () => {
    expect(defaultModoFor({ date: "2026-07-15", direction: "OUTFLOW", installment_total: 1 }, trip)).toBe("m1");
  });
  it("leaves out inflows, cuotas and rows outside the range", () => {
    expect(defaultModoFor({ date: "2026-07-15", direction: "INFLOW", installment_total: 1 }, trip)).toBeNull();
    expect(defaultModoFor({ date: "2026-07-15", direction: "OUTFLOW", installment_total: 24 }, trip)).toBeNull();
    expect(defaultModoFor({ date: "2026-07-25", direction: "OUTFLOW", installment_total: 1 }, trip)).toBeNull();
    expect(defaultModoFor({ date: "2026-07-15", direction: "OUTFLOW", installment_total: 1 }, null)).toBeNull();
  });
});

describe("effectiveEnrichment", () => {
  it("returns the explicit decision untouched, even a cleared trip", () => {
    const explicit = { ...EMPTY_ENRICHMENT, modoId: null, notes: "x" };
    expect(effectiveEnrichment(explicit, { date: "2026-07-15", direction: "OUTFLOW", installment_total: 1 }, trip)).toBe(explicit);
  });
  it("fills only the trip default otherwise", () => {
    const e = effectiveEnrichment(undefined, { date: "2026-07-15", direction: "OUTFLOW", installment_total: 1 }, trip);
    expect(e).toEqual({ modoId: "m1", tagIds: [], notes: "", share: null });
  });
});

describe("matchesReviewFilter", () => {
  const facts = { hasCategory: false, isInstallment: true, hasDestinatario: false, modoId: null };
  it("matches per chip", () => {
    expect(matchesReviewFilter("all", facts)).toBe(true);
    expect(matchesReviewFilter("uncategorized", facts)).toBe(true);
    expect(matchesReviewFilter("installments", facts)).toBe(true);
    expect(matchesReviewFilter("newMerchants", facts)).toBe(true);
    expect(matchesReviewFilter("trip", facts)).toBe(false);
    expect(matchesReviewFilter("trip", { ...facts, modoId: "m1" })).toBe(true);
  });
});

describe("describeRowShare", () => {
  it("names up to two people and the method", () => {
    expect(describeRowShare(null)).toBeNull();
    expect(describeRowShare({ method: "equal", userIncluded: true, source: "custom", participants: [{ destinatario_id: "a", name: "Estefa" }] })).toBe("Estefa · partes iguales");
    expect(
      describeRowShare({ method: "percent", userIncluded: true, source: "custom", participants: [{ destinatario_id: "a", name: "Ana" }, { destinatario_id: "b", name: "Luis" }, { destinatario_id: "c", name: "Sol" }] }),
    ).toBe("Ana y 2 más · porcentaje");
  });
});

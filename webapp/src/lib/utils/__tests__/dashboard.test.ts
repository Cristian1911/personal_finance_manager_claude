import { describe, it, expect } from "vitest";
import {
  getFreshnessLevel,
  getAccountSemanticColor,
  getCreditUtilizationColor,
} from "../dashboard";

describe("getFreshnessLevel", () => {
  it("returns 'fresh' for today", () => {
    const today = new Date().toISOString();
    expect(getFreshnessLevel(today)).toBe("fresh");
  });

  it("returns 'stale' for 2-3 days ago", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    expect(getFreshnessLevel(twoDaysAgo)).toBe("stale");
  });

  it("returns 'outdated' for 4+ days ago", () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString();
    expect(getFreshnessLevel(fiveDaysAgo)).toBe("outdated");
  });

  it("returns 'outdated' for null", () => {
    expect(getFreshnessLevel(null)).toBe("outdated");
  });
});

describe("getAccountSemanticColor", () => {
  it("returns 'positive' when balance increases", () => {
    expect(getAccountSemanticColor(5, "deposit")).toBe("positive");
  });

  it("returns 'warning' for moderate deposit decline (10-30%)", () => {
    expect(getAccountSemanticColor(-15, "deposit")).toBe("warning");
  });

  it("returns 'danger' for severe deposit decline (>30%)", () => {
    expect(getAccountSemanticColor(-35, "deposit")).toBe("danger");
  });

  it("returns 'positive' when debt decreases", () => {
    expect(getAccountSemanticColor(-10, "debt")).toBe("positive");
  });

  it("returns 'danger' when debt increases", () => {
    expect(getAccountSemanticColor(15, "debt")).toBe("danger");
  });
});

describe("getCreditUtilizationColor", () => {
  it("returns 'positive' for <30%", () => {
    expect(getCreditUtilizationColor(25)).toBe("positive");
  });

  it("returns 'warning' for 30-60%", () => {
    expect(getCreditUtilizationColor(45)).toBe("warning");
  });

  it("returns 'danger' for >60%", () => {
    expect(getCreditUtilizationColor(75)).toBe("danger");
  });
});

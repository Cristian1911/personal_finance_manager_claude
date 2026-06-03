import { describe, it, expect } from "vitest";
import {
  inferPersonalDebtRole,
  computeOutstanding,
  isPersonalDebtOverdue,
  isPersonalDebtOrigin,
} from "../personal-debt";

describe("inferPersonalDebtRole", () => {
  it("borrowed + INFLOW = origin (loan received)", () => {
    expect(inferPersonalDebtRole("borrowed", "INFLOW")).toBe("origin");
  });
  it("borrowed + OUTFLOW = repayment", () => {
    expect(inferPersonalDebtRole("borrowed", "OUTFLOW")).toBe("repayment");
  });
  it("lent + OUTFLOW = origin (money I gave)", () => {
    expect(inferPersonalDebtRole("lent", "OUTFLOW")).toBe("origin");
  });
  it("lent + INFLOW = repayment", () => {
    expect(inferPersonalDebtRole("lent", "INFLOW")).toBe("repayment");
  });
});

describe("computeOutstanding", () => {
  it("subtracts the sum of repayments from principal", () => {
    const r = computeOutstanding(140_000, [40_000, 20_000]);
    expect(r.outstanding).toBe(80_000);
    expect(r.status).toBe("active");
  });
  it("clamps outstanding at zero and marks settled when fully repaid", () => {
    const r = computeOutstanding(100_000, [60_000, 50_000]);
    expect(r.outstanding).toBe(0);
    expect(r.status).toBe("settled");
  });
  it("treats exact payoff as settled", () => {
    const r = computeOutstanding(100_000, [100_000]);
    expect(r.outstanding).toBe(0);
    expect(r.status).toBe("settled");
  });
  it("handles no repayments", () => {
    const r = computeOutstanding(200_000, []);
    expect(r.outstanding).toBe(200_000);
    expect(r.status).toBe("active");
  });
});

describe("isPersonalDebtOverdue", () => {
  const today = "2026-06-03";
  it("is overdue when due_date is past and status is active", () => {
    expect(isPersonalDebtOverdue("2026-05-01", "active", today)).toBe(true);
  });
  it("is not overdue when there is no due_date", () => {
    expect(isPersonalDebtOverdue(null, "active", today)).toBe(false);
  });
  it("is not overdue when due_date is in the future", () => {
    expect(isPersonalDebtOverdue("2026-07-01", "active", today)).toBe(false);
  });
  it("is not overdue when settled even if past due", () => {
    expect(isPersonalDebtOverdue("2026-05-01", "settled", today)).toBe(false);
  });
  it("is not overdue on the due date itself", () => {
    expect(isPersonalDebtOverdue(today, "active", today)).toBe(false);
  });
});

describe("isPersonalDebtOrigin", () => {
  it("is true only when linked AND role is origin", () => {
    expect(isPersonalDebtOrigin({ personal_debt_id: "d1", pd_role: "origin" })).toBe(true);
  });
  it("is false for repayment rows (they count as normal cashflow)", () => {
    expect(isPersonalDebtOrigin({ personal_debt_id: "d1", pd_role: "repayment" })).toBe(false);
  });
  it("is false for unlinked transactions", () => {
    expect(isPersonalDebtOrigin({ personal_debt_id: null, pd_role: null })).toBe(false);
  });
  it("is false when role is null even if linked", () => {
    expect(isPersonalDebtOrigin({ personal_debt_id: "d1", pd_role: null })).toBe(false);
  });
});

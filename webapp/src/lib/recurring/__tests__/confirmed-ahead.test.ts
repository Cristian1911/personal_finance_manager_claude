import { describe, expect, it } from "vitest";
import { recurringMonthsAhead } from "@/lib/recurring/confirmed-ahead";

const TODAY = "2026-09-27";

describe("recurringMonthsAhead", () => {
  it("opens next month when a card statement confirms a due date there", () => {
    expect(
      recurringMonthsAhead([{ account_type: "CREDIT_CARD", payment_due_date: "2026-10-10" }], TODAY),
    ).toBe(1);
    expect(
      recurringMonthsAhead([{ account_type: "LOAN", payment_due_date: "2026-10-05" }], TODAY),
    ).toBe(1);
  });

  it("stays on the current month when the due date is this month", () => {
    expect(
      recurringMonthsAhead([{ account_type: "CREDIT_CARD", payment_due_date: "2026-09-30" }], TODAY),
    ).toBe(0);
  });

  it("ignores non-debt accounts and caps at one month", () => {
    expect(
      recurringMonthsAhead([{ account_type: "SAVINGS", payment_due_date: "2026-10-10" }], TODAY),
    ).toBe(0);
    expect(
      recurringMonthsAhead([{ account_type: "LOAN", payment_due_date: "2026-12-05" }], TODAY),
    ).toBe(1);
  });
});

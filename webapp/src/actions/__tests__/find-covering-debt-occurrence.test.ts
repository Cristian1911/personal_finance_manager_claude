import { describe, expect, it, vi, beforeEach } from "vitest";

const { getAuthenticatedClient } = vi.hoisted(() => ({
  getAuthenticatedClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/auth", () => ({ getAuthenticatedClient }));
vi.mock("@/lib/supabase/cached", () => ({ createCachedClient: vi.fn() }));
vi.mock("@/lib/cache/revalidation", () => ({ revalidateFinancialViews: vi.fn() }));
vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

import { findCoveringDebtOccurrence } from "@/actions/occurrences";

const USER = { id: "00000000-0000-0000-0000-0000000000a1" };
const CARD = "00000000-0000-0000-0000-0000000000b1";
const TX = "00000000-0000-0000-0000-0000000000c1";
const SEP1 = "00000000-0000-0000-0000-0000000000e1";
const OCT1 = "00000000-0000-0000-0000-0000000000e2";

type TxRow = {
  id: string;
  account_id: string;
  direction: "INFLOW" | "OUTFLOW";
  transaction_date: string;
  amount: number;
  recurrence_group_id: string | null;
  account: { account_type: string } | null;
};

type OccRow = {
  id: string;
  occurrence_date: string;
  expected_amount: number;
  template: {
    merchant_name: string | null;
    description: string | null;
    currency_code: string;
  };
};

/** Table-routed chainable mock: `transactions` resolves the tx row via
 *  maybeSingle(); `recurring_occurrences` resolves the candidate list when
 *  awaited at the end of the filter chain. */
function buildSupabase({ tx, occurrences }: { tx: TxRow | null; occurrences: OccRow[] }) {
  const capturedFilters: Array<[string, unknown]> = [];
  function chain(table: string) {
    const resolved =
      table === "transactions"
        ? { data: tx, error: null }
        : { data: occurrences, error: null };
    const c: Record<string, unknown> = {};
    const self = () => c;
    for (const m of ["select", "order", "limit"]) c[m] = self;
    for (const m of ["eq", "is", "gte", "lte", "in"]) {
      c[m] = (col: string, val: unknown) => {
        capturedFilters.push([col, val]);
        return c;
      };
    }
    c.maybeSingle = () => Promise.resolve(resolved);
    c.then = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(resolved).then(onFulfilled);
    return c;
  }
  return { client: { from: (table: string) => chain(table) }, capturedFilters };
}

const cardPayment = (amount: number, date: string): TxRow => ({
  id: TX,
  account_id: CARD,
  direction: "INFLOW",
  transaction_date: date,
  amount,
  recurrence_group_id: null,
  account: { account_type: "CREDIT_CARD" },
});

const sep1: OccRow = {
  id: SEP1,
  occurrence_date: "2026-09-01",
  expected_amount: 219_591.28,
  template: { merchant_name: "Pago NU Bank", description: null, currency_code: "COP" },
};
const oct1: OccRow = { ...sep1, id: OCT1, occurrence_date: "2026-10-01" };

describe("findCoveringDebtOccurrence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the next cuota a full-balance card payment after the cut could carry", async () => {
    // Nu: statement cut mid-Aug, due Sep 1, minimum 219,591.28. User paid
    // 3,646,525 on Aug 18. Not auto-linked (may be an extra contribution) —
    // surfaced so the form can ask.
    const { client, capturedFilters } = buildSupabase({
      tx: cardPayment(3_646_525, "2026-08-18"),
      occurrences: [oct1, sep1],
    });
    getAuthenticatedClient.mockResolvedValue({ user: USER, supabase: client });

    const result = await findCoveringDebtOccurrence(TX);

    expect(result).toEqual({
      occurrenceId: SEP1,
      occurrenceDate: "2026-09-01",
      expectedAmount: 219_591.28,
      currencyCode: "COP",
      merchant: "Pago NU Bank",
    });
    // Window is asymmetric: 3 days back, 21 days ahead of the payment date.
    expect(capturedFilters).toContainEqual(["occurrence_date", "2026-08-15"]);
    expect(capturedFilters).toContainEqual(["occurrence_date", "2026-09-08"]);
    expect(capturedFilters).toContainEqual(["template.account_id", CARD]);
    expect(capturedFilters).toContainEqual(["status", "pending"]);
  });

  it("ignores payments below the minimum", async () => {
    const { client } = buildSupabase({
      tx: cardPayment(100_000, "2026-08-18"),
      occurrences: [sep1],
    });
    getAuthenticatedClient.mockResolvedValue({ user: USER, supabase: client });

    expect(await findCoveringDebtOccurrence(TX)).toBeNull();
  });

  it("never prompts for non-debt accounts, outflows, or already-linked payments", async () => {
    const savings = { ...cardPayment(3_646_525, "2026-08-18"), account: { account_type: "SAVINGS" } };
    const purchase = { ...cardPayment(3_646_525, "2026-08-18"), direction: "OUTFLOW" as const };
    const linked = { ...cardPayment(3_646_525, "2026-08-18"), recurrence_group_id: "g" };

    for (const tx of [savings, purchase, linked]) {
      const { client } = buildSupabase({ tx, occurrences: [sep1] });
      getAuthenticatedClient.mockResolvedValue({ user: USER, supabase: client });
      expect(await findCoveringDebtOccurrence(TX)).toBeNull();
    }
  });

  it("rejects an invalid id without touching the database", async () => {
    const from = vi.fn();
    getAuthenticatedClient.mockResolvedValue({ user: USER, supabase: { from } });

    expect(await findCoveringDebtOccurrence("nope")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});

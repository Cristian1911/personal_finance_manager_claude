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

import { findMatchingOccurrence } from "@/actions/occurrences";

const USER = { id: "00000000-0000-0000-0000-0000000000a1" };
const ACCOUNT = "00000000-0000-0000-0000-0000000000b1";
const DESTINATARIO = "00000000-0000-0000-0000-0000000000d1";
const OCCURRENCE = "00000000-0000-0000-0000-0000000000e1";

type OccurrenceRow = {
  id: string;
  occurrence_date: string;
  expected_amount: number;
  template: {
    account_id: string;
    destinatario_id?: string | null;
    direction: "INFLOW" | "OUTFLOW";
    is_active: boolean;
    transfer_source_account_id?: string | null;
    account?: { account_type: string };
  };
};

/**
 * Builds a minimal chainable PostgREST-like mock for two query flavors:
 *  - anchored (with destinatario_id filter) — returns anchoredRows
 *  - amount-proximity fallback               — returns amountRows
 * The chain inspects which `.eq("template.destinatario_id", …)` call fired
 * and routes accordingly.
 */
function buildSupabase({
  anchoredRows,
  amountRows,
}: {
  anchoredRows?: OccurrenceRow[];
  amountRows?: OccurrenceRow[];
}) {
  function chainFor(rows: OccurrenceRow[] | undefined) {
    const data = rows ?? [];
    const resolved = Promise.resolve({ data, error: null });
    const chain: Record<string, unknown> = {
      eq: () => chain,
      gte: () => chain,
      lte: () => chain,
      order: () => resolved,
      then: (onFulfilled: (v: { data: OccurrenceRow[]; error: null }) => unknown) =>
        resolved.then(onFulfilled),
    };
    return chain;
  }

  return {
    from: () => ({
      select: (_cols: string) => {
        const chain: Record<string, unknown> = {
          eq: (col: string, _val: string) => {
            if (col === "template.destinatario_id") {
              Object.assign(chain, chainFor(anchoredRows));
            } else if (col === "template.transfer_source_account_id") {
              Object.assign(chain, chainFor([]));
            } else if (col === "template.account_id" && !anchoredRows) {
              Object.assign(chain, chainFor(amountRows));
            }
            return chain;
          },
          gte: () => chain,
          lte: () => chain,
          order: () => Promise.resolve({ data: amountRows ?? [], error: null }),
        };
        // Amount-only fallback query doesn't end with order(), so we make the
        // chain itself thenable so `await supabase.from().select().eq()...`
        // resolves to the amountRows path.
        (chain as { then?: (r: (v: unknown) => unknown) => Promise<unknown> }).then =
          (onFulfilled) =>
            Promise.resolve({ data: amountRows ?? [], error: null }).then(onFulfilled);
        return chain;
      },
    }),
  };
}

describe("findMatchingOccurrence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("anchored match with mismatched amount (50%+ off) falls through", async () => {
    // Rent 2,000,000 template anchored to landlord. User records a 500,000
    // partial payment. Anchored pass must NOT auto-link.
    getAuthenticatedClient.mockResolvedValue({
      user: USER,
      supabase: buildSupabase({
        anchoredRows: [
          {
            id: OCCURRENCE,
            occurrence_date: "2026-04-20",
            expected_amount: 2_000_000,
            template: {
              account_id: ACCOUNT,
              destinatario_id: DESTINATARIO,
              direction: "OUTFLOW",
              is_active: true,
            },
          },
        ],
        amountRows: [], // amount-proximity fallback returns no match
      }),
    });

    const match = await findMatchingOccurrence(
      ACCOUNT,
      "2026-04-18",
      500_000,
      "OUTFLOW",
      DESTINATARIO,
    );

    expect(match).toBeNull();
  });

  it("anchored match within 50% tolerance links (fees, exchange variance)", async () => {
    // Rent template 2,000,000; actual paid 2,050,000 (service fee). Within
    // the 50% band, so the anchored pass links.
    getAuthenticatedClient.mockResolvedValue({
      user: USER,
      supabase: buildSupabase({
        anchoredRows: [
          {
            id: OCCURRENCE,
            occurrence_date: "2026-04-20",
            expected_amount: 2_000_000,
            template: {
              account_id: ACCOUNT,
              destinatario_id: DESTINATARIO,
              direction: "OUTFLOW",
              is_active: true,
            },
          },
        ],
      }),
    });

    const match = await findMatchingOccurrence(
      ACCOUNT,
      "2026-04-20",
      2_050_000,
      "OUTFLOW",
      DESTINATARIO,
    );

    expect(match).toBe(OCCURRENCE);
  });

  it("no destinatario falls through to amount-proximity match", async () => {
    getAuthenticatedClient.mockResolvedValue({
      user: USER,
      supabase: buildSupabase({
        // anchoredRows undefined → no .eq("template.destinatario_id") branch hit
        amountRows: [
          {
            id: OCCURRENCE,
            occurrence_date: "2026-04-20",
            expected_amount: 50_000,
            template: {
              account_id: ACCOUNT,
              direction: "OUTFLOW",
              is_active: true,
            },
          },
        ],
      }),
    });

    const match = await findMatchingOccurrence(
      ACCOUNT,
      "2026-04-20",
      50_000,
      "OUTFLOW",
      null,
    );

    expect(match).toBe(OCCURRENCE);
  });
});

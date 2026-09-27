import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/actions/exchange-rate", () => ({ getExchangeRate: vi.fn() }));
vi.mock("@/actions/recurring-templates", () => ({
  computeRecurringGroupUuid: vi.fn(async () => "00000000-0000-4000-8000-0000000000f1"),
}));

import {
  linkTransactionToOccurrenceWith,
  type OccurrenceLinkContext,
} from "@/lib/recurring/occurrence-linking";

const USER_ID = "00000000-0000-0000-0000-0000000000a1";
const ACCOUNT = "00000000-0000-0000-0000-0000000000b1";
const OCCURRENCE = "00000000-0000-0000-0000-0000000000e1";
const TEMPLATE = "00000000-0000-0000-0000-0000000000c1";
const TX = "00000000-0000-0000-0000-0000000000d1";

type Call = { table: string; op: "select" | "update"; payload?: unknown; eqs: [string, unknown][] };

/**
 * Chainable PostgREST stand-in: every filter returns the chain, and awaiting
 * (or `.single()`) resolves to the response registered for `table:op`.
 * Records each call so the test can assert which table a write hit.
 */
function buildClient(responses: Record<string, unknown>) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, op: "select", eqs: [] };
      calls.push(call);
      const resolve = () =>
        Promise.resolve({ data: responses[`${table}:${call.op}`] ?? null, error: null });
      const chain: Record<string, unknown> = {
        select: () => chain,
        update: (payload: unknown) => {
          call.op = "update";
          call.payload = payload;
          return chain;
        },
        eq: (col: string, val: unknown) => {
          call.eqs.push([col, val]);
          return chain;
        },
        gte: () => chain,
        lte: () => chain,
        order: () => chain,
        single: resolve,
        then: (onFulfilled: (v: unknown) => unknown) => resolve().then(onFulfilled),
      };
      return chain;
    },
  };
  return { client, calls };
}

describe("linkTransactionToOccurrenceWith (service-role context)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the matching occurrence paid with the caller's client — no session needed", async () => {
    const { client, calls } = buildClient({
      "recurring_occurrences:select": [
        {
          id: OCCURRENCE,
          expected_amount: 10_000,
          template: { account_id: ACCOUNT, direction: "OUTFLOW", is_active: true, currency_code: "COP" },
        },
      ],
      "recurring_occurrences:update": {
        template_id: TEMPLATE,
        occurrence_date: "2026-09-26",
        template: { frequency: "ONCE", category_id: null, destinatario_id: null },
      },
      "transactions:select": { category_id: null, destinatario_id: null },
    });
    const invalidate = vi.fn();
    const ctx = {
      supabase: client,
      userId: USER_ID,
      isAdmin: true,
      invalidate,
    } as unknown as OccurrenceLinkContext;

    await linkTransactionToOccurrenceWith(
      ctx,
      ACCOUNT,
      "2026-09-26",
      10_000,
      "OUTFLOW",
      TX,
      null,
      { currencyCode: "COP" },
    );

    const paid = calls.find((c) => c.table === "recurring_occurrences" && c.op === "update");
    expect(paid?.payload).toMatchObject({ status: "paid", transaction_id: TX });
    expect(paid?.eqs).toContainEqual(["user_id", USER_ID]);

    // ONCE template deactivation bypasses the encrypted view under service role.
    const deactivate = calls.find((c) => c.op === "update" && c.table.startsWith("recurring_transaction_templates"));
    expect(deactivate?.table).toBe("recurring_transaction_templates_enc");
    expect(deactivate?.payload).toEqual({ is_active: false });

    expect(invalidate).toHaveBeenCalled();
  });
});

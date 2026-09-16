import { describe, expect, it, vi, beforeEach } from "vitest";

const { getAuthenticatedClient } = vi.hoisted(() => ({ getAuthenticatedClient: vi.fn() }));
const createCachedClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/auth", () => ({ getAuthenticatedClient }));
vi.mock("@/lib/supabase/cached", () => ({ createCachedClient }));
vi.mock("@/lib/cache/revalidation", () => ({ revalidateFinancialViews: vi.fn() }));
vi.mock("next/cache", () => ({
  updateTag: vi.fn(), revalidateTag: vi.fn(), cacheTag: vi.fn(), cacheLife: vi.fn(),
  unstable_cacheTag: vi.fn(), unstable_cacheLife: vi.fn(),
}));

import { getModoTransactionIds } from "@/lib/modos/membership";

// Query builder mock: transaction_tags(.in tag) -> rows; transactions(.in id .is reconciled null) -> rows
const isCalls: Array<[string, unknown]> = [];
function makeClient() {
  return {
    from(table: string) {
      if (table === "transaction_tags") {
        return {
          select: () => ({
            eq: () => ({
              in: () => Promise.resolve({
                data: [
                  { transaction_id: "t1" }, { transaction_id: "t2" }, { transaction_id: "t1" },
                ],
              }),
            }),
          }),
        };
      }
      // transactions: both tagged rows exist, belong to the user and were not
      // reconciled away by an import
      return {
        select: () => ({
          eq: () => ({
            in: () => ({
              is: (col: string, val: unknown) => {
                isCalls.push([col, val]);
                return Promise.resolve({ data: [{ id: "t1" }, { id: "t2" }] });
              },
            }),
          }),
        }),
      };
    },
  };
}

beforeEach(() => {
  createCachedClient.mockReturnValue(makeClient());
});

describe("getModoTransactionIds", () => {
  it("la etiqueta manda: tags OR, deduplicado, sin filtrar por fechas", async () => {
    isCalls.length = 0;
    const ids = await getModoTransactionIds({ tag_ids: ["tagA", "tagB"] }, "user-1", "token");
    expect(ids).toEqual(["t1", "t2"]);
  });

  it("deja fuera los duplicados que una importación reconcilió", async () => {
    isCalls.length = 0;
    await getModoTransactionIds({ tag_ids: ["tagA"] }, "user-1", "token");
    expect(isCalls).toEqual([["reconciled_into_transaction_id", null]]);
  });

  it("devuelve [] si el modo no tiene tags", async () => {
    const ids = await getModoTransactionIds({ tag_ids: [] }, "user-1", "token");
    expect(ids).toEqual([]);
  });
});

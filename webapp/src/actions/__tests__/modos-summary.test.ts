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

import { getModoTransactionIds } from "@/actions/modos";

// Query builder mock: transaction_tags(.in tag) -> rows; transactions(.in id .gte .lte) -> rows
function makeClient() {
  return {
    from(table: string) {
      if (table === "transaction_tags") {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [
                { transaction_id: "t1" }, { transaction_id: "t2" }, { transaction_id: "t1" },
              ],
            }),
          }),
        };
      }
      // transactions: only t1 falls inside [2026-07-01, 2026-07-05]
      return {
        select: () => ({
          eq: () => ({
            in: () => ({
              gte: () => ({
                lte: () => Promise.resolve({ data: [{ id: "t1" }] }),
              }),
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
  it("intersecta tags (OR, deduplicado) con el rango de fechas", async () => {
    const ids = await getModoTransactionIds(
      { date_from: "2026-07-01", date_to: "2026-07-05", tag_ids: ["tagA", "tagB"] },
      "user-1",
      "token",
    );
    expect(ids).toEqual(["t1"]);
  });

  it("devuelve [] si el modo no tiene tags", async () => {
    const ids = await getModoTransactionIds(
      { date_from: "2026-07-01", date_to: "2026-07-05", tag_ids: [] },
      "user-1",
      "token",
    );
    expect(ids).toEqual([]);
  });
});

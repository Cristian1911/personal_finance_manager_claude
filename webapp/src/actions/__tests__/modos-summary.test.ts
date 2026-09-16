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

// Query builder mock: transaction_tags(.in tag) -> rows; transactions(.in id) -> rows
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
      // transactions: both tagged rows exist and belong to the user
      return {
        select: () => ({
          eq: () => ({
            in: () => Promise.resolve({ data: [{ id: "t1" }, { id: "t2" }] }),
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
    const ids = await getModoTransactionIds({ tag_ids: ["tagA", "tagB"] }, "user-1", "token");
    expect(ids).toEqual(["t1", "t2"]);
  });

  it("devuelve [] si el modo no tiene tags", async () => {
    const ids = await getModoTransactionIds({ tag_ids: [] }, "user-1", "token");
    expect(ids).toEqual([]);
  });
});

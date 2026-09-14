import { describe, expect, it, vi } from "vitest";
import {
  attachTagsToTransactions,
  readTagIdsFromFormData,
} from "@/lib/tags/attach-transaction-tags";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const USER = "00000000-0000-0000-0000-0000000000a1";
const TX_A = "00000000-0000-0000-0000-0000000000b1";
const TX_B = "00000000-0000-0000-0000-0000000000b2";
const TAG_OWN = "00000000-0000-0000-0000-0000000000c1";
const TAG_FOREIGN = "00000000-0000-0000-0000-0000000000c2";

/**
 * Minimal PostgREST-like mock: `.from("tags")` resolves the ownership lookup
 * with `ownedTagRows`; `.from("transaction_tags").upsert` records the rows.
 */
function makeSupabase(
  ownedTagRows: Array<{ id: string }>,
  opts: { upsertError?: { message: string } | null; ownedTxCount?: number | null; written?: number } = {},
) {
  const { upsertError = null, ownedTxCount = null, written } = opts;
  const select = vi.fn().mockImplementation(() =>
    Promise.resolve(
      upsertError
        ? { data: null, error: upsertError }
        : { data: Array.from({ length: written ?? 0 }, (_, i) => ({ tag_id: `t${i}` })), error: null },
    ),
  );
  const upsert = vi.fn().mockReturnValue({ select });
  const orFilter = vi.fn();
  const txFilter = vi.fn();
  const from = vi.fn((table: string) => {
    if (table === "transactions") {
      return {
        select: () => ({
          eq: (col: string, val: string) => ({
            in: (_c: string, ids: string[]) => {
              txFilter(col, val, ids);
              // Mimic PostgREST: count matches the ids the user owns.
              return Promise.resolve({ count: ownedTxCount ?? ids.length, error: null });
            },
          }),
        }),
      };
    }
    if (table === "tags") {
      return {
        select: () => ({
          in: () => ({
            or: (filter: string) => {
              orFilter(filter);
              return Promise.resolve({ data: ownedTagRows, error: null });
            },
          }),
        }),
      };
    }
    if (table === "transaction_tags") return { upsert };
    throw new Error(`unexpected table ${table}`);
  });
  return { client: { from } as unknown as SupabaseClient<Database>, upsert, orFilter, txFilter };
}

describe("attachTagsToTransactions", () => {
  it("no-ops without tags or transactions and never touches the DB", async () => {
    const { client, upsert } = makeSupabase([{ id: TAG_OWN }]);
    expect(await attachTagsToTransactions(client, USER, [TX_A], [])).toEqual({ attached: 0, error: null });
    expect(await attachTagsToTransactions(client, USER, [], [TAG_OWN])).toEqual({ attached: 0, error: null });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("only attaches tags the user owns (or system tags) and writes user_id on each row", async () => {
    const { client, upsert, orFilter, txFilter } = makeSupabase([{ id: TAG_OWN }], { written: 2 });
    const result = await attachTagsToTransactions(client, USER, [TX_A, TX_B], [TAG_OWN, TAG_FOREIGN, TAG_OWN]);

    expect(result).toEqual({ attached: 2, error: null });
    expect(txFilter).toHaveBeenCalledWith("user_id", USER, [TX_A, TX_B]);
    expect(orFilter).toHaveBeenCalledWith(`user_id.eq.${USER},user_id.is.null`);
    expect(upsert).toHaveBeenCalledWith(
      [
        { transaction_id: TX_A, tag_id: TAG_OWN, user_id: USER },
        { transaction_id: TX_B, tag_id: TAG_OWN, user_id: USER },
      ],
      { onConflict: "transaction_id,tag_id", ignoreDuplicates: true },
    );
  });

  it("skips the write when none of the tags belong to the user", async () => {
    const { client, upsert } = makeSupabase([]);
    expect(await attachTagsToTransactions(client, USER, [TX_A], [TAG_FOREIGN])).toEqual({ attached: 0, error: null });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses transactions the user does not own", async () => {
    const { client, upsert } = makeSupabase([{ id: TAG_OWN }], { ownedTxCount: 1 });
    expect(await attachTagsToTransactions(client, USER, [TX_A, TX_B], [TAG_OWN])).toEqual({
      attached: 0,
      error: "Transacciones no encontradas",
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("reports only the rows actually written when pairs already existed", async () => {
    const { client } = makeSupabase([{ id: TAG_OWN }], { written: 0 });
    expect(await attachTagsToTransactions(client, USER, [TX_A], [TAG_OWN])).toEqual({ attached: 0, error: null });
  });

  it("surfaces the junction write error without throwing", async () => {
    const { client } = makeSupabase([{ id: TAG_OWN }], { upsertError: { message: "boom" } });
    expect(await attachTagsToTransactions(client, USER, [TX_A], [TAG_OWN])).toEqual({ attached: 0, error: "boom" });
  });
});

describe("readTagIdsFromFormData", () => {
  it("reads every tag_ids value, trimmed, dropping blanks and non-strings", () => {
    const fd = new FormData();
    fd.append("tag_ids", ` ${TAG_OWN} `);
    fd.append("tag_ids", "");
    fd.append("tag_ids", TAG_FOREIGN);
    fd.append("tag_ids", new Blob(["x"]));
    expect(readTagIdsFromFormData(fd)).toEqual([TAG_OWN, TAG_FOREIGN]);
  });

  it("accepts a single JSON-encoded array (the modos form convention)", () => {
    const fd = new FormData();
    fd.set("tag_ids", JSON.stringify([TAG_OWN, "", TAG_FOREIGN]));
    expect(readTagIdsFromFormData(fd)).toEqual([TAG_OWN, TAG_FOREIGN]);
  });

  it("returns an empty list when the field is absent", () => {
    expect(readTagIdsFromFormData(new FormData())).toEqual([]);
  });
});

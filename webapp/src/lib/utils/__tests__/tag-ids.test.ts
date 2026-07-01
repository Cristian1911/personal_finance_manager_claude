import { describe, expect, it } from "vitest";
import { dedupeTransactionIds } from "@/lib/utils/tag-ids";

describe("dedupeTransactionIds", () => {
  it("deduplica (semántica OR: una tx con varios tags aparece una vez)", () => {
    const rows = [
      { transaction_id: "tx1" },
      { transaction_id: "tx2" },
      { transaction_id: "tx1" },
    ];
    expect(dedupeTransactionIds(rows).sort()).toEqual(["tx1", "tx2"]);
  });
  it("devuelve [] para input vacío", () => {
    expect(dedupeTransactionIds([])).toEqual([]);
  });
});

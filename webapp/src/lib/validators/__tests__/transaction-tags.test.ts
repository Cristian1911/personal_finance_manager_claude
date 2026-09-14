import { describe, expect, it } from "vitest";
import { transactionSchema } from "@/lib/validators/transaction";
import { transferSchema } from "@/lib/validators/transfer";

const ACCOUNT = "00000000-0000-0000-0000-0000000000b1";
const ACCOUNT_2 = "00000000-0000-0000-0000-0000000000b2";
const TAG = "d0000002-0001-4000-8000-000000000001";

describe("tag ids on the create validators", () => {
  it("transactionSchema drops malformed tag ids instead of rejecting the save", () => {
    const parsed = transactionSchema.safeParse({
      account_id: ACCOUNT,
      amount: "1000",
      currency_code: "COP",
      direction: "OUTFLOW",
      transaction_date: "2026-09-03",
      is_subscription: "false",
      tags: [TAG, "not-a-uuid", ""],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.tags).toEqual([TAG]);
  });

  it("transferSchema defaults tagIds to [] and filters junk", () => {
    const base = {
      fromAccountId: ACCOUNT,
      toAccountId: ACCOUNT_2,
      amount: "1000",
      currencyCode: "COP",
      date: "2026-09-03",
    };
    const none = transferSchema.safeParse({ ...base, tagIds: [] });
    expect(none.success && none.data.tagIds).toEqual([]);
    const some = transferSchema.safeParse({ ...base, tagIds: [TAG, "x"] });
    expect(some.success && some.data.tagIds).toEqual([TAG]);
  });
});

import { describe, expect, it } from "vitest";
import { toDialect } from "../sql";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";

describe.each(DRIVERS)("test harness on %s", (_name, make) => {
  it("stores and reads an account through the same SQL", async () => {
    const d = await make();
    await seedAccount(d, { id: ACCOUNT, userId: USER, balance: 1000.5 });
    const rows = await d.query<{ id: string; current_balance: unknown }>(
      toDialect("SELECT id, current_balance FROM accounts WHERE id = ?", d.dialect),
      [ACCOUNT],
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].current_balance)).toBe(1000.5);
  });

  it("rolls back a failed transaction", async () => {
    const d = await make();
    await expect(
      d.transaction(async (tx) => {
        await seedAccount(tx, { id: ACCOUNT, userId: USER, balance: 1 });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const rows = await d.query(toDialect("SELECT id FROM accounts", d.dialect));
    expect(rows).toHaveLength(0);
  });
});

describe("toDialect", () => {
  it("numbers placeholders for postgres and keeps casts", () => {
    expect(toDialect("SELECT ? , ?::jsonb", "postgres")).toBe("SELECT $1 , $2::jsonb");
    expect(toDialect("SELECT ?", "sqlite")).toBe("SELECT ?");
  });
});

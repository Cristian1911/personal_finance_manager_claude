import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import type { CommandEnvelope, CommandType, SqlDriver } from "../types";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const CARD = "33333333-3333-4333-8333-333333333333";
const T = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-00000000000${n % 10}`;

let seq = 0;
let ts = Date.parse("2026-10-02T15:00:00.000Z");
const cmd = (type: CommandType, payload: unknown): CommandEnvelope => ({
  id: `e${String(++seq).padStart(7, "0")}-0000-4000-8000-000000000003`, type, userId: USER, deviceId: "server",
  clientTs: new Date((ts += 60_000)).toISOString(), payload,
});
const usd = (n: number, over: Record<string, unknown> = {}) => cmd("captureBankTransaction", {
  transactionId: T(n), accountId: CARD, source: "PDF", amount: 20, direction: "OUTFLOW", currencyCode: "USD",
  amountInBaseCurrency: 79_000, date: "2026-09-10", rawLine: `NETFLIX.COM ${n}`, description: "NETFLIX.COM", ...over,
});

describe.each(DRIVERS)("a card's USD section (S10-14) on %s", (_name, make) => {
  let driver: SqlDriver;
  async function setup() {
    driver = await make();
    await seedAccount(driver, { id: CARD, userId: USER, balance: 500_000, accountType: "CREDIT_CARD" });
    return createSqlStorage(driver);
  }
  const card = async (s: ReturnType<typeof createSqlStorage>) => (await s.getAccount(USER, CARD))!;

  it("a USD purchase raises the USD debt, not the pesos, and keeps its value in pesos", async () => {
    const s = await setup();
    expect(await applyCommand(s, usd(1))).toMatchObject({ status: "applied" });
    expect((await card(s)).currentBalance).toBe(500_000);
    expect((await card(s)).currencyBalances).toEqual({ USD: { current_balance: 20 } });
    expect(await s.getTransaction(USER, T(1))).toMatchObject({ currencyCode: "USD", amountInBaseCurrency: 79_000 });
  });

  it("ignoring a USD row gives back the USD debt (and counting it again takes it), never pesos", async () => {
    const s = await setup();
    await applyCommand(s, usd(1));
    await applyCommand(s, usd(2, { amount: 15 }));
    await applyCommand(s, cmd("setTransactionExcluded", { transactionId: T(1), excluded: true }));
    expect((await card(s)).currencyBalances?.USD?.current_balance).toBe(15);
    await applyCommand(s, cmd("setTransactionExcluded", { transactionId: T(1), excluded: false }));
    expect((await card(s)).currencyBalances?.USD?.current_balance).toBe(35);
    expect((await card(s)).currentBalance).toBe(500_000);
  });

  it("the USD statement anchors the USD balance at the cut plus later USD rows; pesos untouched", async () => {
    const s = await setup();
    await applyCommand(s, usd(1, { date: "2026-09-20", amount: 10 }));
    // A later COP purchase must not leak into the USD anchor.
    await applyCommand(s, usd(2, { currencyCode: "COP", amount: 50_000, amountInBaseCurrency: null, date: "2026-09-20", rawLine: "EXITO", description: "EXITO" }));
    expect(await applyCommand(s, cmd("anchorStatementBalance", { accountId: CARD, finalBalance: 120, asOf: "2026-09-15", currencyCode: "USD" })))
      .toMatchObject({ status: "applied", data: { balance: 130, currency: "USD" } });
    const c = await card(s);
    expect(c.currencyBalances?.USD?.current_balance).toBe(130);
    expect(c.currentBalance).toBe(550_000);
  });

  it("the pesos anchor ignores USD rows after the cut", async () => {
    const s = await setup();
    await applyCommand(s, usd(1, { date: "2026-09-20" }));
    expect(await applyCommand(s, cmd("anchorStatementBalance", { accountId: CARD, finalBalance: 300_000, asOf: "2026-09-15" })))
      .toMatchObject({ status: "applied", data: { balance: 300_000 } });
  });

  it("a USD row before the USD cut is already inside the anchored USD balance", async () => {
    const s = await setup();
    await applyCommand(s, cmd("anchorStatementBalance", { accountId: CARD, finalBalance: 100, asOf: "2026-09-15", currencyCode: "USD" }));
    await applyCommand(s, usd(1, { date: "2026-09-12" }));
    expect((await card(s)).currencyBalances?.USD?.current_balance).toBe(100);
  });
});

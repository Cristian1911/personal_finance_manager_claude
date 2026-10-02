import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import type { CommandEnvelope, CommandType } from "../types";
import { DRIVERS, seedAccount } from "./support/drivers";

// A card or loan balance is what you owe (v1 applyAccountBalanceDelta):
// a purchase raises it, a payment lowers it — the opposite of a bank account.

const USER = "11111111-1111-4111-8111-111111111111";
const CARD = "22222222-2222-4222-8222-222222222222";
const DEBIT = "66666666-6666-4666-8666-666666666666";
const TX = "33333333-3333-4333-8333-333333333333";

let seq = 0;
const cmd = (type: CommandType, payload: unknown, clientTs = "2026-09-18T15:00:00.000Z"): CommandEnvelope => ({
  id: `d${String(++seq).padStart(7, "0")}-0000-4000-8000-000000000000`, type, userId: USER, deviceId: "phone-1", clientTs, payload,
});
const capture = (accountId: string, direction: "INFLOW" | "OUTFLOW", amount: number, transactionId = TX) =>
  cmd("captureManualTransaction", { transactionId, accountId, amount, direction, currencyCode: "COP", date: "2026-09-18", description: "Compra" });

describe.each(DRIVERS)("debt account balances on %s", (_name, make) => {
  async function setup() {
    const d = await make();
    await seedAccount(d, { id: CARD, userId: USER, balance: 0, accountType: "CREDIT_CARD" });
    await seedAccount(d, { id: DEBIT, userId: USER, balance: 100000 });
    return createSqlStorage(d);
  }
  const balance = async (s: Awaited<ReturnType<typeof setup>>, id: string) => (await s.getAccount(USER, id))?.currentBalance;

  it("a card purchase raises what you owe; a payment into the card lowers it", async () => {
    const s = await setup();
    await applyCommand(s, capture(CARD, "OUTFLOW", 50000));
    expect(await balance(s, CARD)).toBe(50000);
    await applyCommand(s, capture(CARD, "INFLOW", 30000, "44444444-4444-4444-8444-444444444444"));
    expect(await balance(s, CARD)).toBe(20000);
  });

  it("deleting a card purchase takes it back off the debt", async () => {
    const s = await setup();
    await applyCommand(s, capture(CARD, "OUTFLOW", 50000));
    await applyCommand(s, cmd("deleteTransaction", { transactionId: TX }, "2026-09-18T16:00:00.000Z"));
    expect(await balance(s, CARD)).toBe(0);
  });

  it("ignoring a card purchase takes it off the debt; counting it again puts it back", async () => {
    const s = await setup();
    await applyCommand(s, capture(CARD, "OUTFLOW", 50000));
    await applyCommand(s, cmd("setTransactionExcluded", { transactionId: TX, excluded: true }, "2026-09-18T16:00:00.000Z"));
    expect(await balance(s, CARD)).toBe(0);
    await applyCommand(s, cmd("setTransactionExcluded", { transactionId: TX, excluded: false }, "2026-09-18T17:00:00.000Z"));
    expect(await balance(s, CARD)).toBe(50000);
  });

  it("moving a purchase from the card to the debit account clears the debt and spends the money", async () => {
    const s = await setup();
    await applyCommand(s, capture(CARD, "OUTFLOW", 50000));
    await applyCommand(s, cmd("editTransaction", { transactionId: TX, accountId: DEBIT }, "2026-09-18T16:00:00.000Z"));
    expect(await balance(s, CARD)).toBe(0);
    expect(await balance(s, DEBIT)).toBe(50000);
  });
});

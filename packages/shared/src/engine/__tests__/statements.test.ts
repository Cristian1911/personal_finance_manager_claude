import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import { readInicioData } from "../inicio-read";
import { planStatements, statementCommands, statementResult, statementReview, type StatementInput } from "../statements";
import type { CommandEnvelope, SqlDriver, StoragePort } from "../types";
import { DRIVERS } from "./support/drivers";
import { readStatementHistory } from "../disponible/extractos";

const USER = "11111111-1111-4111-8111-111111111111";
const SAVINGS = "22222222-2222-4222-8222-222222222222";

type Tx = StatementInput["transactions"][number];
const tx = (date: string, amount: number, description: string, over: Partial<Tx> = {}): Tx => ({
  date, description, amount, direction: "OUTFLOW", currency: "COP", installment_current: null, installment_total: null, original_amount: null, ...over,
});
const statement = (over: Partial<StatementInput>): StatementInput => ({
  bank: "BANCOLOMBIA", statement_type: "savings", account_number: "000-123-4821", card_last_four: null,
  period_from: "2026-09-01", period_to: "2026-09-30", currency: "COP", summary: { final_balance: 500_000 },
  credit_card_metadata: null, loan_metadata: null, transactions: [], ...over,
});
const savings = statement({ transactions: [
  tx("2026-09-05", 120_000, "PAGO ARRIENDO TRANSFERENCIA"),
  tx("2026-09-12", 90_000, "TRANSFERENCIA A NEQUI 3001234567"),
  tx("2026-09-12", 90_000, "TRANSFERENCIA A NEQUI 3001234567"),
] });
// Bancolombia's card statements bring no summary balance: what you owe is total_payment_due (like v1).
const card = statement({
  statement_type: "credit_card", account_number: null, card_last_four: "7706",
  summary: { final_balance: null, previous_balance: 210_000, purchases_and_charges: 160_000, interest_charged: 4_500 },
  credit_card_metadata: { credit_limit: 3_000_000, minimum_payment: 60_000, payment_due_date: "2026-10-12", total_payment_due: 260_000, interest_rate: 24.33 },
  transactions: [tx("2026-09-18", 100_000, "TIENDA X", { original_amount: 300_000, installment_current: 1, installment_total: 3 }), tx("2026-09-20", 160_000, "RESTAURANTE")],
});
const usd = { ...card, currency: "USD", transactions: [tx("2026-09-21", 12.5, "NETFLIX", { currency: "USD" })] };

let seq = 0;
let ts = Date.parse("2026-10-02T15:00:00.000Z");
const envelope = (type: string, payload: unknown): CommandEnvelope => ({
  id: `a${String(++seq).padStart(7, "0")}-0000-4000-8000-000000000003`, type: type as never, userId: USER, deviceId: "phone",
  clientTs: new Date((ts += 1000)).toISOString(), payload,
});

describe.each(DRIVERS)("statement import on the phone (planStatements + statementCommands) on %s", (_name, make) => {
  let driver: SqlDriver;
  let s: StoragePort;
  async function setup() {
    driver = await make();
    s = createSqlStorage(driver);
    // Told on Sep 1 (before the statement's rows): September's rows move it, the cut anchors it.
    await applyCommand(s, { ...envelope("createAccount", { accountId: SAVINGS, accountType: "SAVINGS", name: "Bancolombia", mask: "4821", currencyCode: "COP", balance: 1_000_000 }), clientTs: "2026-09-01T12:00:00.000Z" });
    await applyCommand(s, envelope("captureManualTransaction", { transactionId: "33333333-3333-4333-8333-333333333333", accountId: SAVINGS, amount: 120_000, direction: "OUTFLOW", currencyCode: "COP", date: "2026-09-05", description: "Pago arriendo" }));
    await applyCommand(s, envelope("captureManualTransaction", { transactionId: "44444444-4444-4444-8444-444444444444", accountId: SAVINGS, amount: 30_000, direction: "OUTFLOW", currencyCode: "COP", date: "2026-10-01", description: "Mercado" }));
  }
  const accounts = async () => (await readInicioData(driver, USER, "2026-09-01")).accounts.map((a) => ({ id: a.id, name: a.name, accountType: a.accountType, mask: a.mask, cutoffDay: a.cutoffDay }));
  async function importAll(statements: StatementInput[], choices: Parameters<typeof statementCommands>[3]) {
    const accs = await accounts();
    const work = await statementCommands(USER, statements, planStatements(statements, accs), choices, accs);
    const out = [];
    for (const w of work) {
      const results = [];
      for (const step of w.steps) results.push(await applyCommand(s, envelope(step.type, step.payload)));
      out.push(statementResult(w, results));
    }
    return out;
  }
  const balance = async (id: string) => (await s.getAccount(USER, id))?.currentBalance;

  it("matches a known account by its last 4 and offers to create an unknown card (D1)", async () => {
    await setup();
    const plans = planStatements([savings, card, usd], await accounts());
    expect(plans[0]).toMatchObject({ accountId: SAVINGS, last4: "4821" });
    expect(plans[1]).toMatchObject({ accountId: null, suggested: { name: "Bancolombia tarjeta ••7706", accountType: "CREDIT_CARD" } });
    expect(plans[2]).toMatchObject({ suggested: null, currency: "USD" });
  });

  it("imports: merges what you anotaste, keeps identical rows apart, anchors at the cut; creates the card; USD stays out", async () => {
    await setup();
    const [sv, cd, us] = await importAll([savings, card, usd], [{ index: 1, create: { name: "Bancolombia tarjeta ••7706" } }]);
    expect(sv).toMatchObject({ nuevos: 3, yaEstaban: 0, balance: 470_000 }); // 500.000 at the cut − 30.000 after it
    expect(await balance(SAVINGS)).toBe(470_000);
    expect(cd).toMatchObject({ created: true, nuevos: 2, balance: 260_000 });
    const cardAccount = (await accounts()).find((a) => a.accountType === "CREDIT_CARD")!;
    expect(cardAccount).toMatchObject({ mask: "7706", cutoffDay: 30 });
    expect(us).toMatchObject({ nuevos: 0, nota: expect.stringContaining("USD") });
    const live = (await readInicioData(driver, USER, "2026-09-01")).transactions.filter((t) => t.accountId === SAVINGS && !t.reconciledIntoTransactionId);
    expect(live).toHaveLength(4); // arriendo (merged), two transfers, mercado
  });

  it("keeps the card statement (minimum, due date, rate) and Disponible counts the minimum, not the whole bill (D24)", async () => {
    await setup();
    await importAll([card], [{ index: 0, create: { name: "Visa" } }]);
    const data = await readInicioData(driver, USER, "2026-09-01");
    expect(data.statements).toEqual([expect.objectContaining({ dueDate: "2026-10-12", minimum: 60_000, totalDue: 260_000, cutDate: "2026-09-30", rate: 24.33 })]);
    const cardId = data.accounts.find((a) => a.accountType === "CREDIT_CARD")!.id;
    expect(await readStatementHistory(driver, USER, cardId)).toEqual([expect.objectContaining({
      periodTo: "2026-09-30", totalDue: 260_000, minimum: 60_000, interestCharged: 4_500, purchases: 160_000, previousBalance: 210_000,
    })]);
  });

  it("a card statement without its cut date (the parser didn't find it) still sets what you owe and the payment day", async () => {
    await setup();
    const noCut = { ...card, period_from: null, period_to: null };
    const [r] = await importAll([noCut], [{ index: 0, create: { name: "Visa" } }]);
    expect(r).toMatchObject({ nuevos: 2, balance: 260_000, corte: null, pago: 12 });
    const cardId = (await accounts()).find((a) => a.accountType === "CREDIT_CARD")!.id;
    // The cut taken as its last movement's day (2026-09-20): it shows in the history.
    expect(await readStatementHistory(driver, USER, cardId)).toEqual([expect.objectContaining({ periodTo: "2026-09-20", minimum: 60_000 })]);
  });

  it("shows what a statement says before importing it: balance, minimum, due date, rate, interest at the minimum", () => {
    expect(statementReview(card)).toMatchObject({ saldo: 260_000, minimo: 60_000, vence: "2026-10-12", tasa: 24.33, movimientos: 2, intereses12: expect.any(Number) });
  });

  it("the same PDF again changes nothing (and never makes a second card)", async () => {
    await setup();
    await importAll([savings, card], [{ index: 1, create: { name: "x" } }]);
    const again = await importAll([savings, card], [{ index: 1, create: { name: "x" } }]);
    expect(again.map((r) => [r.created, r.nuevos, r.yaEstaban])).toEqual([[false, 0, 3], [false, 0, 2]]);
    expect(await balance(SAVINGS)).toBe(470_000);
    expect((await accounts()).filter((a) => a.accountType === "CREDIT_CARD")).toHaveLength(1);
  });
});

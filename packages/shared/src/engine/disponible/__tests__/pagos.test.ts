import { describe, expect, it } from "vitest";
import type { InicioTemplate } from "../../inicio-read";
import type { OccurrenceRow } from "../../types";
import type { InicioAccount } from "../inicio";
import type { StoredTransaction } from "../movements";
import { cycleBills, pagosView } from "../pagos";

const rent: InicioTemplate = {
  id: "rent", label: "Arriendo", amount: 1_200_000, direction: "OUTFLOW", frequency: "MONTHLY",
  startDate: "2026-09-05", endDate: null, accountId: null, isActive: true,
};
const netflix: InicioTemplate = { ...rent, id: "nf", label: "Netflix", amount: 45_000, startDate: "2026-09-12" };
const card: InicioAccount = {
  id: "card", name: "Tarjeta Nu", accountType: "CREDIT_CARD", currentBalance: 600_000, countsInDisponible: null,
  cutoffDay: 27, paymentDay: 12,
};
const loan: InicioAccount = {
  id: "loan", name: "Libre inversión", accountType: "LOAN", currentBalance: 3_000_000, countsInDisponible: null,
  paymentDay: 8, monthlyPayment: 98_000,
};
let n = 0;
const tx = (accountId: string, date: string, amount: number, direction: "INFLOW" | "OUTFLOW", over: Partial<StoredTransaction> = {}): StoredTransaction =>
  ({ id: `t${++n}`, accountId, date, amount, direction, currencyCode: "COP", flowClass: null, ...over });
const occ = (templateId: string, date: string, status: OccurrenceRow["status"], transactionId: string | null = null): OccurrenceRow =>
  ({ templateId, date, expectedAmount: 1_200_000, status, transactionId, linkedManually: false });

// Cycle 1–15 Oct (paid on the 1st and 15th; today the 6th).
const window = { from: "2026-10-01", to: "2026-10-15" };

describe("cycleBills: what has to be paid in a window (S8 Pagos, spec §4)", () => {
  it("each fixed payment's due date in the window, with its stored status", () => {
    const paid = tx("debit", "2026-10-05", 1_200_000, "OUTFLOW");
    const bills = cycleBills({ ...window, templates: [rent, netflix], occurrences: [occ("rent", "2026-10-05", "paid", paid.id)], accounts: [], transactions: [paid] });
    expect(bills.items.map((b) => [b.title, b.dueDate, b.status])).toEqual([["Arriendo", "2026-10-05", "paid"], ["Netflix", "2026-10-12", "pending"]]);
    expect(bills.occurrenceLinks).toEqual([{ transactionId: paid.id, occurrenceId: "rent:2026-10-05", isIncome: false }]);
    expect(bills.obligations.map((o) => o.id)).toEqual(["rent:2026-10-05", "nf:2026-10-12"]);
  });

  it("skipped is gone from what you owe but still listed", () => {
    const bills = cycleBills({ ...window, templates: [netflix], occurrences: [occ("nf", "2026-10-12", "skipped")], accounts: [], transactions: [] });
    expect(bills.items[0]).toMatchObject({ status: "skipped" });
    expect(bills.obligations).toEqual([]);
  });

  it("an archived payment stops after it was archived", () => {
    const bills = cycleBills({ ...window, templates: [{ ...rent, isActive: false }], occurrences: [], accounts: [], transactions: [] });
    expect(bills.items).toEqual([]);
  });

  it("a card bill: what was bought in its statement period (cut 27 sep), due on the 12th, estimated", () => {
    // In the period: 500.000. After the cut: 100.000 (next bill).
    const bills = cycleBills({ ...window, templates: [], occurrences: [], accounts: [card], transactions: [
      tx("card", "2026-09-15", 500_000, "OUTFLOW"), tx("card", "2026-09-30", 100_000, "OUTFLOW"),
    ] });
    expect(bills.items).toEqual([expect.objectContaining({ kind: "card", title: "Tarjeta Nu", dueDate: "2026-10-12", amount: 500_000, estimated: true, accountId: "card" })]);
    expect(bills.obligations[0]).toMatchObject({ id: "card:2026-10-12", kind: "card_bill", amount: 500_000, accountId: "card" });
  });

  it("a card payment before the window started counts as paid toward that bill", () => {
    const bills = cycleBills({ ...window, templates: [], occurrences: [], accounts: [card], transactions: [
      tx("card", "2026-09-15", 800_000, "OUTFLOW"), tx("card", "2026-09-29", 200_000, "INFLOW"),
    ] });
    expect(bills.obligations[0]).toMatchObject({ amount: 800_000, paidBefore: 200_000 });
    expect(bills.items[0]).toMatchObject({ amount: 800_000, paid: 200_000, status: "pending" });
  });

  it("a loan's cuota on its day", () => {
    const bills = cycleBills({ ...window, templates: [], occurrences: [], accounts: [loan], transactions: [] });
    expect(bills.items).toEqual([expect.objectContaining({ kind: "loan", title: "Libre inversión", dueDate: "2026-10-08", amount: 98_000 })]);
    expect(bills.obligations[0]).toMatchObject({ kind: "loan", accountId: "loan" });
  });
});

describe("pagosView (the Pagos tab)", () => {
  it("pending first by date, then paid; what's left to pay this cycle", () => {
    const paid = tx("debit", "2026-10-05", 1_200_000, "OUTFLOW");
    const bills = cycleBills({ ...window, templates: [rent, netflix], occurrences: [occ("rent", "2026-10-05", "paid", paid.id)], accounts: [loan], transactions: [paid] });
    const v = pagosView({ today: "2026-10-06", bills: bills.items });
    expect(v.left).toBe("$143.000");
    expect(v.rows.map((r) => [r.title, r.sub, r.amount])).toEqual([
      ["Libre inversión", "Vence el 8 oct", "$98.000"],
      ["Netflix", "Vence el 12 oct", "$45.000"],
      ["Arriendo", "Pagado", "$1.200.000"],
    ]);
  });

  it("past its date and unpaid says so", () => {
    const bills = cycleBills({ ...window, templates: [rent], occurrences: [], accounts: [], transactions: [] });
    expect(pagosView({ today: "2026-10-06", bills: bills.items }).rows[0]).toMatchObject({ sub: "Venció el 5 oct", tone: "warn" });
  });
});

describe("cycleBills — review fixes", () => {
  it("the card bill is what was bought with the card in that statement period, not all the debt", () => {
    // Cut 27: the bill due 12 oct covers 28 aug–27 sep. Old debt (told when the card was added) isn't this bill.
    const c = { ...card, currentBalance: 3_000_000 };
    const bills = cycleBills({ ...window, templates: [], occurrences: [], accounts: [c], transactions: [
      tx("card", "2026-08-20", 900_000, "OUTFLOW"), tx("card", "2026-09-10", 120_000, "OUTFLOW"), tx("card", "2026-09-26", 80_000, "OUTFLOW"),
      tx("card", "2026-09-30", 50_000, "OUTFLOW"),
    ] });
    expect(bills.items[0]).toMatchObject({ kind: "card", dueDate: "2026-10-12", amount: 200_000 });
  });

  it("a loan cuota paid late doesn't also pay the next one", () => {
    const bills = cycleBills({ from: "2026-10-01", to: "2026-11-15", templates: [], occurrences: [], accounts: [loan],
      transactions: [tx("loan", "2026-10-19", 98_000, "INFLOW")] });
    expect(bills.items.map((b) => [b.dueDate, b.status])).toEqual([["2026-10-08", "paid"], ["2026-11-08", "pending"]]);
  });

  it("after the amount is edited, a pending bill uses the new amount", () => {
    const bills = cycleBills({ ...window, templates: [{ ...rent, amount: 1_300_000 }],
      occurrences: [{ templateId: "rent", date: "2026-10-05", expectedAmount: 1_200_000, status: "pending", transactionId: null, linkedManually: false }],
      accounts: [], transactions: [] });
    expect(bills.items[0].amount).toBe(1_300_000);
  });
});

describe("a card bill with a USD section (S10-14)", () => {
  const st = (currency: string, minimum: number) => ({ accountId: "card", currency, cutDate: "2026-09-27", dueDate: "2026-10-12", minimum, totalDue: minimum, rate: 24 });
  const base = { ...window, templates: [], occurrences: [], accounts: [card] };

  it("pesos minimum + USD minimum at today's dollar + 3 %, keeping the dollars apart", () => {
    const bills = cycleBills({ ...base, transactions: [], statements: [st("COP", 60_000), st("USD", 12.5)], usdRate: 4_000 });
    expect(bills.items[0]).toMatchObject({ kind: "card", amount: 111_500, usd: 12.5, estimated: false });
    expect(bills.obligations[0]).toMatchObject({ amount: 111_500 });
  });

  it("with no dollar on the phone yet, only the pesos count; the dollars still show", () => {
    const bills = cycleBills({ ...base, transactions: [], statements: [st("COP", 60_000), st("USD", 12.5)] });
    expect(bills.items[0]).toMatchObject({ amount: 60_000, usd: 12.5 });
  });

  it("before any statement, a USD purchase counts by its value in pesos", () => {
    const bills = cycleBills({ ...base, transactions: [
      tx("card", "2026-09-15", 100_000, "OUTFLOW"),
      tx("card", "2026-09-20", 20, "OUTFLOW", { currencyCode: "USD", amountInBaseCurrency: 80_000 }),
    ] });
    // 80.000 at the day's rate, + 3 % like the bank charges.
    expect(bills.items[0]).toMatchObject({ amount: 182_400, usd: 20, estimated: true });
  });
});

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

  it("a card bill: what you owed at the cut (27 sep), due on the 12th, estimated", () => {
    // After the cut: a purchase of 100.000 (not in this bill).
    const bills = cycleBills({ ...window, templates: [], occurrences: [], accounts: [card], transactions: [tx("card", "2026-09-30", 100_000, "OUTFLOW")] });
    expect(bills.items).toEqual([expect.objectContaining({ kind: "card", title: "Tarjeta Nu", dueDate: "2026-10-12", amount: 500_000, estimated: true, accountId: "card" })]);
    expect(bills.obligations[0]).toMatchObject({ id: "card:2026-10-12", kind: "card_bill", amount: 500_000, estimated: true, accountId: "card" });
  });

  it("a card payment before the window started counts as paid toward that bill", () => {
    const bills = cycleBills({ ...window, templates: [], occurrences: [], accounts: [card], transactions: [tx("card", "2026-09-29", 200_000, "INFLOW")] });
    // Owed at the cut: 600.000 + 200.000 paid after it = 800.000; 200.000 already paid.
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

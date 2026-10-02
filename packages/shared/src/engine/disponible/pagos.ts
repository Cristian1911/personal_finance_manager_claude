import { isDebtAccountType } from "../../utils/account-balance";
import { occurrenceDates } from "../commands/pagos";
import type { InicioTemplate } from "../inicio-read";
import type { OccurrenceRow } from "../types";
import { PAID_TOLERANCE_PERCENT, type Obligation } from "./disponible";
import type { InicioAccount } from "./inicio";
import { occurrencesToCycleInputs, type OccurrenceLink, type StoredOccurrence, type StoredTransaction } from "./movements";
import { formatPesos } from "./verdict";
import { shortDate } from "./view";

export interface BillItem {
  /** "rent:2026-10-05", "card:2026-10-12", "loan:2026-10-08" — also the obligation's id. */
  id: string;
  kind: "fijo" | "card" | "loan";
  title: string;
  dueDate: string;
  amount: number;
  /** Already paid toward it (card/loan partial payments). */
  paid: number;
  status: "pending" | "paid" | "skipped";
  /** Card bills before the statement: what was owed at the cut. */
  estimated?: boolean;
  templateId?: string;
  accountId?: string;
}

const cents = (n: number) => Math.round(n * 100) / 100;
const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const ymd = (y: number, m: number, d: number) => {
  const x = new Date(Date.UTC(y, m - 1, Math.min(d, new Date(Date.UTC(y, m, 0)).getUTCDate()), 12));
  return x.toISOString().slice(0, 10);
};
/** Every date with that day of the month inside [from, to]. */
function monthDays(day: number, from: string, to: string): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  for (;;) {
    const d = ymd(y, m, day);
    if (d > to) break;
    if (d >= from) out.push(d);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}
const live = (t: StoredTransaction) => !t.isExcluded && !t.reconciledIntoTransactionId;

/**
 * Everything due in [from, to] (spec §4: promised money is subtracted before
 * it's paid): fixed payments (computed dates + their stored status), card
 * bills (what was owed at the last cut, due on the payment day) and loan
 * cuotas. Returns Disponible's obligations and links too, so Inicio's Por
 * pagar and the Pagos tab are the same list.
 */
export function cycleBills(i: {
  from: string;
  to: string;
  templates: InicioTemplate[];
  occurrences: OccurrenceRow[];
  accounts: InicioAccount[];
  transactions: StoredTransaction[];
  /** Disponible's cycle start: a bill paid before it was paid "before". */
  cycleStart?: string;
  /** Which accounts count for Disponible: a bill paid from any other was paid "elsewhere". */
  counts?: (accountId: string) => boolean;
}): { items: BillItem[]; obligations: Obligation[]; occurrenceLinks: OccurrenceLink[] } {
  const stored = new Map(i.occurrences.map((o) => [`${o.templateId}:${o.date}`, o]));
  const items: BillItem[] = [];

  // ── Pagos fijos ──
  const occurrences: StoredOccurrence[] = [];
  const outflows = i.templates.filter((t) => t.direction === "OUTFLOW");
  for (const t of outflows) {
    for (const date of occurrenceDates(t, i.from, i.to)) {
      const key = `${t.id}:${date}`;
      const o = stored.get(key);
      // An archived payment only keeps the dates someone already acted on.
      if (!t.isActive && !o) continue;
      const status = o?.status ?? "pending";
      // Pending uses the template's amount (it may have been edited since the row was generated).
      const amount = o && o.status !== "pending" ? o.expectedAmount : t.amount;
      occurrences.push({ id: key, templateId: t.id, date, amount, status, transactionId: o?.transactionId ?? null });
      items.push({
        id: key, kind: "fijo", title: t.label || "Pago fijo", dueDate: date, amount, paid: status === "paid" ? amount : 0, status, templateId: t.id,
        ...(t.accountId ? { accountId: t.accountId } : {}),
      });
    }
  }
  const fromTemplates = occurrencesToCycleInputs({
    occurrences,
    templates: outflows.map((t) => ({ id: t.id, direction: t.direction, label: t.label || "Pago fijo" })),
    transactions: i.transactions,
  });
  const obligations: Obligation[] = [...fromTemplates.obligations];
  // A bill paid with a card, from an account apart, or before this cycle began is
  // already settled here: Disponible would never see that movement pay it, and
  // keeping it in Por pagar would subtract it twice (the card bill carries it later).
  const byId = new Map(i.transactions.map((t) => [t.id, t]));
  const occurrenceLinks = fromTemplates.occurrenceLinks.filter((l) => {
    const t = byId.get(l.transactionId);
    const elsewhere = !t || (i.counts && !i.counts(t.accountId)) || (i.cycleStart && t.date < i.cycleStart);
    if (!elsewhere) return true;
    const o = obligations.find((x) => x.id === l.occurrenceId);
    if (o) o.paidBefore = o.amount;
    return false;
  });

  // ── Tarjetas y créditos ──
  const into = (accountId: string, from: string, to: string) => i.transactions
    .filter((t) => live(t) && t.accountId === accountId && t.date >= from && t.date <= to);
  const sum = (ts: StoredTransaction[], dir: "INFLOW" | "OUTFLOW") => cents(ts.filter((t) => t.direction === dir).reduce((s, t) => s + t.amount, 0));
  for (const a of i.accounts.filter((x) => isDebtAccountType(x.accountType) && x.paymentDay)) {
    const card = a.accountType === "CREDIT_CARD";
    for (const due of monthDays(a.paymentDay!, i.from, i.to)) {
      let amount: number;
      let since: string;
      let until: string;
      if (card) {
        // The statement cut before this due date: same month if it comes first, else the month before.
        const [y, m] = [Number(due.slice(0, 4)), Number(due.slice(5, 7))];
        const cutDay = a.cutoffDay ?? a.paymentDay!;
        const prevMonth = (yy: number, mm: number) => (mm === 1 ? [yy - 1, 12] : [yy, mm - 1]);
        const [cy, cm] = cutDay < a.paymentDay! ? [y, m] : prevMonth(y, m);
        const cut = ymd(cy, cm, cutDay);
        const [py, pm] = prevMonth(cy, cm);
        // This bill = what was bought with the card in its statement period (owner note D11): debt from
        // before (told when the card was added, or earlier statements) is debt, not this bill.
        amount = sum(into(a.id, addDays(ymd(py, pm, cutDay), 1), cut), "OUTFLOW");
        since = addDays(cut, 1);
        // Payments after the next cut belong to the next bill.
        const [ny, nm] = cm === 12 ? [cy + 1, 1] : [cy, cm + 1];
        until = ymd(ny, nm, cutDay);
      } else {
        amount = a.monthlyPayment ?? 0;
        // Each cuota's own window (±15 days, months don't overlap): a late payment pays
        // its own cuota and never also the next one.
        since = addDays(due, -15);
        until = addDays(due, 14);
      }
      if (amount <= 0) continue;
      const paidBefore = sum(into(a.id, since, addDays(i.from, -1)), "INFLOW");
      const paidAll = sum(into(a.id, since, until), "INFLOW");
      const id = `${card ? "card" : "loan"}:${due}`;
      // Not "estimated" for Disponible: that rule settles a bill on any payment, and a small
      // payment toward the card must lower what's left, not erase it.
      obligations.push({
        id, kind: card ? "card_bill" : "loan", label: a.name || (card ? "Tarjeta" : "Crédito"), dueDate: due, amount, accountId: a.id,
        ...(paidBefore > 0 ? { paidBefore } : {}),
      });
      items.push({
        id, kind: card ? "card" : "loan", title: a.name || (card ? "Tarjeta" : "Crédito"), dueDate: due, amount,
        paid: Math.min(amount, paidAll), status: paidAll * 100 >= PAID_TOLERANCE_PERCENT * amount ? "paid" : "pending",
        accountId: a.id, ...(card ? { estimated: true } : {}),
      });
    }
  }

  items.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
  return { items, obligations, occurrenceLinks };
}

export interface PagoRow {
  id: string;
  kind: BillItem["kind"];
  title: string;
  /** "Vence el 12 oct", "Vence hoy", "Venció el 5 oct", "Pagado", "Este mes no". */
  sub: string;
  amount: string;
  status: BillItem["status"];
  tone: "neutral" | "warn" | "ok";
  item: BillItem;
}

export interface PagosView {
  /** What's still to pay in the window ("$143.000"), or null when nothing. */
  left: string | null;
  rows: PagoRow[];
}

/** The Pagos tab: pending by date first (overdue says so), then skipped and paid. */
export function pagosView(i: { today: string; bills: BillItem[] }): PagosView {
  const order = { pending: 0, skipped: 1, paid: 2 } as const;
  const rows = [...i.bills]
    .sort((a, b) => order[a.status] - order[b.status] || a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id))
    .map((b): PagoRow => {
      const owed = cents(b.amount - b.paid);
      const late = b.status === "pending" && b.dueDate < i.today;
      const sub = b.status === "paid" ? "Pagado"
        : b.status === "skipped" ? "Este mes no"
        : b.dueDate === i.today ? "Vence hoy"
        : late ? `Venció el ${shortDate(b.dueDate)}` : `Vence el ${shortDate(b.dueDate)}`;
      return {
        id: b.id, kind: b.kind, title: b.title, sub,
        amount: `${b.estimated && b.status === "pending" ? "≈ " : ""}${formatPesos(b.status === "pending" ? owed : b.amount)}`,
        status: b.status, tone: late ? "warn" : b.status === "paid" ? "ok" : "neutral", item: b,
      };
    });
  const left = cents(i.bills.filter((b) => b.status === "pending").reduce((s, b) => s + b.amount - b.paid, 0));
  return { left: left > 0 ? formatPesos(left) : null, rows };
}

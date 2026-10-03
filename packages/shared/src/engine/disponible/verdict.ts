import { addDays, type IsoDate } from "./dates";

/** One verdict for Disponible, límites and trips (S3-4). */
export type DisponibleVerdictState = "vas_bien" | "cuidado" | "te_pasaste";

export type DisponibleVerdictReason =
  | { code: "on_track"; perDay: number }
  | { code: "overspent"; amount: number }
  | { code: "low_pace"; maxPerDay: number; until: IsoDate | null }
  /** Not negative, but nothing left to spend per day until payday. */
  | { code: "nothing_left"; until: IsoDate | null }
  | { code: "bill_at_risk"; label: string; dueDate: IsoDate }
  | { code: "next_cycle_short"; amount: number }
  /** Shown state is still the worse one while the better one holds for 24 h. */
  | { code: "recovering" };

/** What the caller stores between evaluations for the no-flicker rule. */
export interface DisponibleVerdictMemo {
  shown: DisponibleVerdictState;
  /** The better state seen since `since` (continuously); promoted after 24 h. */
  better?: { state: DisponibleVerdictState; since: string };
}

export interface DisponibleVerdictInput {
  disponible: number;
  perDay: number;
  startingPerDay: number;
  nextPayday: IsoDate | null;
  /** From findBillAtRisk. */
  billAtRisk?: { label: string; dueDate: IsoDate } | null;
  /** Next cycle's projected Disponible would be below 0 by this much (S3-5). */
  nextCycleShortBy?: number | null;
  /** ISO instant. */
  now: string;
  memo?: DisponibleVerdictMemo | null;
}

export interface DisponibleVerdict {
  /** What the pill shows. */
  state: DisponibleVerdictState;
  /** The verdict right now, before the no-flicker rule. */
  raw: DisponibleVerdictState;
  reason: DisponibleVerdictReason;
  memo: DisponibleVerdictMemo;
}

/** Cuidado below this share of the cycle's starting per-day; one threshold everywhere. */
export const CUIDADO_PERCENT = 85;
export const IMPROVE_AFTER_MS = 24 * 3_600_000;
const SEVERITY: Record<DisponibleVerdictState, number> = { vas_bien: 0, cuidado: 1, te_pasaste: 2 };

function rawVerdict(i: DisponibleVerdictInput): { state: DisponibleVerdictState; reason: DisponibleVerdictReason } {
  if (i.disponible < 0) return { state: "te_pasaste", reason: { code: "overspent", amount: -i.disponible } };
  if (i.billAtRisk) return { state: "cuidado", reason: { code: "bill_at_risk", ...i.billAtRisk } };
  if (i.perDay <= 0) return { state: "cuidado", reason: { code: "nothing_left", until: i.nextPayday } };
  // In whole percents so a float can't tip the boundary (85% of $40.000 is exactly $34.000).
  if (i.perDay * 100 < CUIDADO_PERCENT * i.startingPerDay) {
    return { state: "cuidado", reason: { code: "low_pace", maxPerDay: i.perDay, until: i.nextPayday } };
  }
  if (i.nextCycleShortBy && i.nextCycleShortBy > 0) {
    return { state: "cuidado", reason: { code: "next_cycle_short", amount: i.nextCycleShortBy } };
  }
  return { state: "vas_bien", reason: { code: "on_track", perDay: i.perDay } };
}

/**
 * Vas bien / Cuidado / Te pasaste. Gets worse immediately; gets better only
 * after the better state has held for 24 h, so a refund doesn't make the pill
 * jump back and forth. Store the returned memo and pass it next time.
 */
export function computeVerdict(input: DisponibleVerdictInput): DisponibleVerdict {
  const raw = rawVerdict(input);
  const memo = input.memo;
  if (!memo || SEVERITY[raw.state] >= SEVERITY[memo.shown]) {
    return { state: raw.state, raw: raw.state, reason: raw.reason, memo: { shown: raw.state } };
  }
  // The clock restarts whenever the better state changes: a state must itself hold 24 h.
  const since = memo.better?.state === raw.state ? memo.better.since : input.now;
  if (Date.parse(input.now) - Date.parse(since) >= IMPROVE_AFTER_MS) {
    return { state: raw.state, raw: raw.state, reason: raw.reason, memo: { shown: raw.state } };
  }
  return {
    state: memo.shown, raw: raw.state, reason: { code: "recovering" },
    memo: { shown: memo.shown, better: { state: raw.state, since } },
  };
}

/** $22.500: Colombian thousands separator, whole pesos. */
export function formatPesos(amount: number): string {
  const n = Math.round(Math.abs(amount));
  return `${amount < 0 ? "-" : ""}$${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

/** Dollars as Colombians read them (S10-14): "US$1.234,50"; whole amounts without cents ("US$45"). */
export function formatUsd(amount: number): string {
  const cents = Math.round(Math.abs(amount) * 100);
  const whole = String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const rest = cents % 100;
  return `${amount < 0 ? "-" : ""}US$${whole}${rest ? `,${String(rest).padStart(2, "0")}` : ""}`;
}

const dayOf = (d: IsoDate) => Number(d.slice(8, 10));

/** The Spanish line under the pill. */
export function verdictMessage(reason: DisponibleVerdictReason): string {
  switch (reason.code) {
    case "on_track":
      return `Puedes gastar hasta ${formatPesos(reason.perDay)} al día.`;
    case "overspent":
      return `Te pasaste por ${formatPesos(reason.amount)}. Lo restamos del próximo ciclo.`;
    case "low_pace":
      return `Para llegar ${reason.until ? `al ${dayOf(reason.until)}` : "a fin de mes"}, gasta máximo ${formatPesos(reason.maxPerDay)} al día.`;
    case "nothing_left":
      return `No te queda para gastar ${reason.until ? `hasta el ${dayOf(reason.until)}` : "este mes"}.`;
    case "bill_at_risk":
      return `Tu saldo no alcanza para ${reason.label}, que vence el ${dayOf(reason.dueDate)}.`;
    case "next_cycle_short":
      return `El próximo ciclo quedaría corto por ${formatPesos(reason.amount)}.`;
    case "recovering":
      return "Vas mejorando. Lo confirmamos en 24 horas.";
  }
}

/** A bill is at risk when it's due within this many days and the money isn't there. */
export const BILL_RISK_DAYS = 3;

/**
 * The first bill due in the next 3 days (or overdue) that the counted balances won't
 * cover, paying them in due order. A bill with `payFromAccountId` is checked
 * against that account; the rest against the total.
 */
export function findBillAtRisk(input: {
  today: IsoDate;
  bills: { label: string; dueDate: IsoDate; amount: number; payFromAccountId?: string }[];
  balances: { accountId: string; balance: number }[];
}): { label: string; dueDate: IsoDate } | null {
  const horizon = addDays(input.today, BILL_RISK_DAYS);
  const byAccount = new Map(input.balances.map((b) => [b.accountId, b.balance]));
  let pool = input.balances.reduce((a, b) => a + b.balance, 0);
  const due = input.bills
    // Overdue unpaid bills are the most at risk.
    .filter((b) => b.amount > 0 && b.dueDate <= horizon)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  for (const b of due) {
    const from = b.payFromAccountId;
    const available = from ? Math.min(byAccount.get(from) ?? 0, pool) : pool;
    if (available < b.amount) return { label: b.label, dueDate: b.dueDate };
    if (from) byAccount.set(from, (byAccount.get(from) ?? 0) - b.amount);
    pool -= b.amount;
  }
  return null;
}

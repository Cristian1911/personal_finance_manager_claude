import { detectRecurringCandidates, type RecurringCandidateTransaction } from "../../utils/recurring-candidates";
import type { IsoDate } from "./dates";
import type { InicioAccount } from "./inicio";
import type { StoredTransaction } from "./movements";
import { movementTime, readableName, shortDate, signedPesos } from "./view";
import { colombiaTime } from "./widgets";

/** A bank movement held because it may be one you anotaste (S1-2: never resolved alone). */
export interface PosibleDuplicado {
  id: string;
  /** "¿Es el mismo que anotaste?" — both sides, as the user wrote / the bank said them. */
  banco: { title: string; amount: string; date: string; account: string };
  /** Null when what you anotaste isn't on the phone anymore: then it's only "¿cuenta?". */
  tuyo: { title: string; amount: string; date: string } | null;
}

/** Revisar's possible duplicates, newest first. */
export function posiblesDuplicados(
  transactions: StoredTransaction[],
  accounts: Pick<InicioAccount, "id" | "name">[],
): PosibleDuplicado[] {
  const byId = new Map(transactions.map((t) => [t.id, t]));
  const label = new Map(accounts.map((a) => [a.id, a.name?.trim() || "Cuenta"]));
  const side = (t: StoredTransaction) => ({
    title: readableName(t.description?.trim() || "Movimiento"),
    amount: signedPesos(t.direction === "OUTFLOW" ? -t.amount : t.amount),
    // The time helps tell them apart (3:26 at the bank vs 3:25 anotado).
    date: [shortDate(t.date), movementTime(t, colombiaTime)].filter(Boolean).join(" · "),
  });
  return transactions
    .filter((t) => t.status === "PENDING" && t.reconciledIntoTransactionId)
    .map((t) => {
      const twin = byId.get(t.reconciledIntoTransactionId!);
      return { id: t.id, banco: { ...side(t), account: label.get(t.accountId) ?? "Cuenta" }, tuyo: twin ? side(twin) : null };
    })
    .sort((a, b) => (byId.get(b.id)!.date < byId.get(a.id)!.date ? -1 : 1));
}

/** A fixed payment Zeta saw repeat every month (S10-6): "¿Pagas Netflix cada mes?". */
export interface PagoFijoSugerido {
  /** Stable across reloads: answered "No" is remembered by it. */
  key: string;
  name: string;
  /** The median charge, rounded to the peso. */
  amount: number;
  /** 1–28 (createPagoFijo's range; 29–31 move to 28). */
  dayOfMonth: number;
  /** The first due date from today, for createPagoFijo. */
  startDate: IsoDate;
  /** "5 ago y 5 sep": what Zeta saw. */
  seen: string;
  transactionIds: string[];
}

/**
 * The first due date of a fixed payment on `day`: this month when the day
 * hasn't passed, else next month (a passed day was most likely paid and is
 * inside today's balance). Same rule as onboarding.
 */
export function firstPagoDate(day: number, today: IsoDate): IsoDate {
  const d = Math.min(Math.max(Math.trunc(day), 1), 28);
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const [sy, sm] = d >= Number(today.slice(8, 10)) ? [y, m] : m === 12 ? [y + 1, 1] : [y, m + 1];
  return `${sy}-${String(sm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Monthly charges that look like a bill and aren't one yet: none of their
 * movements paid an occurrence, no fixed payment has their name, and the
 * user didn't already say no. COP only (fixed payments are in pesos).
 */
export function pagosFijosSugeridos(input: {
  transactions: StoredTransaction[];
  templates: { label: string; isActive?: boolean }[];
  occurrences: { transactionId: string | null }[];
  destinatarios: { id: string; name: string }[];
  dismissed: string[];
  today: IsoDate;
}): PagoFijoSugerido[] {
  const linked = new Set(input.occurrences.map((o) => o.transactionId).filter(Boolean) as string[]);
  const names = new Map(input.destinatarios.map((d) => [d.id, d.name]));
  const taken = new Set(input.templates.map((t) => norm(t.label)));
  const dismissed = new Set(input.dismissed);

  const rows: RecurringCandidateTransaction[] = input.transactions
    .filter((t) => t.currencyCode === "COP" && !t.isExcluded && !t.reconciledIntoTransactionId && !t.transferGroupId && t.status !== "PENDING")
    .map((t) => ({
      id: t.id,
      destinatario_id: t.destinatarioId ?? null,
      clean_description: t.description ?? null,
      transaction_date: t.date,
      amount: t.amount,
      currency_code: t.currencyCode,
      direction: t.direction,
      flow_class: t.flowClass,
    }));

  return detectRecurringCandidates(rows)
    .filter((c) => !dismissed.has(c.key) && !c.transaction_ids.some((id) => linked.has(id)))
    .map((c) => {
      const raw = (c.destinatario_id && names.get(c.destinatario_id)) || c.clean_description || "Pago";
      const day = Math.min(c.day_of_month, 28);
      return {
        key: c.key,
        name: readableName(raw.trim()),
        amount: Math.round(c.median_amount),
        dayOfMonth: day,
        startDate: firstPagoDate(day, input.today),
        seen: c.dates.slice(-2).map(shortDate).join(" y "),
        transactionIds: c.transaction_ids,
      };
    })
    .filter((s) => !taken.has(norm(s.name)))
    .sort((a, b) => b.amount - a.amount);
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

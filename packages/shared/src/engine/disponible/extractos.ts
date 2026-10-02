import { toDialect } from "../sql";
import type { SqlDriver } from "../types";
import { formatPesos } from "./verdict";
import { shortDate, signedPesos } from "./view";

/** One statement of a card or loan, as kept (statement_snapshots). */
export interface StatementHistoryRow {
  id: string;
  periodFrom: string | null;
  periodTo: string;
  /** What you owed at the cut (total_payment_due). */
  totalDue: number | null;
  minimum: number | null;
  dueDate: string | null;
  /** E.A., in percent. */
  rate: number | null;
  interestCharged: number | null;
  purchases: number | null;
  previousBalance: number | null;
}

const num = (v: unknown) => (v == null ? null : Number(v));

/** All of an account's statements (COP), oldest first. */
export async function readStatementHistory(driver: SqlDriver, userId: string, accountId: string): Promise<StatementHistoryRow[]> {
  const pg = driver.dialect === "postgres";
  const d = (c: string) => (pg ? `${c}::text` : c);
  const rows = await driver.query<Record<string, unknown>>(toDialect(
    `SELECT id, ${d("period_from")} AS period_from, ${d("period_to")} AS period_to, total_payment_due, minimum_payment,
            ${d("payment_due_date")} AS payment_due_date, interest_rate, interest_charged, purchases_and_charges, previous_balance
       FROM statement_snapshots WHERE user_id = ? AND account_id = ? AND currency_code = 'COP' AND period_to IS NOT NULL
      ORDER BY period_to`, driver.dialect), [userId, accountId]);
  return rows.map((r) => ({
    id: String(r.id), periodFrom: (r.period_from as string | null) ?? null, periodTo: String(r.period_to),
    totalDue: num(r.total_payment_due), minimum: num(r.minimum_payment), dueDate: (r.payment_due_date as string | null) ?? null,
    rate: num(r.interest_rate), interestCharged: num(r.interest_charged), purchases: num(r.purchases_and_charges), previousBalance: num(r.previous_balance),
  }));
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const monthOf = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface ExtractoRow {
  id: string;
  /** "Septiembre 2026": the month of its cut. */
  mes: string;
  debes: string | null;
  /** "+$150.000 frente a agosto": the debt against the statement before. */
  cambio: string | null;
  cambioTone: "ok" | "bad" | "neutral";
  intereses: string | null;
  minimo: string | null;
  /** "Vence el 12 oct" / "Venció el 12 sep". */
  estado: string | null;
}

/**
 * A card's statements month to month (Cuenta › Extractos), and for one just
 * imported: did it make a payment, and how did the debt move.
 */
export function extractosView(history: StatementHistoryRow[], today: string) {
  const sorted = [...history].sort((a, b) => a.periodTo.localeCompare(b.periodTo));
  const prevOf = (i: number) => (i > 0 ? sorted[i - 1] : undefined);
  const diff = (i: number) => {
    const cur = sorted[i].totalDue;
    const prev = prevOf(i)?.totalDue;
    return cur != null && prev != null ? Math.round(cur - prev) : null;
  };
  const rows: ExtractoRow[] = sorted.map((s, i) => {
    const d = diff(i);
    return {
      id: s.id,
      mes: `${cap(monthOf(s.periodTo))} ${s.periodTo.slice(0, 4)}`,
      debes: s.totalDue != null ? formatPesos(Math.round(s.totalDue)) : null,
      cambio: d != null && d !== 0 ? `${d > 0 ? "+" : ""}${signedPesos(d)} frente a ${monthOf(prevOf(i)!.periodTo)}` : d === 0 ? `Igual que en ${monthOf(prevOf(i)!.periodTo)}` : null,
      cambioTone: (d == null || d === 0 ? "neutral" : d > 0 ? "bad" : "ok") as ExtractoRow["cambioTone"],
      intereses: s.interestCharged != null ? formatPesos(Math.round(s.interestCharged)) : null,
      minimo: s.minimum != null ? formatPesos(Math.round(s.minimum)) : null,
      estado: s.dueDate ? `${s.dueDate >= today ? "Vence" : "Venció"} el ${shortDate(s.dueDate)}` : null,
    };
  }).reverse();

  /** The import summary's two lines for the statement cut on `periodTo`. */
  const outcome = (periodTo: string | null): { pago: string | null; deuda: string | null } => {
    const i = sorted.findIndex((s) => s.periodTo === periodTo);
    if (i < 0) return { pago: null, deuda: null };
    const s = sorted[i];
    const pago = s.minimum == null || !s.dueDate ? null
      : s.minimum <= 0 ? "No crea un pago: el mínimo es $0."
        : s.dueDate >= today
          ? `Creó un pago en Pagos: mínimo ${formatPesos(Math.round(s.minimum))}, vence el ${shortDate(s.dueDate)}. Ya cuenta en tu Disponible.`
          : `No crea un pago: venció el ${shortDate(s.dueDate)} (es un extracto viejo).`;
    const d = diff(i);
    const prev = prevOf(i);
    const deuda = s.totalDue == null ? null : [
      `Debes ${formatPesos(Math.round(s.totalDue))}`,
      d == null ? "" : d === 0 ? `: lo mismo que en el extracto de ${monthOf(prev!.periodTo)}` : `: ${formatPesos(Math.abs(d))} ${d > 0 ? "más" : "menos"} que en el extracto de ${monthOf(prev!.periodTo)}`,
      ".",
      s.interestCharged ? ` Intereses del mes: ${formatPesos(Math.round(s.interestCharged))}.` : "",
    ].join("");
    return { pago, deuda };
  };
  return { rows, outcome };
}

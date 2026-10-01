import { defaultCountsInDisponible } from "../commands/set-account-counts-in-disponible";
import type { PayCycle } from "./cycle";
import { diffDays, dayOfWeek, type IsoDate } from "./dates";
import type { InicioAccount } from "./inicio";
import type { StoredTransaction } from "./movements";
import { formatPesos } from "./verdict";
import { cycleLabel, shortDate, signedPesos } from "./view";
import { colombiaTime, relativeDay } from "./widgets";

/**
 * Movimientos and the Detalle sheet (Claude Design "Z Cuentas": movs,
 * detalle). Every string is decided here; the phone only draws. Categories
 * arrive with M3 and merchants' bank text with M2, so neither shows yet.
 */

export type MovimientosFilter = "todos" | "gastos" | "entradas" | "tarjetas";
/** out = spending (red), in = money in (green), card = on a card (gray), neutral = doesn't count. */
export type MovimientoTone = "out" | "in" | "card" | "neutral";

export interface MovimientoRow {
  id: string;
  initial: string;
  title: string;
  amount: string;
  tone: MovimientoTone;
  /** "12:41", when the capture time is known. */
  time: string | null;
  account: string;
  /** "Ignorado" / "No cuenta" in place of the category chip. */
  status: string | null;
  spoken: string;
}

export interface MovimientosGroup {
  date: IsoDate;
  /** "Hoy · jue 18", "Ayer · mié 17", "Lun 15". */
  label: string;
  /** What moved that day, counting only what counts. */
  total: string;
  rows: MovimientoRow[];
}

export interface MovimientosView {
  /** "Este ciclo · 15–29 sep". */
  cycle: string;
  canOlder: boolean;
  canNewer: boolean;
  filters: { key: MovimientosFilter; label: string; on: boolean }[];
  groups: MovimientosGroup[];
  /** Why the list is empty, or null. */
  empty: string | null;
}

export interface DetalleView {
  id: string;
  initial: string;
  title: string;
  /** "Hoy 12:41 · Cuenta". */
  subtitle: string;
  amount: string;
  tone: MovimientoTone;
  /** "Cuenta para Disponible": Sí / No · why; `accountToggle` when the answer is the account's. */
  counts: { value: string; accountId: string; accountToggle: "on" | "off" | null };
  note: string | null;
  /** Where it came from: "Anotado a mano · 18 sep 12:41". */
  source: string;
  excluded: boolean;
}

const FILTERS: { key: MovimientosFilter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "gastos", label: "Gastos" },
  { key: "entradas", label: "Entradas" },
  { key: "tarjetas", label: "Tarjetas" },
];
const WEEKDAY = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const ACCOUNT_LABEL: Record<string, string> = { CREDIT_CARD: "Tarjeta", LOAN: "Préstamo", CASH: "Efectivo", SAVINGS: "Ahorros" };
const SOURCE: Record<string, string> = {
  MANUAL_FORM: "Anotado a mano", TEXT_QUICK_CAPTURE: "Anotado a mano",
  PDF_IMPORT: "Extracto PDF", EMAIL_PDF_IMPORT: "Extracto PDF por correo",
  EMAIL_IMPORT: "Correo del banco", NOTIFICATION: "Notificación del banco",
  OCR_BATCH: "Captura de pantalla", OCR_SINGLE: "Captura de pantalla",
};
const isDebt = (type: string) => type === "CREDIT_CARD" || type === "LOAN";
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const titleOf = (t: StoredTransaction) => t.description?.trim() || (t.direction === "INFLOW" ? "Entrada" : "Gasto");
const range = (c: { start: IsoDate; end: IsoDate }) => cycleLabel(c).replace(/^Ciclo /, "").replace(" – ", "–");

interface Account { type: string; counts: boolean; label: string }

function accountsById(accounts: InicioAccount[]): Map<string, Account> {
  return new Map(accounts.map((a) => [a.id, {
    type: a.accountType,
    counts: !isDebt(a.accountType) && (a.countsInDisponible ?? defaultCountsInDisponible(a.accountType)),
    label: ACCOUNT_LABEL[a.accountType] ?? "Cuenta",
  }]));
}

function toneOf(t: StoredTransaction, a: Account | undefined): MovimientoTone {
  if (t.isExcluded || !a) return "neutral";
  if (isDebt(a.type)) return t.direction === "OUTFLOW" ? "card" : "neutral"; // a card payment isn't income
  if (!a.counts) return "neutral";
  return t.direction === "INFLOW" ? "in" : "out";
}

function amountOf(t: StoredTransaction, tone: MovimientoTone): string {
  if (tone === "neutral") return formatPesos(t.amount);
  return t.direction === "INFLOW" ? `+${formatPesos(t.amount)}` : `−${formatPesos(t.amount)}`;
}

function statusOf(t: StoredTransaction, a: Account | undefined): string | null {
  if (t.isExcluded) return "Ignorado";
  if (a && !isDebt(a.type) && !a.counts) return "No cuenta";
  return null;
}

function dayLabel(today: IsoDate, d: IsoDate): string {
  const weekday = WEEKDAY[dayOfWeek(d)];
  const n = diffDays(d, today);
  if (n === 0) return `Hoy · ${weekday} ${Number(d.slice(8))}`;
  if (n === 1) return `Ayer · ${weekday} ${Number(d.slice(8))}`;
  return `${cap(weekday)} ${Number(d.slice(8))}`;
}

/**
 * One cycle of movements, newest day first. `cycles` is newest first (this
 * cycle, then the ones before it that the phone still holds); `index` picks one.
 */
export function movimientosView(input: {
  today: IsoDate;
  transactions: StoredTransaction[];
  accounts: InicioAccount[];
  cycles: PayCycle[];
  index: number;
  filter: MovimientosFilter;
  query: string;
}): MovimientosView {
  const { today, cycles, filter } = input;
  const index = Math.max(0, Math.min(cycles.length - 1, input.index));
  const c = cycles[index];
  const accounts = accountsById(input.accounts);
  const q = fold(input.query.trim());

  const inCycle = input.transactions.filter((t) => t.date >= c.start && t.date <= c.end && !t.reconciledIntoTransactionId);
  const shown = inCycle.filter((t) => {
    const a = accounts.get(t.accountId);
    if (filter === "gastos" && t.direction !== "OUTFLOW") return false;
    if (filter === "entradas" && t.direction !== "INFLOW") return false;
    if (filter === "tarjetas" && a?.type !== "CREDIT_CARD") return false;
    return !q || fold(`${titleOf(t)} ${t.notes ?? ""}`).includes(q);
  }).sort((x, y) => y.date.localeCompare(x.date) || (y.createdAt ?? "").localeCompare(x.createdAt ?? "") || y.id.localeCompare(x.id));

  const groups: MovimientosGroup[] = [];
  for (const t of shown) {
    let g = groups[groups.length - 1];
    if (!g || g.date !== t.date) {
      g = { date: t.date, label: dayLabel(today, t.date), total: "", rows: [] };
      groups.push(g);
    }
    const a = accounts.get(t.accountId);
    const tone = toneOf(t, a);
    const title = titleOf(t);
    const amount = amountOf(t, tone);
    const time = t.createdAt ? colombiaTime(t.createdAt) : null;
    const status = statusOf(t, a);
    const account = a?.label ?? "Cuenta";
    g.rows.push({
      id: t.id, initial: title.charAt(0).toUpperCase(), title, amount, tone, time, account, status,
      spoken: [title, amount.replace(/−/g, "menos ").replace(/^\+/, "más "), status, time, account].filter(Boolean).join(", "),
    });
  }
  for (const g of groups) {
    const net = shown
      .filter((t) => t.date === g.date && toneOf(t, accounts.get(t.accountId)) !== "neutral")
      .reduce((s, t) => s + (t.direction === "INFLOW" ? t.amount : -t.amount), 0);
    g.total = net > 0 ? `+${formatPesos(net)}` : signedPesos(Math.round(net * 100) / 100);
  }

  const name = index === 0 ? "Este ciclo" : index === 1 ? "Ciclo pasado" : "Antes";
  return {
    cycle: `${name} · ${range(c)}`,
    canOlder: index < cycles.length - 1,
    canNewer: index > 0,
    filters: FILTERS.map((f) => ({ ...f, on: f.key === filter })),
    groups,
    empty: groups.length > 0 ? null
      : q ? `Nada con «${input.query.trim()}».`
      : filter !== "todos" ? "Nada con ese filtro en este ciclo."
      : "No hay movimientos en este ciclo.",
  };
}

/** The Detalle sheet of one movement (the same sheet for every row). */
export function detalleView(input: { today: IsoDate; transaction: StoredTransaction; accounts: InicioAccount[] }): DetalleView {
  const { today, transaction: t } = input;
  const a = accountsById(input.accounts).get(t.accountId);
  const tone = toneOf(t, a);
  const title = titleOf(t);
  const time = t.createdAt ? colombiaTime(t.createdAt) : null;
  const when = `${relativeDay(today, t.date)}${time ? ` ${time}` : ""}`;
  const account = a?.label ?? "Cuenta";

  let counts: DetalleView["counts"];
  if (t.isExcluded) counts = { value: "No · lo ignoraste", accountId: t.accountId, accountToggle: null };
  else if (!a || isDebt(a.type)) counts = { value: `No · ${a?.type === "LOAN" ? "es un préstamo" : "va a la factura"}`, accountId: t.accountId, accountToggle: null };
  else counts = { value: a.counts ? "Sí" : "No · esta cuenta no cuenta", accountId: t.accountId, accountToggle: a.counts ? "on" : "off" };

  const captured = t.createdAt ? `${shortDate(t.date)} ${colombiaTime(t.createdAt)}` : shortDate(t.date);
  return {
    id: t.id, initial: title.charAt(0).toUpperCase(), title,
    subtitle: `${when} · ${account}`,
    amount: amountOf(t, tone), tone, counts,
    note: t.notes?.trim() || null,
    source: `${SOURCE[t.captureMethod ?? ""] ?? "Registrado"} · ${captured}`,
    excluded: !!t.isExcluded,
  };
}

import { MANUAL_CAPTURE_METHODS } from "../commands/delete-transaction";
import { defaultCountsInDisponible } from "../commands/set-account-counts-in-disponible";
import type { PayCycle } from "./cycle";
import { diffDays, dayOfWeek, type IsoDate } from "./dates";
import type { InicioAccount } from "./inicio";
import type { StoredTransaction } from "./movements";
import { formatPesos } from "./verdict";
import { cycleLabel, signedPesos } from "./view";
import { colombiaTime, relativeDay } from "./widgets";
import { categoryById } from "../categories";

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
  /** The category's name, or null. */
  category: string | null;
  categoryId: string | null;
  /** Who it is (comercio or persona), or null. */
  destinatario: { id: string; name: string; kind: "merchant" | "person" } | null;
  /** The movement's own text (bank or typed), to remember a destinatario by. */
  description: string | null;
  direction: "INFLOW" | "OUTFLOW";
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
  /** The account the list is narrowed to (a removable chip), or null. */
  account: { id: string; label: string } | null;
}

export type DetalleSource = "manual" | "email" | "notification" | "pdf" | "screenshot" | "other";

export interface DetalleView {
  id: string;
  initial: string;
  title: string;
  amount: string;
  tone: MovimientoTone;
  source: DetalleSource;
  /** "Correo · hoy 12:41 · Cuenta" */
  facts: string;
  /** Only when it doesn't count: "No cuenta · va a la factura", "No cuenta · lo ignoraste". */
  status: string | null;
  note: string | null;
  excluded: boolean;
  /** Written down by hand: amount and date can be fixed; "No es un movimiento" deletes it. */
  manual: boolean;
  /** Raw values for the fix form. */
  raw: { amount: number; date: IsoDate };
}

const FILTERS: { key: MovimientosFilter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "gastos", label: "Gastos" },
  { key: "entradas", label: "Entradas" },
  { key: "tarjetas", label: "Tarjetas" },
];
const WEEKDAY = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const ACCOUNT_LABEL: Record<string, string> = { CREDIT_CARD: "Tarjeta", LOAN: "Préstamo", CASH: "Efectivo", SAVINGS: "Ahorros" };
const SOURCE_OF: Record<string, DetalleSource> = {
  MANUAL_FORM: "manual", TEXT_QUICK_CAPTURE: "manual",
  EMAIL_IMPORT: "email", NOTIFICATION: "notification",
  PDF_IMPORT: "pdf", EMAIL_PDF_IMPORT: "pdf",
  OCR_BATCH: "screenshot", OCR_SINGLE: "screenshot",
};
const SOURCE_WORD: Record<DetalleSource, string> = {
  manual: "A mano", email: "Correo", notification: "Notificación", pdf: "Extracto", screenshot: "Captura", other: "Registrado",
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
    label: a.name?.trim() || (ACCOUNT_LABEL[a.accountType] ?? "Cuenta"),
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
  /** Only this account's movements (Cuenta › Ver todos). */
  accountId?: string | null;
  /** Comercios and personas, to show who each movement is. */
  destinatarios?: { id: string; name: string; kind: "merchant" | "person" }[];
}): MovimientosView {
  const who = new Map((input.destinatarios ?? []).map((d) => [d.id, d]));
  const { today, cycles, filter } = input;
  const index = Math.max(0, Math.min(cycles.length - 1, input.index));
  const c = cycles[index];
  const accounts = accountsById(input.accounts);
  const q = fold(input.query.trim());

  const inCycle = input.transactions.filter((t) => t.date >= c.start && t.date <= c.end && !t.reconciledIntoTransactionId);
  const shown = inCycle.filter((t) => {
    const a = accounts.get(t.accountId);
    if (input.accountId && t.accountId !== input.accountId) return false;
    if (filter === "gastos" && t.direction !== "OUTFLOW") return false;
    if (filter === "entradas" && t.direction !== "INFLOW") return false;
    if (filter === "tarjetas" && a?.type !== "CREDIT_CARD") return false;
    const d = t.destinatarioId ? who.get(t.destinatarioId) : undefined;
    return !q || fold(`${titleOf(t)} ${t.notes ?? ""} ${d?.name ?? ""} ${categoryById(t.categoryId)?.name ?? ""}`).includes(q);
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
    const destinatario = (t.destinatarioId && who.get(t.destinatarioId)) || null;
    const title = destinatario?.name ?? titleOf(t);
    const amount = amountOf(t, tone);
    const time = t.createdAt ? colombiaTime(t.createdAt) : null;
    const status = statusOf(t, a);
    const account = a?.label ?? "Cuenta";
    const category = categoryById(t.categoryId)?.name ?? null;
    g.rows.push({
      id: t.id, initial: title.charAt(0).toUpperCase(), title, amount, tone, time, account, status,
      spoken: [title, amount.replace(/−/g, "menos ").replace(/^\+/, "más "), status, category, time, account].filter(Boolean).join(", "),
      category, categoryId: t.categoryId ?? null, destinatario, description: t.description ?? null, direction: t.direction,
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
      : filter !== "todos" || input.accountId ? "Nada con ese filtro en este ciclo."
      : "No hay movimientos en este ciclo.",
    account: input.accountId ? { id: input.accountId, label: accounts.get(input.accountId)?.label ?? "Cuenta" } : null,
  };
}

/** The Detalle sheet of one movement, design A (the same sheet for every row). */
export function detalleView(input: { today: IsoDate; transaction: StoredTransaction; accounts: InicioAccount[] }): DetalleView {
  const { today, transaction: t } = input;
  const a = accountsById(input.accounts).get(t.accountId);
  const tone = toneOf(t, a);
  const title = titleOf(t);
  const source = SOURCE_OF[t.captureMethod ?? ""] ?? "other";
  const time = t.createdAt ? ` ${colombiaTime(t.createdAt)}` : "";
  const when = relativeDay(today, t.date);
  const facts = `${SOURCE_WORD[source]} · ${when === "Hoy" || when === "Ayer" ? when.toLowerCase() : when}${time} · ${a?.label ?? "Cuenta"}`;

  let status: string | null = null;
  if (t.isExcluded) status = "No cuenta · lo ignoraste";
  else if (!a || isDebt(a.type)) status = `No cuenta · ${a?.type === "LOAN" ? "es un préstamo" : "va a la factura"}`;
  else if (!a.counts) status = "No cuenta · esa cuenta está aparte";

  return {
    id: t.id, initial: title.charAt(0).toUpperCase(), title,
    amount: amountOf(t, tone), tone, source, facts, status,
    note: t.notes?.trim() || null,
    excluded: !!t.isExcluded,
    manual: MANUAL_CAPTURE_METHODS.has(t.captureMethod ?? ""),
    raw: { amount: t.amount, date: t.date },
  };
}

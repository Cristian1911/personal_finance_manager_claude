import type { PayCycle } from "./cycle";
import { addDays, diffDays, type IsoDate } from "./dates";
import type { DisponibleMovement, DisponibleResult, Obligation } from "./disponible";
import type { StoredTransaction } from "./movements";
import { BILL_RISK_DAYS, CUIDADO_PERCENT, findBillAtRisk, formatPesos } from "./verdict";
import { shortDate, signedPesos } from "./view";

/**
 * Inicio's first six widgets (docs/mlp/13-widget-design-rules.md, spec
 * docs/superpowers/specs/2026-10-01-v2-inicio-widgets-design.md). Every
 * string, visual value and alert is decided here; the phone only draws.
 */

export type WidgetKey = "flujo" | "hoy" | "pago" | "teDeben" | "tarjeta" | "ultimos";
export type WidgetSize = "half" | "full";
export type WidgetLevel = "amber" | "red";

/** The centered chip: a reason of at most 4 words. Red also gets a full outline. */
export interface WidgetAttention {
  level: WidgetLevel;
  reason: string;
}

export type WidgetVisual =
  | { kind: "bar"; percent: number; level: WidgetLevel | null }
  | { kind: "initials"; letters: string[] }
  /** Day-by-day amounts; points after `todayIndex` are projected (dashed). */
  | { kind: "line"; points: number[]; todayIndex: number };

export interface WidgetRow {
  id: string;
  title: string;
  detail: string;
  amount: string;
  level?: WidgetLevel | null;
}

export interface InicioWidget {
  key: WidgetKey;
  /** Unique on the grid (one Tarjeta per card). */
  id: string;
  title: string;
  size: WidgetSize;
  attention: WidgetAttention | null;
  /** Nothing to show yet (first week, no data): the hint says why. */
  empty: boolean;
  /** Collapsed: one primary value (semibold, auto-fit), or null. */
  value: string | null;
  /** Collapsed: at most 3 muted words. */
  hint: string | null;
  /** Collapsed sentence of full widgets that show a visual plus one line (Tu flujo). */
  caption: string | null;
  visual: WidgetVisual | null;
  /** Collapsed rows of full widgets (Últimos movimientos: 3). */
  previewRows: WidgetRow[];
  // ── Expanded ──
  lead: string | null;
  rows: WidgetRow[];
  totals: { label: string; amount: string }[];
  note: string | null;
}

/** Hoy turns amber at this share of today's allowance (the verdict's threshold). */
export const HOY_AMBER_PERCENT = CUIDADO_PERCENT;
/** Te deben: amber when the oldest debt is this old, red at the second. */
export const TE_DEBEN_AMBER_DAYS = 30;
export const TE_DEBEN_RED_DAYS = 60;
/** Tarjeta: amber when the statement cut is this close. */
export const CARD_CUT_SOON_DAYS = 2;
export const ULTIMOS_COLLAPSED = 3;
export const ULTIMOS_EXPANDED = 5;

/** Someone who owes you (Te deben), from personal debts. */
export interface PersonOwing {
  id: string;
  name: string;
  amount: number;
  since: IsoDate;
}

/** One credit card, once its data exists (statement or PDF). */
export interface CardSummary {
  accountId: string;
  name: string;
  /** The next bill so far (≈ until the statement). */
  estimatedBill: number;
  /** Projected at the cut at today's pace. */
  projectedAtCut?: number | null;
  usedPercent?: number | null;
  cutDate?: IsoDate | null;
  dueDate?: IsoDate | null;
  minimum?: number | null;
  totalOwed?: number | null;
}

export interface InicioWidgetsInput {
  today: IsoDate;
  cycle: PayCycle;
  result: DisponibleResult;
  /** Classified movements (toDisponibleMovements). */
  movements: DisponibleMovement[];
  /** Counted, non-debt accounts. */
  counted: ReadonlySet<string>;
  /** For descriptions and capture times (Últimos movimientos). */
  transactions: StoredTransaction[];
  obligations?: Obligation[];
  balances?: { accountId: string; balance: number }[];
  people?: PersonOwing[];
  youOwe?: { name: string; amount: number }[];
  cards?: CardSummary[];
}

const cents = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => cents(xs.reduce((a, b) => a + b, 0));
const floorTo100 = (n: number) => Math.floor(n / 100) * 100;
const clampPercent = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const days = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;
const dayNumber = (d: IsoDate) => Number(d.slice(8, 10));

function base(key: WidgetKey, title: string, size: WidgetSize): InicioWidget {
  return {
    key, id: key, title, size, attention: null, empty: false, value: null, hint: null, caption: null,
    visual: null, previewRows: [], lead: null, rows: [], totals: [], note: null,
  };
}

/** Colombian wall time "8:10" of an instant (no DST: always UTC−5). */
function colombiaTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 5 * 3_600_000);
  return `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function relativeDay(today: IsoDate, d: IsoDate): string {
  const n = diffDays(d, today);
  if (n === 0) return "Hoy";
  if (n === 1) return "Ayer";
  return shortDate(d);
}

/** Spending (minus refunds) on counted accounts, by day. */
function spendByDay(i: InicioWidgetsInput): Map<IsoDate, number> {
  const byDay = new Map<IsoDate, number>();
  for (const m of i.movements) {
    if (!i.counted.has(m.accountId) || m.date < i.cycle.start || m.date > i.today) continue;
    const sign = m.kind === "spend" ? 1 : m.kind === "refund" ? -1 : 0;
    if (sign) byDay.set(m.date, cents((byDay.get(m.date) ?? 0) + sign * m.amount));
  }
  return byDay;
}

// ── Tu flujo (mini) ──

export function flujoWidget(i: InicioWidgetsInput): InicioWidget {
  const w = base("flujo", "Tu flujo", "full");
  const { result: r, cycle, today } = i;
  const byDay = spendByDay(i);
  const elapsed = diffDays(cycle.start, today) + 1;
  const spent = sum([...byDay.values()]);
  const pace = elapsed > 0 ? Math.max(0, spent) / elapsed : 0;
  const future = Math.max(0, r.daysLeft - 1);
  // ponytail: straight-line pace from this cycle's spending; bills on their dates,
  // the next cycle (amber) and drag-to-read come with the Tu flujo screen.
  const end = cents(r.disponible - pace * future);

  const total = diffDays(cycle.start, cycle.end) + 1;
  const todayIndex = Math.min(total - 1, Math.max(0, elapsed - 1));
  const points: number[] = [];
  for (let k = 0; k < total; k++) {
    const d = addDays(cycle.start, k);
    if (k <= todayIndex) {
      // Back out what was spent after that day, so today lands exactly on Disponible.
      let after = 0;
      for (const [day, amount] of byDay) if (day > d && day <= today) after += amount;
      points.push(cents(r.disponible + after));
    } else {
      points.push(cents(r.disponible - pace * (k - todayIndex)));
    }
  }
  w.visual = { kind: "line", points, todayIndex };

  const until = i.cycle.nextPayday ? `al ${dayNumber(i.cycle.nextPayday)}` : "a fin de mes";
  if (end < 0) {
    const runOut = pace > 0 && r.disponible > 0 ? addDays(today, Math.floor(r.disponible / pace) + 1) : today;
    w.attention = { level: "red", reason: `No llegas ${until}` };
    const cut = future > 0 ? Math.ceil((pace - Math.max(0, r.disponible) / future) / 1000) * 1000 : 0;
    w.caption = `A tu ritmo te quedas sin plata el ${shortDate(runOut)}${cut > 0 ? ` · gasta ≈ ${formatPesos(cut)} menos al día` : ""}.`;
  } else {
    w.caption = `A tu ritmo terminas con ${signedPesos(end)}.`;
  }
  w.totals = [
    { label: "Llega", amount: signedPesos(r.llega.total) },
    { label: "Sale", amount: signedPesos(cents(r.llega.total - end)) },
    { label: "Terminas con", amount: signedPesos(end) },
  ];
  return w;
}

// ── Hoy ──

export function hoyWidget(i: InicioWidgetsInput): InicioWidget {
  const w = base("hoy", "Hoy", "half");
  const spent = Math.max(0, spendByDay(i).get(i.today) ?? 0);
  const daysLeft = Math.max(1, i.result.daysLeft);
  // This morning's per-day number: today's spending put back.
  const allowance = floorTo100((i.result.disponible + spent) / daysLeft);
  const left = cents(allowance - spent);
  const percent = allowance > 0 ? (spent * 100) / allowance : spent > 0 ? 101 : 0;

  let level: WidgetLevel | null = null;
  if (spent > 0 && percent > 100) level = "red";
  else if (spent > 0 && percent >= HOY_AMBER_PERCENT) level = "amber";
  w.attention = level === "red" ? { level, reason: "Te pasaste hoy" } : level ? { level, reason: "Casi al tope" } : null;

  w.value = signedPesos(left);
  w.visual = { kind: "bar", percent: clampPercent(percent), level };
  w.lead = level === "red"
    ? `Llevas ${formatPesos(spent)} de ${formatPesos(allowance)}. Mañana tendrás un poco menos por día.`
    : `Llevas ${formatPesos(spent)} de ${formatPesos(allowance)} hoy.`;
  w.rows = latest(i, (t) => t.date === i.today && t.direction === "OUTFLOW" && i.counted.has(t.accountId), 20);
  return w;
}

// ── Próximo pago ──

export function pagoWidget(i: InicioWidgetsInput): InicioWidget {
  const w = base("pago", "Próximo pago", "half");
  const due = new Map((i.obligations ?? []).map((o) => [o.id, o]));
  const open = i.result.porPagar.lines
    .filter((l) => l.amount > 0 && due.has(l.id))
    .map((l) => ({ line: l, dueDate: due.get(l.id)!.dueDate }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.line.label.localeCompare(b.line.label));

  if (open.length === 0) {
    w.empty = true;
    w.hint = "Sin pagos aún";
    w.lead = "Cuando agregues tus pagos fijos, aquí verás el próximo y cuánto falta.";
    return w;
  }

  const next = open[0];
  const inDays = diffDays(i.today, next.dueDate);
  const atRisk = findBillAtRisk({
    today: i.today,
    bills: open.map((o) => ({ label: o.line.label, dueDate: o.dueDate, amount: o.line.amount })),
    balances: i.balances ?? [],
  });
  if (atRisk) w.attention = { level: "red", reason: "No alcanza" };
  else if (inDays <= BILL_RISK_DAYS) w.attention = { level: "amber", reason: whenLabel(inDays) };

  w.value = `${next.line.estimated ? "≈ " : ""}${signedPesos(next.line.amount)}`;
  w.hint = `${next.line.label}, ${shortDate(next.dueDate)}`;
  const until = i.cycle.nextPayday ? ` antes del ${dayNumber(i.cycle.nextPayday)}` : "";
  w.lead = `Por pagar${until}: ${signedPesos(i.result.porPagar.total)}`;
  w.rows = open.map((o) => {
    const n = diffDays(i.today, o.dueDate);
    const risky = atRisk?.label === o.line.label && atRisk.dueDate === o.dueDate;
    return {
      id: o.line.id,
      title: o.line.label,
      detail: shortDate(o.dueDate),
      amount: `${o.line.estimated ? "≈ " : ""}${signedPesos(o.line.amount)}`,
      level: risky ? "red" : n <= BILL_RISK_DAYS ? "amber" : null,
    };
  });
  return w;
}

function whenLabel(inDays: number): string {
  if (inDays < 0) return "Vencido";
  if (inDays === 0) return "Hoy";
  if (inDays === 1) return "Mañana";
  return `En ${days(inDays)}`;
}

// ── Te deben ──

export function teDebenWidget(i: InicioWidgetsInput): InicioWidget {
  const w = base("teDeben", "Te deben", "half");
  const people = [...(i.people ?? [])].filter((p) => p.amount > 0)
    .sort((a, b) => a.since.localeCompare(b.since) || b.amount - a.amount);
  const youOwe = (i.youOwe ?? []).filter((p) => p.amount > 0);
  if (youOwe.length) {
    w.note = youOwe.map((p) => `Tú le debes a ${p.name} ${formatPesos(p.amount)}`).join(" · ") + " · está en Pagos.";
  }
  if (people.length === 0) {
    w.empty = true;
    w.hint = "Nadie te debe";
    w.lead = "Cuando prestes plata o dividas una compra, aquí verás quién te debe.";
    return w;
  }

  const age = (p: PersonOwing) => diffDays(p.since, i.today);
  const oldest = age(people[0]);
  if (oldest >= TE_DEBEN_RED_DAYS) w.attention = { level: "red", reason: `Hace ${days(oldest)}` };
  else if (oldest >= TE_DEBEN_AMBER_DAYS) w.attention = { level: "amber", reason: `Hace ${days(oldest)}` };

  w.value = signedPesos(sum(people.map((p) => p.amount)));
  w.visual = { kind: "initials", letters: people.slice(0, 3).map((p) => (p.name.trim()[0] ?? "?").toUpperCase()) };
  w.rows = people.map((p) => {
    const n = age(p);
    return {
      id: p.id,
      title: p.name,
      detail: n === 0 ? "Hoy" : `Hace ${days(n)}`,
      amount: signedPesos(p.amount),
      level: n >= TE_DEBEN_RED_DAYS ? "red" : n >= TE_DEBEN_AMBER_DAYS ? "amber" : null,
    };
  });
  return w;
}

// ── Tarjeta (one per card) ──

export function tarjetaWidget(i: InicioWidgetsInput, card: CardSummary): InicioWidget {
  const w = base("tarjeta", card.name, "half");
  w.id = `tarjeta:${card.accountId}`;
  w.value = `≈ ${signedPesos(card.estimatedBill)}`;
  w.hint = "próxima factura";
  if (card.usedPercent != null) w.visual = { kind: "bar", percent: clampPercent(card.usedPercent), level: null };

  if (card.dueDate && card.dueDate <= i.today && (card.minimum ?? card.estimatedBill) > 0) {
    w.attention = { level: "red", reason: card.dueDate < i.today ? "Pago vencido" : "Pago vence hoy" };
  } else if (card.cutDate) {
    const n = diffDays(i.today, card.cutDate);
    if (n >= 0 && n <= CARD_CUT_SOON_DAYS) {
      w.attention = { level: "amber", reason: n === 0 ? "Corte hoy" : `Corte en ${days(n)}` };
    }
  }

  const atCut = card.projectedAtCut != null ? ` · al corte ≈ ${signedPesos(card.projectedAtCut)} si sigues a este ritmo` : "";
  w.lead = `≈ ${signedPesos(card.estimatedBill)}${atCut}. Comprar con tarjeta no baja tu Disponible; pagarla sí.`;
  if (card.minimum != null) {
    w.rows.push({
      id: "minimum", title: "Pago mínimo",
      detail: `${card.dueDate ? `${shortDate(card.dueDate)} · ` : ""}cuenta en Disponible`,
      amount: signedPesos(card.minimum),
    });
  }
  if (card.totalOwed != null) {
    w.rows.push({
      id: "total", title: "Debes en total",
      detail: card.cutDate ? `Corte ${shortDate(card.cutDate)}` : "",
      amount: signedPesos(card.totalOwed),
    });
  }
  return w;
}

// ── Últimos movimientos ──

function latest(i: InicioWidgetsInput, keep: (t: StoredTransaction) => boolean, n: number): WidgetRow[] {
  // Only live rows (toDisponibleMovements dropped excluded and merged ones).
  const at = new Map(i.movements.map((m) => [m.id, m.at ?? ""]));
  return i.transactions
    .filter((t) => at.has(t.id) && keep(t))
    .sort((a, b) => b.date.localeCompare(a.date) || (at.get(b.id) ?? "").localeCompare(at.get(a.id) ?? "") || b.id.localeCompare(a.id))
    .slice(0, n)
    .map((t) => {
      const when = at.get(t.id);
      return {
        id: t.id,
        title: t.description?.trim() || (t.direction === "INFLOW" ? "Ingreso" : "Gasto"),
        detail: `${relativeDay(i.today, t.date)}${when ? ` · ${colombiaTime(when)}` : ""}`,
        amount: t.direction === "OUTFLOW" ? signedPesos(-t.amount) : signedPesos(t.amount),
      };
    });
}

export function ultimosWidget(i: InicioWidgetsInput): InicioWidget {
  const w = base("ultimos", "Últimos movimientos", "full");
  const rows = latest(i, (t) => t.date <= i.today, ULTIMOS_EXPANDED);
  if (rows.length === 0) {
    w.empty = true;
    w.hint = "Sin movimientos aún";
    w.lead = "Lo que anotes o llegue de tu banco aparece aquí.";
    return w;
  }
  w.previewRows = rows.slice(0, ULTIMOS_COLLAPSED);
  w.rows = rows;
  return w;
}

// ── Grid ──

/** The default layout (13 §Layout): Tu flujo · Hoy, Próximo pago · Te deben, Tarjeta(s) · Últimos movimientos. */
export function buildInicioWidgets(i: InicioWidgetsInput): InicioWidget[] {
  return [
    flujoWidget(i),
    hoyWidget(i),
    pagoWidget(i),
    teDebenWidget(i),
    ...(i.cards ?? []).map((c) => tarjetaWidget(i, c)),
    ultimosWidget(i),
  ];
}

/**
 * The widget that opens by itself (13 §Attention): the most critical, red
 * before amber, ties by layout order; once per day (`lastDay` = the day it
 * last happened).
 */
export function pickAutoOpen(widgets: InicioWidget[], lastDay: IsoDate | null, today: IsoDate): string | null {
  if (lastDay === today) return null;
  const red = widgets.find((w) => w.attention?.level === "red");
  return (red ?? widgets.find((w) => w.attention?.level === "amber"))?.id ?? null;
}

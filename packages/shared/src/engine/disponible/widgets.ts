import type { PayCycle } from "./cycle";
import { addDays, diffDays, type IsoDate } from "./dates";
import type { DisponibleMovement, DisponibleResult, Obligation } from "./disponible";
import type { StoredTransaction } from "./movements";
import { BILL_RISK_DAYS, CUIDADO_PERCENT, findBillAtRisk, formatPesos } from "./verdict";
import { shortDate, shortMoney, signedPesos } from "./view";

/**
 * Inicio's first six widgets (docs/mlp/13-widget-design-rules.md, spec
 * docs/superpowers/specs/2026-10-01-v2-inicio-widgets-design.md). Every
 * string, visual value and alert is decided here; the phone only draws.
 */

export type InicioWidgetKey = "flujo" | "hoy" | "pago" | "teDeben" | "tarjeta" | "ultimos";
export type InicioWidgetSize = "half" | "full";
export type InicioWidgetLevel = "amber" | "red";

/** The centered chip: a reason of at most 4 words. Red also gets a full outline. */
export interface InicioWidgetAttention {
  level: InicioWidgetLevel;
  reason: string;
}

export type InicioWidgetVisual =
  | { kind: "bar"; percent: number; level: InicioWidgetLevel | null }
  | { kind: "initials"; letters: string[] }
  /** Tu flujo (Z Grafico): one entry per day, the cycle plus 2 shaded days each side. */
  | { kind: "flow"; days: FlowDay[]; todayIndex: number; markIndex: number; bad: boolean };

/** A day of the Tu flujo chart. Up to today it's what happened; after, the projection. */
export interface FlowDay {
  date: IsoDate;
  /** Counted balance at the end of the day. */
  balance: number;
  /** Money in that arrived (filled bar up). */
  income: number;
  /** Salary expected that day (outlined bar up). */
  incomeExpected: number;
  /** Money that left (filled bar down). */
  spent: number;
  /** Bills due that day, still unpaid (outlined bar down). */
  bill: number;
  /** Estimated everyday spending at this cycle's pace (light bar down). */
  estimated: number;
  /** Outside the cycle (shaded). */
  edge: boolean;
  /** A card's statement cut (diamond). */
  cardCut: boolean;
}

export interface InicioWidgetRow {
  id: string;
  title: string;
  detail: string;
  amount: string;
  level?: InicioWidgetLevel | null;
}

export interface InicioWidget {
  key: InicioWidgetKey;
  /** Unique on the grid (one Tarjeta per card). */
  id: string;
  title: string;
  size: InicioWidgetSize;
  attention: InicioWidgetAttention | null;
  /** Nothing to show yet (first week, no data): the hint says why. */
  empty: boolean;
  /** Collapsed: one primary value (semibold, auto-fit), or null. */
  value: string | null;
  /** "$14,3 M": drawn only when `value` can't fit at 62% (13 §Visual); equals `value` under a million. */
  valueShort: string | null;
  /** Collapsed: at most 3 muted words. */
  hint: string | null;
  visual: InicioWidgetVisual | null;
  /** Collapsed rows of full widgets (Últimos movimientos: 3). */
  previewRows: InicioWidgetRow[];
  // ── Expanded ──
  lead: string | null;
  rows: InicioWidgetRow[];
  totals: { label: string; amount: string }[];
  note: string | null;
  /** Empty state: what you can do to fill it (the app maps ids to screens). */
  actions: { id: WidgetActionId; label: string }[];
  /** "Ver todo ›" target, or null while that screen doesn't exist. */
  seeAll: WidgetActionId | null;
}

export type WidgetActionId =
  | "capture" | "add_bill" | "import_statement" | "split_purchase" | "lend" | "add_card"
  | "see_movements" | "see_bills" | "see_people" | "see_accounts";

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

/** Days shown on each side of the cycle in Tu flujo. */
export const FLOW_EDGE_DAYS = 2;

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
  /** Counted balance now (Tu flujo's line); Disponible + Por pagar + Ahorro stands in when unknown. */
  balanceToday?: number | null;
  /** The salary expected on the next payday (Tu flujo's outlined bar). */
  nextIncome?: number;
}

const cents = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => cents(xs.reduce((a, b) => a + b, 0));
const floorTo100 = (n: number) => Math.floor(n / 100) * 100;
const clampPercent = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
/** "≈" never wraps away from its amount. */
const APPROX = "≈\u00a0";
const days = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;
const dayNumber = (d: IsoDate) => Number(d.slice(8, 10));

/** Sets the collapsed value and its short form ("≈ $14,3 M"). */
function setValue(w: InicioWidget, amount: number, prefix = ""): void {
  w.value = `${prefix}${signedPesos(amount)}`;
  w.valueShort = `${prefix}${shortMoney(amount)}`;
}

function base(key: InicioWidgetKey, title: string, size: InicioWidgetSize): InicioWidget {
  return {
    key, id: key, title, size, attention: null, empty: false, value: null, valueShort: null, hint: null,
    visual: null, previewRows: [], lead: null, rows: [], totals: [], note: null, actions: [], seeAll: null,
  };
}

/** Colombian wall time "8:10" of an instant (no DST: always UTC−5). */
export function colombiaTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 5 * 3_600_000);
  return `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** "Hoy", "Ayer" or "30 sep". */
export function relativeDay(today: IsoDate, d: IsoDate): string {
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

/** This cycle's everyday spending pace (spent so far ÷ days elapsed). */
function spendingPace(i: InicioWidgetsInput): number {
  const elapsed = diffDays(i.cycle.start, i.today) + 1;
  const spent = sum([...spendByDay(i).values()]);
  return elapsed > 0 ? Math.max(0, spent) / elapsed : 0;
}

/**
 * Tu flujo's chart: the counted balance day by day, what came in and went
 * out up to today, then the projection — expected salary, unpaid bills on
 * their dates, everyday spending at this cycle's pace.
 */
export function flowChart(i: InicioWidgetsInput): Extract<InicioWidgetVisual, { kind: "flow" }> {
  const { cycle, today, result: r } = i;
  const first = addDays(cycle.start, -FLOW_EDGE_DAYS);
  const n = diffDays(first, addDays(cycle.end, FLOW_EDGE_DAYS)) + 1;
  // ponytail: one pace for every future day; weekday patterns come with real history.
  const pace = Math.round(spendingPace(i));
  const todayIndex = Math.max(0, Math.min(n - 1, diffDays(first, today)));
  const cuts = new Set((i.cards ?? []).map((c) => c.cutDate).filter(Boolean));
  const days: FlowDay[] = Array.from({ length: n }, (_, k) => {
    const date = addDays(first, k);
    return {
      date, balance: 0, income: 0, incomeExpected: 0, spent: 0, bill: 0, estimated: 0,
      edge: date < cycle.start || date > cycle.end, cardCut: cuts.has(date),
    };
  });
  const at = (d: IsoDate) => days[diffDays(first, d)];

  for (const m of i.movements) {
    if (!i.counted.has(m.accountId) || m.kind === "ignored" || m.date < first || m.date > today) continue;
    const day = at(m.date);
    if (m.direction === "INFLOW") day.income = cents(day.income + m.amount);
    else day.spent = cents(day.spent + m.amount);
  }
  const due = new Map((i.obligations ?? []).map((o) => [o.id, o.dueDate]));
  for (const l of r.porPagar.lines) {
    const d = due.get(l.id);
    if (!d || l.amount <= 0) continue;
    // Overdue or due today and still unpaid: it lands tomorrow (today's balance is what's real).
    const day = d > today ? d : addDays(today, 1);
    if (day >= first && diffDays(first, day) < n) at(day).bill = cents(at(day).bill + l.amount);
  }
  if (cycle.nextPayday && cycle.nextPayday > today && i.nextIncome && diffDays(first, cycle.nextPayday) < n) {
    at(cycle.nextPayday).incomeExpected = i.nextIncome;
  }
  for (let k = todayIndex + 1; k < n; k++) days[k].estimated = pace;

  days[todayIndex].balance = cents(i.balanceToday ?? r.disponible + r.porPagar.total + r.ahorro.total);
  for (let k = todayIndex - 1; k >= 0; k--) {
    const next = days[k + 1];
    days[k].balance = cents(next.balance - next.income + next.spent);
  }
  for (let k = todayIndex + 1; k < n; k++) {
    const d = days[k];
    d.balance = cents(days[k - 1].balance + d.incomeExpected - d.bill - d.estimated);
  }

  const cycleEnd = diffDays(first, cycle.end);
  const runOut = days.findIndex((d, k) => k >= todayIndex && k <= cycleEnd && d.balance < 0);
  let low = todayIndex;
  for (let k = todayIndex; k <= cycleEnd; k++) if (days[k].balance < days[low].balance) low = k;
  return { kind: "flow", days, todayIndex, markIndex: runOut >= 0 ? runOut : low, bad: runOut >= 0 };
}

export function flujoWidget(i: InicioWidgetsInput): InicioWidget {
  const w = base("flujo", "Tu flujo", "full");
  const { result: r, today } = i;
  const pace = spendingPace(i);
  const future = Math.max(0, r.daysLeft - 1);
  // ponytail: straight-line pace from this cycle's spending; the next cycle (amber)
  // and drag-to-read come with the Tu flujo screen.
  const end = cents(r.disponible - pace * future);
  const chart = flowChart(i);
  w.visual = chart;

  const until = i.cycle.nextPayday ? `al ${dayNumber(i.cycle.nextPayday)}` : "a fin de mes";
  if (end < 0 || chart.bad) {
    const runOut = chart.bad ? chart.days[chart.markIndex].date
      : pace > 0 && r.disponible > 0 ? addDays(today, Math.floor(r.disponible / pace) + 1) : today;
    w.attention = { level: "red", reason: `No llegas ${until}` };
    const cut = future > 0 ? Math.ceil((pace - Math.max(0, r.disponible) / future) / 1000) * 1000 : 0;
    w.lead = `A tu ritmo te quedas sin plata ${runOut <= today ? "hoy" : `el ${shortDate(runOut)}`}${cut > 0 ? ` · gasta ${APPROX}${formatPesos(cut)} menos al día` : ""}.`;
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

  let level: InicioWidgetLevel | null = null;
  if (spent > 0 && percent > 100) level = "red";
  else if (spent > 0 && percent >= HOY_AMBER_PERCENT) level = "amber";
  w.attention = level === "red" ? { level, reason: "Te pasaste hoy" } : level ? { level, reason: "Casi al tope" } : null;

  setValue(w, left);
  w.visual = { kind: "bar", percent: clampPercent(percent), level };
  w.lead = level === "red"
    ? `Llevas ${formatPesos(spent)} de ${formatPesos(allowance)}. Mañana tendrás un poco menos por día.`
    : `Llevas ${formatPesos(spent)} de ${formatPesos(allowance)} hoy.`;
  w.rows = latest(i, (t) => t.date === i.today && t.direction === "OUTFLOW" && i.counted.has(t.accountId), 20);
  w.seeAll = "see_movements";
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
    w.lead = "Agrega tus pagos fijos (arriendo, servicios, cuotas) y Zeta los resta antes de que lleguen.";
    w.actions = [{ id: "add_bill", label: "Agregar pago fijo" }, { id: "import_statement", label: "Importar extracto" }];
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

  setValue(w, next.line.amount, next.line.estimated ? APPROX : "");
  w.hint = `${next.line.label}, ${shortDate(next.dueDate)}`;
  const until = i.cycle.nextPayday ? ` antes del ${dayNumber(i.cycle.nextPayday)}` : "";
  w.lead = `Por pagar${until}: ${signedPesos(i.result.porPagar.total)}`;
  w.seeAll = "see_bills";
  w.rows = open.map((o) => {
    const n = diffDays(i.today, o.dueDate);
    const risky = atRisk?.label === o.line.label && atRisk.dueDate === o.dueDate;
    return {
      id: o.line.id,
      title: o.line.label,
      detail: shortDate(o.dueDate),
      amount: `${o.line.estimated ? APPROX : ""}${signedPesos(o.line.amount)}`,
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
    w.lead = "Cuando prestes plata o dividas una compra, aquí ves quién te debe y desde cuándo.";
    w.actions = [{ id: "split_purchase", label: "Dividir una compra" }, { id: "lend", label: "Anotar un préstamo" }];
    return w;
  }

  const age = (p: PersonOwing) => diffDays(p.since, i.today);
  const oldest = age(people[0]);
  if (oldest >= TE_DEBEN_RED_DAYS) w.attention = { level: "red", reason: `Hace ${days(oldest)}` };
  else if (oldest >= TE_DEBEN_AMBER_DAYS) w.attention = { level: "amber", reason: `Hace ${days(oldest)}` };

  setValue(w, sum(people.map((p) => p.amount)));
  w.seeAll = "see_people";
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
  w.seeAll = "see_accounts";
  setValue(w, card.estimatedBill, APPROX);
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

  const atCut = card.projectedAtCut != null ? ` · al corte ${APPROX}${signedPesos(card.projectedAtCut)} si sigues a este ritmo` : "";
  w.lead = `${APPROX}${signedPesos(card.estimatedBill)}${atCut}. Comprar con tarjeta no baja tu Disponible; pagarla sí.`;
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

/** No card with data yet: the slot teaches what it's for and how to fill it. */
export function tarjetaEmptyWidget(): InicioWidget {
  const w = base("tarjeta", "Tarjeta", "half");
  w.empty = true;
  w.hint = "Sin tarjetas aún";
  w.lead = "Agrega tu tarjeta para ver tu próxima factura y cuándo pagarla. Comprar con tarjeta no baja tu Disponible; pagarla sí.";
  w.actions = [{ id: "add_card", label: "Agregar tarjeta" }, { id: "import_statement", label: "Importar extracto" }];
  return w;
}

// ── Últimos movimientos ──

function latest(i: InicioWidgetsInput, keep: (t: StoredTransaction) => boolean, n: number): InicioWidgetRow[] {
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
    w.actions = [{ id: "capture", label: "Anotar un gasto" }];
    return w;
  }
  w.seeAll = "see_movements";
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
    ...(i.cards?.length ? i.cards.map((c) => tarjetaWidget(i, c)) : [tarjetaEmptyWidget()]),
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

// ── Organizar ──

/** Allowed sizes per widget, smallest first (13 §Widget catalog). */
export const WIDGET_SIZES: Record<InicioWidgetKey, InicioWidgetSize[]> = {
  flujo: ["half", "full"],
  hoy: ["half"],
  pago: ["half", "full"],
  teDeben: ["half"],
  tarjeta: ["half", "full"],
  ultimos: ["full"],
};

/** The user's Inicio: visible widgets in order with their size; `hidden` were removed. */
export interface InicioLayout {
  items: { id: string; size: InicioWidgetSize }[];
  hidden: string[];
}

const keyOf = (id: string) => id.split(":")[0] as InicioWidgetKey;

/**
 * The default widgets arranged as the user left them. Widgets the layout
 * doesn't know yet (a new card) keep their default place relative to the end;
 * a size the widget doesn't allow falls back to its smallest. A full Próximo
 * pago or Tarjeta also shows its next rows collapsed.
 */
export function applyInicioLayout(widgets: InicioWidget[], layout: InicioLayout | null): InicioWidget[] {
  const byId = new Map(widgets.map((w) => [w.id, w]));
  const hidden = new Set(layout?.hidden ?? []);
  const placed = new Set<string>();
  const out: InicioWidget[] = [];
  const add = (w: InicioWidget, size: InicioWidgetSize) => {
    const allowed = WIDGET_SIZES[keyOf(w.id)];
    const s = allowed.includes(size) ? size : allowed[0];
    const preview = s === "full" && (w.key === "pago" || w.key === "tarjeta") && !w.empty;
    // New objects only when something changes: the input lives in React state.
    out.push(s === w.size && !preview ? w : { ...w, size: s, ...(preview ? { previewRows: w.rows.slice(0, 3) } : {}) });
    placed.add(w.id);
  };
  for (const item of layout?.items ?? []) {
    const w = byId.get(item.id);
    if (w && !hidden.has(w.id)) add(w, item.size);
  }
  for (const w of widgets) if (!placed.has(w.id) && !hidden.has(w.id)) add(w, w.size);
  return out;
}

/** The layout a grid shows, for saving after Organizar. */
export const layoutOf = (widgets: InicioWidget[], hidden: string[]): InicioLayout =>
  ({ items: widgets.map((w) => ({ id: w.id, size: w.size })), hidden });

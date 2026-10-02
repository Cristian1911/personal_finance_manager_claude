import { dayOfWeek, diffDays, type IsoDate } from "./dates";
import type { ApproxReason, DisponibleResult } from "./disponible";
import { formatPesos, verdictMessage, type DisponibleVerdict, type DisponibleVerdictState } from "./verdict";

/**
 * Everything the Inicio Disponible block says, as Spanish strings, so the
 * phone component only draws. Copy follows the session-5 prototype
 * and Claude Design's Z Disponible: pill, "Te pagan en N días", the big
 * number, "$35.000 al día" and "+$X cuando te paguen" (the next salary).
 */
export interface DisponibleBlockView {
  state: DisponibleVerdictState;
  pill: string;
  payday: string;
  /** "$421.100", "−$64.000", "~$421.100" when approximate. */
  amount: string;
  /** "$14,4 M": drawn only when the full amount can't fit at 62% (widget rules); equals `amount` under a million. */
  amountShort: string;
  /** The whole per-day line, for screen readers and narrow layouts. */
  perDay: string;
  /** "$35.000" when the line is the plain per-day amount (drawn semibold), else null. */
  perDayAmount: string | null;
  /** What follows the amount ("al día"), or the whole line when there's no amount. */
  perDayRest: string;
  /** "+$2.100.000 cuando te paguen" (the next salary), or "Mira en qué se fue ›" after overspending; null when nothing to add. */
  sub: string | null;
  /** Why the number carries a "~". */
  approxNote: string | null;
  /** "Así sale tu número". */
  breakdown: { label: string; amount: string }[];
}

const PILL: Record<DisponibleVerdictState, string> = {
  vas_bien: "Vas bien",
  cuidado: "Cuidado",
  te_pasaste: "Te pasaste",
};

const APPROX_NOTE: Record<ApproxReason, string> = {
  salary_pending: "Tu salario aún no llega",
  foreign_currency: "Hay compras en otra moneda por confirmar",
  source_quiet: "Una fuente dejó de enviar movimientos",
};

/** A real minus sign, like the prototype: "−$64.000". */
export const signedPesos = (n: number) => (n < 0 ? `−${formatPesos(-n)}` : formatPesos(n));
const money = signedPesos;
/** "$14,4 M" (one decimal, comma, dropped when ",0"); under a million the full amount. */
export function shortMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs < 1_000_000) return money(n);
  // Tenths of a million, no locale APIs (Hermes may lack ICU).
  const tenths = Math.round(abs / 100_000);
  const whole = formatPesos(Math.floor(tenths / 10)).slice(1);
  const text = `$${whole}${tenths % 10 ? `,${tenths % 10}` : ""} M`;
  return n < 0 ? `−${text}` : text;
}
const days = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

function paydayLine(today: IsoDate, nextPayday: IsoDate | null, daysLeft: number): string {
  if (!nextPayday) return `Quedan ${days(daysLeft)} del mes`;
  const n = diffDays(today, nextPayday);
  if (n <= 0) return "Te pagan hoy";
  if (n === 1) return "Te pagan mañana";
  return `Te pagan en ${n} días`;
}

export function disponibleBlockView(input: {
  result: DisponibleResult;
  verdict: DisponibleVerdict;
  today: IsoDate;
  nextPayday: IsoDate | null;
  /** The next salary ("+$X cuando te paguen"); 0 when irregular or unknown. */
  nextIncome: number;
}): DisponibleBlockView {
  const { result: r, verdict } = input;
  const reason = verdict.reason;

  let perDay: string;
  let perDayAmount: string | null = null;
  let perDayRest: string;
  switch (reason.code) {
    case "overspent":
      perDay = "Lo restamos del próximo ciclo";
      break;
    case "low_pace":
      perDay = `Máximo ${formatPesos(reason.maxPerDay)} al día para llegar ${reason.until ? `al ${Number(reason.until.slice(8, 10))}` : "a fin de mes"}`;
      break;
    case "on_track":
    case "recovering":
      perDay = `${formatPesos(r.perDay)} al día · ${days(r.daysLeft)}`;
      perDayAmount = formatPesos(r.perDay);
      break;
    default:
      perDay = verdictMessage(reason);
  }
  perDayRest = perDayAmount ? "al día" : perDay;

  const sub = verdict.state === "te_pasaste"
    ? "Mira en qué se fue ›"
    : input.nextIncome > 0 ? `+${formatPesos(input.nextIncome)} cuando te paguen` : null;

  const breakdown = [
    { label: "Te llega este ciclo", amount: money(r.llega.total) },
    { label: "− Por pagar", amount: money(r.porPagar.total) },
    { label: "− Ahorro", amount: money(r.ahorro.total) },
    { label: "− Ya salió", amount: money(r.yaSalio.total) },
  ];
  if (r.ajustes.total !== 0) breakdown.push({ label: "± Ajustes", amount: money(r.ajustes.total) });

  return {
    state: verdict.state,
    pill: PILL[verdict.state],
    payday: paydayLine(input.today, input.nextPayday, r.daysLeft),
    amount: `${r.approximate ? "~" : ""}${money(r.disponible)}`,
    amountShort: `${r.approximate ? "~" : ""}${shortMoney(r.disponible)}`,
    perDay,
    perDayAmount,
    perDayRest,
    sub,
    approxNote: r.reasons.length ? APPROX_NOTE[r.reasons[0]] : null,
    breakdown,
  };
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const dayMonth = (d: IsoDate) => ({ day: Number(d.slice(8, 10)), month: MONTHS[Number(d.slice(5, 7)) - 1] });
const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
/** Inicio's greeting line: "Jueves 18 sep". */
export const headerDate = (d: IsoDate) => `${WEEKDAYS[dayOfWeek(d)]} ${dayMonth(d).day} ${dayMonth(d).month}`;
/** "30 sep". */
export const shortDate = (d: IsoDate) => `${dayMonth(d).day} ${dayMonth(d).month}`;

/** Inicio's header: "Ciclo 15 – 29 sep", or "Ciclo 30 sep – 14 oct" across months. */
export function cycleLabel(cycle: { start: IsoDate; end: IsoDate }): string {
  const a = dayMonth(cycle.start);
  const b = dayMonth(cycle.end);
  const from = a.month === b.month && cycle.start.slice(0, 7) === cycle.end.slice(0, 7) ? `${a.day}` : `${a.day} ${a.month}`;
  return `Ciclo ${from} – ${b.day} ${b.month}`;
}

/**
 * What a person typed as an amount: "25000", "25.000" and "25.000,50"
 * (es-CO), or "12.5". Null when it isn't a positive amount.
 */
/** A stored amount as an es-CO input value that parseAmount reads back: 452318.47 → "452.318,47". */
export function amountInput(n: number | null | undefined): string {
  if (n == null) return "";
  const [int, dec] = n.toFixed(2).split(".");
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (dec === "00" ? "" : `,${dec}`);
}

export function parseAmount(text: string): number | null {
  const t = text.replace(/[\s$]/g, "");
  if (!t) return null;
  // ponytail: a dot followed by exactly 3 digits is a thousands separator (es-CO); a comma is the decimal mark.
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : /\.\d{3}$/.test(t) ? t.replace(/\./g, "") : t;
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

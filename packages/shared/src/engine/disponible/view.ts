import { diffDays, type IsoDate } from "./dates";
import type { ApproxReason, DisponibleResult } from "./disponible";
import { formatPesos, verdictMessage, type DisponibleVerdict, type DisponibleVerdictState } from "./verdict";

/**
 * Everything the Inicio Disponible block says, as Spanish strings, so the
 * phone component only draws. Copy follows the session-5 prototype
 * (docs/mlp/sessions/05-visual.html): pill, "Te pagan en N días", the big
 * number, one per-day line, "+$X cuando te paguen" (Te deben, never added).
 */
export interface DisponibleBlockView {
  state: DisponibleVerdictState;
  pill: string;
  payday: string;
  /** "$421.100", "−$64.000", "~$421.100" when approximate. */
  amount: string;
  /** "$14,4 M": drawn only when the full amount can't fit at 62% (widget rules); equals `amount` under a million. */
  amountShort: string;
  perDay: string;
  /** "+$180.000 cuando te paguen", or "Mira en qué se fue ›" after overspending; null when nothing to add. */
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
const money = (n: number) => (n < 0 ? `−${formatPesos(-n)}` : formatPesos(n));
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
  /** Te deben total: shown beside the number, never added to it. */
  teDeben: number;
}): DisponibleBlockView {
  const { result: r, verdict } = input;
  const reason = verdict.reason;

  let perDay: string;
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
      break;
    default:
      perDay = verdictMessage(reason);
  }

  const sub = verdict.state === "te_pasaste"
    ? "Mira en qué se fue ›"
    : input.teDeben > 0 ? `+${formatPesos(input.teDeben)} cuando te paguen` : null;

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
    sub,
    approxNote: r.reasons.length ? APPROX_NOTE[r.reasons[0]] : null,
    breakdown,
  };
}

import type { PayCycle } from "./cycle";
import type { IsoDate } from "./dates";
import type { DisponibleMovement, DisponibleResult, Obligation } from "./disponible";
import type { StoredTransaction } from "./movements";
import { formatPesos } from "./verdict";
import { shortDate, signedPesos } from "./view";
import { colombiaTime, relativeDay } from "./widgets";

/**
 * What the Disponible block opens into (owner's pick, 2026-10-01: mockup
 * claude-ai-design/v2-hero-detalle/mezcla.html): "De tus $X de este ciclo",
 * one bar the commitments eat in order, and rows that open to show what's
 * inside, closing with what's left.
 */

export type DetailPartKey = "porPagar" | "ahorro" | "gastado" | "cicloPasado" | "queda";

export interface DetailItem {
  id: string;
  title: string;
  detail: string;
  amount: string;
  /** Already paid this cycle: drawn struck through. */
  done?: boolean;
}

export interface DetailPart {
  key: DetailPartKey;
  label: string;
  /** One muted line under the label ("3 pagos antes del 30"). */
  sub: string;
  amount: string;
  /** Share of the bar (amount in pesos, ≥ 0). */
  weight: number;
  items: DetailItem[];
  /** "Ver los 12 ›" when the items are a sample; null when they're all. */
  more: string | null;
}

export interface DisponibleDetailView {
  /** "De tus $2.100.000 de este ciclo". */
  title: string;
  /** "$0" … "$2.100.000" under the bar. */
  scaleEnd: string;
  /** In bar and row order: Por pagar, Ahorro, Gastado, (Ciclo pasado), then what's left. */
  parts: DetailPart[];
  /** The closing row: "Te queda" (green) or "Te pasaste" (red). */
  result: { label: string; amount: string; over: boolean; sub: string };
}

export const DETAIL_PENDING_SHOWN = 3;
export const DETAIL_SPENT_SHOWN = 3;
/** Paid bills shown (struck through) among the pending ones, most recent first. */
export const DETAIL_PAID_SHOWN = 2;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const dayNumber = (d: IsoDate) => Number(d.slice(8, 10));

export function disponibleDetailView(input: {
  today: IsoDate;
  cycle: PayCycle;
  result: DisponibleResult;
  obligations: Obligation[];
  movements: DisponibleMovement[];
  counted: ReadonlySet<string>;
  transactions: StoredTransaction[];
}): DisponibleDetailView {
  const { result: r, cycle, today } = input;
  const until = cycle.nextPayday ? `antes del ${dayNumber(cycle.nextPayday)}` : "este mes";

  // ── Por pagar: the 3 nearest pending, with the cycle's paid bills among them struck through ──
  const due = new Map(input.obligations.map((o) => [o.id, o]));
  const pending = r.porPagar.lines
    .filter((l) => l.amount > 0)
    .map((l) => ({ l, o: due.get(l.id) }))
    .sort((a, b) => (a.o?.dueDate ?? "").localeCompare(b.o?.dueDate ?? "") || a.l.label.localeCompare(b.l.label));
  const open = new Set(pending.map((p) => p.l.id));
  const shownPending = pending.slice(0, DETAIL_PENDING_SHOWN);
  const lastShown = shownPending[shownPending.length - 1]?.o?.dueDate ?? cycle.end;
  const paid = input.obligations
    .filter((o) => !open.has(o.id) && o.dueDate >= cycle.start && o.dueDate <= lastShown)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    .slice(0, DETAIL_PAID_SHOWN);
  const porPagarItems = [
    ...paid.map((o) => ({ date: o.dueDate, item: { id: o.id, title: o.label, detail: shortDate(o.dueDate), amount: signedPesos(o.amount), done: true } })),
    ...shownPending.map(({ l, o }) => ({
      date: o?.dueDate ?? "",
      item: {
        id: l.id,
        title: l.label,
        detail: [o ? shortDate(o.dueDate) : null, l.paid ? `Pagado ${formatPesos(l.paid)} de ${formatPesos(l.total ?? 0)}` : null]
          .filter(Boolean).join(" · "),
        amount: `${l.estimated ? "≈ " : ""}${signedPesos(l.amount)}`,
      },
    })),
  ].sort((a, b) => a.date.localeCompare(b.date)).map((x) => x.item);

  // ── Gastado: what left the counted accounts this cycle, newest first ──
  const at = new Map(input.movements.map((m) => [m.id, m]));
  const out = input.transactions
    .filter((t) => {
      const m = at.get(t.id);
      return !!m && t.direction === "OUTFLOW" && input.counted.has(t.accountId)
        && m.kind !== "ignored" && t.date >= cycle.start && t.date <= today;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || (at.get(b.id)?.at ?? "").localeCompare(at.get(a.id)?.at ?? "") || b.id.localeCompare(a.id));
  const gastadoItems = out.slice(0, DETAIL_SPENT_SHOWN).map((t) => {
    const when = at.get(t.id)?.at;
    return {
      id: t.id,
      title: t.description?.trim() || "Gasto",
      detail: `${relativeDay(today, t.date).toLowerCase()}${when ? ` ${colombiaTime(when)}` : ""}`,
      amount: signedPesos(t.amount),
    };
  });

  const ahorroItems: DetailItem[] = r.ahorro.lines.map((l) => ({ id: l.id, title: l.label, detail: "", amount: signedPesos(l.amount) }));
  if (r.ahorro.filledByTransfers > 0) {
    ahorroItems.push({ id: "moved", title: "Ya lo pasaste a otra cuenta", detail: "", amount: signedPesos(r.ahorro.filledByTransfers), done: true });
  }

  const carry = r.ajustes.total;
  const base = r.llega.total + Math.max(0, carry);
  const queda = Math.max(0, r.disponible);
  const parts: DetailPart[] = [
    {
      key: "porPagar", label: "Por pagar",
      sub: pending.length ? `${plural(pending.length, "pago", "pagos")} ${until}` : "Nada pendiente",
      amount: signedPesos(r.porPagar.total), weight: Math.max(0, r.porPagar.total),
      items: porPagarItems,
      more: pending.length > DETAIL_PENDING_SHOWN ? `Ver los ${pending.length} ›` : null,
    },
    {
      key: "ahorro", label: "Ahorro",
      sub: r.ahorro.total > 0 ? "Lo que separas cada ciclo" : "No apartas nada este ciclo",
      amount: signedPesos(r.ahorro.total), weight: Math.max(0, r.ahorro.total),
      items: ahorroItems, more: null,
    },
    {
      key: "gastado", label: "Gastado",
      sub: out.length ? `${plural(out.length, "movimiento", "movimientos")} desde el ${dayNumber(cycle.start)}` : "Nada todavía",
      amount: signedPesos(r.yaSalio.total), weight: Math.max(0, r.yaSalio.total),
      items: gastadoItems,
      more: out.length > DETAIL_SPENT_SHOWN ? `Ver los ${out.length} ›` : null,
    },
  ];
  if (carry < 0) {
    parts.push({
      key: "cicloPasado", label: "Ciclo pasado", sub: "Te pasaste y lo restamos aquí",
      amount: signedPesos(-carry), weight: -carry, items: [], more: null,
    });
  }
  const quedaSub = `${formatPesos(r.perDay)} al día por ${plural(r.daysLeft, "día", "días")}`;
  parts.push({ key: "queda", label: "Te queda", sub: quedaSub, amount: signedPesos(queda), weight: queda, items: [], more: null });

  const over = r.disponible < 0;
  return {
    title: `De tus ${signedPesos(base)} de este ciclo`,
    scaleEnd: signedPesos(Math.max(base, parts.reduce((s, p) => s + p.weight, 0))),
    parts,
    result: over
      ? { label: "Te pasaste", amount: signedPesos(r.disponible), over: true, sub: "Lo restamos del próximo ciclo" }
      : { label: "Te queda", amount: signedPesos(r.disponible), over: false, sub: quedaSub },
  };
}

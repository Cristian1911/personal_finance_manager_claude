import type { Mover, SavingsPoint, Verdict, VerdictTile } from "./types";

interface VerdictInput {
  savings: SavingsPoint[];
  movers: Mover[];
  avgExpense: number;
  avgIncome: number;
}

export function buildVerdict(input: VerdictInput, fmt: (n: number) => string): Verdict {
  const { savings, movers, avgExpense, avgIncome } = input;
  const last = savings[savings.length - 1];
  const prev = savings[savings.length - 2];
  const ratePct = last?.rate == null ? null : Math.round(last.rate * 100);
  const prevRatePct = prev?.rate == null ? null : Math.round(prev.rate * 100);

  let headline = "Aún no hay suficiente historial para un veredicto.";
  if (ratePct !== null) {
    const dir = prevRatePct === null ? "" : ratePct >= prevRatePct ? " — subió" : " — bajó";
    headline = `Tu tasa de ahorro es ${ratePct}%${dir}.`;
  }

  const topMover = movers.find((m) => m.deltaPct > 0);
  const sub = topMover
    ? `${topMover.nameEs} viene acelerando (${topMover.deltaPct > 0 ? "+" : ""}${Math.round(topMover.deltaPct)}%).`
    : null;

  const rateDelta = ratePct !== null && prevRatePct !== null ? ratePct - prevRatePct : null;
  const tiles: VerdictTile[] = [
    { label: "Gasto prom/mes", value: fmt(avgExpense), deltaLabel: null, tone: "neutral" },
    {
      label: "Tasa de ahorro",
      value: ratePct === null ? "—" : `${ratePct}%`,
      deltaLabel: rateDelta === null ? null : `${rateDelta >= 0 ? "+" : ""}${rateDelta} pts`,
      tone: rateDelta === null ? "neutral" : rateDelta >= 0 ? "pos" : "neg",
    },
    { label: "Ingreso prom", value: fmt(avgIncome), deltaLabel: null, tone: "neutral" },
  ];

  return { headline, sub, tiles };
}

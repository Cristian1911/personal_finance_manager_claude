import type {
  PersonCurrencyTotals,
  PersonDebtSummary,
} from "@/lib/personal-debts/hierarchy";

/**
 * Compact read of the persona → viaje → deudas hierarchy for surfaces that
 * only summarize (the /deudas card and panel). One row per PERSON — never one
 * per debt — with their open viajes and loose debts as children. Plain module
 * so Server and Client Components share one rule with the full page.
 */

export type BalanceTone = "lent" | "borrowed" | "even";

/** Text tone per balance direction — shared by the person card and the rollup. */
export const BALANCE_TONE_CLASS: Record<BalanceTone, string> = {
  lent: "text-z-brass",
  borrowed: "text-z-debt",
  even: "text-z-income",
};

export type BalanceLine = { label: string; amount: number; tone: BalanceTone };

/** Headline for one currency: what they owe you, what you owe them, or net. */
export function balanceLine(t: PersonCurrencyTotals): BalanceLine {
  if (t.owedToMe > 0 && t.iOwe > 0) {
    const net = t.owedToMe - t.iOwe;
    return net >= 0
      ? { label: "Te debe (neto)", amount: net, tone: "lent" }
      : { label: "Le debes (neto)", amount: -net, tone: "borrowed" };
  }
  if (t.owedToMe > 0) return { label: "Te debe", amount: t.owedToMe, tone: "lent" };
  if (t.iOwe > 0) return { label: "Le debes", amount: t.iOwe, tone: "borrowed" };
  return { label: "Al día", amount: 0, tone: "even" };
}

export type PersonRollupChild = {
  key: string;
  kind: "viaje" | "sueltas";
  label: string;
  emoji: string | null;
  /** Active debts inside this child. */
  count: number;
  amount: number;
  tone: BalanceTone;
};

export type PersonRollup = {
  destinatario_id: string;
  name: string;
  currency_code: string;
  headline: BalanceLine;
  activeCount: number;
  overdueCount: number;
  /** Other currencies this person has open balances in (never summed). */
  otherCurrencies: string[];
  /** Open viajes first (biggest pending), then the loose debts as one child. */
  children: PersonRollupChild[];
};

function toneOf(direction: "lent" | "borrowed"): BalanceTone {
  return direction === "lent" ? "lent" : "borrowed";
}

/**
 * People with something open, in the hierarchy's order (biggest balance
 * first). The headline uses `currency` when the person has a balance in it,
 * otherwise their first currency — so a USD-only debt still shows up.
 */
export function rollupPeople(people: PersonDebtSummary[], currency: string): PersonRollup[] {
  const out: PersonRollup[] = [];
  for (const p of people) {
    if (p.activeCount === 0) continue;
    const open = p.totals.filter((t) => t.owedToMe > 0 || t.iOwe > 0);
    const main = open.find((t) => t.currency_code === currency) ?? open[0];
    if (!main) continue;
    const code = main.currency_code;

    const children: PersonRollupChild[] = p.groups
      .filter((g) => g.currency_code === code && g.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding)
      .map((g) => ({
        key: g.key,
        kind: "viaje" as const,
        label: g.modo.name,
        emoji: g.modo.emoji,
        count: g.activeCount,
        amount: g.outstanding,
        tone: toneOf(g.direction),
      }));

    const loose = p.loose.filter((d) => d.currency_code === code && d.status === "active");
    if (loose.length > 0) {
      let lent = 0;
      let borrowed = 0;
      for (const d of loose) {
        if (d.direction === "lent") lent += Number(d.outstanding_amount);
        else borrowed += Number(d.outstanding_amount);
      }
      const net = lent - borrowed;
      children.push({
        key: `sueltas|${code}`,
        kind: "sueltas",
        label: p.groups.length > 0 ? "Otras deudas" : loose.length === 1 ? "Deuda suelta" : "Deudas sueltas",
        emoji: null,
        count: loose.length,
        amount: Math.abs(net),
        tone: net > 0 ? "lent" : net < 0 ? "borrowed" : "even",
      });
    }

    out.push({
      destinatario_id: p.destinatario_id,
      name: p.name,
      currency_code: code,
      headline: balanceLine(main),
      activeCount: p.activeCount,
      overdueCount: p.overdueCount,
      otherCurrencies: open.filter((t) => t !== main).map((t) => t.currency_code),
      children,
    });
  }
  return out;
}

/** Deep link that opens one person's card on /deudas-personales. */
export function personDebtsHref(destinatarioId: string): string {
  return `/deudas-personales?persona=${destinatarioId}#persona-${destinatarioId}`;
}

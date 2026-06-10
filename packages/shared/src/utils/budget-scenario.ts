/**
 * Budget scenario ("Simular cambio") — pure math for the scenario sandbox.
 *
 * A scenario clones the user's standing monthly budget into an editable draft:
 * lines reference existing categories (a "new" line is a category that had no
 * budget), plus a pool of one-time startup purchases (gastos de arranque).
 * Everything is recomputed against the user's real 3-month spending averages.
 *
 * The verdict decomposes the monthly shortfall into three parts so the math
 * always closes exactly:
 *   1. budgetGap        — scenario total vs income
 *   2. expectedOverspend — where avg3m exceeds the budget, on UNTOUCHED lines only.
 *      Editing a line is a commitment to the new number, so touched lines stop
 *      counting overspend — which is why a cut's relief = cut + vanished overspend.
 *   3. startupReserve   — monthly savings needed to fund startup purchases
 */

export type ScenarioGroup = "needs" | "wants" | "savings";

export interface BudgetScenarioLine {
  /** Existing category UUID — new lines map to zero-budget categories. */
  categoryId: string;
  name: string;
  /** Current standing budget. null = category had no budget (a "new" line). */
  current: number | null;
  /** Draft budget in the scenario. */
  scenario: number;
  /** Real 3-month spending average. null = no history. */
  avg3m: number | null;
  /** Fixed commitments (e.g. Deudas) — not editable, never a cut candidate. */
  isFixed: boolean;
  group: ScenarioGroup;
}

export interface BudgetScenarioStartupItem {
  id: string;
  name: string;
  amount: number;
  /** Afford-engine verdict, when the item is linked to a Deseo. */
  verdict: "BUY" | "BUY_WITH_CAUTION" | "WAIT" | "NOT_RECOMMENDED" | null;
  /** wishlist_items id when pulled from Deseos. */
  wishlistItemId: string | null;
  /** Deferred items don't count toward the startup reserve. */
  deferred: boolean;
}

export interface BudgetScenarioDraft {
  name: string;
  lines: BudgetScenarioLine[];
  startup: {
    items: BudgetScenarioStartupItem[];
    /** Monthly saving rate toward startup purchases. */
    monthlyRate: number;
    /** Whether the current liquid cushion counts toward startup funding. */
    useCushion: boolean;
  };
}

export interface ScenarioAllocation {
  needs: number;
  wants: number;
  savings: number;
}

export interface BudgetScenarioSummary {
  scenarioTotal: number;
  currentTotal: number;
  /** scenarioTotal − income (positive = over income). */
  budgetGap: number;
  /** Σ max(0, avg3m − scenario) over lines with history. */
  expectedOverspend: number;
  startupTotal: number;
  /** Startup amount not covered by the cushion. */
  startupRemaining: number;
  /** Months until everything is funded at monthlyRate. */
  startupMonths: number;
  /** Monthly set-aside: startupRemaining spread over startupMonths. */
  startupReserve: number;
  /** budgetGap + expectedOverspend + startupReserve. Positive = te faltan $X/mes. */
  shortfall: number;
  fits: boolean;
  allocation: ScenarioAllocation;
  currentAllocation: ScenarioAllocation;
}

export interface ScenarioCutCandidate {
  categoryId: string;
  name: string;
  /** Suggested reduction to the scenario budget. */
  cut: number;
  from: number;
  to: number;
  avg3m: number | null;
  /** Total monthly relief if applied (cut + overspend that disappears). */
  relief: number;
  /** True when avg3m exceeds the suggested target — the cut demands habit change. */
  demanding: boolean;
}

export interface ScenarioDeferCandidate {
  itemId: string;
  name: string;
  amount: number;
  /** Reserve relief from deferring this item. */
  relief: number;
}

export interface ScenarioFundingEntry {
  itemId: string;
  name: string;
  amount: number;
  /** 0 = covered today; n = ready in n months. Deferred items get null. */
  readyInMonths: number | null;
}

function sumAllocation(lines: BudgetScenarioLine[], pick: (l: BudgetScenarioLine) => number): ScenarioAllocation {
  const alloc: ScenarioAllocation = { needs: 0, wants: 0, savings: 0 };
  for (const line of lines) alloc[line.group] += pick(line);
  return alloc;
}

function activeStartupItems(draft: BudgetScenarioDraft): BudgetScenarioStartupItem[] {
  return draft.startup.items.filter((i) => !i.deferred);
}

/** A line is "touched" when the user changed it (or it's new). */
export function isLineTouched(line: BudgetScenarioLine): boolean {
  return line.current == null || line.scenario !== line.current;
}

/** Overspend a line contributes to the verdict (untouched lines only). */
export function lineOverspend(line: BudgetScenarioLine): number {
  if (isLineTouched(line) || line.avg3m == null) return 0;
  return Math.max(0, line.avg3m - line.scenario);
}

export function computeStartupPlan(
  draft: BudgetScenarioDraft,
  cushion: number,
): { total: number; remaining: number; months: number; reserve: number } {
  const total = activeStartupItems(draft).reduce((s, i) => s + i.amount, 0);
  const covered = draft.startup.useCushion ? Math.max(0, cushion) : 0;
  const remaining = Math.max(0, total - covered);
  const rate = draft.startup.monthlyRate;
  const months = remaining > 0 && rate > 0 ? Math.ceil(remaining / rate) : 0;
  const reserve = months > 0 ? remaining / months : 0;
  return { total, remaining, months, reserve: Math.round(reserve) };
}

export function computeScenarioSummary(
  draft: BudgetScenarioDraft,
  income: number,
  cushion: number,
): BudgetScenarioSummary {
  const scenarioTotal = draft.lines.reduce((s, l) => s + l.scenario, 0);
  const currentTotal = draft.lines.reduce((s, l) => s + (l.current ?? 0), 0);
  const budgetGap = scenarioTotal - income;

  const expectedOverspend = draft.lines.reduce(
    (s, l) => s + lineOverspend(l),
    0,
  );

  const startup = computeStartupPlan(draft, cushion);
  const shortfall = budgetGap + expectedOverspend + startup.reserve;

  return {
    scenarioTotal,
    currentTotal,
    budgetGap,
    expectedOverspend,
    startupTotal: startup.total,
    startupRemaining: startup.remaining,
    startupMonths: startup.months,
    startupReserve: startup.reserve,
    shortfall,
    fits: shortfall <= 0,
    allocation: sumAllocation(draft.lines, (l) => l.scenario),
    currentAllocation: sumAllocation(draft.lines, (l) => l.current ?? 0),
  };
}

/** Round a suggested cut down to a clean step (default $10.000). */
function roundCut(value: number, step = 10000): number {
  return Math.floor(value / step) * step;
}

/**
 * Ranked cut candidates: discretionary lines (wants first, then savings),
 * largest scenario budget first. Suggested cut = up to half the line.
 * Relief includes any overspend that disappears when avg3m anchors the line
 * (cutting a line below avg3m forces real habit change, flagged `demanding`).
 */
export function computeCutCandidates(draft: BudgetScenarioDraft): ScenarioCutCandidate[] {
  const order: Record<ScenarioGroup, number> = { wants: 0, savings: 1, needs: 2 };
  return draft.lines
    .filter((l) => !l.isFixed && l.scenario > 0 && l.group !== "needs")
    .sort((a, b) => order[a.group] - order[b.group] || b.scenario - a.scenario)
    .map((l) => {
      const cut = roundCut(l.scenario / 2);
      if (cut <= 0) return null;
      const to = l.scenario - cut;
      return {
        categoryId: l.categoryId,
        name: l.name,
        cut,
        from: l.scenario,
        to,
        avg3m: l.avg3m,
        relief: cut + lineOverspend(l),
        // Habit-change warning: only meaningful for spending, not savings transfers
        demanding: l.group !== "savings" && l.avg3m != null && l.avg3m > to,
      };
    })
    .filter((c): c is ScenarioCutCandidate => c !== null);
}

/** Defer candidates among startup items: worst verdicts first. */
export function computeDeferCandidates(
  draft: BudgetScenarioDraft,
  cushion: number,
): ScenarioDeferCandidate[] {
  const verdictRank: Record<string, number> = {
    NOT_RECOMMENDED: 0,
    WAIT: 1,
    BUY_WITH_CAUTION: 2,
    BUY: 3,
  };
  const before = computeStartupPlan(draft, cushion).reserve;
  return activeStartupItems(draft)
    .sort(
      (a, b) =>
        (verdictRank[a.verdict ?? "BUY"] ?? 3) - (verdictRank[b.verdict ?? "BUY"] ?? 3) ||
        b.amount - a.amount,
    )
    .map((item) => {
      const without: BudgetScenarioDraft = {
        ...draft,
        startup: {
          ...draft.startup,
          items: draft.startup.items.map((i) => (i.id === item.id ? { ...i, deferred: true } : i)),
        },
      };
      const after = computeStartupPlan(without, cushion).reserve;
      return { itemId: item.id, name: item.name, amount: item.amount, relief: Math.max(0, before - after) };
    })
    .filter((c) => c.relief > 0);
}

/**
 * Funding timeline: items fund in list order (cumulative need), cushion first,
 * then monthlyRate per month. readyInMonths 0 = covered by cushion today.
 */
export function computeFundingTimeline(
  draft: BudgetScenarioDraft,
  cushion: number,
): ScenarioFundingEntry[] {
  const rate = draft.startup.monthlyRate;
  const covered = draft.startup.useCushion ? Math.max(0, cushion) : 0;
  let cumulative = 0;
  return draft.startup.items.map((item) => {
    if (item.deferred) {
      return { itemId: item.id, name: item.name, amount: item.amount, readyInMonths: null };
    }
    cumulative += item.amount;
    const need = cumulative - covered;
    const months = need <= 0 ? 0 : rate > 0 ? Math.ceil(need / rate) : null;
    return { itemId: item.id, name: item.name, amount: item.amount, readyInMonths: months };
  });
}

/** Apply a cut candidate to the draft (immutable). */
export function applyCutToDraft(
  draft: BudgetScenarioDraft,
  cut: ScenarioCutCandidate,
): BudgetScenarioDraft {
  return {
    ...draft,
    lines: draft.lines.map((l) =>
      l.categoryId === cut.categoryId ? { ...l, scenario: cut.to } : l,
    ),
  };
}

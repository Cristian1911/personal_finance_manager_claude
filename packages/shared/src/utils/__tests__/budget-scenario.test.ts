import { describe, it, expect } from "vitest";
import {
  computeScenarioSummary,
  computeCutCandidates,
  computeDeferCandidates,
  computeFundingTimeline,
  computeStartupPlan,
  applyCutToDraft,
  isLineTouched,
  type BudgetScenarioDraft,
  type BudgetScenarioLine,
} from "../budget-scenario";

// Sample data from the "Mudanza" design brief
const INCOME = 4_500_000;
const CUSHION = 1_700_000;

const line = (partial: Partial<BudgetScenarioLine> & Pick<BudgetScenarioLine, "categoryId" | "name" | "scenario" | "group">): BudgetScenarioLine => ({
  current: null,
  avg3m: null,
  isFixed: false,
  ...partial,
});

const mudanza = (): BudgetScenarioDraft => ({
  name: "Mudanza",
  lines: [
    line({ categoryId: "arriendo", name: "Arriendo", scenario: 1_500_000, group: "needs" }),
    line({ categoryId: "servicios", name: "Servicios", scenario: 220_000, group: "needs" }),
    line({ categoryId: "internet", name: "Internet", scenario: 95_000, group: "needs" }),
    line({ categoryId: "mercado", name: "Mercado", current: 350_000, scenario: 650_000, avg3m: 410_000, group: "needs" }),
    line({ categoryId: "transporte", name: "Transporte", current: 280_000, scenario: 280_000, avg3m: 295_000, group: "needs" }),
    line({ categoryId: "restaurantes", name: "Restaurantes", current: 300_000, scenario: 300_000, avg3m: 385_000, group: "wants" }),
    line({ categoryId: "suscripciones", name: "Suscripciones", current: 95_000, scenario: 95_000, avg3m: 95_000, group: "wants" }),
    line({ categoryId: "salidas", name: "Salidas", current: 250_000, scenario: 250_000, avg3m: 310_000, group: "wants" }),
    line({ categoryId: "deudas", name: "Deudas", current: 815_000, scenario: 815_000, avg3m: 815_000, isFixed: true, group: "needs" }),
    line({ categoryId: "ahorro", name: "Ahorro", current: 600_000, scenario: 600_000, avg3m: 600_000, group: "savings" }),
  ],
  startup: {
    items: [
      { id: "cocina", name: "Cocina y menaje", amount: 450_000, verdict: "BUY", wishlistItemId: null, deferred: false },
      { id: "nevera", name: "Nevera", amount: 1_200_000, verdict: "BUY_WITH_CAUTION", wishlistItemId: "w1", deferred: false },
      { id: "muebles", name: "Muebles de sala", amount: 1_800_000, verdict: "WAIT", wishlistItemId: "w2", deferred: false },
    ],
    monthlyRate: 400_000,
    useCushion: true,
  },
});

describe("computeScenarioSummary", () => {
  it("decomposes the shortfall into gap + overspend + reserve, closing exactly", () => {
    const s = computeScenarioSummary(mudanza(), INCOME, CUSHION);
    expect(s.scenarioTotal).toBe(4_805_000);
    expect(s.currentTotal).toBe(2_690_000);
    expect(s.budgetGap).toBe(305_000);
    // Untouched lines only: transporte 15k + restaurantes 85k + salidas 60k
    expect(s.expectedOverspend).toBe(160_000);
    // Startup: 3.450.000 − cushion 1.700.000 = 1.750.000 → 5 months @ 400k → 350k/mes
    expect(s.startupTotal).toBe(3_450_000);
    expect(s.startupRemaining).toBe(1_750_000);
    expect(s.startupMonths).toBe(5);
    expect(s.startupReserve).toBe(350_000);
    expect(s.shortfall).toBe(305_000 + 160_000 + 350_000);
    expect(s.fits).toBe(false);
  });

  it("edited lines stop counting overspend (commitment semantics)", () => {
    const draft = mudanza();
    // Mercado was raised 350k→650k (touched): avg 410k < 650k anyway.
    // Touch restaurantes: its 85k overspend disappears.
    draft.lines = draft.lines.map((l) =>
      l.categoryId === "restaurantes" ? { ...l, scenario: 290_000 } : l,
    );
    const s = computeScenarioSummary(draft, INCOME, CUSHION);
    expect(s.expectedOverspend).toBe(75_000); // transporte 15k + salidas 60k
  });

  it("allocation groups scenario vs current amounts", () => {
    const s = computeScenarioSummary(mudanza(), INCOME, CUSHION);
    expect(s.allocation.needs).toBe(3_560_000);
    expect(s.allocation.wants).toBe(645_000);
    expect(s.allocation.savings).toBe(600_000);
    expect(s.currentAllocation.needs).toBe(1_445_000);
  });

  it("fits when income covers everything", () => {
    const draft = mudanza();
    draft.startup.items = [];
    draft.lines = draft.lines.map((l) => ({ ...l, scenario: l.current ?? 0, avg3m: null }));
    const s = computeScenarioSummary(draft, INCOME, CUSHION);
    expect(s.fits).toBe(true);
    expect(s.shortfall).toBe(2_690_000 - INCOME);
  });
});

describe("computeCutCandidates", () => {
  it("ranks discretionary lines (wants → savings) and matches the design figures", () => {
    const cuts = computeCutCandidates(mudanza());
    const byId = Object.fromEntries(cuts.map((c) => [c.categoryId, c]));

    // Restaurantes: 300k → cut 150k, relief 150k + 85k overspend = 235k, demanding (avg 385k > 150k)
    expect(byId.restaurantes).toMatchObject({ cut: 150_000, to: 150_000, relief: 235_000, demanding: true });
    // Salidas: 250k → cut 120k (rounded), relief 120k + 60k = 180k
    expect(byId.salidas).toMatchObject({ cut: 120_000, relief: 180_000 });
    // Ahorro (savings group, ranked after wants): 600k → 300k, relief 300k
    expect(byId.ahorro).toMatchObject({ cut: 300_000, relief: 300_000, demanding: false });

    // wants come before savings
    expect(cuts.findIndex((c) => c.categoryId === "restaurantes")).toBeLessThan(
      cuts.findIndex((c) => c.categoryId === "ahorro"),
    );
    // fixed and needs lines never appear
    expect(byId.deudas).toBeUndefined();
    expect(byId.arriendo).toBeUndefined();
  });

  it("applyCutToDraft lowers the line and the verdict improves by the relief", () => {
    const draft = mudanza();
    const before = computeScenarioSummary(draft, INCOME, CUSHION);
    const cut = computeCutCandidates(draft).find((c) => c.categoryId === "restaurantes")!;
    const after = computeScenarioSummary(applyCutToDraft(draft, cut), INCOME, CUSHION);
    expect(before.shortfall - after.shortfall).toBe(cut.relief);
  });
});

describe("computeDeferCandidates", () => {
  it("orders by worst verdict and computes reserve relief", () => {
    const defers = computeDeferCandidates(mudanza(), CUSHION);
    expect(defers[0].itemId).toBe("muebles"); // WAIT before BUY_WITH_CAUTION
    // Without muebles: remaining = max(0, 1.650.000 − 1.700.000) = 0 → reserve 0 → relief 350k
    expect(defers[0].relief).toBe(350_000);
  });
});

describe("computeFundingTimeline", () => {
  it("cushion covers early items; the rest fund at the monthly rate", () => {
    const t = computeFundingTimeline(mudanza(), CUSHION);
    expect(t.map((e) => e.readyInMonths)).toEqual([0, 0, 5]);
  });

  it("deferred items are excluded (null) and don't shift others", () => {
    const draft = mudanza();
    draft.startup.items[2].deferred = true;
    const t = computeFundingTimeline(draft, CUSHION);
    expect(t[2].readyInMonths).toBeNull();
    expect(t[1].readyInMonths).toBe(0);
  });

  it("no cushion: everything funds from the rate", () => {
    const draft = mudanza();
    draft.startup.useCushion = false;
    const t = computeFundingTimeline(draft, 0);
    expect(t.map((e) => e.readyInMonths)).toEqual([2, 5, 9]);
    expect(computeStartupPlan(draft, 0).months).toBe(9);
  });
});

describe("isLineTouched", () => {
  it("new lines and edited lines are touched", () => {
    expect(isLineTouched(line({ categoryId: "x", name: "X", scenario: 100, group: "needs" }))).toBe(true);
    expect(isLineTouched(line({ categoryId: "x", name: "X", current: 100, scenario: 100, group: "needs" }))).toBe(false);
    expect(isLineTouched(line({ categoryId: "x", name: "X", current: 100, scenario: 90, group: "needs" }))).toBe(true);
  });
});

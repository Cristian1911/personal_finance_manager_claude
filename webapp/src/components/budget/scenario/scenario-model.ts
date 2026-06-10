import type {
  BudgetScenarioDraft,
  BudgetScenarioLine,
  BudgetScenarioStartupItem,
  ScenarioGroup,
} from "@zeta/shared";

/** Serializable category option passed from the server component. */
export interface ScenarioCategoryOption {
  id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
  /** Current standing monthly budget (null = none). */
  budget: number | null;
  /** Real 3-month spending average (null = no history). */
  avg3m: number | null;
  group: ScenarioGroup;
  isFixed: boolean;
}

/** Wishlist item option for the startup-purchases pool. */
export interface ScenarioDeseoOption {
  id: string;
  name: string;
  amount: number;
  verdict: BudgetScenarioStartupItem["verdict"];
}

export type ScenarioTemplate = "mudanza" | "desde-cero";

/** Slugs the Mudanza template tries to pre-seed as new lines. */
const MUDANZA_SLUG_GROUPS: string[][] = [
  ["arriendo-hipoteca", "arriendo", "vivienda"],
  ["servicios", "servicios-publicos"],
  ["internet", "internet-y-telefonia", "telefonia"],
];

export function lineFromCategory(
  cat: ScenarioCategoryOption,
  scenario?: number,
): BudgetScenarioLine {
  return {
    categoryId: cat.id,
    name: cat.name,
    current: cat.budget,
    scenario: scenario ?? cat.budget ?? 0,
    avg3m: cat.avg3m,
    isFixed: cat.isFixed,
    group: cat.group,
  };
}

export function createDraft(
  template: ScenarioTemplate,
  categories: ScenarioCategoryOption[],
): BudgetScenarioDraft {
  const lines = categories.filter((c) => (c.budget ?? 0) > 0).map((c) => lineFromCategory(c));

  if (template === "mudanza") {
    const present = new Set(lines.map((l) => l.categoryId));
    for (const slugs of MUDANZA_SLUG_GROUPS) {
      const match = categories.find((c) => slugs.includes(c.slug) && !present.has(c.id));
      if (match) {
        // New line: enters at 0 so the user types the real figure
        lines.unshift(lineFromCategory({ ...match, budget: null }, 0));
        present.add(match.id);
      }
    }
  }

  return {
    name: template === "mudanza" ? "Mudanza" : "Mi escenario",
    lines,
    startup: { items: [], monthlyRate: 400_000, useCushion: true },
  };
}

export const STARTUP_RATE_OPTIONS = [300_000, 400_000, 500_000];

export const VERDICT_LABELS: Record<string, string> = {
  BUY: "Compra",
  BUY_WITH_CAUTION: "Con cuidado",
  WAIT: "Espera",
  NOT_RECOMMENDED: "No recomendado",
};

export function normalizeVerdict(
  verdict: string | null,
): BudgetScenarioStartupItem["verdict"] {
  return verdict && verdict in VERDICT_LABELS
    ? (verdict as BudgetScenarioStartupItem["verdict"])
    : null;
}

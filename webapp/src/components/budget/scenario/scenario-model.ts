import { startupRateOptions } from "@zeta/shared";
import type {
  BudgetScenarioDraft,
  BudgetScenarioLine,
  BudgetScenarioStartupItem,
  PurchaseDecisionVerdict,
  ScenarioGroup,
} from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";

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
  currency: CurrencyCode,
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
    startup: { items: [], monthlyRate: startupRateOptions(currency)[1], useCushion: true },
  };
}

// Currency-dependent scales live in @zeta/shared (mobile parameterizes the
// same math) — re-exported here for the scenario components.
export { startupRateOptions, cutStep } from "@zeta/shared";

// Record keyed on the shared verdict type: adding a verdict to
// purchase-decision.ts breaks this map at compile time instead of silently.
export const VERDICT_LABELS: Record<PurchaseDecisionVerdict, string> = {
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

export type FreshnessLevel = "fresh" | "stale" | "outdated";
export type SemanticColor = "positive" | "warning" | "danger" | "neutral";

/**
 * Determine freshness based on last update timestamp.
 * fresh = today, stale = 2-3 days, outdated = 4+ days or null
 */
export function getFreshnessLevel(updatedAt: string | null): FreshnessLevel {
  if (!updatedAt) return "outdated";
  const now = new Date();
  const updated = new Date(updatedAt);
  const diffMs = now.getTime() - updated.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays <= 1) return "fresh";
  if (diffDays <= 3) return "stale";
  return "outdated";
}

/**
 * Semantic color for account balance change percentage.
 * For deposits: up = good. For debt: down = good.
 */
export function getAccountSemanticColor(
  changePercent: number,
  accountKind: "deposit" | "debt"
): SemanticColor {
  if (accountKind === "deposit") {
    if (changePercent >= 0) return "positive";
    if (changePercent > -30) return "warning";
    return "danger";
  }
  // debt: decrease is good, increase is bad
  if (changePercent <= 0) return "positive";
  if (changePercent < 15) return "warning";
  return "danger";
}

/**
 * Semantic color for credit card utilization percentage.
 */
export function getCreditUtilizationColor(utilization: number): SemanticColor {
  if (utilization < 30) return "positive";
  if (utilization <= 60) return "warning";
  return "danger";
}

/**
 * Maps semantic color to Tailwind classes.
 */
export const semanticColorMap: Record<SemanticColor, { text: string; bg: string; dot: string }> = {
  positive: { text: "text-emerald-600", bg: "bg-emerald-500/10", dot: "bg-emerald-500" },
  warning: { text: "text-amber-600", bg: "bg-amber-500/10", dot: "bg-amber-500" },
  danger: { text: "text-red-600", bg: "bg-red-500/10", dot: "bg-red-500" },
  neutral: { text: "text-muted-foreground", bg: "bg-muted", dot: "bg-muted-foreground" },
};

/**
 * Maps freshness level to Tailwind classes and labels.
 */
export const freshnessMap: Record<FreshnessLevel, { dot: string; label: string }> = {
  fresh: { dot: "bg-emerald-500", label: "Actualizado hoy" },
  stale: { dot: "bg-amber-500", label: "Actualizado hace unos dias" },
  outdated: { dot: "bg-red-500", label: "Desactualizado" },
};

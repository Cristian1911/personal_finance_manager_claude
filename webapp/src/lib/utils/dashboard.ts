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

  if (diffDays < 1) return "fresh";
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
  positive: { text: "text-z-income", bg: "bg-z-income/10", dot: "bg-z-income" },
  warning: { text: "text-z-expense", bg: "bg-z-expense/10", dot: "bg-z-expense" },
  danger: { text: "text-z-debt", bg: "bg-z-debt/10", dot: "bg-z-debt" },
  neutral: { text: "text-muted-foreground", bg: "bg-muted", dot: "bg-muted-foreground" },
};

/**
 * Maps freshness level to Tailwind classes and labels.
 */
export const freshnessMap: Record<FreshnessLevel, { dot: string; label: string }> = {
  fresh: { dot: "bg-z-income", label: "Actualizado hoy" },
  stale: { dot: "bg-z-alert", label: "Actualizado hace unos días" },
  outdated: { dot: "bg-z-debt", label: "Desactualizado" },
};

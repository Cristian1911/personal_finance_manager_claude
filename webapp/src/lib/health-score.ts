import type { HealthMeter } from "@/actions/health-meters";
import type { MeterType } from "@/lib/health-levels";

// ---------------------------------------------------------------------------
// meterToScore — converts a raw meter value to a 0-100 score
// ---------------------------------------------------------------------------

export function meterToScore(type: MeterType, value: number): number {
  switch (type) {
    case "gasto":
      // Lower is better. 0% expense = 100, 100% = 0
      return Math.max(0, Math.min(100, 100 - value));

    case "deuda":
      // Lower is better. 0% DTI = 100, 60% = 0
      return Math.max(0, Math.min(100, 100 - (value / 60) * 100));

    case "ahorro":
      // Higher is better. 0% = 0, 40%+ = 100
      return Math.max(0, Math.min(100, (value / 40) * 100));

    case "colchon":
      // Higher is better. 0 months = 0, 15+ months = 100
      return Math.max(0, Math.min(100, (value / 15) * 100));
  }
}

// ---------------------------------------------------------------------------
// computeCompositeScore — average of all meters with data
// ---------------------------------------------------------------------------

export function computeCompositeScore(meters: HealthMeter[]): number {
  const valid = meters.filter((m) => m.hasData);
  if (valid.length === 0) return 0;

  const total = valid.reduce(
    (sum, m) => sum + meterToScore(m.type, m.value),
    0,
  );

  return Math.round(total / valid.length);
}

// ---------------------------------------------------------------------------
// getScoreLabel — Spanish label for composite score range
// ---------------------------------------------------------------------------

export function getScoreLabel(score: number): string {
  if (score <= 25) return "Critico";
  if (score <= 50) return "Atento";
  if (score <= 75) return "Bien";
  if (score <= 90) return "Solido";
  return "Excelente";
}

// ---------------------------------------------------------------------------
// getScoreColor — CSS variable for composite score range
// ---------------------------------------------------------------------------

export function getScoreColor(score: number): string {
  if (score <= 25) return "var(--z-debt)";
  if (score <= 50) return "var(--z-expense)";
  if (score <= 75) return "var(--z-income)";
  return "var(--z-excellent)";
}

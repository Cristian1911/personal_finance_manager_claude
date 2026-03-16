import type { CurrencyCode } from "@zeta/shared";

export const PLAN_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
] as const;

export function formatDebtFreeDate(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("es-CO", { year: "numeric", month: "long" });
}

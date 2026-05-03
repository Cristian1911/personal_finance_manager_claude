import { COLORS } from "../../../lib/constants/colors";

export const PLAN_COLORS = [COLORS.brass, COLORS.income, COLORS.alert] as const;

export const SPANISH_MONTHS_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export function formatDebtFreeDate(yyyyMm: string): string {
  if (!yyyyMm) return "—";
  const [year, month] = yyyyMm.split("-");
  const monthIdx = Number(month) - 1;
  const m = SPANISH_MONTHS_SHORT[monthIdx] ?? month;
  return `${m} ${year}`;
}

export function formatCalendarMonth(yyyyMm: string): string {
  return formatDebtFreeDate(yyyyMm);
}

export function formatMonths(months: number): string {
  if (months === 0) return "0 meses";
  if (months >= 360) return "+30 años";
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  if (years === 0) return `${remaining} ${remaining === 1 ? "mes" : "meses"}`;
  if (remaining === 0) return `${years} ${years === 1 ? "año" : "años"}`;
  return `${years}a ${remaining}m`;
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function getNextMonth(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

export function abbreviateName(name: string, maxLen = 14): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + "…";
}

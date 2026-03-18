"use server";

import { cache } from "react";
import { getDailySpending } from "@/actions/charts";
import type { CurrencyCode } from "@/types/domain";

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  amount: number;
  level: 0 | 1 | 2 | 3 | 4;
  dayOfWeek: number; // 0=Mon, 6=Sun
}

export interface HeatmapPatterns {
  weekendRatio: number; // e.g. 2.3 = spend 2.3x more on weekends
  highestDay: string; // Spanish day name, e.g. "sabado"
  zeroSpendDays: number;
  weekdayAvg: number;
  weekendAvg: number;
}

export interface HeatmapData {
  days: HeatmapDay[];
  dailyAverage: number;
  patterns: HeatmapPatterns;
  currency: CurrencyCode;
}

// Spanish day names indexed by JS getDay() (0=Sunday, 1=Monday, ..., 6=Saturday)
const SPANISH_DAY_NAMES = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];

// Map JS getDay() (0=Sun..6=Sat) to Mon-Sun index (0=Mon..6=Sun)
function toMonSunIndex(jsDay: number): number {
  // JS: 0=Sun,1=Mon,...,6=Sat → Mon-Sun: Sun becomes 6, Mon becomes 0, etc.
  return jsDay === 0 ? 6 : jsDay - 1;
}

function getLevelThreshold(amount: number, dailyAverage: number): 0 | 1 | 2 | 3 | 4 {
  if (amount === 0) return 0;
  if (amount < 0.5 * dailyAverage) return 1;
  if (amount < dailyAverage) return 2;
  if (amount < 2 * dailyAverage) return 3;
  return 4;
}

export const getSpendingHeatmap = cache(
  async (month?: string, currency?: CurrencyCode): Promise<HeatmapData | null> => {
    const dailySpending = await getDailySpending(month, currency);

    if (dailySpending.length === 0) {
      return null;
    }

    // Compute daily average (only over days with data)
    const totalAmount = dailySpending.reduce((sum, d) => sum + d.amount, 0);
    const dailyAverage = totalAmount / dailySpending.length;

    // Build HeatmapDay entries
    const days: HeatmapDay[] = dailySpending.map((d) => {
      const jsDay = new Date(d.date).getDay(); // 0=Sun..6=Sat
      const dayOfWeek = toMonSunIndex(jsDay);
      return {
        date: d.date,
        amount: d.amount,
        level: getLevelThreshold(d.amount, dailyAverage),
        dayOfWeek,
      };
    });

    // Group spending by JS getDay() (0..6) for pattern detection
    const dayTotals: Record<number, { sum: number; count: number }> = {};
    for (const d of dailySpending) {
      const jsDay = new Date(d.date).getDay();
      if (!dayTotals[jsDay]) dayTotals[jsDay] = { sum: 0, count: 0 };
      dayTotals[jsDay].sum += d.amount;
      dayTotals[jsDay].count += 1;
    }

    // weekdayAvg = avg spending Mon(1)..Fri(5)
    let weekdaySum = 0;
    let weekdayCount = 0;
    for (const day of [1, 2, 3, 4, 5]) {
      if (dayTotals[day]) {
        weekdaySum += dayTotals[day].sum;
        weekdayCount += dayTotals[day].count;
      }
    }
    const weekdayAvg = weekdayCount > 0 ? weekdaySum / weekdayCount : 0;

    // weekendAvg = avg spending Sat(6) + Sun(0)
    let weekendSum = 0;
    let weekendCount = 0;
    for (const day of [0, 6]) {
      if (dayTotals[day]) {
        weekendSum += dayTotals[day].sum;
        weekendCount += dayTotals[day].count;
      }
    }
    const weekendAvg = weekendCount > 0 ? weekendSum / weekendCount : 0;

    // weekendRatio — handle division by zero
    const weekendRatio = weekdayAvg > 0 ? weekendAvg / weekdayAvg : 0;

    // highestDay = Spanish name of day with highest average spending
    let highestJsDay = 0;
    let highestAvg = -1;
    for (let jsDay = 0; jsDay <= 6; jsDay++) {
      if (dayTotals[jsDay]) {
        const avg = dayTotals[jsDay].sum / dayTotals[jsDay].count;
        if (avg > highestAvg) {
          highestAvg = avg;
          highestJsDay = jsDay;
        }
      }
    }
    const highestDay = SPANISH_DAY_NAMES[highestJsDay];

    // zeroSpendDays = count of days in the input with amount === 0
    const zeroSpendDays = dailySpending.filter((d) => d.amount === 0).length;

    return {
      days,
      dailyAverage,
      patterns: {
        weekendRatio,
        highestDay,
        zeroSpendDays,
        weekdayAvg,
        weekendAvg,
      },
      currency: currency ?? "COP",
    };
  }
);

"use server";

import { computeRitmo, type RitmoResult } from "@zeta/shared";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import {
  parseMonth,
  monthEndStr,
  toColombiaDateString,
} from "@/lib/utils/date";
import { getDashboardHeroData, getDailySpending } from "@/actions/charts";
import type { CurrencyCode } from "@/types/domain";

/**
 * Canonical "ritmo" data for the dashboard hero. Wraps `getDashboardHeroData`
 * (for liquid balance + pending obligations + next-income date) and reuses
 * `getDailySpending` for the per-day OUTFLOW timeline so the hero, the
 * charts page, and the "Patrón del mes" view all share the exact same
 * filtering (currency, transfer exclusion, demo scope). Calls `computeRitmo`
 * from @zeta/shared so mobile and webapp produce identical numbers by
 * construction.
 */

export interface RitmoData extends RitmoResult {
  currency: CurrencyCode;
  /** End-of-month label like "31 may", for the period-bar legend. */
  windowEndLabel: string;
  /** Total liquid balance carried over so the UI can show "balance disponible". */
  liquidBalance: number;
  /** Sum of pending obligation amounts in the window, for the secondary panel. */
  pendingObligationsTotal: number;
  /** Next-income metadata for the "Próximo ingreso" line in the Cálculo view. */
  nextIncomeName: string | null;
  nextIncomeAmount: number;
  nextIncomeDateLabel: string | null;
  /** Whether the user has a configured income (next-income event or onboarding estimate).
   *  When false the hero verdict is synthetic — show an honest "Sin datos aún" state. */
  incomeConfigured: boolean;
}

export async function getRitmo(
  month?: string,
  currency?: CurrencyCode,
): Promise<{ success: true; data: RitmoData } | { success: false; error: string }> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  try {
    const target = parseMonth(month);
    const dateTo = monthEndStr(target);
    const today = toColombiaDateString(new Date());
    const usedCurrency = (currency ?? "COP") as CurrencyCode;

    // Reuse getDailySpending so the hero shares the canonical
    // filtering with the rest of the app (currency_code, transfer_group_id,
    // demo scope) — avoids parallel "almost the same" SQL diverging.
    // liquidOnly: computeRitmo budgets against the LIQUID balance
    // (CHECKING/SAVINGS/CASH), so its outflow series must count only money
    // that left those accounts — a credit-card purchase doesn't reduce the
    // liquid balance and must not eat the daily allowance.
    const [heroData, dailySpending] = await Promise.all([
      getDashboardHeroData(month, usedCurrency),
      getDailySpending(month, usedCurrency, { liquidOnly: true }),
    ]);
    const dailyOutflows = dailySpending.map((d) => ({
      date: d.date,
      expense: d.amount,
    }));

    const ritmo = computeRitmo({
      today,
      endOfMonth: dateTo,
      liquidBalance: heroData.totalLiquid,
      nextIncomeDate: heroData.nextIncomeDate,
      nextIncomeAmount: heroData.nextIncomeAmount,
      pendingObligations: heroData.windowObligations,
      dailyOutflows,
    });

    // "31 may" — short label for the period-bar legend.
    const windowEnd = new Date(`${ritmo.windowEndDate}T12:00:00`);
    const windowEndLabel = windowEnd.toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
    });
    const nextIncomeDateLabel = heroData.nextIncomeDate
      ? new Date(`${heroData.nextIncomeDate}T12:00:00`).toLocaleDateString("es-CO", {
          day: "numeric",
          month: "short",
        })
      : null;

    return {
      success: true,
      data: {
        ...ritmo,
        currency: usedCurrency,
        windowEndLabel,
        liquidBalance: heroData.totalLiquid,
        pendingObligationsTotal: heroData.windowObligations,
        nextIncomeName: heroData.nextIncomeName,
        nextIncomeAmount: heroData.nextIncomeAmount,
        nextIncomeDateLabel,
        incomeConfigured: heroData.incomeConfigured,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al cargar el ritmo";
    return { success: false, error: message };
  }
}

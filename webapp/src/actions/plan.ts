"use server";

import { cache } from "react";
import { getCategoriesWithBudgetData } from "@/actions/categories";
import { getDebtOverview } from "@/actions/debt";
import { getDebtFreeCountdown, type DebtCountdownData } from "@/actions/debt-countdown";
import { getEstimatedIncome, type IncomeEstimate } from "@/actions/income";
import { getPreferredCurrency } from "@/actions/profile";
import {
  getRecurringSummary,
  getUpcomingRecurrences,
} from "@/actions/recurring-templates";
import { getScenarios } from "@/actions/scenarios";
import { get503020Allocation, type AllocationData } from "@/actions/allocation";
import { getDashboardHeroData, type DashboardHeroData } from "@/actions/charts";
import type { CurrencyCode } from "@/types/domain";
import type {
  PlanHeroSummary,
  PlanPageData,
} from "@/types/plan";

function buildHeroSummary({
  heroData,
  activeDebtCount,
  allocation,
}: {
  heroData: DashboardHeroData;
  activeDebtCount: number;
  allocation: AllocationData | null;
}): PlanHeroSummary {
  const spentPercent = allocation
    ? ((allocation.needs.amount + allocation.wants.amount) / allocation.income) * 100
    : null;
  const isCritical = heroData.availableToSpend < 0 || (spentPercent != null && spentPercent > 100);
  const isWatch =
    !isCritical &&
    (heroData.pendingObligations.length > 0 || heroData.freshness !== "fresh" || (spentPercent != null && spentPercent >= 90));

  if (isCritical) {
    return {
      headline: "Tu plan necesita un ajuste inmediato",
      guidance:
        heroData.availableToSpend < 0
          ? "Ya no tienes margen libre este mes. Revisa pagos, presupuesto y deuda antes de comprometer más gasto."
          : "Ya vas por encima del presupuesto de este mes. Reordena categorías y pagos antes de seguir avanzando.",
      recommendedAction: {
        href: "/categories",
        label: "Ajustar presupuesto",
      },
      pressure: "critical",
      availableToSpend: heroData.availableToSpend,
      pendingTotal: heroData.totalPending,
      activeDebtCount,
    };
  }

  if (heroData.pendingObligations.length > 0) {
    return {
      headline: "Tu plan está vivo, pero hay obligaciones por resolver",
      guidance: `Tienes ${heroData.pendingObligations.length} ${heroData.pendingObligations.length === 1 ? "pago" : "pagos"} próximos por revisar antes de cerrar el mes con confianza.`,
      recommendedAction: {
        href: "/recurrentes",
        label: "Revisar obligaciones",
      },
      pressure: "watch",
      availableToSpend: heroData.availableToSpend,
      pendingTotal: heroData.totalPending,
      activeDebtCount,
    };
  }

  if (activeDebtCount > 0) {
    return {
      headline: "Tu plan está estable, pero la deuda sigue marcando el ritmo",
      guidance:
        "Revisa el costo de interés y tus escenarios guardados para decidir si conviene acelerar pagos este mes.",
      recommendedAction: {
        href: "/deudas/planificador",
        label: "Abrir planificador",
      },
      pressure: "watch",
      availableToSpend: heroData.availableToSpend,
      pendingTotal: heroData.totalPending,
      activeDebtCount,
    };
  }

  return {
    headline: "Tu plan está claro y bajo control",
    guidance:
      "El margen actual te permite decidir con calma. Usa esta vista para ajustar presupuesto y prioridades sin perder el hilo.",
    recommendedAction: {
      href: "/categories",
      label: "Ver presupuesto",
    },
    pressure: "stable",
    availableToSpend: heroData.availableToSpend,
    pendingTotal: heroData.totalPending,
    activeDebtCount,
  };
}

export const getPlanPageData = cache(
  async (month?: string, currency?: CurrencyCode): Promise<PlanPageData> => {
    const baseCurrency = currency ?? (await getPreferredCurrency());

    const [
      categoriesResult,
      debtOverview,
      debtCountdown,
      recurringSummary,
      upcomingRecurrences,
      savedScenarios,
      incomeEstimate,
      allocation,
      heroData,
    ] = await Promise.all([
      getCategoriesWithBudgetData(month, baseCurrency),
      getDebtOverview(baseCurrency),
      getDebtFreeCountdown(baseCurrency),
      getRecurringSummary(),
      getUpcomingRecurrences(30),
      getScenarios(),
      getEstimatedIncome(baseCurrency, month),
      get503020Allocation(month, baseCurrency),
      getDashboardHeroData(month, baseCurrency),
    ]);

    const categories = categoriesResult.success ? categoriesResult.data.filter((category) => category.direction === "OUTFLOW") : [];
    const overLimitCategories = categories.filter((category) => (category.budget ?? 0) > 0 && category.percentUsed > 100);
    const nearLimitCategories = categories.filter((category) => (category.budget ?? 0) > 0 && category.percentUsed >= 85);
    const attentionCategories = [...overLimitCategories, ...nearLimitCategories]
      .sort((a, b) => b.percentUsed - a.percentUsed)
      .slice(0, 4);

    const totalBudgeted = categories.reduce((sum, category) => sum + (category.budget ?? 0), 0);
    const totalSpent = categories.reduce((sum, category) => sum + category.spent, 0);
    const activeDebtAccounts = debtOverview.accounts.filter((account) => account.balance > 0);
    const highestInterestAccount = [...activeDebtAccounts].sort(
      (a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0)
    )[0];

    const dueSoon = upcomingRecurrences
      .filter((entry) =>
        entry.template.direction === "OUTFLOW" ||
        entry.template.account.account_type === "CREDIT_CARD" ||
        entry.template.account.account_type === "LOAN"
      )
      .filter((entry) => (entry.template.currency_code ?? baseCurrency) === baseCurrency)
      .slice(0, 6);
    const dueSoonTotal = dueSoon.reduce((sum, entry) => sum + entry.template.amount, 0);

    return {
      currency: baseCurrency,
      month,
      heroData,
      heroSummary: buildHeroSummary({
        heroData,
        activeDebtCount: activeDebtAccounts.length,
        allocation,
      }),
      budget: {
        categories,
        totalBudgeted,
        totalSpent,
        overLimitCount: overLimitCategories.length,
        nearLimitCount: nearLimitCategories.length,
        uncategorizedCount: allocation?.untaggedCategories ?? 0,
        attentionCategories,
        allocation,
      },
      debt: {
        overview: debtOverview,
        countdown: debtCountdown,
        activeDebtCount: activeDebtAccounts.length,
        highestInterestAccountName: highestInterestAccount?.name ?? null,
      },
      recurring: {
        upcoming: dueSoon,
        totalMonthlyExpenses: recurringSummary.totalMonthlyExpenses,
        totalMonthlyIncome: recurringSummary.totalMonthlyIncome,
        activeCount: recurringSummary.activeCount,
        dueSoonCount: dueSoon.length,
        dueSoonTotal,
      },
      scenarios: {
        savedScenarios,
        latestScenario: savedScenarios[0] ?? null,
        count: savedScenarios.length,
      },
      incomeEstimate,
    };
  }
);

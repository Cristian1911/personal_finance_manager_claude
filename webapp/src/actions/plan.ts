"use server";

import { cache } from "react";
import { getAccounts } from "@/actions/accounts";
import { getCategoriesWithBudgetData } from "@/actions/categories";
import { getDebtOverview } from "@/actions/debt";
import { getDebtFreeCountdown } from "@/actions/debt-countdown";
import { getEstimatedIncome } from "@/actions/income";
import { getRatesForCurrencies } from "@/actions/exchange-rate";
import { getPreferredCurrency } from "@/actions/profile";
import {
  getRecurringSummary,
  getUpcomingRecurrences,
} from "@/actions/recurring-templates";
import { get503020Allocation, type AllocationData } from "@/actions/allocation";
import { getDashboardHeroData, type DashboardHeroData } from "@/actions/charts";
import type { VerdictState } from "@/components/ui/verdict";
import type { Account, AccountType, CurrencyCode } from "@/types/domain";
import type {
  PlanHeroSummary,
  PlanMainAccountsSummary,
  PlanPageData,
} from "@/types/plan";
import { isDebtAccountType } from "@zeta/shared";

const MAIN_ACCOUNT_TYPES: AccountType[] = ["CHECKING", "SAVINGS", "CASH"];

async function buildMainAccountsSummary(
  accounts: Account[],
  baseCurrency: CurrencyCode
): Promise<PlanMainAccountsSummary> {
  const candidates = accounts.filter(
    (a) => MAIN_ACCOUNT_TYPES.includes(a.account_type) && a.show_in_dashboard
  );

  const otherCurrencies = [
    ...new Set(
      candidates
        .map((a) => a.currency_code as CurrencyCode)
        .filter((c) => c !== baseCurrency)
    ),
  ];
  const rates = otherCurrencies.length > 0
    ? await getRatesForCurrencies(otherCurrencies, baseCurrency)
    : new Map<CurrencyCode, number>();

  let hasUnconvertibleAccounts = false;
  const mainAccounts = candidates
    .map((a) => {
      const currency = a.currency_code as CurrencyCode;
      const balance = a.current_balance ?? 0;
      const rate = currency === baseCurrency ? 1 : rates.get(currency);
      if (!rate) {
        hasUnconvertibleAccounts = true;
        return null;
      }
      return {
        id: a.id,
        name: a.name,
        account_type: a.account_type,
        current_balance: balance,
        currency_code: currency,
        balance_in_base: balance * rate,
        icon: a.icon,
        color: a.color,
        bank_key: a.bank_key,
        mask: a.mask,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null)
    .sort((a, b) => b.balance_in_base - a.balance_in_base);

  const totalInBase = mainAccounts.reduce((sum, a) => sum + a.balance_in_base, 0);

  return {
    accounts: mainAccounts,
    totalInBase,
    hasUnconvertibleAccounts,
  };
}

function buildHeroSummary({
  heroData,
  activeDebtCount,
  allocation,
}: {
  heroData: DashboardHeroData;
  activeDebtCount: number;
  allocation: AllocationData | null;
}): PlanHeroSummary & { state: VerdictState } {
  const spentPercent = allocation && allocation.income > 0
    ? ((allocation.needs.amount + allocation.wants.amount) / allocation.income) * 100
    : null;
  const base = {
    availableToSpend: heroData.availableToSpend,
    pendingTotal: heroData.totalPending,
    activeDebtCount,
  };

  // te-pasaste — ≥100% of the plan used, or the margin went negative.
  if (heroData.availableToSpend < 0 || (spentPercent != null && spentPercent >= 100)) {
    return {
      ...base,
      headline:
        heroData.availableToSpend < 0
          ? "Tu margen del mes quedó en negativo."
          : "Ya gastaste todo el plan de este mes.",
      guidance:
        heroData.availableToSpend < 0
          ? "Revisa pagos, presupuesto y deuda antes de comprometer más gasto."
          : "Reordena categorías y pagos antes de seguir avanzando.",
      recommendedAction: {
        href: "/categories",
        label: "Ajustar presupuesto",
      },
      pressure: "critical",
      state: "te-pasaste",
    };
  }

  // cerca — 75–99% of the plan used.
  if (spentPercent != null && spentPercent >= 75) {
    return {
      ...base,
      headline: "A este ritmo llegas al límite antes de fin de mes.",
      guidance: `Llevas el ${Math.round(spentPercent)}% de tu ingreso gastado. Revisa las categorías con más presión antes de comprometer más gasto.`,
      recommendedAction: {
        href: "/categories",
        label: "Revisar presupuesto",
      },
      pressure: "watch",
      state: "cerca",
    };
  }

  // atencion — user action needed: pending payments.
  if (heroData.pendingObligations.length > 0) {
    const count = heroData.pendingObligations.length;
    return {
      ...base,
      headline: `Tienes ${count} ${count === 1 ? "pago próximo" : "pagos próximos"} por resolver.`,
      guidance: "Revísalos antes de cerrar el mes para que el plan refleje tu margen real.",
      recommendedAction: {
        href: "/recurrentes",
        label: "Revisar obligaciones",
      },
      pressure: "watch",
      state: "atencion",
    };
  }

  // atencion — data gap: balances stopped updating.
  if (heroData.freshness !== "fresh") {
    return {
      ...base,
      headline: "Tus movimientos llevan días sin actualizarse.",
      guidance: "Registra o importa lo más reciente para que el plan refleje tu mes real.",
      recommendedAction: {
        href: "/transactions",
        label: "Actualizar movimientos",
      },
      pressure: "watch",
      state: "atencion",
    };
  }

  if (activeDebtCount > 0) {
    return {
      ...base,
      headline: "La deuda sigue marcando el ritmo de tu plan.",
      guidance:
        "Revisa el costo de interés y tus escenarios guardados para decidir si conviene acelerar pagos este mes.",
      recommendedAction: {
        href: "/deudas/planificador",
        label: "Abrir planificador",
      },
      pressure: "watch",
      state: "vas-bien",
    };
  }

  const hasUpcomingIncome = heroData.pendingIncome > 0;
  return {
    ...base,
    headline: hasUpcomingIncome
      ? "Tu margen se mantiene y hay ingresos en camino."
      : "Tu margen te permite decidir con calma.",
    guidance: hasUpcomingIncome
      ? "Buen momento para revisar presupuesto y prioridades."
      : "Usa esta vista para ajustar presupuesto y prioridades sin perder el hilo.",
    recommendedAction: {
      href: "/categories",
      label: "Ver presupuesto",
    },
    pressure: "stable",
    state: "vas-bien",
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
      incomeEstimate,
      allocation,
      heroData,
      accountsResult,
    ] = await Promise.all([
      getCategoriesWithBudgetData(month, baseCurrency),
      getDebtOverview(baseCurrency),
      getDebtFreeCountdown(baseCurrency),
      getRecurringSummary(),
      getUpcomingRecurrences(30),
      getEstimatedIncome(baseCurrency, month),
      get503020Allocation(month, baseCurrency),
      getDashboardHeroData(month, baseCurrency),
      getAccounts(),
    ]);

    const mainAccounts = await buildMainAccountsSummary(
      accountsResult.success ? accountsResult.data : [],
      baseCurrency
    );

    const categories = categoriesResult.success ? categoriesResult.data.filter((category) => category.direction === "OUTFLOW") : [];
    const overLimitCategories = categories.filter((category) => (category.budget ?? 0) > 0 && category.percentUsed > 100);
    const nearLimitCategories = categories.filter((category) => (category.budget ?? 0) > 0 && category.percentUsed >= 85);
    const seen = new Set<string>();
    const attentionCategories = [...overLimitCategories, ...nearLimitCategories]
      .filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; })
      .sort((a, b) => b.percentUsed - a.percentUsed)
      .slice(0, 4);

    const totalBudgeted = categories.reduce((sum, category) => sum + (category.budget ?? 0), 0);
    const totalSpent = categories.reduce((sum, category) => sum + category.spent, 0);
    const activeDebtAccounts = debtOverview.accounts.filter((account) => account.balance > 0);
    const highestInterestAccount = [...activeDebtAccounts].sort(
      (a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0)
    )[0];

    const currencyFiltered = upcomingRecurrences
      .filter((entry) => (entry.template.currency_code ?? baseCurrency) === baseCurrency);

    const dueSoon = currencyFiltered
      .filter((entry) =>
        entry.template.direction === "OUTFLOW" ||
        isDebtAccountType(entry.template.account.account_type)
      )
      .slice(0, 6);
    const dueSoonTotal = dueSoon.reduce((sum, entry) => sum + entry.template.amount, 0);

    const upcomingIncome = currencyFiltered
      .filter((entry) =>
        entry.template.direction === "INFLOW" &&
        !isDebtAccountType(entry.template.account.account_type)
      )
      .slice(0, 4);

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
        upcomingIncome,
        totalMonthlyExpenses: recurringSummary.totalMonthlyExpenses,
        totalMonthlyIncome: recurringSummary.totalMonthlyIncome,
        activeCount: recurringSummary.activeCount,
        dueSoonCount: dueSoon.length,
        dueSoonTotal,
        overdueCount: recurringSummary.overdueCount,
      },
      mainAccounts,
      scenarios: {
        savedScenarios: [],
        latestScenario: null,
        count: 0,
      },
      incomeEstimate,
    };
  }
);

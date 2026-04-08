import { getDashboardHeroData } from "@/actions/charts";
import { getAttentionItems } from "@/actions/attention-items";
import { getBurnRate } from "@/actions/burn-rate";
import { getBudgetSummary } from "@/actions/budgets";
import { getAccounts } from "@/actions/accounts";
import { InicioRoot } from "@/components/mobile/v2/inicio/inicio-root";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import type { CurrencyCode } from "@/types/domain";

interface MobileZoneProps {
  month: string | undefined;
  currency: CurrencyCode;
  recentTx: Array<{
    id: string;
    amount: number;
    direction: "INFLOW" | "OUTFLOW";
    merchant_name?: string | null;
    clean_description?: string | null;
    currency_code?: string;
  }>;
}

export async function MobileZone({ month, currency, recentTx }: MobileZoneProps) {
  const [heroData, attentionItemsData, burnRateData, budgetSummary, accountsResult] =
    await Promise.all([
      getDashboardHeroData(month, currency),
      getAttentionItems(),
      getBurnRate(currency),
      getBudgetSummary(month),
      getAccounts(),
    ]);

  const allAccounts = accountsResult.success ? accountsResult.data : [];

  // Map recent transactions to mobile format
  const mobileRecentTx = recentTx.map((tx) => ({
    id: tx.id,
    description: tx.merchant_name || tx.clean_description || "Sin descripción",
    amount: tx.amount,
    currency_code: tx.currency_code ?? "COP",
    direction: tx.direction,
  }));

  // Derived date values
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(daysInMonth - now.getDate(), 1);

  // Primary account lookup
  const primaryAccount = (() => {
    const primary =
      allAccounts.find(
        (a) =>
          (a.account_type === "SAVINGS" || a.account_type === "CHECKING") &&
          a.show_in_dashboard
      ) ??
      allAccounts.find(
        (a) => a.account_type === "SAVINGS" || a.account_type === "CHECKING"
      );
    if (!primary) return undefined;
    return {
      id: primary.id,
      name: primary.name,
      currentBalance: primary.current_balance ?? 0,
      currencyCode: primary.currency_code as CurrencyCode,
    };
  })();

  // Mobile total spent derivation
  const mobileTotalSpent =
    heroData.totalLiquid - heroData.totalPending - heroData.availableToSpend;

  // Next payment info
  const firstPayment = heroData.pendingObligations[0];
  const nextPaymentDays = firstPayment
    ? Math.max(
        0,
        Math.ceil(
          (new Date(firstPayment.due_date).getTime() - Date.now()) / 86_400_000
        )
      )
    : null;

  return (
    <>
      <MobileHeader variant="main" title="Zeta" />
      <InicioRoot
        hero={{
          availablePerDay: heroData.availableToSpend / daysRemaining,
          availableTotal: heroData.availableToSpend,
          daysRemaining,
          currency,
          breakdown: {
            totalLiquid: heroData.totalLiquid,
            fixedExpenses: heroData.totalPending,
            alreadySpent: mobileTotalSpent,
          },
          primaryAccount,
        }}
        metrics={{
          runwayDays: burnRateData?.discretionary.runwayDays ?? 0,
          daysInMonth,
          dayOfMonth: now.getDate(),
          nextPaymentName: firstPayment?.name ?? null,
          nextPaymentDays,
          nextPaymentAmount: firstPayment?.amount ?? null,
          currency,
        }}
        attentionItems={attentionItemsData}
        burnRateData={burnRateData}
        totalBudget={budgetSummary.totalTarget}
        recentTransactions={mobileRecentTx}
        currency={currency}
      />
    </>
  );
}

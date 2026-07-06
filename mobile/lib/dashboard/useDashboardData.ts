import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { CurrencyCode } from "@zeta/shared";
import { getAllAccounts, type AccountRow } from "../repositories/accounts";
import { getTransactions } from "../repositories/transactions";
import {
  getPendingOccurrences,
  type OccurrenceWithTemplate,
} from "../repositories/recurring";
import { getPendingEmailTransactionsCount } from "../repositories/pending-email";
import {
  DEBT_ACCOUNT_TYPES,
  isDebtAccountType,
  LIQUID_ACCOUNT_TYPES,
} from "../constants/accounts";
import { getPreferredCurrency } from "../profile";
import { toLocalDateString, toLocalMonthString } from "../utils/date";

export type DashboardTx = {
  id: string;
  description: string;
  amount: number;
  currency_code: string;
  direction: "INFLOW" | "OUTFLOW";
  account_id: string;
  account_name: string;
  account_color: string | null;
  category_id: string | null;
  category_name_es: string | null;
  category_icon: string | null;
  transaction_date: string;
  is_recurring: boolean;
};

export type UpcomingItem = {
  id: string;
  name: string;
  amount: number;
  date: string; // ISO YYYY-MM-DD
  accountName: string;
};

export type NextBill = (UpcomingItem & { daysUntil: number }) | null;
export type NextIncome = (UpcomingItem & { daysUntil: number }) | null;

export type DashboardSummary = {
  currency: CurrencyCode;
  accounts: AccountRow[];
  transactions: DashboardTx[];

  /** Disponible (pulse) */
  availablePerDay: number;
  availableTotal: number;
  daysRemaining: number;
  daysLabel: string;

  /** Pulse extras */
  spentLast7: number;
  spentLast30: number;
  spentTrend7: number[]; // last 7 days daily spend
  spentTrend30: number[]; // last 30 days daily spend
  onTrack: boolean;

  /** Secondary metrics */
  dayOfMonth: number;
  daysInMonth: number;
  spentToday: number;
  spentYesterday: number;
  avgLast7: number;

  /** Widget data */
  nextBill: NextBill;
  nextIncome: NextIncome;
  upcomingBills: UpcomingItem[];
  upcomingIncomes: UpcomingItem[];
  netWorth: number;
  liquidBalance: number;
  pendingObligations: number;
  totalSpentThisMonth: number;
  /** Per-day OUTFLOW totals for the current calendar month — drives the
   *  V7 HybridHero calendar heatmap and the period progress bar. Ordered
   *  by date ascending. Excluded + reconciled + transfer + debt-account
   *  (credit card / loan) rows already removed by the same filter the
   *  totals use — cash pace tracks liquid accounts only. */
  dailyOutflowsThisMonth: { date: string; expense: number }[];

  /** "Por resolver" tile — counts for the HERRAMIENTAS system widget. */
  attention: {
    overdue: number;
    upcoming: number;
    pendingEmails: number;
  };
};

const EMPTY: DashboardSummary = {
  currency: "COP",
  accounts: [],
  transactions: [],
  availablePerDay: 0,
  availableTotal: 0,
  daysRemaining: 0,
  daysLabel: "",
  spentLast7: 0,
  spentLast30: 0,
  spentTrend7: [],
  spentTrend30: [],
  onTrack: true,
  dayOfMonth: 1,
  daysInMonth: 30,
  spentToday: 0,
  spentYesterday: 0,
  avgLast7: 0,
  nextBill: null,
  nextIncome: null,
  upcomingBills: [],
  upcomingIncomes: [],
  netWorth: 0,
  liquidBalance: 0,
  pendingObligations: 0,
  totalSpentThisMonth: 0,
  dailyOutflowsThisMonth: [],
  attention: { overdue: 0, upcoming: 0, pendingEmails: 0 },
};

export function useDashboardData() {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY);

  const load = useCallback(async () => {
    try {
      const now = new Date();
      const currentMonth = toLocalMonthString(now);
      const today = toLocalDateString(now);
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

      const [accounts, transactionsRaw, pendingOccs, preferredCurrency, pendingEmailsCount] = await Promise.all([
        getAllAccounts(),
        getTransactions({ month: currentMonth, limit: 500 }),
        getPendingOccurrences(),
        getPreferredCurrency(),
        getPendingEmailTransactionsCount(),
      ]);

      const txRows = transactionsRaw as any[];
      const accountMap = new Map(accounts.map((a: AccountRow) => [a.id, a]));

      const liquidBalance = accounts
        .filter((a: AccountRow) => LIQUID_ACCOUNT_TYPES.has(a.account_type))
        .reduce((sum: number, a: AccountRow) => sum + a.current_balance, 0);

      const nextIncomeOcc = pendingOccs.find(
        (o: OccurrenceWithTemplate) =>
          o.direction === "INFLOW" &&
          !isDebtAccountType(accountMap.get(o.account_id)?.account_type ?? "") &&
          o.occurrence_date >= today
      );

      const windowEndDate = nextIncomeOcc
        ? nextIncomeOcc.occurrence_date
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

      const daysRemaining = Math.max(
        1,
        Math.ceil(
          (new Date(windowEndDate + "T12:00:00").getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );

      const pendingObligations = pendingOccs
        .filter((o: OccurrenceWithTemplate) => {
          const acctType = accountMap.get(o.account_id)?.account_type ?? "";
          const effective =
            o.direction === "OUTFLOW" ||
            (o.direction === "INFLOW" && isDebtAccountType(acctType));
          return (
            effective &&
            o.occurrence_date >= today &&
            o.occurrence_date <= windowEndDate &&
            acctType !== "CREDIT_CARD"
          );
        })
        .reduce((sum: number, o: OccurrenceWithTemplate) => sum + o.expected_amount, 0);

      const availableTotal = Math.max(0, liquidBalance - pendingObligations);
      const availablePerDay = Math.round(availableTotal / daysRemaining);

      const netWorth = accounts.reduce((sum: number, a: AccountRow) => {
        return DEBT_ACCOUNT_TYPES.has(a.account_type)
          ? sum - a.current_balance
          : sum + a.current_balance;
      }, 0);

      // ── spend aggregates ─────────────────────────────────────────────
      const spentTrend30: number[] = Array(30).fill(0);
      const spentTrend7: number[] = Array(7).fill(0);
      let spentToday = 0;
      let spentYesterday = 0;
      let last7Total = 0;
      let last30Total = 0;
      let totalOutflow = 0;
      // Per-day OUTFLOW bucket keyed by ISO date for the V7 hero calendar.
      const outflowByDate = new Map<string, number>();

      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = toLocalDateString(yesterdayDate);

      for (const tx of txRows) {
        if (tx.is_excluded || tx.direction !== "OUTFLOW") continue;
        if (tx.transfer_group_id || tx.reconciled_into_transaction_id) continue;
        // Cash-pace metrics budget against the LIQUID balance — a credit-card
        // purchase doesn't move it, so debt-account outflows don't count here
        // (mirrors webapp getDailySpending liquidOnly).
        if (isDebtAccountType(accountMap.get(tx.account_id)?.account_type ?? "")) continue;
        const amount = Math.abs(tx.amount ?? 0);
        totalOutflow += amount;
        if (tx.transaction_date === today) spentToday += amount;
        if (tx.transaction_date === yesterdayStr) spentYesterday += amount;
        outflowByDate.set(
          tx.transaction_date,
          (outflowByDate.get(tx.transaction_date) ?? 0) + amount,
        );
        const txDate = new Date(tx.transaction_date + "T12:00:00");
        const diffDays = Math.floor(
          (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diffDays >= 0 && diffDays < 7) {
          last7Total += amount;
          spentTrend7[6 - diffDays] += amount;
        }
        if (diffDays >= 0 && diffDays < 30) {
          last30Total += amount;
          spentTrend30[29 - diffDays] += amount;
        }
      }

      const dailyOutflowsThisMonth = Array.from(outflowByDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, expense]) => ({ date, expense }));

      const avgLast7 = last7Total / 7;
      const projectedMonthly = avgLast7 * daysInMonth;
      const onTrack = projectedMonthly <= liquidBalance + totalOutflow;

      const daysUntilFrom = (iso: string) =>
        Math.max(
          0,
          Math.ceil(
            (new Date(iso + "T12:00:00").getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        );

      const buildUpcoming = (
        predicate: (o: OccurrenceWithTemplate) => boolean,
        fallbackName: string
      ): UpcomingItem[] =>
        pendingOccs
          .filter(predicate)
          .sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date))
          .slice(0, 6)
          .map((o) => ({
            id: o.id,
            name: o.merchant_name ?? o.description ?? fallbackName,
            amount: o.expected_amount,
            date: o.occurrence_date,
            accountName: accountMap.get(o.account_id)?.name ?? "",
          }));

      const upcomingBills = buildUpcoming((o) => {
        const acctType = accountMap.get(o.account_id)?.account_type ?? "";
        const effective =
          o.direction === "OUTFLOW" ||
          (o.direction === "INFLOW" && isDebtAccountType(acctType));
        return (
          effective &&
          daysUntilFrom(o.occurrence_date) >= 0 &&
          acctType !== "CREDIT_CARD"
        );
      }, "Recurrente");

      const upcomingIncomes = buildUpcoming(
        (o) =>
          o.direction === "INFLOW" &&
          !isDebtAccountType(accountMap.get(o.account_id)?.account_type ?? "") &&
          o.occurrence_date >= today,
        "Ingreso"
      );

      const nextBill: NextBill =
        upcomingBills.length > 0
          ? {
              ...upcomingBills[0],
              daysUntil: daysUntilFrom(upcomingBills[0].date),
            }
          : null;

      const nextIncome: NextIncome =
        upcomingIncomes.length > 0
          ? {
              ...upcomingIncomes[0],
              daysUntil: daysUntilFrom(upcomingIncomes[0].date),
            }
          : null;

      const recent: DashboardTx[] = txRows
        .filter((tx: any) => !tx.is_excluded && !tx.reconciled_into_transaction_id)
        .slice(0, 20)
        .map((tx: any) => {
          const acct = accountMap.get(tx.account_id);
          return {
            id: tx.id,
            description: tx.merchant_name ?? tx.description ?? "Sin descripcion",
            amount: Math.abs(tx.amount),
            currency_code: tx.currency_code ?? "COP",
            direction: tx.direction as "INFLOW" | "OUTFLOW",
            account_id: tx.account_id,
            account_name: acct?.name ?? "",
            account_color: acct?.color ?? null,
            category_id: tx.category_id ?? null,
            category_name_es: tx.category_name_es ?? null,
            category_icon: tx.category_icon ?? null,
            transaction_date: tx.transaction_date,
            is_recurring: Boolean(tx.is_recurring),
          };
        });

      const daysLabel = nextIncomeOcc
        ? `${daysRemaining} días`
        : `${daysRemaining} días restantes`;

      const overdueCount = pendingOccs.filter(
        (o: OccurrenceWithTemplate) => o.occurrence_date < today
      ).length;
      // Count from the unsliced pendingOccs so users with >12 upcoming items
      // see the real total instead of a 6+6 cap from the preview lists.
      const upcomingCount = pendingOccs.filter(
        (o: OccurrenceWithTemplate) => o.occurrence_date >= today
      ).length;

      setSummary({
        currency: preferredCurrency,
        accounts,
        transactions: recent,
        availablePerDay,
        availableTotal,
        daysRemaining,
        daysLabel,
        spentLast7: last7Total,
        spentLast30: last30Total,
        spentTrend7,
        spentTrend30,
        onTrack,
        dayOfMonth,
        daysInMonth,
        spentToday,
        spentYesterday,
        avgLast7,
        nextBill,
        nextIncome,
        upcomingBills,
        upcomingIncomes,
        netWorth,
        liquidBalance,
        pendingObligations,
        totalSpentThisMonth: totalOutflow,
        dailyOutflowsThisMonth,
        attention: {
          overdue: overdueCount,
          upcoming: upcomingCount,
          pendingEmails: pendingEmailsCount,
        },
      });
    } catch (err) {
      console.error("[dashboard] load failed", err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return { summary, reload: load };
}

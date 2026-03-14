/**
 * Debt scenario planning engine.
 * Builds on the existing simulation functions with support for:
 * - Time-sequenced cash injections
 * - Manual allocation overrides
 * - Interactive cascade control
 * - Calendar-month timeline
 */

import type { DebtAccount } from "./debt";
import { monthlyRateFromEA } from "./debt";
import type { CurrencyCode } from "../types/domain";
import type {
  CashEntry,
  ScenarioInput,
  ScenarioResult,
  ScenarioMonth,
  ScenarioEvent,
  ScenarioAllocations,
  ScenarioStrategy,
  ScenarioMonthAccount,
  ScenarioPayoffEntry,
} from "./scenario-types";

/**
 * Expand recurring CashEntry items into individual monthly entries.
 * Call this before passing entries to runScenario().
 */
export function expandCashEntries(entries: CashEntry[]): CashEntry[] {
  const result: CashEntry[] = [];

  for (const entry of entries) {
    if (!entry.recurring || entry.recurring.months <= 1) {
      const { recurring, ...rest } = entry;
      result.push(rest);
      continue;
    }

    const [yearStr, monthStr] = entry.month.split("-");
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10);

    for (let i = 0; i < entry.recurring.months; i++) {
      const m = String(month).padStart(2, "0");
      result.push({
        id: `${entry.id}-${i}`,
        amount: entry.amount,
        month: `${year}-${m}`,
        label: entry.label,
        currency: entry.currency,
      });

      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
  }

  return result;
}

const MIN_PAYMENT_RATE = 0.05;
const MIN_PAYMENT_FLOORS: Record<string, number> = {
  COP: 50_000,
  USD: 25,
  EUR: 25,
  BRL: 100,
  MXN: 500,
  PEN: 50,
  CLP: 15_000,
  ARS: 5_000,
};
const DEFAULT_FLOOR = 50_000;

/**
 * Get the minimum monthly payment for an account.
 * Uses the account's monthlyPayment if set, otherwise falls back to
 * 5% of balance with a currency-aware floor.
 */
export function getMinPayment(account: DebtAccount): number {
  if (account.monthlyPayment && account.monthlyPayment > 0) {
    return account.monthlyPayment;
  }
  const floor = MIN_PAYMENT_FLOORS[account.currency] ?? DEFAULT_FLOOR;
  return Math.max(account.balance * MIN_PAYMENT_RATE, floor);
}

const MAX_MONTHS = 360;
const BALANCE_EPSILON = 0.01;

/**
 * Advance a "YYYY-MM" string by `offset` months.
 */
function advanceMonth(startMonth: string, offset: number): string {
  const [y, m] = startMonth.split("-").map(Number);
  const total = (y * 12 + (m - 1)) + offset;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

/**
 * Get the priority account for extra/cascade payments based on strategy.
 */
function getScenarioPriority(
  balances: Record<string, number>,
  accounts: DebtAccount[],
  strategy: ScenarioStrategy,
  customPriority?: string[]
): string | null {
  const active = accounts.filter((a) => (balances[a.id] ?? 0) > BALANCE_EPSILON);
  if (active.length === 0) return null;

  if (strategy === "custom" && customPriority) {
    for (const id of customPriority) {
      if ((balances[id] ?? 0) > BALANCE_EPSILON) return id;
    }
    return null;
  }

  if (strategy === "snowball") {
    active.sort((a, b) => (balances[a.id] ?? 0) - (balances[b.id] ?? 0));
  } else {
    // avalanche (default)
    active.sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0));
  }
  return active[0].id;
}

function formatAmount(amount: number, currency: CurrencyCode): string {
  const symbol = currency === "USD" || currency === "EUR" ? currency + " " : "$";
  return symbol + Math.round(amount).toLocaleString("es-CO");
}

/**
 * Run a full scenario simulation with cash entries, manual overrides,
 * and cascade control.
 */
export function runScenario(input: ScenarioInput): ScenarioResult {
  const { accounts, cashEntries, strategy, allocations, startMonth } = input;

  const currency = accounts[0]?.currency ?? "COP";

  // Pre-index accounts by ID for O(1) lookups
  const accountsById = new Map(accounts.map((a) => [a.id, a]));

  // Pre-index manual overrides for O(1) lookup
  const overridesByKey = new Map(
    allocations.manualOverrides.map((o) => [`${o.month}:${o.cashEntryId}`, o])
  );

  // Pre-index cascade redirects by fromAccountId
  const cascadeByFrom = new Map(
    allocations.cascadeRedirects.map((r) => [r.fromAccountId, r])
  );

  // Initialize balances
  const balances: Record<string, number> = {};
  for (const a of accounts) {
    balances[a.id] = a.balance;
  }

  const timeline: ScenarioMonth[] = [];
  const payoffOrder: ScenarioPayoffEntry[] = [];
  let cumulativeInterest = 0;
  let totalAmountPaid = 0;
  const paidOffAccounts = new Set<string>();

  // Group cash entries by month for O(1) lookup
  const cashByMonth = new Map<string, CashEntry[]>();
  for (const ce of cashEntries) {
    const existing = cashByMonth.get(ce.month) ?? [];
    existing.push(ce);
    cashByMonth.set(ce.month, existing);
  }

  // Helper: mark an account as paid off and record events.
  // Returns the freed minimum payment amount.
  function markPaidOff(
    accountId: string,
    monthNum: number,
    calendarMonth: string,
    events: ScenarioEvent[],
  ): number {
    if (paidOffAccounts.has(accountId)) return 0;
    balances[accountId] = 0;
    paidOffAccounts.add(accountId);
    const acct = accountsById.get(accountId)!;
    payoffOrder.push({
      accountId,
      accountName: acct.name,
      month: monthNum,
      calendarMonth,
    });
    events.push({
      type: "account_paid_off",
      description: `${acct.name} liquidada`,
      accountId,
    });
    return getMinPayment(acct);
  }

  for (let monthIdx = 0; monthIdx < MAX_MONTHS; monthIdx++) {
    const totalBefore = Object.values(balances).reduce((s, b) => s + Math.max(b, 0), 0);
    if (totalBefore <= BALANCE_EPSILON) break;

    const calendarMonth = advanceMonth(startMonth, monthIdx);
    const monthNum = monthIdx + 1;
    const events: ScenarioEvent[] = [];
    const accountDetails: ScenarioMonthAccount[] = [];

    // Track per-account payments for this month
    const monthPayments: Record<string, { minimum: number; extra: number; cascade: number }> = {};
    for (const a of accounts) {
      monthPayments[a.id] = { minimum: 0, extra: 0, cascade: 0 };
    }

    // Snapshot balances before
    const balancesBefore: Record<string, number> = {};
    const interestAccrued: Record<string, number> = {};
    for (const a of accounts) {
      balancesBefore[a.id] = balances[a.id];
      interestAccrued[a.id] = 0;
    }

    // 1. Accrue interest
    let monthInterest = 0;
    for (const a of accounts) {
      if (balances[a.id] <= BALANCE_EPSILON) continue;
      const rate = a.interestRate ?? 0;
      const interest = balances[a.id] * monthlyRateFromEA(rate);
      balances[a.id] += interest;
      interestAccrued[a.id] = interest;
      monthInterest += interest;
    }
    // Update balancesBefore to post-interest (for accurate tracking)
    for (const a of accounts) {
      balancesBefore[a.id] = balances[a.id];
    }

    // 2. Pay minimums — track freed minimums
    let freedMinimums = 0;

    for (const a of accounts) {
      if (paidOffAccounts.has(a.id) || balances[a.id] <= BALANCE_EPSILON) {
        if (paidOffAccounts.has(a.id)) {
          freedMinimums += getMinPayment(a);
        }
        continue;
      }

      const minPay = Math.min(getMinPayment(a), balances[a.id]);
      balances[a.id] -= minPay;
      monthPayments[a.id].minimum = minPay;
      totalAmountPaid += minPay;

      if (balances[a.id] <= BALANCE_EPSILON) {
        freedMinimums += markPaidOff(a.id, monthNum, calendarMonth, events);
      }
    }

    // 3. Apply cash entries for this month
    const monthCash = cashByMonth.get(calendarMonth) ?? [];
    let unallocatedCash = 0;

    for (const ce of monthCash) {
      events.push({
        type: "cash_injection",
        description: ce.label
          ? `Inyección de ${formatAmount(ce.amount, currency)} (${ce.label})`
          : `Inyección de ${formatAmount(ce.amount, currency)}`,
        amount: ce.amount,
      });

      // Check manual overrides for this cash entry
      const override = overridesByKey.get(`${calendarMonth}:${ce.id}`);

      if (override) {
        const targetBal = balances[override.accountId] ?? 0;
        if (targetBal > BALANCE_EPSILON) {
          const payment = Math.min(override.amount, targetBal);
          balances[override.accountId] -= payment;
          monthPayments[override.accountId].extra += payment;
          totalAmountPaid += payment;
          unallocatedCash += ce.amount - payment;

          if (balances[override.accountId] <= BALANCE_EPSILON) {
            freedMinimums += markPaidOff(override.accountId, monthNum, calendarMonth, events);
          }
        } else {
          unallocatedCash += ce.amount;
        }
      } else {
        unallocatedCash += ce.amount;
      }
    }

    // Distribute unallocated cash by strategy
    let pool = unallocatedCash;
    while (pool > BALANCE_EPSILON) {
      const priorityId = getScenarioPriority(balances, accounts, strategy, allocations.customPriority);
      if (!priorityId) break;

      const payment = Math.min(pool, balances[priorityId]);
      balances[priorityId] -= payment;
      pool -= payment;
      monthPayments[priorityId].extra += payment;
      totalAmountPaid += payment;

      if (balances[priorityId] <= BALANCE_EPSILON) {
        freedMinimums += markPaidOff(priorityId, monthNum, calendarMonth, events);
      }
    }

    // 4. Apply freed minimums (cascade)
    let cascadePool = freedMinimums;
    while (cascadePool > BALANCE_EPSILON) {
      // Check cascade redirects first
      let targetId: string | null = null;
      for (const paidId of paidOffAccounts) {
        const redirect = cascadeByFrom.get(paidId);
        if (redirect && (balances[redirect.toAccountId] ?? 0) > BALANCE_EPSILON) {
          targetId = redirect.toAccountId;
          const fromAcct = accountsById.get(paidId)!;
          const toAcct = accountsById.get(redirect.toAccountId)!;
          events.push({
            type: "cascade_redirect",
            description: `${formatAmount(Math.min(cascadePool, balances[targetId]), currency)} liberados de ${fromAcct.name} → redirigidos a ${toAcct.name}`,
            fromAccountId: redirect.fromAccountId,
            toAccountId: redirect.toAccountId,
            freedAmount: Math.min(cascadePool, balances[targetId]),
          });
          break;
        }
      }

      if (!targetId) {
        targetId = getScenarioPriority(balances, accounts, strategy, allocations.customPriority);
      }
      if (!targetId) break;

      const payment = Math.min(cascadePool, balances[targetId]);
      balances[targetId] -= payment;
      cascadePool -= payment;
      monthPayments[targetId].cascade += payment;
      totalAmountPaid += payment;

      if (balances[targetId] <= BALANCE_EPSILON) {
        markPaidOff(targetId, monthNum, calendarMonth, events);
      }
    }

    // 5. Build month snapshot
    cumulativeInterest += monthInterest;

    for (const a of accounts) {
      accountDetails.push({
        accountId: a.id,
        balanceBefore: balancesBefore[a.id],
        interestAccrued: interestAccrued[a.id],
        minimumPaymentApplied: monthPayments[a.id].minimum,
        extraPaymentApplied: monthPayments[a.id].extra,
        cascadePaymentApplied: monthPayments[a.id].cascade,
        balanceAfter: Math.max(balances[a.id], 0),
        paidOff: paidOffAccounts.has(a.id),
      });
    }

    timeline.push({
      month: monthNum,
      calendarMonth,
      totalBalance: Object.values(balances).reduce((s, b) => s + Math.max(b, 0), 0),
      cumulativeInterest,
      accounts: accountDetails,
      events,
    });

    if (Object.values(balances).every((b) => b <= BALANCE_EPSILON)) break;
  }

  return {
    totalMonths: timeline.length,
    totalInterestPaid: cumulativeInterest,
    totalAmountPaid,
    debtFreeDate: timeline.length > 0 ? timeline[timeline.length - 1].calendarMonth : startMonth,
    payoffOrder,
    timeline,
  };
}

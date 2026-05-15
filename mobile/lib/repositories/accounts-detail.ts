import { getDatabase } from "../db/database";

export interface SnapshotPoint {
  date: string;
  balance: number;
}

export interface DailyPoint {
  date: string;
  amount: number;
}

function toColombiaDateString(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

/**
 * Running balance per day for the last year, walking transactions backwards
 * from currentBalance. Mirrors webapp getAccountBalanceHistoryCached.
 */
export async function getBalanceHistory(
  accountId: string,
  currentBalance: number,
): Promise<SnapshotPoint[]> {
  const db = await getDatabase();
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const cutoff = toColombiaDateString(oneYearAgo);

  const rows = await db.getAllAsync<{
    transaction_date: string;
    amount: number;
    direction: "INFLOW" | "OUTFLOW";
  }>(
    `SELECT transaction_date, amount, direction
       FROM transactions
      WHERE account_id = ?
        AND is_excluded = 0
        AND reconciled_into_transaction_id IS NULL
        AND transaction_date >= ?
      ORDER BY transaction_date DESC, created_at DESC
      LIMIT 5000`,
    [accountId, cutoff],
  );

  if (rows.length === 0) {
    return [{ date: toColombiaDateString(today), balance: currentBalance }];
  }

  const points: SnapshotPoint[] = [
    { date: toColombiaDateString(today), balance: currentBalance },
  ];
  let running = currentBalance;
  for (const tx of rows) {
    if (tx.direction === "OUTFLOW") running += tx.amount;
    else running -= tx.amount;
    points.push({ date: tx.transaction_date, balance: running });
  }
  points.reverse();

  const dailyMap = new Map<string, number>();
  for (const p of points) dailyMap.set(p.date, p.balance);
  return Array.from(dailyMap, ([date, balance]) => ({ date, balance })).sort(
    (a, b) => a.date.localeCompare(b.date),
  );
}

/**
 * Last-30-day daily outflow series + month-to-date total.
 * Mirrors webapp getAccountSpendingPulseCached.
 */
export async function getSpendingPulse(
  accountId: string,
): Promise<{ monthlySpent: number; dailyActivity: DailyPoint[] }> {
  const db = await getDatabase();
  const now = new Date();
  const todayStr = toColombiaDateString(now);
  const firstOfMonth = `${todayStr.slice(0, 7)}-01`;
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = toColombiaDateString(thirtyDaysAgo);

  const rows = await db.getAllAsync<{
    transaction_date: string;
    amount: number;
  }>(
    `SELECT transaction_date, amount
       FROM transactions
      WHERE account_id = ?
        AND direction = 'OUTFLOW'
        AND is_excluded = 0
        AND reconciled_into_transaction_id IS NULL
        AND transaction_date >= ?
      ORDER BY transaction_date ASC`,
    [accountId, cutoff],
  );

  let monthlySpent = 0;
  const dailyMap = new Map<string, number>();
  for (const row of rows) {
    const amt = row.amount ?? 0;
    dailyMap.set(row.transaction_date, (dailyMap.get(row.transaction_date) ?? 0) + amt);
    if (row.transaction_date >= firstOfMonth) monthlySpent += amt;
  }

  return {
    monthlySpent,
    dailyActivity: Array.from(dailyMap, ([date, amount]) => ({ date, amount })),
  };
}

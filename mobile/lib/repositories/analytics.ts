import {
  rangeToWindow,
  type AnalyticsRange,
  type AnalyticsTx,
  type CategoryMeta,
  type DestinatarioMeta,
} from "@zeta/shared";
import { getDatabase } from "../db/database";
import { isDebtAccountType } from "../constants/accounts";

/** Deterministic brand-palette color for a destinatario id (no color column).
 * Mirrors the webapp `destColor` so both platforms render the same swatch. */
const D_PALETTE = ["#937844", "#5CB88A", "#E8875A", "#768053", "#B29256", "#D9CCB9"];
function destColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return D_PALETTE[h % D_PALETTE.length];
}

/** Local mirror of the webapp `TendenciasDataset` — the rows + config inputs the
 * `@zeta/shared/analytics` engine needs. Ports `getTendenciasDataset` against
 * local SQLite. (categoryHierarchy lands with drill-down in a later slice.) */
export interface TendenciasDataset {
  rows: AnalyticsTx[];
  months: string[];
  debtAccountIds: string[];
  categoryMeta: [string, CategoryMeta][];
  destinatarioMeta: [string, DestinatarioMeta][];
  currentBalance: number;
}

export async function getTendenciasDataset(
  range: AnalyticsRange,
  currency = "COP"
): Promise<TendenciasDataset> {
  const db = await getDatabase();
  const { from, to, months } = rangeToWindow(range);

  const accounts = await db.getAllAsync<{
    id: string;
    account_type: string;
    current_balance: number | null;
    currency_code: string | null;
  }>(
    "SELECT id, account_type, current_balance, currency_code FROM accounts WHERE is_active = 1"
  );
  if (accounts.length === 0) {
    return {
      rows: [],
      months,
      debtAccountIds: [],
      categoryMeta: [],
      destinatarioMeta: [],
      currentBalance: 0,
    };
  }
  const debtAccountIds = accounts
    .filter((a) => isDebtAccountType(a.account_type))
    .map((a) => a.id);
  // Net worth in the active currency from non-debt accounts (forecast seed).
  let currentBalance = 0;
  for (const a of accounts) {
    if (!isDebtAccountType(a.account_type) && a.currency_code === currency) {
      currentBalance += Number(a.current_balance ?? 0);
    }
  }
  const accountIds = accounts.map((a) => a.id);
  const placeholders = accountIds.map(() => "?").join(",");

  const [txRows, budgetRows, destRows] = await Promise.all([
    db.getAllAsync<{
      transaction_date: string;
      amount: number;
      direction: string;
      category_id: string | null;
      destinatario_id: string | null;
      account_id: string;
      cat_name_es: string | null;
      cat_name: string | null;
      cat_color: string | null;
      cat_expense_type: string | null;
    }>(
      `SELECT t.transaction_date, ABS(t.amount) as amount, t.direction,
        t.category_id, t.destinatario_id, t.account_id,
        c.name_es as cat_name_es, c.name as cat_name,
        c.color as cat_color, c.expense_type as cat_expense_type
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.account_id IN (${placeholders})
         AND t.is_excluded = 0
         AND t.currency_code = ?
         AND t.transaction_date >= ? AND t.transaction_date <= ?
         AND t.reconciled_into_transaction_id IS NULL
         -- exclude both legs of a transfer (else they inflate spend + income)
         AND t.transfer_group_id IS NULL
         -- exclude the principal leg of a personal debt (lending isn't spend);
         -- webapp-created 'origin' rows sync down via the transactions pull
         AND (t.personal_debt_id IS NULL OR t.pd_role != 'origin')`,
      [...accountIds, currency, from, to]
    ),
    db.getAllAsync<{ category_id: string | null; amount: number }>(
      "SELECT category_id, amount FROM budgets WHERE period = 'monthly'"
    ),
    db.getAllAsync<{ id: string; name: string }>(
      "SELECT id, name FROM destinatarios"
    ),
  ]);

  const budgetMap = new Map<string, number>();
  for (const b of budgetRows) {
    if (b.category_id) budgetMap.set(b.category_id, Number(b.amount));
  }

  const rows: AnalyticsTx[] = [];
  const categoryMeta = new Map<string, CategoryMeta>();
  for (const t of txRows) {
    const expenseType =
      t.cat_expense_type === "fixed" || t.cat_expense_type === "variable"
        ? t.cat_expense_type
        : null;
    rows.push({
      amount: Number(t.amount),
      direction: t.direction as "INFLOW" | "OUTFLOW",
      date: t.transaction_date,
      categoryId: t.category_id,
      destinatarioId: t.destinatario_id,
      accountId: t.account_id,
      expenseType,
    });
    if (t.category_id && !categoryMeta.has(t.category_id)) {
      categoryMeta.set(t.category_id, {
        nameEs: t.cat_name_es ?? t.cat_name ?? "Sin categoría",
        color: t.cat_color ?? "#768053",
        expenseType,
        budgetTarget: budgetMap.get(t.category_id) ?? null,
      });
    }
  }

  const usedDestIds = new Set(
    rows.map((r) => r.destinatarioId).filter((id): id is string => Boolean(id))
  );
  const destinatarioMeta: [string, DestinatarioMeta][] = destRows
    .filter((d) => usedDestIds.has(d.id))
    .map((d) => [d.id, { name: d.name, color: destColor(d.id) }]);

  return {
    rows,
    months,
    debtAccountIds,
    categoryMeta: [...categoryMeta.entries()],
    destinatarioMeta,
    currentBalance,
  };
}

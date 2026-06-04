import {
  isPersonalDebtOverdue,
  type PersonalDebtDirection,
  type PersonalDebtStatus,
} from "@zeta/shared";
import { getDatabase } from "../db/database";
import { toLocalDateString } from "../utils/date";

/**
 * Local SQLite shape of a `personal_debts` row. Mirrors the Supabase
 * `personal_debts` view columns exactly (see schema.ts v16) — booleans land as
 * INTEGER 0/1. Read-only on mobile for now: debts are created/repaid on web and
 * pulled down. Mobile write parity (createPersonalDebt + recordRepayment) ships
 * in Phase 2 (see BACKLOG).
 */
export type PersonalDebtRow = {
  id: string;
  user_id: string;
  destinatario_id: string;
  direction: PersonalDebtDirection;
  principal_amount: number;
  currency_code: string;
  outstanding_amount: number;
  opened_on: string;
  due_date: string | null;
  status: PersonalDebtStatus;
  origin_transaction_id: string | null;
  notes: string | null;
  is_demo: number;
  created_at: string;
  updated_at: string;
};

export type PersonalDebtWithDetails = PersonalDebtRow & {
  destinatario_name: string | null;
  total_repaid: number;
  is_overdue: boolean;
};

/**
 * Active personal debts (lend/borrow), joined with destinatario name and the
 * summed amount of linked repayment transactions. Mirrors the webapp's
 * `getPersonalDebtsCached` read shape (overdue computed via the shared
 * predicate, repayments summed from linked `pd_role = 'repayment'` rows).
 */
export async function getActivePersonalDebts(): Promise<PersonalDebtWithDetails[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<
    PersonalDebtRow & { destinatario_name: string | null; total_repaid: number | null }
  >(
    `SELECT
       pd.*,
       d.name AS destinatario_name,
       (SELECT COALESCE(SUM(t.amount), 0)
          FROM transactions t
         WHERE t.personal_debt_id = pd.id AND t.pd_role = 'repayment') AS total_repaid
     FROM personal_debts pd
     LEFT JOIN destinatarios d ON pd.destinatario_id = d.id
     WHERE pd.status = 'active'
     ORDER BY pd.created_at DESC
     LIMIT 200`
  );

  const today = toLocalDateString();
  return rows.map((r) => ({
    ...r,
    destinatario_name: r.destinatario_name ?? null,
    total_repaid: r.total_repaid ?? 0,
    is_overdue: isPersonalDebtOverdue(r.due_date, r.status, today),
  }));
}

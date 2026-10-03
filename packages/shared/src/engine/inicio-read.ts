import type { InicioAccount, StoredTransaction } from "./disponible";
import { createSqlStorage, parseCurrencyBalances } from "./sql-storage";
import { toDialect, toIso, toNumber } from "./sql";
import type { CycleSettings, OccurrenceRow, SqlDriver } from "./types";

/** A fixed payment as Inicio and Pagos read it. */
export interface InicioTemplate {
  id: string;
  label: string;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  frequency: string;
  startDate: string;
  endDate: string | null;
  accountId: string | null;
  isActive: boolean;
}

/** A card or loan statement's numbers, for Disponible and the Tarjeta widget. */
export interface CardStatement {
  accountId: string;
  /** COP, or a card's USD section (S10-14). */
  currency?: string;
  cutDate: string | null;
  dueDate: string;
  minimum: number | null;
  totalDue: number | null;
  /** E.A., in percent. */
  rate: number | null;
}

export interface InicioData {
  settings: CycleSettings | null;
  /** Fixed payments (all, archived included: their past occurrences still show). */
  templates: InicioTemplate[];
  /** Occurrences whose status changed from the computed "pending". */
  occurrences: OccurrenceRow[];
  /** Comercios and personas (pickers, Movimientos). */
  destinatarios: { id: string; name: string; kind: "merchant" | "person"; defaultCategoryId: string | null }[];
  accounts: InicioAccount[];
  /** Movements dated on or after `since`, as the classifier reads them. */
  transactions: StoredTransaction[];
  /** Card/loan statements due on or after `since` (D24: the minimum counts). */
  statements: CardStatement[];
}

/**
 * Everything Inicio reads, in three queries, from the phone's SQLite or from
 * Postgres (same statements through toDialect). Scoped by `userId` even
 * where RLS already does it. Read-only: writes always go through commands.
 */
export async function readInicioData(driver: SqlDriver, userId: string, since: string): Promise<InicioData> {
  const pg = driver.dialect === "postgres";
  const q = <R>(sql: string, params: unknown[]) => driver.query<R>(toDialect(sql, driver.dialect), params);

  const settings = await createSqlStorage(driver).getCycleSettings(userId);

  const templateRows = await q<Record<string, unknown>>(
    `SELECT id, merchant_name, amount, direction, frequency, account_id, is_active,
            ${pg ? "start_date::text" : "start_date"} AS start_date, ${pg ? "end_date::text" : "end_date"} AS end_date
       FROM recurring_transaction_templates WHERE user_id = ? ORDER BY day_of_month, id`,
    [userId],
  );
  const occurrenceRows = await q<Record<string, unknown>>(
    `SELECT template_id, ${pg ? "occurrence_date::text" : "occurrence_date"} AS occurrence_date, expected_amount, status, transaction_id, linked_manually
       FROM recurring_occurrences WHERE user_id = ? AND occurrence_date >= ? AND status <> 'pending' ORDER BY occurrence_date, template_id`,
    [userId, since],
  );

  const accountRows = await q<Record<string, unknown>>(
    `SELECT a.id, a.name, a.account_type, a.institution_name, a.mask, a.current_balance, a.cutoff_day, a.payment_day, a.monthly_payment,
            a.currency_balances, s.counts_in_disponible
       FROM accounts a
       LEFT JOIN account_settings s ON s.user_id = a.user_id AND s.account_id = a.id
      WHERE a.user_id = ? AND a.is_active = ?
      ORDER BY a.id`,
    [userId, pg ? true : 1],
  );

  // Dates as text on Postgres: a JS Date would shift the day with the time zone.
  const txRows = await q<Record<string, unknown>>(
    `SELECT id, account_id, amount, currency_code, amount_in_base_currency, direction,
            ${pg ? "transaction_date::text" : "transaction_date"} AS transaction_date,
            capture_method, created_at, clean_description, notes, is_excluded, flow_class, transfer_group_id, category_id, destinatario_id,
            reconciled_into_transaction_id, status, ${pg ? "transaction_time::text" : "transaction_time"} AS transaction_time
       FROM transactions
      WHERE user_id = ? AND transaction_date >= ?
      ORDER BY transaction_date, id`,
    [userId, since],
  );

  const destinatarioRows = await q<Record<string, unknown>>(
    "SELECT id, name, kind, default_category_id FROM destinatarios WHERE user_id = ? AND is_active = ? ORDER BY name, id",
    [userId, pg ? true : 1],
  );

  const statementRows = await q<Record<string, unknown>>(
    `SELECT account_id, ${pg ? "period_to::text" : "period_to"} AS period_to, ${pg ? "payment_due_date::text" : "payment_due_date"} AS payment_due_date,
            minimum_payment, total_payment_due, interest_rate, currency_code
       FROM statement_snapshots WHERE user_id = ? AND payment_due_date >= ? ORDER BY payment_due_date`,
    [userId, since],
  );

  return {
    settings,
    statements: statementRows.map((r) => ({
      accountId: String(r.account_id), cutDate: (r.period_to as string | null) ?? null, dueDate: String(r.payment_due_date),
      minimum: r.minimum_payment == null ? null : toNumber(r.minimum_payment),
      totalDue: r.total_payment_due == null ? null : toNumber(r.total_payment_due),
      rate: r.interest_rate == null ? null : toNumber(r.interest_rate),
      currency: r.currency_code == null ? "COP" : String(r.currency_code),
    })),
    destinatarios: destinatarioRows.map((r) => ({
      id: String(r.id), name: String(r.name), kind: r.kind as "merchant" | "person", defaultCategoryId: (r.default_category_id as string | null) ?? null,
    })),
    templates: templateRows.map((r) => ({
      id: String(r.id), label: String(r.merchant_name ?? ""), amount: toNumber(r.amount),
      direction: r.direction as "INFLOW" | "OUTFLOW", frequency: String(r.frequency),
      startDate: String(r.start_date), endDate: (r.end_date as string | null) ?? null,
      accountId: (r.account_id as string | null) ?? null,
      // SQLite stores booleans as 0/1.
      isActive: r.is_active === true || r.is_active === 1,
    })),
    occurrences: occurrenceRows.map((r) => ({
      templateId: String(r.template_id), date: String(r.occurrence_date), expectedAmount: toNumber(r.expected_amount),
      status: r.status as OccurrenceRow["status"], transactionId: (r.transaction_id as string | null) ?? null,
      linkedManually: r.linked_manually === true || r.linked_manually === 1,
    })),
    accounts: accountRows.map((r) => ({
      id: String(r.id),
      name: String(r.name ?? ""),
      accountType: String(r.account_type),
      institutionName: (r.institution_name as string | null) ?? null,
      mask: (r.mask as string | null) ?? null,
      currentBalance: toNumber(r.current_balance),
      cutoffDay: r.cutoff_day == null ? null : toNumber(r.cutoff_day),
      monthlyPayment: r.monthly_payment == null ? null : toNumber(r.monthly_payment),
      paymentDay: r.payment_day == null ? null : toNumber(r.payment_day),
      // SQLite stores booleans as 0/1.
      countsInDisponible: r.counts_in_disponible == null ? null : r.counts_in_disponible === true || r.counts_in_disponible === 1,
      usdOwed: parseCurrencyBalances(r.currency_balances)?.USD?.current_balance ?? null,
    })),
    transactions: txRows.map((r) => ({
      id: String(r.id),
      accountId: String(r.account_id),
      date: String(r.transaction_date),
      amount: toNumber(r.amount),
      direction: r.direction as "INFLOW" | "OUTFLOW",
      currencyCode: String(r.currency_code),
      amountInBaseCurrency: r.amount_in_base_currency == null ? null : toNumber(r.amount_in_base_currency),
      captureMethod: (r.capture_method as string | null) ?? null,
      createdAt: r.created_at == null ? null : toIso(r.created_at),
      description: (r.clean_description as string | null) ?? null,
      notes: (r.notes as string | null) ?? null,
      // SQLite stores booleans as 0/1.
      isExcluded: r.is_excluded === true || r.is_excluded === 1,
      // Only hand-set classes for now (Anotar); unclassified rows read like the web
      // (outflow = spend, inflow = income). ponytail: no flow_class_override yet.
      flowClass: (r.flow_class as string | null) ?? null,
      transferGroupId: (r.transfer_group_id as string | null) ?? null,
      categoryId: (r.category_id as string | null) ?? null,
      destinatarioId: (r.destinatario_id as string | null) ?? null,
      // Merged into the bank's row: it no longer counts (movements.ts).
      reconciledIntoTransactionId: (r.reconciled_into_transaction_id as string | null) ?? null,
      status: r.status == null ? null : String(r.status),
      time: (r.transaction_time as string | null) ?? null,
    })),
  };
}

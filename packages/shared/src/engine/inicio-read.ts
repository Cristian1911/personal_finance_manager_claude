import type { InicioAccount, StoredTransaction } from "./disponible";
import { createSqlStorage } from "./sql-storage";
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
    `SELECT a.id, a.name, a.account_type, a.institution_name, a.mask, a.current_balance, a.cutoff_day, a.payment_day, a.monthly_payment, s.counts_in_disponible
       FROM accounts a
       LEFT JOIN account_settings s ON s.user_id = a.user_id AND s.account_id = a.id
      WHERE a.user_id = ? AND a.is_active = ?
      ORDER BY a.id`,
    [userId, pg ? true : 1],
  );

  // Dates as text on Postgres: a JS Date would shift the day with the time zone.
  const txRows = await q<Record<string, unknown>>(
    `SELECT id, account_id, amount, currency_code, direction,
            ${pg ? "transaction_date::text" : "transaction_date"} AS transaction_date,
            capture_method, created_at, clean_description, notes, is_excluded, flow_class, transfer_group_id, category_id, destinatario_id
       FROM transactions
      WHERE user_id = ? AND transaction_date >= ?
      ORDER BY transaction_date, id`,
    [userId, since],
  );

  const destinatarioRows = await q<Record<string, unknown>>(
    "SELECT id, name, kind, default_category_id FROM destinatarios WHERE user_id = ? AND is_active = ? ORDER BY name, id",
    [userId, pg ? true : 1],
  );

  return {
    settings,
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
    })),
    transactions: txRows.map((r) => ({
      id: String(r.id),
      accountId: String(r.account_id),
      date: String(r.transaction_date),
      amount: toNumber(r.amount),
      direction: r.direction as "INFLOW" | "OUTFLOW",
      currencyCode: String(r.currency_code),
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
    })),
  };
}

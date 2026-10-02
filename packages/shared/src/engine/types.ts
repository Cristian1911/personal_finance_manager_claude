/** Commands known to the engine. Add a name here when adding a handler. */
export type CommandType =
  | "captureManualTransaction"
  | "captureBankTransaction"
  | "resolveBankDuplicate"
  | "anchorStatementBalance"
  | "setTransactionNote"
  | "setTransactionExcluded"
  | "deleteTransaction"
  | "editTransaction"
  | "setCycleSettings"
  | "setAccountCountsInDisponible"
  | "createAccount"
  | "editAccount"
  | "archiveAccount"
  | "captureTransfer"
  | "createPagoFijo"
  | "editPagoFijo"
  | "archivePagoFijo"
  | "setOccurrenceStatus"
  | "setTransactionCategory"
  | "createDestinatario"
  | "setTransactionDestinatario"
  | "setDestinatarioCategory";

/**
 * One user action. `id` is created on the device (UUID) and makes replays
 * harmless; `clientTs` is ISO-8601 UTC and orders edits to the same field.
 */
export interface CommandEnvelope<P = unknown> {
  id: string;
  type: CommandType;
  userId: string;
  deviceId: string;
  clientTs: string;
  payload: P;
}

export type CommandStatus = "applied" | "duplicate" | "superseded" | "rejected";

/** Machine-readable reason for a rejection; `error` is the Spanish text for people. */
export type RejectionCode = "invalid" | "not_found" | "unsupported";

export interface CommandResult {
  status: CommandStatus;
  /** True when this command id had already been applied before. */
  replayed: boolean;
  data?: Record<string, unknown>;
  code?: RejectionCode;
  error?: string;
}

export type Dialect = "sqlite" | "postgres";

/** Minimal async SQL access. SQL is written with `?` placeholders. */
export interface SqlDriver {
  readonly dialect: Dialect;
  query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<R[]>;
  /** Runs `fn` in one transaction; nested calls reuse the open transaction. */
  transaction<T>(fn: (tx: SqlDriver) => Promise<T>): Promise<T>;
}

export interface AccountRow {
  id: string;
  userId: string;
  name: string;
  /** CHECKING, SAVINGS, CASH, INVESTMENT, CREDIT_CARD, LOAN, OTHER. */
  accountType: string;
  institutionName: string | null;
  /** Last 4 digits. */
  mask: string | null;
  currencyCode: string;
  /** Money you have; on a card or loan, what you owe. */
  currentBalance: number;
  /** False once archived: out of Mis cuentas and pickers, its movements stay. */
  isActive: boolean;
  creditLimit: number | null;
  cutoffDay: number | null;
  paymentDay: number | null;
  monthlyPayment: number | null;
}

/** A fixed payment (recurring_transaction_templates). */
export interface TemplateRow {
  id: string;
  userId: string;
  accountId: string | null;
  amount: number;
  currencyCode: string;
  direction: "INFLOW" | "OUTFLOW";
  frequency: string;
  dayOfMonth: number | null;
  startDate: string;
  endDate: string | null;
  /** merchant_name: what the bill is called. */
  name: string;
  isActive: boolean;
}

/** A stored occurrence (only once its status changed from the computed "pending"). */
export interface OccurrenceRow {
  templateId: string;
  /** YYYY-MM-DD; with templateId, the key the server shares. */
  date: string;
  expectedAmount: number;
  status: "pending" | "paid" | "skipped";
  transactionId: string | null;
  linkedManually: boolean;
}

/** The details a user can fix on an account (editAccount), by column. */
export interface AccountDetailsPatch {
  name?: string;
  institution_name?: string | null;
  mask?: string | null;
  credit_limit?: number | null;
  cutoff_day?: number | null;
  payment_day?: number | null;
  monthly_payment?: number | null;
  is_active?: boolean;
}

/** When the user gets paid (mirrors PaySchedule in disponible/cycle.ts, as stored). */
export type StoredPaySchedule =
  | { kind: "semimonthly"; paydays: [number, number] }
  | { kind: "monthly"; paydays: [number] }
  | { kind: "biweekly"; anchor: string }
  | { kind: "irregular" };

export interface CycleSettings {
  schedule: StoredPaySchedule | null;
  incomePerCycle: number | null;
  savingsPerCycle: number;
  /** First cycle: the balance told and when (the command's clientTs). */
  balanceAnchor: { balance: number; at: string } | null;
  bigPurchaseThreshold: number;
}

/** The columns a command may write; each key is written only when present. */
export interface CycleSettingsPatch {
  schedule?: StoredPaySchedule;
  incomePerCycle?: number | null;
  savingsPerCycle?: number;
  balanceAnchor?: { balance: number; at: string } | null;
  bigPurchaseThreshold?: number;
}

export interface TransactionInsert {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  currencyCode: string;
  direction: "INFLOW" | "OUTFLOW";
  transactionDate: string;
  cleanDescription: string;
  notes: string | null;
  captureMethod: "MANUAL_FORM" | "EMAIL_IMPORT" | "PDF_IMPORT";
  idempotencyKey: string;
  /** Set by hand (Anotar): stored with flow_class_version 0 (v1 FLOW_CLASS_HAND_SET_VERSION). */
  flowClass?: string | null;
  /** The rules version that classified it; omitted = set by hand (0). */
  flowClassVersion?: number;
  /** What the bank said: its line (feeds the idempotency key), time of day, merchant and alert family. */
  rawDescription?: string | null;
  transactionTime?: string | null;
  merchantName?: string | null;
  sourcePattern?: string | null;
  provider?: "MANUAL" | "EMAIL" | "OCR";
  /** PENDING = held for Revisar (a possible duplicate of `reconciledIntoTransactionId`); doesn't count. */
  status?: "POSTED" | "PENDING";
  reconciledIntoTransactionId?: string | null;
  /** Both legs of an Entre cuentas share it. */
  transferGroupId?: string | null;
  /** Set by the destinatario rules on capture (not a user choice: no field version). */
  categoryId?: string | null;
  destinatarioId?: string | null;
  /** Capture instant (the command's clientTs), ISO-8601 UTC. */
  createdAt: string;
}

export interface TransactionRow {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  currencyCode: string;
  direction: "INFLOW" | "OUTFLOW";
  /** YYYY-MM-DD. */
  transactionDate: string;
  cleanDescription: string | null;
  notes: string | null;
  captureMethod: string;
  idempotencyKey: string;
  /** Capture instant, ISO-8601 UTC; null for rows from before phone schema v3. */
  createdAt: string | null;
  /** Ignored ("no es un movimiento"): its amount is out of the account's balance, like on the web. */
  isExcluded: boolean;
  /** Entre cuentas: shared by both legs. */
  transferGroupId: string | null;
  categoryId: string | null;
  destinatarioId: string | null;
  flowClass: string | null;
  /** 0 = set by hand (Anotar); otherwise the rules version that classified it. */
  flowClassVersion: number | null;
  rawDescription: string | null;
  /** "HH:mm" when the bank said it. */
  transactionTime: string | null;
  sourcePattern: string | null;
  /** Set when this row was merged into a bank's row (it no longer counts); on a PENDING row, its likely twin. */
  reconciledIntoTransactionId: string | null;
  status: string;
}

/** A comercio or persona (S8-2). */
export interface DestinatarioRow {
  id: string;
  userId: string;
  name: string;
  kind: "merchant" | "person";
  defaultCategoryId: string | null;
}

export interface FieldVersion {
  clientTs: string;
  commandId: string;
}

export interface FieldVersionWrite {
  userId: string;
  entity: string;
  entityId: string;
  field: string;
  clientTs: string;
  commandId: string;
}

/**
 * Everything a command may read or write. One SQL implementation serves both
 * databases. Every read and update is scoped by `userId`, even where RLS
 * already does it (defense in depth; the phone has no RLS).
 */
export interface StoragePort {
  withTransaction<T>(fn: (s: StoragePort) => Promise<T>): Promise<T>;
  findCommand(userId: string, id: string): Promise<{ id: string; result: CommandResult } | null>;
  recordCommand(cmd: CommandEnvelope, result: CommandResult): Promise<void>;
  getAccount(userId: string, id: string): Promise<AccountRow | null>;
  insertAccount(row: Omit<AccountRow, "isActive">): Promise<void>;
  updateAccountDetails(userId: string, id: string, patch: AccountDetailsPatch): Promise<void>;
  adjustAccountBalance(userId: string, id: string, delta: number): Promise<void>;
  findTransactionByIdempotencyKey(userId: string, key: string): Promise<{ id: string } | null>;
  insertTransaction(row: TransactionInsert): Promise<void>;
  /** Same account, dates in [from, to], not already merged away: what a bank row may be a duplicate of. */
  listReconciliationCandidates(userId: string, accountId: string, from: string, to: string): Promise<TransactionRow[]>;
  setReconciliation(userId: string, id: string, intoId: string | null, status: "POSTED" | "PENDING"): Promise<void>;
  /** Bank movements held for Revisar because they may be `twinId`. */
  listHeldFor(userId: string, twinId: string): Promise<TransactionRow[]>;
  updateTransactionFlow(userId: string, id: string, f: { flowClass: string | null; flowClassVersion: number | null; transferGroupId: string | null }): Promise<void>;
  getTransaction(userId: string, id: string): Promise<TransactionRow | null>;
  updateTransactionNotes(userId: string, id: string, notes: string | null): Promise<void>;
  updateTransactionExcluded(userId: string, id: string, excluded: boolean): Promise<void>;
  deleteTransaction(userId: string, id: string): Promise<void>;
  insertTemplate(row: TemplateRow, createdAt: string): Promise<void>;
  getTemplate(userId: string, id: string): Promise<TemplateRow | null>;
  /** Active fixed payments of one direction. */
  listTemplates(userId: string, direction: "INFLOW" | "OUTFLOW"): Promise<TemplateRow[]>;
  updateTemplate(userId: string, id: string, patch: { merchant_name?: string; description?: string; amount?: number; day_of_month?: number; start_date?: string; is_active?: boolean }, updatedAt: string): Promise<void>;
  getOccurrence(userId: string, templateId: string, date: string): Promise<OccurrenceRow | null>;
  /** Insert or update by (template, date); `id` is used only when the row is new. */
  upsertOccurrence(userId: string, id: string, row: OccurrenceRow, at: string): Promise<void>;
  /** Occurrences paid by these movements. */
  findOccurrencesByTransaction(userId: string, transactionId: string): Promise<OccurrenceRow[]>;
  /** Movements on or after `since`, for bill detection when a bill is added. */
  listTransactionsSince(userId: string, since: string): Promise<TransactionRow[]>;
  updateTransactionLabels(userId: string, id: string, patch: { category_id?: string | null; destinatario_id?: string | null }): Promise<void>;
  insertDestinatario(row: DestinatarioRow, at: string): Promise<void>;
  getDestinatario(userId: string, id: string): Promise<DestinatarioRow | null>;
  setDestinatarioDefaultCategory(userId: string, id: string, categoryId: string | null, at: string): Promise<void>;
  /** Adds a 'contains' pattern unless that destinatario already has it. */
  addDestinatarioRule(userId: string, id: string, destinatarioId: string, pattern: string, at: string): Promise<void>;
  /** Every rule with its destinatario's name and default category, for matchDestinatario. */
  listDestinatarioRules(userId: string): Promise<{ destinatario_id: string; destinatario_name: string; default_category_id: string | null; match_type: "contains" | "exact"; pattern: string; priority: number }[]>;
  listTransactionsByDestinatario(userId: string, destinatarioId: string): Promise<TransactionRow[]>;
  /** The legs of an Entre cuentas, oldest first. */
  getTransferLegs(userId: string, transferGroupId: string): Promise<TransactionRow[]>;
  updateTransactionFacts(userId: string, id: string, facts: { amount: number; transactionDate: string; accountId: string }): Promise<void>;
  getFieldVersion(userId: string, entity: string, entityId: string, field: string): Promise<FieldVersion | null>;
  setFieldVersion(v: FieldVersionWrite): Promise<void>;
  getCycleSettings(userId: string): Promise<CycleSettings | null>;
  upsertCycleSettings(userId: string, patch: CycleSettingsPatch): Promise<void>;
  getAccountSetting(userId: string, accountId: string): Promise<{ countsInDisponible: boolean } | null>;
  setAccountSetting(userId: string, accountId: string, countsInDisponible: boolean): Promise<void>;
}

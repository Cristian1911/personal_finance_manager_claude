/** Commands known to the engine. Add a name here when adding a handler. */
export type CommandType = "captureManualTransaction" | "setTransactionNote";

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
  currentBalance: number;
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
  captureMethod: "MANUAL_FORM";
  idempotencyKey: string;
}

export interface TransactionRow {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  cleanDescription: string | null;
  notes: string | null;
  idempotencyKey: string;
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
  adjustAccountBalance(userId: string, id: string, delta: number): Promise<void>;
  findTransactionByIdempotencyKey(userId: string, key: string): Promise<{ id: string } | null>;
  insertTransaction(row: TransactionInsert): Promise<void>;
  getTransaction(userId: string, id: string): Promise<TransactionRow | null>;
  updateTransactionNotes(userId: string, id: string, notes: string | null): Promise<void>;
  getFieldVersion(userId: string, entity: string, entityId: string, field: string): Promise<FieldVersion | null>;
  setFieldVersion(v: FieldVersionWrite): Promise<void>;
}

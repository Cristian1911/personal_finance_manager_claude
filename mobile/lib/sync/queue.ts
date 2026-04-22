import type { SQLiteDatabase } from "expo-sqlite";

/**
 * Enqueue an INSERT into sync_queue. Caller handles the local table INSERT.
 * Typically wrapped with the local INSERT in a single SQLite transaction.
 */
export async function enqueueInsert(
  db: SQLiteDatabase,
  tableName: string,
  recordId: string,
  payload: Record<string, unknown>,
  now: string = new Date().toISOString()
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
     VALUES (?, ?, 'INSERT', ?, ?)`,
    [tableName, recordId, JSON.stringify(payload), now]
  );
}

export async function enqueueUpdate(
  db: SQLiteDatabase,
  tableName: string,
  recordId: string,
  payload: Record<string, unknown>,
  now: string = new Date().toISOString()
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
     VALUES (?, ?, 'UPDATE', ?, ?)`,
    [tableName, recordId, JSON.stringify(payload), now]
  );
}

export async function enqueueDelete(
  db: SQLiteDatabase,
  tableName: string,
  recordId: string,
  now: string = new Date().toISOString()
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
     VALUES (?, ?, 'DELETE', ?, ?)`,
    [tableName, recordId, JSON.stringify({ id: recordId }), now]
  );
}

import { applyCommand, type EngineOptions } from "./runner";
import { toDialect } from "./sql";
import { createSqlStorage } from "./sql-storage";
import type { CommandEnvelope, CommandResult, SqlDriver } from "./types";

/**
 * Phone-only queue of commands to send to the server (drained in M2). The
 * payload stays in `commands`; the server's answer goes to `server_result`,
 * never over `commands.result` (that is what local replays return).
 */
export const OUTBOX_SCHEMA = `
CREATE TABLE outbox (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  command_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sent','acked','dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  server_result TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`;

/**
 * Runs a command locally and queues it for the server in the same
 * transaction: either both happen or neither does. Rejected commands and
 * replays are not queued.
 */
export function applyAndEnqueue(
  driver: SqlDriver,
  cmd: CommandEnvelope,
  opts: EngineOptions = {},
): Promise<CommandResult> {
  return driver.transaction(async (tx) => {
    const result = await applyCommand(createSqlStorage(tx), cmd, opts);
    if (result.status !== "rejected" && !result.replayed) {
      await tx.query(toDialect("INSERT INTO outbox (command_id, user_id) VALUES (?, ?)", tx.dialect), [cmd.id, cmd.userId]);
    }
    return result;
  });
}

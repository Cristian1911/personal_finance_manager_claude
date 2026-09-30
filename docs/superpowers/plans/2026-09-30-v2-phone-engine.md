# v2 Phone Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the shared v2 engine on the phone against a new SQLCipher-encrypted database, queue every accepted command in an outbox, and let the owner verify it on a device through a debug screen with an on-device self-test.

**Architecture:** The engine gains an injectable hash function (Hermes has no `crypto.subtle`) and ships the phone's SQLite schema plus an `applyAndEnqueue` helper (engine + outbox row in one transaction), all tested in Node on sql.js. The phone adds a mutex-guarded expo-sqlite `SqlDriver`, a keyed `zeta-v2.db` (key in SecureStore), `runLocalCommand`, an on-device self-test and a `/v2-debug` screen.

**Tech Stack:** TypeScript 5.9, Vitest 4 + sql.js (shared tests), Expo 55, expo-sqlite 55 (`useSQLCipher`), expo-crypto, expo-secure-store, expo-router, NativeWind v3 classes.

**Spec:** `docs/superpowers/specs/2026-09-30-v2-phone-engine-design.md` · `docs/mlp/10-build-plan.md` §3.1–3.2 · decisions S1-1, S1-2, S2-1 in `docs/mlp/12-decision-log.md`.

## Global Constraints

- Scope: phone engine only — no server route, no outbox drain, no pull, no v2 UI shell.
- New database file `zeta-v2.db`; the v1 `zeta.db` and `mobile/lib/db/` are not touched.
- Key: 32 random bytes (expo-crypto) as lower-case hex, SecureStore key `zeta.v2.dbKey`, `keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`; device id in `zeta.v2.deviceId`.
- All v2 database access goes through the driver's mutex; transactions are `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK` on the one connection (never `withExclusiveTransactionAsync`: it opens an un-keyed second connection).
- Queued: `applied`, `duplicate`, `superseded`. Not queued: `rejected`, or `replayed: true`.
- A tap never touches the network.
- Ids are lower-case UUIDs (the engine rejects upper case).
- User-facing strings in Spanish; no emoji, no "!" in UI copy.
- Mobile UI: NativeWind v3 classes only; screens use `MobileHeader variant="sub"` (safe area).
- Never commit to `main`. Gates before the PR: `pnpm install` (repo root, lockfile), `pnpm --filter @zeta/shared test`, `pnpm build:web`, `cd mobile && npx tsc --noEmit`, `pnpm audit --audit-level high`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **A second copy of the app process / fast double tap** — two `runLocalCommand` calls at once must serialize (mutex), never interleave inside one transaction. Pinned by the Task 3 driver design + Task 4 self-test "dos comandos a la vez".
2. **Key present in SecureStore but the file was deleted (or restored from backup without the key)** — opening must rebuild cleanly, never crash the app. Pinned in Task 3 (`openV2Database` rebuild path) and exercised by "Borrar base v2" on the device.
3. **App killed mid-command** — nothing half-written: command, rows and outbox row commit together. Pinned by Task 2 atomicity test.
4. **v1 data after the SQLCipher native build** — the existing un-keyed `zeta.db` must still open. Pinned by the Task 6 simulator check.
5. **Replaying a command that the phone already queued** — no second outbox row. Pinned by Task 2 replay test.

## File Structure

| File | Responsibility |
|---|---|
| `packages/shared/src/engine/runner.ts` | `applyCommand(storage, cmd, opts?)` — adds `EngineOptions { hash? }` |
| `packages/shared/src/engine/commands/*.ts` | handlers receive `opts`; capture passes `opts.hash` to `computeIdempotencyKey` |
| `packages/shared/src/engine/schema/sqlite.ts` | `SQLITE_ENGINE_SCHEMA` (single source for phone + tests) |
| `packages/shared/src/engine/outbox.ts` | `OUTBOX_SCHEMA`, `applyAndEnqueue(driver, cmd, opts?)` |
| `packages/shared/src/engine/__tests__/outbox.test.ts` | queue rules + atomicity (sql.js) |
| `mobile/lib/v2/flags.ts` | `V2_DEBUG_ENABLED` |
| `mobile/lib/v2/engine/secrets.ts` | key + device id in SecureStore, `toHex` |
| `mobile/lib/v2/engine/sqlite-driver.ts` | `createExpoSqliteDriver(db)` with mutex |
| `mobile/lib/v2/engine/database.ts` | `openKeyed`, `getV2Database`, `resetV2Database`, migrations |
| `mobile/lib/v2/engine/run-local.ts` | `expoSha256`, `runLocalCommand`, `replayLocalCommand` |
| `mobile/lib/v2/engine/self-test.ts` | `runSelfTest()` on a throwaway keyed file |
| `mobile/app/v2-debug.tsx` | debug screen |
| `mobile/app/settings.tsx` | link to `/v2-debug` when enabled |
| `mobile/app.json` | `useSQLCipher: true` |

---

### Task 1: Injectable hash + engine SQLite schema

**Files:**
- Modify: `packages/shared/src/engine/runner.ts`
- Modify: `packages/shared/src/engine/commands/capture-manual-transaction.ts`
- Modify: `packages/shared/src/engine/commands/set-transaction-note.ts`
- Create: `packages/shared/src/engine/schema/sqlite.ts`
- Modify: `packages/shared/src/engine/__tests__/support/schema.ts`
- Modify: `packages/shared/src/engine/index.ts`
- Test: `packages/shared/src/engine/__tests__/capture-manual-transaction.test.ts`

**Interfaces:**
- Consumes: `computeIdempotencyKey(params, hashFn?)` and `type HashFn = (payload: string) => Promise<string>` from `packages/shared/src/utils/idempotency.ts` (already exported from `@zeta/shared`).
- Produces: `interface EngineOptions { hash?: HashFn }`; `applyCommand(storage: StoragePort, cmd: CommandEnvelope, opts?: EngineOptions): Promise<CommandResult>`; `SQLITE_ENGINE_SCHEMA: string`. All exported from `@zeta/shared`.

- [ ] **Step 1: Write the failing test** — add inside `describe.each(DRIVERS)("captureManualTransaction on %s", …)` in `capture-manual-transaction.test.ts`:

```ts
  it("uses the hash function it is given (the phone passes expo-crypto's)", async () => {
    const s = await setup();
    const seen: string[] = [];
    await applyCommand(s, capture(), { hash: async (payload) => { seen.push(payload); return "custom-key"; } });
    expect(seen).toHaveLength(1);
    expect((await s.getTransaction(USER, TX))?.idempotencyKey).toBe("custom-key");
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @zeta/shared exec vitest run src/engine/__tests__/capture-manual-transaction.test.ts`
Expected: FAIL — `expected [] to have a length of 1` (the option is ignored).

- [ ] **Step 3: Implement** — `runner.ts`:

```ts
import { captureManualTransaction } from "./commands/capture-manual-transaction";
import { setTransactionNote } from "./commands/set-transaction-note";
import type { HashFn } from "../utils/idempotency";
import type { CommandEnvelope, CommandResult, CommandType, StoragePort } from "./types";
import { UUID_RE, isIsoUtc } from "./validate";

/** Platform services a handler may need. The phone passes expo-crypto's SHA-256 (Hermes has no crypto.subtle). */
export interface EngineOptions {
  hash?: HashFn;
}

type Handler = (s: StoragePort, cmd: CommandEnvelope<never>, opts: EngineOptions) => Promise<CommandResult>;
```

and in `applyCommand` change the signature and the handler call:

```ts
export async function applyCommand(
  storage: StoragePort,
  cmd: CommandEnvelope,
  opts: EngineOptions = {},
): Promise<CommandResult> {
```
```ts
    const result = await handler(s, cmd as CommandEnvelope<never>, opts);
```

`capture-manual-transaction.ts` — import `EngineOptions` type and use it:

```ts
import type { EngineOptions } from "../runner";
```
```ts
export async function captureManualTransaction(
  s: StoragePort,
  cmd: CommandEnvelope<CaptureManualTransactionPayload>,
  opts: EngineOptions = {},
): Promise<CommandResult> {
```
```ts
  const idempotencyKey = await computeIdempotencyKey({
    provider: "MANUAL",
    providerTransactionId: p.transactionId,
    transactionDate: p.date,
    amount: p.amount,
    rawDescription: p.description.trim(),
  }, opts.hash);
```

`set-transaction-note.ts` — no behaviour change; its signature stays `(s, cmd)` (a handler may ignore the third argument).

`schema/sqlite.ts` — move the SQLite schema out of the test support file (contents identical to today's `SQLITE_SCHEMA`):

```ts
/**
 * The engine's tables on SQLite — used by the phone database (mobile/lib/v2)
 * and by the contract tests, so the two can't drift. Column names match the
 * Supabase views; user_id leads the keys like the Postgres migration.
 */
export const SQLITE_ENGINE_SCHEMA = `
CREATE TABLE accounts (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  current_balance REAL NOT NULL DEFAULT 0
);
CREATE TABLE transactions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, account_id TEXT NOT NULL,
  amount REAL NOT NULL, currency_code TEXT NOT NULL, direction TEXT NOT NULL,
  transaction_date TEXT NOT NULL, clean_description TEXT, notes TEXT,
  capture_method TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE
);
CREATE TABLE commands (
  id TEXT NOT NULL, user_id TEXT NOT NULL, device_id TEXT NOT NULL,
  type TEXT NOT NULL, client_ts TEXT NOT NULL, payload TEXT,
  status TEXT NOT NULL, result TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, id)
);
CREATE TABLE field_versions (
  user_id TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL,
  field TEXT NOT NULL, client_ts TEXT NOT NULL, command_id TEXT NOT NULL,
  PRIMARY KEY (user_id, entity, entity_id, field)
);
`;
```

Before writing it, open `__tests__/support/schema.ts` and copy its current `SQLITE_SCHEMA` string verbatim if it differs from the block above (the file is the source of truth). Then in `support/schema.ts` delete the `SQLITE_SCHEMA` constant and add at the top:

```ts
export { SQLITE_ENGINE_SCHEMA as SQLITE_SCHEMA } from "../../schema/sqlite";
```

`index.ts` — add:

```ts
export { applyCommand, type EngineOptions } from "./runner";
export { SQLITE_ENGINE_SCHEMA } from "./schema/sqlite";
```
(replace the existing `export { applyCommand } from "./runner";` line).

- [ ] **Step 4: Run the engine suite**

Run: `pnpm --filter @zeta/shared exec vitest run src/engine`
Expected: PASS — all engine tests (previous 55 + 2 new) on both drivers.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/engine
git commit -m "feat(engine): injectable hash function + shared SQLite engine schema

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Outbox — `applyAndEnqueue`

**Files:**
- Create: `packages/shared/src/engine/outbox.ts`
- Modify: `packages/shared/src/engine/index.ts`
- Test: `packages/shared/src/engine/__tests__/outbox.test.ts`

**Interfaces:**
- Consumes: `applyCommand(storage, cmd, opts?)`, `EngineOptions` (Task 1); `createSqlStorage`, `toDialect`, `SqlDriver`, `CommandEnvelope`, `CommandResult`; test helpers `createSqlJsDriver`, `seedAccount` from `__tests__/support/drivers.ts`.
- Produces: `OUTBOX_SCHEMA: string`; `applyAndEnqueue(driver: SqlDriver, cmd: CommandEnvelope, opts?: EngineOptions): Promise<CommandResult>`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/shared/src/engine/__tests__/outbox.test.ts
import { describe, expect, it } from "vitest";
import { OUTBOX_SCHEMA, applyAndEnqueue } from "../outbox";
import { createSqlStorage } from "../sql-storage";
import type { CommandEnvelope, SqlDriver } from "../types";
import { createSqlJsDriver, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const TX = "33333333-3333-4333-8333-333333333333";

function capture(over: Record<string, unknown> = {}, id = "44444444-4444-4444-8444-444444444444"): CommandEnvelope {
  return {
    id, type: "captureManualTransaction", userId: USER, deviceId: "phone-1",
    clientTs: "2026-09-30T15:00:00.000Z",
    payload: { transactionId: TX, accountId: ACCOUNT, amount: 25000, direction: "OUTFLOW", currencyCode: "COP", date: "2026-09-30", description: "Tostao", ...over },
  };
}

async function setup(withOutbox = true) {
  const d = await createSqlJsDriver();
  if (withOutbox) await d.query(OUTBOX_SCHEMA);
  await seedAccount(d, { id: ACCOUNT, userId: USER, balance: 100000 });
  return d;
}

const outbox = (d: SqlDriver) =>
  d.query<{ command_id: string; user_id: string; state: string; attempts: number }>(
    "SELECT command_id, user_id, state, attempts FROM outbox ORDER BY seq");

describe("applyAndEnqueue (phone outbox)", () => {
  it("queues an applied command as pending", async () => {
    const d = await setup();
    const r = await applyAndEnqueue(d, capture());
    expect(r.status).toBe("applied");
    expect(await outbox(d)).toEqual([
      { command_id: "44444444-4444-4444-8444-444444444444", user_id: USER, state: "pending", attempts: 0 },
    ]);
  });

  it("queues a duplicate too (the server must see it)", async () => {
    const d = await setup();
    await applyAndEnqueue(d, capture());
    const dup = await applyAndEnqueue(d, capture({}, "77777777-7777-4777-8777-777777777777"));
    expect(dup.status).toBe("duplicate");
    expect((await outbox(d)).map((r) => r.command_id)).toEqual([
      "44444444-4444-4444-8444-444444444444", "77777777-7777-4777-8777-777777777777",
    ]);
  });

  it("does not queue a rejected command", async () => {
    const d = await setup();
    const r = await applyAndEnqueue(d, capture({ amount: -5 }));
    expect(r.status).toBe("rejected");
    expect(await outbox(d)).toEqual([]);
  });

  it("does not queue a replay a second time", async () => {
    const d = await setup();
    await applyAndEnqueue(d, capture());
    const again = await applyAndEnqueue(d, capture());
    expect(again.replayed).toBe(true);
    expect(await outbox(d)).toHaveLength(1);
  });

  it("is atomic: if queueing fails, the command leaves no trace", async () => {
    const d = await setup(false); // no outbox table → the insert fails
    await expect(applyAndEnqueue(d, capture())).rejects.toThrow();
    const s = createSqlStorage(d);
    expect(await s.findCommand(USER, "44444444-4444-4444-8444-444444444444")).toBeNull();
    expect((await s.getAccount(USER, ACCOUNT))?.currentBalance).toBe(100000);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @zeta/shared exec vitest run src/engine/__tests__/outbox.test.ts`
Expected: FAIL — `Cannot find module '../outbox'`.

- [ ] **Step 3: Implement**

```ts
// packages/shared/src/engine/outbox.ts
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
```

`index.ts` — add:

```ts
export { OUTBOX_SCHEMA, applyAndEnqueue } from "./outbox";
```

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm --filter @zeta/shared exec vitest run src/engine`
Expected: PASS — 5 new outbox tests + all previous.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/engine
git commit -m "feat(engine): outbox + applyAndEnqueue (command and queue row in one transaction)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Phone database — key, driver, keyed file, migrations

**Files:**
- Modify: `mobile/app.json` (the `"expo-sqlite"` plugin entry)
- Create: `mobile/lib/v2/engine/secrets.ts`
- Create: `mobile/lib/v2/engine/sqlite-driver.ts`
- Create: `mobile/lib/v2/engine/database.ts`

**Interfaces:**
- Consumes: `SQLITE_ENGINE_SCHEMA`, `OUTBOX_SCHEMA`, `SqlDriver` from `@zeta/shared`.
- Produces: `toHex(bytes: Uint8Array): string`; `getDbKey(): Promise<string | null>`; `createDbKey(): Promise<string>`; `getDeviceId(): Promise<string>`; `createExpoSqliteDriver(db: SQLiteDatabase): SqlDriver`; `openKeyed(name: string, keyHex: string): Promise<SQLiteDatabase>`; `getV2Database(): Promise<{ db: SQLiteDatabase; driver: SqlDriver }>`; `resetV2Database(): Promise<void>`; `V2_DB_NAME = "zeta-v2.db"`.

No Node test runner exists in `mobile/`; these native pieces are verified by the on-device self-test (Task 4) and the simulator run (Task 6). This task's gate is the typecheck.

- [ ] **Step 1: Turn on SQLCipher** — in `mobile/app.json`, replace the plugin string `"expo-sqlite",` with:

```json
      ["expo-sqlite", { "useSQLCipher": true }],
```

- [ ] **Step 2: Write `secrets.ts`**

```ts
// mobile/lib/v2/engine/secrets.ts
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

// This device only, readable after the first unlock (background sync later).
const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};
const DB_KEY = "zeta.v2.dbKey";
const DEVICE_ID = "zeta.v2.deviceId";

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getDbKey(): Promise<string | null> {
  return SecureStore.getItemAsync(DB_KEY, OPTS);
}

export async function createDbKey(): Promise<string> {
  const key = toHex(await Crypto.getRandomBytesAsync(32));
  await SecureStore.setItemAsync(DB_KEY, key, OPTS);
  return key;
}

export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID, OPTS);
  if (existing) return existing;
  const id = Crypto.randomUUID().toLowerCase();
  await SecureStore.setItemAsync(DEVICE_ID, id, OPTS);
  return id;
}
```

- [ ] **Step 3: Write `sqlite-driver.ts`**

```ts
// mobile/lib/v2/engine/sqlite-driver.ts
import type { SQLiteBindValue, SQLiteDatabase } from "expo-sqlite";
import type { SqlDriver } from "@zeta/shared";

/**
 * SqlDriver over ONE expo-sqlite connection. Every call waits its turn on a
 * promise-chain mutex, so an engine command and a (future) sync write never
 * interleave inside a transaction. Transactions are BEGIN/COMMIT on this same
 * connection — withExclusiveTransactionAsync would open a second connection
 * without the SQLCipher key. Inside a transaction, use the `tx` driver the
 * callback receives; calling the outer driver there would wait on itself.
 */
export function createExpoSqliteDriver(db: SQLiteDatabase): SqlDriver {
  // ponytail: one lock for the whole database; the phone has one user and short transactions.
  let tail: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => undefined);
    return run;
  };

  const all = (sql: string, params: unknown[] = []) =>
    db.getAllAsync(sql, params as SQLiteBindValue[]) as Promise<never>;

  const inTx: SqlDriver = {
    dialect: "sqlite",
    query: (sql, params) => all(sql, params),
    transaction: (fn) => fn(inTx),
  };

  return {
    dialect: "sqlite",
    query: (sql, params) => exclusive(() => all(sql, params)),
    transaction: (fn) =>
      exclusive(async () => {
        await db.execAsync("BEGIN IMMEDIATE");
        try {
          const result = await fn(inTx);
          await db.execAsync("COMMIT");
          return result;
        } catch (e) {
          await db.execAsync("ROLLBACK").catch(() => undefined);
          throw e;
        }
      }),
  };
}
```

- [ ] **Step 4: Write `database.ts`**

```ts
// mobile/lib/v2/engine/database.ts
import * as SQLite from "expo-sqlite";
import { OUTBOX_SCHEMA, SQLITE_ENGINE_SCHEMA, type SqlDriver } from "@zeta/shared";
import { createExpoSqliteDriver } from "./sqlite-driver";
import { createDbKey, getDbKey } from "./secrets";

export const V2_DB_NAME = "zeta-v2.db";

/** Schema versions, in order; PRAGMA user_version = how many have run. */
const MIGRATIONS: string[] = [SQLITE_ENGINE_SCHEMA + OUTBOX_SCHEMA];

export interface V2Database {
  db: SQLite.SQLiteDatabase;
  driver: SqlDriver;
}

let opening: Promise<V2Database> | null = null;

/** Opens `name` with a raw 32-byte key, verifies the key, applies pragmas and migrations. */
export async function openKeyed(name: string, keyHex: string): Promise<SQLite.SQLiteDatabase> {
  if (!/^[0-9a-f]{64}$/.test(keyHex)) throw new Error("Clave de base de datos inválida");
  const db = await SQLite.openDatabaseAsync(name);
  try {
    await db.execAsync(`PRAGMA key = "x'${keyHex}'"`);
    // Throws "file is not a database" when the key doesn't match the file.
    await db.getFirstAsync("SELECT count(*) FROM sqlite_master");
    await db.execAsync("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
    await migrate(db);
    return db;
  } catch (e) {
    await db.closeAsync().catch(() => undefined);
    throw e;
  }
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  for (let v = row?.user_version ?? 0; v < MIGRATIONS.length; v++) {
    await db.execAsync("BEGIN IMMEDIATE");
    try {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
      await db.execAsync("COMMIT");
    } catch (e) {
      await db.execAsync("ROLLBACK").catch(() => undefined);
      throw e;
    }
  }
}

async function openV2Database(): Promise<V2Database> {
  const stored = await getDbKey();
  if (stored) {
    try {
      const db = await openKeyed(V2_DB_NAME, stored);
      return { db, driver: createExpoSqliteDriver(db) };
    } catch {
      // Wrong key or damaged file: rebuilt below.
    }
  }
  // ponytail: rebuilding is safe only while the outbox is never drained (M2 must drain or warn first).
  await SQLite.deleteDatabaseAsync(V2_DB_NAME).catch(() => undefined);
  const db = await openKeyed(V2_DB_NAME, await createDbKey());
  return { db, driver: createExpoSqliteDriver(db) };
}

/** Single-flight open of the v2 database (same pattern as lib/db/database.ts). */
export function getV2Database(): Promise<V2Database> {
  if (!opening) {
    opening = openV2Database().catch((e) => {
      opening = null;
      throw e;
    });
  }
  return opening;
}

/** Deletes the v2 database (debug screen). The next getV2Database() starts empty. */
export async function resetV2Database(): Promise<void> {
  const current = opening;
  opening = null;
  if (current) {
    const { db } = await current.catch(() => ({ db: null }));
    await db?.closeAsync().catch(() => undefined);
  }
  await SQLite.deleteDatabaseAsync(V2_DB_NAME).catch(() => undefined);
}
```

- [ ] **Step 5: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add mobile/app.json mobile/lib/v2
git commit -m "feat(mobile): v2 phone database — SQLCipher key, mutex driver, migrations

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Local runner + on-device self-test

**Files:**
- Create: `mobile/lib/v2/engine/run-local.ts`
- Create: `mobile/lib/v2/engine/self-test.ts`

**Interfaces:**
- Consumes: `applyAndEnqueue`, `createSqlStorage`, `CommandEnvelope`, `CommandResult`, `CommandType`, `HashFn` from `@zeta/shared`; `getV2Database`, `openKeyed` (Task 3); `getDeviceId`, `toHex` (Task 3); `createExpoSqliteDriver` (Task 3).
- Produces: `expoSha256: HashFn`; `runLocalCommand(input: { type: CommandType; userId: string; payload: unknown }): Promise<{ command: CommandEnvelope; result: CommandResult }>`; `replayLocalCommand(command: CommandEnvelope): Promise<CommandResult>`; `type SelfTestCheck = { name: string; ok: boolean; detail?: string }`; `runSelfTest(): Promise<SelfTestCheck[]>`.

- [ ] **Step 1: Write `run-local.ts`**

```ts
// mobile/lib/v2/engine/run-local.ts
import * as Crypto from "expo-crypto";
import {
  applyAndEnqueue,
  type CommandEnvelope,
  type CommandResult,
  type CommandType,
  type HashFn,
} from "@zeta/shared";
import { getV2Database } from "./database";
import { getDeviceId } from "./secrets";

/** Same lower-case hex SHA-256 as the server's WebCrypto default. */
export const expoSha256: HashFn = (payload) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);

/** Runs a user action on the phone and queues it; never touches the network. */
export async function runLocalCommand(input: {
  type: CommandType;
  userId: string;
  payload: unknown;
}): Promise<{ command: CommandEnvelope; result: CommandResult }> {
  const { driver } = await getV2Database();
  const command: CommandEnvelope = {
    id: Crypto.randomUUID().toLowerCase(),
    type: input.type,
    userId: input.userId,
    deviceId: await getDeviceId(),
    clientTs: new Date().toISOString(),
    payload: input.payload,
  };
  return { command, result: await applyAndEnqueue(driver, command, { hash: expoSha256 }) };
}

/** Sends an existing command again (debug: proves replays are no-ops). */
export async function replayLocalCommand(command: CommandEnvelope): Promise<CommandResult> {
  const { driver } = await getV2Database();
  return applyAndEnqueue(driver, command, { hash: expoSha256 });
}
```

- [ ] **Step 2: Write `self-test.ts`**

```ts
// mobile/lib/v2/engine/self-test.ts
import * as Crypto from "expo-crypto";
import * as SQLite from "expo-sqlite";
import { applyAndEnqueue, createSqlStorage, type CommandEnvelope } from "@zeta/shared";
import { openKeyed } from "./database";
import { expoSha256 } from "./run-local";
import { createExpoSqliteDriver } from "./sqlite-driver";
import { toHex } from "./secrets";

export type SelfTestCheck = { name: string; ok: boolean; detail?: string };

const FILE = "zeta-v2-selftest.db";
const USER = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const CENTS_ACCOUNT = "33333333-3333-4333-8333-333333333333";

const uuid = () => Crypto.randomUUID().toLowerCase();

function eq(actual: unknown, expected: unknown, what: string): void {
  if (actual !== expected) throw new Error(`${what}: esperado ${String(expected)}, obtenido ${String(actual)}`);
}

/**
 * Runs the engine's key contract scenarios on the real device database
 * (expo-sqlite + SQLCipher), on a throwaway keyed file that is deleted after.
 */
export async function runSelfTest(): Promise<SelfTestCheck[]> {
  const checks: SelfTestCheck[] = [];
  const check = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      checks.push({ name, ok: true });
    } catch (e) {
      checks.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  };

  await SQLite.deleteDatabaseAsync(FILE).catch(() => undefined);
  const db = await openKeyed(FILE, toHex(await Crypto.getRandomBytesAsync(32)));
  const driver = createExpoSqliteDriver(db);
  const s = createSqlStorage(driver);
  const run = (cmd: CommandEnvelope) => applyAndEnqueue(driver, cmd, { hash: expoSha256 });
  const balance = async (id = ACCOUNT) => (await s.getAccount(USER, id))?.currentBalance;
  const queued = async () =>
    Number((await driver.query<{ n: number }>("SELECT count(*) AS n FROM outbox"))[0].n);
  const capture = (transactionId: string, amount: number, id = uuid()): CommandEnvelope => ({
    id, type: "captureManualTransaction", userId: USER, deviceId: "autoprueba",
    clientTs: new Date().toISOString(),
    payload: { transactionId, accountId: ACCOUNT, amount, direction: "OUTFLOW", currencyCode: "COP", date: "2026-09-30", description: "Autoprueba" },
  });
  const note = (transactionId: string, id: string, clientTs: string, notes: string): CommandEnvelope => ({
    id, type: "setTransactionNote", userId: USER, deviceId: "autoprueba", clientTs, payload: { transactionId, notes },
  });

  try {
    await driver.query("INSERT INTO accounts (id, user_id, current_balance) VALUES (?, ?, ?), (?, ?, ?)", [
      ACCOUNT, USER, 100000, CENTS_ACCOUNT, USER, 0,
    ]);
    const tx = uuid();
    const first = capture(tx, 25000);

    await check("Un comando repetido se aplica una sola vez", async () => {
      await run(first);
      eq((await run(first)).replayed, true, "repetido");
      eq(await balance(), 75000, "saldo");
      eq(await queued(), 1, "en cola");
    });

    await check("El mismo movimiento con otro comando es duplicado", async () => {
      eq((await run(capture(tx, 30000))).status, "duplicate", "estado");
      eq(await balance(), 75000, "saldo");
    });

    await check("Gana la nota más reciente aunque llegue primero", async () => {
      await run(note(tx, uuid(), "2026-09-30T17:00:00.000Z", "nueva"));
      eq((await run(note(tx, uuid(), "2026-09-30T16:00:00.000Z", "vieja"))).status, "superseded", "estado");
      eq((await s.getTransaction(USER, tx))?.notes, "nueva", "nota");
    });

    await check("Misma hora: decide el id del comando", async () => {
      const ts = "2026-09-30T18:00:00.000Z";
      await run(note(tx, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", ts, "gana b"));
      await run(note(tx, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", ts, "pierde a"));
      eq((await s.getTransaction(USER, tx))?.notes, "gana b", "nota");
    });

    await check("El saldo queda en centavos (0,1 + 0,2 = 0,3)", async () => {
      await s.adjustAccountBalance(USER, CENTS_ACCOUNT, 0.1);
      await s.adjustAccountBalance(USER, CENTS_ACCOUNT, 0.2);
      eq(await balance(CENTS_ACCOUNT), 0.3, "saldo");
    });

    await check("Un error deshace todo el comando", async () => {
      await driver
        .transaction(async (t) => {
          await t.query("UPDATE accounts SET current_balance = 1 WHERE id = ?", [ACCOUNT]);
          throw new Error("falla a propósito");
        })
        .catch(() => undefined);
      eq(await balance(), 75000, "saldo");
    });

    await check("Un comando rechazado no entra a la cola", async () => {
      const before = await queued();
      eq((await run(capture(uuid(), -5))).status, "rejected", "estado");
      eq(await queued(), before, "en cola");
    });

    await check("Dos comandos a la vez no se mezclan", async () => {
      const before = await balance();
      await Promise.all([run(capture(uuid(), 1000)), run(capture(uuid(), 2000))]);
      eq(await balance(), (before ?? 0) - 3000, "saldo");
    });

    await check("El archivo no se puede leer sin la clave", async () => {
      const raw = await SQLite.openDatabaseAsync(FILE, { useNewConnection: true });
      let readable = false;
      try {
        await raw.getFirstAsync("SELECT count(*) FROM sqlite_master");
        readable = true;
      } catch {
        // expected: "file is not a database"
      } finally {
        await raw.closeAsync().catch(() => undefined);
      }
      eq(readable, false, "legible sin clave");
    });
  } finally {
    await db.closeAsync().catch(() => undefined);
    await SQLite.deleteDatabaseAsync(FILE).catch(() => undefined);
  }
  return checks;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/v2
git commit -m "feat(mobile): runLocalCommand + on-device engine self-test

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Debug screen

**Files:**
- Create: `mobile/lib/v2/flags.ts`
- Create: `mobile/app/v2-debug.tsx`
- Modify: `mobile/app/settings.tsx` (next to the "Reportar bug" `NavRow`, ~line 937)

**Interfaces:**
- Consumes: `runLocalCommand`, `replayLocalCommand` (Task 4); `runSelfTest`, `SelfTestCheck` (Task 4); `getV2Database`, `resetV2Database` (Task 3); `createSqlStorage`, `CommandEnvelope`, `CommandResult` from `@zeta/shared`; `useAuth()` → `{ userId }` from `mobile/lib/auth.tsx`; `MobileHeader` from `mobile/components/ui/MobileHeader`; `MOBILE_TAB_BAR_CLEARANCE`, `BRASS_BUTTON_CLASS`, `GHOST_BUTTON_CLASS` from `mobile/lib/constants/styles`.
- Produces: `V2_DEBUG_ENABLED: boolean`; route `/v2-debug`.

- [ ] **Step 1: Write `flags.ts`**

```ts
// mobile/lib/v2/flags.ts
/** v2 work in progress: visible in dev builds, or in any build made with EXPO_PUBLIC_ZETA_V2=1. */
export const V2_DEBUG_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_ZETA_V2 === "1";
```

- [ ] **Step 2: Write the screen**

```tsx
// mobile/app/v2-debug.tsx
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Redirect } from "expo-router";
import * as Crypto from "expo-crypto";
import { applyAndEnqueue, createSqlStorage, type CommandEnvelope, type CommandResult } from "@zeta/shared";
import { MobileHeader } from "../components/ui/MobileHeader";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS, MOBILE_TAB_BAR_CLEARANCE } from "../lib/constants/styles";
import { useAuth } from "../lib/auth";
import { V2_DEBUG_ENABLED } from "../lib/v2/flags";
import { getV2Database, resetV2Database } from "../lib/v2/engine/database";
import { expoSha256, replayLocalCommand, runLocalCommand } from "../lib/v2/engine/run-local";
import { runSelfTest, type SelfTestCheck } from "../lib/v2/engine/self-test";

const TEST_ACCOUNT = "0000aaaa-0000-4000-8000-00000000c0de";
const LOCAL_USER = "00000000-0000-4000-8000-000000000001";

type Snapshot = { balance: number | null; note: string | null; pending: number };

function Action({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-xl px-4 py-3 ${primary ? BRASS_BUTTON_CLASS : GHOST_BUTTON_CLASS}`}
    >
      <Text className="text-center font-inter-semibold">{label}</Text>
    </Pressable>
  );
}

export default function V2DebugScreen() {
  const { userId: authUserId } = useAuth();
  const userId = authUserId ?? LOCAL_USER;
  const [snapshot, setSnapshot] = useState<Snapshot>({ balance: null, note: null, pending: 0 });
  const [lastCommand, setLastCommand] = useState<CommandEnvelope | null>(null);
  const [lastTxId, setLastTxId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);
  const [checks, setChecks] = useState<SelfTestCheck[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { driver } = await getV2Database();
    const s = createSqlStorage(driver);
    const account = await s.getAccount(userId, TEST_ACCOUNT);
    const tx = lastTxId ? await s.getTransaction(userId, lastTxId) : null;
    const [{ n }] = await driver.query<{ n: number }>("SELECT count(*) AS n FROM outbox WHERE state = 'pending'");
    setSnapshot({ balance: account?.currentBalance ?? null, note: tx?.notes ?? null, pending: Number(n) });
  }, [userId, lastTxId]);

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, [refresh]);

  const act = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!V2_DEBUG_ENABLED) return <Redirect href="/" />;

  const createAccount = act(async () => {
    const { driver } = await getV2Database();
    await driver.query("INSERT OR IGNORE INTO accounts (id, user_id, current_balance) VALUES (?, ?, ?)", [
      TEST_ACCOUNT, userId, 100000,
    ]);
  });

  const capture = act(async () => {
    const transactionId = Crypto.randomUUID().toLowerCase();
    const { command, result } = await runLocalCommand({
      type: "captureManualTransaction",
      userId,
      payload: {
        transactionId, accountId: TEST_ACCOUNT, amount: 25000, direction: "OUTFLOW",
        currencyCode: "COP", date: new Date().toISOString().slice(0, 10), description: "Prueba motor v2",
      },
    });
    setLastCommand(command);
    setLastTxId(transactionId);
    setLastResult(result);
  });

  const replay = act(async () => {
    if (!lastCommand) throw new Error("Primero anota un gasto");
    setLastResult(await replayLocalCommand(lastCommand));
  });

  const notesOutOfOrder = act(async () => {
    if (!lastTxId) throw new Error("Primero anota un gasto");
    const now = Date.now();
    await runLocalCommand({ type: "setTransactionNote", userId, payload: { transactionId: lastTxId, notes: "Nota nueva" } });
    // An edit made a minute earlier on another device arrives late: it must lose.
    const { driver } = await getV2Database();
    const late: CommandEnvelope = {
      id: Crypto.randomUUID().toLowerCase(), type: "setTransactionNote", userId, deviceId: "otro-dispositivo",
      clientTs: new Date(now - 60_000).toISOString(), payload: { transactionId: lastTxId, notes: "Nota vieja" },
    };
    setLastResult(await applyAndEnqueue(driver, late, { hash: expoSha256 }));
  });

  const reset = act(async () => {
    await resetV2Database();
    setLastCommand(null);
    setLastTxId(null);
    setLastResult(null);
  });

  const selfTest = act(async () => {
    setChecks(await runSelfTest());
  });

  const format = (n: number | null) =>
    n == null ? "—" : n.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return (
    <View className="flex-1 bg-background">
      <MobileHeader variant="sub" title="Motor v2 (debug)" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: MOBILE_TAB_BAR_CLEARANCE }}>
        <View className="rounded-2xl bg-z-surface-2 p-4 gap-1">
          <Text className="font-inter text-muted-foreground">Saldo de la cuenta de prueba</Text>
          <Text className="font-inter-semibold text-2xl text-foreground">{format(snapshot.balance)}</Text>
          <Text className="font-inter text-foreground">Nota del último gasto: {snapshot.note ?? "—"}</Text>
          <Text className="font-inter text-foreground">Comandos en cola: {snapshot.pending}</Text>
          {lastResult && (
            <Text className="font-inter text-xs text-muted-foreground">Último resultado: {JSON.stringify(lastResult)}</Text>
          )}
          {error && <Text className="font-inter text-xs text-z-expense">{error}</Text>}
        </View>

        <Action label="Crear cuenta de prueba (100.000)" onPress={createAccount} />
        <Action label="Anotar gasto de 25.000" onPress={capture} primary />
        <Action label="Repetir el último comando" onPress={replay} />
        <Action label="Nota nueva y luego una vieja" onPress={notesOutOfOrder} />
        <Action label="Autoprueba" onPress={selfTest} primary />
        <Action label="Borrar base v2" onPress={reset} />

        {busy && <ActivityIndicator />}

        {checks && (
          <View className="rounded-2xl bg-z-surface-2 p-4 gap-2">
            <Text className="font-inter-semibold text-foreground">
              Autoprueba: {checks.filter((c) => c.ok).length} de {checks.length} bien
            </Text>
            {checks.map((c) => (
              <View key={c.name}>
                <Text className={`font-inter ${c.ok ? "text-foreground" : "text-z-expense"}`}>
                  {c.ok ? "Bien" : "Falla"} · {c.name}
                </Text>
                {c.detail && <Text className="font-inter text-xs text-muted-foreground">{c.detail}</Text>}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
```

Class names are the ones this app already uses (checked: `bg-background`, `bg-z-surface-2`, `text-foreground`, `text-muted-foreground`, `text-z-expense`, `font-inter`, `font-inter-semibold`).

- [ ] **Step 3: Link it from Ajustes** — in `mobile/app/settings.tsx`, add the import near the other `../lib` imports:

```ts
import { V2_DEBUG_ENABLED } from "../lib/v2/flags";
```

and right after the "Reportar bug" `NavRow`:

```tsx
            {V2_DEBUG_ENABLED && (
              <NavRow
                title="Motor v2 (debug)"
                meta="Pruebas del motor sin conexión"
                onPress={() => router.push("/v2-debug" as never)}
              />
            )}
```

- [ ] **Step 4: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/v2/flags.ts mobile/app/v2-debug.tsx mobile/app/settings.tsx
git commit -m "feat(mobile): /v2-debug screen for the phone engine (dev builds or EXPO_PUBLIC_ZETA_V2=1)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Simulator run, gates, reviews, PR

**Files:** none new (fixes from this task go in the files they touch).

- [ ] **Step 1: Native build with SQLCipher on the iOS simulator**

Run: `cd mobile && npx expo run:ios` (builds a dev client with SQLCipher compiled in; long).
Expected: the app launches on the simulator.

- [ ] **Step 2: v1 still works** — sign in (or open the demo), open Inicio and Movimientos.
Expected: existing data shows, no database errors in Metro logs (the un-keyed `zeta.db` opens under SQLCipher).

- [ ] **Step 3: Run the debug flow** — Ajustes → *Motor v2 (debug)*:
  1. *Crear cuenta de prueba* → saldo 100.000.
  2. *Anotar gasto de 25.000* → saldo 75.000, en cola 1.
  3. *Repetir el último comando* → saldo 75.000, en cola 1, resultado `replayed: true`.
  4. *Nota nueva y luego una vieja* → nota "Nota nueva", resultado `superseded`.
  5. *Autoprueba* → "9 de 9 bien".
  6. Kill and reopen the app → the same saldo, nota and cola (the key is read back from the Keychain).
  7. *Borrar base v2* → saldo "—", cola 0.
Take a screenshot of step 5. Any failing line → debug with superpowers:systematic-debugging, fix, re-run from step 1 of this list.

- [ ] **Step 4: Gates**

```bash
pnpm install
pnpm --filter @zeta/shared test
pnpm build:web
(cd mobile && npx tsc --noEmit)
pnpm audit --audit-level high
```
Expected: lockfile unchanged or committed; shared tests pass; build passes; tsc exit 0; audit reports 0 high (2 ignored image-size advisories are expected).

- [ ] **Step 5: Reviews** — dispatch `mobile-sync-doctor` (driver mutex, transactions, key lifecycle, rebuild path, outbox rules; round-trip budget) and `zetas-front-guy` (debug screen: tokens, safe area, Spanish copy). Apply required fixes; re-run Step 4.

- [ ] **Step 6: Dry-merge, push, PR**

```bash
git fetch origin main && git merge --no-commit --no-ff origin/main; git merge --abort
git push -u origin feat/v2-phone-engine
gh pr create --base main --title "feat(mobile): v2 engine on the phone (SQLCipher, outbox, debug screen)" --body "<summary: what's in, simulator results with the Autoprueba screenshot, gates, reviews; note that a new native build (dev client / EAS) is needed because SQLCipher is compiled in; owner acceptance = Autoprueba 9/9 on the owner's phone and v1 data intact>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
Expected: PR URL printed.

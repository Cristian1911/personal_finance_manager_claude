# v2 Engine Walking Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that one command can run with identical results on the phone's database (SQLite) and the server's database (Postgres), that a replayed command is applied once, and that user-edited fields resolve "latest edit wins" — before any screen depends on it.

**Architecture:** Commands and a `StoragePort` live in `@zeta/shared/engine`. One SQL storage implementation (`createSqlStorage`) runs on any `SqlDriver`; the only dialect differences are placeholders (`?` vs `$n`), JSON/bytea handling and payload encryption. A contract suite runs every command against two drivers (SQLite via sql.js, Postgres via PGlite) with an equivalent test schema. A server-side `pg` driver runs the same storage as the signed-in user (RLS + encrypted views) and is proven by an integration test against the `zeta-dev` Supabase project.

**Tech Stack:** TypeScript 5.9, Vitest 4, `sql.js` (SQLite in WASM, tests only), `@electric-sql/pglite` (Postgres in WASM, tests only), `pg` (node-postgres, server), Supabase Postgres 17 (zeta-dev).

**Spec:** `docs/mlp/10-build-plan.md` §3.2, §12 · decisions S1-1, S1-2, S2-2, S7-1 in `docs/mlp/12-decision-log.md`.

## Global Constraints

- Every write is a command; the phone never writes raw rows (spec §3.2).
- Same code on phone and server: command handlers and storage SQL live only in `packages/shared/src/engine/`.
- Conflicts: bank facts → higher capture tier; user choices → latest `client_ts` per field (`field_versions`); weak duplicates → Revisar (S1-2). This PR implements only the user-choice rule (notes).
- Command ids are created on the device; row ids too. A replayed command id is a no-op that returns the original result.
- Command payloads are stored encrypted with the user's key on the server (`zeta_encrypt`); kept 90 days, id forever (S2-2 — the 90-day purge is NOT in this PR).
- Schema: additive only; new tables get explicit RLS + grants; migrations go to **zeta-dev only** in this PR (`npx supabase db push --db-url "$SUPABASE_DEV_DB_URL"`), never production.
- Never print secrets. Load dev credentials with `set -a; source .env.v2-dev; set +a` (repo root, git-ignored).
- zsh: pass lists to CLIs via `xargs`, never unquoted variables.
- User-facing strings (validation errors) in Spanish.
- Build gates before the PR: `pnpm install` (lockfile from repo root), `pnpm --filter @zeta/shared test`, `pnpm build` (repo root), `cd mobile && npx tsc --noEmit`, `pnpm audit --audit-level high`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## File Structure

| File | Responsibility |
|---|---|
| `packages/shared/src/engine/types.ts` | Command envelope, results, `StoragePort`, `SqlDriver`, row types |
| `packages/shared/src/engine/sql.ts` | `toDialect()` placeholder conversion + value normalizers |
| `packages/shared/src/engine/sql-storage.ts` | `createSqlStorage(driver): StoragePort` — the one SQL implementation |
| `packages/shared/src/engine/commands/capture-manual-transaction.ts` | Validation + handler for `captureManualTransaction` |
| `packages/shared/src/engine/commands/set-transaction-note.ts` | Validation + handler for `setTransactionNote` (latest-wins) |
| `packages/shared/src/engine/runner.ts` | `applyCommand()` — transaction, replay check, dispatch, record |
| `packages/shared/src/engine/index.ts` | Public exports of the engine |
| `packages/shared/src/index.ts` | Re-export `./engine` |
| `packages/shared/src/engine/__tests__/support/schema.ts` | Equivalent test schemas (SQLite + Postgres) |
| `packages/shared/src/engine/__tests__/support/drivers.ts` | Test drivers (sql.js, PGlite) + `DRIVERS` list + seed helper |
| `packages/shared/src/engine/__tests__/*.test.ts` | Contract tests, each run on both drivers |
| `supabase/migrations/20260930120000_v2_engine_commands.sql` | Real `commands` + `field_versions` tables with RLS |
| `webapp/src/lib/engine/pg-driver.ts` | `createUserScopedPgDriver(pool, userId)` — Postgres as the signed-in user |
| `webapp/src/lib/engine/__tests__/pg-integration.test.ts` | Engine against zeta-dev's real encrypted views (skipped without env) |

---

### Task 0: Branch

- [ ] **Step 1: Create the feature branch**

If `docs/zeta-v2-build-plan` has been merged to `main`:
```bash
git checkout main && git pull && git checkout -b feat/v2-engine-skeleton
```
Otherwise stack it on the docs branch:
```bash
git checkout docs/zeta-v2-build-plan && git pull && git checkout -b feat/v2-engine-skeleton
```
Expected: `git branch --show-current` prints `feat/v2-engine-skeleton`.

---

### Task 1: Engine types, SQL helpers and the two-driver test harness

**Files:**
- Create: `packages/shared/src/engine/types.ts`
- Create: `packages/shared/src/engine/sql.ts`
- Create: `packages/shared/src/engine/__tests__/support/schema.ts`
- Create: `packages/shared/src/engine/__tests__/support/drivers.ts`
- Create: `packages/shared/src/engine/__tests__/harness.test.ts`
- Modify: `packages/shared/package.json` (devDependencies)

**Interfaces:**
- Produces: `CommandEnvelope`, `CommandResult`, `CommandStatus`, `StoragePort`, `SqlDriver`, `Dialect`, `AccountRow`, `TransactionInsert`, `TransactionRow`, `FieldVersionWrite` (types.ts); `toDialect(sql, dialect)`, `toNumber(v)`, `toIso(v)`, `toJson(v)` (sql.ts); `SQLITE_SCHEMA`, `POSTGRES_SCHEMA` (schema.ts); `DRIVERS`, `seedAccount(driver, row)` (drivers.ts).

- [ ] **Step 1: Add test-only dependencies**

```bash
pnpm --filter @zeta/shared add -D sql.js @electric-sql/pglite @types/sql.js
```
Expected: `packages/shared/package.json` devDependencies list `sql.js`, `@electric-sql/pglite`, `@types/sql.js`; root `pnpm-lock.yaml` updated.

- [ ] **Step 2: Write `types.ts`**

```ts
// packages/shared/src/engine/types.ts

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

export interface CommandResult {
  status: CommandStatus;
  /** True when this command id had already been applied before. */
  replayed: boolean;
  data?: Record<string, unknown>;
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

export interface FieldVersionWrite {
  userId: string;
  entity: string;
  entityId: string;
  field: string;
  clientTs: string;
  commandId: string;
}

/** Everything a command may read or write. One SQL implementation serves both databases. */
export interface StoragePort {
  withTransaction<T>(fn: (s: StoragePort) => Promise<T>): Promise<T>;
  findCommand(id: string): Promise<{ id: string; result: CommandResult } | null>;
  recordCommand(cmd: CommandEnvelope, result: CommandResult): Promise<void>;
  getAccount(id: string): Promise<AccountRow | null>;
  adjustAccountBalance(id: string, delta: number): Promise<void>;
  findTransactionByIdempotencyKey(key: string): Promise<{ id: string } | null>;
  insertTransaction(row: TransactionInsert): Promise<void>;
  getTransaction(id: string): Promise<TransactionRow | null>;
  updateTransactionNotes(id: string, notes: string | null): Promise<void>;
  getFieldVersion(entity: string, entityId: string, field: string): Promise<string | null>;
  setFieldVersion(v: FieldVersionWrite): Promise<void>;
}
```

- [ ] **Step 3: Write `sql.ts`**

```ts
// packages/shared/src/engine/sql.ts
import type { Dialect } from "./types";

/** SQL is written with `?`; Postgres needs `$1, $2, …`. */
export function toDialect(sql: string, dialect: Dialect): string {
  if (dialect === "sqlite") return sql;
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/** Postgres returns numeric as string; SQLite returns number. */
export function toNumber(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}

/** Postgres returns timestamptz as Date; SQLite stores ISO text. */
export function toIso(v: unknown): string {
  return v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();
}

/** Postgres returns jsonb parsed; SQLite stores JSON text. */
export function toJson<T>(v: unknown): T {
  return (typeof v === "string" ? JSON.parse(v) : v) as T;
}
```

- [ ] **Step 4: Write the equivalent test schemas**

```ts
// packages/shared/src/engine/__tests__/support/schema.ts
// Same logical tables in both dialects; names and columns match the real
// Supabase views (`accounts`, `transactions`) and new tables (`commands`,
// `field_versions`) so one SQL implementation serves both.

export const SQLITE_SCHEMA = `
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
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, device_id TEXT NOT NULL,
  type TEXT NOT NULL, client_ts TEXT NOT NULL, payload TEXT,
  status TEXT NOT NULL, result TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE field_versions (
  user_id TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL,
  field TEXT NOT NULL, client_ts TEXT NOT NULL, command_id TEXT NOT NULL,
  PRIMARY KEY (entity, entity_id, field)
);
`;

export const POSTGRES_SCHEMA = `
CREATE FUNCTION zeta_encrypt(plaintext text) RETURNS bytea
  LANGUAGE sql AS $$ SELECT convert_to(plaintext, 'UTF8') $$;
CREATE TABLE accounts (
  id uuid PRIMARY KEY, user_id uuid NOT NULL,
  current_balance numeric(15,2) NOT NULL DEFAULT 0
);
CREATE TABLE transactions (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, account_id uuid NOT NULL,
  amount numeric(15,2) NOT NULL, currency_code text NOT NULL, direction text NOT NULL,
  transaction_date date NOT NULL, clean_description text, notes text,
  capture_method text NOT NULL, idempotency_key text NOT NULL UNIQUE
);
CREATE TABLE commands (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, device_id text NOT NULL,
  type text NOT NULL, client_ts timestamptz NOT NULL, payload_enc bytea,
  status text NOT NULL, result jsonb NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE field_versions (
  user_id uuid NOT NULL, entity text NOT NULL, entity_id uuid NOT NULL,
  field text NOT NULL, client_ts timestamptz NOT NULL, command_id uuid NOT NULL,
  PRIMARY KEY (entity, entity_id, field)
);
`;
```

- [ ] **Step 5: Write the test drivers**

```ts
// packages/shared/src/engine/__tests__/support/drivers.ts
import initSqlJs from "sql.js";
import { PGlite } from "@electric-sql/pglite";
import type { SqlDriver } from "../../types";
import { toDialect } from "../../sql";
import { POSTGRES_SCHEMA, SQLITE_SCHEMA } from "./schema";

export async function createSqlJsDriver(): Promise<SqlDriver> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.exec(SQLITE_SCHEMA);
  let depth = 0;
  const driver: SqlDriver = {
    dialect: "sqlite",
    async query(sql, params = []) {
      const stmt = db.prepare(sql);
      stmt.bind(params as (string | number | null)[]);
      const rows: Record<string, unknown>[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows as never;
    },
    async transaction(fn) {
      if (depth > 0) return fn(driver);
      depth++;
      db.exec("BEGIN");
      try {
        const r = await fn(driver);
        db.exec("COMMIT");
        return r;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      } finally {
        depth--;
      }
    },
  };
  return driver;
}

export async function createPgliteDriver(): Promise<SqlDriver> {
  const db = new PGlite();
  await db.exec(POSTGRES_SCHEMA);
  type Q = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
  const wrap = (q: Q, inTx: boolean): SqlDriver => {
    const d: SqlDriver = {
      dialect: "postgres",
      async query(sql, params = []) {
        return (await q.query(sql, params)).rows as never;
      },
      async transaction(fn) {
        if (inTx) return fn(d);
        return db.transaction((tx) => fn(wrap(tx as unknown as Q, true)));
      },
    };
    return d;
  };
  return wrap(db as unknown as Q, false);
}

/** Both drivers; every contract test runs once per entry. */
export const DRIVERS: [string, () => Promise<SqlDriver>][] = [
  ["sqlite", createSqlJsDriver],
  ["postgres", createPgliteDriver],
];

export async function seedAccount(
  driver: SqlDriver,
  row: { id: string; userId: string; balance: number },
): Promise<void> {
  await driver.query(
    toDialect("INSERT INTO accounts (id, user_id, current_balance) VALUES (?, ?, ?)", driver.dialect),
    [row.id, row.userId, row.balance],
  );
}
```

- [ ] **Step 6: Write the harness test (proves both drivers run the same SQL)**

```ts
// packages/shared/src/engine/__tests__/harness.test.ts
import { describe, expect, it } from "vitest";
import { toDialect } from "../sql";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";

describe.each(DRIVERS)("test harness on %s", (_name, make) => {
  it("stores and reads an account through the same SQL", async () => {
    const d = await make();
    await seedAccount(d, { id: ACCOUNT, userId: USER, balance: 1000.5 });
    const rows = await d.query<{ id: string; current_balance: unknown }>(
      toDialect("SELECT id, current_balance FROM accounts WHERE id = ?", d.dialect),
      [ACCOUNT],
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].current_balance)).toBe(1000.5);
  });

  it("rolls back a failed transaction", async () => {
    const d = await make();
    await expect(
      d.transaction(async (tx) => {
        await seedAccount(tx, { id: ACCOUNT, userId: USER, balance: 1 });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const rows = await d.query(toDialect("SELECT id FROM accounts", d.dialect));
    expect(rows).toHaveLength(0);
  });
});

describe("toDialect", () => {
  it("numbers placeholders for postgres and keeps casts", () => {
    expect(toDialect("SELECT ? , ?::jsonb", "postgres")).toBe("SELECT $1 , $2::jsonb");
    expect(toDialect("SELECT ?", "sqlite")).toBe("SELECT ?");
  });
});
```

- [ ] **Step 7: Run it**

Run: `pnpm --filter @zeta/shared exec vitest run src/engine`
Expected: PASS — 5 tests (2 per driver + 1).

- [ ] **Step 8: Commit**

```bash
git add packages/shared/package.json pnpm-lock.yaml packages/shared/src/engine
git commit -m "feat(engine): types, SQL helpers and two-driver test harness (SQLite + Postgres)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `commands` and `field_versions` on zeta-dev

**Files:**
- Create: `supabase/migrations/20260930120000_v2_engine_commands.sql`

**Interfaces:**
- Produces: tables `public.commands (id, user_id, device_id, type, client_ts, payload_enc, status, result, applied_at)` and `public.field_versions (user_id, entity, entity_id, field, client_ts, command_id)` — same columns as `POSTGRES_SCHEMA` in Task 1.

- [ ] **Step 1: Write the migration**

```sql
-- v2 engine: command log (S1-1, S2-2) and per-field edit versions (S1-2).
-- Additive only. Payloads are encrypted with the user's key (zeta_encrypt);
-- the 90-day payload purge (S2-2) ships in a later migration.

CREATE TABLE public.commands (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id   text NOT NULL,
  type        text NOT NULL,
  client_ts   timestamptz NOT NULL,
  payload_enc bytea,
  status      text NOT NULL CHECK (status IN ('applied', 'duplicate', 'superseded', 'rejected')),
  result      jsonb NOT NULL,
  applied_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX commands_user_applied_idx ON public.commands (user_id, applied_at DESC);
ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY commands_select_own ON public.commands
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY commands_insert_own ON public.commands
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
REVOKE ALL ON public.commands FROM anon;
GRANT SELECT, INSERT ON public.commands TO authenticated;

CREATE TABLE public.field_versions (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity     text NOT NULL,
  entity_id  uuid NOT NULL,
  field      text NOT NULL,
  client_ts  timestamptz NOT NULL,
  command_id uuid NOT NULL,
  PRIMARY KEY (entity, entity_id, field)
);
CREATE INDEX field_versions_user_idx ON public.field_versions (user_id);
ALTER TABLE public.field_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY field_versions_select_own ON public.field_versions
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY field_versions_insert_own ON public.field_versions
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY field_versions_update_own ON public.field_versions
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
REVOKE ALL ON public.field_versions FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.field_versions TO authenticated;
```

- [ ] **Step 2: Review with the `supabase-migrator` agent**

Dispatch `supabase-migrator` with the file path and: "Review for RLS fast-path pattern, grants, FK cascade, and additive-only. These are new, non-encrypted tables; payload is encrypted by the caller with zeta_encrypt." Apply its fixes before continuing.

- [ ] **Step 3: Apply to zeta-dev only**

```bash
set -a; source .env.v2-dev; set +a
npx supabase db push --db-url "$SUPABASE_DEV_DB_URL" --yes
npx supabase migration list --db-url "$SUPABASE_DEV_DB_URL" | tail -5
```
Expected: push applies exactly `20260930120000_v2_engine_commands.sql`; the list shows it in both Local and Remote columns. **Do not** run against `SUPABASE_PROD_DB_URL`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260930120000_v2_engine_commands.sql
git commit -m "feat(db): v2 engine commands + field_versions tables (applied to zeta-dev)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The SQL storage (`createSqlStorage`)

**Files:**
- Create: `packages/shared/src/engine/sql-storage.ts`
- Create: `packages/shared/src/engine/__tests__/sql-storage.test.ts`

**Interfaces:**
- Consumes: `SqlDriver`, `StoragePort`, row types (Task 1); `toDialect`, `toNumber`, `toIso`, `toJson`.
- Produces: `createSqlStorage(driver: SqlDriver): StoragePort`.

- [ ] **Step 1: Write the failing contract tests**

```ts
// packages/shared/src/engine/__tests__/sql-storage.test.ts
import { describe, expect, it } from "vitest";
import { createSqlStorage } from "../sql-storage";
import type { CommandEnvelope } from "../types";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const TX = "33333333-3333-4333-8333-333333333333";
const CMD = "44444444-4444-4444-8444-444444444444";

describe.each(DRIVERS)("createSqlStorage on %s", (_name, make) => {
  it("reads an account and adjusts its balance", async () => {
    const d = await make();
    await seedAccount(d, { id: ACCOUNT, userId: USER, balance: 100000 });
    const s = createSqlStorage(d);
    await s.adjustAccountBalance(ACCOUNT, -25000.5);
    expect(await s.getAccount(ACCOUNT)).toEqual({ id: ACCOUNT, userId: USER, currentBalance: 74999.5 });
    expect(await s.getAccount("99999999-9999-4999-8999-999999999999")).toBeNull();
  });

  it("inserts, finds and updates a transaction", async () => {
    const d = await make();
    const s = createSqlStorage(d);
    await s.insertTransaction({
      id: TX, userId: USER, accountId: ACCOUNT, amount: 25000, currencyCode: "COP",
      direction: "OUTFLOW", transactionDate: "2026-09-18", cleanDescription: "Tostao",
      notes: null, captureMethod: "MANUAL_FORM", idempotencyKey: "k1",
    });
    expect(await s.findTransactionByIdempotencyKey("k1")).toEqual({ id: TX });
    expect(await s.findTransactionByIdempotencyKey("nope")).toBeNull();
    await s.updateTransactionNotes(TX, "con Ana");
    expect(await s.getTransaction(TX)).toEqual({
      id: TX, userId: USER, accountId: ACCOUNT, amount: 25000, direction: "OUTFLOW",
      cleanDescription: "Tostao", notes: "con Ana", idempotencyKey: "k1",
    });
  });

  it("records a command and finds it again with its result", async () => {
    const d = await make();
    const s = createSqlStorage(d);
    const cmd: CommandEnvelope = {
      id: CMD, type: "captureManualTransaction", userId: USER, deviceId: "phone-1",
      clientTs: "2026-09-18T15:00:00.000Z", payload: { a: 1 },
    };
    await s.recordCommand(cmd, { status: "applied", replayed: false, data: { transactionId: TX } });
    expect(await s.findCommand(CMD)).toEqual({
      id: CMD, result: { status: "applied", replayed: false, data: { transactionId: TX } },
    });
    expect(await s.findCommand("55555555-5555-4555-8555-555555555555")).toBeNull();
  });

  it("upserts and reads field versions as ISO timestamps", async () => {
    const d = await make();
    const s = createSqlStorage(d);
    expect(await s.getFieldVersion("transaction", TX, "notes")).toBeNull();
    const base = { userId: USER, entity: "transaction", entityId: TX, field: "notes", commandId: CMD };
    await s.setFieldVersion({ ...base, clientTs: "2026-09-18T15:00:00.000Z" });
    await s.setFieldVersion({ ...base, clientTs: "2026-09-18T16:00:00.000Z" });
    expect(await s.getFieldVersion("transaction", TX, "notes")).toBe("2026-09-18T16:00:00.000Z");
  });

  it("withTransaction rolls back everything on error", async () => {
    const d = await make();
    await seedAccount(d, { id: ACCOUNT, userId: USER, balance: 100 });
    const s = createSqlStorage(d);
    await expect(
      s.withTransaction(async (t) => {
        await t.adjustAccountBalance(ACCOUNT, -50);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect((await s.getAccount(ACCOUNT))?.currentBalance).toBe(100);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @zeta/shared exec vitest run src/engine/__tests__/sql-storage.test.ts`
Expected: FAIL — `Cannot find module '../sql-storage'`.

- [ ] **Step 3: Implement `sql-storage.ts`**

```ts
// packages/shared/src/engine/sql-storage.ts
import { toDialect, toIso, toJson, toNumber } from "./sql";
import type { CommandResult, SqlDriver, StoragePort } from "./types";

/**
 * The single SQL implementation of StoragePort. Table and column names match
 * the real Supabase views (`accounts`, `transactions`) and the phone's v2
 * SQLite tables, so the same statements run on both.
 */
export function createSqlStorage(driver: SqlDriver): StoragePort {
  const q = <R = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    driver.query<R>(toDialect(sql, driver.dialect), params);
  const pg = driver.dialect === "postgres";

  const storage: StoragePort = {
    withTransaction: (fn) => driver.transaction((tx) => fn(createSqlStorage(tx))),

    async findCommand(id) {
      const rows = await q<{ id: string; result: unknown }>(
        "SELECT id, result FROM commands WHERE id = ?", [id]);
      return rows[0] ? { id: String(rows[0].id), result: toJson<CommandResult>(rows[0].result) } : null;
    },

    async recordCommand(cmd, result) {
      const payload = JSON.stringify(cmd.payload);
      await q(
        pg
          ? "INSERT INTO commands (id, user_id, device_id, type, client_ts, payload_enc, status, result) VALUES (?, ?, ?, ?, ?, zeta_encrypt(?), ?, ?::jsonb)"
          : "INSERT INTO commands (id, user_id, device_id, type, client_ts, payload, status, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [cmd.id, cmd.userId, cmd.deviceId, cmd.type, cmd.clientTs, payload, result.status, JSON.stringify(result)],
      );
    },

    async getAccount(id) {
      const rows = await q<{ id: string; user_id: string; current_balance: unknown }>(
        "SELECT id, user_id, current_balance FROM accounts WHERE id = ?", [id]);
      const r = rows[0];
      return r ? { id: String(r.id), userId: String(r.user_id), currentBalance: toNumber(r.current_balance) } : null;
    },

    async adjustAccountBalance(id, delta) {
      await q("UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?", [delta, id]);
    },

    async findTransactionByIdempotencyKey(key) {
      const rows = await q<{ id: string }>("SELECT id FROM transactions WHERE idempotency_key = ?", [key]);
      return rows[0] ? { id: String(rows[0].id) } : null;
    },

    async insertTransaction(t) {
      await q(
        "INSERT INTO transactions (id, user_id, account_id, amount, currency_code, direction, transaction_date, clean_description, notes, capture_method, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [t.id, t.userId, t.accountId, t.amount, t.currencyCode, t.direction, t.transactionDate,
          t.cleanDescription, t.notes, t.captureMethod, t.idempotencyKey],
      );
    },

    async getTransaction(id) {
      const rows = await q<Record<string, unknown>>(
        "SELECT id, user_id, account_id, amount, direction, clean_description, notes, idempotency_key FROM transactions WHERE id = ?",
        [id]);
      const r = rows[0];
      if (!r) return null;
      return {
        id: String(r.id),
        userId: String(r.user_id),
        accountId: String(r.account_id),
        amount: toNumber(r.amount),
        direction: r.direction as "INFLOW" | "OUTFLOW",
        cleanDescription: (r.clean_description as string | null) ?? null,
        notes: (r.notes as string | null) ?? null,
        idempotencyKey: String(r.idempotency_key),
      };
    },

    async updateTransactionNotes(id, notes) {
      await q("UPDATE transactions SET notes = ? WHERE id = ?", [notes, id]);
    },

    async getFieldVersion(entity, entityId, field) {
      const rows = await q<{ client_ts: unknown }>(
        "SELECT client_ts FROM field_versions WHERE entity = ? AND entity_id = ? AND field = ?",
        [entity, entityId, field]);
      return rows[0] ? toIso(rows[0].client_ts) : null;
    },

    async setFieldVersion(v) {
      await q(
        "INSERT INTO field_versions (user_id, entity, entity_id, field, client_ts, command_id) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (entity, entity_id, field) DO UPDATE SET client_ts = excluded.client_ts, command_id = excluded.command_id",
        [v.userId, v.entity, v.entityId, v.field, v.clientTs, v.commandId],
      );
    },
  };
  return storage;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `pnpm --filter @zeta/shared exec vitest run src/engine`
Expected: PASS — all storage tests on both `sqlite` and `postgres`.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/engine/sql-storage.ts packages/shared/src/engine/__tests__/sql-storage.test.ts
git commit -m "feat(engine): one SQL storage for SQLite and Postgres, with contract tests

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `captureManualTransaction` + the runner (idempotent replay)

**Files:**
- Create: `packages/shared/src/engine/commands/capture-manual-transaction.ts`
- Create: `packages/shared/src/engine/runner.ts`
- Create: `packages/shared/src/engine/index.ts`
- Modify: `packages/shared/src/index.ts` (add `export * from "./engine";`)
- Create: `packages/shared/src/engine/__tests__/capture-manual-transaction.test.ts`

**Interfaces:**
- Consumes: `StoragePort`, `CommandEnvelope`, `CommandResult` (Task 1); `createSqlStorage` (Task 3); `computeIdempotencyKey` from `../utils/idempotency` (existing: `computeIdempotencyKey({ provider, providerTransactionId?, transactionDate, amount, rawDescription?, installmentCurrent? }): Promise<string>`).
- Produces: `CaptureManualTransactionPayload`, `captureManualTransaction(s, cmd)`, `applyCommand(storage, cmd): Promise<CommandResult>`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/shared/src/engine/__tests__/capture-manual-transaction.test.ts
import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import type { CaptureManualTransactionPayload } from "../commands/capture-manual-transaction";
import type { CommandEnvelope } from "../types";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER_USER = "66666666-6666-4666-8666-666666666666";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const TX = "33333333-3333-4333-8333-333333333333";

function capture(over: Partial<CaptureManualTransactionPayload> = {}, id = "44444444-4444-4444-8444-444444444444"): CommandEnvelope<CaptureManualTransactionPayload> {
  return {
    id, type: "captureManualTransaction", userId: USER, deviceId: "phone-1",
    clientTs: "2026-09-18T15:00:00.000Z",
    payload: {
      transactionId: TX, accountId: ACCOUNT, amount: 25000, direction: "OUTFLOW",
      currencyCode: "COP", date: "2026-09-18", description: "Tostao", notes: null, ...over,
    },
  };
}

describe.each(DRIVERS)("captureManualTransaction on %s", (_name, make) => {
  async function setup() {
    const d = await make();
    await seedAccount(d, { id: ACCOUNT, userId: USER, balance: 100000 });
    return createSqlStorage(d);
  }

  it("creates the movement and lowers the account balance", async () => {
    const s = await setup();
    const r = await applyCommand(s, capture());
    expect(r).toEqual({ status: "applied", replayed: false, data: { transactionId: TX } });
    expect((await s.getTransaction(TX))?.cleanDescription).toBe("Tostao");
    expect((await s.getAccount(ACCOUNT))?.currentBalance).toBe(75000);
  });

  it("raises the balance for an INFLOW", async () => {
    const s = await setup();
    await applyCommand(s, capture({ direction: "INFLOW", amount: 50000 }));
    expect((await s.getAccount(ACCOUNT))?.currentBalance).toBe(150000);
  });

  it("applies a replayed command only once and returns the original result", async () => {
    const s = await setup();
    const first = await applyCommand(s, capture());
    const again = await applyCommand(s, capture());
    expect(again).toEqual({ ...first, replayed: true });
    expect((await s.getAccount(ACCOUNT))?.currentBalance).toBe(75000);
  });

  it("reports a duplicate when a different command captures the same movement", async () => {
    const s = await setup();
    await applyCommand(s, capture());
    const dup = await applyCommand(s, capture({}, "77777777-7777-4777-8777-777777777777"));
    expect(dup).toEqual({ status: "duplicate", replayed: false, data: { transactionId: TX } });
    expect((await s.getAccount(ACCOUNT))?.currentBalance).toBe(75000);
  });

  it("rejects invalid input, records the rejection and changes nothing", async () => {
    const s = await setup();
    const bad = capture({ amount: -5 });
    const r = await applyCommand(s, bad);
    expect(r.status).toBe("rejected");
    expect(r.error).toBe("El monto debe ser mayor que cero.");
    expect(await applyCommand(s, bad)).toEqual({ ...r, replayed: true });
    expect((await s.getAccount(ACCOUNT))?.currentBalance).toBe(100000);
  });

  it("rejects an account that belongs to someone else", async () => {
    const s = await setup();
    const r = await applyCommand(s, { ...capture(), userId: OTHER_USER });
    expect(r).toEqual({ status: "rejected", replayed: false, error: "Cuenta no encontrada." });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @zeta/shared exec vitest run src/engine/__tests__/capture-manual-transaction.test.ts`
Expected: FAIL — `Cannot find module '../runner'`.

- [ ] **Step 3: Implement the command**

```ts
// packages/shared/src/engine/commands/capture-manual-transaction.ts
import { computeIdempotencyKey } from "../../utils/idempotency";
import type { CommandEnvelope, CommandResult, StoragePort } from "../types";

export interface CaptureManualTransactionPayload {
  transactionId: string;
  accountId: string;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  currencyCode: string;
  date: string;
  description: string;
  notes?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns a Spanish error message, or null when the payload is valid. */
export function validateCaptureManualTransaction(p: CaptureManualTransactionPayload): string | null {
  if (!p || typeof p !== "object") return "Datos del movimiento inválidos.";
  if (!UUID_RE.test(p.transactionId ?? "") || !UUID_RE.test(p.accountId ?? "")) return "Identificador inválido.";
  if (typeof p.amount !== "number" || !Number.isFinite(p.amount) || p.amount <= 0) return "El monto debe ser mayor que cero.";
  // Tolerance, not equality: 0.29 * 100 === 28.999999999999996 in floating point.
  if (Math.abs(Math.round(p.amount * 100) - p.amount * 100) > 1e-6) return "El monto admite máximo dos decimales.";
  if (p.direction !== "INFLOW" && p.direction !== "OUTFLOW") return "Dirección inválida.";
  if (typeof p.currencyCode !== "string" || !/^[A-Z]{3}$/.test(p.currencyCode)) return "Moneda inválida.";
  if (typeof p.date !== "string" || !DATE_RE.test(p.date)) return "Fecha inválida.";
  if (typeof p.description !== "string" || p.description.trim() === "") return "Escribe una descripción.";
  if (p.description.length > 200) return "La descripción es muy larga.";
  if (p.notes != null && (typeof p.notes !== "string" || p.notes.length > 500)) return "La nota es muy larga.";
  return null;
}

export async function captureManualTransaction(
  s: StoragePort,
  cmd: CommandEnvelope<CaptureManualTransactionPayload>,
): Promise<CommandResult> {
  const p = cmd.payload;
  const error = validateCaptureManualTransaction(p);
  if (error) return { status: "rejected", replayed: false, error };

  const account = await s.getAccount(p.accountId);
  if (!account || account.userId !== cmd.userId) {
    return { status: "rejected", replayed: false, error: "Cuenta no encontrada." };
  }

  const idempotencyKey = await computeIdempotencyKey({
    provider: "MANUAL",
    providerTransactionId: p.transactionId,
    transactionDate: p.date,
    amount: p.amount,
    rawDescription: p.description.trim(),
  });
  const existing = await s.findTransactionByIdempotencyKey(idempotencyKey);
  if (existing) return { status: "duplicate", replayed: false, data: { transactionId: existing.id } };

  await s.insertTransaction({
    id: p.transactionId,
    userId: cmd.userId,
    accountId: p.accountId,
    amount: p.amount,
    currencyCode: p.currencyCode,
    direction: p.direction,
    transactionDate: p.date,
    cleanDescription: p.description.trim(),
    notes: p.notes ?? null,
    captureMethod: "MANUAL_FORM",
    idempotencyKey,
  });
  await s.adjustAccountBalance(p.accountId, p.direction === "OUTFLOW" ? -p.amount : p.amount);
  return { status: "applied", replayed: false, data: { transactionId: p.transactionId } };
}
```

- [ ] **Step 4: Implement the runner**

```ts
// packages/shared/src/engine/runner.ts
import { captureManualTransaction } from "./commands/capture-manual-transaction";
import type { CommandEnvelope, CommandResult, CommandType, StoragePort } from "./types";

type Handler = (s: StoragePort, cmd: CommandEnvelope<never>) => Promise<CommandResult>;

const HANDLERS: Partial<Record<CommandType, Handler>> = {
  captureManualTransaction: captureManualTransaction as Handler,
};

/**
 * Applies one command atomically. A command id seen before returns its stored
 * result with `replayed: true` and changes nothing. Handler results (including
 * validation rejections) are recorded; unexpected errors roll back and are
 * NOT recorded, so the command can be retried.
 */
export function applyCommand(storage: StoragePort, cmd: CommandEnvelope): Promise<CommandResult> {
  return storage.withTransaction(async (s) => {
    const prior = await s.findCommand(cmd.id);
    if (prior) return { ...prior.result, replayed: true };

    const handler = HANDLERS[cmd.type];
    const result: CommandResult = handler
      ? await handler(s, cmd as CommandEnvelope<never>)
      : { status: "rejected", replayed: false, error: `Comando desconocido: ${cmd.type}` };

    await s.recordCommand(cmd, result);
    return result;
  });
}
```

- [ ] **Step 5: Export the engine**

```ts
// packages/shared/src/engine/index.ts
export * from "./types";
export { toDialect } from "./sql";
export { createSqlStorage } from "./sql-storage";
export { applyCommand } from "./runner";
export {
  captureManualTransaction,
  validateCaptureManualTransaction,
  type CaptureManualTransactionPayload,
} from "./commands/capture-manual-transaction";
```

Add to `packages/shared/src/index.ts`, after the existing `export * from "./utils/idempotency";` line:
```ts
export * from "./engine";
```

- [ ] **Step 6: Run to verify they pass**

Run: `pnpm --filter @zeta/shared exec vitest run src/engine`
Expected: PASS — capture tests on both drivers (6 × 2) plus earlier tests.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/engine packages/shared/src/index.ts
git commit -m "feat(engine): captureManualTransaction + runner with idempotent replay

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `setTransactionNote` — latest edit wins per field

**Files:**
- Create: `packages/shared/src/engine/commands/set-transaction-note.ts`
- Modify: `packages/shared/src/engine/runner.ts` (register the handler)
- Modify: `packages/shared/src/engine/index.ts` (export)
- Create: `packages/shared/src/engine/__tests__/set-transaction-note.test.ts`

**Interfaces:**
- Consumes: `applyCommand` (Task 4), `StoragePort.getFieldVersion/setFieldVersion/updateTransactionNotes/getTransaction` (Task 3).
- Produces: `SetTransactionNotePayload`, `setTransactionNote(s, cmd)`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/shared/src/engine/__tests__/set-transaction-note.test.ts
import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import type { CommandEnvelope } from "../types";
import type { SetTransactionNotePayload } from "../commands/set-transaction-note";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const TX = "33333333-3333-4333-8333-333333333333";

function note(id: string, clientTs: string, notes: string | null): CommandEnvelope<SetTransactionNotePayload> {
  return { id, type: "setTransactionNote", userId: USER, deviceId: "phone-1", clientTs, payload: { transactionId: TX, notes } };
}

describe.each(DRIVERS)("setTransactionNote on %s", (_name, make) => {
  async function setup() {
    const d = await make();
    await seedAccount(d, { id: ACCOUNT, userId: USER, balance: 100000 });
    const s = createSqlStorage(d);
    await applyCommand(s, {
      id: "44444444-4444-4444-8444-444444444444", type: "captureManualTransaction", userId: USER,
      deviceId: "phone-1", clientTs: "2026-09-18T15:00:00.000Z",
      payload: { transactionId: TX, accountId: ACCOUNT, amount: 25000, direction: "OUTFLOW", currencyCode: "COP", date: "2026-09-18", description: "Tostao" },
    });
    return s;
  }

  it("sets the note", async () => {
    const s = await setup();
    const r = await applyCommand(s, note("a1111111-1111-4111-8111-111111111111", "2026-09-18T16:00:00.000Z", "con Ana"));
    expect(r.status).toBe("applied");
    expect((await s.getTransaction(TX))?.notes).toBe("con Ana");
  });

  it("keeps the latest edit when an older one arrives later", async () => {
    const s = await setup();
    await applyCommand(s, note("a2222222-2222-4222-8222-222222222222", "2026-09-18T17:00:00.000Z", "nueva"));
    const late = await applyCommand(s, note("a3333333-3333-4333-8333-333333333333", "2026-09-18T16:00:00.000Z", "vieja"));
    expect(late).toEqual({ status: "superseded", replayed: false });
    expect((await s.getTransaction(TX))?.notes).toBe("nueva");
  });

  it("rejects a note for a movement that doesn't exist", async () => {
    const s = await setup();
    const r = await applyCommand(s, {
      ...note("a4444444-4444-4444-8444-444444444444", "2026-09-18T16:00:00.000Z", "x"),
      payload: { transactionId: "99999999-9999-4999-8999-999999999999", notes: "x" },
    });
    expect(r).toEqual({ status: "rejected", replayed: false, error: "Movimiento no encontrado." });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @zeta/shared exec vitest run src/engine/__tests__/set-transaction-note.test.ts`
Expected: FAIL — `Cannot find module '../commands/set-transaction-note'`.

- [ ] **Step 3: Implement the command**

```ts
// packages/shared/src/engine/commands/set-transaction-note.ts
import type { CommandEnvelope, CommandResult, StoragePort } from "../types";

export interface SetTransactionNotePayload {
  transactionId: string;
  notes: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A user choice (S1-2): the edit with the latest clientTs wins, no matter
 * the order in which devices send it. Ties apply (last arrival wins).
 */
export async function setTransactionNote(
  s: StoragePort,
  cmd: CommandEnvelope<SetTransactionNotePayload>,
): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.transactionId ?? "")) return { status: "rejected", replayed: false, error: "Identificador inválido." };
  if (p.notes != null && (typeof p.notes !== "string" || p.notes.length > 500)) {
    return { status: "rejected", replayed: false, error: "La nota es muy larga." };
  }

  const tx = await s.getTransaction(p.transactionId);
  if (!tx || tx.userId !== cmd.userId) return { status: "rejected", replayed: false, error: "Movimiento no encontrado." };

  const current = await s.getFieldVersion("transaction", p.transactionId, "notes");
  if (current && Date.parse(current) > Date.parse(cmd.clientTs)) {
    return { status: "superseded", replayed: false };
  }

  await s.updateTransactionNotes(p.transactionId, p.notes);
  await s.setFieldVersion({
    userId: cmd.userId, entity: "transaction", entityId: p.transactionId,
    field: "notes", clientTs: cmd.clientTs, commandId: cmd.id,
  });
  return { status: "applied", replayed: false };
}
```

- [ ] **Step 4: Register and export it**

In `packages/shared/src/engine/runner.ts`, add the import and the handler entry:
```ts
import { setTransactionNote } from "./commands/set-transaction-note";
```
```ts
const HANDLERS: Partial<Record<CommandType, Handler>> = {
  captureManualTransaction: captureManualTransaction as Handler,
  setTransactionNote: setTransactionNote as Handler,
};
```
In `packages/shared/src/engine/index.ts`, append:
```ts
export { setTransactionNote, type SetTransactionNotePayload } from "./commands/set-transaction-note";
```

- [ ] **Step 5: Run to verify they pass**

Run: `pnpm --filter @zeta/shared exec vitest run src/engine`
Expected: PASS on both drivers.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/engine
git commit -m "feat(engine): setTransactionNote with latest-edit-wins per field

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Server Postgres driver + integration test on zeta-dev

**Files:**
- Create: `webapp/src/lib/engine/pg-driver.ts`
- Create: `webapp/src/lib/engine/__tests__/pg-integration.test.ts`
- Modify: `webapp/package.json` (add `pg`, dev `@types/pg`)

**Interfaces:**
- Consumes: `SqlDriver`, `createSqlStorage`, `applyCommand`, `toDialect` from `@zeta/shared`; tables from Task 2.
- Produces: `createUserScopedPgDriver(pool: Pool, userId: string): SqlDriver`.

- [ ] **Step 1: Add the dependency**

```bash
pnpm --filter webapp add pg && pnpm --filter webapp add -D @types/pg
```
Expected: `webapp/package.json` lists `pg` and `@types/pg`; root lockfile updated.

- [ ] **Step 2: Write the failing integration test**

```ts
// webapp/src/lib/engine/__tests__/pg-integration.test.ts
// Runs the shared engine against zeta-dev's REAL schema: encrypted views,
// INSTEAD OF triggers and RLS, as a signed-in user. Skipped without env:
//   set -a; source ../.env.v2-dev; set +a
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import { applyCommand, createSqlStorage, toDialect } from "@zeta/shared";
import { createUserScopedPgDriver } from "../pg-driver";

const env = process.env;
const enabled = Boolean(env.SUPABASE_DEV_DB_URL && env.SUPABASE_DEV_URL && env.SUPABASE_DEV_SECRET_KEY);

describe.skipIf(!enabled)("engine on zeta-dev (real Postgres)", () => {
  const admin = enabled
    ? createClient(env.SUPABASE_DEV_URL!, env.SUPABASE_DEV_SECRET_KEY!, { auth: { persistSession: false } })
    : (null as never);
  const pool = enabled ? new Pool({ connectionString: env.SUPABASE_DEV_DB_URL, max: 2 }) : (null as never);
  let userId = "";
  const accountId = crypto.randomUUID();
  const txId = crypto.randomUUID();

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `engine-${Date.now()}@zeta-dev.test`, password: crypto.randomUUID(), email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    const d = createUserScopedPgDriver(pool, userId);
    await d.query(
      toDialect("INSERT INTO accounts (id, user_id, name, account_type, currency_code, current_balance) VALUES (?, ?, ?, 'CHECKING', 'COP', 100000)", "postgres"),
      [accountId, userId, "Cuenta motor"],
    );
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
    await pool.end();
  });

  it("applies, replays and versions exactly like the contract suite", async () => {
    const s = createSqlStorage(createUserScopedPgDriver(pool, userId));
    const base = { userId, deviceId: "integration", clientTs: "2026-09-18T15:00:00.000Z" };
    const capture = {
      ...base, id: crypto.randomUUID(), type: "captureManualTransaction" as const,
      payload: { transactionId: txId, accountId, amount: 25000, direction: "OUTFLOW" as const, currencyCode: "COP", date: "2026-09-18", description: "Tostao motor" },
    };

    expect(await applyCommand(s, capture)).toEqual({ status: "applied", replayed: false, data: { transactionId: txId } });
    expect((await applyCommand(s, capture)).replayed).toBe(true);
    expect((await s.getAccount(accountId))?.currentBalance).toBe(75000);
    expect((await s.getTransaction(txId))?.cleanDescription).toBe("Tostao motor");

    const newer = { ...base, id: crypto.randomUUID(), type: "setTransactionNote" as const, clientTs: "2026-09-18T17:00:00.000Z", payload: { transactionId: txId, notes: "nueva" } };
    const older = { ...base, id: crypto.randomUUID(), type: "setTransactionNote" as const, clientTs: "2026-09-18T16:00:00.000Z", payload: { transactionId: txId, notes: "vieja" } };
    expect((await applyCommand(s, newer)).status).toBe("applied");
    expect((await applyCommand(s, older)).status).toBe("superseded");
    expect((await s.getTransaction(txId))?.notes).toBe("nueva");
  });

  it("stores the command payload encrypted, never as plain text", async () => {
    const d = createUserScopedPgDriver(pool, userId);
    const rows = await d.query<{ payload_enc: Buffer }>(
      toDialect("SELECT payload_enc FROM commands WHERE user_id = ? AND type = 'captureManualTransaction' LIMIT 1", "postgres"),
      [userId],
    );
    expect(rows).toHaveLength(1);
    expect(Buffer.from(rows[0].payload_enc).toString("utf8")).not.toContain("Tostao motor");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

```bash
set -a; source .env.v2-dev; set +a
pnpm --filter webapp exec vitest run src/lib/engine
```
Expected: FAIL — `Cannot find module '../pg-driver'`.

- [ ] **Step 4: Implement the driver**

```ts
// webapp/src/lib/engine/pg-driver.ts
import "server-only";
import type { Pool, PoolClient } from "pg";
import type { SqlDriver } from "@zeta/shared";

/**
 * Postgres access AS the signed-in user: each transaction switches to the
 * `authenticated` role and sets the JWT claims, so RLS, auth.uid() and the
 * encrypted views' triggers behave exactly as for PostgREST requests.
 * Server-only — never ship to the client.
 */
export function createUserScopedPgDriver(pool: Pool, userId: string): SqlDriver {
  const onClient = (client: PoolClient): SqlDriver => {
    const d: SqlDriver = {
      dialect: "postgres",
      async query(sql, params = []) {
        return (await client.query(sql, params as unknown[])).rows as never;
      },
      async transaction(fn) {
        return fn(d);
      },
    };
    return d;
  };

  const driver: SqlDriver = {
    dialect: "postgres",
    query(sql, params) {
      return driver.transaction((tx) => tx.query(sql, params));
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SET LOCAL ROLE authenticated");
        await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub: userId, role: "authenticated" }),
        ]);
        const result = await fn(onClient(client));
        await client.query("COMMIT");
        return result;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
  };
  return driver;
}
```

- [ ] **Step 5: Run to verify it passes**

```bash
set -a; source .env.v2-dev; set +a
pnpm --filter webapp exec vitest run src/lib/engine
```
Expected: PASS — 2 tests. Without the env vars the suite reports as skipped (not failed).

- [ ] **Step 6: Commit**

```bash
git add webapp/package.json pnpm-lock.yaml webapp/src/lib/engine
git commit -m "feat(engine): user-scoped Postgres driver + integration test on zeta-dev

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Gates, review and PR

**Files:** none new.

- [ ] **Step 1: Full shared test suite**

Run: `pnpm --filter @zeta/shared test`
Expected: PASS — all existing shared tests plus the engine suites on both drivers.

- [ ] **Step 2: Build gates**

```bash
pnpm install
pnpm build
(cd mobile && npx tsc --noEmit)
pnpm audit --audit-level high
```
Expected: install clean with lockfile committed; build passes; mobile typecheck passes (the engine is exported from `@zeta/shared` but not yet imported by mobile); audit reports no high/critical (fix with root `pnpm.overrides` if it does).

- [ ] **Step 3: Reviews**

Dispatch in parallel: `mobile-sync-doctor` ("review the engine's replay/outbox semantics and field_versions for the future phone adapter"), `import-flow-doctor` ("review captureManualTransaction's idempotency key and balance delta against the capture hierarchy"), `server-action-reviewer` ("review webapp/src/lib/engine/pg-driver.ts: role switch, JWT claims, server-only, transaction handling"). Apply fixes, re-run Steps 1–2.

- [ ] **Step 4: Dry-merge check, push and open the PR**

```bash
git fetch origin main && git merge --no-commit --no-ff origin/main; git merge --abort
git push -u origin feat/v2-engine-skeleton
gh pr create --title "feat(engine): v2 command engine walking skeleton" --body "$(cat <<'EOF'
Proves decision S1-1 before anything depends on it: one command runs with identical results on SQLite (phone) and Postgres (server).

- `@zeta/shared/engine`: command envelope, StoragePort, one SQL storage for both dialects, runner with idempotent replay.
- Commands: `captureManualTransaction` (validation, idempotency key, account balance), `setTransactionNote` (latest edit wins per field, S1-2).
- Contract suite runs every test on sql.js (SQLite) and PGlite (Postgres).
- `webapp/src/lib/engine/pg-driver.ts`: Postgres as the signed-in user (RLS + encrypted views); integration test against zeta-dev.
- Migration `commands` + `field_versions` — applied to zeta-dev only.

Not included: phone SQLite driver (expo-sqlite), API route, 90-day payload purge, UI.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Expected: PR URL printed. The owner reviews; merging deploys the web app (no behavior change) and the migration must then be pushed to production by hand, after owner approval.

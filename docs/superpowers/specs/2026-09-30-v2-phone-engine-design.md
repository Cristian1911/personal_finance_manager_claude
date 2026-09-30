# v2 phone engine — design (2026-09-30)

**Scope approved by the owner:** "phone engine only". The shared engine (PR #430) runs on the phone against a new SQLCipher-encrypted database, and every accepted command is queued in an outbox. No server route, no outbox drain, no pull (all M2), no v2 UI shell (next PR).

**Builds on:** `docs/mlp/10-build-plan.md` §3.1–3.2, decisions S1-1 (offline-first commands), S1-2 (conflicts), S2-1 (SQLCipher, key in Keychain/Keystore via SecureStore). Engine code: `packages/shared/src/engine/`.

## 1. Pieces

| Piece | File | Job |
|---|---|---|
| Engine SQLite schema | `packages/shared/src/engine/schema/sqlite.ts` | `SQLITE_ENGINE_SCHEMA`: `accounts`, `transactions`, `commands`, `field_versions` — the single definition used by the phone and by the contract tests (`__tests__/support/schema.ts` imports it). |
| Outbox | `packages/shared/src/engine/outbox.ts` | `OUTBOX_SCHEMA` and `applyAndEnqueue(driver, cmd)`: in one driver transaction runs `applyCommand(createSqlStorage(tx), cmd)` and, when the result is not `rejected` and not `replayed`, inserts the `outbox` row. Pure (takes a full envelope), so it is tested on sql.js in Node. Only the phone creates the table. |
| Driver | `mobile/lib/v2/engine/sqlite-driver.ts` | `createExpoSqliteDriver(db): SqlDriver` over one expo-sqlite connection. Every call goes through a JS mutex (promise chain); `transaction` = `BEGIN` / `COMMIT` / `ROLLBACK` on that connection; nested calls reuse the open transaction. Not `withExclusiveTransactionAsync`: it opens a second connection that would not carry the SQLCipher key. |
| Database | `mobile/lib/v2/engine/database.ts` | `getV2Database()`: opens `zeta-v2.db`, sets the key, verifies it, runs migrations (`PRAGMA user_version`), returns `{ db, driver }`; single-flight like `lib/db/database.ts`. |
| Key and device id | `mobile/lib/v2/engine/secrets.ts` | 32 random bytes (`expo-crypto`) as hex, SecureStore key `zeta.v2.dbKey`, `keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`; device id = UUID in `zeta.v2.deviceId`. |
| Local runner | `mobile/lib/v2/engine/run-local.ts` | `runLocalCommand({ type, userId, payload })`: builds the envelope (`id` = `Crypto.randomUUID()`, `clientTs` = `new Date().toISOString()`, `deviceId`) and calls `applyAndEnqueue` on the v2 driver. Returns the envelope and the `CommandResult`. |
| Self-test | `mobile/lib/v2/engine/self-test.ts` | `runSelfTest()`: on a throwaway keyed file (`zeta-v2-selftest.db`, deleted afterwards) runs the contract scenarios below and the encryption check; returns `{ name, ok, detail }[]`. |
| Debug screen | `mobile/app/v2-debug.tsx` | Reachable when `__DEV__` or `EXPO_PUBLIC_ZETA_V2 === "1"`; linked from Ajustes under the same condition. Spanish UI. |
| Native config | `mobile/app.json` | `["expo-sqlite", { "useSQLCipher": true }]` → needs a new native build. |

## 2. Data

**`zeta-v2.db` (new file).** The v1 `zeta.db` is untouched; SQLCipher opens an un-keyed file as plain SQLite, so v1 keeps working (verified on the simulator before merge).

**Key lifecycle.**
- First open: generate key, store it, `PRAGMA key = "x'<hex>'"`, create schema.
- Every open: `PRAGMA key` first, then `SELECT count(*) FROM sqlite_master` to verify. Failure (wrong/missing key) or file present without a stored key → close, delete the file, create a new key and database. Safe because the server is the truth and nothing is drained yet; later (M2) this path must drain or warn first — noted in the file.
- Connection pragmas after the key: `journal_mode = WAL`, `synchronous = NORMAL`, `busy_timeout = 5000`, `foreign_keys = ON` (same reasoning as v1).

**Schema v1 (`user_version = 1`).** `SQLITE_ENGINE_SCHEMA` plus `OUTBOX_SCHEMA` (phone-only table, defined in the shared engine so it is testable):
```sql
CREATE TABLE outbox (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,  -- send order
  command_id   TEXT NOT NULL UNIQUE,
  user_id      TEXT NOT NULL,
  state        TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sent','acked','dead')),
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT,
  server_result TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```
The payload is not copied: it stays in `commands.payload` (joined on `command_id`). The server's result goes to `outbox.server_result`, never over `commands.result` (that is what local replays return). State transitions beyond `pending` belong to M2.

**Migrations.** An ordered array of SQL strings; version = index + 1; applied in one transaction each, `PRAGMA user_version` bumped inside it.

## 3. Behaviour

- `runLocalCommand` never touches the network; a tap resolves from local SQLite only (round-trip budget rule).
- Envelope-rejected commands (malformed, unknown type) and handler rejections are not queued; `applied`, `duplicate`, `superseded` are.
- A replayed command id (same `id` passed again) returns the stored result and does not add a second outbox row (`UNIQUE(command_id)`; insert skipped when `replayed`).
- All v2 database access goes through the driver's mutex, including future sync writes.

## 4. Verification

**Automated (CI):** the contract suite keeps running on sql.js/PGlite, now importing `SQLITE_ENGINE_SCHEMA` from the engine; `applyAndEnqueue` tests on sql.js (queued when applied/duplicate/superseded; not when rejected or replayed; atomic with the command); mobile `tsc`.

**On the device (owner acceptance), `/v2-debug`:**
- Buttons: *Crear cuenta de prueba* (local, 100.000 COP), *Anotar gasto 25.000*, *Repetir el último comando*, *Nota vieja* / *Nota nueva* (sent newer-first, then older), *Borrar base v2*.
- Shows: balance, the movement's note, outbox count (pending), last result.
- *Autoprueba* (on the throwaway file): replay applied once · duplicate movement id · latest note wins with out-of-order arrival · tie broken by command id · balance stays at cents (0,1 + 0,2 = 0,3) · rollback leaves no trace · rejected command not queued · file unreadable without the key (open a second connection without `PRAGMA key` → `file is not a database`).
- Accepted when every Autoprueba line passes on the owner's phone and the v1 app still shows existing data.

**Reviews:** `mobile-sync-doctor` (driver, mutex, outbox, key handling), `zetas-front-guy` (debug screen, light touch), `mobile-perf-doctor` not needed (no lists).

## 5. Out of scope
Pull from the server, `/api/v2/commands`, outbox drain and retries, first-launch migration from v1, the v2 UI shell, removing the v1 sync.

# Movimientos: Detalle A, open row, delete and fix manual entries — Implementation Plan (PR 1 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring PR #445 (branch `feat/v2-movimientos`) in line with the approved interaction spec: Detalle design A, the account toggle out of Detalle, the open row (only ⋯ in M1), deleting and fixing manual entries, and a Deshacer toast.

**Architecture:** Two new engine commands (`deleteTransaction`, `editTransaction`) in `@zeta/shared`, each with contract tests on SQLite and PGlite plus the zeta-dev real-schema test. `captureManualTransaction` learns an optional `capturedAt` so Deshacer can re-create a deleted movement with its original time. The view builder `detalleView` is reshaped for design A. On the phone, `DetalleSheet` is rewritten to design A, a small `Toast` is added, and the Movimientos row opens in place with a ⋯ button that leads to Detalle.

**Tech Stack:** TypeScript, vitest (sql.js + PGlite drivers), Expo / React Native, Reanimated 4, `@react-native-community/datetimepicker` (already a mobile dependency).

**Spec:** `docs/superpowers/specs/2026-10-01-v2-interaction-design.md` (§3, §4, §9, §10, §11, §12; decisions S8-3, S8-4, S8-8, S8-10). Mockup: `claude-ai-design/v2-movimientos-acciones/opciones.html` (A · Lista).

**Plans for PRs 2–5** (components, tab bar + Anotar, accounts, Ajustes) are written when their turn comes, against the code this PR leaves.

## Global Constraints

- Every write is a command run by `runLocalCommand` (phone) → `applyAndEnqueue`; never raw row writes (CLAUDE.md "Zeta v2 · Engine").
- Every new command ships with contract tests on **both** drivers (`DRIVERS` in `packages/shared/src/engine/__tests__/support/drivers.ts`); this is a build gate.
- Schema: additive only; no new `_enc` columns. This PR needs **no** schema change.
- User-facing strings in Spanish; tokens from `useV2Theme()` only; no side stripes; only the Disponible number is bold (here: semibold).
- Red is only for what can't be undone or ends something (S8-8). "No es un movimiento" has Deshacer, so it is a **text** button, not destructive.
- Bank movements: amount, date and account are bank facts (S1-2) — not editable, not deletable (ignore instead).
- Manual capture methods: `MANUAL_FORM`, `TEXT_QUICK_CAPTURE`.
- M1 open row shows only ⋯; no greyed-out Categoría/Destinatario placeholders (S8-10). Account edit waits for PR 4 (accounts have no names on the phone yet).
- Gates before claiming done: `pnpm --filter @zeta/shared test`, `cd mobile && npx tsc --noEmit`, `pnpm build:web`, zeta-dev integration test (`set -a; source .env.v2-dev; set +a` then `cd webapp && npx vitest run src/lib/engine/__tests__/pg-integration.test.ts`), dry-merge with `origin/main`, `pnpm audit --audit-level high` (2 accepted highs).

## Review Focus

1. **Deshacer after delete restores everything**: same id, amount, date, account balance, note **and the original time** (the row must not jump to "now").
2. **Deleting twice / replaying the delete** (server replay, double tap) must not move the balance twice.
3. **Editing the amount of a movement on a counted account** must move the account balance by exactly the difference, and Disponible with it.
4. **A bank movement** must not offer delete or edit, even if the UI is bypassed (engine rejects).
5. **An old edit arriving after a newer one** (two devices) must not overwrite it (field versions per field).

---

### Task 1: Engine — richer transaction read, `capturedAt`, and `deleteTransaction`

**Files:**
- Modify: `packages/shared/src/engine/types.ts` (`TransactionRow`, `StoragePort`, `CommandType`)
- Modify: `packages/shared/src/engine/sql-storage.ts` (`getTransaction`, new `deleteTransaction`)
- Modify: `packages/shared/src/engine/commands/capture-manual-transaction.ts` (`capturedAt`)
- Create: `packages/shared/src/engine/commands/delete-transaction.ts`
- Modify: `packages/shared/src/engine/runner.ts`, `packages/shared/src/engine/index.ts`
- Test: `packages/shared/src/engine/__tests__/delete-transaction.test.ts`, `packages/shared/src/engine/__tests__/sql-storage.test.ts` (full-row assertion)

**Interfaces:**
- Produces: `TransactionRow` gains `captureMethod: string`, `transactionDate: string` (YYYY-MM-DD), `createdAt: string | null`, `currencyCode: string`. `StoragePort.deleteTransaction(userId, id): Promise<void>`. `CaptureManualTransactionPayload.capturedAt?: string` (ISO UTC, not after `clientTs`). Command `deleteTransaction` with `DeleteTransactionPayload { transactionId: string }`. `MANUAL_CAPTURE_METHODS: ReadonlySet<string>` exported from `commands/delete-transaction.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/src/engine/__tests__/delete-transaction.test.ts
import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import { toDialect } from "../sql";
import type { CommandEnvelope } from "../types";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const TX = "33333333-3333-4333-8333-333333333333";
const BANK_TX = "55555555-5555-4555-8555-555555555555";

const capture = (id: string, clientTs: string, extra: Record<string, unknown> = {}): CommandEnvelope => ({
  id, type: "captureManualTransaction", userId: USER, deviceId: "phone-1", clientTs,
  payload: { transactionId: TX, accountId: ACCOUNT, amount: 25000, direction: "OUTFLOW", currencyCode: "COP", date: "2026-09-18", description: "Tostao", notes: "con Ana", ...extra },
});
const del = (id: string, transactionId = TX): CommandEnvelope => ({
  id, type: "deleteTransaction", userId: USER, deviceId: "phone-1", clientTs: "2026-09-18T16:00:00.000Z", payload: { transactionId },
});

describe.each(DRIVERS)("deleteTransaction on %s", (_name, make) => {
  async function setup() {
    const d = await make();
    await seedAccount(d, { id: ACCOUNT, userId: USER, balance: 100000 });
    const s = createSqlStorage(d);
    await applyCommand(s, capture("44444444-4444-4444-8444-444444444444", "2026-09-18T15:00:00.000Z"));
    return { d, s };
  }

  it("deletes a manual movement and puts its amount back on the account", async () => {
    const { s } = await setup();
    expect((await s.getAccount(USER, ACCOUNT))?.currentBalance).toBe(75000);
    expect((await applyCommand(s, del("a1111111-1111-4111-8111-111111111111"))).status).toBe("applied");
    expect(await s.getTransaction(USER, TX)).toBeNull();
    expect((await s.getAccount(USER, ACCOUNT))?.currentBalance).toBe(100000);
  });

  it("replaying the same delete or deleting again never moves the balance twice", async () => {
    const { s } = await setup();
    const cmd = del("a2222222-2222-4222-8222-222222222222");
    await applyCommand(s, cmd);
    expect((await applyCommand(s, cmd)).replayed).toBe(true);
    expect(await applyCommand(s, del("a3333333-3333-4333-8333-333333333333"))).toMatchObject({ status: "rejected", code: "not_found" });
    expect((await s.getAccount(USER, ACCOUNT))?.currentBalance).toBe(100000);
  });

  it("Deshacer: re-capturing with the same id and capturedAt brings it back exactly", async () => {
    const { s } = await setup();
    await applyCommand(s, del("a4444444-4444-4444-8444-444444444444"));
    const undo = await applyCommand(s, capture("a5555555-5555-4555-8555-555555555555", "2026-09-18T16:00:03.000Z", { capturedAt: "2026-09-18T15:00:00.000Z" }));
    expect(undo.status).toBe("applied");
    expect(await s.getTransaction(USER, TX)).toMatchObject({ amount: 25000, notes: "con Ana", transactionDate: "2026-09-18", createdAt: "2026-09-18T15:00:00.000Z" });
    expect((await s.getAccount(USER, ACCOUNT))?.currentBalance).toBe(75000);
  });

  it("rejects a capturedAt after the command's own time", async () => {
    const { s } = await setup();
    await applyCommand(s, del("a6666666-6666-4666-8666-666666666666"));
    const r = await applyCommand(s, capture("a7777777-7777-4777-8777-777777777777", "2026-09-18T16:00:00.000Z", { capturedAt: "2026-09-19T00:00:00.000Z" }));
    expect(r).toMatchObject({ status: "rejected", code: "invalid" });
  });

  it("never deletes a bank movement (it can only be ignored)", async () => {
    const { d, s } = await setup();
    await d.query(
      toDialect("INSERT INTO transactions (id, user_id, account_id, amount, currency_code, direction, transaction_date, clean_description, notes, capture_method, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", d.dialect),
      [BANK_TX, USER, ACCOUNT, 32000, "COP", "OUTFLOW", "2026-09-18", "RAPPI", null, "EMAIL_IMPORT", "bank-key-1", "2026-09-18T17:41:00.000Z"],
    );
    const r = await applyCommand(s, del("a8888888-8888-4888-8888-888888888888", BANK_TX));
    expect(r).toEqual({ status: "rejected", replayed: false, code: "invalid", error: "Solo se pueden borrar los movimientos que anotaste a mano." });
    expect(await s.getTransaction(USER, BANK_TX)).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @zeta/shared exec vitest run src/engine/__tests__/delete-transaction.test.ts`
Expected: FAIL (unknown command type "deleteTransaction" → `rejected`/not recorded; `transactionDate` undefined).

- [ ] **Step 3: Implement**

In `types.ts`:

```ts
export type CommandType =
  | "captureManualTransaction"
  | "setTransactionNote"
  | "setTransactionExcluded"
  | "deleteTransaction"
  | "editTransaction"
  | "setCycleSettings"
  | "setAccountCountsInDisponible";
```

```ts
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
}
```

Add to `StoragePort` (after `updateTransactionExcluded`):

```ts
  deleteTransaction(userId: string, id: string): Promise<void>;
  updateTransactionFacts(userId: string, id: string, facts: { amount: number; transactionDate: string; accountId: string }): Promise<void>;
```

In `sql-storage.ts` replace `getTransaction` and add the two methods (`updateTransactionFacts` is used in Task 2; adding it now keeps the port complete):

```ts
    async getTransaction(userId, id) {
      // date as text on Postgres: a JS Date would shift the day with the time zone.
      const rows = await q<Record<string, unknown>>(
        `SELECT id, user_id, account_id, amount, currency_code, direction,
                ${pg ? "transaction_date::text" : "transaction_date"} AS transaction_date,
                clean_description, notes, capture_method, idempotency_key, created_at
           FROM transactions WHERE user_id = ? AND id = ?`,
        [userId, id]);
      const r = rows[0];
      if (!r) return null;
      return {
        id: String(r.id),
        userId: String(r.user_id),
        accountId: String(r.account_id),
        amount: toNumber(r.amount),
        currencyCode: String(r.currency_code),
        direction: r.direction as "INFLOW" | "OUTFLOW",
        transactionDate: String(r.transaction_date),
        cleanDescription: (r.clean_description as string | null) ?? null,
        notes: (r.notes as string | null) ?? null,
        captureMethod: String(r.capture_method),
        idempotencyKey: String(r.idempotency_key),
        createdAt: r.created_at == null ? null : toIso(r.created_at),
      };
    },

    async deleteTransaction(userId, id) {
      await q("DELETE FROM transactions WHERE user_id = ? AND id = ?", [userId, id]);
    },

    async updateTransactionFacts(userId, id, f) {
      await q("UPDATE transactions SET amount = ?, transaction_date = ?, account_id = ? WHERE user_id = ? AND id = ?",
        [f.amount, f.transactionDate, f.accountId, userId, id]);
    },
```

(Import `toIso` from `./sql` in `sql-storage.ts` if it isn't imported yet.)

In `capture-manual-transaction.ts`, add to the payload interface:

```ts
  /** Deshacer: the original capture instant, so a re-created movement keeps its time. Not after clientTs. */
  capturedAt?: string;
```

and in `captureManualTransaction`, after `if (error) return …`:

```ts
  if (p.capturedAt !== undefined && (!isIsoUtc(p.capturedAt) || p.capturedAt > cmd.clientTs)) {
    return { status: "rejected", replayed: false, code: "invalid", error: "Hora de captura inválida." };
  }
```

and change the insert's `createdAt: cmd.clientTs` to `createdAt: p.capturedAt ?? cmd.clientTs` (import `isIsoUtc` from `../validate`).

Create `commands/delete-transaction.ts`:

```ts
import type { CommandEnvelope, CommandResult, StoragePort } from "../types";
import { UUID_RE } from "../validate";

/** Movements the user wrote down; bank movements are only ever ignored. */
export const MANUAL_CAPTURE_METHODS: ReadonlySet<string> = new Set(["MANUAL_FORM", "TEXT_QUICK_CAPTURE"]);

export interface DeleteTransactionPayload {
  transactionId: string;
}

/**
 * "No es un movimiento" on a manual entry (D8): the row goes away and its
 * amount goes back to the account. Deshacer re-captures it with the same id
 * and its original capturedAt. Replays are no-ops (runner).
 */
export async function deleteTransaction(
  s: StoragePort,
  cmd: CommandEnvelope<DeleteTransactionPayload>,
): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.transactionId ?? "")) return { status: "rejected", replayed: false, code: "invalid", error: "Identificador inválido." };
  const tx = await s.getTransaction(cmd.userId, p.transactionId);
  if (!tx) return { status: "rejected", replayed: false, code: "not_found", error: "Movimiento no encontrado." };
  if (!MANUAL_CAPTURE_METHODS.has(tx.captureMethod)) {
    return { status: "rejected", replayed: false, code: "invalid", error: "Solo se pueden borrar los movimientos que anotaste a mano." };
  }
  await s.deleteTransaction(cmd.userId, tx.id);
  await s.adjustAccountBalance(cmd.userId, tx.accountId, tx.direction === "OUTFLOW" ? tx.amount : -tx.amount);
  return { status: "applied", replayed: false };
}
```

Register in `runner.ts` (`import { deleteTransaction } from "./commands/delete-transaction";` and add `deleteTransaction,` to `HANDLERS`), and export from `index.ts`:

```ts
export { MANUAL_CAPTURE_METHODS, deleteTransaction, type DeleteTransactionPayload } from "./commands/delete-transaction";
```

- [ ] **Step 4: Update the storage test's full-row assertion**

`packages/shared/src/engine/__tests__/sql-storage.test.ts` ("inserts, finds and updates a transaction") compares the whole row with `toEqual`; replace that expectation with the widened row, and add a delete + facts update:

```ts
    expect(await s.getTransaction(USER, TX)).toEqual({
      id: TX, userId: USER, accountId: ACCOUNT, amount: 25000, currencyCode: "COP", direction: "OUTFLOW",
      transactionDate: "2026-09-18", cleanDescription: "Tostao", notes: "con Ana", captureMethod: "MANUAL_FORM",
      idempotencyKey: "k1", createdAt: "2026-09-18T15:00:00.000Z",
    });
    await s.updateTransactionFacts(USER, TX, { amount: 30000, transactionDate: "2026-09-17", accountId: ACCOUNT });
    expect(await s.getTransaction(USER, TX)).toMatchObject({ amount: 30000, transactionDate: "2026-09-17" });
    await s.deleteTransaction(OTHER_USER, TX); // scoped: another user's delete does nothing
    expect(await s.getTransaction(USER, TX)).not.toBeNull();
    await s.deleteTransaction(USER, TX);
    expect(await s.getTransaction(USER, TX)).toBeNull();
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @zeta/shared test`
Expected: all pass (797 before + 10 new = 807; the storage test is updated, not added).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/engine
git commit -m "feat(engine): deleteTransaction for manual entries; capturedAt for Deshacer"
```

---

### Task 2: Engine — `editTransaction` (amount and date of a manual entry)

**Files:**
- Create: `packages/shared/src/engine/commands/edit-transaction.ts`
- Modify: `packages/shared/src/engine/runner.ts`, `packages/shared/src/engine/index.ts`
- Test: `packages/shared/src/engine/__tests__/edit-transaction.test.ts`

**Interfaces:**
- Consumes: `MANUAL_CAPTURE_METHODS`, `StoragePort.updateTransactionFacts`, `TransactionRow` (Task 1); `isNewer` from `commands/field-version.ts`.
- Produces: command `editTransaction` with `EditTransactionPayload { transactionId: string; amount?: number; date?: string; accountId?: string }` (at least one of the three). Field versions per field: `amount`, `transaction_date`, `account_id` (entity `transaction`).

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/src/engine/__tests__/edit-transaction.test.ts
import { describe, expect, it } from "vitest";
import { applyCommand } from "../runner";
import { createSqlStorage } from "../sql-storage";
import type { CommandEnvelope } from "../types";
import { DRIVERS, seedAccount } from "./support/drivers";

const USER = "11111111-1111-4111-8111-111111111111";
const A = "22222222-2222-4222-8222-222222222222";
const B = "66666666-6666-4666-8666-666666666666";
const TX = "33333333-3333-4333-8333-333333333333";

const edit = (id: string, clientTs: string, payload: Record<string, unknown>): CommandEnvelope => ({
  id, type: "editTransaction", userId: USER, deviceId: "phone-1", clientTs, payload: { transactionId: TX, ...payload },
});

describe.each(DRIVERS)("editTransaction on %s", (_name, make) => {
  async function setup() {
    const d = await make();
    await seedAccount(d, { id: A, userId: USER, balance: 100000 });
    await seedAccount(d, { id: B, userId: USER, balance: 50000 });
    const s = createSqlStorage(d);
    await applyCommand(s, {
      id: "44444444-4444-4444-8444-444444444444", type: "captureManualTransaction", userId: USER, deviceId: "phone-1",
      clientTs: "2026-09-18T15:00:00.000Z",
      payload: { transactionId: TX, accountId: A, amount: 25000, direction: "OUTFLOW", currencyCode: "COP", date: "2026-09-18", description: "Tostao" },
    });
    return s;
  }

  it("fixing the amount moves the account balance by exactly the difference", async () => {
    const s = await setup();
    expect((await applyCommand(s, edit("a1111111-1111-4111-8111-111111111111", "2026-09-18T16:00:00.000Z", { amount: 32000 }))).status).toBe("applied");
    expect((await s.getTransaction(USER, TX))?.amount).toBe(32000);
    expect((await s.getAccount(USER, A))?.currentBalance).toBe(68000);
  });

  it("fixing the date keeps the balance", async () => {
    const s = await setup();
    await applyCommand(s, edit("a2222222-2222-4222-8222-222222222222", "2026-09-18T16:00:00.000Z", { date: "2026-09-17" }));
    expect((await s.getTransaction(USER, TX))?.transactionDate).toBe("2026-09-17");
    expect((await s.getAccount(USER, A))?.currentBalance).toBe(75000);
  });

  it("moving it to another account takes the amount out of one and into the other", async () => {
    const s = await setup();
    await applyCommand(s, edit("a3333333-3333-4333-8333-333333333333", "2026-09-18T16:00:00.000Z", { accountId: B }));
    expect((await s.getAccount(USER, A))?.currentBalance).toBe(100000);
    expect((await s.getAccount(USER, B))?.currentBalance).toBe(25000);
  });

  it("an older edit arriving later doesn't overwrite a newer one, per field", async () => {
    const s = await setup();
    await applyCommand(s, edit("a4444444-4444-4444-8444-444444444444", "2026-09-18T17:00:00.000Z", { amount: 30000 }));
    const late = await applyCommand(s, edit("a5555555-5555-4555-8555-555555555555", "2026-09-18T16:00:00.000Z", { amount: 20000, date: "2026-09-16" }));
    expect(late.status).toBe("applied"); // the date was free to change
    expect(await s.getTransaction(USER, TX)).toMatchObject({ amount: 30000, transactionDate: "2026-09-16" });
    expect((await s.getAccount(USER, A))?.currentBalance).toBe(70000);
  });

  it("rejects nothing-to-change, a bad amount, a bad date and an unknown account", async () => {
    const s = await setup();
    const r = (p: Record<string, unknown>, id: string) => applyCommand(s, edit(id, "2026-09-18T16:00:00.000Z", p));
    expect(await r({}, "a6666666-6666-4666-8666-666666666666")).toMatchObject({ status: "rejected", code: "invalid" });
    expect(await r({ amount: 0 }, "a7777777-7777-4777-8777-777777777777")).toMatchObject({ status: "rejected", code: "invalid" });
    expect(await r({ date: "18/09/2026" }, "a8888888-8888-4888-8888-888888888888")).toMatchObject({ status: "rejected", code: "invalid" });
    expect(await r({ accountId: "99999999-9999-4999-8999-999999999999" }, "a9999999-9999-4999-8999-999999999999")).toMatchObject({ status: "rejected", code: "not_found" });
    expect((await s.getAccount(USER, A))?.currentBalance).toBe(75000);
  });

  it("never edits a bank movement (the bank's facts win)", async () => {
    const d = await make();
    await seedAccount(d, { id: A, userId: USER, balance: 100000 });
    const s = createSqlStorage(d);
    await d.query(
      toDialect("INSERT INTO transactions (id, user_id, account_id, amount, currency_code, direction, transaction_date, clean_description, notes, capture_method, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", d.dialect),
      [TX, USER, A, 32000, "COP", "OUTFLOW", "2026-09-18", "RAPPI", null, "EMAIL_IMPORT", "bank-key-2", "2026-09-18T17:41:00.000Z"],
    );
    const r = await applyCommand(s, edit("b1111111-1111-4111-8111-111111111111", "2026-09-18T18:00:00.000Z", { amount: 1000 }));
    expect(r).toMatchObject({ status: "rejected", code: "invalid" });
    expect((await s.getTransaction(USER, TX))?.amount).toBe(32000);
  });
});
```

(Add `import { toDialect } from "../sql";` at the top of this test file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @zeta/shared exec vitest run src/engine/__tests__/edit-transaction.test.ts`
Expected: FAIL (unknown command type).

- [ ] **Step 3: Implement**

```ts
// packages/shared/src/engine/commands/edit-transaction.ts
import type { CommandEnvelope, CommandResult, StoragePort } from "../types";
import { UUID_RE } from "../validate";
import { MANUAL_CAPTURE_METHODS } from "./delete-transaction";
import { isNewer } from "./field-version";

export interface EditTransactionPayload {
  transactionId: string;
  amount?: number;
  date?: string;
  accountId?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FIELDS = [
  { key: "amount", field: "amount" },
  { key: "date", field: "transaction_date" },
  { key: "accountId", field: "account_id" },
] as const;

/**
 * Fix the amount, date or account of a manual entry (D7). Bank movements keep
 * the bank's facts (S1-2). Each field is versioned on its own: the latest
 * clientTs wins per field, so two devices editing different fields both stick.
 * Balances follow: the old effect comes off the old account, the new one goes
 * on the (possibly new) account.
 */
export async function editTransaction(
  s: StoragePort,
  cmd: CommandEnvelope<EditTransactionPayload>,
): Promise<CommandResult> {
  const p = cmd.payload;
  const bad = (error: string): CommandResult => ({ status: "rejected", replayed: false, code: "invalid", error });
  if (!p || !UUID_RE.test(p.transactionId ?? "")) return bad("Identificador inválido.");
  if (p.amount === undefined && p.date === undefined && p.accountId === undefined) return bad("No hay nada que cambiar.");
  if (p.amount !== undefined && (typeof p.amount !== "number" || !Number.isFinite(p.amount) || p.amount <= 0
    || Math.abs(Math.round(p.amount * 100) - p.amount * 100) > 1e-6)) return bad("El monto debe ser mayor que cero.");
  if (p.date !== undefined && (typeof p.date !== "string" || !DATE_RE.test(p.date))) return bad("Fecha inválida.");
  if (p.accountId !== undefined && !UUID_RE.test(p.accountId)) return bad("Cuenta inválida.");

  const tx = await s.getTransaction(cmd.userId, p.transactionId);
  if (!tx) return { status: "rejected", replayed: false, code: "not_found", error: "Movimiento no encontrado." };
  if (!MANUAL_CAPTURE_METHODS.has(tx.captureMethod)) return bad("Los datos del banco no se pueden cambiar; puedes ignorar el movimiento.");
  if (p.accountId !== undefined && !(await s.getAccount(cmd.userId, p.accountId))) {
    return { status: "rejected", replayed: false, code: "not_found", error: "Cuenta no encontrada." };
  }

  const next = { amount: tx.amount, transactionDate: tx.transactionDate, accountId: tx.accountId };
  let changed = 0;
  for (const { key, field } of FIELDS) {
    if (p[key] === undefined) continue;
    const current = await s.getFieldVersion(cmd.userId, "transaction", tx.id, field);
    if (current && isNewer(current, cmd.clientTs, cmd.id)) continue; // a newer edit of this field already won
    if (key === "amount") next.amount = p.amount!;
    if (key === "date") next.transactionDate = p.date!;
    if (key === "accountId") next.accountId = p.accountId!;
    await s.setFieldVersion({ userId: cmd.userId, entity: "transaction", entityId: tx.id, field, clientTs: cmd.clientTs, commandId: cmd.id });
    changed++;
  }
  if (changed === 0) return { status: "superseded", replayed: false };

  const sign = tx.direction === "OUTFLOW" ? -1 : 1;
  await s.updateTransactionFacts(cmd.userId, tx.id, next);
  await s.adjustAccountBalance(cmd.userId, tx.accountId, -sign * tx.amount);
  await s.adjustAccountBalance(cmd.userId, next.accountId, sign * next.amount);
  return { status: "applied", replayed: false };
}
```

Register in `runner.ts` (`import { editTransaction } from "./commands/edit-transaction";`, add to `HANDLERS`) and export from `index.ts`:

```ts
export { editTransaction, type EditTransactionPayload } from "./commands/edit-transaction";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @zeta/shared test`
Expected: all pass (807 + 12 = 819).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/engine
git commit -m "feat(engine): editTransaction — fix amount, date or account of a manual entry"
```

---

### Task 3: Engine — `detalleView` for design A

**Files:**
- Modify: `packages/shared/src/engine/disponible/movimientos.ts` (`DetalleView`, `detalleView`)
- Modify: `packages/shared/src/engine/disponible/index.ts` (export `DetalleSource`)
- Test: `packages/shared/src/engine/disponible/__tests__/movimientos.test.ts` (replace the "Detalle" `describe`)

**Interfaces:**
- Consumes: `MANUAL_CAPTURE_METHODS` (Task 1).
- Produces (used by Task 5):

```ts
export type DetalleSource = "manual" | "email" | "notification" | "pdf" | "screenshot" | "other";
export interface DetalleView {
  id: string;
  initial: string;
  title: string;
  amount: string;
  tone: MovimientoTone;
  source: DetalleSource;
  /** "Correo · hoy 12:41 · Cuenta" */
  facts: string;
  /** Only when it doesn't count: "No cuenta · va a la factura", "No cuenta · lo ignoraste". */
  status: string | null;
  note: string | null;
  excluded: boolean;
  /** Written down by hand: amount and date can be fixed; "No es un movimiento" deletes it. */
  manual: boolean;
  /** Raw values for the fix form. */
  raw: { amount: number; date: IsoDate };
}
```

- [ ] **Step 1: Write the failing test** (replace the existing `describe("Detalle", …)` block)

```ts
describe("Detalle", () => {
  const view = (t: StoredTransaction) => detalleView({ today: TODAY, transaction: t, accounts: ACCOUNTS });

  it("a manual spend: source, facts, editable, counts (no status)", () => {
    expect(view(TXS[1])).toEqual({
      id: TXS[1].id, initial: "T", title: "Tostao", amount: "−$8.000", tone: "out",
      source: "manual", facts: "A mano · hoy 8:15 · Cuenta", status: null,
      note: "con Ana", excluded: false, manual: true, raw: { amount: 8000, date: "2026-09-18" },
    });
  });

  it("a bank movement can't be fixed or deleted, and says where it came from", () => {
    const bank = { ...TXS[0], captureMethod: "EMAIL_IMPORT" };
    expect(view(bank)).toMatchObject({ source: "email", facts: "Correo · hoy 12:41 · Cuenta", manual: false });
  });

  it("says why it doesn't count", () => {
    expect(view(TXS[4]).status).toBe("No cuenta · lo ignoraste");
    expect(view(TXS[2]).status).toBe("No cuenta · va a la factura");
    expect(view(TXS[6]).status).toBe("No cuenta · esa cuenta está aparte");
    expect(view(TXS[3]).facts).toBe("A mano · ayer 12:41 · Cuenta");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @zeta/shared exec vitest run src/engine/disponible/__tests__/movimientos.test.ts`
Expected: FAIL (`source`, `facts`, `manual` missing; `counts` present).

- [ ] **Step 3: Implement** — in `movimientos.ts` replace `DetalleView`, the `SOURCE` map and `detalleView`:

```ts
import { MANUAL_CAPTURE_METHODS } from "../commands/delete-transaction";

export type DetalleSource = "manual" | "email" | "notification" | "pdf" | "screenshot" | "other";

const SOURCE_OF: Record<string, DetalleSource> = {
  MANUAL_FORM: "manual", TEXT_QUICK_CAPTURE: "manual",
  EMAIL_IMPORT: "email", NOTIFICATION: "notification",
  PDF_IMPORT: "pdf", EMAIL_PDF_IMPORT: "pdf",
  OCR_BATCH: "screenshot", OCR_SINGLE: "screenshot",
};
const SOURCE_WORD: Record<DetalleSource, string> = {
  manual: "A mano", email: "Correo", notification: "Notificación", pdf: "Extracto", screenshot: "Captura", other: "Registrado",
};

export interface DetalleView {
  id: string;
  initial: string;
  title: string;
  amount: string;
  tone: MovimientoTone;
  source: DetalleSource;
  /** "Correo · hoy 12:41 · Cuenta" */
  facts: string;
  /** Only when it doesn't count: "No cuenta · va a la factura", "No cuenta · lo ignoraste". */
  status: string | null;
  note: string | null;
  excluded: boolean;
  /** Written down by hand: amount and date can be fixed; "No es un movimiento" deletes it. */
  manual: boolean;
  /** Raw values for the fix form. */
  raw: { amount: number; date: IsoDate };
}

/** The Detalle sheet of one movement, design A (the same sheet for every row). */
export function detalleView(input: { today: IsoDate; transaction: StoredTransaction; accounts: InicioAccount[] }): DetalleView {
  const { today, transaction: t } = input;
  const a = accountsById(input.accounts).get(t.accountId);
  const tone = toneOf(t, a);
  const title = titleOf(t);
  const source = SOURCE_OF[t.captureMethod ?? ""] ?? "other";
  const time = t.createdAt ? ` ${colombiaTime(t.createdAt)}` : "";
  const when = relativeDay(today, t.date);
  const facts = `${SOURCE_WORD[source]} · ${when === "Hoy" || when === "Ayer" ? when.toLowerCase() : when}${time} · ${a?.label ?? "Cuenta"}`;

  let status: string | null = null;
  if (t.isExcluded) status = "No cuenta · lo ignoraste";
  else if (!a || isDebt(a.type)) status = `No cuenta · ${a?.type === "LOAN" ? "es un préstamo" : "va a la factura"}`;
  else if (!a.counts) status = "No cuenta · esa cuenta está aparte";

  return {
    id: t.id, initial: title.charAt(0).toUpperCase(), title,
    amount: amountOf(t, tone), tone, source, facts, status,
    note: t.notes?.trim() || null,
    excluded: !!t.isExcluded,
    manual: MANUAL_CAPTURE_METHODS.has(t.captureMethod ?? ""),
    raw: { amount: t.amount, date: t.date },
  };
}
```

Remove the old `SOURCE` map and the `shortDate` import if now unused. In `disponible/index.ts` add `type DetalleSource,` to the `./movimientos` export list.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @zeta/shared test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/engine/disponible
git commit -m "feat(engine): detalleView for design A — source, facts, status, manual"
```

---

### Task 4: Real schema — delete and edit on zeta-dev

**Files:**
- Modify: `webapp/src/lib/engine/__tests__/pg-integration.test.ts` (end of the first `it`, after the Ignorar block)

**Interfaces:**
- Consumes: commands from Tasks 1–2.

- [ ] **Step 1: Add the assertions**

```ts
    // Fix and delete a manual entry through the real view's INSTEAD OF triggers.
    const fix = { ...base, id: crypto.randomUUID(), type: "editTransaction" as const, clientTs: "2026-09-18T18:00:00.000Z", payload: { transactionId: txId, amount: 30000, date: "2026-09-17" } };
    expect((await applyCommand(s, fix)).status).toBe("applied");
    expect(await s.getTransaction(userId, txId)).toMatchObject({ amount: 30000, transactionDate: "2026-09-17", captureMethod: "MANUAL_FORM" });
    const before = (await s.getAccount(userId, accountId))!.currentBalance;
    const gone = { ...base, id: crypto.randomUUID(), type: "deleteTransaction" as const, clientTs: "2026-09-18T18:30:00.000Z", payload: { transactionId: txId } };
    expect((await applyCommand(s, gone)).status).toBe("applied");
    expect(await s.getTransaction(userId, txId)).toBeNull();
    expect((await s.getAccount(userId, accountId))!.currentBalance).toBe(before + 30000);
```

- [ ] **Step 2: Run against zeta-dev**

Run: `set -a; source .env.v2-dev; set +a; cd webapp && npx vitest run src/lib/engine/__tests__/pg-integration.test.ts`
Expected: 4 passed. (If the delete trigger rejects, stop and report: the view's INSTEAD OF DELETE is `20260806150000_add_flow_class_to_transactions.sql:631`.)

- [ ] **Step 3: Commit**

```bash
git add webapp/src/lib/engine/__tests__/pg-integration.test.ts
git commit -m "test(engine): edit and delete a manual entry on zeta-dev's real schema"
```

---

### Task 5: Phone — Toast and Detalle design A

**Files:**
- Create: `mobile/v2/components/Toast.tsx`
- Modify (rewrite): `mobile/v2/components/DetalleSheet.tsx`

**Interfaces:**
- Consumes: `DetalleView`, `DetalleSource` (Task 3); `Sheet` (`mobile/v2/components/Sheet.tsx`); `useMotionMs` (`Collapse.tsx`).
- Produces:

```ts
export function Toast(props: { message: string | null; action?: { label: string; onPress: () => void }; onHide: () => void }): JSX.Element | null;
export function DetalleSheet(props: {
  detalle: DetalleView | null;
  onClose: () => void;
  onNote: (notes: string | null) => void;
  /** Bank: ignore / count again. Manual: delete (the screen shows Deshacer). */
  onNotAMovement: () => void;
  onCountAgain: () => void;
  onFix: (fix: { amount?: number; date?: string }) => void;
}): JSX.Element;
```

- [ ] **Step 1: Create `Toast.tsx`**

```tsx
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useV2Theme } from "../theme/ThemeProvider";
import { useMotionMs } from "./Collapse";

/** How long a Deshacer stays (D15). */
export const TOAST_MS = 5000;

/** A short message at the bottom with an optional action ("Deshacer"); hides itself after 5 s. */
export function Toast({ message, action, onHide }: {
  message: string | null;
  action?: { label: string; onPress: () => void };
  onHide: () => void;
}) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const duration = useMotionMs(180);
  const hide = useRef(onHide);
  hide.current = onHide;
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => hide.current(), TOAST_MS);
    return () => clearTimeout(id);
  }, [message]);
  const fade = useAnimatedStyle(() => ({ opacity: withTiming(message ? 1 : 0, { duration }) }), [message, duration]);
  if (!message) return null;
  return (
    <Animated.View
      style={[styles.toast, { backgroundColor: t.colors.button, bottom: insets.bottom + 20 }, fade]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text style={[styles.text, { color: t.colors.onButton, fontFamily: t.fonts.uiMedium }]} numberOfLines={2}>{message}</Text>
      {action && (
        <Pressable onPress={() => { action.onPress(); onHide(); }} accessibilityRole="button" hitSlop={10}>
          <Text style={[styles.action, { color: t.colors.onButton, fontFamily: t.fonts.uiSemibold }]}>{action.label}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: { position: "absolute", left: 16, right: 16, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  text: { flex: 1, fontSize: 14 },
  action: { fontSize: 14, textDecorationLine: "underline" },
});
```

- [ ] **Step 2: Rewrite `DetalleSheet.tsx` to design A**

```tsx
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, FileText, Image as ImageIcon, Mail, Pencil, Smartphone, type LucideIcon } from "lucide-react-native";
import type { DetalleSource, DetalleView } from "@zeta/shared";
import { useV2Theme } from "../theme/ThemeProvider";
import { Sheet } from "./Sheet";

const SOURCE_ICON: Record<DetalleSource, LucideIcon> = {
  manual: Pencil, email: Mail, notification: Smartphone, pdf: FileText, screenshot: ImageIcon, other: FileText,
};
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Detalle, design A (spec §3): facts on top (amount, name, source as an icon,
 * status when it doesn't count), then the list (M1: Nota; Categoría,
 * Destinatario and Qué fue arrive in their slot later — no placeholders),
 * then "No es un movimiento" and Listo. A manual entry's amount and date are
 * fixed by tapping them. The account toggle lives in Mis cuentas (S8-4).
 */
export function DetalleSheet({ detalle, onClose, onNote, onNotAMovement, onCountAgain, onFix }: {
  detalle: DetalleView | null;
  onClose: () => void;
  onNote: (notes: string | null) => void;
  onNotAMovement: () => void;
  onCountAgain: () => void;
  onFix: (fix: { amount?: number; date?: string }) => void;
}) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const last = useRef<DetalleView | null>(null);
  if (detalle) last.current = detalle;
  const d = detalle ?? last.current;

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const noteOpenRef = useRef(false);
  const [fixing, setFixing] = useState(false);
  const [amountDraft, setAmountDraft] = useState("");
  const [dateDraft, setDateDraft] = useState<Date>(new Date());
  useEffect(() => {
    setNoteOpen(false); noteOpenRef.current = false; setFixing(false);
  }, [detalle?.id]);

  const saveNote = () => {
    if (!noteOpenRef.current || !d) return;
    noteOpenRef.current = false;
    setNoteOpen(false);
    const next = noteDraft.trim() || null;
    if (next !== d.note) onNote(next);
  };
  const close = () => { saveNote(); onClose(); };
  const startFix = () => {
    if (!d?.manual) return;
    setAmountDraft(String(d.raw.amount));
    setDateDraft(new Date(`${d.raw.date}T12:00:00`));
    setFixing(true);
  };
  const saveFix = () => {
    if (!d) return;
    const amount = Number(amountDraft.replace(/[^\d]/g, ""));
    const date = toIso(dateDraft);
    const fix: { amount?: number; date?: string } = {};
    if (amount > 0 && amount !== d.raw.amount) fix.amount = amount;
    if (date !== d.raw.date) fix.date = date;
    setFixing(false);
    if (fix.amount !== undefined || fix.date !== undefined) onFix(fix);
  };

  const Icon = d ? SOURCE_ICON[d.source] : Pencil;
  return (
    <Sheet open={!!detalle} onClose={close} style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
      {d && (
        <>
          <View style={[styles.handle, { backgroundColor: t.colors.control }]} />
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled" bounces={false}>
            <Pressable
              onPress={startFix}
              disabled={!d.manual}
              accessibilityRole={d.manual ? "button" : undefined}
              accessibilityLabel={`${d.title}, ${d.amount.replace(/−/g, "menos ").replace(/^\+/, "más ")}, ${d.facts}`}
              accessibilityHint={d.manual ? "Corrige el monto o la fecha" : undefined}
              style={styles.hero}
            >
              <Text style={[styles.amount, { color: t.colors.ink, fontFamily: t.fonts.numberSemibold }]}>{d.amount}</Text>
              <Text style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]} numberOfLines={1}>{d.title}</Text>
              <View style={styles.facts}>
                <Icon size={14} color={t.colors.muted} strokeWidth={2} />
                <Text style={[styles.factsText, { color: t.colors.muted, fontFamily: t.fonts.mono }]}>{d.facts}</Text>
              </View>
              {d.status && (
                <View style={[styles.pill, { backgroundColor: t.colors.sunk }]}>
                  <Text style={{ fontSize: 12, color: t.colors.muted, fontFamily: t.fonts.uiSemibold }}>{d.status}</Text>
                </View>
              )}
            </Pressable>

            {fixing && (
              <View style={[styles.fix, { backgroundColor: t.colors.sunk }]}>
                <Text style={[styles.fixLabel, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]}>Monto</Text>
                <TextInput
                  value={amountDraft}
                  onChangeText={setAmountDraft}
                  keyboardType="number-pad"
                  accessibilityLabel="Monto"
                  style={[styles.fixInput, { color: t.colors.ink, borderColor: t.colors.control, fontFamily: t.fonts.numberSemibold }]}
                />
                <Text style={[styles.fixLabel, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]}>Fecha</Text>
                <DateTimePicker
                  value={dateDraft}
                  mode="date"
                  display={Platform.OS === "ios" ? "compact" : "default"}
                  maximumDate={new Date()}
                  onChange={(_e, v) => v && setDateDraft(v)}
                  accessibilityLabel="Fecha"
                />
                <Pressable onPress={saveFix} accessibilityRole="button" style={[styles.primaryM, { backgroundColor: t.colors.button }]}>
                  <Text style={{ fontSize: 14, color: t.colors.onButton, fontFamily: t.fonts.uiSemibold }}>Guardar cambios</Text>
                </Pressable>
              </View>
            )}

            <View style={[styles.list, { borderColor: t.colors.line }]}>
              <View style={styles.row}>
                <Text style={[styles.rowKey, { color: t.colors.muted, fontFamily: t.fonts.uiMedium }]}>Nota</Text>
                {noteOpen ? (
                  <TextInput
                    value={noteDraft}
                    onChangeText={setNoteDraft}
                    onSubmitEditing={saveNote}
                    onBlur={saveNote}
                    autoFocus
                    maxLength={500}
                    returnKeyType="done"
                    placeholder="Escribe una nota"
                    placeholderTextColor={t.colors.muted}
                    accessibilityLabel="Nota"
                    style={[styles.noteInput, { color: t.colors.ink, borderColor: t.colors.control, fontFamily: t.fonts.uiSemibold }]}
                  />
                ) : (
                  <Pressable
                    onPress={() => { setNoteDraft(d.note ?? ""); noteOpenRef.current = true; setNoteOpen(true); }}
                    accessibilityRole="button"
                    accessibilityLabel={d.note ? `Nota: ${d.note}. Editar` : "Agregar nota"}
                    style={styles.rowValue}
                  >
                    <Text style={{ fontSize: 14, color: d.note ? t.colors.ink : t.colors.muted, fontFamily: t.fonts.uiSemibold }} numberOfLines={1}>{d.note ?? "Agregar"}</Text>
                    <ChevronRight size={16} color={t.colors.control} />
                  </Pressable>
                )}
              </View>
            </View>
          </ScrollView>

          <Pressable
            onPress={d.excluded ? onCountAgain : onNotAMovement}
            accessibilityRole="button"
            accessibilityHint={d.excluded ? "Vuelve a contar este movimiento" : d.manual ? "Lo borra; puedes deshacerlo" : "Deja de contar; puedes deshacerlo"}
            hitSlop={8}
            style={styles.quiet}
          >
            <Text style={[styles.quietText, { color: t.colors.muted, fontFamily: t.fonts.uiSemibold }]}>
              {d.excluded ? "Contar de nuevo" : "No es un movimiento"}
            </Text>
          </Pressable>
          <Pressable onPress={close} accessibilityRole="button" style={[styles.done, { backgroundColor: t.colors.button }]}>
            <Text style={{ fontSize: 15, color: t.colors.onButton, fontFamily: t.fonts.uiSemibold }}>Listo</Text>
          </Pressable>
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: "92%", paddingTop: 8, paddingHorizontal: 20, gap: 12 },
  handle: { width: 38, height: 5, borderRadius: 3, alignSelf: "center" },
  body: { flexShrink: 1 },
  bodyContent: { gap: 14 },
  hero: { alignItems: "center", gap: 4, paddingTop: 4 },
  amount: { fontSize: 32, letterSpacing: -0.3, fontVariant: ["tabular-nums"] },
  title: { fontSize: 16 },
  facts: { flexDirection: "row", alignItems: "center", gap: 6 },
  factsText: { fontSize: 12 },
  pill: { marginTop: 6, height: 24, paddingHorizontal: 10, borderRadius: 99, justifyContent: "center" },
  fix: { borderRadius: 14, padding: 12, gap: 8 },
  fixLabel: { fontSize: 12 },
  fixInput: { height: 44, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, fontSize: 18 },
  primaryM: { height: 44, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 4 },
  list: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 50, paddingHorizontal: 14 },
  rowKey: { flex: 1, fontSize: 14 },
  rowValue: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "65%", minHeight: 44 },
  noteInput: { flex: 1.4, height: 44, borderWidth: 1.5, borderRadius: 9, paddingHorizontal: 10, fontSize: 14 },
  quiet: { alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  quietText: { fontSize: 14, textDecorationLine: "underline" },
  done: { height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
```

- [ ] **Step 3: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: errors only in `app/(v2)/movimientos.tsx` (old `DetalleSheet` props) — fixed in Task 6.

- [ ] **Step 4: Commit** (after Task 6 makes it compile; commit both together)

---

### Task 6: Phone — wire Detalle A, delete/ignore with Deshacer, fixes; drop the account toggle

**Files:**
- Modify: `mobile/app/(v2)/movimientos.tsx`

**Interfaces:**
- Consumes: `DetalleSheet`, `Toast` (Task 5); `DeleteTransactionPayload`, `EditTransactionPayload`, `CaptureManualTransactionPayload`, `SetTransactionExcludedPayload`, `SetTransactionNotePayload` from `@zeta/shared`.

- [ ] **Step 1: Replace the sheet wiring**

Remove `onAccountCounts` (the `Alert.alert(... "¿Quieres que esta cuenta …")` callback) and the `SetAccountCountsInDisponiblePayload` import. Add toast state and the handlers below; replace the `<DetalleSheet … />` element.

```tsx
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);

  const notAMovement = useCallback(async () => {
    const tx = openId ? data?.transactions.find((x) => x.id === openId) : undefined;
    if (!tx || !detalle) return;
    setOpenId(null);
    if (detalle.manual) {
      await run("deleteTransaction", { transactionId: tx.id } satisfies DeleteTransactionPayload);
      setToast({
        message: `Borrado · ${detalle.title} ${detalle.amount}`,
        undo: () => void run("captureManualTransaction", {
          transactionId: tx.id, accountId: tx.accountId, amount: tx.amount, direction: tx.direction,
          currencyCode: tx.currencyCode, date: tx.date, description: tx.description ?? detalle.title,
          notes: tx.notes ?? null, ...(tx.createdAt ? { capturedAt: tx.createdAt } : {}),
        } satisfies CaptureManualTransactionPayload),
      });
    } else {
      await run("setTransactionExcluded", { transactionId: tx.id, excluded: true } satisfies SetTransactionExcludedPayload);
      setToast({
        message: `Ignorado · ${detalle.title}`,
        undo: () => void run("setTransactionExcluded", { transactionId: tx.id, excluded: false } satisfies SetTransactionExcludedPayload),
      });
    }
  }, [openId, data, detalle, run]);
```

```tsx
      <DetalleSheet
        detalle={detalle}
        onClose={() => setOpenId(null)}
        onNote={(notes) => detalle && void run("setTransactionNote", { transactionId: detalle.id, notes } satisfies SetTransactionNotePayload)}
        onNotAMovement={() => void notAMovement()}
        onCountAgain={() => detalle && void run("setTransactionExcluded", { transactionId: detalle.id, excluded: false } satisfies SetTransactionExcludedPayload)}
        onFix={(fix) => detalle && void run("editTransaction", { transactionId: detalle.id, ...fix } satisfies EditTransactionPayload)}
      />
      <Toast
        message={toast?.message ?? null}
        action={toast?.undo ? { label: "Deshacer", onPress: toast.undo } : undefined}
        onHide={() => setToast(null)}
      />
```

Imports to add: `Toast` from `../../v2/components/Toast`; from `@zeta/shared`: `type CaptureManualTransactionPayload, type DeleteTransactionPayload, type EditTransactionPayload`. Keep `notAMovement` above the early `if (!view) return` (hooks first).

- [ ] **Step 2: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add mobile/v2/components/Toast.tsx mobile/v2/components/DetalleSheet.tsx "mobile/app/(v2)/movimientos.tsx"
git commit -m "feat(v2): Detalle design A — fix and delete manual entries with Deshacer; toggle moves to Mis cuentas"
```

---

### Task 7: Phone — the open row (only ⋯ in M1)

**Files:**
- Modify: `mobile/app/(v2)/movimientos.tsx` (`Row`, `DayGroup`, screen state)

**Interfaces:**
- Consumes: `Collapse`, `Dim` (`mobile/v2/components`).
- Produces: `Row` props `{ row, color, last, open: boolean, dimmed: boolean, onToggle: (id: string) => void, onMore: (id: string) => void }`.

- [ ] **Step 1: Screen state** — add `const [openRow, setOpenRow] = useState<string | null>(null);`, `const onToggle = useCallback((id: string) => setOpenRow((o) => (o === id ? null : id)), []);`, keep `onRow` as `onMore` (opens Detalle: `setOpenId`). Reset `openRow` when `index`, `filter` or `search` change (`useEffect(() => setOpenRow(null), [index, filter, search]);`). Pass `openRow` to `DayGroup` and from it to each `Row` as `open={openRow === r.id}` and `dimmed={openRow !== null && openRow !== r.id}`; add `openRow` to the `DayGroup` memo comparator (`p.openRow === n.openRow`).

- [ ] **Step 2: Row** — wrap the existing row content; tap toggles; the open part holds the ⋯ in its final position (right), left empty until M3:

```tsx
const Row = memo(function Row({ row: r, color, last, open, dimmed, onToggle, onMore }: {
  row: MovimientoRow; color: string; last: boolean; open: boolean; dimmed: boolean;
  onToggle: (id: string) => void; onMore: (id: string) => void;
}) {
  const t = useV2Theme();
  return (
    <Dim on={dimmed} style={!last && { borderBottomWidth: 1, borderBottomColor: t.colors.line }}>
      <Pressable
        onPress={() => onToggle(r.id)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={r.spoken}
        accessibilityHint={open ? "Cierra" : "Muestra las acciones"}
        style={styles.row}
      >
        {/* … existing avatar + rowBody unchanged … */}
      </Pressable>
      <Collapse open={open}>
        <View style={styles.actions}>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => onMore(r.id)}
            accessibilityRole="button"
            accessibilityLabel={`Ver detalle de ${r.title}`}
            style={[styles.more, { borderColor: t.colors.control }]}
          >
            <MoreHorizontal size={20} color={t.colors.ink} />
          </Pressable>
        </View>
      </Collapse>
    </Dim>
  );
}, (p, n) => sameRow(p.row, n.row) && p.color === n.color && p.last === n.last && p.open === n.open
  && p.dimmed === n.dimmed && p.onToggle === n.onToggle && p.onMore === n.onMore);
```

Styles: remove the border from `styles.row` (now on the `Dim`), add `actions: { flexDirection: "row", paddingBottom: 12 }`, `more: { width: 44, height: 44, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center" }`. Import `MoreHorizontal` from `lucide-react-native`, `Collapse` and `Dim` from `../../v2/components/…`. `?id=` still opens Detalle directly (deep link).

- [ ] **Step 3: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "mobile/app/(v2)/movimientos.tsx"
git commit -m "feat(v2): Movimientos rows open in place; ⋯ leads to Detalle (M1)"
```

---

### Task 8: Verify, review, ship to #445

- [ ] **Step 1: Simulator check** (Metro on `feat/v2-movimientos`; `xcrun simctl openurl booted "zeta:///movimientos"`; xcode MCP `DeviceInteractionSynthesize`):
  1. Tap a row → it opens with ⋯; other rows dim; tap again → closes.
  2. ⋯ → Detalle A: amount, name, "A mano · hoy …", Nota, "No es un movimiento", Listo; **no account toggle**.
  3. Tap the amount → fix block; change amount → Guardar cambios → amount and Disponible (Inicio) change by the difference.
  4. "No es un movimiento" (manual) → sheet closes, row gone, toast "Borrado · …"; Deshacer → row back **with its original time**.
  5. Record the close with `xcrun simctl io booted recordVideo` and check frames: the scrim fades in place.
- [ ] **Step 2: Gates** — `pnpm --filter @zeta/shared test`; `cd mobile && npx tsc --noEmit`; `pnpm build:web` (stop if :3000 has a dev server); zeta-dev test (Task 4); `git fetch origin main && git merge --no-commit --no-ff origin/main` then `git merge --abort`; `pnpm audit --audit-level high`.
- [ ] **Step 3: Reviews** — `mobile-sync-doctor` (two new commands, replay, balances), `zetas-front-guy` (DetalleSheet, Toast, open row vs `opciones.html` A and `botones.html`), `mobile-perf-doctor` (Row memo with open/dimmed, Collapse per row). Apply required findings; re-run gates.
- [ ] **Step 4: Push and update PR #445's description** (what changed vs the first version: design A, open row, fix/delete with Deshacer, toggle moved; checks run).

```bash
git push
gh pr edit 445 --body-file <updated description file>
```

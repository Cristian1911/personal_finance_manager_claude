---
# Personal Debts (F1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a destinatario-anchored "Personas" registry that tracks money the user borrowed (Debo) or lent (Me deben), excludes borrow/lend *origin* transactions from income/spend metrics, lets repayments be linked ad-hoc, and mirrors to mobile — all without complicating the existing destinatario or transaction model.

**Architecture:** A new plain `personal_debts` table (modeled on `subscriptions`) references the encrypted `destinatarios_enc` person anchor. Two plaintext passthrough columns (`personal_debt_id`, `pd_role`) are added to the encrypted `transactions` view via the 6-step `_enc` pattern, and a `kind` enum is added to `destinatarios` the same way. Pure decision logic (role inference, outstanding recompute, overdue, income-exclusion predicate) lives in `@zeta/shared` with vitest tests; server actions in `webapp/src/actions/personal-debts.ts` mirror the `subscriptions.ts` shape; a `/personas` page reuses the debt-card layout; mobile gets full sync parity.

**Tech Stack:** Next.js 15 (App Router, Server Actions, `"use cache"`), Supabase Postgres 17 (RLS + envelope encryption via `_enc` tables/views/INSTEAD OF triggers), TypeScript 5.9, `@zeta/shared` (vitest 4), Tailwind v4 + shadcn/ui (web), Expo + SQLite + NativeWind (mobile).

---

## File Structure

### Migrations (apply in this order)
- `supabase/migrations/<ts>_create_personal_debts.sql` — **CREATE** — enums (`personal_debt_direction`, `personal_debt_status`, `pd_role`), `personal_debts` table, RLS (4 per-op policies), indexes, moddatetime trigger, GRANTs.
- `supabase/migrations/<ts>_add_kind_to_destinatarios.sql` — **CREATE** — `destinatario_kind` enum + `kind` column on `destinatarios_enc` via the 6-step `_enc` pattern (view + 3 trigger fns + 3 triggers + GRANTs).
- `supabase/migrations/<ts>_add_transaction_personal_debt_link.sql` — **CREATE** — `personal_debt_id` + `pd_role` plaintext columns on `transactions_enc` via the 6-step `_enc` pattern (full current view + 3 trigger fns + 3 triggers + GRANTs + partial index).

### Types
- `webapp/src/types/database.ts` — **MODIFY** — regenerate; verify `personal_debts` Tables block, `destinatarios`/`destinatarios_enc` + `transactions`/`transactions_enc` gain new columns, new Enums present, `export type Json =` header intact.
- `webapp/src/types/domain.ts` — **MODIFY** — add `PersonalDebt`, `PersonalDebtDirection`, `PersonalDebtStatus`, `PdRole`, `PersonalDebtWithDetails`.

### Shared pure logic (vitest-tested)
- `packages/shared/src/utils/personal-debt.ts` — **CREATE** — `inferPersonalDebtRole`, `computeOutstanding`, `isPersonalDebtOverdue`, `isPersonalDebtOrigin`, string-literal-union types.
- `packages/shared/src/utils/__tests__/personal-debt.test.ts` — **CREATE** — vitest cases.
- `packages/shared/src/index.ts` — **MODIFY** — barrel `export * from "./utils/personal-debt";`.

### Web server layer
- `webapp/src/lib/validators/personal-debt.ts` — **CREATE** — Zod schemas (permissive UUID, `z.preprocess` empty→undefined).
- `webapp/src/actions/personal-debts.ts` — **CREATE** — CRUD + `recordRepayment` + link/unlink + `getPersonalDebtsOverview`.
- `webapp/src/actions/charts.ts` — **MODIFY** (query-level `.or()` at 4 sites: `getMonthlyCashflowCached` L174, `getDailySpendingCached` L240, `getMonthMetricsCached` L302, `getDailyCashflowCached` L354) — exclude `pd_role='origin'` rows.
- `webapp/src/actions/income.ts` — **MODIFY** (`getEstimatedIncomeCached` query L110-122, after `.gte` at L120) — exclude origin rows.
- `webapp/src/lib/cache/revalidation.ts` — **MODIFY** (L47-62 `revalidateAllUserData`) — clear `personal-debts` on full reset.

### Web UI
- `webapp/src/components/personas/persona-card.tsx` — **CREATE** — per-person card (reuses Card/Badge/Progress; `"use client"`).
- `webapp/src/components/personas/personas-root.tsx` — **CREATE** — registry view: Resumen + Debo/Me deben sections + create flow.
- `webapp/src/components/personas/create-personal-debt-sheet.tsx` — **CREATE** — create flow (DestinatarioPicker `kind='person'` + form).
- `webapp/src/app/(dashboard)/personas/page.tsx` — **CREATE** — server page (Promise.all + ActionResult unwrap).
- `webapp/src/components/recurring/link-picker-sheet.tsx` — **REUSE (no change)** — generic candidate picker.
- `webapp/src/components/mobile/v2/movimientos/movimientos-transaction-row.tsx` — **MODIFY** (L55-85, L255-314) — add "Vincular a persona" button + second LinkPickerSheet.
- `webapp/src/lib/constants/navigation.ts` — **MODIFY** (L48-54) — add `{ title: "Personas", href: "/personas", icon: Users }`.

### Destinatario `kind` plumbing
- `webapp/src/lib/validators/destinatario.ts` — **MODIFY** (L4-17) — add `kind` enum.
- `webapp/src/actions/destinatarios.ts` — **MODIFY** (L116 embed, L124-136 loop, L387-405, L524-541) — thread `kind`, skip `kind='person'` in matcher rule build.
- `webapp/src/components/providers/app-data-provider.tsx` — **MODIFY** (L11-15) — add `kind` to `DestinatarioOption`.
- `webapp/src/app/(dashboard)/layout.tsx` — **MODIFY** (L80-82) — map `kind: d.kind`.
- `webapp/src/components/transactions/destinatario-picker.tsx` — **MODIFY** (L54-58, L80) — `kind` on local type + filter.
- `webapp/src/components/destinatarios/destinatario-zone-picker.tsx` — **MODIFY** (L33-37, L39-61, L118-121) — `kind` on local type + `kindFilter` prop + filter.
- `webapp/src/components/destinatarios/destinatario-list.tsx` — **MODIFY** (`DestinatarioCardItem` L40-50, `filtered` memo L132-174, card grid L408-410) — segregate Personas vs Comercios sections by `kind`.

### Mobile parity
- `mobile/lib/db/schema.ts` — **MODIFY** (append version 16; L180-191 add `kind TEXT`) — SQLite `personal_debts` table + `destinatarios.kind` + `transactions` new cols.
- `mobile/lib/sync/pull.ts` — **MODIFY** (L6-71) — register `personal_debts` in `SYNC_TABLES`, include `kind`/new tx cols.
- `mobile/lib/sync/push.ts` — **MODIFY** (L14-43) — add `personal_debts` to `SyncTableName` (mobile-writable).
- `mobile/lib/repositories/personal-debts.ts` — **CREATE** — read + write repo (mirrors full action chain).
- `mobile/app/personas.tsx` — **CREATE** — thin stack-route screen.
- `mobile/app/_layout.tsx` — **MODIFY** (near L358) — register `<Stack.Screen name="personas" ...>`.
- `mobile/app/(tabs)/menu.tsx` — **MODIFY** — add a `HubEntry` row linking to `/personas` (mobile has only 4 tab slots, so Personas lives in the "Más" menu, NOT in `mobile-nav.ts`).

---

## Task 1: Migration — `personal_debts` table + enums + RLS

**Files:**
- Create: `supabase/migrations/<ts>_create_personal_debts.sql`

This is the prerequisite for everything: Task 3's FK targets `personal_debts(id)`, and the domain/action layers reference its columns. Copy the structure of `supabase/migrations/20260527151641_create_subscriptions.sql` verbatim (BEGIN/COMMIT, moddatetime, RLS 4 policies, GRANTs) but with debt-specific enums/columns. There is **no** drift-guard trigger and **no** backfill (personal debts are not seeded from a category).

- [ ] **Step 1: Create the migration file** with this exact content (run `npx supabase migration new create_personal_debts` to get the timestamped filename, then write):

```sql
BEGIN;

-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE personal_debt_direction AS ENUM (
  'borrowed',  -- I borrowed money (Debo) — a liability
  'lent'       -- I lent money (Me deben) — an asset
);

CREATE TYPE personal_debt_status AS ENUM (
  'active',
  'settled',
  'cancelled'
);

-- pd_role lives here so Task 3 can reference it on transactions.
CREATE TYPE pd_role AS ENUM (
  'origin',     -- the inflow/outflow that created the debt (<=1 per debt)
  'repayment'   -- a payment toward the debt; counts as normal cashflow
);

-- ============================================================
-- Table (PLAIN — destinatario_id already points at the encrypted
-- destinatarios_enc, so the person identity is protected there)
-- ============================================================
CREATE TABLE public.personal_debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  destinatario_id uuid NOT NULL
    REFERENCES public.destinatarios_enc(id) ON DELETE RESTRICT,
  direction personal_debt_direction NOT NULL,
  principal_amount numeric NOT NULL,
  currency_code text NOT NULL DEFAULT 'COP',
  outstanding_amount numeric NOT NULL,
  opened_on date NOT NULL,
  due_date date,
  status personal_debt_status NOT NULL DEFAULT 'active',
  origin_transaction_id uuid,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.personal_debts IS
  'Person-to-person lend/borrow tracker. Destinatario-anchored (kind=person). outstanding_amount is maintained = principal - sum(linked repayments). Plain table; identity protected via destinatarios_enc FK.';

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_personal_debts_user_id ON public.personal_debts (user_id);
CREATE INDEX idx_personal_debts_destinatario_id ON public.personal_debts (destinatario_id);
CREATE INDEX idx_personal_debts_status ON public.personal_debts (status);
CREATE INDEX idx_personal_debts_origin_transaction_id
  ON public.personal_debts (origin_transaction_id)
  WHERE origin_transaction_id IS NOT NULL;

-- ============================================================
-- moddatetime trigger
-- ============================================================
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;
DROP TRIGGER IF EXISTS set_updated_at ON public.personal_debts;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.personal_debts
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime(updated_at);

-- ============================================================
-- RLS — 4 per-op policies, (select auth.uid()) = user_id
-- ============================================================
ALTER TABLE public.personal_debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personal_debts_select" ON public.personal_debts FOR SELECT
  USING ((select auth.uid()) = user_id);
CREATE POLICY "personal_debts_insert" ON public.personal_debts FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "personal_debts_update" ON public.personal_debts FOR UPDATE
  USING ((select auth.uid()) = user_id);
CREATE POLICY "personal_debts_delete" ON public.personal_debts FOR DELETE
  USING ((select auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_debts TO authenticated;
GRANT ALL ON public.personal_debts TO postgres, service_role;

COMMIT;
```

- [ ] **Step 2: Spawn the `supabase-migrator` review gate.** Pass the migration content and these constraints in the prompt: plain table, FK to `destinatarios_enc` (base table, NOT the view) `ON DELETE RESTRICT`, FK `user_id → auth.users(id)` (cannot FK to the `profiles` view), RLS `(select auth.uid()) = user_id` + defense-in-depth expected in app, no backfill, no drift-guard. Address any blocking findings.

- [ ] **Step 3: Apply to remote.** Run `npx supabase db push` and confirm it applies without error. Manual smoke: `INSERT` one row through PostgREST (or SQL editor) with a valid `destinatario_id`, `SELECT` it back, then delete it.

- [ ] **Step 4: Commit.**
```bash
git add supabase/migrations/*_create_personal_debts.sql
git commit -m "feat(personal-debts): add personal_debts table + enums + RLS

Plain table anchored to destinatarios_enc (FK ON DELETE RESTRICT).
Enums: personal_debt_direction, personal_debt_status, pd_role.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Migration — add `kind` to `destinatarios` (6-step `_enc`)

**Files:**
- Create: `supabase/migrations/<ts>_add_kind_to_destinatarios.sql`

Copy the 6-step skeleton from `20260417170859_add_destinatario_id_to_recurring_templates.sql`, substituting `destinatarios`/`destinatarios_enc`, and copy the **exact** trigger bodies from `20260408143004_encrypt_destinatarios.sql`. `kind` is **non-PII → plain passthrough** (no `zeta_decrypt`, no hmac). The destinatarios triggers do **NOT** use COALESCE — keep bodies minimal, only adding `kind`.

- [ ] **Step 1: Create the migration file** (`npx supabase migration new add_kind_to_destinatarios`) with this exact content:

```sql
BEGIN;

-- Step 0: enum
CREATE TYPE destinatario_kind AS ENUM ('merchant', 'person');

-- Step 1: add column to the _enc base table (plain, non-PII)
ALTER TABLE destinatarios_enc
  ADD COLUMN IF NOT EXISTS kind destinatario_kind NOT NULL DEFAULT 'merchant';

-- Step 2: drop the view + its INSTEAD OF triggers (CASCADE)
DROP VIEW IF EXISTS destinatarios CASCADE;

-- Step 3: recreate the decrypting view WITH kind as a PLAIN passthrough
CREATE VIEW destinatarios WITH (security_invoker = true) AS
SELECT
  created_at, default_category_id, id, is_active, kind,
  zeta_decrypt(name) AS name,
  name_hmac,
  zeta_decrypt(notes) AS notes,
  updated_at, user_id
FROM destinatarios_enc;

-- Step 4a: INSERT trigger fn (minimal — copy original, only add kind)
CREATE OR REPLACE FUNCTION destinatarios_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO destinatarios_enc (
    created_at, default_category_id, id, is_active, kind, name, name_hmac,
    notes, updated_at, user_id
  ) VALUES (
    NEW.created_at, NEW.default_category_id, NEW.id, NEW.is_active, NEW.kind,
    zeta_encrypt(NEW.name),
    zeta_hmac(NEW.name),
    zeta_encrypt(NEW.notes),
    NEW.updated_at, NEW.user_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4b: UPDATE trigger fn
CREATE OR REPLACE FUNCTION destinatarios_view_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE destinatarios_enc SET
    created_at = NEW.created_at,
    default_category_id = NEW.default_category_id,
    is_active = NEW.is_active,
    kind = NEW.kind,
    name = zeta_encrypt(NEW.name),
    name_hmac = zeta_hmac(NEW.name),
    notes = zeta_encrypt(NEW.notes),
    updated_at = NEW.updated_at,
    user_id = NEW.user_id
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4c: DELETE trigger fn (unchanged)
CREATE OR REPLACE FUNCTION destinatarios_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM destinatarios_enc WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Step 5: recreate the three INSTEAD OF triggers (dropped by the CASCADE)
CREATE TRIGGER destinatarios_view_insert_trg
  INSTEAD OF INSERT ON destinatarios
  FOR EACH ROW EXECUTE FUNCTION destinatarios_view_insert();
CREATE TRIGGER destinatarios_view_update_trg
  INSTEAD OF UPDATE ON destinatarios
  FOR EACH ROW EXECUTE FUNCTION destinatarios_view_update();
CREATE TRIGGER destinatarios_view_delete_trg
  INSTEAD OF DELETE ON destinatarios
  FOR EACH ROW EXECUTE FUNCTION destinatarios_view_delete();

-- Step 6: re-grant view permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON destinatarios TO authenticated;
GRANT ALL ON destinatarios TO postgres, service_role;

COMMIT;
```

- [ ] **Step 2: Spawn the `supabase-migrator` review gate.** Constraints in the prompt: `kind` is plain passthrough (NOT `zeta_decrypt`), `DROP VIEW ... CASCADE` is required (CREATE OR REPLACE VIEW can't insert a mid-list column), triggers must be recreated, no COALESCE in destinatarios bodies, `CREATE TYPE` is transaction-safe. Address blocking findings.

- [ ] **Step 3: Apply to remote.** `npx supabase db push`. Smoke: `SELECT id, name, kind FROM destinatarios LIMIT 1;` returns `kind='merchant'`; `UPDATE destinatarios SET kind='person' WHERE id='<one>';` then re-select to confirm the trigger wrote it.

- [ ] **Step 4: Commit.**
```bash
git add supabase/migrations/*_add_kind_to_destinatarios.sql
git commit -m "feat(personal-debts): add kind enum to destinatarios (6-step _enc)

merchant|person discriminator, default merchant. Plain passthrough
through the security_invoker view + INSTEAD OF triggers.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Migration — add `personal_debt_id` + `pd_role` to `transactions` (6-step `_enc`)

**Files:**
- Create: `supabase/migrations/<ts>_add_transaction_personal_debt_link.sql`

`transactions` is a VIEW over `transactions_enc`. Copy `20260525120000_add_transaction_title_locked.sql` (the **newest**, with the complete current view column list) as the verbatim skeleton. Both new columns are **non-PII → plaintext passthrough** (exactly like `title_locked`/`transfer_group_id`): no encrypt, no hmac, no `_old` routing in UPDATE. `personal_debts` must already exist (Task 1).

> **WARNING — verbatim column list:** The view's SELECT list MUST exactly match the latest migration's list or you silently drop columns. Copy lines 43-62 of `20260525120000` and append the two new columns. Do NOT copy the older `20260408143001` list (it is missing `location_id`, `transaction_time`, `transfer_group_id`, `title_locked`). Read `20260525120000_add_transaction_title_locked.sql` before writing this file and mirror its INSERT `has_auth`/COALESCE preamble and its UPDATE `SELECT * INTO _old` pattern unchanged for the encrypted columns.

- [ ] **Step 1: Read the skeleton.** Read `supabase/migrations/20260525120000_add_transaction_title_locked.sql` in full so you have the exact current view column list and the exact INSERT/UPDATE trigger bodies (encrypted-column `CASE WHEN has_auth ...` handling) in context.

- [ ] **Step 2: Create the migration file** (`npx supabase migration new add_transaction_personal_debt_link`). Mirror the skeleton exactly, with these specific deltas:

  - **Column adds** (after `BEGIN;`):
```sql
ALTER TABLE public.transactions_enc
  ADD COLUMN IF NOT EXISTS personal_debt_id UUID
    REFERENCES public.personal_debts(id) ON DELETE SET NULL;
ALTER TABLE public.transactions_enc
  ADD COLUMN IF NOT EXISTS pd_role pd_role;
CREATE INDEX IF NOT EXISTS idx_transactions_personal_debt
  ON public.transactions_enc (personal_debt_id)
  WHERE personal_debt_id IS NOT NULL;
```
  - **`DROP VIEW IF EXISTS public.transactions CASCADE;`** (unchanged from skeleton).
  - **`CREATE VIEW public.transactions ...`**: copy the full SELECT list from `20260525120000` and append `, personal_debt_id, pd_role` as PLAIN passthrough (NOT wrapped in `zeta_decrypt`), placed after `transfer_group_id`/before `updated_at, user_id` to keep ordering tidy.
  - **`transactions_view_insert()`**: copy verbatim. Both columns are nullable with no default, so add NO COALESCE line. Add `personal_debt_id, pd_role` to the `INSERT INTO public.transactions_enc (...)` column list and pass `NEW.personal_debt_id, NEW.pd_role` directly in `VALUES` (no encrypt).
  - **`transactions_view_update()`**: copy verbatim. Add `personal_debt_id = NEW.personal_debt_id, pd_role = NEW.pd_role` to the SET list as DIRECT passthrough — do NOT route through `_old`.
  - **`transactions_view_delete()`**: unchanged.
  - Recreate the 3 INSTEAD OF triggers + the 2 GRANT lines verbatim from the skeleton.
  - `COMMIT;`

- [ ] **Step 3: Spawn the `supabase-migrator` review gate.** Constraints: 6-step `_enc` add; both columns plaintext passthrough (no encrypt/hmac, not via `_old`); view column list must match the latest migration's full list; FK `personal_debt_id → personal_debts(id) ON DELETE SET NULL`; `has_auth` branching preserved for encrypted columns only. Address blocking findings.

- [ ] **Step 4: Apply to remote + smoke.** `npx supabase db push`. Smoke: `SELECT id, personal_debt_id, pd_role FROM transactions LIMIT 1;` returns both columns NULL; insert/update a row through the view setting `pd_role='repayment'` and confirm the trigger persisted it.

- [ ] **Step 5: Commit.**
```bash
git add supabase/migrations/*_add_transaction_personal_debt_link.sql
git commit -m "feat(personal-debts): add personal_debt_id + pd_role to transactions (6-step _enc)

Plaintext passthrough columns through transactions_enc view + INSTEAD OF
triggers. FK -> personal_debts ON DELETE SET NULL. Income-exclusion + repayment
linkage carrier.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Regenerate `database.ts` types + add domain types

**Files:**
- Modify: `webapp/src/types/database.ts`
- Modify: `webapp/src/types/domain.ts` (after the `Subscription*` block, ~L45-56)

This layer is **not** unit-tested; the gate is `pnpm build` (type-check) + verifying the regenerated file by inspection.

- [ ] **Step 1: Regenerate database types.**
```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp
npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > src/types/database.ts
```

- [ ] **Step 2: Verify the regen** (per the known CLI 2.90.0 bug that moves encrypted views to `Views` and breaks inserts). Confirm by reading the file:
  - `export type Json =` header is intact (top of file).
  - `personal_debts` exists under `Tables` with `Row`/`Insert`/`Update`.
  - `Enums` block contains `personal_debt_direction`, `personal_debt_status`, `pd_role`, `destinatario_kind`.
  - `destinatarios` AND `destinatarios_enc` Row/Insert/Update each have `kind`.
  - `transactions` AND `transactions_enc` Row/Insert/Update each have `personal_debt_id: string | null` and `pd_role: Database["public"]["Enums"]["pd_role"] | null`.
  - If the CLI dropped any encrypted-view column or moved a view out of `Tables`, hand-add the missing columns to keep `.insert()` typing working (per `feedback_supabase_type_gen_breakage`).

- [ ] **Step 3: Add domain types** to `webapp/src/types/domain.ts` immediately after the `SubscriptionWithDetails` block:
```ts
export type PersonalDebt = Tables<"personal_debts">;
export type PersonalDebtDirection = Enums<"personal_debt_direction">;
export type PersonalDebtStatus = Enums<"personal_debt_status">;
export type PdRole = Enums<"pd_role">;
export type DestinatarioKind = Enums<"destinatario_kind">;

/** Flattened shape returned by getPersonalDebtsCached (FK-joined destinatario). */
export type PersonalDebtWithDetails = PersonalDebt & {
  destinatario_name: string;
  destinatario_default_category_id: string | null;
  /** Sum of linked repayment transaction amounts (>= 0). */
  total_repaid: number;
  /** True when due_date is past and status is 'active'. */
  is_overdue: boolean;
};
```

- [ ] **Step 4: Build gate.**
```bash
cd /Users/cristian/Documents/developing/current-projects/zeta && pnpm build
```
Expected: clean build (no type errors). If the build fails on missing `personal_debts`/enum names, the regen in Step 2 dropped them — hand-fix and rebuild.

- [ ] **Step 5: Commit.**
```bash
git add webapp/src/types/database.ts webapp/src/types/domain.ts
git commit -m "feat(personal-debts): regen database types + add domain types

PersonalDebt, PersonalDebtDirection/Status, PdRole, DestinatarioKind,
PersonalDebtWithDetails.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Pure helpers in `@zeta/shared` (TDD)

**Files:**
- Create: `packages/shared/src/utils/personal-debt.ts`
- Test: `packages/shared/src/utils/__tests__/personal-debt.test.ts`
- Modify: `packages/shared/src/index.ts` (add barrel export)

This is the **real TDD** task. Four pure functions: `inferPersonalDebtRole` (the Vincular role table), `computeOutstanding` (principal − Σ repayments + status), `isPersonalDebtOverdue`, and `isPersonalDebtOrigin` (the single income-exclusion predicate reused by Task 8). String-literal-union types (no DB enum import — keep `@zeta/shared` framework-free). Test style mirrors `weekly-digest.test.ts` (pure in → object/value out, no mocks).

> **Test command (the suite is pre-existing RED on 2 unrelated files — gate on the specific new file):**
> `cd packages/shared && ./node_modules/.bin/vitest run src/utils/__tests__/personal-debt.test.ts`

- [ ] **Step 1: Write the failing test** at `packages/shared/src/utils/__tests__/personal-debt.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  inferPersonalDebtRole,
  computeOutstanding,
  isPersonalDebtOverdue,
  isPersonalDebtOrigin,
} from "../personal-debt";

describe("inferPersonalDebtRole", () => {
  it("borrowed + INFLOW = origin (loan received)", () => {
    expect(inferPersonalDebtRole("borrowed", "INFLOW")).toBe("origin");
  });
  it("borrowed + OUTFLOW = repayment", () => {
    expect(inferPersonalDebtRole("borrowed", "OUTFLOW")).toBe("repayment");
  });
  it("lent + OUTFLOW = origin (money I gave)", () => {
    expect(inferPersonalDebtRole("lent", "OUTFLOW")).toBe("origin");
  });
  it("lent + INFLOW = repayment", () => {
    expect(inferPersonalDebtRole("lent", "INFLOW")).toBe("repayment");
  });
});

describe("computeOutstanding", () => {
  it("subtracts the sum of repayments from principal", () => {
    const r = computeOutstanding(140_000, [40_000, 20_000]);
    expect(r.outstanding).toBe(80_000);
    expect(r.status).toBe("active");
  });
  it("clamps outstanding at zero and marks settled when fully repaid", () => {
    const r = computeOutstanding(100_000, [60_000, 50_000]);
    expect(r.outstanding).toBe(0);
    expect(r.status).toBe("settled");
  });
  it("treats exact payoff as settled", () => {
    const r = computeOutstanding(100_000, [100_000]);
    expect(r.outstanding).toBe(0);
    expect(r.status).toBe("settled");
  });
  it("handles no repayments", () => {
    const r = computeOutstanding(200_000, []);
    expect(r.outstanding).toBe(200_000);
    expect(r.status).toBe("active");
  });
});

describe("isPersonalDebtOverdue", () => {
  const today = "2026-06-03";
  it("is overdue when due_date is past and status is active", () => {
    expect(isPersonalDebtOverdue("2026-05-01", "active", today)).toBe(true);
  });
  it("is not overdue when there is no due_date", () => {
    expect(isPersonalDebtOverdue(null, "active", today)).toBe(false);
  });
  it("is not overdue when due_date is in the future", () => {
    expect(isPersonalDebtOverdue("2026-07-01", "active", today)).toBe(false);
  });
  it("is not overdue when settled even if past due", () => {
    expect(isPersonalDebtOverdue("2026-05-01", "settled", today)).toBe(false);
  });
  it("is not overdue on the due date itself", () => {
    expect(isPersonalDebtOverdue(today, "active", today)).toBe(false);
  });
});

describe("isPersonalDebtOrigin", () => {
  it("is true only when linked AND role is origin", () => {
    expect(isPersonalDebtOrigin({ personal_debt_id: "d1", pd_role: "origin" })).toBe(true);
  });
  it("is false for repayment rows (they count as normal cashflow)", () => {
    expect(isPersonalDebtOrigin({ personal_debt_id: "d1", pd_role: "repayment" })).toBe(false);
  });
  it("is false for unlinked transactions", () => {
    expect(isPersonalDebtOrigin({ personal_debt_id: null, pd_role: null })).toBe(false);
  });
  it("is false when role is null even if linked", () => {
    expect(isPersonalDebtOrigin({ personal_debt_id: "d1", pd_role: null })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails** (module does not exist yet):
```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/packages/shared && ./node_modules/.bin/vitest run src/utils/__tests__/personal-debt.test.ts
```
Expected: failure — `Cannot find module '../personal-debt'` (or all suites red).

- [ ] **Step 3: Write the minimal implementation** at `packages/shared/src/utils/personal-debt.ts`:
```ts
/**
 * Pure decision logic for the personal-debts (Personas) feature. Framework-free
 * so both webapp and mobile share one source of truth. String-literal unions
 * mirror the DB enums (personal_debt_direction, personal_debt_status, pd_role)
 * without importing generated types.
 */
export type PersonalDebtDirection = "borrowed" | "lent";
export type PersonalDebtStatus = "active" | "settled" | "cancelled";
export type PdRole = "origin" | "repayment";
export type TransactionDirection = "INFLOW" | "OUTFLOW";

/**
 * Auto-infer the pd_role when linking a transaction to a personal debt.
 * borrowed+INFLOW = origin (loan received), lent+OUTFLOW = origin (money given);
 * everything else is a repayment.
 */
export function inferPersonalDebtRole(
  debtDirection: PersonalDebtDirection,
  txDirection: TransactionDirection,
): PdRole {
  const isOrigin =
    (debtDirection === "borrowed" && txDirection === "INFLOW") ||
    (debtDirection === "lent" && txDirection === "OUTFLOW");
  return isOrigin ? "origin" : "repayment";
}

export interface OutstandingResult {
  outstanding: number;
  status: PersonalDebtStatus;
}

/**
 * outstanding = principal - sum(repayments), clamped at 0. Derives 'settled'
 * when outstanding reaches 0, else 'active'. (Cancelled is a manual lifecycle
 * action and is never inferred here.)
 */
export function computeOutstanding(
  principal: number,
  linkedRepayments: number[],
): OutstandingResult {
  const repaid = linkedRepayments.reduce((sum, n) => sum + n, 0);
  const outstanding = Math.max(0, principal - repaid);
  return { outstanding, status: outstanding <= 0 ? "settled" : "active" };
}

/**
 * A debt is overdue when it has a due_date strictly before today and is still
 * active. Compares ISO date strings (YYYY-MM-DD) lexicographically — safe and
 * avoids the new Date("YYYY-MM-DD") UTC-midnight footgun.
 */
export function isPersonalDebtOverdue(
  dueDate: string | null,
  status: PersonalDebtStatus,
  today: string,
): boolean {
  if (!dueDate || status !== "active") return false;
  return dueDate < today;
}

/**
 * The single income/spend-exclusion predicate, reused by every cashflow site.
 * A transaction is an "origin" (the cash that created the debt) only when it is
 * linked AND its role is 'origin'; repayments count as normal cashflow.
 */
export function isPersonalDebtOrigin(tx: {
  personal_debt_id: string | null;
  pd_role: PdRole | null;
}): boolean {
  return tx.personal_debt_id != null && tx.pd_role === "origin";
}
```

- [ ] **Step 4: Run the test to verify it passes:**
```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/packages/shared && ./node_modules/.bin/vitest run src/utils/__tests__/personal-debt.test.ts
```
Expected: all suites green (4 describe blocks pass).

- [ ] **Step 5: Add the barrel export** to `packages/shared/src/index.ts` (after L29 `export * from "./utils/weekly-digest";`):
```ts
export * from "./utils/personal-debt";
```

- [ ] **Step 6: Commit.**
```bash
git add packages/shared/src/utils/personal-debt.ts packages/shared/src/utils/__tests__/personal-debt.test.ts packages/shared/src/index.ts
git commit -m "feat(personal-debts): pure helpers in @zeta/shared (TDD)

inferPersonalDebtRole, computeOutstanding, isPersonalDebtOverdue,
isPersonalDebtOrigin. Vitest-tested, framework-free, barrel-exported.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Validators (`personal-debt.ts`)

**Files:**
- Create: `webapp/src/lib/validators/personal-debt.ts`

Copy `webapp/src/lib/validators/subscription.ts` shape: permissive `UUID` regex const (NOT `z.string().uuid()`), `z.preprocess` empty→undefined for every optional FormData field, date regex `/^\d{4}-\d{2}-\d{2}$/`. Validated by `pnpm build` (Task 7 imports them).

- [ ] **Step 1: Create the file** with this exact content:
```ts
import { z } from "zod";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const optionalDate = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().regex(DATE, "Fecha inválida").optional(),
);

const optionalText = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().max(500).optional(),
);

export const personalDebtIdSchema = z.string().regex(UUID, "ID inválido");

export const createPersonalDebtSchema = z.object({
  destinatario_id: z.string().regex(UUID, "Persona inválida"),
  direction: z.enum(["borrowed", "lent"]),
  principal_amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  currency_code: z.string().min(3).max(3).default("COP"),
  opened_on: z.string().regex(DATE, "Fecha de apertura inválida"),
  due_date: optionalDate,
  notes: optionalText,
  origin_transaction_id: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().regex(UUID).optional(),
  ),
});

export const updatePersonalDebtSchema = z.object({
  principal_amount: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().positive().optional(),
  ),
  due_date: optionalDate,
  notes: optionalText,
});

export const recordRepaymentSchema = z.object({
  amount: z.coerce.number().positive("El abono debe ser mayor a 0"),
  transaction_date: z.string().regex(DATE, "Fecha inválida"),
  account_id: z.string().regex(UUID, "Cuenta inválida"),
  notes: optionalText,
});
```

- [ ] **Step 2: Build gate** (the validators compile only once imported, but a type-check confirms the schemas are well-formed): defer the build to Task 7's gate. For now, lint-level sanity: confirm the file has no unused imports.

- [ ] **Step 3: Commit.**
```bash
git add webapp/src/lib/validators/personal-debt.ts
git commit -m "feat(personal-debts): Zod validators (permissive UUID, preprocess empty->undefined)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Server actions (`personal-debts.ts`)

**Files:**
- Create: `webapp/src/actions/personal-debts.ts`

Copy the head of `webapp/src/actions/subscriptions.ts` (the `"use server"` + import block + the `getXCached`/`getX` cached-read pattern with the FK `!fk_name` join hint). Mutations use defense-in-depth `.eq("user_id", user.id)` AND `.eq("id", id)`, return `ActionResult<T>`, call `revalidateFinancialViews()` (when income/balances are affected) + `updateTag("personal-debts")`. Reuse the Task 5 shared helpers. This layer is **not** unit-tested — the gate is `pnpm build` + the `server-action-reviewer` agent + manual verification.

> **Auth destructuring split (intentional):** `getAuthenticatedClient()` returns `{ supabase, user, accessToken }` (verified in `webapp/src/lib/supabase/auth.ts:109-148`). The cached read destructures `{ user, accessToken }` and builds its own `createCachedClient(accessToken)` inside the `"use cache"` function (encrypted columns return NULL through the admin client); the mutations destructure `{ supabase, user }` and use the request-scoped server client directly. This split is deliberate — do not "simplify" it to one shape.

> **Balance-parity (FIX):** `recordRepayment` inserts a transaction, and the canonical insert path `persistTransaction` in `transactions.ts:367-424` ALWAYS follows its insert with `adjustBalancesForTransactionChanges()` (transactions.ts:412), which applies `applyAccountBalanceDelta()` per change. `persistTransaction` is **not reusable as-is** here: it is a private (non-exported) helper, its `PersistTransactionParams` type (transactions.ts:31-48) has no `personal_debt_id`/`pd_role` fields, and it recomputes its own idempotency key. So `recordRepayment` mirrors the side-effect inline using the SAME shared `applyAccountBalanceDelta` helper (re-exported from `@/lib/utils/account-balance`) — load the account, apply the delta, persist the new balance — exactly as `adjustBalancesForTransactionChanges` does (transactions.ts:142-171). Skipping this would log a repayment that never moves the balance, violating the "mirror the full webapp server-action side-effect chain" rule.

> **Cache rule:** mutations use `updateTag("personal-debts")` from `next/cache` (immediate read-your-own-writes), NEVER `revalidateTag`. `revalidateFinancialViews()` is called ONLY on actions that change whether a transaction counts as income (link/unlink an origin, `recordRepayment`) so the dashboard hero/cashflow correct immediately.

- [ ] **Step 1: Create the file** with this content:
```ts
"use server";
import { cacheTag, cacheLife, updateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import {
  personalDebtIdSchema,
  createPersonalDebtSchema,
  updatePersonalDebtSchema,
  recordRepaymentSchema,
} from "@/lib/validators/personal-debt";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import { applyAccountBalanceDelta } from "@/lib/utils/account-balance";
import {
  inferPersonalDebtRole,
  computeOutstanding,
  isPersonalDebtOverdue,
} from "@zeta/shared";
import { toColombiaDateString } from "@/lib/utils/date";
import type { ActionResult } from "@/types/actions";
import type {
  PersonalDebtWithDetails,
  PersonalDebtDirection,
} from "@/types/domain";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================
// Cached read
// ============================================================
async function getPersonalDebtsCached(
  accessToken: string,
  userId: string,
): Promise<PersonalDebtWithDetails[]> {
  "use cache";
  cacheTag("personal-debts");
  cacheLife("zeta");
  const supabase = createCachedClient(accessToken);

  const { data, error } = await supabase
    .from("personal_debts")
    .select(`
      id, user_id, destinatario_id, direction, principal_amount,
      currency_code, outstanding_amount, opened_on, due_date, status,
      origin_transaction_id, notes, is_demo, created_at, updated_at,
      destinatario:destinatarios!personal_debts_destinatario_id_fkey ( name, default_category_id ),
      repayments:transactions!transactions_enc_personal_debt_id_fkey ( amount, pd_role )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data) return [];

  const today = toColombiaDateString(new Date());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => {
    const repayments: number[] = (row.repayments ?? [])
      .filter((t: any) => t.pd_role === "repayment")
      .map((t: any) => t.amount as number);
    const total_repaid = repayments.reduce((s: number, n: number) => s + n, 0);
    return {
      ...row,
      destinatario_name: row.destinatario?.name ?? "—",
      destinatario_default_category_id: row.destinatario?.default_category_id ?? null,
      total_repaid,
      is_overdue: isPersonalDebtOverdue(row.due_date, row.status, today),
    };
  }) as PersonalDebtWithDetails[];
}

export async function getPersonalDebts(): Promise<ActionResult<PersonalDebtWithDetails[]>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const data = await getPersonalDebtsCached(accessToken, user.id);
    return { success: true, data };
  } catch {
    return { success: false, error: "Error al cargar las personas" };
  }
}

// ============================================================
// Overview (Resumen)
// ============================================================
export interface PersonalDebtsOverview {
  iOwe: { total: number; byPerson: { destinatario_name: string; amount: number; currency_code: string }[] };
  owedToMe: { total: number; byPerson: { destinatario_name: string; amount: number; currency_code: string }[] };
  overdue: { destinatario_name: string; amount: number; due_date: string }[];
}

export async function getPersonalDebtsOverview(): Promise<ActionResult<PersonalDebtsOverview>> {
  const res = await getPersonalDebts();
  if (!res.success) return res;
  const active = res.data.filter((d) => d.status === "active");
  const iOwe = active.filter((d) => d.direction === "borrowed");
  const owedToMe = active.filter((d) => d.direction === "lent");
  const sum = (xs: PersonalDebtWithDetails[]) =>
    xs.reduce((s, d) => s + d.outstanding_amount, 0);
  return {
    success: true,
    data: {
      iOwe: {
        total: sum(iOwe),
        byPerson: iOwe.map((d) => ({ destinatario_name: d.destinatario_name, amount: d.outstanding_amount, currency_code: d.currency_code })),
      },
      owedToMe: {
        total: sum(owedToMe),
        byPerson: owedToMe.map((d) => ({ destinatario_name: d.destinatario_name, amount: d.outstanding_amount, currency_code: d.currency_code })),
      },
      overdue: active
        .filter((d) => d.is_overdue)
        .map((d) => ({ destinatario_name: d.destinatario_name, amount: d.outstanding_amount, due_date: d.due_date! })),
    },
  };
}

// ============================================================
// Create
// ============================================================
export async function createPersonalDebt(
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = createPersonalDebtSchema.safeParse({
    destinatario_id: formData.get("destinatario_id"),
    direction: formData.get("direction"),
    principal_amount: formData.get("principal_amount"),
    currency_code: formData.get("currency_code") || "COP",
    opened_on: formData.get("opened_on"),
    due_date: formData.get("due_date") || undefined,
    notes: formData.get("notes") || undefined,
    origin_transaction_id: formData.get("origin_transaction_id") || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const p = parsed.data;

  const { data: debt, error } = await supabase
    .from("personal_debts")
    .insert({
      user_id: user.id,
      destinatario_id: p.destinatario_id,
      direction: p.direction,
      principal_amount: p.principal_amount,
      currency_code: p.currency_code,
      outstanding_amount: p.principal_amount,
      opened_on: p.opened_on,
      due_date: p.due_date ?? null,
      notes: p.notes ?? null,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !debt) return { success: false, error: "Error al crear la deuda" };

  // Optional: link the origin transaction.
  if (p.origin_transaction_id) {
    const linkRes = await linkTransactionToPersonalDebt(debt.id, p.origin_transaction_id);
    if (!linkRes.success) {
      // Debt is created; surface a soft error so the UI can retry the link.
      return { success: true, data: { id: debt.id } };
    }
  }

  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: { id: debt.id } };
}

// ============================================================
// Update
// ============================================================
export async function updatePersonalDebt(
  id: string,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  if (!personalDebtIdSchema.safeParse(id).success) {
    return { success: false, error: "ID inválido" };
  }
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = updatePersonalDebtSchema.safeParse({
    principal_amount: formData.get("principal_amount") || undefined,
    due_date: formData.get("due_date") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.principal_amount != null) patch.principal_amount = parsed.data.principal_amount;
  if (parsed.data.due_date != null) patch.due_date = parsed.data.due_date;
  if (parsed.data.notes != null) patch.notes = parsed.data.notes;

  const { error } = await supabase
    .from("personal_debts")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { success: false, error: "Error al actualizar la deuda" };

  updateTag("personal-debts");
  return { success: true, data: undefined };
}

// ============================================================
// Cancel / Settle
// ============================================================
export async function cancelPersonalDebt(id: string): Promise<ActionResult<undefined>> {
  if (!personalDebtIdSchema.safeParse(id).success) {
    return { success: false, error: "ID inválido" };
  }
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("personal_debts")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", ["active", "settled"])
    .select("id");
  if (error) return { success: false, error: "Error al cancelar la deuda" };
  if (!data || data.length === 0) return { success: false, error: "Deuda no encontrada" };

  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: undefined };
}

export async function settlePersonalDebt(id: string): Promise<ActionResult<undefined>> {
  if (!personalDebtIdSchema.safeParse(id).success) {
    return { success: false, error: "ID inválido" };
  }
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("personal_debts")
    .update({ status: "settled", outstanding_amount: 0 })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .select("id");
  if (error) return { success: false, error: "Error al saldar la deuda" };
  if (!data || data.length === 0) return { success: false, error: "Deuda no encontrada" };

  updateTag("personal-debts");
  return { success: true, data: undefined };
}

// ============================================================
// Link / Unlink existing transaction (the "Vincular a persona" path)
// Role is auto-inferred from debt.direction + tx.direction. <=1 origin per debt.
// ============================================================
export async function linkTransactionToPersonalDebt(
  personalDebtId: string,
  transactionId: string,
): Promise<ActionResult<undefined>> {
  if (!UUID_RE.test(personalDebtId) || !UUID_RE.test(transactionId)) {
    return { success: false, error: "ID inválido" };
  }
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: debt, error: debtErr } = await supabase
    .from("personal_debts")
    .select("id, direction, principal_amount, origin_transaction_id")
    .eq("id", personalDebtId)
    .eq("user_id", user.id)
    .single();
  if (debtErr || !debt) return { success: false, error: "Deuda no encontrada" };

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("id, direction, amount, personal_debt_id")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .single();
  if (txErr || !tx) return { success: false, error: "Transacción no encontrada" };
  if (tx.personal_debt_id) {
    return { success: false, error: "Esta transacción ya está vinculada a una persona." };
  }

  const role = inferPersonalDebtRole(
    debt.direction as PersonalDebtDirection,
    tx.direction as "INFLOW" | "OUTFLOW",
  );
  if (role === "origin" && debt.origin_transaction_id) {
    return { success: false, error: "Esta deuda ya tiene una transacción de origen." };
  }

  const { error: updErr } = await supabase
    .from("transactions")
    .update({ personal_debt_id: personalDebtId, pd_role: role })
    .eq("id", transactionId)
    .eq("user_id", user.id);
  if (updErr) return { success: false, error: "Error al vincular la transacción" };

  if (role === "origin") {
    await supabase
      .from("personal_debts")
      .update({ origin_transaction_id: transactionId })
      .eq("id", personalDebtId)
      .eq("user_id", user.id);
  } else {
    await recomputeOutstanding(supabase, user.id, personalDebtId, debt.principal_amount);
  }

  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: undefined };
}

export async function unlinkTransactionFromPersonalDebt(
  transactionId: string,
): Promise<ActionResult<undefined>> {
  if (!UUID_RE.test(transactionId)) return { success: false, error: "ID inválido" };
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("id, personal_debt_id, pd_role")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .single();
  if (txErr || !tx || !tx.personal_debt_id) {
    return { success: false, error: "Transacción no vinculada" };
  }
  const debtId = tx.personal_debt_id as string;
  const wasOrigin = tx.pd_role === "origin";

  const { error: updErr } = await supabase
    .from("transactions")
    .update({ personal_debt_id: null, pd_role: null })
    .eq("id", transactionId)
    .eq("user_id", user.id);
  if (updErr) return { success: false, error: "Error al desvincular la transacción" };

  const { data: debt } = await supabase
    .from("personal_debts")
    .select("principal_amount")
    .eq("id", debtId)
    .eq("user_id", user.id)
    .single();

  if (wasOrigin) {
    await supabase
      .from("personal_debts")
      .update({ origin_transaction_id: null })
      .eq("id", debtId)
      .eq("user_id", user.id);
  } else if (debt) {
    await recomputeOutstanding(supabase, user.id, debtId, debt.principal_amount);
  }

  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: undefined };
}

// ============================================================
// Record a repayment: creates a linked transaction + recomputes outstanding.
// ============================================================
export async function recordRepayment(
  personalDebtId: string,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  if (!personalDebtIdSchema.safeParse(personalDebtId).success) {
    return { success: false, error: "ID inválido" };
  }
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = recordRepaymentSchema.safeParse({
    amount: formData.get("amount"),
    transaction_date: formData.get("transaction_date"),
    account_id: formData.get("account_id"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const r = parsed.data;

  const { data: debt, error: debtErr } = await supabase
    .from("personal_debts")
    .select("id, direction, principal_amount, currency_code, destinatario_id")
    .eq("id", personalDebtId)
    .eq("user_id", user.id)
    .single();
  if (debtErr || !debt) return { success: false, error: "Deuda no encontrada" };

  // A repayment moves the opposite way to the origin: borrowed -> OUTFLOW, lent -> INFLOW.
  const direction: "INFLOW" | "OUTFLOW" = debt.direction === "borrowed" ? "OUTFLOW" : "INFLOW";
  const rawDescription = r.notes ?? "Abono persona";

  const idempotencyKey = await computeIdempotencyKey({
    provider: "MANUAL",
    transactionDate: r.transaction_date,
    amount: r.amount,
    rawDescription,
  });

  const { data: inserted, error: insErr } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      account_id: r.account_id,
      amount: r.amount,
      direction,
      currency_code: debt.currency_code,
      transaction_date: r.transaction_date,
      raw_description: rawDescription,
      destinatario_id: debt.destinatario_id,
      provider: "MANUAL",
      capture_method: "MANUAL_FORM",
      idempotency_key: idempotencyKey,
      personal_debt_id: personalDebtId,
      pd_role: "repayment",
    })
    .select("id, account_id, amount, direction, is_excluded")
    .single();
  if (insErr || !inserted) {
    if (insErr?.code === "23505") {
      return { success: false, error: "Este abono ya existe (duplicado)" };
    }
    return { success: false, error: "Error al registrar el abono" };
  }

  // Mirror the canonical insert path (persistTransaction →
  // adjustBalancesForTransactionChanges in transactions.ts): a logged repayment
  // MUST move the account balance, or the balance silently drifts. Apply the
  // delta with the SAME shared helper the transaction insert path uses.
  // applyAccountBalanceDelta is debt-account-aware: an INFLOW repayment into a
  // CREDIT_CARD/LOAN reduces the debt balance (a payment, not income), and a
  // normal OUTFLOW repayment from a CHECKING/SAVINGS account reduces cash — the
  // helper handles both via isDebtAccountType internally, so no extra branching
  // is needed here.
  if (!inserted.is_excluded) {
    const { data: acct, error: acctErr } = await supabase
      .from("accounts")
      .select("id, account_type, current_balance")
      .eq("id", inserted.account_id)
      .eq("user_id", user.id)
      .single();
    if (acctErr || !acct) {
      return { success: false, error: "Cuenta no encontrada para aplicar balance" };
    }
    const nextBalance = applyAccountBalanceDelta({
      currentBalance: acct.current_balance ?? 0,
      accountType: acct.account_type,
      direction: inserted.direction,
      amount: inserted.amount,
    });
    const { error: balErr } = await supabase
      .from("accounts")
      .update({ current_balance: nextBalance })
      .eq("id", acct.id)
      .eq("user_id", user.id);
    if (balErr) return { success: false, error: "Error al actualizar el saldo de la cuenta" };
  }

  await recomputeOutstanding(supabase, user.id, personalDebtId, debt.principal_amount);

  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: undefined };
}

// ============================================================
// Internal: recompute outstanding_amount + auto-settle.
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recomputeOutstanding(
  supabase: any,
  userId: string,
  personalDebtId: string,
  principal: number,
): Promise<void> {
  const { data: repayments } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("personal_debt_id", personalDebtId)
    .eq("pd_role", "repayment");
  const amounts: number[] = (repayments ?? []).map((t: { amount: number }) => t.amount);
  const { outstanding, status } = computeOutstanding(principal, amounts);
  await supabase
    .from("personal_debts")
    .update({ outstanding_amount: outstanding, status })
    .eq("id", personalDebtId)
    .eq("user_id", userId)
    .neq("status", "cancelled");
}
```

> **Note on the FK join hints (two distinct cases):**
> 1. **`repayments:transactions!transactions_enc_personal_debt_id_fkey`** — the FK is added on the `transactions_enc` BASE table in Task 3, so Postgres auto-names it `transactions_enc_personal_debt_id_fkey` (NOT `transactions_personal_debt_id_fkey`). The code block above already uses the correct name. The base table is `transactions_enc` even though we read through the `transactions` view, so the hint must reference the `_enc`-derived constraint name.
> 2. **`destinatario:destinatarios!personal_debts_destinatario_id_fkey`** — this FK lives on the PLAIN `personal_debts` table (Task 1), and Postgres names FKs after the *referencing* table + column, so `personal_debts_destinatario_id_fkey` is correct (matches the `subscriptions_destinatario_id_fkey` convention in `subscriptions.ts`, whose `subscriptions` table likewise references `destinatarios_enc`). The fact that the *referenced* base table is `destinatarios_enc` does NOT change the constraint name.
>
> Confirm the exact `transactions_enc` constraint name during Step 2 by querying `information_schema.table_constraints` and use that name in the hint. If PostgREST does not expose a join through the view for this FK, fall back to fetching repayments in a second `.eq("personal_debt_id", id).eq("pd_role","repayment")` query (the same shape `recomputeOutstanding` uses).

- [ ] **Step 2: Verify the FK constraint name.** Run against remote:
```bash
cd /Users/cristian/Documents/developing/current-projects/zeta && npx supabase db push --dry-run >/dev/null 2>&1; echo "use SQL editor for the next check"
```
Then in the Supabase SQL editor: `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'transactions_enc' AND constraint_type = 'FOREIGN KEY' AND constraint_name LIKE '%personal_debt%';`. The code block above already uses the expected default name `transactions_enc_personal_debt_id_fkey` (a verbatim copy works if the default holds) — only change the `!fk_name` hint if the query returns a different name. If no join through the view works, switch the cached read to the two-query fallback described above. (The `personal_debts!...!personal_debts_destinatario_id_fkey` hint needs no verification — it follows the referencing-table naming convention and is correct as written.)

- [ ] **Step 3: Build gate.**
```bash
cd /Users/cristian/Documents/developing/current-projects/zeta && pnpm build
```
Expected: clean. Fix any type errors (most likely: enum literal casts, the `supabase: any` in `recomputeOutstanding`).

- [ ] **Step 4: Spawn the `server-action-reviewer` review gate.** Pass the file. Constraints: `getAuthenticatedClient()` everywhere, defense-in-depth `.eq("user_id", user.id)` on every query, `updateTag("personal-debts")` (never `revalidateTag`), `revalidateFinancialViews()` only on income-affecting mutations (create-with-origin, cancel, link/unlink, recordRepayment), `23505` handling on the repayment insert, **`recordRepayment` applies the account-balance delta via `applyAccountBalanceDelta` after the insert (parity with `persistTransaction`/`adjustBalancesForTransactionChanges`)**, Spanish error strings. Address blocking findings.

- [ ] **Step 5: Commit.**
```bash
git add webapp/src/actions/personal-debts.ts
git commit -m "feat(personal-debts): server actions (CRUD + recordRepayment + link/unlink + overview)

Mirrors subscriptions.ts shape. Cached read with FK join hint, defense-in-depth
user_id filter, updateTag('personal-debts') + revalidateFinancialViews() on
income-affecting mutations. Reuses @zeta/shared helpers.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Income/spend exclusion at the cached sites

**Files:**
- Modify: `webapp/src/actions/charts.ts` — `getMonthlyCashflowCached` (query chain L163-174, last filter `.is("transfer_group_id", null)` at L174), `getDailySpendingCached` (query chain L228-240, last filter `.is("transfer_group_id", null)` at L240), `getMonthMetricsCached` (query chain L293-302, last filter `.is("transfer_group_id", null)` at L302), `getDailyCashflowCached` (query chain L344-354, last filter `.is("transfer_group_id", null)` at L354)
- Modify: `webapp/src/actions/income.ts` — `getEstimatedIncomeCached` query (L110-122, last filter before `.order` is `.gte("transaction_date", twelveMonthsAgo)` at L120)

**FIVE edit sites total** (4 in charts.ts + 1 in income.ts). Exclude `personal_debt_id IS NOT NULL AND pd_role='origin'` rows. Use the **query-level `.or()` filter** (preferred — avoids growing the explicit `.select()` lists and keeps the hot path index-friendly). The filter string is identical at every site: `.or("personal_debt_id.is.null,pd_role.neq.origin")` — this KEEPS rows that are either unlinked OR not the origin side. **Do NOT** use a bare `.neq("pd_role","origin")` — it drops NULL `pd_role` rows (Postgres NULL semantics), silently excluding every normal transaction. This layer is not unit-tested; gate is `pnpm build` + `perf-auditor` + manual.

> **Why `getDailySpendingCached` MUST be included:** a `lent` debt's origin is an **OUTFLOW** (money you gave). `getDailySpendingCached` aggregates all `direction='OUTFLOW'` rows for the daily-spending timeline (consumed by `ritmo.ts` and `dashboard/zones/mobile-zone.tsx`). Without the exclusion, lending someone money inflates your daily spending. This is the 4th charts.ts site the earlier draft missed.

> The pure predicate `isPersonalDebtOrigin` (Task 5) documents the exact semantics; these four sites apply it at the SQL layer for hot-path efficiency. Keep them identical so they never drift.

- [ ] **Step 1: Read the four charts.ts sites + the income.ts site** to confirm the exact query chains (`.is("transfer_group_id", null)` is the last filter before `.order` in the charts functions; `.gte("transaction_date", twelveMonthsAgo)` is the last filter before `.order` in income).

- [ ] **Step 2: Edit `getMonthlyCashflowCached`** (L163-174) — append the filter after `.is("transfer_group_id", null)` (L174). Before:
```ts
    .order("transaction_date")
    .is("reconciled_into_transaction_id", null)
    .is("transfer_group_id", null);
```
  After:
```ts
    .order("transaction_date")
    .is("reconciled_into_transaction_id", null)
    .is("transfer_group_id", null)
    .or("personal_debt_id.is.null,pd_role.neq.origin");
```

- [ ] **Step 3: Edit `getDailySpendingCached`** (L228-240) — this is the spend-timeline aggregator (filters `direction='OUTFLOW'`) that the earlier draft missed; a `lent`-debt origin OUTFLOW must be excluded. Before:
```ts
    .from("transactions")
    .select("transaction_date, amount")
    .eq("user_id", userId)
    .in("account_id", accountIds)
    .eq("direction", "OUTFLOW")
    .eq("is_excluded", false)
    .eq("currency_code", currency ?? "COP")
    .gte("transaction_date", monthStartStr(target))
    .lte("transaction_date", monthEndStr(target))
    .order("transaction_date")
    .is("reconciled_into_transaction_id", null)
    .is("transfer_group_id", null);
```
  After:
```ts
    .from("transactions")
    .select("transaction_date, amount")
    .eq("user_id", userId)
    .in("account_id", accountIds)
    .eq("direction", "OUTFLOW")
    .eq("is_excluded", false)
    .eq("currency_code", currency ?? "COP")
    .gte("transaction_date", monthStartStr(target))
    .lte("transaction_date", monthEndStr(target))
    .order("transaction_date")
    .is("reconciled_into_transaction_id", null)
    .is("transfer_group_id", null)
    .or("personal_debt_id.is.null,pd_role.neq.origin");
```
  (No `.select()` change is needed — the `.or()` filter references `personal_debt_id`/`pd_role` directly at the SQL layer without projecting them into the result set.)

- [ ] **Step 4: Edit `getMonthMetricsCached`** (L293-302) — append the same `.or(...)` after its `.is("transfer_group_id", null)` (L302).

- [ ] **Step 5: Edit `getDailyCashflowCached`** (L344-354) — append the same `.or(...)` after its `.is("transfer_group_id", null)` (L354).

- [ ] **Step 5b: Edit `getEstimatedIncomeCached`** (income.ts, L110-122) — append the filter after `.gte("transaction_date", twelveMonthsAgo)` (L120, before `.order`):
```ts
    .gte("transaction_date", twelveMonthsAgo)
    .or("personal_debt_id.is.null,pd_role.neq.origin")
    .order("transaction_date", { ascending: false })
    .limit(500);
```

- [ ] **Step 6: Confirm the recurring-template income branch needs no change.** Read `income.ts:77-103` (the second income source: recurring INFLOW templates from `recurring_transaction_templates`). Personal debts live on `personal_debts`, NOT as recurring templates, so this branch is unaffected — confirm there is no path where a personal-debt origin becomes a recurring INFLOW template. Document the confirmation in the commit message. (If such a path is later added, mirror the `isDebtAccountType` skip at income.ts:89-90.)

- [ ] **Step 7: Build gate.**
```bash
cd /Users/cristian/Documents/developing/current-projects/zeta && pnpm build
```
Expected: clean.

- [ ] **Step 8: Spawn the `server-action-reviewer` + `perf-auditor` review gates.** Constraints: all five filters identical; `.or()` not bare `.neq`; the partial index `idx_transactions_personal_debt` from Task 3 supports the filter; `getMonthMetricsCached` (feeds hero) + `getMonthlyCashflowCached` (feeds 6-month chart + net-worth history) are patched so origin inflows aren't double-counted as income, AND `getDailySpendingCached` (feeds `ritmo.ts` + `dashboard/zones/mobile-zone.tsx`) is patched so a `lent`-debt origin OUTFLOW doesn't inflate daily spending. Address findings.

- [ ] **Step 9: Manual verification.** With a test debt: create a `borrowed` personal_debt, link an INFLOW transaction as origin, then confirm the dashboard hero `monthlyIncome` does NOT include that inflow and the 6-month cashflow chart excludes it; link an OUTFLOW repayment and confirm it DOES count as a normal expense.

- [ ] **Step 10: Commit.**
```bash
git add webapp/src/actions/charts.ts webapp/src/actions/income.ts
git commit -m "feat(personal-debts): exclude debt-origin transactions from income/spend metrics

Adds .or('personal_debt_id.is.null,pd_role.neq.origin') at the 5 cached cashflow
sites (charts x4: monthly/dailySpending/monthMetrics/dailyCashflow + income x1).
Repayments still count as normal cashflow. Recurring-template income branch
confirmed unaffected.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Cache wiring (`personal-debts` tag in full-reset)

**Files:**
- Modify: `webapp/src/lib/cache/revalidation.ts` (`revalidateAllUserData`, ~L47-62)

The `personal-debts` tag is already created/used by Task 7 (`cacheTag` in the read, `updateTag` in mutations). Do NOT add it to `FINANCIAL_TAGS` (it is not transaction-driven). The only remaining wiring is to clear it on a full user-data reset. This layer is not unit-tested; gate is `pnpm build`.

- [ ] **Step 1: Read `revalidateAllUserData`** (~L47-62) to see the existing `updateTag(...)` list.

- [ ] **Step 2: Add the tag** inside `revalidateAllUserData`, alongside the other domain-extra `updateTag` calls:
```ts
  updateTag("personal-debts");
```

- [ ] **Step 3: Build gate.**
```bash
cd /Users/cristian/Documents/developing/current-projects/zeta && pnpm build
```
Expected: clean.

- [ ] **Step 4: Commit.**
```bash
git add webapp/src/lib/cache/revalidation.ts
git commit -m "feat(personal-debts): clear personal-debts cache tag on full user-data reset

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: `/personas` page + components

**Files:**
- Create: `webapp/src/components/personas/persona-card.tsx`
- Create: `webapp/src/components/personas/create-personal-debt-sheet.tsx`
- Create: `webapp/src/components/personas/personas-root.tsx`
- Create: `webapp/src/app/(dashboard)/personas/page.tsx`

Copy the `suscripciones/page.tsx` server-page shape (simpler single-domain) and the `debt-account-card.tsx` card layout. Card uses Card/CardHeader/CardContent/Badge/Progress + `formatCurrency`. The create flow uses `DestinatarioPicker` filtered to `kind='person'` (the `kind` plumbing lands in Task 12 — this task references the prop; if Task 12 is not yet merged, the picker shows all destinatarios harmlessly). No unit tests for TSX; gate is `pnpm build` + `zetas-front-guy` + manual.

> **UI rules:** no hardcoded colors (use `text-z-*`/`bg-z-*` tokens), `formatCurrency(amount, code)` for money, `formatDate()` for dates (never `new Date("YYYY-MM-DD")`), `MOBILE_TAB_BAR_CLEARANCE_CLASS` on the page scroll container, sheet content uses `MOBILE_SHEET_SAFE_AREA_CLASS`, button variants from `@/lib/constants/styles.ts`.

- [ ] **Step 1: Create `persona-card.tsx`** — `"use client"`, prop `{ persona: PersonalDebtWithDetails }`. Render: person name + initial avatar, outstanding (large, `formatCurrency`), a `Badge` for direction (Debo/Me deben) + an overdue badge when `persona.is_overdue` (token `text-z-danger`/`bg-z-danger-soft` or existing danger token from TOKENS.md). Expand reveals principal, `total_repaid`, opened/due dates (`formatDate`), and action buttons (Registrar abono, Saldar, Editar, Cancelar) that call the Task 7 actions inside `startTransition` + `toast`. Reuse `Card`, `Badge`, `Progress` from `@/components/ui/`. Progress = `total_repaid / principal_amount`.

- [ ] **Step 2: Create `create-personal-debt-sheet.tsx`** — `"use client"`, a `Sheet`/`Drawer` with `useActionState(createPersonalDebt, undefined)`. Fields: `DestinatarioPicker` (prop `kindFilter={["person"]}` once Task 12 lands; include inline "crear persona" via the picker's create-new affordance which creates a destinatario — pass `kind="person"` to that create path), direction radio (Debo/Me deben), principal amount, currency select, opened date, optional due date, notes. **Origin-linking in the create flow: include an optional hidden `origin_transaction_id` field** that `createPersonalDebt` consumes (the Task 7 action already links the origin when this is present — see its `if (p.origin_transaction_id) { ... linkTransactionToPersonalDebt(...) }` branch). When the sheet is opened from a specific transaction context (e.g. a future "crear deuda desde esta transacción" entry point), pass that tx id through this field so the debt's `origin_transaction_id` is set at creation. The **full candidate-picker** UX (browse/search existing transactions to pick the origin) stays in the **Vincular flow (Task 11)** — the create sheet only wires the simple pass-through field, it does NOT embed a `LinkPickerSheet`. On success: `toast.success`, close, `router.refresh()`.

- [ ] **Step 3: Create `personas-root.tsx`** — `"use client"`, props `{ debts: PersonalDebtWithDetails[]; overview: PersonalDebtsOverview; currency: CurrencyCode }`. Renders: Resumen row (Debo total · Me deben total · Neto), two columns (DEBO = `direction==='borrowed'`, ME DEBEN = `direction==='lent'`) each mapping `PersonaCard`, a `+ Nueva cuenta con persona` button opening the create sheet, and an empty state answering "¿quién me debe y a quién le debo?". Use the `grid gap-4 sm:grid-cols-2` card grid pattern.

- [ ] **Step 4: Create the page** at `webapp/src/app/(dashboard)/personas/page.tsx`:
```tsx
import { connection } from "next/server";
import { getPersonalDebts, getPersonalDebtsOverview } from "@/actions/personal-debts";
import { getPreferredCurrency } from "@/actions/profile";
import { PersonasRoot } from "@/components/personas/personas-root";
import { MOBILE_TAB_BAR_CLEARANCE_CLASS } from "@/lib/constants/styles";

export default async function PersonasPage() {
  await connection();
  const [debtsRes, overviewRes, currency] = await Promise.all([
    getPersonalDebts(),
    getPersonalDebtsOverview(),
    getPreferredCurrency(),
  ]);
  const debts = debtsRes.success ? debtsRes.data : [];
  const overview = overviewRes.success
    ? overviewRes.data
    : { iOwe: { total: 0, byPerson: [] }, owedToMe: { total: 0, byPerson: [] }, overdue: [] };
  return (
    <div className={`space-y-6 ${MOBILE_TAB_BAR_CLEARANCE_CLASS}`}>
      <h1 className="text-2xl font-semibold tracking-tight text-z-sage-light lg:text-3xl">
        Personas
      </h1>
      <PersonasRoot debts={debts} overview={overview} currency={currency} />
    </div>
  );
}
```
(Verified: `getPreferredCurrency` is exported from `@/actions/profile` — confirmed against `webapp/src/app/(dashboard)/suscripciones/page.tsx`, which imports `import { getPreferredCurrency } from "@/actions/profile";`. Do NOT use `@/actions/preferences`.)

- [ ] **Step 5: Build gate.**
```bash
cd /Users/cristian/Documents/developing/current-projects/zeta && pnpm build
```
Expected: clean.

- [ ] **Step 6: Spawn `zetas-front-guy` + `perf-auditor` review gates.** Constraints: design tokens only, no raw `pb-*` for tab clearance, `formatCurrency`/`formatDate` usage, safe-area handling, sheet z-index discipline, the page reads only via the cached actions (no uncached query in render). Address findings.

- [ ] **Step 7: Manual verification.** Visit `/personas`: empty state renders; create a Debo and a Me deben debt; both appear in the right columns; Resumen totals + Neto compute; overdue badge shows for a past-due active debt.

- [ ] **Step 8: Commit.**
```bash
git add webapp/src/components/personas/ "webapp/src/app/(dashboard)/personas/page.tsx"
git commit -m "feat(personas): /personas page + PersonaCard + create flow

Two-section registry (Debo / Me deben) reusing the debt-card layout, Resumen
totals, overdue flagging, create sheet with kind=person picker.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Expand the "Vincular" surface (tx → personal debt)

**Files:**
- Modify: `webapp/src/components/mobile/v2/movimientos/movimientos-transaction-row.tsx` (L55-85 handlers, L255-314 menu + sheets)
- Reuse: `webapp/src/components/recurring/link-picker-sheet.tsx` (no change)

Add a sibling "Vincular a persona" menu item next to the existing "Vincular" (tx → recurring occurrence). It opens a second `LinkPickerSheet` whose candidates are the user's active personal debts, and on confirm calls `linkTransactionToPersonalDebt(debtId, tx.id)` (role auto-inferred in the action). Keep the two link flows separate — they share only the `ActionResult` contract and the `LinkPickerSheet` UI. No unit tests for TSX; gate is `pnpm build` + `zetas-front-guy` + manual.

> **Gate predicate:** the new button is gated by its own predicate `!tx.personal_debt_id` (and tx not a transfer) — do NOT overload the existing `recurrence_group_id` gate.

- [ ] **Step 1: Add a candidate fetcher** — a small helper in `webapp/src/actions/personal-debts.ts` (or reuse `getPersonalDebts`): map active debts to `LinkCandidate[]` (`{ id, label: destinatario_name, sublabel: direction label, amount: outstanding_amount, currencyCode: currency_code, direction: borrowed?'OUTFLOW':'INFLOW', matchScore: 0 }`). For v1, fetch all active debts client-side from `getPersonalDebts()` and map — no new server action needed. If you add one, it goes through Task 7's review gate.

- [ ] **Step 2: Add state + handlers** in the row component (mirror the existing recurring-link state/handlers at L55-85). Add a `personaPickerOpen` state and a `personaCandidates` state, plus `handleOpenPersonaPicker` and `handleConfirmPersonaLink(debtId)`. **Reuse the existing `isLinking`/`startLinkTransition` transition** (declared at L59 as `const [isLinking, startLinkTransition] = useTransition();`) — do NOT introduce a separate pending var. In Step 3 the new button's `disabled` and the new sheet's `isPending` therefore bind to `isLinking` (not a new `isLinkPending`):
```ts
setPersonaPickerOpen(false);
startLinkTransition(async () => {
  const r = await linkTransactionToPersonalDebt(debtId, tx.id);
  if (r.success) toast.success("Transacción vinculada a persona");
  else toast.error(r.error ?? "No se pudo vincular");
});
```

- [ ] **Step 3: Add the menu item + second sheet** (mirror the existing "Vincular" button at L268-278 and the existing `LinkPickerSheet` at L292-314). Reuse the EXACT sibling class — the existing button uses `cn(MOBILE_ACTION_BUTTON_CLASS, "inline-flex items-center gap-1 rounded-full hover:bg-z-brass/12")` (`MOBILE_ACTION_BUTTON_CLASS` is already imported from `@/lib/constants/styles` at L16). Import `Users` from `lucide-react` (the file already imports `Link2`, `Repeat`, etc. from `lucide-react` at L8). Match the sibling's `type="button"` + `disabled` + `size-2.5` icon sizing:
```tsx
{!tx.personal_debt_id && (
  <button
    type="button"
    onClick={handleOpenPersonaPicker}
    disabled={isLinking}
    className={cn(MOBILE_ACTION_BUTTON_CLASS, "inline-flex items-center gap-1 rounded-full hover:bg-z-brass/12")}
  >
    <Users className="size-2.5" />
    Vincular a persona
  </button>
)}
{/* ...later, beside the existing LinkPickerSheet (after the L292-314 block)... */}
{personaPickerOpen && (
  <LinkPickerSheet
    open={personaPickerOpen}
    onOpenChange={setPersonaPickerOpen}
    title="Vincular a persona"
    subtitle={`${description} · ${formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}`}
    candidates={personaCandidates}
    onConfirm={handleConfirmPersonaLink}
    isPending={isLinking}
    onCreateNew={() => router.push("/personas")}
  />
)}
```

- [ ] **Step 4: Build gate.**
```bash
cd /Users/cristian/Documents/developing/current-projects/zeta && pnpm build
```
Expected: clean.

- [ ] **Step 5: Spawn `zetas-front-guy` review gate.** Constraints: separate gate predicate, reused `LinkPickerSheet`, toast strings in Spanish, no overload of `recurrence_group_id`. Address findings.

- [ ] **Step 6: Manual verification.** On a transaction row, open the menu → "Vincular a persona" → pick a debt → confirm. Reload `/personas` and verify outstanding recomputed (if repayment) or `origin_transaction_id` set (if origin), and that an origin-linked inflow disappears from income (ties to Task 8).

- [ ] **Step 7: Commit.**
```bash
git add webapp/src/components/mobile/v2/movimientos/movimientos-transaction-row.tsx webapp/src/actions/personal-debts.ts
git commit -m "feat(personal-debts): expand Vincular surface to link a tx to a person

Sibling 'Vincular a persona' menu item + LinkPickerSheet; role auto-inferred.
Separate !personal_debt_id gate.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Destinatario `kind` plumbing (web)

**Files:**
- Modify: `webapp/src/lib/validators/destinatario.ts` (L4-17)
- Modify: `webapp/src/actions/destinatarios.ts` (L116 embed, L124-136 loop, L387-392, L524-529)
- Modify: `webapp/src/components/providers/app-data-provider.tsx` (L11-15)
- Modify: `webapp/src/app/(dashboard)/layout.tsx` (L80-82)
- Modify: `webapp/src/components/transactions/destinatario-picker.tsx` (L54-58, L80)
- Modify: `webapp/src/components/destinatarios/destinatario-zone-picker.tsx` (L33-37, L39-61, L118-121)
- Modify: `webapp/src/components/destinatarios/destinatario-list.tsx` (management list — `DestinatarioCardItem` type L40-50, `filtered` memo L132-174, card grid render L408-410) — segregate Personas vs Comercios

Thread `kind` from DB → validator → action → context → pickers, and skip `kind='person'` in the import matcher's rule build (business policy in `fetchDestinatarioRules`, NOT in the shared matcher). No unit tests for these layers (the matcher skip lives in the server action, not shared); gate is `pnpm build` + `server-action-reviewer` + `zetas-front-guy`.

> **Note on the management-list data source:** `destinatario-list.tsx` is rendered by `webapp/src/app/(dashboard)/destinatarios/page.tsx`, which feeds it from `getDestinatariosWithSpend()`. That action must also project `kind` (add it to the select + the returned `DestinatarioCardItem`-shaped objects) so the list can split by it. If `getDestinatariosWithSpend` doesn't yet return `kind`, add it there as part of Step 6 (it lives in `webapp/src/actions/destinatarios.ts`, already in this task's Files list). Default missing/unknown `kind` to `'merchant'`.

- [ ] **Step 1: Validator** — add to `destinatarioSchema` (after `is_active`):
```ts
  kind: z.enum(["merchant", "person"]).default("merchant"),
```

- [ ] **Step 2: Action — thread kind in create/update safeParse inputs.** In `createDestinatario` (L387-392) add `kind: formData.get("kind") || undefined` to the safeParse object; same in `updateDestinatario` (L524-529). `...parsed.data` already spreads it into the insert/update.

- [ ] **Step 3: Action — matcher skip.** In `fetchDestinatarioRules` add `kind` to the embedded select (L116): `destinatarios!inner(name, default_category_id, is_active, kind)`, and skip person rows in the loop (L124-136): change `if (!dest || !dest.is_active) continue;` to `if (!dest || !dest.is_active || dest.kind === "person") continue;`.

- [ ] **Step 4: Context type + population.** In `app-data-provider.tsx` add `kind: DestinatarioKind` (import from `@/types/domain`) to `DestinatarioOption` (L11-15). In `layout.tsx` map `kind: d.kind` in the destinatarios `.map` (L80-82).

- [ ] **Step 5: Pickers.** In `destinatario-picker.tsx` add `kind` to the local `DestinatarioOption` (L54-58) and filter at L80: `destinatarios.filter((d) => d.is_active && (!kindFilter || kindFilter.includes(d.kind)))` with a new optional `kindFilter?: DestinatarioKind[]` prop. In `destinatario-zone-picker.tsx` add `kind` to local type (L33-37), add `kindFilter?: DestinatarioKind[]` to `DestinatarioZonePickerProps` (L39-61), and apply it in the `active` memo (L118-121). Both default to show-all so existing callers are unaffected; the Task 10 create sheet passes `kindFilter={["person"]}`.

- [ ] **Step 6: Destinatarios management list segregation** in `webapp/src/components/destinatarios/destinatario-list.tsx`. Three concrete edits:

  **6a — add `kind` to the item type** (L40-50). Before:
```ts
type DestinatarioCardItem = {
  id: string;
  name: string;
  default_category_id: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  rule_count: number;
  transaction_count: number;
  avg_monthly_spend?: number;
};
```
  After (add `kind`, import `DestinatarioKind` from `@/types/domain`):
```ts
type DestinatarioCardItem = {
  id: string;
  name: string;
  default_category_id: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  rule_count: number;
  transaction_count: number;
  avg_monthly_spend?: number;
  kind?: DestinatarioKind; // optional: defaults to 'merchant' when absent
};
```

  **6b — split the `filtered` memo result into two groups by `kind`** (the memo ends at L173-174). Replace the final `return` of the `filtered` memo:
```ts
    const active = items.filter((d) => d.is_active).sort(sortFn);
    const inactive = items.filter((d) => !d.is_active).sort(sortFn);
    return [...active, ...inactive];
  }, [destinatarios, search, sort, categoryFilter, categories]);
```
  with a version that partitions Personas vs Comercios (defaulting unknown `kind` to `'merchant'`):
```ts
    const active = items.filter((d) => d.is_active).sort(sortFn);
    const inactive = items.filter((d) => !d.is_active).sort(sortFn);
    const ordered = [...active, ...inactive];
    const isPerson = (d: DestinatarioCardItem) => d.kind === "person";
    return {
      personas: ordered.filter(isPerson),
      comercios: ordered.filter((d) => !isPerson(d)),
    };
  }, [destinatarios, search, sort, categoryFilter, categories]);
```

  **6c — render two sections** at the card-grid site (L408-410). The existing single grid maps `filtered.map(...)`. Replace it with two labeled sections, each mapping the corresponding group through the SAME existing card-render JSX (extract the per-card `(d) => { ... }` render into a local `renderCard` function or duplicate the existing block). Show the "Personas" section only when `filtered.personas.length > 0`, then "Comercios". Use existing section-heading tokens (e.g. `text-z-sage-light` / `text-muted-foreground`) — no new tokens. Each section keeps the existing `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3` wrapper. (Update any other `filtered.length`/`filtered.map` references in the component to use `filtered.comercios`/`filtered.personas` accordingly — e.g. the empty-state guard.)

- [ ] **Step 7: Build gate.**
```bash
cd /Users/cristian/Documents/developing/current-projects/zeta && pnpm build
```
Expected: clean.

- [ ] **Step 8: Spawn `server-action-reviewer` + `zetas-front-guy` review gates.** Constraints: kind threads via `...parsed.data`, matcher skip is in `fetchDestinatarioRules` (not the shared matcher), `DestinatarioOption` updated in all three definition sites, pickers default to show-all. Address findings.

- [ ] **Step 9: Manual verification.** Create a destinatario with `kind='person'`; confirm it appears in Personas (not Comercios) on the management page, appears in the create-personal-debt picker, and is NOT used to auto-match an imported merchant string.

- [ ] **Step 10: Commit.**
```bash
git add webapp/src/lib/validators/destinatario.ts webapp/src/actions/destinatarios.ts webapp/src/components/providers/app-data-provider.tsx "webapp/src/app/(dashboard)/layout.tsx" webapp/src/components/transactions/destinatario-picker.tsx webapp/src/components/destinatarios/destinatario-zone-picker.tsx webapp/src/components/destinatarios/destinatario-list.tsx
git commit -m "feat(destinatarios): thread kind (merchant|person) through validators, actions, pickers

useDestinatarios exposes kind; pickers gain kindFilter; import matcher skips
kind=person; management page segregates Personas/Comercios.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Web nav entry

**Files:**
- Modify: `webapp/src/lib/constants/navigation.ts` (L48-54)

Add `/personas` to `WORKSPACE_NAV`. `sidebar.tsx` + `mobile-nav.tsx` render the array automatically — no other web edits. Gate is `pnpm build`.

- [ ] **Step 1: Add the nav item.** In `WORKSPACE_NAV`, add (import `Users` from `lucide-react` at the top of the file):
```ts
  { title: "Personas", href: "/personas", icon: Users },
```

- [ ] **Step 2: Build gate.**
```bash
cd /Users/cristian/Documents/developing/current-projects/zeta && pnpm build
```
Expected: clean.

- [ ] **Step 3: Commit.**
```bash
git add webapp/src/lib/constants/navigation.ts
git commit -m "feat(personas): add Personas to workspace nav

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Mobile parity (SQLite schema + sync + repo + route)

**Files:**
- Modify: `mobile/lib/db/schema.ts` (append version 16; L180-191 add `kind TEXT` to destinatarios)
- Modify: `mobile/lib/sync/pull.ts` (L6-71)
- Modify: `mobile/lib/sync/push.ts` (L14-43)
- Create: `mobile/lib/repositories/personal-debts.ts`
- Create: `mobile/app/personas.tsx`
- Modify: `mobile/app/_layout.tsx` (near L358)
- Modify: `mobile/app/(tabs)/menu.tsx` (add a `HubEntry` row linking to `/personas`)

> **Why not `mobile/lib/constants/mobile-nav.ts`:** that file defines only the 4 bottom-tab slots + `FOCUS_MODE_PATHS` — it has no general menu/list array. Mobile has only 4 tab slots, so Personas is reached via the "Más" menu, which is a list of `HubEntry` rows in `mobile/app/(tabs)/menu.tsx`. The nav entry is therefore a `menu.tsx` edit (Step 7), NOT a `mobile-nav.ts` edit. Do not touch `mobile-nav.ts`.

New synced table `personal_debts` + the new `transactions`/`destinatarios` columns must mirror the Supabase view columns exactly or they silently drop every sync cycle. `personal_debts` is mobile-writable (the repo creates debts + repayments), so it goes in the push union too. No unit tests for mobile; gate is `pnpm build` (mobile) + `mobile-webapp-parity` + `mobile-sync-doctor`.

> **Schema rule:** append a NEW migration object (version 16) — never edit an existing version. `LATEST_DB_VERSION` auto-derives. Booleans → `INTEGER 0/1`, JSON → `TEXT`. Add `kind TEXT` and the two new `transactions` columns inside the SAME version-16 migration via `ALTER TABLE` statements (existing installs already have those tables).

- [ ] **Step 1: Append version 16 to `DB_MIGRATIONS`** (copy the version-15 subscriptions block as the template):
```ts
{
  version: 16,
  statements: [
    `CREATE TABLE IF NOT EXISTS personal_debts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      destinatario_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      principal_amount REAL NOT NULL,
      currency_code TEXT NOT NULL DEFAULT 'COP',
      outstanding_amount REAL NOT NULL,
      opened_on TEXT NOT NULL,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      origin_transaction_id TEXT,
      notes TEXT,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (destinatario_id) REFERENCES destinatarios(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_personal_debts_user_status ON personal_debts(user_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_personal_debts_destinatario ON personal_debts(destinatario_id)`,
    `ALTER TABLE destinatarios ADD COLUMN kind TEXT NOT NULL DEFAULT 'merchant'`,
    `ALTER TABLE transactions ADD COLUMN personal_debt_id TEXT`,
    `ALTER TABLE transactions ADD COLUMN pd_role TEXT`,
  ],
},
```
(If `ALTER TABLE ... ADD COLUMN` on an existing column would error on re-run, SQLite has no `IF NOT EXISTS` for columns — but migrations run once per version, so this is safe. Confirm the destinatarios/transactions `CREATE TABLE` in earlier versions did NOT already include these columns.)

- [ ] **Step 2: Register in pull.ts.** Add `"personal_debts"` to `SYNC_TABLES` AFTER `"destinatarios"` (FK ordering). Add boolean field mapping: `BOOLEAN_FIELDS["personal_debts"] = ["is_demo"]`. No JSON fields. `personal_debts` has `updated_at` so it is windowed/incremental like other tables — do NOT add to `FULL_REPLACE_TABLES`. The pull select for `transactions` must include the new `personal_debt_id, pd_role` columns and `destinatarios` must include `kind` (pull selects `*` per table or an explicit list — confirm and add the columns if explicit). `upsertRow` filters to local columns, so the version-16 columns must exist locally first (Step 1).

- [ ] **Step 3: Register in push.ts.** Add `| "personal_debts"` to the `SyncTableName` union (mobile creates debts + repayments). `personal_debts` has `updated_at`, so do NOT add it to `TABLES_WITHOUT_UPDATED_AT`.

- [ ] **Step 4: Create the repository** `mobile/lib/repositories/personal-debts.ts` — read (copy `subscriptions.ts`: `PersonalDebtRow` type + `getActivePersonalDebts()` with `getDatabase().getAllAsync` + LEFT JOIN destinatarios for `destinatario_name`) AND write (copy `destinatarios.ts` `createXWithPattern`: `Crypto.randomUUID()`, `db.withTransactionAsync` wrapping `db.runAsync` INSERT + `enqueueInsert(db, "personal_debts", id, payload, now)` from `../sync/queue`). Mirror the FULL action chain: `recordRepayment` must INSERT a transaction (with `enqueueInsert(db, "transactions", txId, payload, now)`) AND recompute+UPDATE `outstanding_amount`/`status` on `personal_debts` (with `enqueueUpdate(db, "personal_debts", id, patch, now)`) — reuse `computeOutstanding`/`inferPersonalDebtRole` from `@zeta/shared`.

  > **Mobile balance parity (FIX — mirror, do NOT invent a local balance write):** the webapp `recordRepayment` applies an account-balance delta because the webapp server action is the source of truth for `accounts.current_balance`. On mobile, the existing transaction-create path `createTransaction` (mobile/lib/repositories/transactions.ts:174-235) deliberately does **NOT** write `accounts.current_balance` locally — it only inserts the row + `queueInsertSync`, and the authoritative balance flows back down on the next Supabase pull (the only `UPDATE accounts ... current_balance` in mobile is the manual account-edit path in `accounts.ts:137`). So the mobile `recordRepayment` repayment-transaction insert must mirror `createTransaction` exactly (insert + enqueue, **no** local `current_balance` mutation). Adding a local balance write would double-apply once the server delta syncs down. The `outstanding_amount`/`status` recompute on `personal_debts` IS a local write (it has no separate server recompute), so that enqueue stays.

- [ ] **Step 5: Create the route** `mobile/app/personas.tsx` (thin screen rendering a `PersonasRoot` mobile component — copy `mobile/app/destinatarios.tsx` shape).

- [ ] **Step 6: Register the stack route** in `mobile/app/_layout.tsx` near L358:
```tsx
<Stack.Screen name="personas" options={{ presentation: "card", headerShown: false }} />
```

- [ ] **Step 7: Add a Menu entry** to reach `/personas` (mobile has only 4 tab slots, so it is NOT a tab). In `mobile/app/(tabs)/menu.tsx`, add a `HubEntry` row alongside the existing ones (Cuentas, Importar, Presupuestos, Suscripciones, Ajustes) — mirror the existing `HubEntry` shape and import `Users` from `lucide-react-native`:
```tsx
<HubEntry
  icon={Users}
  title="Personas"
  hint="Deudas con amigos y familia"
  onPress={() => router.push("/personas" as any)}
/>
```
  Do NOT add `/personas` to `FOCUS_MODE_PATHS` in `mobile/lib/constants/mobile-nav.ts` (it is an index page, not a single-task surface).

- [ ] **Step 8: Build gate (mobile).**
```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/mobile && npx tsc --noEmit
```
Expected: no type errors. (Mobile has no `pnpm build`; type-check is the compile gate.)

- [ ] **Step 9: Spawn `mobile-webapp-parity` + `mobile-sync-doctor` + `mobile-perf-doctor` review gates.** Constraints: SQLite columns mirror the Supabase `personal_debts` view exactly (column-drift footgun); `personal_debts` added to `SYNC_TABLES` after its FK target; `is_demo` in `BOOLEAN_FIELDS`; push union includes `personal_debts`; the repo mirrors the full action chain (repayment tx insert + `enqueueInsert` + outstanding recompute + `enqueueUpdate` + linking), not just the primary write; the repayment-tx insert mirrors `createTransaction` and does NOT write local `accounts.current_balance` (balance flows down from the server delta on next pull — a local write would double-apply); new `transactions`/`destinatarios` columns present in pull selects. Address findings.

- [ ] **Step 10: Manual verification.** Run the mobile app, confirm the DB migrates to version 16 without error, `/personas` renders, a debt created on web syncs down (pull) and a debt created on mobile syncs up (push) and appears on web.

- [ ] **Step 11: Commit.**
```bash
git add mobile/lib/db/schema.ts mobile/lib/sync/pull.ts mobile/lib/sync/push.ts mobile/lib/repositories/personal-debts.ts mobile/app/personas.tsx mobile/app/_layout.tsx "mobile/app/(tabs)/menu.tsx"
git commit -m "feat(personal-debts): mobile parity — synced table + repo + route

SQLite version 16 (personal_debts table + destinatarios.kind + transactions
personal_debt_id/pd_role). Pull/push registration, read+write repo mirroring the
full action chain, stack route + Menu entry.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Final verification + review-gate sweep

**Files:** none (verification only)

- [ ] **Step 1: Lockfile + full build.** No dependencies were added, so `pnpm install` should be a no-op, but run it to confirm the lockfile is in sync, then the full build:
```bash
cd /Users/cristian/Documents/developing/current-projects/zeta && pnpm install && pnpm build
```
Expected: `pnpm install` reports up-to-date (no lockfile change); `pnpm build` exits 0 with no type errors.

- [ ] **Step 2: Run the shared unit tests** (gate on the new file only — the suite has 2 pre-existing red files unrelated to this work):
```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/packages/shared && ./node_modules/.bin/vitest run src/utils/__tests__/personal-debt.test.ts
```
Expected: all `personal-debt.test.ts` cases green.

- [ ] **Step 3: Run the webapp unit tests** (path-scoped to `src/` to avoid the Playwright e2e collision):
```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/webapp && ./node_modules/.bin/vitest run src/
```
Expected: existing 81 tests still green (this plan added no webapp unit tests).

- [ ] **Step 4: Mobile type-check.**
```bash
cd /Users/cristian/Documents/developing/current-projects/zeta/mobile && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Confirm all review gates ran and passed.** Enumerate and verify each was spawned during its task and findings addressed:
  - `supabase-migrator` — Tasks 1, 2, 3 (the new table + the two 6-step `_enc` migrations).
  - `server-action-reviewer` — Tasks 7, 8, 12 (new action file, income-exclusion edits, destinatario action edits).
  - `perf-auditor` — Tasks 8, 10 (hot-path predicate + the new page).
  - `zetas-front-guy` — Tasks 10, 11, 12 (Personas page, Vincular surface, picker/management UI).
  - `mobile-webapp-parity` + `mobile-sync-doctor` — Task 14 (new synced table + push mutations + new columns).
  - `mobile-perf-doctor` — Task 14 (the Personas list screen).

- [ ] **Step 6: Dry-merge against main** (per project workflow, before any PR):
```bash
cd /Users/cristian/Documents/developing/current-projects/zeta && git fetch origin main && git merge --no-commit --no-ff origin/main; git merge --abort
```
Resolve any reported conflicts (most likely `webapp/src/types/database.ts`, `domain.ts`, `navigation.ts`, `packages/shared/src/index.ts`, mobile `schema.ts`) before opening the PR.

- [ ] **Step 7: Update BACKLOG.md** — mark the F1 Personal Debts line as shipped and note deferred items (installment repayment plans, overdue → dashboard Attention Items, multi-currency FX normalization) per spec section 6. Commit:
```bash
git add BACKLOG.md
git commit -m "docs(backlog): personal debts F1 shipped; record deferred follow-ups

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

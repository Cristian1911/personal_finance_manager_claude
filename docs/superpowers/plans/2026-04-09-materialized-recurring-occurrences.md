# Materialized Recurring Occurrences — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the computed-in-JS occurrence model with materialized DB rows (`recurring_occurrences`) that serve as the single source of truth for whether a recurring payment is pending, paid, or skipped — regardless of how the transaction was created.

**Architecture:** A new `recurring_occurrences` table stores one row per expected payment instance. Status flows: `pending` → `paid` (linked to transaction) or `skipped`. A generation function creates occurrences when a template is created/updated or when a new month begins. All transaction creation paths (FAB, email import, PDF import, recurring confirm) can link to an occurrence, which flips its status. The `obligation_skips` table and `getPaidOccurrenceKeys` hashing are retired — status lives on the occurrence row itself.

**Tech Stack:** Supabase (PostgreSQL 17), Next.js 15 Server Actions, `"use cache"` + `cacheTag`, `@zeta/shared` recurrence utils, Zod validation

---

## Current State (what we're replacing)

| Concept | Current Implementation | Problem |
|---|---|---|
| "Is this occurrence pending?" | Compute occurrences in JS via `getOccurrencesBetween()`, then check `getPaidOccurrenceKeys()` (SHA-256 hash match on `recurrence_group_id`) + `getSkippedObligationKeys()` (text key in `obligation_skips`) | 3 separate systems, only "Confirmar pago" links transactions |
| Skip tracking | `obligation_skips` table with text keys | Stringly-typed, no FK integrity |
| Paid tracking | Deterministic UUID hash → query transactions by `recurrence_group_id` | Only works for `recordRecurringOccurrencePayment`, not manual/import transactions |
| Transaction ↔ occurrence link | `recurrence_group_id` on transaction (set only by Confirmar pago) | FAB, email import, PDF import don't set it |

## Target State

| Concept | New Implementation |
|---|---|
| "Is this occurrence pending?" | `SELECT * FROM recurring_occurrences WHERE status = 'pending'` |
| Skip tracking | `UPDATE recurring_occurrences SET status = 'skipped'` |
| Paid tracking | `UPDATE recurring_occurrences SET status = 'paid', transaction_id = $1` |
| Transaction ↔ occurrence link | `recurring_occurrences.transaction_id` (FK to transactions) — set by ANY creation path |

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `supabase/migrations/XXXXXX_recurring_occurrences.sql` | Create table, enum, RLS, indexes |
| `webapp/src/actions/occurrences.ts` | Server actions: generate, mark paid, skip, query |
| `webapp/src/lib/utils/occurrence-generator.ts` | Pure function: template → occurrence rows for a date range |

### Modified Files
| File | Changes |
|---|---|
| `webapp/src/actions/recurring-templates.ts` | Remove `getPaidOccurrenceKeys`, `getSkippedOccurrenceKeys`, `getSkippedObligationKeys`, `skipObligation`, `skipRecurringOccurrence`, `computeRecurringGroupUuid`. CRUD ops call occurrence generator after template changes. `recordRecurringOccurrencePayment` → marks occurrence as paid instead of hash-based idempotency. |
| `webapp/src/actions/charts.ts` | `getDashboardHeroData` → query `recurring_occurrences WHERE status='pending'` instead of computing + filtering |
| `webapp/src/actions/attention-items.ts` | `getAttentionItemsCached` → query `recurring_occurrences WHERE status='pending'` directly instead of computing + filtering |
| `webapp/src/actions/transactions.ts` | `createTransaction` → accept optional `occurrence_id`, mark occurrence as paid |
| `webapp/src/actions/email-ingest.ts` | `approveEmailTransaction` → accept optional `occurrence_id`, mark occurrence as paid |
| `webapp/src/actions/import-transactions.ts` | `importTransactions` → match imported transactions to pending occurrences by account + date proximity, auto-link |
| `webapp/src/components/recurring/use-recurring-month.ts` | Rewrite: fetch occurrences from DB instead of computing in JS + hydrating from paid/skipped keys |
| `webapp/src/components/mobile/v2/plan/mobile-recurrentes-view.tsx` | Adapt to new hook API |
| `webapp/src/components/recurring/recurring-timeline-view.tsx` | Adapt to new hook API |
| `webapp/src/components/mobile/v2/inicio/inicio-attention.tsx` | Pagos section uses occurrence data directly |
| `webapp/src/types/domain.ts` | Add `RecurringOccurrence` type, update `UpcomingRecurrence` |
| `webapp/src/types/database.ts` | Add `recurring_occurrences` table types |
| `webapp/src/lib/cache/revalidation.ts` | Add `"occurrences"` to `revalidateFinancialViews()` |
| `packages/shared/src/utils/recurrence.ts` | Keep `getOccurrencesBetween` (used by generator), remove nothing |

### Files to Delete (after migration)
| File | Reason |
|---|---|
| `supabase/migrations/20260409170420_recurring_occurrence_skips.sql` | Superseded (keep file, add drop in new migration) |
| `supabase/migrations/20260409183754_obligation_skips.sql` | Superseded (keep file, add drop in new migration) |

---

## Task Breakdown

### Task 1: Migration — `recurring_occurrences` table

**Files:**
- Create: `supabase/migrations/XXXXXX_recurring_occurrences.sql`

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new recurring_occurrences
```

- [ ] **Step 2: Write the migration SQL**

```sql
-- Status enum for occurrence lifecycle
CREATE TYPE occurrence_status AS ENUM ('pending', 'paid', 'skipped');

-- Materialized recurring occurrences — one row per expected payment
CREATE TABLE recurring_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES recurring_transaction_templates_enc(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  expected_amount numeric(15,2) NOT NULL,
  status occurrence_status NOT NULL DEFAULT 'pending',
  transaction_id uuid REFERENCES transactions_enc(id) ON DELETE SET NULL,
  skipped_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Each template can have at most one occurrence per date
  UNIQUE(template_id, occurrence_date)
);

-- RLS
ALTER TABLE recurring_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own occurrences"
  ON recurring_occurrences
  FOR ALL
  USING ((select auth.uid()) = user_id);

-- Indexes for common queries
CREATE INDEX idx_recurring_occurrences_user_status 
  ON recurring_occurrences(user_id, status) 
  WHERE status = 'pending';

CREATE INDEX idx_recurring_occurrences_template 
  ON recurring_occurrences(template_id, occurrence_date);

CREATE INDEX idx_recurring_occurrences_transaction 
  ON recurring_occurrences(transaction_id) 
  WHERE transaction_id IS NOT NULL;

-- Migrate data from obligation_skips (recurring skips only)
-- This runs AFTER the table is created
INSERT INTO recurring_occurrences (user_id, template_id, occurrence_date, expected_amount, status, skipped_at)
SELECT 
  os.user_id,
  -- Extract template_id from "recurring:{uuid}:{date}" key
  (regexp_match(os.obligation_key, '^recurring:([0-9a-f-]+):'))[1]::uuid,
  -- Extract date from key
  (regexp_match(os.obligation_key, ':(\d{4}-\d{2}-\d{2})$'))[1]::date,
  -- Get amount from template (best effort, default 0 if template missing)
  COALESCE(t.amount, 0),
  'skipped',
  os.skipped_at
FROM obligation_skips os
LEFT JOIN recurring_transaction_templates_enc t 
  ON t.id = (regexp_match(os.obligation_key, '^recurring:([0-9a-f-]+):'))[1]::uuid
WHERE os.obligation_key LIKE 'recurring:%'
ON CONFLICT (template_id, occurrence_date) DO NOTHING;

-- Migrate paid occurrences: find transactions with recurrence_group_id
-- and create 'paid' occurrence rows for them
-- (We need to reverse the SHA-256 hash — we can't. Instead, we'll regenerate 
--  occurrences on first access. The generation function handles this.)

-- Drop old tables
DROP TABLE IF EXISTS obligation_skips;
-- Note: recurring_occurrence_skips was already dropped by the obligation_skips migration
```

- [ ] **Step 3: Push migration**

```bash
npx supabase db push
```

- [ ] **Step 4: Regenerate types**

```bash
npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > webapp/src/types/database.ts
```

Strip first line if it contains compdef warning. Verify `export type Json =` header.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/ webapp/src/types/database.ts
git commit -m "feat: add recurring_occurrences table with status lifecycle"
```

---

### Task 2: Occurrence generator — pure function

**Files:**
- Create: `webapp/src/lib/utils/occurrence-generator.ts`
- Modify: `packages/shared/src/utils/recurrence.ts` (read only, no changes)

The generator takes a template + date range and produces occurrence row data. This is a pure function — no DB access.

- [ ] **Step 1: Create the generator**

```typescript
// webapp/src/lib/utils/occurrence-generator.ts
import { getOccurrencesBetween } from "@zeta/shared";
import type { RecurringTemplate } from "@/types/domain";

export interface OccurrenceRow {
  template_id: string;
  user_id: string;
  occurrence_date: string; // YYYY-MM-DD
  expected_amount: number;
}

/**
 * Generate occurrence rows for a template within a date range.
 * Pure function — no DB access. Caller handles upsert.
 */
export function generateOccurrenceRows(
  template: Pick<RecurringTemplate, "id" | "user_id" | "amount" | "start_date" | "frequency" | "end_date" | "is_active">,
  rangeStart: Date,
  rangeEnd: Date,
): OccurrenceRow[] {
  if (!template.is_active) return [];

  const dates = getOccurrencesBetween(
    template.start_date,
    template.frequency,
    template.end_date,
    rangeStart,
    rangeEnd,
  );

  return dates.map((date) => ({
    template_id: template.id,
    user_id: template.user_id,
    occurrence_date: date,
    expected_amount: template.amount,
  }));
}

/**
 * Generate occurrence rows for multiple templates.
 */
export function generateOccurrenceRowsBatch(
  templates: Pick<RecurringTemplate, "id" | "user_id" | "amount" | "start_date" | "frequency" | "end_date" | "is_active">[],
  rangeStart: Date,
  rangeEnd: Date,
): OccurrenceRow[] {
  return templates.flatMap((t) => generateOccurrenceRows(t, rangeStart, rangeEnd));
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/lib/utils/occurrence-generator.ts
git commit -m "feat: add pure occurrence generator function"
```

---

### Task 3: Server actions — occurrence CRUD

**Files:**
- Create: `webapp/src/actions/occurrences.ts`

- [ ] **Step 1: Create the occurrences server action file**

```typescript
// webapp/src/actions/occurrences.ts
"use server";

import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import { generateOccurrenceRowsBatch } from "@/lib/utils/occurrence-generator";
import { addDays, startOfMonth, endOfMonth, addMonths } from "date-fns";
import type { ActionResult } from "@/types/actions";

// ─── Types ──────────────────────────────────────────────────────────────────

export type OccurrenceStatus = "pending" | "paid" | "skipped";

export interface RecurringOccurrence {
  id: string;
  template_id: string;
  occurrence_date: string;
  expected_amount: number;
  status: OccurrenceStatus;
  transaction_id: string | null;
  // Joined from template:
  merchant_name: string | null;
  description: string | null;
  direction: "INFLOW" | "OUTFLOW";
  currency_code: string;
  account_id: string;
  account_name: string;
  account_type: string;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  transfer_source_account_id: string | null;
}

// ─── Ensure occurrences exist (idempotent generation) ──────────────────────

/**
 * Ensure occurrences exist for all active templates in a date range.
 * Uses UPSERT — safe to call repeatedly. Only creates rows for dates 
 * that don't already have an occurrence (preserves existing status).
 */
export async function ensureOccurrencesForRange(
  rangeStart: Date,
  rangeEnd: Date,
): Promise<void> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return;

  // Fetch active templates (lightweight — just the fields we need for generation)
  const { data: templates } = await supabase
    .from("recurring_transaction_templates")
    .select("id, user_id, amount, start_date, frequency, end_date, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (!templates || templates.length === 0) return;

  const rows = generateOccurrenceRowsBatch(templates, rangeStart, rangeEnd);
  if (rows.length === 0) return;

  // Batch upsert — ON CONFLICT DO NOTHING preserves existing status
  await supabase
    .from("recurring_occurrences")
    .upsert(
      rows.map((r) => ({
        user_id: r.user_id,
        template_id: r.template_id,
        occurrence_date: r.occurrence_date,
        expected_amount: r.expected_amount,
        status: "pending" as const,
      })),
      { onConflict: "template_id,occurrence_date", ignoreDuplicates: true }
    );

  revalidateTag("occurrences", "zeta");
}

/**
 * Ensure occurrences exist for the current month + 14-day lookahead.
 * Called lazily on page load — idempotent.
 */
export async function ensureCurrentOccurrences(): Promise<void> {
  const now = new Date();
  const rangeStart = startOfMonth(now);
  const rangeEnd = addDays(endOfMonth(now), 14); // current month + 14d into next
  return ensureOccurrencesForRange(rangeStart, rangeEnd);
}

// ─── Query occurrences ──────────────────────────────────────────────────────

/**
 * Get occurrences for a month with template details joined.
 * Cached with "occurrences" tag.
 */
export async function getOccurrencesForMonth(
  month?: string, // YYYY-MM format, defaults to current
): Promise<RecurringOccurrence[]> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  return getOccurrencesForMonthCached(user.id, month, accessToken);
}

async function getOccurrencesForMonthCached(
  userId: string,
  month: string | undefined,
  accessToken: string,
): Promise<RecurringOccurrence[]> {
  "use cache";
  cacheTag("occurrences");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  
  const target = month 
    ? new Date(`${month}-01`) 
    : new Date();
  const start = startOfMonth(target).toISOString().slice(0, 10);
  const end = endOfMonth(target).toISOString().slice(0, 10);

  const { data } = await supabase
    .from("recurring_occurrences")
    .select(`
      id,
      template_id,
      occurrence_date,
      expected_amount,
      status,
      transaction_id,
      recurring_transaction_templates!inner (
        merchant_name,
        description,
        direction,
        currency_code,
        account_id,
        transfer_source_account_id,
        accounts!recurring_transaction_templates_account_id_fkey (
          name,
          account_type
        ),
        categories (
          name_es,
          icon,
          color
        )
      )
    `)
    .eq("user_id", userId)
    .gte("occurrence_date", start)
    .lte("occurrence_date", end)
    .order("occurrence_date", { ascending: true });

  if (!data) return [];

  return data.map((row) => {
    const t = row.recurring_transaction_templates as any;
    const account = t?.accounts as any;
    const category = t?.categories as any;
    return {
      id: row.id,
      template_id: row.template_id,
      occurrence_date: row.occurrence_date,
      expected_amount: row.expected_amount,
      status: row.status as OccurrenceStatus,
      transaction_id: row.transaction_id,
      merchant_name: t?.merchant_name ?? null,
      description: t?.description ?? null,
      direction: t?.direction ?? "OUTFLOW",
      currency_code: t?.currency_code ?? "COP",
      account_id: t?.account_id ?? "",
      account_name: account?.name ?? "",
      account_type: account?.account_type ?? "",
      category_name: category?.name_es ?? null,
      category_icon: category?.icon ?? null,
      category_color: category?.color ?? null,
      transfer_source_account_id: t?.transfer_source_account_id ?? null,
    };
  });
}

/**
 * Get pending occurrences in a date range (for dashboard hero/attention).
 */
export async function getPendingOccurrences(
  daysAhead: number = 14,
  currency?: string,
): Promise<RecurringOccurrence[]> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  return getPendingOccurrencesCached(user.id, daysAhead, currency ?? "COP", accessToken);
}

async function getPendingOccurrencesCached(
  userId: string,
  daysAhead: number,
  currency: string,
  accessToken: string,
): Promise<RecurringOccurrence[]> {
  "use cache";
  cacheTag("occurrences");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const today = new Date().toISOString().slice(0, 10);
  const end = addDays(new Date(), daysAhead).toISOString().slice(0, 10);

  const { data } = await supabase
    .from("recurring_occurrences")
    .select(`
      id,
      template_id,
      occurrence_date,
      expected_amount,
      status,
      transaction_id,
      recurring_transaction_templates!inner (
        merchant_name,
        description,
        direction,
        currency_code,
        account_id,
        transfer_source_account_id,
        accounts!recurring_transaction_templates_account_id_fkey (
          name,
          account_type
        ),
        categories (
          name_es,
          icon,
          color
        )
      )
    `)
    .eq("user_id", userId)
    .eq("status", "pending")
    .gte("occurrence_date", today)
    .lte("occurrence_date", end)
    .order("occurrence_date", { ascending: true });

  if (!data) return [];

  return data
    .map((row) => {
      const t = row.recurring_transaction_templates as any;
      const account = t?.accounts as any;
      const category = t?.categories as any;
      return {
        id: row.id,
        template_id: row.template_id,
        occurrence_date: row.occurrence_date,
        expected_amount: row.expected_amount,
        status: row.status as OccurrenceStatus,
        transaction_id: row.transaction_id,
        merchant_name: t?.merchant_name ?? null,
        description: t?.description ?? null,
        direction: t?.direction ?? "OUTFLOW",
        currency_code: t?.currency_code ?? "COP",
        account_id: t?.account_id ?? "",
        account_name: account?.name ?? "",
        account_type: account?.account_type ?? "",
        category_name: category?.name_es ?? null,
        category_icon: category?.icon ?? null,
        category_color: category?.color ?? null,
        transfer_source_account_id: t?.transfer_source_account_id ?? null,
      };
    })
    .filter((o) => o.currency_code === currency);
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Mark an occurrence as paid, linking it to a transaction.
 */
export async function markOccurrencePaid(
  occurrenceId: string,
  transactionId: string,
): Promise<ActionResult<{ updated: boolean }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("recurring_occurrences")
    .update({
      status: "paid",
      transaction_id: transactionId,
      paid_at: new Date().toISOString(),
    })
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .eq("status", "pending"); // Only update if still pending

  if (error) return { success: false, error: error.message };

  revalidateFinancialViews();
  revalidateTag("occurrences", "zeta");

  return { success: true, data: { updated: true } };
}

/**
 * Mark an occurrence as skipped (already paid manually, no transaction needed).
 */
export async function skipOccurrence(
  occurrenceId: string,
): Promise<ActionResult<{ skipped: boolean }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("recurring_occurrences")
    .update({
      status: "skipped",
      skipped_at: new Date().toISOString(),
    })
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .eq("status", "pending"); // Only update if still pending

  if (error) return { success: false, error: error.message };

  revalidateFinancialViews();
  revalidateTag("occurrences", "zeta");

  return { success: true, data: { skipped: true } };
}

/**
 * Find a pending occurrence matching a transaction's account + date.
 * Used by transaction creation paths to auto-link.
 * Returns the occurrence ID if found, null otherwise.
 */
export async function findMatchingOccurrence(
  accountId: string,
  transactionDate: string,
  amount: number,
  direction: "INFLOW" | "OUTFLOW",
): Promise<string | null> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return null;

  // Look for a pending occurrence on the same date, same account, same direction
  const { data } = await supabase
    .from("recurring_occurrences")
    .select("id, expected_amount, recurring_transaction_templates!inner(account_id, direction)")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .eq("occurrence_date", transactionDate)
    .eq("recurring_transaction_templates.account_id", accountId)
    .eq("recurring_transaction_templates.direction", direction)
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return data.id;
}
```

- [ ] **Step 2: Add "occurrences" tag to revalidateFinancialViews**

In `webapp/src/lib/cache/revalidation.ts`, add `revalidateTag("occurrences", "zeta");` to the function.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/occurrences.ts webapp/src/lib/cache/revalidation.ts
git commit -m "feat: add occurrence CRUD server actions with cached queries"
```

---

### Task 4: Integrate with template CRUD

When a template is created, updated, or toggled active/inactive, regenerate its occurrences for the current window.

**Files:**
- Modify: `webapp/src/actions/recurring-templates.ts`

- [ ] **Step 1: Add occurrence regeneration after template create/update/toggle**

After each CRUD operation in `recurring-templates.ts`, call `ensureOccurrencesForRange` for the affected template. Add this import and helper:

```typescript
import { ensureCurrentOccurrences } from "@/actions/occurrences";
```

Then in `createRecurringTemplate`, `updateRecurringTemplate`, and `toggleRecurringTemplate`, add after the DB operation and before the return:

```typescript
// Regenerate occurrences for the affected template
await ensureCurrentOccurrences();
```

- [ ] **Step 2: Update `recordRecurringOccurrencePayment` to mark occurrence as paid**

After inserting the transaction(s), find and mark the matching occurrence:

```typescript
import { markOccurrencePaid } from "@/actions/occurrences";

// After successful transaction insertion, in recordRecurringOccurrencePayment:
// Find the occurrence for this template + date and mark it paid
const { data: occurrence } = await supabase
  .from("recurring_occurrences")
  .select("id")
  .eq("template_id", payload.templateId)
  .eq("occurrence_date", payload.occurrenceDate)
  .eq("user_id", user.id)
  .eq("status", "pending")
  .maybeSingle();

if (occurrence) {
  // Link to the first created transaction
  const primaryTxId = inserted.createdTxs[0]?.id;
  if (primaryTxId) {
    await supabase
      .from("recurring_occurrences")
      .update({
        status: "paid",
        transaction_id: primaryTxId,
        paid_at: new Date().toISOString(),
      })
      .eq("id", occurrence.id)
      .eq("user_id", user.id);
  }
}

revalidateTag("occurrences", "zeta");
```

- [ ] **Step 3: Retire old skip functions**

Remove from `recurring-templates.ts`:
- `skipObligation` → replaced by `skipOccurrence` in `occurrences.ts`
- `skipRecurringOccurrence` → replaced by `skipOccurrence`
- `getSkippedObligationKeys` → replaced by querying `recurring_occurrences.status`
- `getSkippedOccurrenceKeys` → replaced
- `getSkippedObligationKeysCached` → replaced
- `getPaidOccurrenceKeys` → replaced by querying `recurring_occurrences.status`
- `computeRecurringGroupUuid` → keep for now (existing transactions still use it), but no new usage

- [ ] **Step 4: Commit**

```bash
git add webapp/src/actions/recurring-templates.ts
git commit -m "feat: integrate occurrence lifecycle with template CRUD and payment recording"
```

---

### Task 5: Update dashboard hero to use occurrences

**Files:**
- Modify: `webapp/src/actions/charts.ts`

- [ ] **Step 1: Replace computed occurrence filtering with DB query**

In `getDashboardHeroData`, replace the current flow:
```
getUpcomingRecurrences → filter → getPaidOccurrenceKeys → getSkippedObligationKeys → filter
```

With:
```
ensureCurrentOccurrences() → getPendingOccurrences(14, currency)
```

The pending occurrences from the DB already have status='pending' — no filtering needed.

```typescript
import { ensureCurrentOccurrences, getPendingOccurrences } from "@/actions/occurrences";

// In getDashboardHeroData, replace sections 3-5:

// 3. Ensure occurrences are generated for current window
await ensureCurrentOccurrences();

// 4. Get pending recurring obligations from materialized occurrences
const pendingOccurrences = await getPendingOccurrences(14, baseCurrency);
const recurringObligations: PendingObligation[] = pendingOccurrences
  .filter((o) => o.direction === "OUTFLOW")
  .map((o) => ({
    id: o.id,
    name: o.merchant_name ?? o.description ?? "Recurrente",
    amount: o.expected_amount,
    currency_code: o.currency_code,
    due_date: o.occurrence_date,
    source: "recurring" as const,
  }));
const recurringObligationsForAvailable = pendingOccurrences
  .filter((o) => o.direction === "OUTFLOW" && o.account_type !== "CREDIT_CARD")
  .reduce((sum, o) => sum + o.expected_amount, 0);

// 5. Process statement payment obligations (keep existing logic, still filter by obligation_skips... 
// Actually, statement skips can now use a similar pattern — or we can add statement occurrences later.
// For now, keep statement logic as-is since statements are imported, not generated.
```

Remove imports of `getPaidOccurrenceKeys`, `getSkippedObligationKeys` from charts.ts.

- [ ] **Step 2: Commit**

```bash
git add webapp/src/actions/charts.ts
git commit -m "feat: dashboard hero uses materialized occurrences for pending obligations"
```

---

### Task 6: Update attention items

**Files:**
- Modify: `webapp/src/actions/attention-items.ts`

- [ ] **Step 1: Replace computed occurrences with DB query**

In `getAttentionItems`, replace the post-cache filtering of paid/skipped keys with a direct query of `recurring_occurrences WHERE status='pending'`.

Since `getAttentionItemsCached` computes occurrences in JS from templates, and we now have them in the DB, we can query the DB directly. However, `getAttentionItemsCached` is a `"use cache"` function — we should query via `createCachedClient`.

Replace the recurring section of `getAttentionItemsCached` (section 3 — templates query + occurrence computation) with:

```typescript
// 3. Pending recurring occurrences (next 7 days, already materialized)
supabase
  .from("recurring_occurrences")
  .select(`
    id,
    template_id,
    occurrence_date,
    expected_amount,
    recurring_transaction_templates!inner (
      merchant_name,
      description,
      direction,
      amount
    )
  `)
  .eq("user_id", userId)
  .eq("status", "pending")
  .gte("occurrence_date", todayStr)
  .lte("occurrence_date", toISODateString(in7Days))
  .order("occurrence_date", { ascending: true })
  .limit(5),
```

Then map results to `AttentionUpcomingPayment[]` using the joined template data.

Remove the post-cache paid/skipped filtering in `getAttentionItems` — it's no longer needed since we query `status='pending'` directly.

- [ ] **Step 2: Commit**

```bash
git add webapp/src/actions/attention-items.ts
git commit -m "feat: attention items query pending occurrences directly"
```

---

### Task 7: Update the recurring month hook

**Files:**
- Modify: `webapp/src/components/recurring/use-recurring-month.ts`

- [ ] **Step 1: Rewrite hook to use occurrences from DB**

The hook currently:
1. Takes `templates` + `accounts` as props
2. Computes occurrences in JS via `getOccurrencesBetween`
3. Hydrates checked state from `getPaidOccurrenceKeys` + `getSkippedOccurrenceKeys`
4. Manages localStorage overlay

New approach:
1. Takes `templates` + `accounts` as props (still needed for sourceAccounts)
2. Fetches occurrences from DB via `getOccurrencesForMonth(monthKey)` — already has status
3. Splits into pending/completed based on `status` field
4. `confirmPayment` → calls `recordRecurringOccurrencePayment` (unchanged) which now marks occurrence as paid
5. `skipPayment` → calls `skipOccurrence(occurrenceId)` instead of `skipRecurringOccurrence(templateId, date)`
6. No more localStorage hydration — DB is source of truth

Key changes:
- Remove `getPaidOccurrenceKeys` / `getSkippedOccurrenceKeys` imports
- Import `getOccurrencesForMonth`, `skipOccurrence`, `ensureOccurrencesForRange` from `@/actions/occurrences`
- `OccurrenceItem.id` now includes the occurrence row ID (for skipOccurrence)
- Remove localStorage management entirely
- Add `useEffect` to call `ensureOccurrencesForRange` for the current month on mount and month change

- [ ] **Step 2: Update `OccurrenceItem` type**

Add `occurrenceId: string` field — the DB row ID needed for skip/paid mutations.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/recurring/use-recurring-month.ts
git commit -m "feat: recurring month hook fetches occurrences from DB, no more localStorage"
```

---

### Task 8: Link transaction creation paths to occurrences

**Files:**
- Modify: `webapp/src/actions/transactions.ts`
- Modify: `webapp/src/actions/email-ingest.ts`

- [ ] **Step 1: Add optional `occurrenceId` to `createTransaction`**

In `createTransaction`, add an optional `occurrenceId` parameter. After successful transaction insert, if `occurrenceId` is provided, call `markOccurrencePaid(occurrenceId, transactionId)`.

```typescript
import { markOccurrencePaid, findMatchingOccurrence } from "@/actions/occurrences";

// After successful INSERT:
if (occurrenceId) {
  await markOccurrencePaid(occurrenceId, newTransaction.id);
} else {
  // Auto-detect: check if this matches a pending occurrence
  const matchId = await findMatchingOccurrence(
    accountId, transactionDate, amount, direction
  );
  if (matchId) {
    await markOccurrencePaid(matchId, newTransaction.id);
  }
}
```

- [ ] **Step 2: Add auto-linking to email import**

In `approveEmailTransaction`, after creating the transaction, check for a matching pending occurrence and link it.

- [ ] **Step 3: Add auto-linking to PDF import**

In `importTransactions`, after each transaction is inserted, check for matching pending occurrences. This is the most complex path since it processes many transactions in bulk.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/actions/transactions.ts webapp/src/actions/email-ingest.ts webapp/src/actions/import-transactions.ts
git commit -m "feat: all transaction creation paths auto-link to pending occurrences"
```

---

### Task 9: Update UI components

**Files:**
- Modify: `webapp/src/components/mobile/v2/plan/mobile-recurrentes-view.tsx`
- Modify: `webapp/src/components/recurring/recurring-timeline-view.tsx`
- Modify: `webapp/src/components/plan/tabs/plan-tab-recurrentes.tsx`

- [ ] **Step 1: Update mobile recurrentes view**

The `MobileRecurrentesView` currently receives `templates` + `accounts` and uses `useRecurringMonth` hook. The hook's API changes:
- `skipPayment(item)` now needs `item.occurrenceId` (the DB row ID)
- `confirmPayment(item, overrides)` stays the same (still calls `recordRecurringOccurrencePayment`)
- `pending` / `completed` are now derived from DB status, not localStorage

Minimal changes needed — mostly prop threading of `occurrenceId`.

- [ ] **Step 2: Update desktop timeline view**

Same pattern as mobile — the `PaymentTimeline` component receives items from the hook, which now includes `occurrenceId`.

- [ ] **Step 3: Ensure occurrence generation on page load**

In `PlanTabRecurrentes` (server component), call `ensureCurrentOccurrences()` before rendering. This ensures rows exist in the DB for the current month.

```typescript
import { ensureCurrentOccurrences } from "@/actions/occurrences";

export async function PlanTabRecurrentes() {
  await ensureCurrentOccurrences(); // Ensure rows exist
  // ... rest of data fetching
}
```

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/
git commit -m "feat: UI components use occurrence IDs for skip/pay actions"
```

---

### Task 10: Cleanup — remove retired code

**Files:**
- Modify: `webapp/src/actions/recurring-templates.ts` — remove dead functions
- Delete: old obligation_skips migration logic (already dropped by Task 1 migration)

- [ ] **Step 1: Remove dead code from recurring-templates.ts**

Remove these functions (now replaced by `occurrences.ts`):
- `skipObligation`
- `skipRecurringOccurrence`
- `getSkippedObligationKeys`
- `getSkippedObligationKeysCached`
- `getSkippedOccurrenceKeys`
- `getPaidOccurrenceKeys`

Keep `computeRecurringGroupUuid` — still referenced by `recordRecurringOccurrencePayment` for backward compat with existing `recurrence_group_id` on old transactions.

- [ ] **Step 2: Remove old obligation_skips references**

Search codebase for any remaining references to `obligation_skips` or `recurring_occurrence_skips` and remove them.

- [ ] **Step 3: Final build verification**

```bash
cd webapp && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove retired skip/paid tracking code, clean up imports"
```

---

## Migration Safety Notes

1. **Backward compatibility:** Existing transactions with `recurrence_group_id` remain valid. The `recordRecurringOccurrencePayment` function continues to set this field for consistency, but status is now authoritative from `recurring_occurrences`.

2. **Data migration:** The SQL migration migrates skipped occurrences from `obligation_skips`. Paid occurrences (from `recurrence_group_id` transactions) cannot be reverse-mapped from the SHA-256 hash — they'll be regenerated as `pending` initially. Running `ensureCurrentOccurrences()` on first page load creates them, and the `recordRecurringOccurrencePayment` integration marks them as paid when found.

3. **Statement obligations:** This plan does NOT migrate statement snapshot obligations to the occurrence model. Statement skips still use the separate `obligation_skips` pattern temporarily. A follow-up plan should unify statements into a broader "payment obligations" model.

4. **Rollback:** If the migration fails, the old `obligation_skips` table is dropped. To rollback: recreate it from the original migration and restore data from `recurring_occurrences WHERE status='skipped'`.

---

## Verification Checklist

- [ ] `pnpm build` passes
- [ ] Create a recurring template → occurrence rows appear in `recurring_occurrences`
- [ ] Mark as "Ya pagué" on recurrentes → status = 'skipped', dashboard updates
- [ ] "Confirmar pago" on recurrentes → status = 'paid', transaction_id linked, dashboard updates
- [ ] Create manual transaction (FAB) matching a pending occurrence → auto-linked, occurrence marked paid
- [ ] Email import creates transaction matching pending occurrence → auto-linked
- [ ] Navigate months on recurrentes → occurrences generated on demand
- [ ] Dashboard hero "Gastos fijos pendientes" excludes paid + skipped occurrences
- [ ] Attention "Pagos próximos" only shows pending occurrences

# Manual Transaction-to-Recurring Linking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to manually link an existing transaction to a pending recurring occurrence from both sides (transaction → occurrence, occurrence → transaction), with smart undo that distinguishes manually-linked from system-created.

**Architecture:** New `linked_manually` boolean column on `recurring_occurrences`. One new server action `linkExistingTransactionToOccurrence` handles the linking. Two query actions fetch ranked candidates. A shared `LinkPickerSheet` component (bottom drawer) serves both directions. Smart undo in `revertOccurrence` branches on the flag — unlink-only for manual, delete for system-created.

**Tech Stack:** Next.js Server Actions, Supabase, shadcn/ui Drawer, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-14-manual-tx-recurring-linking.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/YYYYMMDDHHMMSS_add_linked_manually_to_occurrences.sql` | Add `linked_manually` boolean column |
| Modify | `webapp/src/types/database.ts` | Regenerate types after migration |
| Modify | `webapp/src/actions/occurrences.ts` | Add `linkExistingTransactionToOccurrence`, `getCandidateTransactionsForOccurrence`, `getCandidateOccurrencesForTransaction`, `getAccountIdsWithPendingOccurrences`. Update `revertOccurrence` for smart undo. Export `computeRecurringGroupUuid` from recurring-templates or inline. |
| Modify | `webapp/src/actions/recurring-templates.ts` | Export `computeRecurringGroupUuid` |
| Create | `webapp/src/components/recurring/link-picker-sheet.tsx` | Shared bottom drawer for picking candidates |
| Modify | `webapp/src/components/recurring/recurring-confirm-inline.tsx` | Add "Vincular existente" button |
| Modify | `webapp/src/components/recurring/use-recurring-month.ts` | Add `linkExisting` callback, expose it |
| Modify | `webapp/src/components/mobile/v2/inicio/inicio-activity.tsx` | Add "Vincular a recurrente" in expanded view |

**Review Gates (per CLAUDE.md):**
- `server-action-reviewer` — after server actions (Tasks 2-3)
- `cache-doctor` — after cached query added (Task 3)
- `zetas-front-guy` — after UI changes (Tasks 4-6)
- `pnpm build` — after every task

---

### Task 1: Migration — `linked_manually` column

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_linked_manually_to_occurrences.sql`

- [ ] **Step 1: Create migration file**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta && npx supabase migration new add_linked_manually_to_occurrences
```

- [ ] **Step 2: Write migration SQL**

Write to the created migration file:

```sql
-- Add flag to distinguish manually-linked occurrences from system-created ones.
-- revertOccurrence uses this to decide: unlink-only (manual) vs delete-tx (system).
ALTER TABLE recurring_occurrences
  ADD COLUMN linked_manually boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN recurring_occurrences.linked_manually IS
  'true when user manually linked a pre-existing transaction; false when system-created via recordRecurringOccurrencePayment or auto-linked via linkTransactionToOccurrence';
```

- [ ] **Step 3: Push migration**

```bash
npx supabase db push
```

Expected: migration applied, no errors.

- [ ] **Step 4: Regenerate database types**

```bash
npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > webapp/src/types/database.ts
```

Verify: `grep "linked_manually" webapp/src/types/database.ts` shows the new column in Row/Insert/Update for `recurring_occurrences`. Also verify `export type Json =` header is intact (first line).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*_add_linked_manually_to_occurrences.sql webapp/src/types/database.ts
git commit -m "feat: add linked_manually column to recurring_occurrences"
```

---

### Task 2: Export `computeRecurringGroupUuid`

**Files:**
- Modify: `webapp/src/actions/recurring-templates.ts:40-52`

- [ ] **Step 1: Export the function**

In `webapp/src/actions/recurring-templates.ts`, change line 40 from:

```typescript
async function computeRecurringGroupUuid(templateId: string, occurrenceDate: string) {
```

to:

```typescript
export async function computeRecurringGroupUuid(templateId: string, occurrenceDate: string) {
```

- [ ] **Step 2: Verify build**

```bash
cd webapp && pnpm build
```

Expected: clean build. Exporting a private function doesn't break anything.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/recurring-templates.ts
git commit -m "refactor: export computeRecurringGroupUuid for use by manual linking"
```

---

### Task 3: Server actions — linking + candidate queries

**Files:**
- Modify: `webapp/src/actions/occurrences.ts`

This task adds four new functions and modifies `revertOccurrence`. All go into `occurrences.ts`.

- [ ] **Step 1: Add `linkExistingTransactionToOccurrence` action**

Add at the bottom of `webapp/src/actions/occurrences.ts`, before the closing of the file:

```typescript
/**
 * Manually link an existing transaction to a pending occurrence.
 * Unlike recordRecurringOccurrencePayment (which creates a new tx), this connects
 * an already-existing transaction. No balance changes — the tx already impacted balances.
 * Sets linked_manually=true so revertOccurrence knows to unlink instead of delete.
 */
export async function linkExistingTransactionToOccurrence(
  occurrenceId: string,
  transactionId: string,
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  if (!UUID_RE.test(occurrenceId) || !UUID_RE.test(transactionId)) {
    return { success: false, error: "ID inválido" };
  }

  // Fetch occurrence — must be pending
  const { data: occurrence, error: occErr } = await supabase
    .from("recurring_occurrences")
    .select("id, template_id, occurrence_date, template:recurring_transaction_templates!recurring_occurrences_template_id_fkey(account_id, direction, frequency)")
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .single();

  if (occErr || !occurrence) {
    return { success: false, error: "Ocurrencia no encontrada o ya no está pendiente" };
  }

  const template = occurrence.template as { account_id: string; direction: string; frequency: string } | null;
  if (!template) return { success: false, error: "Plantilla no encontrada" };

  // Fetch transaction — must exist and match account + direction
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("id, account_id, direction")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .single();

  if (txErr || !tx) {
    return { success: false, error: "Transacción no encontrada" };
  }

  if (tx.account_id !== template.account_id || tx.direction !== template.direction) {
    return { success: false, error: "La transacción no coincide con la cuenta o dirección de la plantilla" };
  }

  // Compute recurrence_group_id for consistency with system-created payments
  const { computeRecurringGroupUuid } = await import("@/actions/recurring-templates");
  const recurrenceGroupId = await computeRecurringGroupUuid(
    occurrence.template_id,
    occurrence.occurrence_date,
  );

  // Stamp recurrence_group_id on the transaction
  const { error: txUpdateErr } = await supabase
    .from("transactions")
    .update({ recurrence_group_id: recurrenceGroupId })
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (txUpdateErr) {
    return { success: false, error: `Error al actualizar transacción: ${txUpdateErr.message}` };
  }

  // Mark occurrence as paid with linked_manually=true
  const { error: occUpdateErr } = await supabase
    .from("recurring_occurrences")
    .update({
      status: "paid" as const,
      transaction_id: transactionId,
      paid_at: new Date().toISOString(),
      linked_manually: true,
    })
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (occUpdateErr) {
    return { success: false, error: `Error al vincular: ${occUpdateErr.message}` };
  }

  // Auto-deactivate ONCE templates
  if (template.frequency === "ONCE") {
    await supabase
      .from("recurring_transaction_templates")
      .update({ is_active: false })
      .eq("id", occurrence.template_id)
      .eq("user_id", user.id);
  }

  revalidateFinancialViews();
  revalidateTag("occurrences", "zeta");
  revalidateTag("recurring", "zeta");
  return { success: true, data: undefined };
}
```

- [ ] **Step 2: Add `getCandidateTransactionsForOccurrence` action**

Add after the previous function:

```typescript
/**
 * Fetch candidate transactions to link to a pending occurrence.
 * Pre-filtered: same account, same direction, ±30 days (or all if showAll=true).
 * Sorted by match score (date proximity 0.6 + amount proximity 0.4).
 */
export interface CandidateTransaction {
  id: string;
  description: string;
  amount: number;
  currency_code: string;
  transaction_date: string;
  provider: string | null;
  matchScore: number;
}

export async function getCandidateTransactionsForOccurrence(
  occurrenceId: string,
  showAll = false,
): Promise<ActionResult<CandidateTransaction[]>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  if (!UUID_RE.test(occurrenceId)) {
    return { success: false, error: "ID inválido" };
  }

  // Fetch occurrence + template info
  const { data: occurrence, error: occErr } = await supabase
    .from("recurring_occurrences")
    .select("id, occurrence_date, expected_amount, template:recurring_transaction_templates!recurring_occurrences_template_id_fkey(account_id, direction)")
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .single();

  if (occErr || !occurrence) {
    return { success: false, error: "Ocurrencia no encontrada" };
  }

  const template = occurrence.template as { account_id: string; direction: string } | null;
  if (!template) return { success: false, error: "Plantilla no encontrada" };

  // Build query: same account + direction, no existing recurrence_group_id
  let query = supabase
    .from("transactions")
    .select("id, clean_description, merchant_name, raw_description, amount, currency_code, transaction_date, provider")
    .eq("user_id", user.id)
    .eq("account_id", template.account_id)
    .eq("direction", template.direction)
    .is("recurrence_group_id", null)
    .order("transaction_date", { ascending: false })
    .limit(50);

  // Date filter unless showAll
  if (!showAll) {
    const baseDateObj = new Date(`${occurrence.occurrence_date}T12:00:00`);
    const rangeStart = toColombiaDateString(addDays(baseDateObj, -30));
    const rangeEnd = toColombiaDateString(addDays(baseDateObj, 30));
    query = query.gte("transaction_date", rangeStart).lte("transaction_date", rangeEnd);
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  const candidates: CandidateTransaction[] = (data ?? []).map((tx) => ({
    id: tx.id,
    description: tx.clean_description ?? tx.merchant_name ?? tx.raw_description ?? "Sin descripción",
    amount: tx.amount,
    currency_code: tx.currency_code,
    transaction_date: tx.transaction_date,
    provider: tx.provider,
    matchScore: computeMatchScore(
      tx.transaction_date,
      tx.amount,
      occurrence.occurrence_date,
      occurrence.expected_amount,
    ),
  }));

  candidates.sort((a, b) => b.matchScore - a.matchScore);
  return { success: true, data: candidates };
}
```

- [ ] **Step 3: Add `getCandidateOccurrencesForTransaction` action**

Add after the previous function:

```typescript
/**
 * Fetch candidate pending occurrences to link a transaction to.
 * Pre-filtered: same account, same direction, ±30 days.
 * Sorted by match score.
 */
export interface CandidateOccurrence {
  id: string;
  templateId: string;
  merchant: string;
  occurrenceDate: string;
  expectedAmount: number;
  currencyCode: string;
  matchScore: number;
  categoryIcon: string | null;
  categoryColor: string | null;
}

export async function getCandidateOccurrencesForTransaction(
  transactionId: string,
): Promise<ActionResult<CandidateOccurrence[]>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  if (!UUID_RE.test(transactionId)) {
    return { success: false, error: "ID inválido" };
  }

  // Fetch transaction
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("id, account_id, direction, transaction_date, amount")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .single();

  if (txErr || !tx) {
    return { success: false, error: "Transacción no encontrada" };
  }

  // Date range
  const baseDateObj = new Date(`${tx.transaction_date}T12:00:00`);
  const rangeStart = toColombiaDateString(addDays(baseDateObj, -30));
  const rangeEnd = toColombiaDateString(addDays(baseDateObj, 30));

  // Fetch pending occurrences matching account + direction
  const { data, error } = await supabase
    .from("recurring_occurrences")
    .select(`
      id, template_id, occurrence_date, expected_amount,
      template:recurring_transaction_templates!recurring_occurrences_template_id_fkey(
        merchant_name, description, direction, currency_code, account_id,
        category:categories!recurring_transaction_templates_category_id_fkey(icon, color)
      )
    `)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .gte("occurrence_date", rangeStart)
    .lte("occurrence_date", rangeEnd);

  if (error) return { success: false, error: error.message };

  // Filter by account + direction (can't filter through nested join in Supabase easily)
  const filtered = (data ?? []).filter((o) => {
    const t = o.template as { account_id: string; direction: string } | null;
    return t && t.account_id === tx.account_id && t.direction === tx.direction;
  });

  const candidates: CandidateOccurrence[] = filtered.map((o) => {
    const t = o.template as {
      merchant_name: string | null;
      description: string | null;
      currency_code: string;
      category: { icon: string | null; color: string | null } | null;
    };
    return {
      id: o.id,
      templateId: o.template_id,
      merchant: t.merchant_name ?? t.description ?? "Recurrente",
      occurrenceDate: o.occurrence_date,
      expectedAmount: o.expected_amount,
      currencyCode: t.currency_code,
      matchScore: computeMatchScore(
        tx.transaction_date,
        tx.amount,
        o.occurrence_date,
        o.expected_amount,
      ),
      categoryIcon: t.category?.icon ?? null,
      categoryColor: t.category?.color ?? null,
    };
  });

  candidates.sort((a, b) => b.matchScore - a.matchScore);
  return { success: true, data: candidates };
}
```

- [ ] **Step 4: Add `getAccountIdsWithPendingOccurrences` action**

Add after the previous function:

```typescript
/**
 * Returns account IDs that have at least one pending occurrence.
 * Used to conditionally show "Vincular a recurrente" on transaction rows.
 * Lightweight — just IDs, cached.
 */
async function getAccountIdsWithPendingOccurrencesCached(
  userId: string,
  accessToken: string,
): Promise<string[]> {
  "use cache";
  cacheTag("occurrences");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data } = await supabase
    .from("recurring_occurrences")
    .select("template:recurring_transaction_templates!recurring_occurrences_template_id_fkey(account_id)")
    .eq("user_id", userId)
    .eq("status", "pending");

  const ids = new Set<string>();
  for (const row of data ?? []) {
    const t = row.template as { account_id: string } | null;
    if (t) ids.add(t.account_id);
  }
  return Array.from(ids);
}

export async function getAccountIdsWithPendingOccurrences(): Promise<string[]> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  return getAccountIdsWithPendingOccurrencesCached(user.id, accessToken);
}
```

Note: this requires `createCachedClient` which is already imported at the top of the file.

- [ ] **Step 5: Add `computeMatchScore` helper**

Add in the helpers section near the top of `occurrences.ts` (after the imports, before the first exported function):

```typescript
// ─── Match Score ──────────────────────────────────────────────────────────────

/**
 * Composite match score for ranking candidates.
 * Date proximity (weight 0.6) + amount proximity (weight 0.4).
 * Returns 0-1 where 1 = perfect match.
 */
function computeMatchScore(
  candidateDate: string,
  candidateAmount: number,
  referenceDate: string,
  referenceAmount: number,
): number {
  const cDate = new Date(`${candidateDate}T12:00:00`);
  const rDate = new Date(`${referenceDate}T12:00:00`);
  const daysDiff = Math.abs(
    Math.round((cDate.getTime() - rDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  const dateScore = Math.max(0, 1 - daysDiff / 30);

  const amountDiff = Math.abs(candidateAmount - referenceAmount);
  const amountScore =
    referenceAmount > 0 ? Math.max(0, 1 - amountDiff / referenceAmount) : 0;

  return dateScore * 0.6 + amountScore * 0.4;
}
```

- [ ] **Step 6: Update `revertOccurrence` for smart undo**

In `webapp/src/actions/occurrences.ts`, the `revertOccurrence` function (around line 439). Modify the fetch query to include `linked_manually`, then branch on it.

Change the occurrence fetch (around line 448-453) from:

```typescript
  const { data: occurrence, error: fetchError } = await supabase
    .from("recurring_occurrences")
    .select("id, status, transaction_id, template_id, occurrence_date")
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .single();
```

to:

```typescript
  const { data: occurrence, error: fetchError } = await supabase
    .from("recurring_occurrences")
    .select("id, status, transaction_id, template_id, occurrence_date, linked_manually")
    .eq("id", occurrenceId)
    .eq("user_id", user.id)
    .single();
```

Then, replace the block starting at `// For paid occurrences: delete created transactions and reverse balances` (around line 463) through the end of the balance reversal + deletion block (through line 532, ending with `}` after the `deleteError` check). Replace that entire block with:

```typescript
  // For paid occurrences with a linked transaction
  if (occurrence.status === "paid" && occurrence.transaction_id) {
    if (occurrence.linked_manually) {
      // Manual link: just clear recurrence_group_id from the transaction — don't delete it
      const { data: primaryTx } = await supabase
        .from("transactions")
        .select("recurrence_group_id")
        .eq("id", occurrence.transaction_id)
        .eq("user_id", user.id)
        .single();

      if (primaryTx?.recurrence_group_id) {
        await supabase
          .from("transactions")
          .update({ recurrence_group_id: null })
          .eq("recurrence_group_id", primaryTx.recurrence_group_id)
          .eq("user_id", user.id);
      }
    } else {
      // System-created: delete transactions and reverse balances (existing logic)
      const { data: primaryTx } = await supabase
        .from("transactions")
        .select("recurrence_group_id")
        .eq("id", occurrence.transaction_id)
        .eq("user_id", user.id)
        .single();

      if (primaryTx?.recurrence_group_id) {
        const { data: groupTxs } = await supabase
          .from("transactions")
          .select("id, amount, direction, account_id, accounts!transactions_account_id_fkey(account_type, current_balance)")
          .eq("recurrence_group_id", primaryTx.recurrence_group_id)
          .eq("user_id", user.id);

        const txIds = (groupTxs ?? []).map((tx) => tx.id);

        if (txIds.length > 0) {
          const { count: reconciledRefs } = await supabase
            .from("transactions")
            .select("id", { count: "exact", head: true })
            .in("reconciled_into_transaction_id", txIds)
            .eq("user_id", user.id);
          if (reconciledRefs && reconciledRefs > 0) {
            return { success: false, error: "No se puede revertir: hay una transacción importada vinculada a este pago." };
          }
        }

        const balanceResults = await Promise.all(
          (groupTxs ?? []).map((tx) => {
            const account = tx.accounts as { account_type: string; current_balance: number } | null;
            if (!account) return Promise.resolve(null);

            const newBalance = reverseAccountBalanceDelta({
              currentBalance: account.current_balance,
              accountType: account.account_type,
              direction: tx.direction as "INFLOW" | "OUTFLOW",
              amount: tx.amount,
            });

            return supabase
              .from("accounts")
              .update({ current_balance: newBalance })
              .eq("user_id", user.id)
              .eq("id", tx.account_id);
          })
        );

        const balanceError = balanceResults.find((r) => r && "error" in r && r.error);
        if (balanceError && "error" in balanceError && balanceError.error) {
          return { success: false, error: `Error al revertir saldo: ${balanceError.error.message}` };
        }

        const { error: deleteError } = await supabase
          .from("transactions")
          .delete()
          .eq("recurrence_group_id", primaryTx.recurrence_group_id)
          .eq("user_id", user.id);

        if (deleteError) {
          return { success: false, error: `Error al eliminar transacciones: ${deleteError.message}` };
        }
      }
    }
  }
```

Also update the reset occurrence query (around line 536-545) to also clear `linked_manually`:

Change:

```typescript
  const { error: updateError } = await supabase
    .from("recurring_occurrences")
    .update({
      status: "pending",
      transaction_id: null,
      paid_at: null,
      skipped_at: null,
    })
    .eq("id", occurrenceId)
    .eq("user_id", user.id);
```

to:

```typescript
  const { error: updateError } = await supabase
    .from("recurring_occurrences")
    .update({
      status: "pending",
      transaction_id: null,
      paid_at: null,
      skipped_at: null,
      linked_manually: false,
    })
    .eq("id", occurrenceId)
    .eq("user_id", user.id);
```

- [ ] **Step 7: Verify build**

```bash
cd webapp && pnpm build
```

Expected: clean build.

- [ ] **Step 8: Commit**

```bash
git add webapp/src/actions/occurrences.ts
git commit -m "feat: add manual tx-to-occurrence linking actions + smart undo"
```

---

### Task 4: `LinkPickerSheet` component

**Files:**
- Create: `webapp/src/components/recurring/link-picker-sheet.tsx`

- [ ] **Step 1: Create the component**

Write `webapp/src/components/recurring/link-picker-sheet.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { MOBILE_TAB_BAR_CLEARANCE_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";

export interface LinkCandidate {
  id: string;
  label: string;
  sublabel: string;
  amount: number;
  currencyCode: string;
  direction: "INFLOW" | "OUTFLOW";
  matchScore: number;
  /** Optional icon for occurrence candidates */
  icon?: string | null;
  iconColor?: string | null;
}

interface LinkPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  candidates: LinkCandidate[];
  onConfirm: (selectedId: string) => void;
  isPending: boolean;
  showAllLabel?: string;
  onShowAll?: () => void;
  isLoadingAll?: boolean;
}

export function LinkPickerSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  candidates,
  onConfirm,
  isPending,
  showAllLabel,
  onShowAll,
  isLoadingAll,
}: LinkPickerSheetProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Reset selection when drawer opens/closes
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSelectedId(null);
      setSearch("");
    }
    onOpenChange(next);
  };

  const filtered = search
    ? candidates.filter((c) =>
        c.label.toLowerCase().includes(search.toLowerCase())
      )
    : candidates;

  const bestMatch = filtered.length > 0 ? filtered[0] : null;
  const rest = filtered.slice(1);

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className={MOBILE_TAB_BAR_CLEARANCE_CLASS}>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{subtitle}</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-2">
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-4">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No se encontraron coincidencias
            </p>
          )}

          {bestMatch && (
            <>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-z-income">
                Mejor coincidencia
              </p>
              <CandidateRow
                candidate={bestMatch}
                isSelected={selectedId === bestMatch.id}
                isBest
                onSelect={() =>
                  setSelectedId(selectedId === bestMatch.id ? null : bestMatch.id)
                }
              />
            </>
          )}

          {rest.length > 0 && (
            <>
              <p className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Otras opciones
              </p>
              {rest.map((c) => (
                <CandidateRow
                  key={c.id}
                  candidate={c}
                  isSelected={selectedId === c.id}
                  isBest={false}
                  onSelect={() =>
                    setSelectedId(selectedId === c.id ? null : c.id)
                  }
                />
              ))}
            </>
          )}

          {onShowAll && showAllLabel && (
            <button
              type="button"
              onClick={onShowAll}
              disabled={isLoadingAll}
              className="mt-3 w-full py-2 text-center text-xs font-semibold text-z-brass"
            >
              {isLoadingAll ? "Cargando..." : showAllLabel}
            </button>
          )}
        </div>

        <DrawerFooter>
          <Button
            onClick={() => selectedId && onConfirm(selectedId)}
            disabled={!selectedId || isPending}
            className="w-full"
          >
            <Link2 className="mr-2 size-4" />
            {isPending ? "Vinculando..." : "Vincular"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function CandidateRow({
  candidate,
  isSelected,
  isBest,
  onSelect,
}: {
  candidate: LinkCandidate;
  isSelected: boolean;
  isBest: boolean;
  onSelect: () => void;
}) {
  const scorePercent = Math.round(candidate.matchScore * 100);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
        isSelected
          ? "bg-z-brass/10 ring-1 ring-z-brass/30"
          : "hover:bg-white/[0.03]",
        isBest && !isSelected && "border-l-2 border-l-z-income bg-z-income/[0.04]"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{candidate.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {candidate.sublabel}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            candidate.direction === "INFLOW" && "text-z-income"
          )}
        >
          {candidate.direction === "INFLOW" ? "+" : "-"}
          {formatCurrency(candidate.amount, candidate.currencyCode as CurrencyCode)}
        </p>
        {isBest && scorePercent > 0 && (
          <p className="text-[10px] font-medium text-z-income">
            {scorePercent}% match
          </p>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd webapp && pnpm build
```

Expected: clean build (component not yet used, tree-shaken, but types must be valid).

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/recurring/link-picker-sheet.tsx
git commit -m "feat: add LinkPickerSheet component for manual tx-occurrence linking"
```

---

### Task 5: Occurrence-side integration — "Vincular existente" button

**Files:**
- Modify: `webapp/src/components/recurring/recurring-confirm-inline.tsx`
- Modify: `webapp/src/components/recurring/use-recurring-month.ts`

- [ ] **Step 1: Add `linkExisting` callback to `useRecurringMonth`**

In `webapp/src/components/recurring/use-recurring-month.ts`, add the import at the top:

```typescript
import {
  linkExistingTransactionToOccurrence,
  getCandidateTransactionsForOccurrence,
} from "@/actions/occurrences";
import type { CandidateTransaction } from "@/actions/occurrences";
```

Then add a `linkExisting` callback after the `skipPayment` callback (around line 316):

```typescript
  /* ---- link existing transaction ---- */
  const linkExisting = useCallback(
    async (item: OccurrenceItem, transactionId: string) => {
      setBusyItems((prev) => ({ ...prev, [item.key]: true }));

      const result = await linkExistingTransactionToOccurrence(
        item.occurrenceId,
        transactionId,
      );

      setBusyItems((prev) => ({ ...prev, [item.key]: false }));

      if (!result.success) {
        toast.error(result.error ?? "No se pudo vincular la transacción.");
        return;
      }

      // Optimistically mark as paid
      setOccurrences((prev) =>
        prev.map((o) =>
          o.id === item.occurrenceId ? { ...o, status: "paid" as const } : o
        )
      );

      const isIncome = item.direction === "INFLOW" && !item.isDebtPayment;
      toast.success(
        isIncome
          ? "Ingreso vinculado a recurrente"
          : "Transacción vinculada a recurrente"
      );
      router.refresh();
    },
    [router]
  );
```

Add `linkExisting` to the return object:

```typescript
  return {
    // ... existing fields ...

    // Actions
    confirmPayment,
    skipPayment,
    linkExisting,
    busyItems,

    // ...
  };
```

- [ ] **Step 2: Add "Vincular existente" button to `RecurringConfirmInline`**

In `webapp/src/components/recurring/recurring-confirm-inline.tsx`, add props for the link action:

Change the interface:

```typescript
interface RecurringConfirmInlineProps {
  item: OccurrenceItem;
  onConfirm: (amount: number, date: string, sourceAccountId?: string) => void;
  onSkip: () => void;
  onCancel: () => void;
  onLinkExisting: () => void;
  isPending: boolean;
  sourceAccounts?: SourceAccount[];
}
```

Update the destructuring:

```typescript
export function RecurringConfirmInline({
  item,
  onConfirm,
  onSkip,
  onCancel,
  onLinkExisting,
  isPending,
  sourceAccounts,
}: RecurringConfirmInlineProps) {
```

Add a "Vincular existente" button in the actions row, after the existing buttons (around line 139-146, after the "Ya pagué"/"Ya recibí" button):

```tsx
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLinkExisting}
            disabled={isPending}
          >
            Vincular existente
          </Button>
```

- [ ] **Step 3: Wire up in consumers of `RecurringConfirmInline`**

Find all files that render `RecurringConfirmInline` and pass `onLinkExisting`:

```bash
cd webapp && grep -rn "RecurringConfirmInline" src/components --include="*.tsx" -l
```

For each consumer, you need to:
1. Add state for the link picker sheet: `const [linkingItem, setLinkingItem] = useState<OccurrenceItem | null>(null)`
2. Add state for candidates: `const [candidates, setCandidates] = useState<CandidateTransaction[]>([])`
3. Add state for loading: `const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)`
4. Pass `onLinkExisting={() => { setLinkingItem(item); loadCandidates(item); }}` to `RecurringConfirmInline`
5. Render `LinkPickerSheet` at the bottom of the component

The exact wiring depends on how each consumer is structured. The key pattern for the `onLinkExisting` handler:

```typescript
const handleLinkExisting = async (item: OccurrenceItem) => {
  setLinkingItem(item);
  setIsLoadingCandidates(true);
  const result = await getCandidateTransactionsForOccurrence(item.occurrenceId);
  setIsLoadingCandidates(false);
  if (result.success) {
    setCandidates(result.data);
  } else {
    toast.error(result.error ?? "Error al buscar transacciones");
    setLinkingItem(null);
  }
};
```

And the sheet:

```tsx
<LinkPickerSheet
  open={!!linkingItem}
  onOpenChange={(open) => { if (!open) setLinkingItem(null); }}
  title="Vincular transacción"
  subtitle={linkingItem ? `${linkingItem.merchant} · ${formatCurrency(linkingItem.plannedAmount, linkingItem.currencyCode as CurrencyCode)} esperado · ${formatDate(linkingItem.date)}` : ""}
  candidates={candidates.map((c) => ({
    id: c.id,
    label: c.description,
    sublabel: `${formatDate(c.transaction_date)} · ${c.provider ?? "Manual"}`,
    amount: c.amount,
    currencyCode: c.currency_code,
    direction: linkingItem?.direction ?? "OUTFLOW",
    matchScore: c.matchScore,
  }))}
  onConfirm={(txId) => {
    if (linkingItem) {
      linkExisting(linkingItem, txId);
      setLinkingItem(null);
    }
  }}
  isPending={busyItems[linkingItem?.key ?? ""] ?? false}
  showAllLabel="Mostrar todas las transacciones →"
  onShowAll={async () => {
    if (!linkingItem) return;
    setIsLoadingCandidates(true);
    const result = await getCandidateTransactionsForOccurrence(linkingItem.occurrenceId, true);
    setIsLoadingCandidates(false);
    if (result.success) setCandidates(result.data);
  }}
  isLoadingAll={isLoadingCandidates}
/>
```

- [ ] **Step 4: Verify build**

```bash
cd webapp && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/recurring/recurring-confirm-inline.tsx \
        webapp/src/components/recurring/use-recurring-month.ts \
        webapp/src/components/recurring/*.tsx \
        webapp/src/components/plan/*.tsx \
        webapp/src/components/mobile/v2/plan/*.tsx
git commit -m "feat: add 'Vincular existente' to occurrence confirm form"
```

---

### Task 6: Transaction-side integration — "Vincular a recurrente" in expanded view

**Files:**
- Modify: `webapp/src/components/mobile/v2/inicio/inicio-activity.tsx`

- [ ] **Step 1: Add props for linkable account IDs**

In `webapp/src/components/mobile/v2/inicio/inicio-activity.tsx`, extend the interface:

```typescript
interface InicioActivityProps {
  transactions: RecentTransactionMobile[];
  /** Account IDs that have pending occurrences — enables "Vincular a recurrente" */
  linkableAccountIds?: Set<string>;
}
```

Update the component signature:

```typescript
export function InicioActivity({ transactions, linkableAccountIds }: InicioActivityProps) {
```

- [ ] **Step 2: Add link action in expanded view**

Add imports at the top:

```typescript
import { Link2 } from "lucide-react";
import { useState, useTransition } from "react";
import {
  getCandidateOccurrencesForTransaction,
  linkExistingTransactionToOccurrence,
} from "@/actions/occurrences";
import type { CandidateOccurrence } from "@/actions/occurrences";
import { LinkPickerSheet, type LinkCandidate } from "@/components/recurring/link-picker-sheet";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { toast } from "sonner";
```

Add state and handlers inside the component:

```typescript
  const [linkingTxId, setLinkingTxId] = useState<string | null>(null);
  const [occurrenceCandidates, setOccurrenceCandidates] = useState<CandidateOccurrence[]>([]);
  const [isLinking, startLinkTransition] = useTransition();

  const handleOpenLinkPicker = async (txId: string) => {
    setLinkingTxId(txId);
    const result = await getCandidateOccurrencesForTransaction(txId);
    if (result.success) {
      setOccurrenceCandidates(result.data);
    } else {
      toast.error(result.error ?? "Error al buscar recurrentes");
      setLinkingTxId(null);
    }
  };

  const handleConfirmLink = (occurrenceId: string) => {
    if (!linkingTxId) return;
    const txId = linkingTxId;
    setLinkingTxId(null);
    startLinkTransition(async () => {
      const result = await linkExistingTransactionToOccurrence(occurrenceId, txId);
      if (result.success) {
        toast.success("Transacción vinculada a recurrente");
      } else {
        toast.error(result.error ?? "No se pudo vincular");
      }
    });
  };
```

In the expanded inline panel (around line 124, inside the `PANEL_INSET_CLASS` div), add the link button conditionally. Replace the existing expanded content div:

```tsx
<div className={cn(PANEL_INSET_CLASS, "border-z-brass/15 bg-black/20 p-2.5 flex items-center justify-between")}>
  <span className="text-[11px] text-muted-foreground">
    {tx.direction === "INFLOW" ? "Ingreso" : "Gasto"} &middot; {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
  </span>
  <div className="flex items-center gap-2">
    {linkableAccountIds?.has(tx.account_id) && !tx.recurrence_group_id && (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          handleOpenLinkPicker(tx.id);
        }}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-z-brass"
      >
        <Link2 className="size-2.5" />
        Vincular a recurrente
      </button>
    )}
    <Link
      href={`/transactions/${tx.id}`}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-z-brass"
    >
      <Pencil className="size-2.5" />
      Ver detalle
    </Link>
  </div>
</div>
```

Note: this requires adding `recurrence_group_id` to the `RecentTransactionMobile` interface:

```typescript
interface RecentTransactionMobile {
  id: string;
  description: string;
  amount: number;
  currency_code: string;
  direction: "INFLOW" | "OUTFLOW";
  account_name: string;
  account_color: string | null;
  category_name: string | null;
  category_icon: string | null;
  recurrence_group_id: string | null;
  tags: Array<{ id: string; name: string; color: string | null; group_color: string | null }>;
}
```

Add the `LinkPickerSheet` at the bottom of the component return, before the closing `</div>`:

```tsx
      {linkingTxId && (
        <LinkPickerSheet
          open={!!linkingTxId}
          onOpenChange={(open) => { if (!open) setLinkingTxId(null); }}
          title="Vincular a recurrente"
          subtitle={(() => {
            const tx = transactions.find((t) => t.id === linkingTxId);
            return tx ? `${tx.description} · ${formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}` : "";
          })()}
          candidates={occurrenceCandidates.map((o) => ({
            id: o.id,
            label: o.merchant,
            sublabel: `${formatDate(o.occurrenceDate)} · ${formatCurrency(o.expectedAmount, o.currencyCode as CurrencyCode)} esperado`,
            amount: o.expectedAmount,
            currencyCode: o.currencyCode,
            direction: transactions.find((t) => t.id === linkingTxId)?.direction ?? "OUTFLOW",
            matchScore: o.matchScore,
            icon: o.categoryIcon,
            iconColor: o.categoryColor,
          }))}
          onConfirm={handleConfirmLink}
          isPending={isLinking}
        />
      )}
```

- [ ] **Step 3: Pass `linkableAccountIds` from the parent page**

Find the parent that renders `InicioActivity` and pass the prop. The parent needs to call `getAccountIdsWithPendingOccurrences()` and pass it as a Set. Also pass `recurrence_group_id` in the transaction data.

```bash
cd webapp && grep -rn "InicioActivity" src/ --include="*.tsx" -l
```

In the parent, add:

```typescript
import { getAccountIdsWithPendingOccurrences } from "@/actions/occurrences";
```

And in the data loading:

```typescript
const linkableIds = await getAccountIdsWithPendingOccurrences();
```

Pass to the component:

```tsx
<InicioActivity
  transactions={recentTransactions}
  linkableAccountIds={new Set(linkableIds)}
/>
```

- [ ] **Step 4: Verify build**

```bash
cd webapp && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/mobile/v2/inicio/inicio-activity.tsx \
        webapp/src/app/\(dashboard\)/page.tsx \
        webapp/src/components/mobile/v2/inicio/*.tsx
git commit -m "feat: add 'Vincular a recurrente' to transaction expanded view"
```

---

### Task 7: Review gates — spawn agents

- [ ] **Step 1: Spawn `server-action-reviewer`**

After Tasks 2-3 (server actions complete). Review `webapp/src/actions/occurrences.ts` for:
- Auth checks on all new actions
- Defense-in-depth `.eq("user_id", user.id)` on all queries
- Proper revalidation after mutations
- Return type compliance

- [ ] **Step 2: Spawn `cache-doctor`**

Review the new cached query `getAccountIdsWithPendingOccurrencesCached` for:
- Correct `cacheTag` + `cacheLife` usage
- Proper `createCachedClient(accessToken)` pattern
- Revalidation path from `linkExistingTransactionToOccurrence` to the cached query

- [ ] **Step 3: Spawn `zetas-front-guy`**

After Tasks 4-6 (UI complete). Review `link-picker-sheet.tsx` + modified TSX files for:
- Design token compliance (no hardcoded colors)
- Button variant compliance
- Mobile bottom sheet clearance (`MOBILE_TAB_BAR_CLEARANCE_CLASS`)

- [ ] **Step 4: Fix any issues found by agents**

Address findings inline. Re-run `pnpm build` after fixes.

- [ ] **Step 5: Commit fixes**

```bash
git add -A
git commit -m "fix: address review agent findings"
```

---

### Task 8: Manual test + final verification

- [ ] **Step 1: Start dev server**

```bash
cd webapp && pnpm dev
```

- [ ] **Step 2: Test occurrence → transaction flow**

1. Open the plan page (mobile view)
2. Find a pending occurrence
3. Tap to expand, click "Vincular existente"
4. Verify the drawer opens with ranked candidates
5. Select a transaction, click "Vincular"
6. Verify occurrence moves to completed section
7. Verify toast shows success

- [ ] **Step 3: Test transaction → occurrence flow**

1. Open the inicio/dashboard page (mobile view)
2. Find a transaction with a pending occurrence on the same account
3. Tap to expand, verify "Vincular a recurrente" appears
4. Click it, verify the drawer opens with pending occurrences
5. Select one, click "Vincular"
6. Verify toast shows success

- [ ] **Step 4: Test smart undo**

1. On the plan page, find the just-linked occurrence (now completed)
2. Click "Deshacer"
3. Verify: occurrence goes back to pending, transaction still exists (not deleted)
4. Check the transaction — `recurrence_group_id` should be null again

- [ ] **Step 5: Test that system-created undo still deletes**

1. Use "Confirmar pago" on a pending occurrence (creates a new tx)
2. Click "Deshacer"
3. Verify the created transaction IS deleted and balance IS reversed

- [ ] **Step 6: Production build gate**

```bash
cd webapp && pnpm build
```

Expected: clean build, no type errors.

- [ ] **Step 7: Commit any fixes from testing**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```

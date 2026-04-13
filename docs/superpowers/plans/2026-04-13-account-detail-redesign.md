# Account Detail Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the account detail page with a card-visual hero (flip to graph), quick actions bar, transfer functionality, and recent transactions list.

**Architecture:** Full rewrite of `accounts/[id]/page.tsx`. Three hero variants by account type: FlipZone (card ↔ graph), BalanceGraphHero, SpendingPulseHero. New `transfer_group_id` links paired transfer transactions. Two new server actions: `getAccountTransactions` and `createTransfer`. Cashflow metrics updated to exclude same-user transfers.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind v4, shadcn/ui, Recharts, Supabase (encrypted tables), Zod validation.

**Agents to spawn:**
- `supabase-migrator` — Tasks 1-2 (encrypted table column additions)
- `server-action-reviewer` — Tasks 3-5 (new/modified server actions)
- `zetas-front-guy` — Task 15 (after all UI components assembled)
- `perf-auditor` — Task 16 (final performance check)

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/<ts>_add_card_brand_to_accounts.sql` | Add `card_brand` TEXT to accounts_enc + view + triggers |
| `supabase/migrations/<ts>_add_transfer_group_id.sql` | Add `transfer_group_id` UUID to transactions_enc + view + triggers |
| `webapp/src/components/accounts/card-face.tsx` | Card visual (institution, brand, mask, balance) |
| `webapp/src/components/accounts/graph-face.tsx` | Balance-over-time chart face |
| `webapp/src/components/accounts/flip-zone.tsx` | Client component managing card ↔ graph flip |
| `webapp/src/components/accounts/spending-pulse-hero.tsx` | Balance + sparkline + monthly spend badge |
| `webapp/src/components/accounts/balance-graph-hero.tsx` | Graph hero for loans/investments |
| `webapp/src/components/accounts/account-hero.tsx` | Orchestrator — picks hero variant by account type |
| `webapp/src/components/accounts/quick-actions-bar.tsx` | Horizontal icon action bar |
| `webapp/src/components/accounts/transfer-dialog.tsx` | Transfer between accounts dialog |
| `webapp/src/components/accounts/compact-transaction-row.tsx` | Minimal transaction row (date, merchant, amount) |
| `webapp/src/components/accounts/recent-transactions.tsx` | Transaction list section with pagination |
| `webapp/src/components/accounts/statement-snapshots-card.tsx` | Compact link to snapshots |
| `webapp/src/components/accounts/range-pills.tsx` | Time range selector (3M, 6M, 1A, Todo) |
| `webapp/src/lib/validators/transfer.ts` | Zod schema for transfer creation |

### Modified Files
| File | Changes |
|------|---------|
| `webapp/src/actions/accounts.ts` | Add `getAccountTransactions()` cached action |
| `webapp/src/actions/transfers.ts` | New file — `createTransfer()` action |
| `webapp/src/actions/charts.ts` | Exclude `transfer_group_id` pairs from cashflow |
| `webapp/src/lib/validators/account.ts` | Add `card_brand` to `accountSchema` |
| `webapp/src/components/accounts/account-form-dialog.tsx` | Add `card_brand` select field |
| `webapp/src/app/(dashboard)/accounts/[id]/page.tsx` | Full rewrite |
| `webapp/src/types/database.ts` | Regenerated (new columns) |

---

## Task 1: Migration — Add `card_brand` to accounts

> **Agent:** Spawn `supabase-migrator` with context below. accounts is an encrypted table (`accounts_enc` + `accounts` view + INSTEAD OF triggers). `card_brand` is plaintext (not PII).

**Files:**
- Create: `supabase/migrations/<timestamp>_add_card_brand_to_accounts.sql`

- [ ] **Step 1: Generate migration file**

```bash
cd /Users/cristian/Documents/developing/current-projects/zeta && npx supabase migration new add_card_brand_to_accounts
```

- [ ] **Step 2: Write migration SQL**

The migration must:
1. Add `card_brand TEXT` column to `accounts_enc`
2. DROP and recreate the `accounts` view to include `card_brand` (pass-through, no encryption)
3. Update all three INSTEAD OF triggers (INSERT, UPDATE, DELETE) to handle `card_brand`

Reference the existing accounts view definition in migration `20260408143002_encrypt_accounts.sql` for the full column list. The new column is plaintext so it just passes through — no `zeta_encrypt`/`zeta_decrypt` needed.

```sql
-- 1. Add column to physical table
ALTER TABLE accounts_enc ADD COLUMN card_brand TEXT;

-- 2. Recreate view (must DROP + CREATE because adding a column)
-- Copy existing view definition from 20260408143002_encrypt_accounts.sql
-- and add: card_brand (plaintext pass-through)
DROP VIEW IF EXISTS accounts CASCADE;
CREATE VIEW accounts WITH (security_invoker = true) AS
SELECT
  id, user_id,
  zeta_decrypt(name) AS name,
  account_type, currency_code, icon, color,
  current_balance, available_balance, credit_limit,
  currency_balances,
  zeta_decrypt(institution_name) AS institution_name,
  zeta_decrypt(mask) AS mask,
  zeta_decrypt(debit_card_mask) AS debit_card_mask,
  mask_hmac,
  zeta_decrypt(provider_account_id) AS provider_account_id,
  provider_account_id_hmac,
  provider, connection_status, last_synced_at,
  cutoff_day, payment_day, interest_rate,
  loan_amount, loan_start_date, loan_end_date, monthly_payment,
  initial_investment, expected_return_rate, maturity_date,
  show_in_dashboard, display_order, is_active, is_demo, is_payroll_deducted,
  zeta_decrypt(pdf_password) AS pdf_password,
  card_brand,  -- NEW: plaintext pass-through
  created_at, updated_at
FROM accounts_enc;

-- 3. Recreate INSTEAD OF INSERT trigger function
-- (copy from 20260408143002, add card_brand to INSERT ... VALUES)
-- Add NEW.card_brand to the INSERT into accounts_enc

-- 4. Recreate INSTEAD OF UPDATE trigger function
-- Add: card_brand = NEW.card_brand to the UPDATE SET clause

-- 5. Recreate INSTEAD OF DELETE trigger function
-- (no changes needed — deletes by id)

-- 6. Recreate triggers on the view
-- (same trigger names, pointing to updated functions)
```

**Important:** Read `supabase/migrations/20260408143002_encrypt_accounts.sql` for the exact trigger function bodies. Copy them and add `card_brand` to the relevant clauses.

- [ ] **Step 3: Push migration**

```bash
npx supabase db push
```

- [ ] **Step 4: Regenerate TypeScript types**

```bash
npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > webapp/src/types/database.ts
```

Verify `card_brand` appears in both `accounts_enc` table type and `accounts` view type. Check `export type Json =` header is intact.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/ webapp/src/types/database.ts
git commit -m "feat(db): add card_brand column to accounts"
```

---

## Task 2: Migration — Add `transfer_group_id` to transactions

> **Agent:** Spawn `supabase-migrator`. Same pattern as Task 1 — `transactions_enc` is encrypted.

**Files:**
- Create: `supabase/migrations/<timestamp>_add_transfer_group_id.sql`

- [ ] **Step 1: Generate migration file**

```bash
npx supabase migration new add_transfer_group_id
```

- [ ] **Step 2: Write migration SQL**

Same pattern as Task 1 but for `transactions_enc`:
1. Add `transfer_group_id UUID` to `transactions_enc`
2. Create partial index on `transfer_group_id WHERE transfer_group_id IS NOT NULL`
3. DROP and recreate `transactions` view with `transfer_group_id` (plaintext pass-through)
4. Update INSTEAD OF INSERT, UPDATE, DELETE trigger functions

Reference: `supabase/migrations/20260408143001_encrypt_transactions.sql` for exact view/trigger definitions.

```sql
ALTER TABLE transactions_enc ADD COLUMN transfer_group_id UUID;
CREATE INDEX idx_transactions_transfer_group
  ON transactions_enc(transfer_group_id)
  WHERE transfer_group_id IS NOT NULL;
```

- [ ] **Step 3: Push migration and regenerate types**

```bash
npx supabase db push
npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > webapp/src/types/database.ts
```

Verify `transfer_group_id` appears in transaction types. Check `export type Json =` header intact.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/ webapp/src/types/database.ts
git commit -m "feat(db): add transfer_group_id to transactions"
```

---

## Task 3: Validator — Transfer schema

**Files:**
- Create: `webapp/src/lib/validators/transfer.ts`
- Modify: `webapp/src/lib/validators/account.ts`

- [ ] **Step 1: Create transfer validator**

```typescript
// webapp/src/lib/validators/transfer.ts
import { z } from "zod";

export const transferSchema = z
  .object({
    fromAccountId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "ID inválido"),
    toAccountId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "ID inválido"),
    amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
    currencyCode: z.string().min(3).max(3),
    date: z.string().min(1, "La fecha es requerida"),
    notes: z.string().max(500).optional(),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: "Las cuentas de origen y destino deben ser diferentes",
    path: ["toAccountId"],
  });

export type TransferInput = z.infer<typeof transferSchema>;
```

- [ ] **Step 2: Add `card_brand` to account validator**

In `webapp/src/lib/validators/account.ts`, add to `accountSchema`:

```typescript
card_brand: z.enum(["VISA", "MASTERCARD", "AMEX", "DINERS", "DISCOVER"]).optional().nullable(),
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/lib/validators/transfer.ts webapp/src/lib/validators/account.ts
git commit -m "feat: add transfer and card_brand validators"
```

---

## Task 4: Server Action — `getAccountTransactions`

> **Agent:** Spawn `server-action-reviewer` after implementation.

**Files:**
- Modify: `webapp/src/actions/accounts.ts`

- [ ] **Step 1: Add cached inner function**

Add below the existing cached functions in `webapp/src/actions/accounts.ts`:

```typescript
async function getAccountTransactionsCached(
  userId: string,
  accessToken: string,
  accountId: string,
  limit: number,
  offset: number,
): Promise<{ transactions: TransactionWithAccount[]; hasMore: boolean }> {
  "use cache";
  cacheTag("transactions", "zeta");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  const { data, error, count } = await supabase
    .from("transactions")
    .select(
      "*, account:accounts!inner(id, name, icon, color), category:categories(id, name, name_es, icon, color), destinatario:destinatarios(id, name)",
      { count: "exact" },
    )
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .eq("is_excluded", false)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    transactions: (data ?? []) as TransactionWithAccount[],
    hasMore: (count ?? 0) > offset + limit,
  };
}
```

- [ ] **Step 2: Add public wrapper**

```typescript
export async function getAccountTransactions(
  accountId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ transactions: TransactionWithAccount[]; hasMore: boolean }> {
  const { supabase, user } = await getAuthenticatedClient();
  const session = await supabase.auth.getSession();
  const accessToken = session.data.session!.access_token;
  const limit = opts.limit ?? 10;
  const offset = opts.offset ?? 0;

  return getAccountTransactionsCached(user.id, accessToken, accountId, limit, offset);
}
```

- [ ] **Step 3: Add necessary imports**

Ensure `TransactionWithAccount` is imported from `@/types/domain`, and `createCachedClient` from `@/lib/supabase/cached`. Also `cacheTag` from `next/cache` and `cacheLife` from `next/cache` (check existing import pattern in the file).

- [ ] **Step 4: Verify build**

```bash
cd webapp && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add webapp/src/actions/accounts.ts
git commit -m "feat: add getAccountTransactions cached action"
```

---

## Task 5: Server Action — `createTransfer`

> **Agent:** Spawn `server-action-reviewer` after implementation.

**Files:**
- Create: `webapp/src/actions/transfers.ts`

- [ ] **Step 1: Create the transfer action**

```typescript
// webapp/src/actions/transfers.ts
"use server";

import { revalidateTag } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { transferSchema } from "@/lib/validators/transfer";
import type { ActionResult } from "@/types/actions";

export async function createTransfer(
  _prevState: ActionResult<{ outflowId: string; inflowId: string }>,
  formData: FormData,
): Promise<ActionResult<{ outflowId: string; inflowId: string }>> {
  const { supabase, user } = await getAuthenticatedClient();

  const raw = {
    fromAccountId: formData.get("fromAccountId") as string,
    toAccountId: formData.get("toAccountId") as string,
    amount: formData.get("amount") as string,
    currencyCode: formData.get("currencyCode") as string,
    date: formData.get("date") as string,
    notes: formData.get("notes") as string | undefined,
  };

  const parsed = transferSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { fromAccountId, toAccountId, amount, currencyCode, date, notes } = parsed.data;
  const transferGroupId = uuidv4();
  const description = notes || "Transferencia entre cuentas";

  // Insert outflow (source account)
  const { data: outflow, error: outErr } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      account_id: fromAccountId,
      amount,
      currency_code: currencyCode,
      direction: "OUTFLOW",
      transaction_date: date,
      raw_description: description,
      clean_description: description,
      capture_method: "MANUAL_FORM",
      transfer_group_id: transferGroupId,
    })
    .select("id")
    .single();

  if (outErr) {
    return { success: false, error: "Error al crear la transferencia de salida" };
  }

  // Insert inflow (destination account)
  const { data: inflow, error: inErr } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      account_id: toAccountId,
      amount,
      currency_code: currencyCode,
      direction: "INFLOW",
      transaction_date: date,
      raw_description: description,
      clean_description: description,
      capture_method: "MANUAL_FORM",
      transfer_group_id: transferGroupId,
    })
    .select("id")
    .single();

  if (inErr) {
    // Rollback: delete the outflow we just created
    await supabase.from("transactions").delete().eq("id", outflow.id).eq("user_id", user.id);
    return { success: false, error: "Error al crear la transferencia de entrada" };
  }

  // Update balances on both accounts
  const { error: fromBalErr } = await supabase.rpc("apply_account_balance_delta", {
    p_account_id: fromAccountId,
    p_delta: -amount,
  });

  const { error: toBalErr } = await supabase.rpc("apply_account_balance_delta", {
    p_account_id: toAccountId,
    p_delta: amount,
  });

  if (fromBalErr || toBalErr) {
    console.error("Balance delta errors:", { fromBalErr, toBalErr });
  }

  revalidateTag("transactions", "zeta");
  revalidateTag("accounts", "zeta");
  revalidateTag("dashboard:hero", "zeta");
  revalidateTag("dashboard:accounts", "zeta");
  revalidateTag("dashboard:charts", "zeta");
  revalidateTag("dashboard:cashflow", "zeta");

  return {
    success: true,
    data: { outflowId: outflow.id, inflowId: inflow.id },
  };
}
```

**Note:** Check if `apply_account_balance_delta` RPC exists. If not, use the pattern from `reconcileBalance` in `accounts.ts` — direct balance update via `.update({ current_balance })` after reading current value. Read `accounts.ts` to confirm the exact pattern.

- [ ] **Step 2: Verify build**

```bash
cd webapp && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/transfers.ts
git commit -m "feat: add createTransfer server action"
```

---

## Task 6: Cashflow — Exclude transfers

**Files:**
- Modify: `webapp/src/actions/charts.ts` (lines ~175-192)

- [ ] **Step 1: Update `getMonthlyCashflowCached` to exclude transfers**

In the transaction loop (around line 175), add transfer exclusion:

```typescript
for (const tx of transactions) {
  const m = tx.transaction_date.substring(0, 7);
  const entry = map.get(m)!;
  const acctType = (tx.accounts as { account_type: string } | null)?.account_type;
  const isDebtAccount = acctType === "CREDIT_CARD" || acctType === "LOAN";

  // Skip internal transfers — they are not income or expense
  if (tx.transfer_group_id) continue;

  if (tx.direction === "INFLOW" && !isDebtAccount) {
    entry.income += tx.amount;
  } else if (tx.direction === "OUTFLOW") {
    entry.expenses += tx.amount;
  }
}
```

- [ ] **Step 2: Ensure `transfer_group_id` is in the SELECT**

Check the Supabase query in `getMonthlyCashflowCached` (around line 163). The select likely uses `*` or specific columns. If specific columns, add `transfer_group_id`. If `*`, it's already included after type regen.

- [ ] **Step 3: Apply same exclusion to other cashflow functions**

Check `getDailySpending`, `getCategorySpending`, `getMonthMetrics`, `getDailyCashflow`, `getDashboardHeroData`, `getDailyBudgetPace` — any function that sums income/expense must exclude transfers. Add the same `if (tx.transfer_group_id) continue;` guard.

- [ ] **Step 4: Verify build**

```bash
cd webapp && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add webapp/src/actions/charts.ts
git commit -m "fix: exclude internal transfers from cashflow metrics"
```

---

## Task 7: Component — RangePills

**Files:**
- Create: `webapp/src/components/accounts/range-pills.tsx`

- [ ] **Step 1: Create RangePills client component**

```typescript
// webapp/src/components/accounts/range-pills.tsx
"use client";

import { cn } from "@/lib/utils";

const RANGES = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1A", months: 12 },
  { label: "Todo", months: 0 },
] as const;

export type RangeValue = (typeof RANGES)[number]["months"];

interface RangePillsProps {
  value: RangeValue;
  onChange: (value: RangeValue) => void;
  className?: string;
}

export function RangePills({ value, onChange, className }: RangePillsProps) {
  return (
    <div className={cn("flex gap-1", className)}>
      {RANGES.map((r) => (
        <button
          key={r.label}
          onClick={() => onChange(r.months)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
            value === r.months
              ? "bg-z-brass text-z-ink"
              : "bg-white/[0.04] text-z-muted hover:bg-white/[0.08]",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/accounts/range-pills.tsx
git commit -m "feat: add RangePills component"
```

---

## Task 8: Component — CardFace

**Files:**
- Create: `webapp/src/components/accounts/card-face.tsx`

- [ ] **Step 1: Create CardFace component**

```typescript
// webapp/src/components/accounts/card-face.tsx
import { formatCurrency } from "@/lib/utils/currency";
import type { Account } from "@/types/domain";

// Default gradients per institution (extend as needed)
const INSTITUTION_GRADIENTS: Record<string, string> = {
  bancolombia: "from-[#2d3a2e] via-[#4a5d3e] to-[#c9a96e]",
  nequi: "from-[#2d1f4e] via-[#4a2d7a] to-[#e040fb]",
  davivienda: "from-[#8b1a1a] via-[#c62828] to-[#ff5252]",
  nu: "from-[#3d1f6d] via-[#7b1fa2] to-[#ce93d8]",
};

const BRAND_LABELS: Record<string, string> = {
  VISA: "VISA",
  MASTERCARD: "Mastercard",
  AMEX: "AMEX",
  DINERS: "Diners",
  DISCOVER: "Discover",
};

function getGradient(account: Account): string {
  const key = account.institution_name?.toLowerCase().replace(/\s+/g, "") ?? "";
  return INSTITUTION_GRADIENTS[key] ?? "from-[#2a2a2a] via-[#3a3a3a] to-[#4a4a4a]";
}

interface CardFaceProps {
  account: Account;
}

export function CardFace({ account }: CardFaceProps) {
  const gradient = getGradient(account);
  const mask = account.account_type === "CREDIT_CARD"
    ? account.mask
    : account.debit_card_mask ?? account.mask;
  const isDebt = account.account_type === "CREDIT_CARD" || account.account_type === "LOAN";
  const brandLabel = account.card_brand
    ? BRAND_LABELS[account.card_brand] ?? account.card_brand
    : isDebt ? "CRÉDITO" : "DÉBITO";

  return (
    <div
      className={`bg-gradient-to-br ${gradient} flex aspect-[85.6/53.98] flex-col justify-between rounded-xl p-4 text-white`}
    >
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
          {account.institution_name ?? "Cuenta"}
        </span>
        <span className="text-[10px] font-medium text-white/50">
          {brandLabel}
        </span>
      </div>

      <div>
        <p className="text-[9px] text-white/50">
          {isDebt ? "Saldo pendiente" : "Saldo"}
        </p>
        <p className="text-xl font-bold">
          {formatCurrency(Math.abs(account.current_balance), account.currency_code)}
        </p>
      </div>

      <div className="flex items-end justify-between">
        <span className="text-xs tracking-[3px] text-white/70">
          {mask ? `•••• ${mask}` : "••••"}
        </span>
        <span className="text-[9px] text-white/40">
          {account.currency_code}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/accounts/card-face.tsx
git commit -m "feat: add CardFace component"
```

---

## Task 9: Component — GraphFace

**Files:**
- Create: `webapp/src/components/accounts/graph-face.tsx`

- [ ] **Step 1: Create GraphFace client component**

This reuses data from `getStatementSnapshots` (already fetched on page). Renders a compact area chart inside the same dimensions as the card.

```typescript
// webapp/src/components/accounts/graph-face.tsx
"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { RangeValue } from "./range-pills";

interface SnapshotPoint {
  date: string;
  balance: number;
}

interface GraphFaceProps {
  data: SnapshotPoint[];
  currencyCode: string;
  range: RangeValue;
  trendPercent?: number;
}

function filterByRange(data: SnapshotPoint[], months: RangeValue): SnapshotPoint[] {
  if (months === 0) return data;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffStr = cutoff.toISOString().substring(0, 10);
  return data.filter((d) => d.date >= cutoffStr);
}

export function GraphFace({ data, currencyCode, range, trendPercent }: GraphFaceProps) {
  const filtered = filterByRange(data, range);
  const currentBalance = filtered.length > 0 ? filtered[filtered.length - 1].balance : 0;

  return (
    <div className="flex aspect-[85.6/53.98] flex-col justify-between rounded-xl bg-white/[0.03] p-4 text-white">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-bold">
            {formatCurrency(Math.abs(currentBalance), currencyCode)}
          </p>
          <p className="text-[9px] text-white/50">Saldo actual</p>
        </div>
        {trendPercent !== undefined && (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              trendPercent >= 0
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {trendPercent >= 0 ? "▲" : "▼"} {Math.abs(trendPercent).toFixed(1)}%
          </span>
        )}
      </div>

      <div className="flex-1 pt-1">
        {filtered.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filtered} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="graphFaceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c9a96e" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#c9a96e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const p = payload[0].payload as SnapshotPoint;
                  return (
                    <div className="rounded-md bg-z-surface-1 px-2 py-1 text-xs shadow-lg">
                      <p className="text-white/60">{formatDate(p.date)}</p>
                      <p className="font-medium">{formatCurrency(p.balance, currencyCode)}</p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#c9a96e"
                strokeWidth={2}
                fill="url(#graphFaceGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-white/30">
            Sin datos suficientes
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/accounts/graph-face.tsx
git commit -m "feat: add GraphFace component"
```

---

## Task 10: Component — FlipZone

**Files:**
- Create: `webapp/src/components/accounts/flip-zone.tsx`

- [ ] **Step 1: Create FlipZone client component**

```typescript
// webapp/src/components/accounts/flip-zone.tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CardFace } from "./card-face";
import { GraphFace } from "./graph-face";
import { RangePills, type RangeValue } from "./range-pills";
import type { Account } from "@/types/domain";

interface SnapshotPoint {
  date: string;
  balance: number;
}

interface FlipZoneProps {
  account: Account;
  snapshotData: SnapshotPoint[];
  trendPercent?: number;
}

export function FlipZone({ account, snapshotData, trendPercent }: FlipZoneProps) {
  const [flipped, setFlipped] = useState(false);
  const [range, setRange] = useState<RangeValue>(3);

  return (
    <div className="flex flex-col gap-3">
      {/* Flip container */}
      <div
        className="cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          className="relative transition-transform duration-[400ms] ease-in-out"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front: Card */}
          <div style={{ backfaceVisibility: "hidden" }}>
            <CardFace account={account} />
          </div>

          {/* Back: Graph */}
          <div
            className="absolute inset-0"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <GraphFace
              data={snapshotData}
              currencyCode={account.currency_code}
              range={range}
              trendPercent={trendPercent}
            />
          </div>
        </div>
      </div>

      {/* Fixed footer: dots + range pills */}
      <div className="flex items-center justify-between">
        {/* Dot indicators */}
        <div className="flex gap-1">
          <span
            className={cn(
              "h-[3px] w-[18px] rounded-full transition-colors",
              !flipped ? "bg-z-brass" : "bg-white/20",
            )}
          />
          <span
            className={cn(
              "h-[3px] w-[18px] rounded-full transition-colors",
              flipped ? "bg-z-brass" : "bg-white/20",
            )}
          />
        </div>

        {/* Range pills — visible only on graph face */}
        <div
          className={cn(
            "transition-all duration-300",
            flipped ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0",
          )}
        >
          <RangePills value={range} onChange={setRange} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/accounts/flip-zone.tsx
git commit -m "feat: add FlipZone card/graph flip component"
```

---

## Task 11: Component — SpendingPulseHero

**Files:**
- Create: `webapp/src/components/accounts/spending-pulse-hero.tsx`

- [ ] **Step 1: Create SpendingPulseHero client component**

```typescript
// webapp/src/components/accounts/spending-pulse-hero.tsx
"use client";

import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils/currency";
import type { Account } from "@/types/domain";

interface DailyPoint {
  date: string;
  amount: number;
}

interface SpendingPulseHeroProps {
  account: Account;
  monthlySpent: number;
  dailyActivity: DailyPoint[];
}

export function SpendingPulseHero({
  account,
  monthlySpent,
  dailyActivity,
}: SpendingPulseHeroProps) {
  const sparkData = useMemo(
    () => (dailyActivity.length > 0 ? dailyActivity : [{ date: "", amount: 0 }]),
    [dailyActivity],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">
            Saldo actual
          </p>
          <p className="text-3xl font-bold text-white">
            {formatCurrency(account.current_balance, account.currency_code)}
          </p>
          <p className="mt-0.5 text-xs text-white/40">
            {account.institution_name ?? account.name} {account.mask ? `· ••${account.mask}` : ""}
          </p>
        </div>

        <div className="rounded-lg border border-z-brass/30 bg-z-brass/10 px-3 py-2 text-center">
          <p className="text-[9px] font-medium uppercase tracking-wide text-z-brass">Este mes</p>
          <p className="text-lg font-semibold text-z-brass">
            -{formatCurrency(monthlySpent, account.currency_code)}
          </p>
        </div>
      </div>

      {/* 30-day sparkline */}
      <div>
        <p className="mb-1 text-[10px] text-white/30">Últimos 30 días</p>
        <div className="h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="sparkPulseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c9a96e" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#c9a96e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#c9a96e"
                strokeWidth={1.5}
                fill="url(#sparkPulseGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/accounts/spending-pulse-hero.tsx
git commit -m "feat: add SpendingPulseHero component"
```

---

## Task 12: Component — BalanceGraphHero

**Files:**
- Create: `webapp/src/components/accounts/balance-graph-hero.tsx`

- [ ] **Step 1: Create BalanceGraphHero client component**

For loans and investments — no flip, graph always visible, range always visible.

```typescript
// webapp/src/components/accounts/balance-graph-hero.tsx
"use client";

import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { RangePills, type RangeValue } from "./range-pills";
import type { Account } from "@/types/domain";

interface SnapshotPoint {
  date: string;
  balance: number;
}

interface BalanceGraphHeroProps {
  account: Account;
  snapshotData: SnapshotPoint[];
  trendPercent?: number;
}

function filterByRange(data: SnapshotPoint[], months: RangeValue): SnapshotPoint[] {
  if (months === 0) return data;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffStr = cutoff.toISOString().substring(0, 10);
  return data.filter((d) => d.date >= cutoffStr);
}

export function BalanceGraphHero({ account, snapshotData, trendPercent }: BalanceGraphHeroProps) {
  const [range, setRange] = useState<RangeValue>(6);
  const filtered = filterByRange(snapshotData, range);
  const isDebt = account.account_type === "LOAN";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">
            {isDebt ? "Saldo pendiente" : "Valor actual"}
          </p>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(Math.abs(account.current_balance), account.currency_code)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {trendPercent !== undefined && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                trendPercent >= 0
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {trendPercent >= 0 ? "▲" : "▼"} {Math.abs(trendPercent).toFixed(1)}%
            </span>
          )}
          <RangePills value={range} onChange={setRange} />
        </div>
      </div>

      <div className="h-[120px]">
        {filtered.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filtered} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="balGraphGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isDebt ? "#c9a96e" : "#7a9a6a"} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={isDebt ? "#c9a96e" : "#7a9a6a"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const p = payload[0].payload as SnapshotPoint;
                  return (
                    <div className="rounded-md bg-z-surface-1 px-2 py-1 text-xs shadow-lg">
                      <p className="text-white/60">{formatDate(p.date)}</p>
                      <p className="font-medium">{formatCurrency(p.balance, account.currency_code)}</p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke={isDebt ? "#c9a96e" : "#7a9a6a"}
                strokeWidth={2}
                fill="url(#balGraphGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-white/30">
            Sin datos suficientes
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/accounts/balance-graph-hero.tsx
git commit -m "feat: add BalanceGraphHero component for loans/investments"
```

---

## Task 13: Component — AccountHero

**Files:**
- Create: `webapp/src/components/accounts/account-hero.tsx`

- [ ] **Step 1: Create orchestrator component**

Picks the right hero variant based on account type.

```typescript
// webapp/src/components/accounts/account-hero.tsx
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/domain";
import { FlipZone } from "./flip-zone";
import { SpendingPulseHero } from "./spending-pulse-hero";
import { BalanceGraphHero } from "./balance-graph-hero";

interface SnapshotPoint {
  date: string;
  balance: number;
}

interface DailyPoint {
  date: string;
  amount: number;
}

interface AccountHeroProps {
  account: Account;
  snapshotData: SnapshotPoint[];
  trendPercent?: number;
  monthlySpent?: number;
  dailyActivity?: DailyPoint[];
}

const CARD_TYPES = new Set(["CREDIT_CARD", "SAVINGS"]);

function hasCardVisual(account: Account): boolean {
  if (CARD_TYPES.has(account.account_type)) return true;
  if (account.account_type === "CHECKING" && account.debit_card_mask) return true;
  return false;
}

const GRAPH_TYPES = new Set(["LOAN", "INVESTMENT"]);

export function AccountHero({
  account,
  snapshotData,
  trendPercent,
  monthlySpent = 0,
  dailyActivity = [],
}: AccountHeroProps) {
  return (
    <div className={cn(PANEL_SURFACE_CLASS, "p-5")}>
      {/* Account name + type header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">{account.name}</h1>
          <p className="text-xs text-white/40">
            {account.institution_name}
            {account.mask ? ` · ••${account.mask}` : ""}
          </p>
        </div>
      </div>

      {/* Hero variant */}
      {hasCardVisual(account) ? (
        <FlipZone
          account={account}
          snapshotData={snapshotData}
          trendPercent={trendPercent}
        />
      ) : GRAPH_TYPES.has(account.account_type) ? (
        <BalanceGraphHero
          account={account}
          snapshotData={snapshotData}
          trendPercent={trendPercent}
        />
      ) : (
        <SpendingPulseHero
          account={account}
          monthlySpent={monthlySpent}
          dailyActivity={dailyActivity}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/accounts/account-hero.tsx
git commit -m "feat: add AccountHero orchestrator component"
```

---

## Task 14: Components — QuickActionsBar, TransferDialog, CompactTransactionRow, RecentTransactions, StatementSnapshotsCard

> This task creates the remaining UI components. Each is small and focused.

**Files:**
- Create: `webapp/src/components/accounts/quick-actions-bar.tsx`
- Create: `webapp/src/components/accounts/transfer-dialog.tsx`
- Create: `webapp/src/components/accounts/compact-transaction-row.tsx`
- Create: `webapp/src/components/accounts/recent-transactions.tsx`
- Create: `webapp/src/components/accounts/statement-snapshots-card.tsx`

### Step-by-step:

- [ ] **Step 1: QuickActionsBar**

```typescript
// webapp/src/components/accounts/quick-actions-bar.tsx
"use client";

import { useState } from "react";
import { HandCoins, ArrowLeftRight, Plus, RefreshCw, Ellipsis } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuickPaymentDialog } from "./quick-payment-dialog";
import { ReconcileBalanceDialog } from "./reconcile-balance-dialog";
import { AccountFormDialog } from "./account-form-dialog";
import { DeleteAccountButton } from "./delete-account-button";
import { TransferDialog } from "./transfer-dialog";
import type { Account } from "@/types/domain";

interface QuickActionsBarProps {
  account: Account;
  allAccounts: Account[];
}

interface ActionDef {
  icon: React.ReactNode;
  label: string;
  key: string;
}

const ACTIONS_BY_TYPE: Record<string, string[]> = {
  CREDIT_CARD: ["pagar", "agregar", "ajustar", "mas"],
  SAVINGS: ["transferir", "agregar", "ajustar", "mas"],
  CHECKING: ["transferir", "agregar", "ajustar", "mas"],
  LOAN: ["pagar", "ajustar", "mas"],
  CASH: ["transferir", "agregar", "ajustar", "mas"],
  INVESTMENT: ["ajustar", "mas"],
  OTHER: ["agregar", "ajustar", "mas"],
};

const ACTION_DEFS: Record<string, ActionDef> = {
  pagar: { icon: <HandCoins className="h-5 w-5" />, label: "Pagar", key: "pagar" },
  transferir: { icon: <ArrowLeftRight className="h-5 w-5" />, label: "Transferir", key: "transferir" },
  agregar: { icon: <Plus className="h-5 w-5" />, label: "Agregar", key: "agregar" },
  ajustar: { icon: <RefreshCw className="h-5 w-5" />, label: "Ajustar", key: "ajustar" },
  mas: { icon: <Ellipsis className="h-5 w-5" />, label: "Más", key: "mas" },
};

export function QuickActionsBar({ account, allAccounts }: QuickActionsBarProps) {
  const [payOpen, setPayOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const actions = ACTIONS_BY_TYPE[account.account_type] ?? ACTIONS_BY_TYPE.OTHER;

  function handleAction(key: string) {
    switch (key) {
      case "pagar": setPayOpen(true); break;
      case "transferir": setTransferOpen(true); break;
      case "ajustar": setReconcileOpen(true); break;
      case "agregar":
        // Navigate to transaction form with account prefilled
        window.location.href = `/transactions/new?account=${account.id}`;
        break;
    }
  }

  return (
    <>
      <div className="flex justify-center gap-4">
        {actions.map((key) => {
          const def = ACTION_DEFS[key];
          if (key === "mas") {
            return (
              <DropdownMenu key={key}>
                <DropdownMenuTrigger asChild>
                  <button className="flex flex-col items-center gap-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-white/70 transition-colors hover:bg-white/[0.1]">
                      {def.icon}
                    </div>
                    <span className="text-[10px] text-white/50">{def.label}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    Editar cuenta
                  </DropdownMenuItem>
                  <DeleteAccountButton accountId={account.id} accountName={account.name} asMenuItem />
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          return (
            <button
              key={key}
              className="flex flex-col items-center gap-1"
              onClick={() => handleAction(key)}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-white/70 transition-colors hover:bg-white/[0.1]">
                {def.icon}
              </div>
              <span className="text-[10px] text-white/50">{def.label}</span>
            </button>
          );
        })}
      </div>

      {/* Dialogs */}
      <QuickPaymentDialog
        account={account}
        accounts={allAccounts}
        open={payOpen}
        onOpenChange={setPayOpen}
      />
      <TransferDialog
        account={account}
        accounts={allAccounts}
        open={transferOpen}
        onOpenChange={setTransferOpen}
      />
      <ReconcileBalanceDialog
        account={account}
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
      />
      <AccountFormDialog
        account={account}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
```

**Note:** `QuickPaymentDialog`, `ReconcileBalanceDialog`, `AccountFormDialog` may need their props adjusted to accept `open`/`onOpenChange` for controlled mode. Check existing component signatures and adapt. `DeleteAccountButton` may need an `asMenuItem` variant — if not, wrap in a `DropdownMenuItem` and render the existing delete confirmation inline.

- [ ] **Step 2: TransferDialog**

```typescript
// webapp/src/components/accounts/transfer-dialog.tsx
"use client";

import { useActionState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTransfer } from "@/actions/transfers";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/domain";

interface TransferDialogProps {
  account: Account;
  accounts: Account[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferDialog({ account, accounts, open, onOpenChange }: TransferDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(createTransfer, { success: false, error: "" });

  const otherAccounts = accounts.filter(
    (a) => a.id !== account.id && a.account_type !== "LOAN" && a.account_type !== "INVESTMENT",
  );

  const today = new Date().toISOString().substring(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir fondos</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="fromAccountId" value={account.id} />
          <input type="hidden" name="currencyCode" value={account.currency_code} />

          <div className="space-y-2">
            <Label>Cuenta destino</Label>
            <Select name="toAccountId" required>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cuenta" />
              </SelectTrigger>
              <SelectContent>
                {otherAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.currency_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Monto</Label>
            <Input name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" />
          </div>

          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input name="date" type="date" defaultValue={today} required />
          </div>

          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Input name="notes" placeholder="Ej: Pago arriendo" />
          </div>

          {state && !state.success && state.error && (
            <p className="text-sm text-red-400">{state.error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className={cn(BRASS_BUTTON_CLASS)} disabled={isPending}>
              {isPending ? "Transfiriendo..." : "Transferir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: CompactTransactionRow**

```typescript
// webapp/src/components/accounts/compact-transaction-row.tsx
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import type { TransactionWithAccount } from "@/types/domain";

interface CompactTransactionRowProps {
  transaction: TransactionWithAccount;
  onClick?: () => void;
}

export function CompactTransactionRow({ transaction, onClick }: CompactTransactionRowProps) {
  const isInflow = transaction.direction === "INFLOW";
  const displayName =
    transaction.destinatario?.name ??
    transaction.clean_description ??
    transaction.raw_description ??
    "Sin descripción";

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{displayName}</p>
        <p className="text-[11px] text-white/40">
          {formatDate(transaction.transaction_date)}
          {transaction.category?.name_es ? ` · ${transaction.category.name_es}` : ""}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 text-sm font-medium",
          isInflow ? "text-emerald-400" : "text-white/80",
        )}
      >
        {isInflow ? "+" : "-"}
        {formatCurrency(transaction.amount, transaction.currency_code)}
      </span>
    </button>
  );
}
```

- [ ] **Step 4: RecentTransactions**

```typescript
// webapp/src/components/accounts/recent-transactions.tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { getAccountTransactions } from "@/actions/accounts";
import { GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { CompactTransactionRow } from "./compact-transaction-row";
import type { TransactionWithAccount } from "@/types/domain";

interface RecentTransactionsProps {
  accountId: string;
  initialTransactions: TransactionWithAccount[];
  initialHasMore: boolean;
}

export function RecentTransactions({
  accountId,
  initialTransactions,
  initialHasMore,
}: RecentTransactionsProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();

  function loadMore() {
    startTransition(async () => {
      const result = await getAccountTransactions(accountId, {
        limit: 10,
        offset: transactions.length,
      });
      setTransactions((prev) => [...prev, ...result.transactions]);
      setHasMore(result.hasMore);
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Transacciones</h2>
        <Link
          href={`/transactions?account=${accountId}`}
          className="text-xs text-z-brass hover:underline"
        >
          Ver todas
        </Link>
      </div>

      {transactions.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-white/40">No hay transacciones en esta cuenta</p>
          <Link
            href={`/transactions/new?account=${accountId}`}
            className={cn("mt-3 inline-block rounded-lg px-4 py-2 text-xs", GHOST_BUTTON_CLASS)}
          >
            Agregar transacción
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {transactions.map((tx) => (
            <CompactTransactionRow key={tx.id} transaction={tx} />
          ))}
        </div>
      )}

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={isPending}
          className={cn(
            "mt-3 w-full rounded-lg py-2 text-xs",
            GHOST_BUTTON_CLASS,
          )}
        >
          {isPending ? "Cargando..." : "Cargar más"}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: StatementSnapshotsCard**

```typescript
// webapp/src/components/accounts/statement-snapshots-card.tsx
import Link from "next/link";
import { FileText, ChevronRight } from "lucide-react";
import { PANEL_INSET_INTERACTIVE_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/date";

interface StatementSnapshotsCardProps {
  accountId: string;
  count: number;
  lastPeriod?: string;
}

export function StatementSnapshotsCard({
  accountId,
  count,
  lastPeriod,
}: StatementSnapshotsCardProps) {
  if (count === 0) return null;

  return (
    <Link
      href={`/accounts/${accountId}/snapshots`}
      className={cn(PANEL_INSET_INTERACTIVE_CLASS, "flex items-center gap-3 p-3")}
    >
      <FileText className="h-5 w-5 shrink-0 text-white/40" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">
          Extractos ({count})
        </p>
        {lastPeriod && (
          <p className="text-[11px] text-white/40">
            Último: {formatDate(lastPeriod)}
          </p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/20" />
    </Link>
  );
}
```

- [ ] **Step 6: Commit all components**

```bash
git add webapp/src/components/accounts/quick-actions-bar.tsx \
        webapp/src/components/accounts/transfer-dialog.tsx \
        webapp/src/components/accounts/compact-transaction-row.tsx \
        webapp/src/components/accounts/recent-transactions.tsx \
        webapp/src/components/accounts/statement-snapshots-card.tsx
git commit -m "feat: add QuickActionsBar, TransferDialog, RecentTransactions, SnapshotsCard"
```

---

## Task 15: Page Rewrite — `accounts/[id]/page.tsx`

**Files:**
- Modify: `webapp/src/app/(dashboard)/accounts/[id]/page.tsx` (full rewrite)

- [ ] **Step 1: Add data-fetching helpers**

Need two new data sources for SpendingPulseHero:
- Monthly spent for this account (current month outflows)
- Daily activity (last 30 days, daily outflow totals)

Add to `webapp/src/actions/accounts.ts`:

```typescript
export async function getAccountSpendingPulse(accountId: string): Promise<{
  monthlySpent: number;
  dailyActivity: { date: string; amount: number }[];
}> {
  const { supabase, user } = await getAuthenticatedClient();

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().substring(0, 10);

  // Monthly outflow total
  const { data: monthData } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", user.id)
    .eq("account_id", accountId)
    .eq("direction", "OUTFLOW")
    .eq("is_excluded", false)
    .gte("transaction_date", monthStart);

  const monthlySpent = (monthData ?? []).reduce((sum, tx) => sum + tx.amount, 0);

  // Daily activity (last 30 days)
  const { data: dailyData } = await supabase
    .from("transactions")
    .select("transaction_date, amount")
    .eq("user_id", user.id)
    .eq("account_id", accountId)
    .eq("direction", "OUTFLOW")
    .eq("is_excluded", false)
    .gte("transaction_date", thirtyDaysAgoStr)
    .order("transaction_date", { ascending: true });

  const dailyMap = new Map<string, number>();
  for (const tx of dailyData ?? []) {
    const d = tx.transaction_date;
    dailyMap.set(d, (dailyMap.get(d) ?? 0) + tx.amount);
  }
  const dailyActivity = Array.from(dailyMap, ([date, amount]) => ({ date, amount }));

  return { monthlySpent, dailyActivity };
}
```

- [ ] **Step 2: Rewrite the page**

Full rewrite of `webapp/src/app/(dashboard)/accounts/[id]/page.tsx`:

```typescript
import { connection } from "next/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getAccount,
  getAccounts,
  getAccountTransactions,
  getAccountSpendingPulse,
} from "@/actions/accounts";
import { getStatementSnapshots } from "@/actions/snapshots"; // verify import path
import { AccountHero } from "@/components/accounts/account-hero";
import { QuickActionsBar } from "@/components/accounts/quick-actions-bar";
import { RecentTransactions } from "@/components/accounts/recent-transactions";
import { StatementSnapshotsCard } from "@/components/accounts/statement-snapshots-card";
import { MobileHeader } from "@/components/mobile-header";
import { PAGE_STACK_CLASS } from "@/lib/constants/styles";

const TYPES_WITH_HISTORY = new Set(["CREDIT_CARD", "LOAN", "SAVINGS"]);
const SPENDING_PULSE_TYPES = new Set(["CHECKING", "CASH", "OTHER"]);

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AccountDetailPage({ params }: Props) {
  await connection();
  const { id } = await params;

  const [accountResult, allAccountsResult] = await Promise.all([
    getAccount(id),
    getAccounts(),
  ]);

  if (!accountResult.success || !accountResult.data) return notFound();
  const account = accountResult.data;
  const allAccounts = allAccountsResult.success ? allAccountsResult.data : [];

  // Parallel fetch: snapshots, transactions, spending pulse (conditional)
  const [snapshotsResult, txResult, spendingPulse] = await Promise.all([
    TYPES_WITH_HISTORY.has(account.account_type)
      ? getStatementSnapshots(id)
      : Promise.resolve({ success: true as const, data: [] }),
    getAccountTransactions(id, { limit: 10 }),
    SPENDING_PULSE_TYPES.has(account.account_type)
      ? getAccountSpendingPulse(id)
      : Promise.resolve({ monthlySpent: 0, dailyActivity: [] }),
  ]);

  const snapshots = snapshotsResult.success ? snapshotsResult.data : [];

  // Transform snapshots to chart data points
  const snapshotData = snapshots
    .filter((s: any) => s.period_to && s.final_balance != null)
    .map((s: any) => ({ date: s.period_to, balance: s.final_balance }))
    .sort((a: any, b: any) => a.date.localeCompare(b.date));

  // Calculate trend (last 2 snapshots)
  let trendPercent: number | undefined;
  if (snapshotData.length >= 2) {
    const prev = snapshotData[snapshotData.length - 2].balance;
    const curr = snapshotData[snapshotData.length - 1].balance;
    if (prev !== 0) {
      trendPercent = ((curr - prev) / Math.abs(prev)) * 100;
    }
  }

  const lastSnapshot = snapshots.length > 0
    ? snapshots.sort((a: any, b: any) => (b.period_to ?? "").localeCompare(a.period_to ?? ""))[0]
    : null;

  return (
    <>
      <MobileHeader title={account.name} backHref="/accounts" />

      <div className={PAGE_STACK_CLASS}>
        {/* Desktop back link */}
        <div className="hidden md:block">
          <Link
            href="/accounts"
            className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Cuentas
          </Link>
        </div>

        {/* Hero */}
        <AccountHero
          account={account}
          snapshotData={snapshotData}
          trendPercent={trendPercent}
          monthlySpent={spendingPulse.monthlySpent}
          dailyActivity={spendingPulse.dailyActivity}
        />

        {/* Quick Actions */}
        <QuickActionsBar account={account} allAccounts={allAccounts} />

        {/* Missing debit card banner for CHECKING without debit mask */}
        {account.account_type === "CHECKING" && !account.debit_card_mask && (
          <div className="rounded-lg border border-z-brass/20 bg-z-brass/5 px-4 py-3 text-center">
            <p className="text-xs text-z-brass">
              Agrega tu tarjeta débito para ver la vista de tarjeta
            </p>
          </div>
        )}

        {/* Recent Transactions */}
        <RecentTransactions
          accountId={id}
          initialTransactions={txResult.transactions}
          initialHasMore={txResult.hasMore}
        />

        {/* Statement Snapshots link */}
        {TYPES_WITH_HISTORY.has(account.account_type) && (
          <StatementSnapshotsCard
            accountId={id}
            count={snapshots.length}
            lastPeriod={lastSnapshot?.period_to}
          />
        )}
      </div>
    </>
  );
}
```

**Important adaptation notes:**
- Verify `getStatementSnapshots` import path — check existing import in current page
- Verify `MobileHeader` props — check component signature
- Verify `params` type — Next.js 15 uses `Promise<{ id: string }>` pattern
- Types for snapshot data may need casting — check `StatementSnapshot` type from domain.ts

- [ ] **Step 3: Update account form dialog for `card_brand`**

In `webapp/src/components/accounts/account-form-dialog.tsx`, add a `card_brand` select field for CREDIT_CARD and SAVINGS types:

```typescript
// Add inside the form, after institution_name field:
<div className="space-y-2">
  <Label>Red de tarjeta</Label>
  <Select name="card_brand" defaultValue={account?.card_brand ?? ""}>
    <SelectTrigger>
      <SelectValue placeholder="Sin especificar" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="">Sin especificar</SelectItem>
      <SelectItem value="VISA">Visa</SelectItem>
      <SelectItem value="MASTERCARD">Mastercard</SelectItem>
      <SelectItem value="AMEX">American Express</SelectItem>
      <SelectItem value="DINERS">Diners Club</SelectItem>
      <SelectItem value="DISCOVER">Discover</SelectItem>
    </SelectContent>
  </Select>
</div>
```

Show this field when `account_type` is CREDIT_CARD, SAVINGS, or CHECKING. Also update the `createAccount` and `updateAccount` actions in `accounts.ts` to handle `card_brand` from formData.

- [ ] **Step 4: Verify build**

```bash
cd webapp && pnpm build
```

Fix any type errors, missing imports, or prop mismatches. Common issues:
- Dialog components may not support controlled `open`/`onOpenChange` — may need refactoring to add this
- `getStatementSnapshots` may return a different shape than expected
- `DeleteAccountButton` may not have `asMenuItem` prop — adapt or wrap differently

- [ ] **Step 5: Commit**

```bash
git add webapp/src/app/(dashboard)/accounts/[id]/page.tsx \
        webapp/src/actions/accounts.ts \
        webapp/src/components/accounts/account-form-dialog.tsx
git commit -m "feat: rewrite account detail page with card hero, quick actions, transactions"
```

---

## Task 16: Review & Build Gates

- [ ] **Step 1: Run build**

```bash
cd webapp && pnpm install && pnpm build
```

Fix any errors.

- [ ] **Step 2: Spawn `server-action-reviewer`**

Review all new/modified actions:
- `webapp/src/actions/transfers.ts` — auth, validation, revalidation, defense-in-depth
- `webapp/src/actions/accounts.ts` — new `getAccountTransactions`, `getAccountSpendingPulse`
- `webapp/src/actions/charts.ts` — transfer exclusion logic

- [ ] **Step 3: Spawn `zetas-front-guy`**

Review all new TSX components for design system compliance:
- All files in `webapp/src/components/accounts/` that were created or modified
- `webapp/src/app/(dashboard)/accounts/[id]/page.tsx`

- [ ] **Step 4: Spawn `perf-auditor`**

Audit the new page for:
- New `getAccountTransactions` and `getAccountSpendingPulse` caching
- `Promise.all` parallelization
- No uncached queries in render path
- Client component boundaries are minimal

- [ ] **Step 5: Visual testing**

Start dev server (`cd webapp && pnpm dev`) and test in browser:
1. Credit card account → card hero visible, tap to flip, graph shows, range pills appear
2. Loan account → balance graph hero, range visible
3. Cash account → spending pulse hero
4. Quick actions → each button opens correct dialog
5. Transfer → create transfer, verify both accounts update
6. Recent transactions → list loads, "Cargar más" works
7. Statement snapshots card → shows count, navigates

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "fix: address review feedback from agents"
```

---

## Parallelization Guide

Tasks that can run in parallel (no dependencies):

| Group | Tasks | Why parallel |
|-------|-------|-------------|
| **Migrations** | Task 1 + Task 2 | Independent DB changes |
| **Server logic** | Task 3 + Task 4 + Task 5 | Independent files, no shared state |
| **Chart fix** | Task 6 | Depends on Task 2 (transfer_group_id exists in types) |
| **UI components** | Tasks 7-13 | All independent components, no shared state |
| **Wiring components** | Task 14 | Depends on some Task 7-13 components existing |
| **Page rewrite** | Task 15 | Depends on Tasks 1-14 |
| **Review** | Task 16 | Depends on everything |

**Recommended agent dispatch:**
- Agent 1: Tasks 1 + 2 (migrations — spawn `supabase-migrator`)
- Agent 2: Tasks 3 + 4 + 5 + 6 (server actions + cashflow fix)
- Agent 3: Tasks 7-13 (all standalone UI components)
- Main: Task 14 → Task 15 → Task 16 (wiring, page rewrite, review)

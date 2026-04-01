# Deseos — Wishlist & Purchase Behavior System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent wishlist under /deseos that scores items against real financial state, nudges when purchases become affordable, and builds purchase wisdom through post-buy reflections.

**Architecture:** Two new Supabase tables (`wishlist_items`, `wishlist_reflections`) with RLS. Server actions handle CRUD, scoring (via existing `analyzePurchaseDecision()` from `@zeta/shared`), nudge computation, and reflection tracking. A new page at `/deseos` renders the list with traffic-light scoring. A dashboard widget surfaces the top item and active nudges. Navigation updated in Plan decision rail and workspace nav.

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL), `@zeta/shared` (purchase-decision engine), Tailwind v4, shadcn/ui, Zod 4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-04-01-deseos-wishlist-system-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/2026XXXX_create_wishlist_tables.sql` | Create | DB schema: two tables, RLS, indexes, updated_at trigger |
| `webapp/src/types/database.ts` | Regenerate | Add generated types for new tables |
| `webapp/src/types/domain.ts` | Modify | Add `WishlistItem`, `WishlistReflection` type aliases |
| `webapp/src/lib/validators/wishlist.ts` | Create | Zod schemas for create, enrich, reflect |
| `webapp/src/actions/wishlist.ts` | Create | All CRUD, scoring, nudge, reflection, and insight server actions |
| `webapp/src/app/(dashboard)/deseos/page.tsx` | Create | Deseos list page (Server Component) |
| `webapp/src/components/deseos/deseos-list.tsx` | Create | Client component: item list with traffic lights |
| `webapp/src/components/deseos/deseos-item.tsx` | Create | Single item card with score, tags, actions |
| `webapp/src/components/deseos/deseos-quick-add.tsx` | Create | Inline quick-add form (name + price) |
| `webapp/src/components/deseos/deseos-enrich-drawer.tsx` | Create | Enrichment form in a Drawer |
| `webapp/src/components/deseos/deseos-nudge-banner.tsx` | Create | Dismissible nudge banner |
| `webapp/src/components/deseos/deseos-reflection-card.tsx` | Create | Post-purchase reflection form |
| `webapp/src/components/deseos/deseos-insights.tsx` | Create | Learning insights card |
| `webapp/src/components/deseos/deseos-bought-section.tsx` | Create | Bought items with reflections |
| `webapp/src/components/dashboard/deseos-widget.tsx` | Create | Dashboard widget: top item + nudge |
| `webapp/src/lib/constants/navigation.ts` | Modify | Add Deseos to workspace nav + Plan matchHrefs |
| `webapp/src/components/plan/plan-decision-rail.tsx` | Modify | Add Deseos module to the rail |
| `webapp/src/app/(dashboard)/dashboard/page.tsx` | Modify | Add DeseoWidget to dashboard grid |
| `webapp/src/types/plan.ts` | Modify | Add `PlanDeseosSummary` type |
| `webapp/src/actions/plan.ts` | Modify | Fetch deseos summary in `getPlanPageData()` |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260401200000_create_wishlist_tables.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Wishlist items: persistent purchase desires with scoring
CREATE TABLE wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric(15,2) NOT NULL,
  currency_code text NOT NULL DEFAULT 'COP',
  url text,
  image_url text,
  status text NOT NULL DEFAULT 'wishlist'
    CHECK (status IN ('wishlist', 'bought', 'reflected', 'archived')),

  -- Context (enrichment) fields — all nullable for quick capture
  why text,
  urgency text CHECK (urgency IN ('NECESSARY', 'USEFUL', 'IMPULSE')),
  desire_type text CHECK (desire_type IN ('long_held', 'recent', 'spontaneous')),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  funding_type text CHECK (funding_type IN ('ONE_TIME', 'INSTALLMENTS')),
  installments integer CHECK (installments IS NULL OR (installments >= 2 AND installments <= 36)),
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,

  -- Tracking
  enriched boolean NOT NULL DEFAULT false,
  enriched_at timestamptz,
  ready_at timestamptz,
  bought_at timestamptz,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  last_scored_at timestamptz,
  last_score integer CHECK (last_score IS NULL OR (last_score >= 0 AND last_score <= 100)),
  last_verdict text CHECK (last_verdict IN ('BUY', 'BUY_WITH_CAUTION', 'WAIT', 'NOT_RECOMMENDED')),
  last_nudge_dismissed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own wishlist items"
  ON wishlist_items FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX idx_wishlist_items_user_status
  ON wishlist_items (user_id, status, last_score DESC NULLS LAST);

CREATE INDEX idx_wishlist_items_user_active
  ON wishlist_items (user_id, created_at DESC)
  WHERE status = 'wishlist';

-- Auto-update updated_at
CREATE TRIGGER trigger_wishlist_items_updated_at
  BEFORE UPDATE ON wishlist_items
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- Wishlist reflections: post-purchase feedback
CREATE TABLE wishlist_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_item_id uuid NOT NULL REFERENCES wishlist_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worth_it boolean NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  note text,
  days_since_purchase integer NOT NULL,
  reflected_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wishlist_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reflections"
  ON wishlist_reflections FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE INDEX idx_wishlist_reflections_item
  ON wishlist_reflections (wishlist_item_id);
```

Note: The `moddatetime` extension is already enabled in the Supabase project. If it's not, use the same approach as the `financial_reminders` migration (no trigger, update manually in server actions).

- [ ] **Step 2: Push the migration**

Run: `npx supabase db push`
Expected: Migration applied successfully.

- [ ] **Step 3: Regenerate TypeScript types**

Run: `npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > webapp/src/types/database.ts`

Then verify the file starts with `export type Json =` (strip any shell warning from first line if present).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260401200000_create_wishlist_tables.sql webapp/src/types/database.ts
git commit -m "feat(deseos): create wishlist_items and wishlist_reflections tables"
```

---

## Task 2: Domain Types & Validators

**Files:**
- Modify: `webapp/src/types/domain.ts`
- Create: `webapp/src/lib/validators/wishlist.ts`

- [ ] **Step 1: Add domain type aliases**

Add to `webapp/src/types/domain.ts` after the `FinancialReminder` line:

```typescript
export type WishlistItem = Tables<"wishlist_items">;
export type WishlistReflection = Tables<"wishlist_reflections">;
```

- [ ] **Step 2: Create wishlist validators**

Create `webapp/src/lib/validators/wishlist.ts`:

```typescript
import { z } from "zod";
import { uuidStr } from "./shared";

// Quick capture — minimum fields
export const createWishlistItemSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(200, "Máximo 200 caracteres"),
  amount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().positive("El monto debe ser positivo")
  ),
  currency_code: z.string().default("COP"),
});

// Enrichment — context fields
export const enrichWishlistItemSchema = z.object({
  id: uuidStr("ID inválido"),
  why: z.string().max(500).optional(),
  urgency: z.enum(["NECESSARY", "USEFUL", "IMPULSE"]),
  desire_type: z.enum(["long_held", "recent", "spontaneous"]),
  category_id: uuidStr("Categoría inválida").nullable().optional(),
  funding_type: z.enum(["ONE_TIME", "INSTALLMENTS"]),
  installments: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(2).max(36).nullable()
  ),
  account_id: uuidStr("Cuenta inválida").nullable().optional(),
});

// Post-purchase reflection
export const reflectionSchema = z.object({
  wishlist_item_id: uuidStr("ID inválido"),
  worth_it: z.boolean(),
  rating: z.coerce.number().int().min(1).max(5),
  note: z.string().max(500).optional(),
});

export type CreateWishlistItemInput = z.infer<typeof createWishlistItemSchema>;
export type EnrichWishlistItemInput = z.infer<typeof enrichWishlistItemSchema>;
export type ReflectionInput = z.infer<typeof reflectionSchema>;
```

- [ ] **Step 3: Verify build**

Run: `cd webapp && pnpm build`
Expected: Build passes (types and validators compile).

- [ ] **Step 4: Commit**

```bash
git add webapp/src/types/domain.ts webapp/src/lib/validators/wishlist.ts
git commit -m "feat(deseos): add domain types and Zod validators"
```

---

## Task 3: Server Actions — CRUD

**Files:**
- Create: `webapp/src/actions/wishlist.ts`

- [ ] **Step 1: Create the wishlist actions file with CRUD operations**

Create `webapp/src/actions/wishlist.ts`:

```typescript
"use server";

import { revalidateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import {
  createWishlistItemSchema,
  enrichWishlistItemSchema,
} from "@/lib/validators/wishlist";
import type { ActionResult } from "@/types/actions";
import type { WishlistItem, WishlistReflection } from "@/types/domain";

// ── Queries ───────────────────────────────────────────────

export async function getWishlistItems(): Promise<WishlistItem[]> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];

  const { data } = await supabase
    .from("wishlist_items")
    .select("*")
    .eq("user_id", user.id)
    .order("status", { ascending: true }) // wishlist first, then bought/reflected/archived
    .order("last_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getWishlistItemsForDashboard(): Promise<{
  items: WishlistItem[];
  totalCount: number;
  readyCount: number;
}> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { items: [], totalCount: 0, readyCount: 0 };

  const { data } = await supabase
    .from("wishlist_items")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "wishlist")
    .order("last_score", { ascending: false, nullsFirst: false })
    .limit(3);

  const items = data ?? [];
  const totalCount = items.length;
  const readyCount = items.filter(
    (item) => item.last_score != null && item.last_score >= 55
  ).length;

  return { items: items.slice(0, 2), totalCount, readyCount };
}

// ── Mutations ─────────────────────────────────────────────

export async function createWishlistItem(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = createWishlistItemSchema.safeParse({
    name: formData.get("name"),
    amount: formData.get("amount"),
    currency_code: formData.get("currency_code") || "COP",
  });

  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from("wishlist_items")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      amount: parsed.data.amount,
      currency_code: parsed.data.currency_code,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidateTag("wishlist", "zeta");
  return { success: true, data: { id: data.id } };
}

export async function enrichWishlistItem(
  rawInput: Record<string, unknown>
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = enrichWishlistItemSchema.safeParse(rawInput);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  const { id, ...fields } = parsed.data;

  const { error } = await supabase
    .from("wishlist_items")
    .update({
      ...fields,
      enriched: true,
      enriched_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidateTag("wishlist", "zeta");
  return { success: true, data: null };
}

export async function deleteWishlistItem(
  id: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("wishlist_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidateTag("wishlist", "zeta");
  return { success: true, data: null };
}

export async function markWishlistItemBought(
  id: string,
  transactionId?: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("wishlist_items")
    .update({
      status: "bought",
      bought_at: new Date().toISOString(),
      transaction_id: transactionId ?? null,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "wishlist");

  if (error) return { success: false, error: error.message };

  revalidateTag("wishlist", "zeta");
  return { success: true, data: null };
}
```

- [ ] **Step 2: Verify build**

Run: `cd webapp && pnpm build`
Expected: Build passes.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/wishlist.ts
git commit -m "feat(deseos): add CRUD server actions for wishlist items"
```

---

## Task 4: Server Actions — Scoring

**Files:**
- Modify: `webapp/src/actions/wishlist.ts`

This task adds the scoring logic that re-uses `analyzePurchaseDecision()` from `@zeta/shared`. The data assembly follows the exact pattern from `webapp/src/actions/purchase-decision.ts`.

- [ ] **Step 1: Add scoring imports and helpers**

Add these imports at the top of `webapp/src/actions/wishlist.ts`:

```typescript
import {
  analyzePurchaseDecision,
  calcUtilization,
  computeDebtBalance,
  estimateMonthlyInterest,
  extractDebtAccounts,
  type PurchaseUrgency,
  type PurchaseFundingType,
} from "@zeta/shared";
import { monthEndStr, monthStartStr, parseMonth } from "@/lib/utils/date";
import { getUpcomingPayments } from "@/actions/payment-reminders";
import { getUpcomingRecurrences } from "@/actions/recurring-templates";
import type { Account } from "@/types/domain";
```

- [ ] **Step 2: Add the scoreWishlistItem action**

Append to `webapp/src/actions/wishlist.ts`:

```typescript
// ── Scoring ───────────────────────────────────────────────

function getSelectedAccountAvailable(account: Account): number {
  if (account.account_type === "CREDIT_CARD") {
    if (account.available_balance != null) {
      return Math.max(account.available_balance, 0);
    }
    if (account.credit_limit != null) {
      return Math.max(account.credit_limit - computeDebtBalance(account), 0);
    }
    return 0;
  }
  return Math.max(account.current_balance, 0);
}

export async function scoreWishlistItem(
  id: string
): Promise<ActionResult<{ score: number; verdict: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Fetch the item
  const { data: item, error: itemError } = await supabase
    .from("wishlist_items")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (itemError || !item)
    return { success: false, error: "Deseo no encontrado" };

  if (!item.enriched)
    return { success: false, error: "Completa la información del deseo primero" };

  const targetMonth = parseMonth(undefined);

  // Fetch financial context in parallel (same pattern as purchase-decision.ts)
  const [accountsRes, monthTxRes, categoryBudgetRes, categorySpentRes, upcomingPayments, upcomingRecurrences] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("display_order"),
      supabase
        .from("transactions")
        .select("amount, direction, account_id")
        .eq("is_excluded", false)
        .gte("transaction_date", monthStartStr(targetMonth))
        .lte("transaction_date", monthEndStr(targetMonth))
        .is("reconciled_into_transaction_id", null),
      item.category_id
        ? supabase
            .from("budgets")
            .select("amount")
            .eq("category_id", item.category_id)
            .eq("period", "monthly")
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      item.category_id
        ? supabase
            .from("transactions")
            .select("amount")
            .eq("direction", "OUTFLOW")
            .eq("is_excluded", false)
            .eq("category_id", item.category_id)
            .gte("transaction_date", monthStartStr(targetMonth))
            .lte("transaction_date", monthEndStr(targetMonth))
            .is("reconciled_into_transaction_id", null)
        : Promise.resolve({ data: null, error: null }),
      getUpcomingPayments(),
      getUpcomingRecurrences(30),
    ]);

  const accounts = (accountsRes.data ?? []) as Account[];
  const selectedAccount = item.account_id
    ? accounts.find((a) => a.id === item.account_id)
    : accounts.find((a) => a.account_type !== "CREDIT_CARD" && a.account_type !== "LOAN");

  if (!selectedAccount)
    return { success: false, error: "No se encontró una cuenta válida para evaluar" };

  const debtAccounts = extractDebtAccounts(accounts);
  const totalCreditLimit = debtAccounts
    .filter((a) => a.type === "CREDIT_CARD")
    .reduce((sum, a) => sum + (a.creditLimit ?? 0), 0);
  const totalCreditDebt = debtAccounts
    .filter((a) => a.type === "CREDIT_CARD")
    .reduce((sum, a) => sum + a.balance, 0);
  const monthlyDebtInterestCost = debtAccounts.reduce(
    (sum, a) => sum + estimateMonthlyInterest(a.balance, a.interestRate),
    0
  );

  const monthTransactions = (monthTxRes.data ?? []) as { amount: number; direction: "INFLOW" | "OUTFLOW"; account_id: string }[];
  const debtAccountIds = new Set(debtAccounts.map((a) => a.id));
  const monthlyIncome = monthTransactions
    .filter((tx) => tx.direction === "INFLOW" && !debtAccountIds.has(tx.account_id))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const monthlyExpenses = monthTransactions
    .filter((tx) => tx.direction === "OUTFLOW")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const liquidCashAvailable = accounts
    .filter((a) => a.account_type !== "CREDIT_CARD" && a.account_type !== "LOAN")
    .reduce((sum, a) => sum + Math.max(a.current_balance, 0), 0);

  const recurringCommitments = upcomingRecurrences
    .filter(
      (r) =>
        r.template.direction === "OUTFLOW" &&
        r.template.account.account_type !== "CREDIT_CARD" &&
        r.template.account.account_type !== "LOAN"
    )
    .reduce((sum, r) => sum + r.template.amount, 0);

  const statementCommitments = upcomingPayments.reduce(
    (sum, p) => sum + p.total_payment_due,
    0
  );

  const upcomingCommittedPayments = recurringCommitments + statementCommitments;

  const paymentDates = [
    ...upcomingPayments.map((p) => p.payment_due_date),
    ...upcomingRecurrences.map((r) => r.next_date),
  ];
  const now = new Date();
  const daysToNearest = paymentDates
    .map((d) => Math.ceil((new Date(d).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    .filter((d) => d >= 0);
  const daysToNearestPayment = daysToNearest.length > 0 ? Math.min(...daysToNearest) : null;

  const budgetTarget = categoryBudgetRes.data?.amount ?? null;
  const budgetSpent = ((categorySpentRes.data ?? []) as { amount: number }[]).reduce(
    (sum, tx) => sum + tx.amount,
    0
  );
  const budgetRemaining = budgetTarget == null ? null : Number(budgetTarget) - budgetSpent;

  const accountTypeMap: Record<string, "CREDIT_CARD" | "SAVINGS" | "INVESTMENT" | "CHECKING" | "OTHER"> = {
    CREDIT_CARD: "CREDIT_CARD",
    SAVINGS: "SAVINGS",
    INVESTMENT: "INVESTMENT",
    CHECKING: "CHECKING",
  };

  const result = analyzePurchaseDecision({
    amount: Number(item.amount),
    urgency: (item.urgency ?? "IMPULSE") as PurchaseUrgency,
    fundingType: (item.funding_type ?? "ONE_TIME") as PurchaseFundingType,
    installments: item.installments ?? null,
    liquidCashAvailable,
    selectedAccountAvailable: getSelectedAccountAvailable(selectedAccount),
    selectedAccountType: accountTypeMap[selectedAccount.account_type] ?? "OTHER",
    selectedAccountCreditLimit: selectedAccount.credit_limit,
    selectedAccountCurrentDebt:
      selectedAccount.account_type === "CREDIT_CARD"
        ? computeDebtBalance(selectedAccount)
        : null,
    monthlyIncome,
    monthlyExpenses,
    upcomingCommittedPayments,
    daysToNearestPayment,
    budgetRemaining,
    debtUtilizationPct:
      totalCreditLimit > 0 ? calcUtilization(totalCreditDebt, totalCreditLimit) : null,
    monthlyDebtInterestCost,
    activeDebtAccounts: debtAccounts.filter((a) => a.balance > 0),
  });

  const previousScore = item.last_score;
  const newlyReady = previousScore != null && previousScore < 55 && result.score >= 55;

  // Update the item with cached score
  await supabase
    .from("wishlist_items")
    .update({
      last_score: result.score,
      last_verdict: result.verdict,
      last_scored_at: new Date().toISOString(),
      ...(newlyReady && !item.ready_at ? { ready_at: new Date().toISOString() } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidateTag("wishlist", "zeta");

  return { success: true, data: { score: result.score, verdict: result.verdict } };
}

export async function rescoreAllWishlistItems(): Promise<
  ActionResult<{ scored: number; transitions: string[] }>
> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: items } = await supabase
    .from("wishlist_items")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "wishlist")
    .eq("enriched", true);

  if (!items || items.length === 0)
    return { success: true, data: { scored: 0, transitions: [] } };

  const transitions: string[] = [];
  let scored = 0;

  for (const item of items) {
    const result = await scoreWishlistItem(item.id);
    if (result.success) {
      scored++;
    }
  }

  return { success: true, data: { scored, transitions } };
}
```

- [ ] **Step 3: Verify build**

Run: `cd webapp && pnpm build`
Expected: Build passes.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/actions/wishlist.ts
git commit -m "feat(deseos): add purchase decision scoring for wishlist items"
```

---

## Task 5: Server Actions — Reflections & Insights

**Files:**
- Modify: `webapp/src/actions/wishlist.ts`

- [ ] **Step 1: Add reflection and insights actions**

Append to `webapp/src/actions/wishlist.ts`:

```typescript
// ── Reflections ───────────────────────────────────────────

import { reflectionSchema } from "@/lib/validators/wishlist";

export async function submitReflection(
  rawInput: Record<string, unknown>
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = reflectionSchema.safeParse(rawInput);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };

  // Get the item to compute days_since_purchase
  const { data: item } = await supabase
    .from("wishlist_items")
    .select("bought_at, status")
    .eq("id", parsed.data.wishlist_item_id)
    .eq("user_id", user.id)
    .single();

  if (!item || !item.bought_at)
    return { success: false, error: "Este deseo no ha sido marcado como comprado" };

  const daysSincePurchase = Math.floor(
    (Date.now() - new Date(item.bought_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const { error } = await supabase.from("wishlist_reflections").insert({
    user_id: user.id,
    wishlist_item_id: parsed.data.wishlist_item_id,
    worth_it: parsed.data.worth_it,
    rating: parsed.data.rating,
    note: parsed.data.note ?? null,
    days_since_purchase: daysSincePurchase,
  });

  if (error) return { success: false, error: error.message };

  // Update item status to reflected
  await supabase
    .from("wishlist_items")
    .update({ status: "reflected" })
    .eq("id", parsed.data.wishlist_item_id)
    .eq("user_id", user.id);

  revalidateTag("wishlist", "zeta");
  return { success: true, data: null };
}

export async function getReflectionsForItem(
  itemId: string
): Promise<WishlistReflection[]> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];

  const { data } = await supabase
    .from("wishlist_reflections")
    .select("*")
    .eq("wishlist_item_id", itemId)
    .eq("user_id", user.id)
    .order("reflected_at", { ascending: true });

  return data ?? [];
}

// ── Insights ──────────────────────────────────────────────

export type WishlistInsight = {
  type: "urgency" | "desire_type" | "category" | "wait_time";
  label: string;
  message: string;
};

export async function getWishlistInsights(): Promise<WishlistInsight[]> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];

  // Fetch all reflected/archived items with their reflections
  const { data: items } = await supabase
    .from("wishlist_items")
    .select("*, wishlist_reflections(*)")
    .eq("user_id", user.id)
    .in("status", ["reflected", "archived"])
    .not("wishlist_reflections", "is", null);

  if (!items || items.length < 5) return [];

  const insights: WishlistInsight[] = [];

  // Group reflections by urgency
  const byUrgency = new Map<string, { ratings: number[]; count: number }>();
  for (const item of items) {
    if (!item.urgency) continue;
    const reflections = (item.wishlist_reflections ?? []) as WishlistReflection[];
    if (reflections.length === 0) continue;
    const entry = byUrgency.get(item.urgency) ?? { ratings: [], count: 0 };
    entry.ratings.push(...reflections.map((r) => r.rating));
    entry.count++;
    byUrgency.set(item.urgency, entry);
  }

  const urgencyLabels: Record<string, string> = {
    NECESSARY: "necesarias",
    USEFUL: "útiles",
    IMPULSE: "impulso",
  };

  for (const [urgency, data] of byUrgency) {
    if (data.count < 3) continue;
    const avg = data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length;
    insights.push({
      type: "urgency",
      label: urgencyLabels[urgency] ?? urgency,
      message: `Tus compras tipo ${urgencyLabels[urgency] ?? urgency} tienen promedio ${avg.toFixed(1)}★ (${data.count} compras).`,
    });
  }

  // Group by wait time
  const shortWait: number[] = []; // < 30 days
  const longWait: number[] = []; // >= 60 days
  for (const item of items) {
    if (!item.bought_at || !item.created_at) continue;
    const waitDays = Math.floor(
      (new Date(item.bought_at).getTime() - new Date(item.created_at).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const reflections = (item.wishlist_reflections ?? []) as WishlistReflection[];
    if (reflections.length === 0) continue;
    const avgRating = reflections.reduce((a, r) => a + r.rating, 0) / reflections.length;
    if (waitDays < 30) shortWait.push(avgRating);
    else if (waitDays >= 60) longWait.push(avgRating);
  }

  if (shortWait.length >= 3 && longWait.length >= 3) {
    const shortAvg = shortWait.reduce((a, b) => a + b, 0) / shortWait.length;
    const longAvg = longWait.reduce((a, b) => a + b, 0) / longWait.length;
    insights.push({
      type: "wait_time",
      label: "tiempo de espera",
      message: `Compras rápidas (<30 días): ${shortAvg.toFixed(1)}★. Las que esperaste 2+ meses: ${longAvg.toFixed(1)}★.`,
    });
  }

  return insights;
}

// ── Nudges ────────────────────────────────────────────────

export type WishlistNudge = {
  type: "debt_milestone" | "budget_surplus" | "desire_maturity" | "score_transition";
  itemId: string;
  itemName: string;
  message: string;
};

export async function getActiveNudges(): Promise<WishlistNudge[]> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];

  const { data: items } = await supabase
    .from("wishlist_items")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "wishlist")
    .eq("enriched", true)
    .not("last_score", "is", null)
    .order("last_score", { ascending: false });

  if (!items || items.length === 0) return [];

  const nudges: WishlistNudge[] = [];
  const now = new Date();

  for (const item of items) {
    // Skip if nudge was dismissed today
    if (item.last_nudge_dismissed_at) {
      const dismissedAt = new Date(item.last_nudge_dismissed_at);
      const hoursSinceDismiss = (now.getTime() - dismissedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceDismiss < 24) continue;
    }

    // Desire maturity: 30+ days, enriched, green score
    if (item.last_score != null && item.last_score >= 55) {
      const ageInDays = Math.floor(
        (now.getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (ageInDays >= 30) {
        const months = Math.floor(ageInDays / 30);
        nudges.push({
          type: "desire_maturity",
          itemId: item.id,
          itemName: item.name,
          message: `Llevas ${months} ${months === 1 ? "mes" : "meses"} queriendo ${item.name} y tus finanzas lo permiten. Esto no es impulso — date el gusto.`,
        });
      }
    }

    // Score transition: ready_at was set recently (within 7 days)
    if (item.ready_at) {
      const readyDaysAgo = Math.floor(
        (now.getTime() - new Date(item.ready_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (readyDaysAgo <= 7) {
        nudges.push({
          type: "score_transition",
          itemId: item.id,
          itemName: item.name,
          message: `¡${item.name} acaba de pasar a verde! Algo cambió en tus finanzas — revísalo.`,
        });
      }
    }
  }

  // Return max 1 nudge (highest priority)
  const priorityOrder: WishlistNudge["type"][] = [
    "debt_milestone",
    "score_transition",
    "budget_surplus",
    "desire_maturity",
  ];
  nudges.sort(
    (a, b) => priorityOrder.indexOf(a.type) - priorityOrder.indexOf(b.type)
  );

  return nudges.slice(0, 1);
}

export async function dismissNudge(itemId: string): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("wishlist_items")
    .update({ last_nudge_dismissed_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidateTag("wishlist", "zeta");
  return { success: true, data: null };
}

// ── Pending reflections ───────────────────────────────────

export async function getPendingReflections(): Promise<WishlistItem[]> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];

  // Items that are bought but not yet reflected (14-day check)
  const { data: boughtItems } = await supabase
    .from("wishlist_items")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "bought")
    .not("bought_at", "is", null);

  // Items already reflected once that may need 60-day follow-up (expensive items)
  const { data: reflectedItems } = await supabase
    .from("wishlist_items")
    .select("*, wishlist_reflections(id)")
    .eq("user_id", user.id)
    .eq("status", "reflected")
    .not("bought_at", "is", null);

  const now = Date.now();
  const pending: WishlistItem[] = [];

  // 14-day reflections
  for (const item of boughtItems ?? []) {
    const daysSinceBuy = Math.floor(
      (now - new Date(item.bought_at!).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceBuy >= 14) pending.push(item);
  }

  // 60-day second reflections for expensive items (only 1 reflection so far)
  for (const item of reflectedItems ?? []) {
    const reflections = (item.wishlist_reflections ?? []) as { id: string }[];
    if (reflections.length >= 2) continue; // Already reflected twice
    const daysSinceBuy = Math.floor(
      (now - new Date(item.bought_at!).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceBuy >= 60) {
      // Strip the joined reflections before returning as WishlistItem
      const { wishlist_reflections: _, ...cleanItem } = item;
      pending.push(cleanItem as WishlistItem);
    }
  }

  return pending;
}
```

Note: Move the `reflectionSchema` import to the top imports section alongside the other validator imports.

- [ ] **Step 2: Verify build**

Run: `cd webapp && pnpm build`
Expected: Build passes.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/wishlist.ts
git commit -m "feat(deseos): add reflection, insights, and nudge server actions"
```

---

## Task 6: Deseos Page & Core Components

**Files:**
- Create: `webapp/src/app/(dashboard)/deseos/page.tsx`
- Create: `webapp/src/components/deseos/deseos-list.tsx`
- Create: `webapp/src/components/deseos/deseos-item.tsx`
- Create: `webapp/src/components/deseos/deseos-quick-add.tsx`
- Create: `webapp/src/components/deseos/deseos-nudge-banner.tsx`

- [ ] **Step 1: Create the Deseos page**

Create `webapp/src/app/(dashboard)/deseos/page.tsx`:

```tsx
import { connection } from "next/server";
import {
  getWishlistItems,
  getActiveNudges,
  getWishlistInsights,
  getPendingReflections,
} from "@/actions/wishlist";
import { getAccounts } from "@/actions/accounts";
import { getPreferredCurrency } from "@/actions/profile";
import { DeseosList } from "@/components/deseos/deseos-list";

export default async function DeseosPage() {
  await connection();

  const [items, nudges, insights, pendingReflections, accountsResult, currency] =
    await Promise.all([
      getWishlistItems(),
      getActiveNudges(),
      getWishlistInsights(),
      getPendingReflections(),
      getAccounts(),
      getPreferredCurrency(),
    ]);

  const accounts = accountsResult.success ? accountsResult.data : [];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Plan
        </p>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
            Deseos
          </h1>
          <p className="text-sm text-muted-foreground lg:text-base">
            Lo que quieres comprar, evaluado contra tu realidad financiera
          </p>
        </div>
      </div>

      <DeseosList
        items={items}
        nudges={nudges}
        insights={insights}
        pendingReflections={pendingReflections}
        accounts={accounts}
        currency={currency}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create DeseosList client component**

Create `webapp/src/components/deseos/deseos-list.tsx`:

```tsx
"use client";

import { DeseosQuickAdd } from "./deseos-quick-add";
import { DeseosItem } from "./deseos-item";
import { DeseosNudgeBanner } from "./deseos-nudge-banner";
import { DeseosInsights } from "./deseos-insights";
import { DeseosReflectionCard } from "./deseos-reflection-card";
import { DeseosBoughtSection } from "./deseos-bought-section";
import type { WishlistItem, Account, CurrencyCode } from "@/types/domain";
import type { WishlistNudge, WishlistInsight } from "@/actions/wishlist";

interface DeseosListProps {
  items: WishlistItem[];
  nudges: WishlistNudge[];
  insights: WishlistInsight[];
  pendingReflections: WishlistItem[];
  accounts: Account[];
  currency: CurrencyCode;
}

export function DeseosList({
  items,
  nudges,
  insights,
  pendingReflections,
  accounts,
  currency,
}: DeseosListProps) {
  const activeItems = items.filter((i) => i.status === "wishlist");
  const boughtItems = items.filter(
    (i) => i.status === "bought" || i.status === "reflected" || i.status === "archived"
  );

  // Sort: green (≥55) first, then yellow (35-54), then red (<35), then unenriched
  const sortedActive = [...activeItems].sort((a, b) => {
    if (!a.enriched && b.enriched) return 1;
    if (a.enriched && !b.enriched) return -1;
    return (b.last_score ?? -1) - (a.last_score ?? -1);
  });

  return (
    <div className="space-y-4">
      {nudges.length > 0 && <DeseosNudgeBanner nudge={nudges[0]} />}

      {pendingReflections.length > 0 && (
        <div className="space-y-3">
          {pendingReflections.map((item) => (
            <DeseosReflectionCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <DeseosQuickAdd currency={currency} />

      <div className="space-y-2">
        {sortedActive.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin deseos aún. Agrega algo que quieras comprar.
          </p>
        ) : (
          sortedActive.map((item) => (
            <DeseosItem
              key={item.id}
              item={item}
              accounts={accounts}
              currency={currency}
            />
          ))
        )}
      </div>

      {insights.length > 0 && <DeseosInsights insights={insights} />}

      {boughtItems.length > 0 && <DeseosBoughtSection items={boughtItems} currency={currency} />}
    </div>
  );
}
```

- [ ] **Step 3: Create DeseosItem component**

Create `webapp/src/components/deseos/deseos-item.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { deleteWishlistItem, markWishlistItemBought, scoreWishlistItem } from "@/actions/wishlist";
import { DeseosEnrichDrawer } from "./deseos-enrich-drawer";
import type { WishlistItem, Account, CurrencyCode } from "@/types/domain";

function getScoreColor(score: number | null): { dot: string; text: string; bg: string; border: string } {
  if (score == null) return { dot: "bg-muted-foreground/40", text: "text-muted-foreground", bg: "bg-muted/20", border: "border-white/6" };
  if (score >= 55) return { dot: "bg-green-400", text: "text-green-400", bg: "bg-green-950/20", border: "border-green-900/30" };
  if (score >= 35) return { dot: "bg-yellow-400", text: "text-yellow-400", bg: "bg-yellow-950/20", border: "border-white/6" };
  return { dot: "bg-red-400", text: "text-red-400", bg: "bg-red-950/20", border: "border-white/6" };
}

function getVerdictText(score: number | null): string {
  if (score == null) return "";
  if (score >= 55) return "Puedes comprarlo";
  if (score >= 35) return "Espera un poco";
  return "No es buen momento";
}

function getDesireAge(createdAt: string): string {
  const days = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  const months = Math.floor(days / 30);
  return `Hace ${months} ${months === 1 ? "mes" : "meses"}`;
}

const urgencyLabels: Record<string, string> = {
  NECESSARY: "Necesario",
  USEFUL: "Útil",
  IMPULSE: "Impulso",
};

const desireTypeLabels: Record<string, string> = {
  long_held: "Deseo antiguo",
  recent: "Reciente",
  spontaneous: "Espontáneo",
};

interface DeseosItemProps {
  item: WishlistItem;
  accounts: Account[];
  currency: CurrencyCode;
}

export function DeseosItem({ item, accounts, currency }: DeseosItemProps) {
  const [isPending, startTransition] = useTransition();
  const [enrichOpen, setEnrichOpen] = useState(false);
  const colors = getScoreColor(item.enriched ? item.last_score : null);

  function handleDelete() {
    startTransition(async () => {
      await deleteWishlistItem(item.id);
    });
  }

  function handleBuy() {
    startTransition(async () => {
      await markWishlistItemBought(item.id);
    });
  }

  function handleScore() {
    startTransition(async () => {
      await scoreWishlistItem(item.id);
    });
  }

  const staleScore =
    item.last_scored_at &&
    Date.now() - new Date(item.last_scored_at).getTime() > 24 * 60 * 60 * 1000;

  return (
    <>
      <div
        className={`rounded-xl border ${colors.border} bg-z-surface-2/80 p-4 transition-opacity ${isPending ? "opacity-50" : ""}`}
      >
        <div className="flex items-center gap-3">
          {/* Score indicator */}
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${colors.bg}`}
          >
            {item.enriched ? (
              <div className={`size-3 rounded-full ${colors.dot}`} />
            ) : (
              <span className="text-sm text-muted-foreground">?</span>
            )}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(Number(item.amount), item.currency_code as CurrencyCode)} ·{" "}
              {getDesireAge(item.created_at)}
              {item.enriched && item.last_score != null && (
                <>
                  {" · "}
                  <span className={colors.text}>{getVerdictText(item.last_score)}</span>
                </>
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {!item.enriched && (
              <button
                onClick={() => setEnrichOpen(true)}
                className="rounded-md bg-z-surface-3 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Completar
              </button>
            )}
            {item.enriched && item.last_score != null && item.last_score >= 55 && (
              <button
                onClick={handleBuy}
                disabled={isPending}
                className="rounded-md bg-green-900/30 px-2.5 py-1 text-xs text-green-400 transition-colors hover:bg-green-900/50"
              >
                Comprado
              </button>
            )}
            {item.enriched && (staleScore || item.last_score == null) && (
              <button
                onClick={handleScore}
                disabled={isPending}
                className="rounded-md bg-z-surface-3 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Evaluar
              </button>
            )}
            {item.enriched && item.last_score != null && (
              <span className={`text-xs font-semibold ${colors.text}`}>
                {item.last_score}
              </span>
            )}
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:text-red-400"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Tags */}
        {item.enriched && (item.urgency || item.desire_type) && (
          <div className="mt-2.5 flex gap-1.5">
            {item.urgency && (
              <span className="rounded bg-z-surface-3 px-2 py-0.5 text-[11px] text-muted-foreground">
                {urgencyLabels[item.urgency] ?? item.urgency}
              </span>
            )}
            {item.desire_type && (
              <span className="rounded bg-z-surface-3 px-2 py-0.5 text-[11px] text-muted-foreground">
                {desireTypeLabels[item.desire_type] ?? item.desire_type}
              </span>
            )}
          </div>
        )}
      </div>

      <DeseosEnrichDrawer
        item={item}
        accounts={accounts}
        open={enrichOpen}
        onOpenChange={setEnrichOpen}
      />
    </>
  );
}
```

- [ ] **Step 4: Create DeseosQuickAdd component**

Create `webapp/src/components/deseos/deseos-quick-add.tsx`:

```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createWishlistItem } from "@/actions/wishlist";
import type { CurrencyCode } from "@/types/domain";

interface DeseosQuickAddProps {
  currency: CurrencyCode;
}

export function DeseosQuickAdd({ currency }: DeseosQuickAddProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      formData.set("currency_code", currency);
      const result = await createWishlistItem(formData);
      if (result.success) {
        formRef.current?.reset();
        setIsOpen(false);
      }
    });
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center gap-2 rounded-xl border border-white/6 bg-z-surface-2/80 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-white/5"
      >
        <Plus className="size-4" />
        Agregar deseo rápido...
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="rounded-xl border border-z-sage-dark/40 bg-z-surface-2/80 p-4"
    >
      <div className="flex gap-3">
        <div className="flex-[2]">
          <label className="mb-1 block text-[11px] text-muted-foreground">
            ¿Qué quieres?
          </label>
          <input
            name="name"
            type="text"
            required
            autoFocus
            placeholder="Kindle, PlayStation, curso..."
            className="w-full rounded-md border border-white/6 bg-z-surface-3 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-z-sage-dark focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-[11px] text-muted-foreground">
            ¿Cuánto cuesta?
          </label>
          <input
            name="amount"
            type="number"
            required
            min="1"
            step="any"
            placeholder="450,000"
            className="w-full rounded-md border border-white/6 bg-z-surface-3 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-z-sage-dark focus:outline-none"
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-z-sage-dark px-3 py-1.5 text-sm font-semibold text-z-ink transition-colors hover:bg-z-sage-dark/90 disabled:opacity-50"
        >
          {isPending ? "Agregando..." : "Agregar"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Create DeseosNudgeBanner component**

Create `webapp/src/components/deseos/deseos-nudge-banner.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { dismissNudge } from "@/actions/wishlist";
import type { WishlistNudge } from "@/actions/wishlist";

interface DeseosNudgeBannerProps {
  nudge: WishlistNudge;
}

const nudgeIcons: Record<WishlistNudge["type"], string> = {
  debt_milestone: "🏆",
  score_transition: "🎯",
  budget_surplus: "💰",
  desire_maturity: "⏰",
};

export function DeseosNudgeBanner({ nudge }: DeseosNudgeBannerProps) {
  const [isPending, startTransition] = useTransition();

  function handleDismiss() {
    startTransition(async () => {
      await dismissNudge(nudge.itemId);
    });
  }

  if (isPending) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-green-900/30 bg-gradient-to-br from-green-950/20 to-z-surface-2/80 px-4 py-3">
      <span className="text-lg">{nudgeIcons[nudge.type]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-z-sage-light">
          ¡{nudge.itemName} está listo!
        </p>
        <p className="text-xs text-muted-foreground">{nudge.message}</p>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 text-muted-foreground/50 hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Verify build**

Run: `cd webapp && pnpm build`
Expected: Build will fail because we haven't created the enrichment drawer, reflection card, insights, and bought section components yet. That's expected — we'll create them in the next task.

- [ ] **Step 7: Commit (partial — core components)**

```bash
git add webapp/src/app/(dashboard)/deseos/ webapp/src/components/deseos/deseos-list.tsx webapp/src/components/deseos/deseos-item.tsx webapp/src/components/deseos/deseos-quick-add.tsx webapp/src/components/deseos/deseos-nudge-banner.tsx
git commit -m "feat(deseos): add Deseos page and core list components"
```

---

## Task 7: Supporting Components — Enrich, Reflect, Insights, Bought

**Files:**
- Create: `webapp/src/components/deseos/deseos-enrich-drawer.tsx`
- Create: `webapp/src/components/deseos/deseos-reflection-card.tsx`
- Create: `webapp/src/components/deseos/deseos-insights.tsx`
- Create: `webapp/src/components/deseos/deseos-bought-section.tsx`

- [ ] **Step 1: Create DeseosEnrichDrawer**

Create `webapp/src/components/deseos/deseos-enrich-drawer.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { enrichWishlistItem, scoreWishlistItem } from "@/actions/wishlist";
import type { WishlistItem, Account } from "@/types/domain";

interface DeseosEnrichDrawerProps {
  item: WishlistItem;
  accounts: Account[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeseosEnrichDrawer({
  item,
  accounts,
  open,
  onOpenChange,
}: DeseosEnrichDrawerProps) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      const installmentsRaw = form.get("installments");
      const result = await enrichWishlistItem({
        id: item.id,
        why: form.get("why") || undefined,
        urgency: form.get("urgency"),
        desire_type: form.get("desire_type"),
        category_id: form.get("category_id") || null,
        funding_type: form.get("funding_type"),
        installments:
          form.get("funding_type") === "INSTALLMENTS" && installmentsRaw
            ? Number(installmentsRaw)
            : null,
        account_id: form.get("account_id") || null,
      });

      if (result.success) {
        // Auto-score after enrichment
        await scoreWishlistItem(item.id);
        onOpenChange(false);
      }
    });
  }

  const paymentAccounts = accounts.filter(
    (a) => a.is_active && a.account_type !== "LOAN"
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Completar: {item.name}</DrawerTitle>
        </DrawerHeader>
        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-6">
          {/* Why */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              ¿Por qué lo quieres?
            </label>
            <textarea
              name="why"
              rows={2}
              maxLength={500}
              placeholder="Opcional — ayuda a reflexionar después"
              className="w-full rounded-md border border-white/6 bg-z-surface-3 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-z-sage-dark focus:outline-none"
            />
          </div>

          {/* Urgency */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              ¿Qué tan urgente es?
            </label>
            <div className="flex gap-2">
              {(["NECESSARY", "USEFUL", "IMPULSE"] as const).map((value) => (
                <label
                  key={value}
                  className="flex-1 cursor-pointer rounded-md border border-white/6 bg-z-surface-3 px-3 py-2 text-center text-sm has-[:checked]:border-z-sage-dark has-[:checked]:bg-z-sage-dark/10"
                >
                  <input
                    type="radio"
                    name="urgency"
                    value={value}
                    required
                    className="sr-only"
                  />
                  {value === "NECESSARY"
                    ? "Necesario"
                    : value === "USEFUL"
                      ? "Útil"
                      : "Impulso"}
                </label>
              ))}
            </div>
          </div>

          {/* Desire type */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              ¿Desde cuándo lo quieres?
            </label>
            <div className="flex gap-2">
              {(["long_held", "recent", "spontaneous"] as const).map((value) => (
                <label
                  key={value}
                  className="flex-1 cursor-pointer rounded-md border border-white/6 bg-z-surface-3 px-3 py-2 text-center text-sm has-[:checked]:border-z-sage-dark has-[:checked]:bg-z-sage-dark/10"
                >
                  <input
                    type="radio"
                    name="desire_type"
                    value={value}
                    required
                    className="sr-only"
                  />
                  {value === "long_held"
                    ? "Hace rato"
                    : value === "recent"
                      ? "Reciente"
                      : "Espontáneo"}
                </label>
              ))}
            </div>
          </div>

          {/* Funding type */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              ¿Cómo lo pagarías?
            </label>
            <div className="flex gap-2">
              {(["ONE_TIME", "INSTALLMENTS"] as const).map((value) => (
                <label
                  key={value}
                  className="flex-1 cursor-pointer rounded-md border border-white/6 bg-z-surface-3 px-3 py-2 text-center text-sm has-[:checked]:border-z-sage-dark has-[:checked]:bg-z-sage-dark/10"
                >
                  <input
                    type="radio"
                    name="funding_type"
                    value={value}
                    required
                    className="sr-only"
                  />
                  {value === "ONE_TIME" ? "De contado" : "Cuotas"}
                </label>
              ))}
            </div>
          </div>

          {/* Installments (shown only when INSTALLMENTS selected — controlled via CSS) */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Número de cuotas
            </label>
            <input
              name="installments"
              type="number"
              min="2"
              max="36"
              placeholder="Ej: 12"
              className="w-full rounded-md border border-white/6 bg-z-surface-3 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-z-sage-dark focus:outline-none"
            />
          </div>

          {/* Account */}
          {paymentAccounts.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium">
                ¿Con qué cuenta?
              </label>
              <select
                name="account_id"
                className="w-full rounded-md border border-white/6 bg-z-surface-3 px-3 py-2 text-sm focus:border-z-sage-dark focus:outline-none"
              >
                <option value="">Sin preferencia</option>
                {paymentAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-z-sage-dark py-2.5 text-sm font-semibold text-z-ink transition-colors hover:bg-z-sage-dark/90 disabled:opacity-50"
          >
            {isPending ? "Guardando..." : "Guardar y evaluar"}
          </button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
```

- [ ] **Step 2: Create DeseosReflectionCard**

Create `webapp/src/components/deseos/deseos-reflection-card.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { submitReflection } from "@/actions/wishlist";
import { formatCurrency } from "@/lib/utils/currency";
import type { WishlistItem, CurrencyCode } from "@/types/domain";

interface DeseosReflectionCardProps {
  item: WishlistItem;
}

export function DeseosReflectionCard({ item }: DeseosReflectionCardProps) {
  const [isPending, startTransition] = useTransition();
  const [rating, setRating] = useState(0);
  const [worthIt, setWorthIt] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const daysSinceBuy = item.bought_at
    ? Math.floor(
        (Date.now() - new Date(item.bought_at).getTime()) / (1000 * 60 * 60 * 24)
      )
    : 0;

  const weeksLabel =
    daysSinceBuy < 14
      ? `${daysSinceBuy} días`
      : `${Math.floor(daysSinceBuy / 7)} semanas`;

  function handleSubmit() {
    if (worthIt === null || rating === 0) return;
    startTransition(async () => {
      const result = await submitReflection({
        wishlist_item_id: item.id,
        worth_it: worthIt,
        rating,
        note: note || undefined,
      });
      if (result.success) setDismissed(true);
    });
  }

  return (
    <div className="rounded-xl border border-z-brass/20 bg-gradient-to-br from-z-brass/5 to-z-surface-2/80 p-4">
      <p className="text-sm font-medium">
        Compraste {item.name} hace {weeksLabel}
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        {formatCurrency(Number(item.amount), item.currency_code as CurrencyCode)} ·
        ¿Valió la pena?
      </p>

      {/* Worth it */}
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setWorthIt(true)}
          className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
            worthIt === true
              ? "border-green-700 bg-green-900/30 text-green-400"
              : "border-white/6 bg-z-surface-3 text-muted-foreground"
          }`}
        >
          Sí, valió
        </button>
        <button
          onClick={() => setWorthIt(false)}
          className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
            worthIt === false
              ? "border-red-700 bg-red-900/30 text-red-400"
              : "border-white/6 bg-z-surface-3 text-muted-foreground"
          }`}
        >
          No tanto
        </button>
      </div>

      {/* Rating */}
      <div className="mb-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => setRating(star)}
            className="p-0.5"
          >
            <Star
              className={`size-5 ${
                star <= rating
                  ? "fill-z-brass text-z-brass"
                  : "text-muted-foreground/30"
              }`}
            />
          </button>
        ))}
      </div>

      {/* Note */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="Opcional — algo que quieras recordar"
        className="mb-3 w-full rounded-md border border-white/6 bg-z-surface-3 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-z-sage-dark focus:outline-none"
      />

      <div className="flex justify-end gap-2">
        <button
          onClick={() => setDismissed(true)}
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground"
        >
          Después
        </button>
        <button
          onClick={handleSubmit}
          disabled={isPending || worthIt === null || rating === 0}
          className="rounded-md bg-z-sage-dark px-3 py-1.5 text-sm font-semibold text-z-ink disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Enviar"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create DeseosInsights**

Create `webapp/src/components/deseos/deseos-insights.tsx`:

```tsx
import { Lightbulb } from "lucide-react";
import type { WishlistInsight } from "@/actions/wishlist";

interface DeseosInsightsProps {
  insights: WishlistInsight[];
}

export function DeseosInsights({ insights }: DeseosInsightsProps) {
  return (
    <div className="rounded-xl border border-white/6 bg-z-surface-2/80 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Lightbulb className="size-4 text-z-brass" />
        <p className="text-sm font-semibold">Tu patrón de compras</p>
      </div>
      <div className="space-y-1.5">
        {insights.map((insight, i) => (
          <p key={i} className="text-xs leading-relaxed text-muted-foreground">
            {insight.message}
          </p>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create DeseosBoughtSection**

Create `webapp/src/components/deseos/deseos-bought-section.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Check, Star } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { WishlistItem, CurrencyCode } from "@/types/domain";

interface DeseosBoughtSectionProps {
  items: WishlistItem[];
  currency: CurrencyCode;
}

export function DeseosBoughtSection({ items, currency }: DeseosBoughtSectionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-white/6 pt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
      >
        {expanded ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
        Comprados ({items.length})
      </button>

      {expanded && (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-white/6 bg-z-surface-2/80 p-3 opacity-70"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-z-surface-3">
                  <Check className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(Number(item.amount), item.currency_code as CurrencyCode)}
                    {item.bought_at && ` · Comprado ${formatDate(item.bought_at)}`}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `cd webapp && pnpm build`
Expected: Build passes — all components are now created.

- [ ] **Step 6: Commit**

```bash
git add webapp/src/components/deseos/
git commit -m "feat(deseos): add enrichment drawer, reflection, insights, and bought section"
```

---

## Task 8: Dashboard Widget

**Files:**
- Create: `webapp/src/components/dashboard/deseos-widget.tsx`
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Create the dashboard widget**

Create `webapp/src/components/dashboard/deseos-widget.tsx`:

```tsx
import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import type { WishlistItem, CurrencyCode } from "@/types/domain";
import type { WishlistNudge } from "@/actions/wishlist";

function getScoreDot(score: number | null): string {
  if (score == null) return "bg-muted-foreground/40";
  if (score >= 55) return "bg-green-400";
  if (score >= 35) return "bg-yellow-400";
  return "bg-red-400";
}

function getScoreTextColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 55) return "text-green-400";
  if (score >= 35) return "text-yellow-400";
  return "text-red-400";
}

interface DeseosWidgetProps {
  items: WishlistItem[];
  totalCount: number;
  readyCount: number;
  nudge: WishlistNudge | null;
  currency: CurrencyCode;
}

export function DeseosWidget({
  items,
  totalCount,
  readyCount,
  nudge,
  currency,
}: DeseosWidgetProps) {
  const topItem = items[0];
  const secondItem = items[1];

  return (
    <Card className="border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-z-sage-dark" />
          <CardTitle className="text-sm font-semibold">Deseos</CardTitle>
        </div>
        <Link
          href="/deseos"
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Ver todos
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {!topItem ? (
          <p className="py-3 text-center text-xs text-muted-foreground">
            Sin deseos aún
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {totalCount} {totalCount === 1 ? "item" : "items"}
              </span>
              {readyCount > 0 && (
                <span className="text-green-400">{readyCount} listo{readyCount > 1 ? "s" : ""}</span>
              )}
            </div>

            {/* Featured item */}
            <div className="rounded-lg border border-green-900/30 bg-gradient-to-br from-green-950/20 to-z-surface-2/80 p-3">
              <div className="flex items-center gap-2.5">
                <div className={`size-2.5 shrink-0 rounded-full ${getScoreDot(topItem.last_score)}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{topItem.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatCurrency(Number(topItem.amount), topItem.currency_code as CurrencyCode)}
                    {topItem.last_score != null && ` · Score ${topItem.last_score}`}
                  </p>
                </div>
              </div>
              {nudge && nudge.itemId === topItem.id && (
                <p className="mt-2 text-[11px] text-green-400">{nudge.message}</p>
              )}
            </div>

            {/* Second item */}
            {secondItem && (
              <div className="flex items-center gap-2.5 py-1">
                <div className={`size-2.5 shrink-0 rounded-full ${getScoreDot(secondItem.last_score)}`} />
                <p className="flex-1 truncate text-xs text-muted-foreground">
                  {secondItem.name} · {formatCurrency(Number(secondItem.amount), secondItem.currency_code as CurrencyCode)}
                </p>
                {secondItem.last_score != null && (
                  <span className={`text-[11px] ${getScoreTextColor(secondItem.last_score)}`}>
                    {secondItem.last_score}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Integrate widget into dashboard page**

Modify `webapp/src/app/(dashboard)/dashboard/page.tsx`:

Add import at top:

```typescript
import { getWishlistItemsForDashboard, getActiveNudges as getWishlistNudges } from "@/actions/wishlist";
import { DeseosWidget } from "@/components/dashboard/deseos-widget";
```

Add to the parallel data fetch (the `Promise.all` on line ~291 that fetches `heroData`, `healthMetersData`, etc.):

```typescript
const [heroData, healthMetersData, allocationData, debtCountdownData, attentionSnapshot, impactEvents, pendingReminders, wishlistDashboard, wishlistNudges] = await Promise.all([
  getDashboardHeroData(month, currency),
  getHealthMeters(currency, month),
  get503020Allocation(month, currency),
  getDebtFreeCountdown(currency),
  getAttentionSnapshot(),
  getRecentImpactEvents(3),
  getReminders("pending"),
  getWishlistItemsForDashboard(),
  getWishlistNudges(),
]);
```

Add the widget in the desktop layout, in the "Impact + Pendientes" grid section (line ~438), changing it to a 3-column grid or adding a new row. The simplest approach — add a new row after the Impact + Pendientes grid:

```tsx
{/* ── Deseos ── */}
<div className="grid gap-4 xl:grid-cols-2">
  <DeseosWidget
    items={wishlistDashboard.items}
    totalCount={wishlistDashboard.totalCount}
    readyCount={wishlistDashboard.readyCount}
    nudge={wishlistNudges[0] ?? null}
    currency={currency}
  />
</div>
```

Place this after the `RecentImpactsWidget` / `PendientesWidget` grid and before the `HealthScoreSection`.

- [ ] **Step 3: Verify build**

Run: `cd webapp && pnpm build`
Expected: Build passes.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/dashboard/deseos-widget.tsx webapp/src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(deseos): add dashboard widget with top items and nudges"
```

---

## Task 9: Navigation Updates

**Files:**
- Modify: `webapp/src/lib/constants/navigation.ts`
- Modify: `webapp/src/components/plan/plan-decision-rail.tsx`

- [ ] **Step 1: Add Deseos to navigation constants**

Modify `webapp/src/lib/constants/navigation.ts`:

Add `Heart` to the lucide-react import:

```typescript
import {
  LayoutDashboard,
  ArrowLeftRight,
  FileUp,
  Wallet,
  PiggyBank,
  Landmark,
  Repeat2,
  Inbox,
  Contact,
  Settings,
  BarChart3,
  Tag,
  ListChecks,
  Heart,
  type LucideIcon,
} from "lucide-react";
```

Add `/deseos` to Plan's `matchHrefs`:

```typescript
{
  title: "Plan",
  href: "/plan",
  icon: PiggyBank,
  matchHrefs: [
    "/deudas",
    "/deudas/planificador",
    "/recurrentes",
    "/deseos",
  ],
},
```

Add Deseos to `WORKSPACE_NAV` (after "Pendientes"):

```typescript
{ title: "Deseos", href: "/deseos", icon: Heart },
```

- [ ] **Step 2: Add Deseos to PlanDecisionRail**

Modify `webapp/src/components/plan/plan-decision-rail.tsx`:

Add `Heart` to the lucide-react import:

```typescript
import { ArrowRight, BadgeAlert, CalendarClock, Heart, PiggyBank, Sparkles } from "lucide-react";
```

Add a new module to the `modules` array:

```typescript
const modules = [
  {
    key: "budget",
    title: "Presupuesto",
    href: "/categories",
    icon: PiggyBank,
  },
  {
    key: "recurring",
    title: "Obligaciones",
    href: "/recurrentes",
    icon: CalendarClock,
  },
  {
    key: "debt",
    title: "Deuda",
    href: "/deudas",
    icon: BadgeAlert,
  },
  {
    key: "desires",
    title: "Deseos",
    href: "/deseos",
    icon: Heart,
  },
  {
    key: "scenarios",
    title: "Escenarios",
    href: "/deudas/planificador",
    icon: Sparkles,
  },
] as const;
```

Add Deseos to the `PlanDecisionRailProps` interface:

```typescript
interface PlanDecisionRailProps {
  budget: PlanBudgetSummary;
  debt: PlanDebtSummary;
  recurring: PlanRecurringSummary;
  scenarios: PlanScenarioSummary;
  desires: { totalCount: number; readyCount: number };
  currency: CurrencyCode;
}
```

Add the `desires` content entry:

```typescript
desires: {
  value:
    desires.readyCount > 0
      ? `${desires.readyCount} listos para comprar`
      : desires.totalCount > 0
        ? `${desires.totalCount} en la lista`
        : "Sin deseos aún",
  detail:
    desires.readyCount > 0
      ? "Tienes items que tus finanzas permiten"
      : "Agrega lo que quieras comprar para evaluarlo",
},
```

Update the destructured prop:

```typescript
export function PlanDecisionRail({
  budget,
  debt,
  recurring,
  scenarios,
  desires,
  currency,
}: PlanDecisionRailProps) {
```

- [ ] **Step 3: Update Plan page to pass desires data**

Modify `webapp/src/app/(dashboard)/plan/page.tsx`:

Add import:

```typescript
import { getWishlistItemsForDashboard } from "@/actions/wishlist";
```

Add to data fetching (add a new fetch alongside existing calls):

```typescript
const wishlistSummary = await getWishlistItemsForDashboard();
```

Pass to PlanDecisionRail:

```tsx
<PlanDecisionRail
  budget={planData.budget}
  debt={planData.debt}
  recurring={planData.recurring}
  scenarios={planData.scenarios}
  desires={{
    totalCount: wishlistSummary.totalCount,
    readyCount: wishlistSummary.readyCount,
  }}
  currency={planData.currency}
/>
```

- [ ] **Step 4: Verify build**

Run: `cd webapp && pnpm build`
Expected: Build passes.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/lib/constants/navigation.ts webapp/src/components/plan/plan-decision-rail.tsx webapp/src/app/(dashboard)/plan/page.tsx
git commit -m "feat(deseos): add to navigation, Plan decision rail, and workspace nav"
```

---

## Task 10: Final Verification & Cleanup

- [ ] **Step 1: Run full build**

Run: `cd webapp && pnpm install && pnpm build`
Expected: Clean build with no errors.

- [ ] **Step 2: Manual smoke test**

Start dev server: `cd webapp && pnpm dev`

Verify:
1. `/deseos` page loads with empty state message
2. Quick-add form works (creates item with "?" status)
3. "Completar" opens enrichment drawer
4. After enrichment, item gets scored with traffic light
5. Dashboard shows Deseos widget
6. Plan page decision rail shows Deseos module
7. Sidebar shows "Deseos" in workspace nav

- [ ] **Step 3: Commit any fixes**

If any fixes were needed during smoke test, commit them:

```bash
git add -A
git commit -m "fix(deseos): address smoke test issues"
```

---

## Deferred to v1.1

These items from the spec are intentionally deferred to keep v1 scope manageable:

- **Debt milestone nudge** — Requires hooking into the import flow (`importTransactions` action) to detect when a debt account hits zero or 50%. Add a call to `rescoreAllWishlistItems()` after import and compute the nudge by comparing `getRecentImpactEvents()` with wishlist items.
- **Budget surplus nudge** — Requires computing month-end budget surplus from `get503020Allocation()` and comparing against cheapest wishlist item. Best added as a check in `getActiveNudges()` with the allocation data passed in.
- **Rescore on financial events** — Currently items are re-scored on page load when stale. A background re-score after imports (call `rescoreAllWishlistItems()` from `importTransactions`) would provide fresher data.
- **Transaction search for linking** — The `markWishlistItemBought` action accepts a `transactionId` but the UI doesn't yet search for matching transactions. Add a transaction search by amount ± 10% and date range ± 7 days.

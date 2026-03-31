# Action-First UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace verbose hero/explanation-first management pages with a consistent action-first layout: compact header → two-card zone (metrics + attention) → filters → content. Single attention data source powers sidebar badges, per-page cards, and the Bandeja hub.

**Architecture:** A new `getAttentionSnapshot()` server action becomes the single source of truth for all "needs attention" signals. Every management page adopts a uniform anatomy: header row, two-card zone (CompactMetricBox left, AttentionCard right), filter bar, content zone. The existing `PageHero` and verbose explanation cards are removed. The `/gestionar` page becomes a Bandeja (attention hub), and sidebar/mobile nav get attention-count badges.

**Tech Stack:** Next.js 15 App Router, React 19 Server Components, TypeScript, Tailwind v4, shadcn/ui, Supabase

**Spec:** `docs/superpowers/specs/2026-03-30-action-first-ux-redesign.md`

**Judgment calls made during planning:**
- Detail panel: v1 includes transactions, destinatarios, categories only
- "Minimum payments due" signal: deferred (no `payment_due_date` column exists)
- StatCard: refactored in-place to CompactMetricBox (no parallel component)

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `webapp/src/actions/attention.ts` | `getAttentionSnapshot()` — single source of truth for all attention signals |
| `webapp/src/types/attention.ts` | `AttentionSignal`, `AttentionSnapshot` types |
| `webapp/src/components/ui/attention-card.tsx` | Right-side card showing pending items with action links |
| `webapp/src/components/ui/page-header-row.tsx` | Compact header row: title + subtitle left, actions right |
| `webapp/src/components/ui/summary-card.tsx` | Left-side "Resumen del período" card with 3 compact metric boxes |
| `webapp/src/components/gestionar/attention-hub.tsx` | Full-page attention hub for Bandeja (groups signals by priority) |
| `webapp/src/components/mobile/mobile-link-grid.tsx` | Compact icon+label grid for mobile Bandeja navigation |

### Modified files
| File | Change |
|------|--------|
| `webapp/src/lib/constants/navigation.ts` | Rename "Más" → "Bandeja", update badge type, remove broad `matchHrefs` |
| `webapp/src/components/layout/sidebar.tsx` | Accept `attentionSnapshot`, render per-nav-item badges |
| `webapp/src/components/layout/nav-item-link.tsx` | Support `perPage` badge counts beyond uncategorized |
| `webapp/src/components/mobile/bottom-tab-bar.tsx` | Accept `attentionSnapshot`, show total action count on Bandeja tab |
| `webapp/src/app/(dashboard)/layout.tsx` | Call `getAttentionSnapshot()`, pass to sidebar + bottom bar |
| `webapp/src/app/(dashboard)/gestionar/page.tsx` | Full rewrite → Bandeja attention hub |
| `webapp/src/app/(dashboard)/transactions/page.tsx` | Replace hero/cards with page-header-row + two-card zone |
| `webapp/src/app/(dashboard)/accounts/page.tsx` | Replace PageHero + StatCards with new anatomy |
| `webapp/src/app/(dashboard)/categories/page.tsx` | Replace PageHero, rename tab, remove MonthEndInsight |
| `webapp/src/app/(dashboard)/destinatarios/page.tsx` | Replace hero/cards with new anatomy |
| `webapp/src/app/(dashboard)/recurrentes/page.tsx` | Replace PageHero + wrapper cards with new anatomy |
| `webapp/src/app/(dashboard)/deudas/page.tsx` | Replace PageHero with new anatomy, preserve streaming |
| `webapp/src/app/(dashboard)/settings/page.tsx` | Replace PageHero with new anatomy |
| `webapp/src/components/ui/stat-card.tsx` | Refactor into CompactMetricBox (label + value + context) |
| ~12 server action files | Add `revalidateTag("attention")` to relevant mutations |

### Files to delete (after migration)
| File | Reason |
|------|--------|
| `webapp/src/components/ui/page-hero.tsx` | Replaced by `page-header-row.tsx` — verify zero imports before deleting |
| `webapp/src/components/budget/month-end-insight.tsx` | Data moves to attention system |

---

## Task 1: Attention Types

**Files:**
- Create: `webapp/src/types/attention.ts`

- [ ] **Step 1: Create the attention types file**

```typescript
// webapp/src/types/attention.ts

export type AttentionPriority = "action" | "suggestion";

export type AttentionSignal = {
  page: string;
  key: string;
  count: number;
  label: string;
  priority: AttentionPriority;
  actionHref: string;
};

export type AttentionSnapshot = {
  signals: AttentionSignal[];
  totalAction: number;
  totalSuggestion: number;
  perPage: Record<string, number>;
};
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/types/attention.ts
git commit -m "feat(attention): add AttentionSignal and AttentionSnapshot types"
```

---

## Task 2: Attention Server Action

**Files:**
- Create: `webapp/src/actions/attention.ts`
- Modify: `webapp/src/actions/categorize.ts` (import existing cached functions)

- [ ] **Step 1: Create the getAttentionSnapshot server action**

This action queries all signal sources in parallel and builds the snapshot. It uses `"use cache"` with the `"attention"` tag.

```typescript
// webapp/src/actions/attention.ts
"use server";

import "server-only";
import { cacheTag, cacheLife } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import type { AttentionSignal, AttentionSnapshot } from "@/types/attention";

async function getAttentionSnapshotCached(): Promise<AttentionSnapshot> {
  "use cache";
  cacheTag("attention");
  cacheLife("zeta");

  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { signals: [], totalAction: 0, totalSuggestion: 0, perPage: {} };

  // All queries in parallel
  const [
    uncategorizedResult,
    overBudgetResult,
    suggestionsResult,
    overdueResult,
    upcomingResult,
  ] = await Promise.all([
    // 1. Uncategorized transactions
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("category_id", null)
      .eq("is_excluded", false)
      .is("reconciled_into_transaction_id", null),

    // 2. Over-budget categories — join budgets + transaction sums
    supabase.rpc("get_over_budget_categories", { p_user_id: user.id }),

    // 3. Pending destinatario suggestions (transactions without destinatario, grouped by description)
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("destinatario_id", null)
      .not("raw_description", "is", null)
      .eq("is_excluded", false)
      .is("reconciled_into_transaction_id", null),

    // 4. Overdue recurring (next_occurrence < today)
    supabase
      .from("recurring_transaction_templates")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true)
      .lt("next_occurrence", new Date().toISOString().split("T")[0]),

    // 5. Upcoming recurring (next 7 days)
    supabase
      .from("recurring_transaction_templates")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true)
      .gte("next_occurrence", new Date().toISOString().split("T")[0])
      .lte(
        "next_occurrence",
        new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
      ),
  ]);

  const signals: AttentionSignal[] = [];

  // Uncategorized
  const uncategorizedCount = uncategorizedResult.count ?? 0;
  if (uncategorizedCount > 0) {
    signals.push({
      page: "transactions",
      key: "uncategorized",
      count: uncategorizedCount,
      label: `${uncategorizedCount} sin categoría`,
      priority: "action",
      actionHref: "/categorizar",
    });
  }

  // Over-budget categories
  // Note: if the RPC doesn't exist yet, we'll use a simpler approach.
  // For the initial implementation, we'll compute this from the budget data.
  // The RPC approach is preferred for performance but we'll handle both.
  const overBudgetCount = overBudgetResult.data?.length ?? 0;
  if (overBudgetCount > 0) {
    signals.push({
      page: "categories",
      key: "over_budget",
      count: overBudgetCount,
      label: `${overBudgetCount} sobre el límite`,
      priority: "suggestion",
      actionHref: "/categories",
    });
  }

  // Pending suggestions (simplified — count of unmatched transactions / 3 as proxy)
  // The full suggestion engine groups by cleaned description with 3+ occurrences.
  // For the attention snapshot, we use a simplified count.
  const unmatched = suggestionsResult.count ?? 0;
  const estimatedSuggestions = Math.floor(unmatched / 3);
  if (estimatedSuggestions > 0) {
    signals.push({
      page: "destinatarios",
      key: "suggestions",
      count: estimatedSuggestions,
      label: `${estimatedSuggestions} sugerencias`,
      priority: "suggestion",
      actionHref: "/destinatarios?tab=sugerencias",
    });
  }

  // Overdue recurring
  const overdueCount = overdueResult.count ?? 0;
  if (overdueCount > 0) {
    signals.push({
      page: "recurrentes",
      key: "overdue",
      count: overdueCount,
      label: `${overdueCount} vencidos`,
      priority: "action",
      actionHref: "/recurrentes",
    });
  }

  // Upcoming recurring (7 days)
  const upcomingCount = upcomingResult.count ?? 0;
  if (upcomingCount > 0) {
    signals.push({
      page: "recurrentes",
      key: "upcoming_7d",
      count: upcomingCount,
      label: `${upcomingCount} próximos (7 días)`,
      priority: "suggestion",
      actionHref: "/recurrentes",
    });
  }

  // Build perPage map
  const perPage: Record<string, number> = {};
  for (const signal of signals) {
    perPage[signal.page] = (perPage[signal.page] ?? 0) + signal.count;
  }

  return {
    signals,
    totalAction: signals
      .filter((s) => s.priority === "action")
      .reduce((sum, s) => sum + s.count, 0),
    totalSuggestion: signals
      .filter((s) => s.priority === "suggestion")
      .reduce((sum, s) => sum + s.count, 0),
    perPage,
  };
}

export async function getAttentionSnapshot(): Promise<AttentionSnapshot> {
  return getAttentionSnapshotCached();
}
```

- [ ] **Step 2: Verify the action compiles**

Run: `cd webapp && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to attention.ts

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/attention.ts
git commit -m "feat(attention): add getAttentionSnapshot server action with cached signals"
```

---

## Task 3: Add revalidateTag("attention") to Mutation Actions

**Files:**
- Modify: `webapp/src/actions/categorize.ts`
- Modify: `webapp/src/actions/categories.ts`
- Modify: `webapp/src/actions/budgets.ts`
- Modify: `webapp/src/actions/budget.ts`
- Modify: `webapp/src/actions/destinatarios.ts`
- Modify: `webapp/src/actions/recurring-templates.ts`
- Modify: `webapp/src/actions/import-transactions.ts`
- Modify: `webapp/src/actions/transactions.ts`
- Modify: `webapp/src/actions/accounts.ts`

Every mutation that could change an attention signal must call `revalidateTag("attention")`. The rule is simple: if the action already calls `revalidateTag` for a domain tag that relates to a signal source, add `"attention"` alongside it.

- [ ] **Step 1: Add revalidateTag("attention") to categorize.ts**

Add `revalidateTag("attention")` after the existing `revalidateTag("categorize", ...)` calls in:
- `categorizeTransaction()` (near existing revalidateTag block)
- `confirmAutoCategory()`
- `bulkConfirmAutoCategory()`
- `bulkCategorize()`
- `assignDestinatario()`
- `removeDestinatarioFromTransaction()`

Pattern — add this single line after the existing `revalidateTag("categorize", ...)`:
```typescript
revalidateTag("attention");
```

- [ ] **Step 2: Add to categories.ts**

Add `revalidateTag("attention")` to:
- `createCategory()`
- `updateCategory()`
- `deleteCategory()`
- `reassignAndDeleteCategory()`
- `toggleCategoryActive()`
- `updateCategoryExpenseType()`

- [ ] **Step 3: Add to budgets.ts and budget.ts**

Add `revalidateTag("attention")` to all `setBudget()`, `updateBudget()`, `deleteBudget()` functions in both files.

- [ ] **Step 4: Add to destinatarios.ts**

Add `revalidateTag("attention")` to:
- `createDestinatario()`
- `updateDestinatario()`
- `deleteDestinatario()`
- `createDestinariRule()`

- [ ] **Step 5: Add to recurring-templates.ts**

Add `revalidateTag("attention")` to:
- `createRecurringTemplate()`
- `updateRecurringTemplate()`
- `deleteRecurringTemplate()`
- `toggleRecurringTemplate()`
- `fullfillRecurrence()`

- [ ] **Step 6: Add to import-transactions.ts**

Add `revalidateTag("attention")` to `importTransactions()`.

- [ ] **Step 7: Add to transactions.ts**

Add `revalidateTag("attention")` to `deleteTransaction()`.

- [ ] **Step 8: Add to accounts.ts**

Add `revalidateTag("attention")` to `createAccount()`, `updateAccount()`, `deleteAccount()`.

- [ ] **Step 9: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 10: Commit**

```bash
git add webapp/src/actions/
git commit -m "feat(attention): add revalidateTag('attention') to all signal-affecting mutations"
```

---

## Task 4: Over-Budget RPC (Supabase Migration)

**Files:**
- Create: `supabase/migrations/<timestamp>_add_over_budget_rpc.sql`

The attention action needs a way to count over-budget categories. Rather than pulling all transactions and computing in JS, use a Supabase RPC.

- [ ] **Step 1: Create the migration**

```bash
npx supabase migration new add_over_budget_rpc
```

- [ ] **Step 2: Write the RPC SQL**

Write into the generated migration file:

```sql
CREATE OR REPLACE FUNCTION get_over_budget_categories(p_user_id uuid)
RETURNS TABLE(category_id uuid, budget numeric, spent numeric)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    b.category_id,
    b.amount AS budget,
    COALESCE(SUM(t.amount), 0) AS spent
  FROM budgets b
  JOIN categories c ON c.id = b.category_id
  LEFT JOIN transactions t
    ON t.category_id = b.category_id
    AND t.user_id = p_user_id
    AND t.is_excluded = false
    AND t.reconciled_into_transaction_id IS NULL
    AND t.direction = 'OUTFLOW'
    AND t.transaction_date >= date_trunc('month', CURRENT_DATE)
    AND t.transaction_date < date_trunc('month', CURRENT_DATE) + interval '1 month'
  WHERE b.user_id = p_user_id
    AND b.period = 'monthly'
    AND b.amount > 0
    AND c.direction = 'OUTFLOW'
  GROUP BY b.category_id, b.amount
  HAVING COALESCE(SUM(t.amount), 0) > b.amount;
$$;
```

- [ ] **Step 3: Push migration**

```bash
npx supabase db push
```

- [ ] **Step 4: Regenerate types**

```bash
npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > webapp/src/types/database.ts
```

Verify `export type Json =` header is present in the output file (shell `compdef` warning can corrupt first line).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/ webapp/src/types/database.ts
git commit -m "feat(attention): add get_over_budget_categories RPC for attention signals"
```

---

## Task 5: Refactor StatCard → CompactMetricBox

**Files:**
- Modify: `webapp/src/components/ui/stat-card.tsx`

Rename the component and simplify: remove `description` (verbose), add `context` (short data line). The interface change is minimal enough that we can update all consumers in the page tasks.

- [ ] **Step 1: Refactor stat-card.tsx**

```typescript
// webapp/src/components/ui/stat-card.tsx
import { cn } from "@/lib/utils";

interface CompactMetricBoxProps {
  label: string;
  value: React.ReactNode;
  /** Short data context line, e.g. "4 fuentes", "21% del ingreso" */
  context?: string;
  className?: string;
}

export function CompactMetricBox({
  label,
  value,
  context,
  className,
}: CompactMetricBoxProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/6 bg-black/10 p-4",
        className
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-olive-deep">
        {label}
      </p>
      <p className="mt-2 text-[22px] font-semibold leading-tight">{value}</p>
      {context && (
        <p className="mt-1 text-xs text-muted-foreground">{context}</p>
      )}
    </div>
  );
}

// Keep old export as alias during migration — delete after all pages are updated
export { CompactMetricBox as StatCard };
```

- [ ] **Step 2: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -5`
Expected: Build succeeds (StatCard alias preserves backward compat)

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/ui/stat-card.tsx
git commit -m "refactor(ui): rename StatCard to CompactMetricBox with compact interface"
```

---

## Task 6: PageHeaderRow Component

**Files:**
- Create: `webapp/src/components/ui/page-header-row.tsx`

Replaces PageHero. Compact: bold title left, subtitle with key context, actions right. No pills, no paragraphs.

- [ ] **Step 1: Create the component**

```typescript
// webapp/src/components/ui/page-header-row.tsx
import { cn } from "@/lib/utils";

interface PageHeaderRowProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeaderRow({
  title,
  subtitle,
  actions,
  className,
}: PageHeaderRowProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
          {actions}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/ui/page-header-row.tsx
git commit -m "feat(ui): add PageHeaderRow component for action-first page headers"
```

---

## Task 7: SummaryCard Component

**Files:**
- Create: `webapp/src/components/ui/summary-card.tsx`

Left card in the two-card zone. Contains a section label and 3 compact metric boxes.

- [ ] **Step 1: Create the component**

```typescript
// webapp/src/components/ui/summary-card.tsx
import { cn } from "@/lib/utils";
import { CompactMetricBox } from "@/components/ui/stat-card";

interface SummaryMetric {
  label: string;
  value: React.ReactNode;
  context?: string;
}

interface SummaryCardProps {
  metrics: [SummaryMetric, SummaryMetric, SummaryMetric];
  className?: string;
}

export function SummaryCard({ metrics, className }: SummaryCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/6 bg-z-surface-2/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        className
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-olive-deep">
        Resumen del período
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <CompactMetricBox
            key={m.label}
            label={m.label}
            value={m.value}
            context={m.context}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/ui/summary-card.tsx
git commit -m "feat(ui): add SummaryCard component for two-card zone left panel"
```

---

## Task 8: AttentionCard Component

**Files:**
- Create: `webapp/src/components/ui/attention-card.tsx`

Right card in the two-card zone. Shows attention items from the snapshot filtered by page, with action links. Shows positive "Al día" state when empty.

- [ ] **Step 1: Create the component**

```typescript
// webapp/src/components/ui/attention-card.tsx
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttentionSignal } from "@/types/attention";

interface AttentionCardProps {
  signals: AttentionSignal[];
  className?: string;
}

export function AttentionCard({ signals, className }: AttentionCardProps) {
  const hasSignals = signals.length > 0;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        hasSignals
          ? "border-z-brass/20 bg-z-surface-2/80"
          : "border-z-olive-deep/25 bg-z-surface-2/80",
        className
      )}
    >
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.18em]",
          hasSignals ? "text-z-brass" : "text-z-olive-deep"
        )}
      >
        {hasSignals ? "Necesita atención" : "Estado"}
      </p>

      {hasSignals ? (
        <div className="mt-3 space-y-2">
          {signals.map((signal) => (
            <div
              key={signal.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/10 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-z-brass/15 text-[10px] font-bold text-z-brass">
                  {signal.count}
                </span>
                <span className="truncate text-sm">{signal.label}</span>
              </div>
              <Link
                href={signal.actionHref}
                className="flex-shrink-0 text-xs font-medium text-z-brass hover:text-z-brass/80"
              >
                Resolver &rarr;
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <CheckCircle2 className="size-4 text-z-olive-deep" />
          <span className="text-sm text-z-olive-deep font-medium">Al día</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/ui/attention-card.tsx
git commit -m "feat(ui): add AttentionCard component for two-card zone right panel"
```

---

## Task 9: Update Navigation Constants + Sidebar + Bottom Tab Bar

**Files:**
- Modify: `webapp/src/lib/constants/navigation.ts`
- Modify: `webapp/src/components/layout/sidebar.tsx`
- Modify: `webapp/src/components/layout/nav-item-link.tsx`
- Modify: `webapp/src/components/mobile/bottom-tab-bar.tsx`
- Modify: `webapp/src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Update navigation.ts**

Change the "Más" nav item:

```typescript
// In PRIMARY_NAV array, replace the last item:
{
  title: "Bandeja",
  href: "/gestionar",
  icon: Inbox, // Change from Menu to Inbox (import Inbox from lucide-react)
  badge: "attention",
  // Remove matchHrefs — Bandeja only matches /gestionar
},
```

Update the `NavItem` type's badge field:
```typescript
badge?: "uncategorized" | "attention";
```

- [ ] **Step 2: Update sidebar.tsx**

Change the `SidebarProps` to accept `AttentionSnapshot` instead of just `uncategorizedCount`:

```typescript
import type { AttentionSnapshot } from "@/types/attention";

interface SidebarProps {
  attentionSnapshot?: AttentionSnapshot;
}

export function Sidebar({ attentionSnapshot }: SidebarProps) {
  const pathname = usePathname();

  function renderNavItem(item: NavItem, variant: "primary" | "secondary") {
    return (
      <NavItemLink
        key={item.href}
        item={item}
        variant={variant}
        pathname={pathname}
        attentionSnapshot={attentionSnapshot}
      />
    );
  }

  // ... rest unchanged, except remove subtitle "Estado y siguiente paso":
  // Change:
  //   <p className="truncate text-xs text-muted-foreground">Estado y siguiente paso</p>
  // To: remove this line entirely
```

- [ ] **Step 3: Update nav-item-link.tsx**

Read the current file first. Then update to show per-page badge counts from `attentionSnapshot.perPage` for WORKSPACE_NAV items, and `totalAction` for the Bandeja nav item.

The nav item link needs to:
- For items with `badge: "attention"`: show `attentionSnapshot.totalAction` as brass badge
- For workspace nav items: show `attentionSnapshot.perPage[pageKey]` as subtle muted badge
- Map href to page key: `/transactions` → `"transactions"`, `/destinatarios` → `"destinatarios"`, `/recurrentes` → `"recurrentes"`, `/categories` or `/presupuesto` → `"categories"`, `/categorizar` → `"transactions"` (uncategorized)

- [ ] **Step 4: Update bottom-tab-bar.tsx**

Change props from `uncategorizedCount` to `attentionSnapshot`:

```typescript
import type { AttentionSnapshot } from "@/types/attention";

interface BottomTabBarProps {
  attentionSnapshot?: AttentionSnapshot;
}
```

Show `attentionSnapshot.totalAction` as badge on the Bandeja tab instead of `uncategorizedCount`.

- [ ] **Step 5: Update layout.tsx**

Replace `getUncategorizedCount()` and `getUnreviewedAutoCount()` with `getAttentionSnapshot()`:

```typescript
import { getAttentionSnapshot } from "@/actions/attention";

// In the data fetching block, replace:
//   const [uncategorizedCount, unreviewedAutoCount, ...] = await Promise.all([
//     getUncategorizedCount(),
//     getUnreviewedAutoCount(),
//     ...
//   ]);
// With:
const [attentionSnapshot, accountsResult, categoriesResult] = await Promise.all([
  getAttentionSnapshot(),
  getAccounts(),
  getCategories(),
]);

// Pass to components:
<Sidebar attentionSnapshot={attentionSnapshot} />
<Topbar profile={profile} attentionSnapshot={attentionSnapshot} />
<BottomTabBar attentionSnapshot={attentionSnapshot} />
```

Note: Check if `Topbar` also uses `uncategorizedCount` and update accordingly.

- [ ] **Step 6: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add webapp/src/lib/constants/navigation.ts webapp/src/components/layout/ webapp/src/components/mobile/bottom-tab-bar.tsx webapp/src/app/(dashboard)/layout.tsx
git commit -m "feat(attention): wire attention snapshot to sidebar, bottom tab, and layout"
```

---

## Task 10: Bandeja Page (Gestionar Rewrite)

**Files:**
- Create: `webapp/src/components/gestionar/attention-hub.tsx`
- Create: `webapp/src/components/mobile/mobile-link-grid.tsx`
- Modify: `webapp/src/app/(dashboard)/gestionar/page.tsx`

- [ ] **Step 1: Create AttentionHub component**

```typescript
// webapp/src/components/gestionar/attention-hub.tsx
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { AttentionSignal } from "@/types/attention";

interface AttentionHubProps {
  signals: AttentionSignal[];
}

export function AttentionHub({ signals }: AttentionHubProps) {
  const actionSignals = signals.filter((s) => s.priority === "action");
  const suggestionSignals = signals.filter((s) => s.priority === "suggestion");

  if (signals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-z-olive-deep/25 bg-z-surface-2/80 px-6 py-16 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <CheckCircle2 className="size-10 text-z-olive-deep" />
        <h2 className="mt-4 text-xl font-semibold text-z-olive-deep">Al día</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          No hay frentes pendientes. Tu sistema está limpio y listo para operar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {actionSignals.length > 0 && (
        <section className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-brass">
            Requiere acción
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {actionSignals.map((signal) => (
              <Link
                key={signal.key}
                href={signal.actionHref}
                className="flex items-center justify-between gap-3 rounded-2xl border border-z-brass/20 bg-z-surface-2/80 px-4 py-4 transition-colors hover:bg-white/5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-z-brass/15 text-sm font-bold text-z-brass">
                    {signal.count}
                  </span>
                  <span className="truncate text-sm font-medium">{signal.label}</span>
                </div>
                <span className="flex-shrink-0 text-xs text-z-brass">Resolver &rarr;</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {suggestionSignals.length > 0 && (
        <section className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Sugerencias
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suggestionSignals.map((signal) => (
              <Link
                key={signal.key}
                href={signal.actionHref}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/6 bg-z-surface-2/80 px-4 py-4 transition-colors hover:bg-white/5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/8 text-sm font-bold text-muted-foreground">
                    {signal.count}
                  </span>
                  <span className="truncate text-sm font-medium">{signal.label}</span>
                </div>
                <span className="flex-shrink-0 text-xs text-muted-foreground">Ver &rarr;</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create MobileLinkGrid component**

```typescript
// webapp/src/components/mobile/mobile-link-grid.tsx
import Link from "next/link";
import {
  FolderKanban,
  Contact,
  FileUp,
  Wallet,
  PiggyBank,
  Landmark,
  Repeat2,
  Settings,
  Tags,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const LINKS: { href: string; icon: LucideIcon; label: string }[] = [
  { href: "/categorizar", icon: Tags, label: "Categorizar" },
  { href: "/destinatarios", icon: Contact, label: "Destinatarios" },
  { href: "/import", icon: FileUp, label: "Importar" },
  { href: "/accounts", icon: Wallet, label: "Cuentas" },
  { href: "/presupuesto", icon: PiggyBank, label: "Presupuesto" },
  { href: "/deudas", icon: Landmark, label: "Deudas" },
  { href: "/recurrentes", icon: Repeat2, label: "Recurrentes" },
  { href: "/settings", icon: Settings, label: "Ajustes" },
];

export function MobileLinkGrid() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {LINKS.map(({ href, icon: Icon, label }) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-center gap-2 rounded-2xl border border-white/6 bg-z-surface-2/80 px-3 py-4 transition-colors hover:bg-white/5"
        >
          <Icon className="size-5 text-muted-foreground" />
          <span className="text-xs font-medium">{label}</span>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite gestionar/page.tsx**

```typescript
// webapp/src/app/(dashboard)/gestionar/page.tsx
import { connection } from "next/server";
import { getAttentionSnapshot } from "@/actions/attention";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { AttentionHub } from "@/components/gestionar/attention-hub";
import { MobileLinkGrid } from "@/components/mobile/mobile-link-grid";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";

export default async function BandejaPage() {
  await connection();
  const snapshot = await getAttentionSnapshot();

  return (
    <div className="space-y-6">
      <MobilePageHeader title="Bandeja" />

      {/* Desktop */}
      <div className="hidden lg:block space-y-6">
        <PageHeaderRow
          title="Bandeja"
          subtitle={
            snapshot.totalAction > 0
              ? `${snapshot.totalAction} pendientes`
              : "Todo al día"
          }
        />
        <AttentionHub signals={snapshot.signals} />
      </div>

      {/* Mobile */}
      <div className="lg:hidden space-y-6">
        <AttentionHub signals={snapshot.signals} />
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Ir a
          </p>
          <MobileLinkGrid />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/gestionar/ webapp/src/components/mobile/mobile-link-grid.tsx webapp/src/app/(dashboard)/gestionar/page.tsx
git commit -m "feat(bandeja): rewrite gestionar page as attention hub with mobile link grid"
```

---

## Task 11: Transactions Page Redesign

**Files:**
- Modify: `webapp/src/app/(dashboard)/transactions/page.tsx`

Replace the current hero + dual cards + action card pattern with: PageHeaderRow → two-card zone (SummaryCard + AttentionCard) → filters → content.

- [ ] **Step 1: Rewrite the desktop section of transactions page**

The page currently has a mobile section (`lg:hidden`) and desktop section (`hidden lg:block`). Rewrite the desktop section:

Replace everything between `<div className="hidden lg:block space-y-6">` and its closing `</div>` (lines ~198-324) with:

```tsx
<div className="hidden lg:block space-y-6">
  <PageHeaderRow
    title="Movimientos"
    subtitle={`${monthLabel} · ${transactionsResult.count} ${scopeLabel}`}
    actions={
      <>
        <Suspense>
          <MonthSelector />
        </Suspense>
        <TransactionFormDialog accounts={accounts} categories={categories} tags={allTags} />
      </>
    }
  />

  <div className="grid gap-4 lg:grid-cols-2">
    <SummaryCard
      metrics={[
        { label: "Movimientos", value: transactionsResult.count, context: scopeLabel },
        { label: "Ingresos", value: formatCurrency(inflowVisible, summaryCurrency), context: "en la vista actual" },
        { label: "Gastos", value: formatCurrency(outflowVisible, summaryCurrency), context: "en la vista actual" },
      ]}
    />
    <AttentionCard
      signals={
        uncategorizedVisible > 0
          ? [{
              page: "transactions",
              key: "uncategorized_visible",
              count: uncategorizedVisible,
              label: "sin categoría en pantalla",
              priority: "action" as const,
              actionHref: "/categorizar",
            }]
          : []
      }
    />
  </div>

  <Suspense>
    <TransactionFilters accounts={accounts} tags={allTags} />
  </Suspense>

  <QuickCaptureBar accounts={accounts} categories={categories} />

  <PurchaseDecisionCard
    accounts={accounts}
    categories={outflowCategories}
    defaultMonth={defaultMonth}
  />

  <TransactionTable transactions={transactionsResult.data} categories={categories} />

  <Suspense>
    <Pagination
      page={transactionsResult.page}
      totalPages={transactionsResult.totalPages}
      count={transactionsResult.count}
    />
  </Suspense>
</div>
```

Update imports at the top of the file:
- Add: `import { PageHeaderRow } from "@/components/ui/page-header-row";`
- Add: `import { SummaryCard } from "@/components/ui/summary-card";`
- Add: `import { AttentionCard } from "@/components/ui/attention-card";`
- Remove unused: `PageHero`, `HeroPill`, `HeroAccentPill`, `StatCard` (if no longer used)

Also simplify the mobile section — remove the verbose action card, keep the compact structure.

- [ ] **Step 2: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -10`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/(dashboard)/transactions/page.tsx
git commit -m "feat(transactions): apply action-first layout with two-card zone"
```

---

## Task 12: Accounts Page Redesign

**Files:**
- Modify: `webapp/src/app/(dashboard)/accounts/page.tsx`

- [ ] **Step 1: Rewrite accounts page**

Replace the `PageHero` section with the new anatomy:

```tsx
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { SummaryCard } from "@/components/ui/summary-card";
import { AttentionCard } from "@/components/ui/attention-card";
// Remove: PageHero, HeroPill, HeroAccentPill, StatCard imports

// Replace from <PageHero ...> to </PageHero> (lines ~79-131) with:
<PageHeaderRow
  title="Cuentas"
  subtitle={`${accounts.length} activas · ${formatCurrency(totalBalance, currency)} patrimonio`}
  actions={
    <>
      <Button asChild className={BRASS_BUTTON_CLASS}>
        <Link href="/import">
          Importar extracto
          <ArrowRight className="size-4" />
        </Link>
      </Button>
      <AccountFormDialog />
    </>
  }
/>

<div className="grid gap-4 lg:grid-cols-2">
  <SummaryCard
    metrics={[
      { label: "Patrimonio neto", value: formatCurrency(totalBalance, currency), context: `en ${currency}` },
      { label: "Cuentas activas", value: accounts.length, context: `${liquidAccounts.length} liquidez · ${debtAccounts.length} deuda` },
      { label: "Presión de deuda", value: debtPressureCount, context: "con saldo pendiente" },
    ]}
  />
  <AttentionCard signals={[]} />
</div>

{secondaryCurrencies.size > 0 && (
  <div className="rounded-2xl border border-white/6 bg-z-surface-2/60 p-4">
    <div className="flex items-start gap-3">
      <Sparkles className="mt-0.5 size-4 text-z-brass" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-z-white">Monedas secundarias</p>
        <p className="text-sm text-muted-foreground">
          {Array.from(secondaryCurrencies.entries())
            .map(([cur, bal]) => `${formatCurrency(bal, cur as CurrencyCode)} ${cur}`)
            .join(" · ")}
        </p>
      </div>
    </div>
  </div>
)}
```

Also remove section descriptions — keep section titles but drop the `<p>` descriptions under each section title.

- [ ] **Step 2: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -10`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/(dashboard)/accounts/page.tsx
git commit -m "feat(accounts): apply action-first layout with two-card zone"
```

---

## Task 13: Categories/Presupuesto Page Redesign

**Files:**
- Modify: `webapp/src/app/(dashboard)/categories/page.tsx`

Key changes: Replace PageHero, rename "Gestionar" tab → "Configurar", remove MonthEndInsight.

- [ ] **Step 1: Rewrite categories page**

Replace the PageHero section and update the tabs:

```tsx
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { SummaryCard } from "@/components/ui/summary-card";
import { AttentionCard } from "@/components/ui/attention-card";
import { getAttentionSnapshot } from "@/actions/attention";
// Remove: PageHero, HeroPill, HeroAccentPill, StatCard imports
// Remove: MonthEndInsight import

// Add to the data fetch Promise.all:
// const [currency, manageResult, uncategorized, categoryTreeResult, attentionSnapshot] = await Promise.all([
//   ...,
//   getAttentionSnapshot(),
// ]);

// Replace from <PageHero> to </PageHero> with:
<PageHeaderRow
  title="Presupuesto"
  subtitle={`${monthLabel} · ${daysRemaining} días restantes`}
  actions={
    <>
      <Button asChild className={BRASS_BUTTON_CLASS}>
        <Link href="/plan">
          Volver a Plan
          <ArrowRight className="size-4" />
        </Link>
      </Button>
      <MonthPlanner categories={outflowCategories} />
      <div className="hidden lg:block">
        <MonthSelector />
      </div>
    </>
  }
/>

<div className="grid gap-4 lg:grid-cols-2">
  <SummaryCard
    metrics={[
      { label: "Días restantes", value: daysRemaining, context: monthLabel },
      { label: "Con límite", value: outflowCategories.filter(c => (c.budget ?? 0) > 0).length, context: "categorías activas" },
      { label: "Sin categoría", value: uncategorized.length, context: "movimientos pendientes" },
    ]}
  />
  <AttentionCard
    signals={attentionSnapshot.signals.filter(s => s.page === "categories")}
  />
</div>

// Remove the <MonthEndInsight> line completely

// In the Tabs section, rename:
<TabsTrigger value="configurar">Configurar</TabsTrigger>
// ... and
<TabsContent value="configurar" className="mt-4">
```

Handle tab parameter migration: add at the top of the component after parsing searchParams:
```typescript
const { month, tab } = await searchParams;
// Normalize old tab parameter
const activeTab = tab === "gestionar" ? "configurar" : (tab ?? "presupuesto");
```

Use `activeTab` as `defaultValue` on the `Tabs` component.

- [ ] **Step 2: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -10`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/(dashboard)/categories/page.tsx
git commit -m "feat(categories): apply action-first layout, rename tab, remove MonthEndInsight"
```

---

## Task 14: Destinatarios Page Redesign

**Files:**
- Modify: `webapp/src/app/(dashboard)/destinatarios/page.tsx`

- [ ] **Step 1: Rewrite destinatarios page**

Replace the verbose hero/cards with the new anatomy:

```tsx
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { SummaryCard } from "@/components/ui/summary-card";
import { AttentionCard } from "@/components/ui/attention-card";
import { getAttentionSnapshot } from "@/actions/attention";
// Remove unused hero/card imports

// Add getAttentionSnapshot() to the Promise.all
// const [..., attentionSnapshot] = await Promise.all([..., getAttentionSnapshot()]);

// Replace both mobile and desktop hero sections with:
<MobilePageHeader title="Destinatarios" backHref="/gestionar" />

<PageHeaderRow
  title="Destinatarios"
  subtitle={`${destinatarios.length} registrados · ${withRules} con reglas`}
  actions={
    <div className="flex items-center gap-2">
      <Button asChild variant="outline" className="border-white/8 bg-black/10 text-z-sage-light hover:bg-white/5 hover:text-z-sage-light">
        <Link href="/categorizar">
          <Tags className="size-4 mr-2" />
          Ver Categorizar
        </Link>
      </Button>
      <CreateDestinatarioDialog
        categories={categories}
        trigger={
          <Button className="bg-z-brass text-z-ink hover:bg-z-brass/90">
            <Plus className="size-4 mr-2" />
            Crear destinatario
          </Button>
        }
      />
    </div>
  }
/>

<div className="grid gap-4 lg:grid-cols-2">
  <SummaryCard
    metrics={[
      { label: "Total", value: destinatarios.length, context: `${activeDestinatarios} activos` },
      { label: "Con reglas", value: withRules, context: "listos para automatizar" },
      { label: "Sugerencias", value: suggestions.length, context: "por revisar" },
    ]}
  />
  <AttentionCard
    signals={attentionSnapshot.signals.filter(s => s.page === "destinatarios")}
  />
</div>
```

Remove the separate mobile and desktop hero sections (the `lg:hidden` hero block and the `hidden lg:block` hero block). Keep only the shared structure above + the Tabs section below.

- [ ] **Step 2: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -10`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/(dashboard)/destinatarios/page.tsx
git commit -m "feat(destinatarios): apply action-first layout with two-card zone"
```

---

## Task 15: Recurrentes Page Redesign

**Files:**
- Modify: `webapp/src/app/(dashboard)/recurrentes/page.tsx`

- [ ] **Step 1: Rewrite recurrentes page**

Replace PageHero + wrapper cards:

```tsx
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { SummaryCard } from "@/components/ui/summary-card";
import { AttentionCard } from "@/components/ui/attention-card";
import { getAttentionSnapshot } from "@/actions/attention";
// Remove: PageHero, HeroPill, HeroAccentPill, StatCard imports

// Add to Promise.all:
// const [..., attentionSnapshot] = await Promise.all([..., getAttentionSnapshot()]);

// Replace PageHero section with:
<PageHeaderRow
  title="Recurrentes"
  subtitle={`${summary.activeCount} plantillas activas`}
  actions={
    <>
      <Button asChild className={BRASS_BUTTON_CLASS}>
        <Link href="/plan">
          Volver a Plan
          <ArrowRight className="size-4" />
        </Link>
      </Button>
      <RecurringFormDialog accounts={accounts} categories={categories} />
    </>
  }
/>

<div className="grid gap-4 lg:grid-cols-2">
  <SummaryCard
    metrics={[
      { label: "Plantillas activas", value: summary.activeCount, context: "rutinas recurrentes" },
      { label: "Salidas/mes", value: formatCurrency(summary.totalMonthlyExpenses, currency), context: "compromiso fijo" },
      { label: "Entradas/mes", value: formatCurrency(summary.totalMonthlyIncome, currency), context: "ingreso recurrente" },
    ]}
  />
  <AttentionCard
    signals={attentionSnapshot.signals.filter(s => s.page === "recurrentes")}
  />
</div>

// Remove wrapper Card around RecurringTimelineView — render directly:
<RecurringTimelineView templates={templates} accounts={accounts} />

// Remove wrapper Card around RecurringList — render directly:
<RecurringList templates={templates} accounts={accounts} categories={categories} />
```

- [ ] **Step 2: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -10`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/(dashboard)/recurrentes/page.tsx
git commit -m "feat(recurrentes): apply action-first layout, remove wrapper cards"
```

---

## Task 16: Deudas Page Redesign

**Files:**
- Modify: `webapp/src/app/(dashboard)/deudas/page.tsx`

Key: preserve the Suspense/streaming architecture. Only the tier 1 header section changes.

- [ ] **Step 1: Rewrite the tier 1 header section**

Replace the `PageHero` block (lines ~179-227) with:

```tsx
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { SummaryCard } from "@/components/ui/summary-card";
import { AttentionCard } from "@/components/ui/attention-card";
// Remove: PageHero, HeroPill, HeroAccentPill, StatCard imports

// Replace the PageHero section with:
<PageHeaderRow
  title="Deudas"
  subtitle={`Lectura en ${currency}`}
  actions={
    <>
      <Button asChild className={BRASS_BUTTON_CLASS}>
        <Link href="/deudas/planificador">
          Planificador de pagos
          <ArrowRight className="size-4" />
        </Link>
      </Button>
      <Button asChild variant="outline" className={GHOST_BUTTON_CLASS}>
        <Link href="/plan">Volver a Plan</Link>
      </Button>
      <div className="hidden lg:block">
        <Suspense>
          <MonthSelector />
        </Suspense>
      </div>
    </>
  }
/>

// Note: Deudas doesn't use a two-card zone because the tier 2 streaming section
// already provides the DebtHeroCard, UtilizationGauge, and InterestCostCard.
// The attention card for deudas is omitted (no debt signals in v1 — payment_due_date deferred).
```

Remove the StatCards inside PageHero (they were verbose guidance, not data). The actual debt metrics live in the Suspense-streamed DebtOverviewSection.

- [ ] **Step 2: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -10`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/(dashboard)/deudas/page.tsx
git commit -m "feat(deudas): apply action-first header, preserve streaming architecture"
```

---

## Task 17: Settings Page Redesign

**Files:**
- Modify: `webapp/src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Rewrite settings page**

Replace PageHero with compact header. Settings has no attention signals, so the two-card zone shows summary + "Al día".

```tsx
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { SummaryCard } from "@/components/ui/summary-card";
import { AttentionCard } from "@/components/ui/attention-card";
// Remove: PageHero, HeroPill, HeroAccentPill, StatCard imports

// Replace PageHero section with:
<PageHeaderRow
  title="Ajustes"
  subtitle={profile.full_name || "Sin nombre visible"}
  actions={
    <Button asChild className={BRASS_BUTTON_CLASS}>
      <Link href="/settings/analytics">
        Ver actividad de uso
        <ArrowRight className="size-4" />
      </Link>
    </Button>
  }
/>

<div className="grid gap-4 lg:grid-cols-2">
  <SummaryCard
    metrics={[
      { label: "Perfil activo", value: profile.full_name || "—", context: profile.email },
      { label: "Correo", value: profile.email, context: "canal de acceso" },
      { label: "Miembro desde", value: memberSince, context: "antigüedad" },
    ]}
  />
  <AttentionCard signals={[]} />
</div>
```

Also update the "Volver a Más" link text to "Bandeja":
```tsx
// Change:
//   <Link href="/gestionar">Volver a Más</Link>
// To: remove this button entirely (sidebar handles navigation)
```

Remove descriptions under section card titles — keep the icon + title, drop the `<p>` subtitle.

- [ ] **Step 2: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -10`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/(dashboard)/settings/page.tsx
git commit -m "feat(settings): apply action-first layout with two-card zone"
```

---

## Task 18: Update MobilePageHeader backHref References

**Files:**
- Modify: Multiple page files

Several pages use `backHref="/gestionar"` in `MobilePageHeader`. The route doesn't change, but the label context changes. Since the component uses the URL (not a label), these work fine. However, check for any hardcoded "Más" or "Volver a Más" text strings.

- [ ] **Step 1: Search and replace "Más" label references**

Search the codebase for:
- `"Volver a Más"` → Remove or change to `"Bandeja"` (the settings page button was already removed in Task 17)
- `"Más"` in text strings that refer to the navigation item → `"Bandeja"`

- [ ] **Step 2: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -10`

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "fix: update 'Más' label references to 'Bandeja'"
```

---

## Task 19: Delete Deprecated Components

**Files:**
- Delete: `webapp/src/components/ui/page-hero.tsx`
- Delete: `webapp/src/components/budget/month-end-insight.tsx`
- Modify: `webapp/src/components/ui/stat-card.tsx` (remove backward-compat alias)

- [ ] **Step 1: Verify no remaining imports of PageHero**

Search for: `from.*page-hero` or `PageHero` across all files. If any remain, update them first.

- [ ] **Step 2: Verify no remaining imports of MonthEndInsight**

Search for: `MonthEndInsight` or `month-end-insight` across all files.

- [ ] **Step 3: Delete the files**

```bash
rm webapp/src/components/ui/page-hero.tsx
rm webapp/src/components/budget/month-end-insight.tsx
```

- [ ] **Step 4: Remove StatCard alias from stat-card.tsx**

Remove the line `export { CompactMetricBox as StatCard };` from `webapp/src/components/ui/stat-card.tsx`. Search for any remaining `StatCard` imports and update them to `CompactMetricBox`.

- [ ] **Step 5: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -10`
Expected: Build succeeds with no missing import errors

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: delete PageHero, MonthEndInsight, and StatCard alias"
```

---

## Task 20: Final Verification

- [ ] **Step 1: Full build**

```bash
cd webapp && pnpm install && pnpm build
```

Expected: Clean build, no errors.

- [ ] **Step 2: Visual review**

Open the app and navigate to each page to verify:
- `/gestionar` — Bandeja with attention signals
- `/transactions` — compact header + two-card zone + content
- `/accounts` — compact header + two-card zone + grouped sections
- `/categories` — compact header + two-card zone + tabs (check "Configurar" tab)
- `/destinatarios` — compact header + two-card zone + tabs
- `/recurrentes` — compact header + two-card zone + timeline + list
- `/deudas` — compact header + streamed content
- `/settings` — compact header + two-card zone + section cards
- Sidebar — "Bandeja" label with attention count badge
- Mobile bottom nav — "Bandeja" tab with badge

- [ ] **Step 3: Commit any visual fixes**

```bash
git add -A
git commit -m "fix: visual polish from action-first UX review"
```

---

## Execution Notes

**Critical path:** Tasks 1-4 (types, action, revalidation, RPC) must complete before Task 9 (layout wiring). Tasks 5-8 (UI components) are independent of each other and can be parallelized. Tasks 10-17 (page rewrites) can be parallelized after components exist. Tasks 18-20 are cleanup and must run last.

**Parallel wave strategy:**
- Wave 1: Tasks 1-4 (data layer) + Tasks 5-8 (UI components) — 2 parallel streams
- Wave 2: Task 9 (navigation/layout wiring)
- Wave 3: Tasks 10-17 (page rewrites) — all parallelizable
- Wave 4: Tasks 18-20 (cleanup + verification)

**Over-budget RPC note (Task 4):** If the `recurring_transaction_templates` table doesn't have a `next_occurrence` column, the overdue/upcoming queries in Task 2 will need adjustment. Verify the schema and adapt the queries to compute occurrence dates in JS from the template fields (as the existing `getUpcomingRecurrences` does). The RPC approach is preferred for the budget signal since it's a true aggregate.

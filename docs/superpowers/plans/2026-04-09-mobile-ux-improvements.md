# Mobile UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface import as the primary CTA on mobile, standardize transaction row layouts, and show tag colors inline in collapsed rows.

**Architecture:** Three independent changes to mobile webapp components. Data pipeline extended to include tags and snapshot dates in `MobileZone`. Two new presentational components (`InicioStarter`, `InicioImportStrip`). Existing components enriched (`MovimientosTransactionRow`, `InicioActivity`, `ImportarDetail`).

**Tech Stack:** Next.js 15, React 19, Tailwind v4, shadcn/ui, Supabase (query joins)

**Spec:** `docs/superpowers/specs/2026-04-09-mobile-ux-improvements-design.md`

**Visual companion:** `docs/visual-companions/ux-improvements-april-2026.html`

---

## Agent Dispatch Schedule

Specialized agents MUST be spawned at these checkpoints — not deferred to the end.

| After Task | Agent to Spawn | Why |
|------------|---------------|-----|
| Task 1 | `server-action-reviewer` | Modified `actions/transactions.ts` — verify auth, defense-in-depth, return types |
| Task 4 | `cache-doctor` | `MobileZone` now calls `getLatestSnapshotDates()` — verify caching + revalidation path |
| Task 6 | `zetas-front-guy` | `InicioActivity` rewrite — verify tokens, component reuse, design system |
| Task 7 | `zetas-front-guy` | `MovimientosTransactionRow` enrichment — verify tokens, layout consistency |
| Task 9 | `zetas-front-guy` | `ImportarDetail` + chip changes — verify tokens, button variants |
| Task 10 | `perf-auditor` | Final gate — verify tags join perf, caching, rendering strategy, bundle |

**Rules:**
- Agents run in **background** (`run_in_background: true`) — implementation continues while the agent reviews. When the agent reports back, fix any flagged issues before the final build gate.
- If a background agent flags critical issues (e.g., wrong auth pattern, missing cache invalidation), pause and fix immediately.
- `zetas-front-guy` reviews are cumulative — Tasks 2, 3, 5 (new components / wiring) are reviewed alongside their first consumer (Task 6/7).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `webapp/src/actions/transactions.ts` | Modify | Extend `getRecentTransactions` query to include account + category + tags |
| `webapp/src/components/dashboard/zones/mobile-zone.tsx` | Modify | Pass `starterMode`, `daysSinceImport`, enriched recent tx |
| `webapp/src/components/mobile/v2/inicio/inicio-starter.tsx` | Create | Starter mode CTA card for first-run experience |
| `webapp/src/components/mobile/v2/inicio/inicio-import-strip.tsx` | Create | Contextual stale import banner |
| `webapp/src/components/mobile/v2/inicio/inicio-root.tsx` | Modify | Accept `starterMode`/`daysSinceImport`, render starter/strip |
| `webapp/src/components/mobile/v2/inicio/inicio-activity.tsx` | Modify | Rewrite with direction icon + account + category + tags |
| `webapp/src/components/mobile/v2/movimientos/movimientos-transaction-row.tsx` | Modify | Add direction icon, category in collapsed, tags below |
| `webapp/src/components/mobile/v2/movimientos/movimientos-herramientas.tsx` | Modify | Always-sage chip, PDF CTA in ImportarDetail |
| `webapp/src/components/mobile/v2/movimientos/movimientos-root.tsx` | Modify | Pass tags per transaction to rows |

---

### Task 1: Extend `getRecentTransactions` to include account, category, and tags

**Files:**
- Modify: `webapp/src/actions/transactions.ts:573-617`

- [ ] **Step 1: Extend `RecentTransaction` type**

```ts
// webapp/src/actions/transactions.ts — replace the type at line 573
export type RecentTransaction = {
  id: string;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  account_id: string;
  merchant_name: string | null;
  clean_description: string | null;
  transaction_date: string;
  currency_code: string;
  categories: { name_es: string | null; name: string; icon: string | null } | null;
  accounts: { name: string; color: string | null } | null;
  transaction_tags: Array<{
    tag: { id: string; name: string; color: string | null; group: { color: string | null } | null };
  }>;
};
```

- [ ] **Step 2: Extend the query in `getRecentTransactionsCached`**

Replace the `.select(...)` at line 600 with:

```ts
.select(`
  id, amount, direction, account_id, merchant_name, clean_description,
  transaction_date, currency_code,
  categories!category_id(name_es, name, icon),
  accounts!account_id(name, color),
  transaction_tags(tag:tags(id, name, color, group:tag_groups(color)))
`)
```

- [ ] **Step 3: Verify build compiles**

Run: `cd webapp && pnpm build`

- [ ] **Step 4: Commit**

```
feat: extend getRecentTransactions with account, category, tags
```

---

### Task 2: Create `InicioStarter` component

**Files:**
- Create: `webapp/src/components/mobile/v2/inicio/inicio-starter.tsx`

- [ ] **Step 1: Create the starter mode component**

```tsx
import Link from "next/link";
import { FileUp, BarChart3, Tags, Bell } from "lucide-react";
import { BRASS_BUTTON_CLASS, PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";

export function InicioStarter() {
  return (
    <div className="space-y-3">
      {/* Welcome text */}
      <div>
        <p className="text-base font-semibold">Tu base esta lista</p>
        <p className="text-xs text-muted-foreground">
          Falta activar tu flujo con datos reales.
        </p>
      </div>

      {/* Primary CTA card */}
      <div className="rounded-[14px] border border-z-brass/20 bg-[linear-gradient(135deg,rgba(var(--z-brass-rgb,183,165,122),0.08),transparent_60%)] p-5 text-center">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border border-z-brass/20 bg-z-brass/10">
          <FileUp className="size-5 text-z-brass" />
        </div>
        <p className="text-[15px] font-semibold">Importa tu primer extracto</p>
        <p className="mx-auto mt-1 max-w-[260px] text-[11px] leading-relaxed text-muted-foreground">
          Sube el PDF de tu banco y Zeta extrae movimientos, aprende destinatarios
          y activa metricas automaticamente.
        </p>
        <div className="mt-4">
          <Link
            href="/import"
            className={cn(
              BRASS_BUTTON_CLASS,
              "inline-flex items-center gap-1.5 rounded-lg px-5 py-2 text-xs font-semibold"
            )}
          >
            <FileUp className="size-3.5" />
            Importar extracto PDF
          </Link>
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground">
          O{" "}
          <Link href="/transactions" className="text-z-sage-light underline">
            registra un movimiento manual
          </Link>
        </p>
      </div>

      {/* What unlocks after import */}
      <div>
        <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
          Despues de importar
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { icon: BarChart3, label: "Metricas activas" },
            { icon: Tags, label: "Auto-categorias" },
            { icon: Bell, label: "Alertas activas" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className={cn(PANEL_INSET_CLASS, "p-2.5 text-center")}
            >
              <Icon className="mx-auto size-4 text-muted-foreground" />
              <p className="mt-1 text-[9px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build compiles**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```
feat: add InicioStarter component for mobile first-run
```

---

### Task 3: Create `InicioImportStrip` component

**Files:**
- Create: `webapp/src/components/mobile/v2/inicio/inicio-import-strip.tsx`

- [ ] **Step 1: Create the import strip component**

```tsx
import Link from "next/link";
import { FileUp } from "lucide-react";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";

interface InicioImportStripProps {
  daysSinceImport: number;
}

export function InicioImportStrip({ daysSinceImport }: InicioImportStripProps) {
  if (daysSinceImport <= 15) return null;

  return (
    <div className="flex items-center gap-2.5 rounded-[14px] border border-z-brass/20 bg-[linear-gradient(135deg,rgba(var(--z-brass-rgb,183,165,122),0.06),transparent_50%)] px-3 py-2.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-z-brass/20 bg-z-brass/10">
        <FileUp className="size-4 text-z-brass" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold">
          {daysSinceImport} dias sin importar
        </p>
        <p className="text-[10px] text-muted-foreground">
          Actualiza para que las metricas reflejen tu posicion real.
        </p>
      </div>
      <Link
        href="/import"
        className={cn(
          BRASS_BUTTON_CLASS,
          "shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold"
        )}
      >
        Importar
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Verify build compiles**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```
feat: add InicioImportStrip for stale import nudge
```

---

### Task 4: Wire `MobileZone` to pass starter mode + days since import

**Files:**
- Modify: `webapp/src/components/dashboard/zones/mobile-zone.tsx:1-111`

- [ ] **Step 1: Add `getLatestSnapshotDates` import and fetch**

Add import at top:
```ts
import { getLatestSnapshotDates } from "@/actions/statement-snapshots";
import { differenceInDays } from "date-fns";
```

Add to the `Promise.all` at line 20 (after `dailySpending`):
```ts
getLatestSnapshotDates(),
```

Destructure the result:
```ts
const [heroData, attentionItemsData, burnRateData, budgetSummary, accountsResult, dailySpending, latestSnapshotDates] =
```

- [ ] **Step 2: Compute `starterMode` and `daysSinceImport`**

After `const allAccounts = ...` (line 30), add:
```ts
const starterMode = allAccounts.length > 0 && recentTx.length === 0;

const daysSinceImport = (() => {
  const dates = Object.values(latestSnapshotDates);
  if (dates.length === 0) return 999;
  const latest = dates.reduce((a, b) => (a > b ? a : b));
  return differenceInDays(new Date(), new Date(latest));
})();
```

- [ ] **Step 3: Enrich `mobileRecentTx` mapping with account, category, tags**

Replace the `mobileRecentTx` mapping at line 33-39:
```ts
const mobileRecentTx = recentTx.map((tx) => ({
  id: tx.id,
  description: tx.merchant_name || tx.clean_description || "Sin descripcion",
  amount: tx.amount,
  currency_code: tx.currency_code ?? "COP",
  direction: tx.direction,
  account_name: tx.accounts?.name ?? "",
  account_color: tx.accounts?.color ?? null,
  category_name: tx.categories?.name_es ?? tx.categories?.name ?? null,
  category_icon: tx.categories?.icon ?? null,
  tags: (tx.transaction_tags ?? []).map((tt) => ({
    id: tt.tag.id,
    name: tt.tag.name,
    color: tt.tag.color,
    group_color: tt.tag.group?.color ?? null,
  })),
}));
```

- [ ] **Step 4: Pass new props to `InicioRoot`**

Add `starterMode` and `daysSinceImport` to the JSX:
```tsx
<InicioRoot
  starterMode={starterMode}
  daysSinceImport={daysSinceImport}
  hero={...}
  // ... rest unchanged
/>
```

- [ ] **Step 5: Verify build compiles**

Run: `cd webapp && pnpm build`

- [ ] **Step 6: Commit**

```
feat: wire MobileZone with starterMode, daysSinceImport, enriched tx
```

---

### Task 5: Update `InicioRoot` to render starter mode + import strip

**Files:**
- Modify: `webapp/src/components/mobile/v2/inicio/inicio-root.tsx:1-131`

- [ ] **Step 1: Add imports and new props**

Add imports:
```ts
import { InicioStarter } from "./inicio-starter";
import { InicioImportStrip } from "./inicio-import-strip";
```

Add to `InicioRootProps`:
```ts
starterMode: boolean;
daysSinceImport: number;
```

Destructure in the function signature.

- [ ] **Step 2: Render starter mode or normal flow**

Replace the `return` JSX:
```tsx
if (starterMode) {
  return (
    <div className="space-y-2">
      <InicioStarter />
    </div>
  );
}

return (
  <div className="space-y-2">
    <InicioHero ... />
    <InicioImportStrip daysSinceImport={daysSinceImport} />
    <InicioMetricsGrid ... />
    <InicioAttention ... />
    <InicioDiscovery ... />
    <InicioActivity transactions={recentTransactions} />
  </div>
);
```

- [ ] **Step 3: Verify build compiles**

Run: `cd webapp && pnpm build`

- [ ] **Step 4: Commit**

```
feat: InicioRoot renders starter mode + import strip
```

---

### Task 6: Rewrite `InicioActivity` with canonical row layout

**Files:**
- Modify: `webapp/src/components/mobile/v2/inicio/inicio-activity.tsx:1-91`

- [ ] **Step 1: Rewrite the component**

```tsx
"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { TagChip } from "@/components/tags/tag-chip";
import type { CurrencyCode } from "@/types/domain";

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
  tags: Array<{ id: string; name: string; color: string | null; group_color: string | null }>;
}

interface InicioActivityProps {
  transactions: RecentTransactionMobile[];
}

export function InicioActivity({ transactions }: InicioActivityProps) {
  if (transactions.length === 0) return null;

  const visible = transactions.slice(0, 3);

  return (
    <div>
      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-z-sage-dark">
        Reciente
      </p>

      <div>
        {visible.map((tx) => (
          <Link
            key={tx.id}
            href={`/transactions/${tx.id}`}
            className="flex items-center gap-2 border-b border-white/6 px-1 py-2 transition-colors last:border-b-0 active:bg-white/[0.03]"
          >
            {/* Direction icon */}
            <div
              className={cn(
                "flex size-[22px] shrink-0 items-center justify-center rounded-md",
                tx.direction === "INFLOW"
                  ? "bg-green-500/12 text-z-income"
                  : "bg-orange-500/12 text-z-expense"
              )}
            >
              {tx.direction === "INFLOW" ? (
                <ArrowDownLeft className="size-3" />
              ) : (
                <ArrowUpRight className="size-3" />
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium">{tx.description}</p>
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span
                  className="inline-block size-[5px] shrink-0 rounded-full"
                  style={{ backgroundColor: tx.account_color ?? undefined }}
                />
                <span className="truncate">{tx.account_name}</span>
                <span className="text-white/15">&middot;</span>
                {tx.category_name ? (
                  <span>
                    {tx.category_icon} {tx.category_name}
                  </span>
                ) : (
                  <span className="text-z-brass">Sin cat.</span>
                )}
              </p>
              {tx.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {tx.tags.map((t) => (
                    <TagChip
                      key={t.id}
                      tag={{ id: t.id, name: t.name, color: t.color } as any}
                      groupColor={t.group_color}
                      size="sm"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Amount */}
            <span
              className={cn(
                "shrink-0 text-[12px] font-medium tabular-nums",
                tx.direction === "INFLOW" && "text-z-income"
              )}
            >
              {tx.direction === "INFLOW" ? "+" : "-"}
              {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
            </span>
          </Link>
        ))}
      </div>

      <div className="pt-2 text-center">
        <Link
          href="/transactions"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-z-brass"
        >
          Ver todos
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `InicioRootProps` type for new transaction shape**

In `inicio-root.tsx`, update the `recentTransactions` prop type to match the new interface. Replace the inline type:

```ts
recentTransactions: Array<{
  id: string;
  description: string;
  amount: number;
  currency_code: string;
  direction: "INFLOW" | "OUTFLOW";
  account_name: string;
  account_color: string | null;
  category_name: string | null;
  category_icon: string | null;
  tags: Array<{ id: string; name: string; color: string | null; group_color: string | null }>;
}>;
```

- [ ] **Step 3: Verify build compiles**

Run: `cd webapp && pnpm build`

- [ ] **Step 4: Commit**

```
feat: rewrite InicioActivity with canonical row layout + tags
```

---

### Task 7: Enrich `MovimientosTransactionRow` with direction icon, category, tags

**Files:**
- Modify: `webapp/src/components/mobile/v2/movimientos/movimientos-transaction-row.tsx:1-145`

- [ ] **Step 1: Add imports**

```ts
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { TagChip } from "@/components/tags/tag-chip";
```

- [ ] **Step 2: Add `tags` prop**

Update the interface:
```ts
interface MovimientosTransactionRowProps {
  transaction: TransactionWithAccount;
  categories: CategoryWithChildren[];
  tags?: Array<{ id: string; name: string; color: string | null; group_color: string | null }>;
  onCategorized?: (txId: string, categoryId: string) => void;
}
```

Destructure in function: `tags = []` with default.

- [ ] **Step 3: Rewrite collapsed state JSX**

Replace the `<button>` collapsed row (lines 69-109) with:

```tsx
<button
  type="button"
  onClick={() => setExpanded((prev) => !prev)}
  className={cn(
    "flex w-full items-center gap-2 px-2 py-2.5 text-left transition-colors hover:bg-white/5",
    tx.is_excluded && "opacity-40"
  )}
>
  {/* Direction icon */}
  <div
    className={cn(
      "flex size-[22px] shrink-0 items-center justify-center rounded-md",
      tx.direction === "INFLOW"
        ? "bg-green-500/12 text-z-income"
        : "bg-orange-500/12 text-z-expense"
    )}
  >
    {tx.direction === "INFLOW" ? (
      <ArrowDownLeft className="size-3" />
    ) : (
      <ArrowUpRight className="size-3" />
    )}
  </div>

  {/* Info */}
  <div className="min-w-0 flex-1">
    <p className="truncate text-sm font-medium">{description}</p>
    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
      <span
        className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: tx.account.color ?? undefined }}
      />
      <span className="truncate">{tx.account.name}</span>
      <span className="text-white/15">&middot;</span>
      {categoryName ? (
        <span>{localCategory?.icon} {categoryName}</span>
      ) : (
        <span className="text-z-brass">Sin cat.</span>
      )}
    </p>
  </div>

  {/* Amount */}
  <span
    className={cn(
      "shrink-0 text-sm font-medium tabular-nums",
      tx.direction === "INFLOW" && "text-z-income",
      tx.is_excluded && "line-through"
    )}
  >
    {tx.direction === "INFLOW" ? "+" : "-"}
    {formatCurrency(tx.amount, tx.currency_code)}
  </span>
</button>

{/* Tags below collapsed row */}
{!expanded && tags.length > 0 && (
  <div className="flex flex-wrap gap-1 px-2 pb-1.5 pl-[38px]">
    {tags.map((t) => (
      <TagChip
        key={t.id}
        tag={{ id: t.id, name: t.name, color: t.color } as any}
        groupColor={t.group_color}
        size="sm"
      />
    ))}
  </div>
)}
```

- [ ] **Step 4: Verify build compiles**

Run: `cd webapp && pnpm build`

- [ ] **Step 5: Commit**

```
feat: enrich MovimientosTransactionRow with direction icon, category, tags
```

---

### Task 8: Pass tags data in `MovimientosRoot`

**Files:**
- Modify: `webapp/src/components/mobile/v2/movimientos/movimientos-root.tsx:134-148`

- [ ] **Step 1: Build a tags-by-transaction lookup**

The `TransactionWithAccount` type likely already has `transaction_tags` from the page query. If not, the page-level query in `webapp/src/app/(dashboard)/transactions/page.tsx` needs the join. Check what data is available. If `transaction_tags` is on the transaction, build the lookup:

```ts
// In MovimientosRoot, after groupedByDate memo:
const tagsByTxId = useMemo(() => {
  const map = new Map<string, Array<{ id: string; name: string; color: string | null; group_color: string | null }>>();
  for (const tx of transactions) {
    const txTags = (tx as any).transaction_tags;
    if (txTags && Array.isArray(txTags)) {
      map.set(
        tx.id,
        txTags.map((tt: any) => ({
          id: tt.tag.id,
          name: tt.tag.name,
          color: tt.tag.color,
          group_color: tt.tag.group?.color ?? null,
        }))
      );
    }
  }
  return map;
}, [transactions]);
```

- [ ] **Step 2: Pass tags to each row**

Update the row rendering at line 142:
```tsx
<MovimientosTransactionRow
  key={tx.id}
  transaction={tx}
  categories={outflowCategories}
  tags={tagsByTxId.get(tx.id)}
/>
```

- [ ] **Step 3: Ensure the transactions page query includes tags join**

Check `webapp/src/app/(dashboard)/transactions/page.tsx` — the mobile transactions view uses the same data. If the Supabase query doesn't include `transaction_tags`, add the join. If it already does, no change needed.

- [ ] **Step 4: Verify build compiles**

Run: `cd webapp && pnpm build`

- [ ] **Step 5: Commit**

```
feat: pass tag data from MovimientosRoot to transaction rows
```

---

### Task 9: Update Importar chip and detail in Movimientos

**Files:**
- Modify: `webapp/src/components/mobile/v2/movimientos/movimientos-herramientas.tsx:124-144` (chip), `431-647` (ImportarDetail)

- [ ] **Step 1: Make Importar chip always sage-accented**

Replace the chip at lines 124-144. Change the conditional styling to always use sage:
```tsx
<button
  type="button"
  onClick={() => toggle("importar")}
  className={cn(
    "rounded-[14px] border p-2.5 text-center transition-colors",
    isActive("importar")
      ? cn("border", accentStyles.importar.chip)
      : cn(
          "border-z-sage/30",
          "bg-[linear-gradient(180deg,rgba(var(--z-sage-rgb,142,168,130),0.08),transparent)]"
        )
  )}
  aria-expanded={isActive("importar")}
>
  <p className="text-[22px] font-[680] leading-tight text-z-sage">
    {pendingEmailCount}
  </p>
  <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
    Importar
  </p>
  <p className="mt-1 text-[9px] text-z-sage">
    {pendingEmailCount > 0 ? `${pendingEmailCount} emails` : "Subir PDF"}
  </p>
</button>
```

- [ ] **Step 2: Add PDF upload CTA at top of `ImportarDetail`**

In the `ImportarDetail` function, add a PDF upload row before the email list. Replace the empty state check (lines 507-517) and the list start (line 520):

After the eyebrow `<p>` tag at line 522, add:
```tsx
{/* PDF upload CTA — always visible */}
<Link
  href="/import"
  className="flex items-center gap-2.5 rounded-lg border border-z-sage/20 bg-z-sage/[0.04] px-2.5 py-2 transition-colors hover:bg-z-sage/[0.08]"
>
  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-z-sage/10 border border-z-sage/20">
    <FileUp className="size-3.5 text-z-sage" />
  </div>
  <div className="min-w-0 flex-1">
    <p className="text-[11px] font-semibold">Subir PDF del banco</p>
    <p className="text-[9px] text-muted-foreground">Extracto mensual de cualquier banco</p>
  </div>
  <span className={cn(BRASS_BUTTON_CLASS, "shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-semibold")}>
    Subir
  </span>
</Link>

{totalCount > 0 && (
  <div className="my-2 h-px bg-white/6" />
)}
```

Add imports at top of file: `import { FileUp } from "lucide-react"` and `import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles"`.

Also update the empty state (lines 507-517) to still show the PDF CTA:
```tsx
if (totalCount === 0) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-sage">
        Importar extracto
      </p>
      <Link
        href="/import"
        className="flex items-center gap-2.5 rounded-lg border border-z-sage/20 bg-z-sage/[0.04] px-2.5 py-2 transition-colors hover:bg-z-sage/[0.08]"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-z-sage/10 border border-z-sage/20">
          <FileUp className="size-3.5 text-z-sage" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold">Subir PDF del banco</p>
          <p className="text-[9px] text-muted-foreground">Extracto mensual de cualquier banco</p>
        </div>
        <span className={cn(BRASS_BUTTON_CLASS, "shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-semibold")}>
          Subir
        </span>
      </Link>
      <p className="text-[10px] text-muted-foreground">
        0 emails pendientes de revision
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verify build compiles**

Run: `cd webapp && pnpm build`

- [ ] **Step 4: Commit**

```
feat: Importar chip always sage, ImportarDetail includes PDF upload CTA
```

---

### Task 10: Build gate + final agent reviews

- [ ] **Step 1: Run full build**

Run: `cd webapp && pnpm install && pnpm build`

Expected: Clean build, no errors.

- [ ] **Step 2: Spawn `perf-auditor` agent (background)**

```
Agent(subagent_type="perf-auditor", prompt="Audit the mobile UX changes for performance.
Focus on:
1. The tags join added to getRecentTransactions in webapp/src/actions/transactions.ts — is the Supabase join (transaction_tags → tags → tag_groups) efficient? Any N+1 risk?
2. MobileZone now calls getLatestSnapshotDates() — is it cached properly with cacheTag/cacheLife?
3. New components (inicio-starter.tsx, inicio-import-strip.tsx) — any unnecessary client-side weight?
4. MovimientosTransactionRow now imports TagChip — does this affect the transactions page bundle?
Report issues ranked by severity.")
```

- [ ] **Step 3: Spawn `zetas-front-guy` agent (background, parallel with step 2)**

```
Agent(subagent_type="zetas-front-guy", prompt="Review all mobile UX changes for design system compliance.
Files changed/created:
- webapp/src/components/mobile/v2/inicio/inicio-starter.tsx (new)
- webapp/src/components/mobile/v2/inicio/inicio-import-strip.tsx (new)
- webapp/src/components/mobile/v2/inicio/inicio-activity.tsx (rewritten)
- webapp/src/components/mobile/v2/movimientos/movimientos-transaction-row.tsx (enriched)
- webapp/src/components/mobile/v2/movimientos/movimientos-herramientas.tsx (importar chip + detail)
Check: hardcoded colors, wrong tokens, missing component reuse, button variant violations,
border-radius violations, typography mismatches vs TOKENS.md.")
```

- [ ] **Step 4: Fix any issues flagged by agents**

- [ ] **Step 5: Final commit if review fixes were needed**

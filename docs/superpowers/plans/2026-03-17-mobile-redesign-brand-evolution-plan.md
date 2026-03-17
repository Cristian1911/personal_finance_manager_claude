# Mobile-First Redesign + Brand Evolution Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Zeta's mobile experience from a responsive desktop app into a mobile-first fintech product with evolved brand identity and personalized onboarding.

**Architecture:** Five independent phases (0-4), each shippable alone. Phase 0 updates CSS tokens and brand. Phase 1 adds motion, a11y, and token consistency. Phase 2 adds DB-backed dashboard config, widget system, and dynamic tab bar. Phase 3 builds composite mobile views. Phase 4 redesigns onboarding to configure the personalized experience.

**Tech Stack:** Next.js 15 (App Router), Tailwind v4, shadcn/ui, Framer Motion, Supabase (Postgres + RLS), Zod

**Spec:** `docs/superpowers/specs/2026-03-17-mobile-redesign-brand-evolution-design.md`

---

## Chunk 1: Phase 0 — Brand Evolution "Sage Evolved"

### Task 1: Update core color tokens in globals.css

**Files:**
- Modify: `webapp/src/app/globals.css`

- [ ] **Step 1: Update the `:root` Zeta core tokens (lines 64-81)**

Replace the existing token values with the new "Sage Evolved" palette:

```css
:root {
  /* Zeta core tokens */
  --z-ink:        #0A0E14;
  --z-sage:       #C5BFAE;
  --z-sage-light: #D8D2C4;
  --z-sage-dark:  #9E9888;
  --z-white:      #F0EDE6;

  /* Financial semantics */
  --z-income:  #5CB88A;
  --z-expense: #E8875A;
  --z-debt:    #E05545;
  --z-alert:   #D4A843;

  /* Surfaces */
  --z-surface:   #131720;
  --z-surface-2: #1C1F28;
  --z-surface-3: #262A34;
  --z-border:    rgba(192, 185, 170, 0.08);
  --z-border-strong: rgba(192, 185, 170, 0.14);
```

- [ ] **Step 2: Add `--z-surface-3` and `--z-border-strong` to the `@theme inline` block (lines 49-61)**

Add these two lines inside the `@theme inline` block:

```css
  --color-z-surface-3: var(--z-surface-3);
  --color-z-border-strong: var(--z-border-strong);
```

- [ ] **Step 3: Update shadcn variable mappings (lines 83-102)**

Key changes in the shadcn mapping section:

```css
  --primary: var(--z-white);
  --primary-foreground: var(--z-ink);
  --border: var(--z-border-strong);
  --input: var(--z-border-strong);
  --ring: var(--z-white);
  --popover: var(--z-surface-3);
  --popover-foreground: var(--z-white);
```

- [ ] **Step 4: Mirror all changes in the `.dark` block (lines 123-155)**

The `.dark` block must have identical values since Zeta is dark-mode-first. Update all changed values to match.

- [ ] **Step 5: Add typography and spacing CSS custom properties**

Append after the surfaces section in `:root`:

```css
  /* Typography scale */
  --z-type-display-size: 52px;
  --z-type-display-weight: 800;
  --z-type-display-tracking: -0.04em;
  --z-type-display-leading: 1.0;

  --z-type-hero-size: clamp(56px, 8vw, 96px);
  --z-type-hero-weight: 900;
  --z-type-hero-tracking: -0.04em;
  --z-type-hero-leading: 0.95;

  --z-type-h1-size: 28px;
  --z-type-h1-weight: 700;
  --z-type-h1-tracking: -0.02em;
  --z-type-h1-leading: 1.2;

  --z-type-body-size: 15px;
  --z-type-body-weight: 400;
  --z-type-body-tracking: 0;
  --z-type-body-leading: 1.7;

  --z-type-widget-lg-size: 22px;
  --z-type-widget-lg-weight: 800;

  --z-type-widget-sm-size: 18px;
  --z-type-widget-sm-weight: 800;

  --z-type-label-size: 11px;
  --z-type-label-weight: 400;
  --z-type-label-leading: 1.4;

  --z-type-caption-size: 10px;
  --z-type-caption-weight: 500;
  --z-type-caption-tracking: 0.08em;
  --z-type-caption-leading: 1.4;

  --z-type-trend-size: 11px;
  --z-type-trend-weight: 400;
  --z-type-trend-leading: 1.0;

  /* Spacing scale */
  --z-space-xs: 6px;
  --z-space-sm: 8px;
  --z-space-md: 16px;
  --z-space-lg: 20px;
  --z-space-xl: 28px;
  --z-space-2xl: 40px;
  --z-space-3xl: 64px;
```

- [ ] **Step 6: Add status surface utility classes**

Append to the `@layer base` block:

```css
@layer base {
  .surface-income  { color: var(--z-income);  border-color: color-mix(in srgb, var(--z-income) 20%, transparent);  background: color-mix(in srgb, var(--z-income) 8%, transparent); }
  .surface-expense { color: var(--z-expense); border-color: color-mix(in srgb, var(--z-expense) 20%, transparent); background: color-mix(in srgb, var(--z-expense) 8%, transparent); }
  .surface-debt    { color: var(--z-debt);    border-color: color-mix(in srgb, var(--z-debt) 20%, transparent);    background: color-mix(in srgb, var(--z-debt) 8%, transparent); }
  .surface-alert   { color: var(--z-alert);   border-color: color-mix(in srgb, var(--z-alert) 20%, transparent);   background: color-mix(in srgb, var(--z-alert) 8%, transparent); }
  .surface-neutral { color: var(--z-sage-dark); border-color: color-mix(in srgb, var(--z-sage-dark) 20%, transparent); background: color-mix(in srgb, var(--z-sage-dark) 8%, transparent); }
}
```

- [ ] **Step 7: Build to verify no regressions**

Run: `cd webapp && pnpm build`

Expected: Clean build. All existing `z-*` classes automatically pick up new values.

- [ ] **Step 8: Commit**

```bash
git add webapp/src/app/globals.css
git commit -m "feat: brand evolution — Sage Evolved color tokens, typography/spacing vars, status surfaces"
```

---

### Task 2: Update brand handoff document

**Files:**
- Modify: `brand/zeta-dev-handoff.html`

- [ ] **Step 1: Update all hex values in the handoff HTML**

Update the token table hex values, swatch colors, and CSS code blocks to reflect the new palette. Key changes:
- `--z-ink`: `#1C1C1C` → `#0A0E14`
- `--z-surface`: `#242424` → `#131720`
- `--z-surface-2`: `#2E2E2E` → `#1C1F28`
- Add `--z-surface-3`: `#262A34`
- `--z-white`: `#F5F3EF` → `#F0EDE6`
- `--z-income`: `#52B788` → `#5CB88A`
- `--z-expense`: `#F4A261` → `#E8875A`
- `--z-debt`: `#C44536` → `#E05545`
- `--z-alert`: `#E9C46A` → `#D4A843`
- `--z-border`: `#333333` → `rgba(192, 185, 170, 0.08)` + add `--z-border-strong`
- Update WCAG contrast ratios in the contrast table

- [ ] **Step 2: Commit**

```bash
git add brand/zeta-dev-handoff.html
git commit -m "docs: update brand handoff to Sage Evolved palette"
```

---

### Task 3: Migrate hardcoded colors to brand tokens

**Files:**
- Modify: `webapp/src/components/mobile/fab-menu.tsx`
- Modify: `webapp/src/components/mobile/mobile-movimientos.tsx`
- Modify: `webapp/src/components/mobile/mobile-dashboard.tsx`

- [ ] **Step 1: Fix FAB menu action colors (fab-menu.tsx lines 24-26)**

Replace hardcoded colors in SUB_ACTIONS:

```typescript
// Old:
{ id: "expense", label: "Gasto rápido", icon: ArrowUpRight, bg: "bg-orange-500" },
{ id: "income", label: "Ingreso", icon: ArrowDownLeft, bg: "bg-green-500" },
{ id: "transfer", label: "Transferencia", icon: ArrowLeftRight, bg: "bg-blue-500" },

// New:
{ id: "expense", label: "Gasto rápido", icon: ArrowUpRight, bg: "bg-z-expense" },
{ id: "income", label: "Ingreso", icon: ArrowDownLeft, bg: "bg-z-income" },
{ id: "transfer", label: "Transferencia", icon: ArrowLeftRight, bg: "bg-z-sage-dark" },
```

- [ ] **Step 2: Fix FAB button itself (fab-menu.tsx ~line 120)**

The FAB currently uses `bg-primary`. With `--primary` now `--z-white`, change to:

```tsx
// Old:
className="... bg-primary text-primary-foreground ..."

// New:
className="... bg-z-white text-z-ink ..."
```

- [ ] **Step 3: Fix mobile-movimientos.tsx hardcoded colors**

Replace at the identified lines:
- Line 133: `text-orange-500` → `text-z-expense`
- Line 139: `text-green-500` → `text-z-income`
- Lines 195-196: Replace the ternary with brand tokens:

```tsx
// Old:
? "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400"
: "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400"

// New:
? "bg-z-income/10 text-z-income"
: "bg-z-expense/10 text-z-expense"
```

- Line 212: `text-green-600` → `text-z-income`

- [ ] **Step 4: Fix mobile-dashboard.tsx hardcoded colors**

Line 179: `text-orange-500` → `text-z-expense`

- [ ] **Step 5: Build to verify**

Run: `cd webapp && pnpm build`

Expected: Clean build

- [ ] **Step 6: Commit**

```bash
git add webapp/src/components/mobile/fab-menu.tsx webapp/src/components/mobile/mobile-movimientos.tsx webapp/src/components/mobile/mobile-dashboard.tsx
git commit -m "refactor: migrate hardcoded colors to brand tokens in mobile components"
```

---

### Task 4: Fix Spanish typos

**Files:**
- Modify: `webapp/src/components/mobile/mobile-sheet-provider.tsx`

- [ ] **Step 1: Fix typos**

- Line 32: `"Gasto rapido"` → `"Gasto rápido"`
- Line 82: `"En esta pagina"` → `"En esta página"`

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/mobile-sheet-provider.tsx
git commit -m "fix: correct Spanish accents in mobile sheet provider"
```

---

## Chunk 2: Phase 1 — Foundation (Motion, Accessibility)

### Task 5: Add Framer Motion staggered list animation wrapper

**Files:**
- Create: `webapp/src/components/mobile/motion.tsx`

- [ ] **Step 1: Create the shared motion primitives**

```tsx
"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const listItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

export function StaggerList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={listContainer} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={listItem} className={className}>
      {children}
    </motion.div>
  );
}

export function FadeIn({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/motion.tsx
git commit -m "feat: add shared Framer Motion primitives for mobile lists"
```

---

### Task 6: Apply staggered animations to mobile dashboard

**Files:**
- Modify: `webapp/src/components/mobile/mobile-dashboard.tsx`

- [ ] **Step 1: Wrap upcoming payments list with StaggerList/StaggerItem**

Import `{ StaggerList, StaggerItem, FadeIn }` from `./motion`. Wrap the hero card with `<FadeIn>`, the upcoming payments `.map()` with `<StaggerList>/<StaggerItem>`, and the recent transactions `.map()` similarly.

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/mobile-dashboard.tsx
git commit -m "feat: add staggered reveal animations to mobile dashboard"
```

---

### Task 7: Apply staggered animations to mobile movimientos

**Files:**
- Modify: `webapp/src/components/mobile/mobile-movimientos.tsx`

- [ ] **Step 1: Wrap transaction groups and items with StaggerList/StaggerItem**

Import motion primitives. Wrap the date-grouped transaction feed with staggered animations.

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/mobile-movimientos.tsx
git commit -m "feat: add staggered reveal animations to mobile movimientos"
```

---

### Task 8: Apply staggered animations to mobile presupuesto

**Files:**
- Modify: `webapp/src/components/mobile/mobile-presupuesto.tsx`

- [ ] **Step 1: Wrap budget rows and inbox items with StaggerList/StaggerItem**

Import motion primitives. Wrap budget progress rows and categorization inbox items.

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/mobile-presupuesto.tsx
git commit -m "feat: add staggered reveal animations to mobile presupuesto"
```

---

### Task 9: Accessibility fixes

**Files:**
- Modify: `webapp/src/components/mobile/mobile-presupuesto.tsx`
- Modify: `webapp/src/components/mobile/mobile-movimientos.tsx`

- [ ] **Step 1: Add ARIA labels to collapsible sections in mobile-presupuesto**

Add `aria-label` and `aria-expanded` attributes to the categorization inbox header and any collapsible section triggers.

- [ ] **Step 2: Add icon + color for budget warnings in mobile-presupuesto**

At the budget threshold color logic (~line 300), add a warning icon alongside the red/orange bars:
- `percent > 90`: show `AlertTriangle` icon + `bg-z-debt`
- `percent >= 70`: show `AlertCircle` icon + `bg-z-expense`

- [ ] **Step 3: Add fade gradient indicators to category chips scroll in mobile-movimientos**

Add CSS pseudo-elements or overlay divs at left/right edges of the horizontal chip scroll to indicate more content:

```tsx
<div className="relative">
  <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-card to-transparent z-10" />
  <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-card to-transparent z-10" />
  {/* existing chip scroll container */}
</div>
```

- [ ] **Step 4: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/mobile/mobile-presupuesto.tsx webapp/src/components/mobile/mobile-movimientos.tsx
git commit -m "fix: accessibility — ARIA labels, budget warning icons, scroll indicators"
```

---

### Task 10: Phase 0+1 verification gate

- [ ] **Step 1: Full build**

Run: `cd webapp && pnpm build`

Expected: Clean build, no errors

- [ ] **Step 2: Visual check**

Run: `cd webapp && pnpm dev`

Verify in browser at mobile viewport (375px):
- Colors have shifted to deeper darks with cool undertone
- Semantic colors are distinct (expense ≠ alert at small sizes)
- FAB button is white on dark, not sage
- Card borders are visible but subtle
- Lists animate in on page load
- Budget warnings show icons alongside color bars

---

## Chunk 3: Phase 2 — Navigation + Widget System

### Task 11: Database migration — dashboard_config

**Files:**
- Create: `supabase/migrations/XXXXXXXX_add_dashboard_config.sql` (use `npx supabase migration new add_dashboard_config`)

- [ ] **Step 1: Create the migration**

Run: `cd webapp && npx supabase migration new add_dashboard_config`

Write the migration SQL:

```sql
ALTER TABLE profiles ADD COLUMN dashboard_config jsonb DEFAULT NULL;

COMMENT ON COLUMN profiles.dashboard_config IS 'Purpose-driven dashboard configuration: tabs, widgets, purpose. Set during onboarding.';
```

- [ ] **Step 2: Push the migration**

Run: `npx supabase db push`

- [ ] **Step 3: Regenerate TypeScript types**

Run: `npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > src/types/database.ts`

Verify: `grep dashboard_config src/types/database.ts` should show the new column.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/ webapp/src/types/database.ts
git commit -m "feat: add dashboard_config JSONB column to profiles"
```

---

### Task 12: Dashboard config types and defaults

**Files:**
- Create: `webapp/src/types/dashboard-config.ts`
- Create: `webapp/src/lib/dashboard-config-defaults.ts`

- [ ] **Step 1: Create the type definitions**

`webapp/src/types/dashboard-config.ts`:

```typescript
export type AppPurpose = "manage_debt" | "track_spending" | "save_money" | "improve_habits";

export interface TabConfig {
  id: string;
  label: string;
  icon: string;
  features: string[];
  position: 2 | 3;
}

export interface WidgetConfig {
  id: string;
  visible: boolean;
  order: number;
}

export interface DashboardConfig {
  purpose: AppPurpose;
  tabs: TabConfig[];
  widgets: WidgetConfig[];
}
```

- [ ] **Step 2: Create the default configs per purpose**

`webapp/src/lib/dashboard-config-defaults.ts`:

```typescript
import type { AppPurpose, DashboardConfig } from "@/types/dashboard-config";

const DEFAULTS: Record<AppPurpose, DashboardConfig> = {
  manage_debt: {
    purpose: "manage_debt",
    tabs: [
      { id: "debt-recurring", label: "Deudas", icon: "CreditCard", features: ["debt", "recurring"], position: 2 },
      { id: "presupuesto", label: "Presupuesto", icon: "PiggyBank", features: ["budget"], position: 3 },
    ],
    widgets: [
      { id: "debt-progress", visible: true, order: 0 },
      { id: "upcoming-payments", visible: true, order: 1 },
      { id: "budget-pulse", visible: true, order: 2 },
      { id: "nudge-cards", visible: true, order: 3 },
      { id: "recent-tx", visible: true, order: 4 },
      { id: "spending-trend", visible: false, order: 5 },
      { id: "category-donut", visible: false, order: 6 },
      { id: "habit-score", visible: false, order: 7 },
    ],
  },
  track_spending: {
    purpose: "track_spending",
    tabs: [
      { id: "movimientos", label: "Movimientos", icon: "ArrowLeftRight", features: ["transactions"], position: 2 },
      { id: "presupuesto", label: "Presupuesto", icon: "PiggyBank", features: ["budget"], position: 3 },
    ],
    widgets: [
      { id: "spending-trend", visible: true, order: 0 },
      { id: "category-donut", visible: true, order: 1 },
      { id: "recent-tx", visible: true, order: 2 },
      { id: "budget-pulse", visible: true, order: 3 },
      { id: "nudge-cards", visible: true, order: 4 },
      { id: "upcoming-payments", visible: false, order: 5 },
      { id: "debt-progress", visible: false, order: 6 },
      { id: "habit-score", visible: false, order: 7 },
    ],
  },
  save_money: {
    purpose: "save_money",
    tabs: [
      { id: "presupuesto-ahorro", label: "Presupuesto", icon: "PiggyBank", features: ["budget", "savings"], position: 2 },
      { id: "movimientos", label: "Movimientos", icon: "ArrowLeftRight", features: ["transactions"], position: 3 },
    ],
    widgets: [
      { id: "budget-pulse", visible: true, order: 0 },
      { id: "spending-trend", visible: true, order: 1 },
      { id: "nudge-cards", visible: true, order: 2 },
      { id: "recent-tx", visible: true, order: 3 },
      { id: "upcoming-payments", visible: false, order: 4 },
      { id: "category-donut", visible: false, order: 5 },
      { id: "debt-progress", visible: false, order: 6 },
      { id: "habit-score", visible: false, order: 7 },
    ],
  },
  improve_habits: {
    purpose: "improve_habits",
    tabs: [
      { id: "movimientos-presupuesto", label: "Gastos", icon: "TrendingDown", features: ["transactions", "budget"], position: 2 },
      { id: "recurrentes", label: "Recurrentes", icon: "Repeat2", features: ["recurring"], position: 3 },
    ],
    widgets: [
      { id: "habit-score", visible: true, order: 0 },
      { id: "spending-trend", visible: true, order: 1 },
      { id: "budget-pulse", visible: true, order: 2 },
      { id: "nudge-cards", visible: true, order: 3 },
      { id: "recent-tx", visible: true, order: 4 },
      { id: "upcoming-payments", visible: false, order: 5 },
      { id: "category-donut", visible: false, order: 6 },
      { id: "debt-progress", visible: false, order: 7 },
    ],
  },
};

export function getDefaultConfig(purpose: AppPurpose): DashboardConfig {
  return structuredClone(DEFAULTS[purpose]);
}

export function getDefaultConfigForProfile(appPurpose: string | null): DashboardConfig {
  const purpose = (appPurpose as AppPurpose) || "track_spending";
  return getDefaultConfig(purpose);
}
```

- [ ] **Step 3: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 4: Commit**

```bash
git add webapp/src/types/dashboard-config.ts webapp/src/lib/dashboard-config-defaults.ts
git commit -m "feat: dashboard config types and purpose-driven defaults"
```

---

### Task 13: Server action — updateDashboardConfig

**Files:**
- Create: `webapp/src/actions/dashboard-config.ts`
- Create: `webapp/src/lib/validators/dashboard-config.ts`

- [ ] **Step 1: Create Zod validator**

`webapp/src/lib/validators/dashboard-config.ts`:

```typescript
import { z } from "zod";

const tabConfigSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string(),
  features: z.array(z.string()),
  position: z.union([z.literal(2), z.literal(3)]),
});

const widgetConfigSchema = z.object({
  id: z.string(),
  visible: z.boolean(),
  order: z.number().int().min(0),
});

export const dashboardConfigSchema = z.object({
  purpose: z.enum(["manage_debt", "track_spending", "save_money", "improve_habits"]),
  tabs: z.array(tabConfigSchema).min(1).max(3),
  widgets: z.array(widgetConfigSchema).min(1).max(20),
});
```

- [ ] **Step 2: Create server action**

`webapp/src/actions/dashboard-config.ts`:

```typescript
"use server";

import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { dashboardConfigSchema } from "@/lib/validators/dashboard-config";
import type { DashboardConfig } from "@/types/dashboard-config";
import type { ActionResult } from "@/types/actions";

export async function updateDashboardConfig(
  config: DashboardConfig
): Promise<ActionResult<DashboardConfig>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = dashboardConfigSchema.safeParse(config);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ dashboard_config: parsed.data as unknown as Record<string, unknown> })
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  return { success: true, data: parsed.data };
}

export async function getDashboardConfig(): Promise<DashboardConfig | null> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("dashboard_config, app_purpose")
    .eq("user_id", user.id)
    .single();

  if (!data?.dashboard_config) return null;
  return data.dashboard_config as unknown as DashboardConfig;
}
```

- [ ] **Step 3: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 4: Commit**

```bash
git add webapp/src/actions/dashboard-config.ts webapp/src/lib/validators/dashboard-config.ts
git commit -m "feat: dashboard config server action + Zod validator"
```

---

### Task 14: useDashboardConfig client hook

**Files:**
- Create: `webapp/src/hooks/use-dashboard-config.ts`

- [ ] **Step 1: Create the hook**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import type { DashboardConfig } from "@/types/dashboard-config";
import { getDefaultConfigForProfile } from "@/lib/dashboard-config-defaults";
import { updateDashboardConfig } from "@/actions/dashboard-config";

const STORAGE_KEY = "zeta:dashboard_config";

function readCache(): DashboardConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(config: DashboardConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function useDashboardConfig(
  serverConfig: DashboardConfig | null,
  appPurpose: string | null,
) {
  const [config, setConfigState] = useState<DashboardConfig>(() => {
    const cached = readCache();
    if (cached) return cached;
    if (serverConfig) return serverConfig;
    return getDefaultConfigForProfile(appPurpose);
  });

  // Sync server config to cache on mount
  useEffect(() => {
    if (serverConfig) {
      writeCache(serverConfig);
      setConfigState(serverConfig);
    }
  }, [serverConfig]);

  const setConfig = useCallback((newConfig: DashboardConfig) => {
    setConfigState(newConfig);
    writeCache(newConfig);
    // Fire-and-forget DB sync
    updateDashboardConfig(newConfig).catch(() => {
      // Silent fail — localStorage is the optimistic source
    });
  }, []);

  return { config, setConfig };
}
```

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/hooks/use-dashboard-config.ts
git commit -m "feat: useDashboardConfig client hook with localStorage cache"
```

---

### Task 15: Dynamic tab bar

**Files:**
- Modify: `webapp/src/components/mobile/bottom-tab-bar.tsx`

- [ ] **Step 1: Refactor tab bar to accept dynamic config**

Replace the hardcoded `TABS` array (lines 26-31) with a component that accepts config as a prop. The dashboard layout passes the config down.

Key changes:
- Accept `tabConfig: TabConfig[]` prop (from dashboard config)
- Build dynamic tab array: `[fixedStartTab, ...configTabs, fixedEndTab]`
- Map `TabConfig.icon` string to Lucide component via a lookup map
- Keep the left/right split with FAB gap: `[tab1, tab2]` left, `[tab3, tab4]` right
- Keep uncategorized badge on whichever tab has `features: ["budget"]`
- Route for tab 4 "Más": `/gestionar` (reuse existing route, rename content later)

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/bottom-tab-bar.tsx
git commit -m "feat: dynamic tab bar driven by dashboard config"
```

---

### Task 16: Gestionar → Profile/More page

**Files:**
- Modify: `webapp/src/app/(dashboard)/gestionar/page.tsx`

- [ ] **Step 1: Redesign the gestionar page as Profile/More**

Replace the current 4-card grid with:
- Profile header (name, purpose badge)
- Quick links grid (2-col): Importar, Cuentas, Destinatarios, Categorías
- Settings section: links to settings sub-pages
- Keep `MobilePageHeader` with title "Más"

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/\(dashboard\)/gestionar/page.tsx
git commit -m "feat: redesign Gestionar page as Profile/More hub"
```

---

### Task 17: Wire config into dashboard layout

**Files:**
- Modify: `webapp/src/app/(dashboard)/layout.tsx`
- Modify: `webapp/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Fetch dashboard_config in the layout and pass to BottomTabBar**

Add `getDashboardConfig()` to the layout's data fetch. Pass the config to `BottomTabBar` and `MobileSheetProvider`.

- [ ] **Step 2: Pass config to the dashboard page for widget rendering**

The dashboard page receives config and uses it to determine which widgets to render and in what order.

- [ ] **Step 3: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 4: Commit**

```bash
git add webapp/src/app/\(dashboard\)/layout.tsx webapp/src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: wire dashboard config into layout and tab bar"
```

---

## Chunk 4: Phase 3 — Composite Tab Views

### Task 18: MobileDebtRecurrentes composite view

**Files:**
- Create: `webapp/src/components/mobile/mobile-debt-recurrentes.tsx`

- [ ] **Step 1: Create the composite component**

Combines debt summary hero + upcoming payment timeline (filtered to debt-related) + per-account debt cards. Reuse existing components where possible (debt cards from deudas page, payment timeline from recurring).

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/mobile-debt-recurrentes.tsx
git commit -m "feat: MobileDebtRecurrentes composite view for manage_debt users"
```

---

### Task 19: MobileMovimientosPresupuesto composite view

**Files:**
- Create: `webapp/src/components/mobile/mobile-movimientos-presupuesto.tsx`

- [ ] **Step 1: Create the composite component**

Combines spending summary + compact budget progress bars + date-grouped transaction feed. Reuse `MobileMovimientos` transaction rendering and `MobilePresupuesto` budget bar rendering.

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/mobile-movimientos-presupuesto.tsx
git commit -m "feat: MobileMovimientosPresupuesto composite view for improve_habits users"
```

---

### Task 20: MobilePresupuestoAhorro composite view

**Files:**
- Create: `webapp/src/components/mobile/mobile-presupuesto-ahorro.tsx`

- [ ] **Step 1: Create the composite component**

Available to save hero + budget bars (fixed/variable split) + unbudgeted alerts + savings streak counter.

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/mobile-presupuesto-ahorro.tsx
git commit -m "feat: MobilePresupuestoAhorro composite view for save_money users"
```

---

### Task 21: Tab view router — map features to composite components

**Files:**
- Create: `webapp/src/components/mobile/tab-view-router.tsx`

- [ ] **Step 1: Create the feature → component mapper**

Given a `TabConfig.features` array, render the correct composite component:

```typescript
const FEATURE_MAP: Record<string, React.ComponentType<any>> = {
  "debt+recurring": MobileDebtRecurrentes,
  "transactions": MobileMovimientos,
  "budget": MobilePresupuesto,
  "transactions+budget": MobileMovimientosPresupuesto,
  "budget+savings": MobilePresupuestoAhorro,
  "recurring": RecurringTimelineView,
};
```

Route pages for tabs 2-3 render `<TabViewRouter features={tab.features} />` which looks up and renders the correct composite component.

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/mobile/tab-view-router.tsx
git commit -m "feat: tab view router — maps feature sets to composite components"
```

---

### Task 22: Remaining mobile views (MobileSettings, MobileAccountDetail)

**Files:**
- Create: `webapp/src/components/mobile/mobile-settings.tsx`
- Modify: `webapp/src/app/(dashboard)/accounts/[id]/page.tsx`
- Modify: `webapp/src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Create MobileSettings component**

Grouped sections with clear headers: Profile, App (personalizar inicio, categorías, destinatarios), About.

- [ ] **Step 2: Wire MobileSettings into settings page with lg:hidden split**

- [ ] **Step 3: Add mobile-optimized account detail view**

Simplify charts for mobile viewport, ensure stacked cards layout.

- [ ] **Step 4: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/mobile/mobile-settings.tsx webapp/src/app/\(dashboard\)/settings/page.tsx webapp/src/app/\(dashboard\)/accounts/\[id\]/page.tsx
git commit -m "feat: mobile settings and account detail views"
```

---

## Chunk 5: Phase 4 — Onboarding Redesign

### Task 23: Reorder existing onboarding steps + update totalSteps

**Files:**
- Modify: `webapp/src/app/onboarding/page.tsx`

- [ ] **Step 1: Reorder steps 2 and 3**

Current order: (1) Objetivo, (2) Finanzas, (3) Perfil, (4) Primera cuenta
New order: (1) Objetivo, (2) Perfil, (3) Finanzas, (4-6) new steps

Swap the step 2 and step 3 content in the step renderer. Update `totalSteps` from 4 to 6.

- [ ] **Step 2: Update analytics events**

Any `trackProductEvent("onboarding_step_completed", { step: N })` calls must reflect the new step numbers.

- [ ] **Step 3: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 4: Commit**

```bash
git add webapp/src/app/onboarding/page.tsx
git commit -m "refactor: reorder onboarding steps, update totalSteps to 6"
```

---

### Task 24: Enhanced Finanzas step (manage_debt extras)

**Files:**
- Modify: `webapp/src/app/onboarding/page.tsx`

- [ ] **Step 1: Add conditional debt count question**

In step 3 (Finanzas), when `purpose === "manage_debt"`, add a numeric input: "¿Cuántas tarjetas de crédito o préstamos tienes?" with a contextual message: "Perfecto, Zeta te ayudará a organizar tus {N} deudas". This value is NOT stored — it's UX expectation-setting only.

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/onboarding/page.tsx
git commit -m "feat: enhanced Finanzas step with debt count for manage_debt users"
```

---

### Task 25: New step 4 — "Tu app" (tab preview)

**Files:**
- Modify: `webapp/src/app/onboarding/page.tsx`

- [ ] **Step 1: Create the tab preview step**

Shows a phone mockup with the user's personalized tab bar. Renders:
- "Basado en tu objetivo, así se ve tu Zeta:"
- A phone frame mockup showing the 4 tabs with labels
- Each tab shows its icon + label + brief description of what's in it
- Tabs 2-3 are tappable — tapping opens a picker to swap from available tab options
- Uses `getDefaultConfig(purpose)` to generate initial config
- Stores the selected config in component state (written to DB in `finishOnboarding`)

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/onboarding/page.tsx
git commit -m "feat: onboarding step 4 — personalized tab preview with swap"
```

---

### Task 26: New step 6 — Quick win

**Files:**
- Modify: `webapp/src/app/onboarding/page.tsx`

- [ ] **Step 1: Create the quick win step**

Purpose-specific CTA cards:
- manage_debt → "Importa tu primer extracto" (link to /import)
- track_spending → "Registra tu primer gasto" (opens quick capture via FAB)
- save_money → "Configura tu primer presupuesto" (link to /categories)
- improve_habits → "Registra tu primer gasto" (opens quick capture via FAB)
- All: "Explorar primero" secondary button that skips to dashboard

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/onboarding/page.tsx
git commit -m "feat: onboarding step 6 — purpose-specific quick win CTA"
```

---

### Task 27: Update finishOnboarding to persist dashboard_config

**Files:**
- Modify: `webapp/src/actions/onboarding.ts`

- [ ] **Step 1: Accept and persist dashboard_config**

Update `finishOnboarding()` to accept the `DashboardConfig` from step 4 and write it to `profiles.dashboard_config` alongside the existing profile update.

- [ ] **Step 2: Build to verify**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/onboarding.ts
git commit -m "feat: persist dashboard_config during onboarding completion"
```

---

### Task 28: Final verification gate

- [ ] **Step 1: Full build**

Run: `cd webapp && pnpm build`

Expected: Clean build, no errors

- [ ] **Step 2: Manual verification checklist**

- [ ] New brand colors visible across all pages
- [ ] FAB button is white on dark (not sage)
- [ ] Form inputs have visible borders
- [ ] Mobile lists animate in with stagger
- [ ] Budget warnings show icons alongside color
- [ ] Tab bar renders dynamic tabs based on config
- [ ] "Gestionar" is now "Más" with Profile/More content
- [ ] Onboarding flows through all 6 steps
- [ ] Tab preview step shows correct tabs per purpose
- [ ] Quick win step shows purpose-appropriate CTA
- [ ] Dashboard widgets render in config order
- [ ] Widget swipe-to-dismiss works with undo toast

- [ ] **Step 3: Commit and push**

```bash
git push
```

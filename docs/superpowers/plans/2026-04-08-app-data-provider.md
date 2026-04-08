# AppDataProvider — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preload commonly used data (accounts, categories, destinatarios, tag groups) once in the dashboard layout and expose it via React context, eliminating per-component lazy fetches and loading spinners on picker interactions.

**Architecture:** A server component in the dashboard layout fetches all four datasets in parallel (all already `"use cache"`-backed). A client context provider wraps dashboard children. Client components consume via `useAppData()` hook instead of calling server actions directly.

**Tech Stack:** React context, Suspense, existing cached server actions. No new dependencies.

---

### Task 1: Create the AppData context and provider

**Files:**
- Create: `webapp/src/components/providers/app-data-provider.tsx`

- [ ] **Step 1: Create the context, provider, and hook**

```tsx
// webapp/src/components/providers/app-data-provider.tsx
"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Account, CategoryWithChildren, TagGroupWithTags } from "@/types/domain";

type DestinatarioOption = {
  id: string;
  name: string;
  is_active: boolean;
};

interface AppData {
  accounts: Account[];
  categories: CategoryWithChildren[];
  outflowCategories: CategoryWithChildren[];
  destinatarios: DestinatarioOption[];
  tagGroups: TagGroupWithTags[];
}

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({
  children,
  data,
}: {
  children: ReactNode;
  data: AppData;
}) {
  return (
    <AppDataContext.Provider value={data}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return ctx;
}

// Optional: individual hooks for convenience
export function useAccounts() { return useAppData().accounts; }
export function useCategories() { return useAppData().categories; }
export function useOutflowCategories() { return useAppData().outflowCategories; }
export function useDestinatarios() { return useAppData().destinatarios; }
export function useTagGroups() { return useAppData().tagGroups; }
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/providers/app-data-provider.tsx
git commit -m "feat: add AppDataProvider context for preloaded shared data"
```

---

### Task 2: Create the server-side data fetcher

**Files:**
- Create: `webapp/src/components/providers/app-data-fetcher.tsx`

- [ ] **Step 1: Create a server component that fetches all data and wraps children with the provider**

```tsx
// webapp/src/components/providers/app-data-fetcher.tsx
import { Suspense } from "react";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { getDestinatarios } from "@/actions/destinatarios";
import { getTagGroups } from "@/actions/tags";
import { AppDataProvider } from "./app-data-provider";
import type { ReactNode } from "react";

async function AppDataLoader({ children }: { children: ReactNode }) {
  const [accountsResult, categoriesResult, outflowResult, destinatariosResult, tagGroupsResult] =
    await Promise.all([
      getAccounts(),
      getCategories(),
      getCategories("OUTFLOW"),
      getDestinatarios(),
      getTagGroups(),
    ]);

  const data = {
    accounts: accountsResult.success ? accountsResult.data : [],
    categories: categoriesResult.success ? categoriesResult.data : [],
    outflowCategories: outflowResult.success ? outflowResult.data ?? [] : [],
    destinatarios: (destinatariosResult.success ? destinatariosResult.data : []).map(
      (d) => ({ id: d.id, name: d.name, is_active: d.is_active })
    ),
    tagGroups: tagGroupsResult.success ? tagGroupsResult.data : [],
  };

  return <AppDataProvider data={data}>{children}</AppDataProvider>;
}

export function AppDataBoundary({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <AppDataLoader>{children}</AppDataLoader>
    </Suspense>
  );
}
```

The `Suspense fallback={children}` trick means the page renders immediately without data, and once the data resolves, it re-renders with the provider. Components using `useAppData()` would need a fallback — see Task 3.

**Alternative (simpler):** If the data is fast enough (all cached), skip Suspense and just await in the layout. The layout already awaits user/profile data, so adding 4 cached queries in parallel won't block noticeably.

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/providers/app-data-fetcher.tsx
git commit -m "feat: add AppDataFetcher server component for parallel data preloading"
```

---

### Task 3: Wire into dashboard layout

**Files:**
- Modify: `webapp/src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Import and wrap dashboard children with AppDataBoundary**

Find the existing layout structure. It currently wraps children with `MobileShellProvider`, `KeyboardInsetProvider`, etc. Add `AppDataBoundary` as an outer wrapper:

```tsx
import { AppDataBoundary } from "@/components/providers/app-data-fetcher";

// In the return JSX, wrap the existing providers:
<AppDataBoundary>
  <KeyboardInsetProvider>
    <MobileShellProvider ...>
      {children}
    </MobileShellProvider>
  </KeyboardInsetProvider>
</AppDataBoundary>
```

**Important:** The layout is a server component. `AppDataBoundary` is also a server component (it uses `Suspense` + an async child). This is valid in Next.js App Router.

- [ ] **Step 2: Verify build passes**

Run: `cd webapp && pnpm build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/\(dashboard\)/layout.tsx
git commit -m "feat: wire AppDataBoundary into dashboard layout"
```

---

### Task 4: Update DestinatarioZonePicker to use context

**Files:**
- Modify: `webapp/src/components/destinatarios/destinatario-zone-picker.tsx`

- [ ] **Step 1: Replace lazy-fetch with context consumption**

Remove:
- `useState` for `destinatarios`, `loaded`, `loading`
- `useEffect` that calls `getDestinatarios()`
- Import of `getDestinatarios`

Add:
- Import `useAppData` from `@/components/providers/app-data-provider`
- `const { destinatarios } = useAppData();` at the top of the component
- `active` and `filtered` memos stay the same, just source from context

The component becomes purely synchronous — no loading state needed.

- [ ] **Step 2: Verify build passes**

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/destinatarios/destinatario-zone-picker.tsx
git commit -m "refactor: DestinatarioZonePicker uses AppData context instead of lazy fetch"
```

---

### Task 5: Update TagZonePicker to use context for tag groups

**Files:**
- Modify: `webapp/src/components/tags/tag-zone-picker.tsx`

- [ ] **Step 1: Replace tag groups lazy-fetch with context, keep per-entity tag fetch**

Remove:
- `useState` for `tagGroups`, `groupsLoaded`
- The `getTagGroups()` call inside the effect
- Import of `getTagGroups`

Add:
- Import `useAppData` from `@/components/providers/app-data-provider`
- `const { tagGroups: contextTagGroups } = useAppData();`
- Initialize `localTagGroups` state from `contextTagGroups` (for inline creation support)

Keep:
- `getTagsForEntity()` call — this is per-transaction, can't be shared
- The `loading` state — but only for the per-entity fetch, not for groups
- Inline tag creation logic that updates `localTagGroups`

- [ ] **Step 2: Verify build passes**

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/tags/tag-zone-picker.tsx
git commit -m "refactor: TagZonePicker uses AppData context for tag groups"
```

---

### Task 6: Remove redundant data fetching from pages

**Files:**
- Modify: `webapp/src/app/(dashboard)/transactions/page.tsx`
- Modify: Any other page that fetches accounts/categories/destinatarios/tags just to pass them to pickers

- [ ] **Step 1: Audit pages that duplicate AppData fetches**

Search for pages that call `getAccounts()`, `getCategories()`, `getDestinatarios()`, `getTagGroups()` to pass data to pickers. Pages that use these for page-specific logic (like computing totals) should keep their fetches. Pages that only pass them through to pickers can stop — the pickers now use context.

**Do NOT remove fetches that are used for:**
- Computing page-level metrics (inflowVisible, outflowVisible, etc.)
- Server-side rendering of data tables
- Form defaults

**DO remove fetches that only exist to pass to pickers** — the pickers consume context now.

For `transactions/page.tsx`: the `outflowCategories` fetch is passed to `MovimientosRoot` → `MovimientosTransactionRow` → `CategoryZonePicker`. `CategoryZonePicker` doesn't use context (it takes props). So either:
- Option A: Keep passing categories as props to `CategoryZonePicker` (current pattern, works fine)
- Option B: Also make `CategoryZonePicker` context-aware (bigger change, out of scope)

**Recommendation:** Keep Category as prop-based for now. Only convert Destinatario and Tag pickers to context. This is the minimal change that solves the user's problem.

- [ ] **Step 2: Commit if any fetches were removed**

```bash
git add -A
git commit -m "refactor: remove redundant data fetches now covered by AppDataProvider"
```

---

### Task 7: Verify and test

- [ ] **Step 1: Full build**

Run: `cd webapp && pnpm build`
Expected: clean build

- [ ] **Step 2: Manual testing checklist**

- Open movimientos on mobile
- Expand a transaction row
- Tap destinatario icon → picker opens instantly (no spinner)
- Tap tag icon → picker opens instantly (no spinner for groups, may briefly load entity tags)
- Navigate to transaction detail page → DestinatarioPicker and TagPicker still work
- Navigate to categorizar → CategoryZonePicker still works
- Navigate to settings → page loads normally
- Open quick view menu → data loads normally

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during AppDataProvider testing"
```

---

## Design Notes

### Why context instead of a global store?

- React context with server component data is the idiomatic Next.js pattern
- The data is already server-cached (`"use cache"`), so the context just passes it to the client
- No Zustand/Redux overhead — the data is read-only reference data
- When mutations invalidate cache tags (`revalidateTag`), the next page render fetches fresh data and the provider updates automatically

### What about stale data?

After a mutation (e.g., creating a new destinatario), `revalidateTag("destinatarios")` fires. The next server render of the layout will fetch fresh data and pass it to the provider. Client navigations within the SPA may see stale data until a full server render. This is acceptable for reference data — the user will see the new destinatario after navigating to another page and back.

For inline-created tags (already handled): `TagZonePicker` maintains `localTagGroups` state that merges context data with locally created tags, so new tags appear instantly.

### Performance impact

- **Added to layout:** ~5 parallel cached queries (accounts, categories ×2, destinatarios, tag groups)
- **All use `"use cache"`:** After first hit, they serve from cache for the configured `cacheLife("zeta")` duration
- **Payload:** Estimated 10-20KB JSON for a typical user (50 accounts max, ~43 categories, ~20 destinatarios, ~30 tags)
- **Tradeoff:** Slightly larger initial page payload vs zero loading spinners on every picker interaction

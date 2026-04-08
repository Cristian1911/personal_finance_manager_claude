# Mobile Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 mobile UX issues — Categorizar card-based redesign, accounts badge clipping, Plan tab bar overflow, Settings accordion sections.

**Architecture:** Mobile extraction for Categorizar (new `MobileCategoryInbox` + `MobileCategoryDrawer` components). Inline responsive fixes for the other 3 items. All use `lg:` (1024px) as the mobile/desktop breakpoint, consistent with the app.

**Tech Stack:** Next.js 15, Tailwind v4, shadcn/ui (Drawer, Collapsible), Radix primitives, existing mobile/v2 components (MCardTight, MListRow)

**Spec:** `docs/superpowers/specs/2026-04-07-mobile-polish-design.md`

---

### Task 1: Accounts badge clipping fix

**Files:**
- Modify: `webapp/src/components/accounts/account-card.tsx:63-117`

This is the smallest, most self-contained fix. Remove the "Inicio" badge entirely and add proper flex constraints so the type badge + action button never clip.

- [ ] **Step 1: Remove Inicio badge and fix flex layout**

In `webapp/src/components/accounts/account-card.tsx`, replace the header section (lines 63-117):

```tsx
        <CardHeader className="space-y-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/6"
                style={{ backgroundColor: accentSurface }}
              >
                <Icon className="h-5 w-5" style={{ color: accentColor }} />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-base font-semibold">{account.name}</CardTitle>
                {account.institution_name && (
                  <p className="truncate text-xs text-muted-foreground">
                    {account.institution_name}
                    {account.mask && ` ••${account.mask}`}
                  </p>
                )}
                {!account.institution_name && account.mask ? (
                  <p className="text-xs text-muted-foreground">Terminación ••{account.mask}</p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="secondary" className="border-white/6 bg-black/15 text-[11px] text-z-white">
                {ACCOUNT_TYPE_SHORT_LABELS[account.account_type]}
              </Badge>
              {allAccounts && allAccounts.length > 0 && (
                <div
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  className="shrink-0"
                >
                  <QuickPaymentDialog
                    accountId={account.id}
                    accountName={account.name}
                    accountType={account.account_type}
                    currentBalance={account.current_balance}
                    currencyCode={account.currency_code}
                    accounts={allAccounts}
                    trigger={
                      <Button variant="ghost" size="icon" className="size-8 rounded-full">
                        <HandCoins className="size-4" />
                      </Button>
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </CardHeader>
```

Key changes from current code:
- Remove the `flex-wrap justify-end` wrapper around badges — no longer needed with single badge
- Remove the `show_in_dashboard` / "Inicio" badge entirely
- Add `shrink-0` to the right-side container so badge + button never compress
- Left side already has `min-w-0` for truncation — keep it

- [ ] **Step 2: Verify at mobile width**

Run: `cd webapp && pnpm build`
Expected: Clean build, no type errors.

Then visually verify at 390px and 320px widths that:
- Type badge stays visible next to action button
- Account name truncates with ellipsis when space is tight
- No overflow or clipping

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/accounts/account-card.tsx
git commit -m "fix: remove Inicio badge and fix account card badge clipping on mobile"
```

---

### Task 2: Plan tab bar — bottom list on mobile

**Files:**
- Create: `webapp/src/components/plan/plan-mobile-nav-list.tsx`
- Modify: `webapp/src/components/plan/plan-tab-nav.tsx:18-35`
- Modify: `webapp/src/app/(dashboard)/plan/page.tsx:160-186`

- [ ] **Step 1: Create PlanMobileNavList component**

Create `webapp/src/components/plan/plan-mobile-nav-list.tsx`:

```tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MCardTight, MListRow } from "@/components/mobile/v2/mobile-card";
import { MOBILE_EYEBROW_CLASS } from "@/lib/constants/styles";
import type { PlanTab } from "@/components/plan/plan-tab-nav";

const PLAN_TABS: { key: PlanTab; label: string }[] = [
  { key: "resumen", label: "Resumen" },
  { key: "presupuesto", label: "Presupuesto" },
  { key: "periodo", label: "Periodo" },
  { key: "recurrentes", label: "Recurrentes" },
  { key: "deseos", label: "Deseos" },
];

export function PlanMobileNavList({ activeTab }: { activeTab: PlanTab }) {
  const otherTabs = PLAN_TABS.filter((t) => t.key !== activeTab);

  return (
    <div className="mt-6 space-y-2 lg:hidden">
      <p className={MOBILE_EYEBROW_CLASS}>Más en Plan</p>
      <MCardTight>
        {otherTabs.map((tab) => (
          <Link key={tab.key} href={tab.key === "resumen" ? "/plan" : `/plan?tab=${tab.key}`}>
            <MListRow>
              <span className="text-sm font-medium">{tab.label}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </MListRow>
          </Link>
        ))}
      </MCardTight>
    </div>
  );
}
```

- [ ] **Step 2: Hide top pill bar on mobile**

In `webapp/src/components/plan/plan-tab-nav.tsx`, add `hidden lg:flex` to the nav:

```tsx
// Change line 19 from:
    <nav className="flex gap-1 overflow-x-auto scrollbar-none rounded-xl border border-white/6 bg-black/10 p-1">
// To:
    <nav className="hidden gap-1 overflow-x-auto scrollbar-none rounded-xl border border-white/6 bg-black/10 p-1 lg:flex">
```

- [ ] **Step 3: Add bottom nav list to Plan page mobile section**

In `webapp/src/app/(dashboard)/plan/page.tsx`, add the import at the top:

```tsx
import { PlanMobileNavList } from "@/components/plan/plan-mobile-nav-list";
```

Then in the mobile section (around line 160-186), add `PlanMobileNavList` after the tab content. Replace the mobile `<div>` block:

```tsx
      {/* ── Mobile ── */}
      <div className="lg:hidden">
        {/* Tab header — always visible on mobile */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">Plan</p>
              <h1 className="text-xl font-semibold">{activeTab === "resumen" ? "Tu plan" : ""}</h1>
            </div>
            {isResumen && (
              <Suspense fallback={<span className="text-xs capitalize text-muted-foreground">{monthLabel}</span>}>
                <MonthSelector />
              </Suspense>
            )}
          </div>
        </div>

        {/* Mobile tab content */}
        {mobileContent}
        {tabContent && (
          <div className="mt-4">
            <Suspense fallback={<div className="h-64 rounded-xl bg-muted animate-pulse" />}>
              {tabContent}
            </Suspense>
          </div>
        )}

        {/* Bottom navigation to other Plan tabs */}
        <PlanMobileNavList activeTab={activeTab} />
      </div>
```

Note: The only change from existing code is removing `<PlanTabNav activeTab={activeTab} />` from the mobile header (line 174) and adding `<PlanMobileNavList activeTab={activeTab} />` after the tab content.

- [ ] **Step 4: Build and verify**

Run: `cd webapp && pnpm build`
Expected: Clean build.

Verify at 390px: top pill bar is hidden, bottom list shows remaining tabs, tapping a tab navigates correctly.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/plan/plan-mobile-nav-list.tsx webapp/src/components/plan/plan-tab-nav.tsx webapp/src/app/\(dashboard\)/plan/page.tsx
git commit -m "feat: replace Plan tab pill bar with bottom nav list on mobile"
```

---

### Task 3: Settings accordion on mobile

**Files:**
- Modify: `webapp/src/app/(dashboard)/settings/page.tsx`

Uses the existing `Collapsible` component from Radix (already installed at `components/ui/collapsible.tsx`). No need to add shadcn Accordion.

- [ ] **Step 1: Add Collapsible imports and create mobile wrapper**

In `webapp/src/app/(dashboard)/settings/page.tsx`, add imports:

```tsx
import { SettingsMobileAccordion } from "@/components/settings/settings-mobile-accordion";
```

Create `webapp/src/components/settings/settings-mobile-accordion.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

export function SettingsMobileAccordion({ sections }: { sections: SettingsSection[] }) {
  const [openId, setOpenId] = useState<string>(sections[0]?.id ?? "");

  return (
    <div className="space-y-2">
      {sections.map((section) => {
        const isOpen = openId === section.id;
        return (
          <Collapsible
            key={section.id}
            open={isOpen}
            onOpenChange={(open) => setOpenId(open ? section.id : "")}
          >
            <div className="rounded-xl border border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
                    {section.icon}
                  </div>
                  <span className="font-semibold">{section.title}</span>
                </div>
                <ChevronDown
                  className={cn(
                    "size-4 text-muted-foreground transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-white/6 px-4 pb-4 pt-3">
                  {section.children}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Refactor Settings page with mobile/desktop split**

In `webapp/src/app/(dashboard)/settings/page.tsx`, restructure the return to use a mobile accordion and desktop cards:

After the `<PageHeaderRow>` and summary/attention grid (which stay the same), replace the card sections with:

```tsx
      {/* ── Mobile: Accordion ── */}
      <div className="lg:hidden">
        <SettingsMobileAccordion
          sections={[
            {
              id: "perfil",
              title: "Perfil",
              icon: <UserRound className="size-4 text-z-brass" />,
              children: <ProfileForm profile={profile} />,
            },
            {
              id: "integraciones",
              title: "Integraciones",
              icon: <Activity className="size-4 text-z-brass" />,
              children: (
                <IntegrationsCard
                  accounts={(accounts ?? []) as Account[]}
                  tokens={tokens}
                  headless
                />
              ),
            },
            {
              id: "email",
              title: "Email",
              icon: <Activity className="size-4 text-z-brass" />,
              children: (
                <>
                  <EmailIngestCard
                    accounts={(accounts ?? []) as Account[]}
                    initialAddress={emailIngestAddress}
                    headless
                  />
                  {unrecognizedEmails.length > 0 && (
                    <div className="mt-4">
                      <UnrecognizedEmailsCard initialEmails={unrecognizedEmails} headless />
                    </div>
                  )}
                </>
              ),
            },
            {
              id: "etiquetas",
              title: "Etiquetas",
              icon: <Tag className="size-4 text-z-brass" />,
              children: tagGroupsResult.success ? (
                <TagManager tagGroups={tagGroupsResult.data} />
              ) : (
                <p className="text-sm text-destructive">{tagGroupsResult.error}</p>
              ),
            },
            {
              id: "bug",
              title: "Reportar bug",
              icon: <Bug className="size-4 text-z-brass" />,
              children: <BugReportForm />,
            },
          ]}
        />
        <div className="mt-4 space-y-4">
          <BuildInfo />
          <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <CardHeader>
              <CardTitle className="text-base">Herramientas de Desarrollo</CardTitle>
            </CardHeader>
            <CardContent>
              <ReviewModeToggle />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Desktop: Cards ── */}
      <div className="hidden lg:block space-y-6">
        {/* ... existing card sections unchanged ... */}
      </div>
```

**Important:** The existing card components (`IntegrationsCard`, `EmailIngestCard`, `UnrecognizedEmailsCard`) currently render their own `<Card>` wrapper. For the accordion, we need them without the wrapper. Add a `headless` prop to these components that skips the Card/CardHeader wrapper and renders just the content. If this is too invasive, an alternative is to keep the cards as-is inside the accordion (card-inside-accordion is fine visually since the accordion item already has the card styling).

**Simpler approach (recommended):** Skip the `headless` prop. Just render the existing card components directly inside the accordion content. The double border is minimal and can be polished later. This keeps the task small:

```tsx
            {
              id: "integraciones",
              title: "Integraciones",
              icon: <Activity className="size-4 text-z-brass" />,
              children: (
                <IntegrationsCard
                  accounts={(accounts ?? []) as Account[]}
                  tokens={tokens}
                />
              ),
            },
```

- [ ] **Step 3: Build and verify**

Run: `cd webapp && pnpm build`
Expected: Clean build.

Verify at 390px: accordion shows with Perfil expanded by default, tapping another section closes current and opens new one.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/settings/settings-mobile-accordion.tsx webapp/src/app/\(dashboard\)/settings/page.tsx
git commit -m "feat: wrap Settings sections in accordion on mobile"
```

---

### Task 4: Mobile Categorizar — card feed + action sheet

**Files:**
- Create: `webapp/src/components/categorize/mobile-category-inbox.tsx`
- Create: `webapp/src/components/categorize/mobile-category-drawer.tsx`
- Modify: `webapp/src/app/(dashboard)/categorizar/page.tsx:194-201`

This is the largest task. The mobile component manages its own state (selection, tab, drawer open/close) and calls the same server actions as the desktop `CategoryInbox`.

- [ ] **Step 1: Create MobileCategoryDrawer**

Create `webapp/src/components/categorize/mobile-category-drawer.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import type { TransactionWithRelations, CategoryWithChildren } from "@/types/domain";
import type { CategorizationResult } from "@zeta/shared";

interface MobileCategoryDrawerProps {
  transaction: TransactionWithRelations | null;
  suggestion: CategorizationResult | null;
  categories: CategoryWithChildren[];
  similarCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (categoryId: string, applySimilar: boolean) => void;
  isPending: boolean;
  destinatarioSuggestion?: {
    destinatario_id: string;
    destinatario_name: string;
    category_id: string | null;
  } | null;
}

export function MobileCategoryDrawer({
  transaction: tx,
  suggestion,
  categories,
  similarCount,
  open,
  onOpenChange,
  onConfirm,
  isPending,
  destinatarioSuggestion,
}: MobileCategoryDrawerProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    suggestion?.categoryId ?? null
  );
  const [applySimilar, setApplySimilar] = useState(false);
  const [expandedParent, setExpandedParent] = useState<string | null>(null);

  // Reset state when transaction changes
  const txId = tx?.id;
  const [prevTxId, setPrevTxId] = useState(txId);
  if (txId !== prevTxId) {
    setPrevTxId(txId);
    setSelectedCategoryId(suggestion?.categoryId ?? null);
    setApplySimilar(false);
    setExpandedParent(null);
  }

  if (!tx) return null;

  const merchant = tx.merchant_name ?? tx.clean_description ?? tx.raw_description ?? "Sin descripción";
  const isOutflow = tx.direction === "OUTFLOW";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader className="text-left">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DrawerTitle className="text-base">{merchant}</DrawerTitle>
              <p className="text-xs text-muted-foreground">
                {tx.account?.name ?? "—"} · {formatDate(tx.transaction_date)}
              </p>
            </div>
            <p className={`text-base font-semibold ${isOutflow ? "text-z-debt" : "text-z-sage-light"}`}>
              {isOutflow ? "-" : "+"}
              {formatCurrency(Math.abs(tx.amount), tx.currency_code)}
            </p>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-4">
          {/* Category picker grid */}
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Categoría
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {categories.map((cat) => {
              const isExpanded = expandedParent === cat.id;
              const isSelected = selectedCategoryId === cat.id;
              const hasSelectedChild = cat.children.some((c) => c.id === selectedCategoryId);

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    if (cat.children.length > 0) {
                      setExpandedParent(isExpanded ? null : cat.id);
                    } else {
                      setSelectedCategoryId(cat.id);
                      setExpandedParent(null);
                    }
                  }}
                  className={`rounded-lg border px-2 py-2 text-center text-xs font-medium transition-colors ${
                    isSelected || hasSelectedChild
                      ? "border-z-brass/40 bg-z-brass/15 text-z-brass"
                      : "border-white/6 bg-black/10 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat.name_es ?? cat.name}
                </button>
              );
            })}
          </div>

          {/* Subcategory expansion */}
          {expandedParent && (() => {
            const parent = categories.find((c) => c.id === expandedParent);
            if (!parent || parent.children.length === 0) return null;
            return (
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {parent.children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(child.id);
                      setExpandedParent(null);
                    }}
                    className={`rounded-lg border px-2 py-1.5 text-center text-[11px] font-medium transition-colors ${
                      selectedCategoryId === child.id
                        ? "border-z-brass/40 bg-z-brass/15 text-z-brass"
                        : "border-white/6 bg-black/10 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {child.name_es ?? child.name}
                  </button>
                ))}
              </div>
            );
          })()}

          {/* Apply to similar */}
          {similarCount > 0 && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/6 bg-black/10 p-3">
              <div>
                <p className="text-sm font-medium">Aplicar a {similarCount} similares</p>
                <p className="text-[11px] text-muted-foreground">
                  Todas las transacciones de {merchant}
                </p>
              </div>
              <Switch checked={applySimilar} onCheckedChange={setApplySimilar} />
            </div>
          )}

          {/* Destinatario suggestion */}
          {destinatarioSuggestion && (
            <div className="mt-3 rounded-xl border border-z-brass/20 bg-z-brass/5 p-3">
              <p className="text-xs text-z-brass">
                Vincular con <strong>{destinatarioSuggestion.destinatario_name}</strong>
              </p>
            </div>
          )}

          {/* Confirm */}
          <Button
            className={`mt-4 w-full ${BRASS_BUTTON_CLASS}`}
            disabled={!selectedCategoryId || isPending}
            onClick={() => {
              if (selectedCategoryId) {
                onConfirm(selectedCategoryId, applySimilar);
              }
            }}
          >
            {isPending ? "Aplicando..." : "Confirmar"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
```

- [ ] **Step 2: Build check (drawer compiles)**

Run: `cd webapp && pnpm build`
Expected: Clean build (component is created but not imported anywhere yet — tree-shaking won't include it, but tsc will check types).

- [ ] **Step 3: Create MobileCategoryInbox**

Create `webapp/src/components/categorize/mobile-category-inbox.tsx`:

```tsx
"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { MobileCategoryDrawer } from "./mobile-category-drawer";
import { BulkActionBar } from "./bulk-action-bar";
import { autoCategorize, extractPattern } from "@zeta/shared";
import {
  categorizeTransaction,
  bulkCategorize,
  confirmAutoCategory,
  bulkConfirmAutoCategory,
} from "@/actions/categorize";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BRASS_BUTTON_CLASS, MOBILE_EYEBROW_CLASS } from "@/lib/constants/styles";
import type { TransactionWithRelations, CategoryWithChildren } from "@/types/domain";
import type { UserRule, CategorizationResult } from "@zeta/shared";

type ActiveTab = "uncategorized" | "auto-review";

interface MobileCategoryInboxProps {
  initialTransactions: TransactionWithRelations[];
  autoCategorizedTransactions?: TransactionWithRelations[];
  categories: CategoryWithChildren[];
  userRules: UserRule[];
  destinatarioSuggestions?: Record<string, {
    destinatario_id: string;
    destinatario_name: string;
    category_id: string | null;
  }>;
}

function groupByDate(txs: TransactionWithRelations[]) {
  const groups = new Map<string, TransactionWithRelations[]>();
  const sorted = [...txs].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
  for (const tx of sorted) {
    const date = tx.transaction_date;
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push(tx);
  }
  return groups;
}

export function MobileCategoryInbox({
  initialTransactions,
  autoCategorizedTransactions = [],
  categories,
  userRules,
  destinatarioSuggestions = {},
}: MobileCategoryInboxProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("uncategorized");
  const [transactions, setTransactions] = useState(initialTransactions);
  const [autoTransactions, setAutoTransactions] = useState(autoCategorizedTransactions);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [drawerTx, setDrawerTx] = useState<TransactionWithRelations | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const currentList = activeTab === "uncategorized" ? transactions : autoTransactions;
  const dateGroups = useMemo(() => groupByDate(currentList), [currentList]);

  // Compute auto-categorize suggestions
  const suggestions = useMemo(() => {
    const map = new Map<string, CategorizationResult>();
    for (const tx of transactions) {
      if (tx.categorization_source === "USER_OVERRIDE" || tx.categorization_source === "USER_CREATED") continue;
      const desc = tx.merchant_name ?? tx.clean_description ?? tx.raw_description ?? "";
      const result = autoCategorize(desc, userRules);
      if (result) map.set(tx.id, result);
    }
    return map;
  }, [transactions, userRules]);

  // Count similar transactions by merchant pattern
  const similarCounts = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const tx of transactions) {
      const desc = tx.merchant_name ?? tx.clean_description ?? tx.raw_description ?? "";
      const pattern = extractPattern(desc);
      if (!map.has(pattern)) map.set(pattern, []);
      map.get(pattern)!.push(tx.id);
    }
    return map;
  }, [transactions]);

  function getSimilarIds(tx: TransactionWithRelations): string[] {
    const desc = tx.merchant_name ?? tx.clean_description ?? tx.raw_description ?? "";
    const pattern = extractPattern(desc);
    const ids = similarCounts.get(pattern) ?? [];
    return ids.filter((id) => id !== tx.id);
  }

  const handleTapCard = useCallback((tx: TransactionWithRelations) => {
    if (selectMode) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(tx.id)) next.delete(tx.id);
        else next.add(tx.id);
        return next;
      });
    } else {
      setDrawerTx(tx);
      setDrawerOpen(true);
    }
  }, [selectMode]);

  const handleLongPress = useCallback((tx: TransactionWithRelations) => {
    setSelectMode(true);
    setSelected(new Set([tx.id]));
  }, []);

  const handleConfirm = useCallback(
    (categoryId: string, applySimilar: boolean) => {
      if (!drawerTx) return;
      const similarIds = applySimilar ? getSimilarIds(drawerTx) : [];
      const allIds = [drawerTx.id, ...similarIds];

      startTransition(async () => {
        if (activeTab === "auto-review") {
          await confirmAutoCategory(drawerTx.id, categoryId);
        } else if (allIds.length > 1) {
          await bulkCategorize(allIds, categoryId);
        } else {
          await categorizeTransaction(drawerTx.id, categoryId);
        }

        // Remove categorized transactions from local state
        if (activeTab === "uncategorized") {
          setTransactions((prev) => prev.filter((t) => !allIds.includes(t.id)));
        } else {
          setAutoTransactions((prev) => prev.filter((t) => t.id !== drawerTx.id));
        }

        setDrawerOpen(false);
        setDrawerTx(null);
        toast.success(
          allIds.length > 1
            ? `${allIds.length} transacciones categorizadas`
            : "Transacción categorizada"
        );
      });
    },
    [drawerTx, activeTab, transactions]
  );

  const handleBulkAssign = useCallback(
    (categoryId: string) => {
      const ids = Array.from(selected);
      startTransition(async () => {
        if (activeTab === "auto-review") {
          await bulkConfirmAutoCategory(ids, categoryId);
          setAutoTransactions((prev) => prev.filter((t) => !selected.has(t.id)));
        } else {
          await bulkCategorize(ids, categoryId);
          setTransactions((prev) => prev.filter((t) => !selected.has(t.id)));
        }
        setSelected(new Set());
        setSelectMode(false);
        toast.success(`${ids.length} transacciones categorizadas`);
      });
    },
    [selected, activeTab]
  );

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);

  // Empty state
  if (transactions.length === 0 && autoTransactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center lg:hidden">
        <p className="text-lg font-semibold">Bandeja limpia</p>
        <p className="mt-1 text-sm text-muted-foreground">No hay transacciones pendientes</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 lg:hidden">
      {/* Tab pills */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setActiveTab("uncategorized"); exitSelectMode(); }}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            activeTab === "uncategorized"
              ? "bg-z-brass/15 text-z-brass"
              : "bg-black/10 text-muted-foreground"
          )}
        >
          {transactions.length} sin categoría
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("auto-review"); exitSelectMode(); }}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            activeTab === "auto-review"
              ? "bg-z-brass/15 text-z-brass"
              : "bg-black/10 text-muted-foreground"
          )}
        >
          {autoTransactions.length} auto-categorizadas
        </button>
      </div>

      {/* Card feed grouped by date */}
      {Array.from(dateGroups.entries()).map(([date, txs]) => (
        <div key={date}>
          <p className={cn(MOBILE_EYEBROW_CLASS, "sticky top-0 z-10 bg-background/80 py-1 backdrop-blur-sm")}>
            {formatDate(date)}
          </p>
          <div className="space-y-1.5">
            {txs.map((tx) => {
              const merchant = tx.merchant_name ?? tx.clean_description ?? tx.raw_description ?? "—";
              const isOutflow = tx.direction === "OUTFLOW";
              const suggestion = suggestions.get(tx.id);
              const isSelected = selected.has(tx.id);

              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => handleTapCard(tx)}
                  onContextMenu={(e) => { e.preventDefault(); handleLongPress(tx); }}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition-colors",
                    isSelected
                      ? "border-z-brass/30 bg-z-brass/10"
                      : "border-white/6 bg-z-surface-2/70"
                  )}
                >
                  <div className="flex min-w-0 gap-2.5">
                    {selectMode && (
                      <Checkbox
                        checked={isSelected}
                        className="mt-0.5 shrink-0"
                        onCheckedChange={() => handleTapCard(tx)}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{merchant}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        {tx.account && (
                          <>
                            <span
                              className="inline-block size-1.5 rounded-full"
                              style={{ backgroundColor: tx.account.color ?? "var(--z-sage-dark)" }}
                            />
                            <span className="truncate">{tx.account.name}</span>
                            <span>·</span>
                          </>
                        )}
                        <span>{formatDate(tx.transaction_date)}</span>
                        {suggestion && (
                          <>
                            <span>·</span>
                            <span className="rounded-full bg-z-brass/10 px-1.5 py-0.5 text-z-brass">
                              💡 {suggestion.categoryName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={cn(
                    "shrink-0 text-sm font-semibold",
                    isOutflow ? "text-z-debt" : "text-z-sage-light"
                  )}>
                    {isOutflow ? "-" : "+"}
                    {formatCurrency(Math.abs(tx.amount), tx.currency_code)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Bulk action bar */}
      {selectMode && selected.size > 0 && (
        <BulkActionBar
          selectedCount={selected.size}
          categories={categories}
          onAssign={handleBulkAssign}
          onClearSelection={exitSelectMode}
          isPending={isPending}
        />
      )}

      {/* Category drawer */}
      <MobileCategoryDrawer
        transaction={drawerTx}
        suggestion={drawerTx ? suggestions.get(drawerTx.id) ?? null : null}
        categories={categories}
        similarCount={drawerTx ? getSimilarIds(drawerTx).length : 0}
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setDrawerTx(null);
        }}
        onConfirm={handleConfirm}
        isPending={isPending}
        destinatarioSuggestion={drawerTx ? destinatarioSuggestions[drawerTx.id] ?? null : null}
      />
    </div>
  );
}
```

- [ ] **Step 4: Wire into Categorizar page**

In `webapp/src/app/(dashboard)/categorizar/page.tsx`, add the dynamic import after the existing `CategoryInbox` import (line 20-23):

```tsx
const MobileCategoryInbox = dynamic(
  () => import("@/components/categorize/mobile-category-inbox").then((m) => ({ default: m.MobileCategoryInbox })),
  { loading: () => <div className="h-64 rounded-xl bg-muted animate-pulse lg:hidden" /> }
);
```

Then replace lines 194-201 (the `CategoryInbox` render) with:

```tsx
      {/* Mobile */}
      <MobileCategoryInbox
        initialTransactions={transactions}
        autoCategorizedTransactions={unreviewedAutoTransactions}
        categories={categories}
        userRules={userRules}
        destinatarioSuggestions={destinatarioSuggestions}
      />

      {/* Desktop */}
      <div className="hidden lg:block">
        <CategoryInbox
          initialTransactions={transactions}
          autoCategorizedTransactions={unreviewedAutoTransactions}
          categories={categories}
          userRules={userRules}
          tagGroups={tagGroups}
          destinatarioSuggestions={destinatarioSuggestions}
        />
      </div>
```

- [ ] **Step 5: Build and verify**

Run: `cd webapp && pnpm build`
Expected: Clean build, no type errors.

Verify at 390px:
- Card feed renders with date-grouped transactions
- Tapping a card opens the drawer with category grid
- Selecting a category and confirming removes the transaction from the feed
- Long-press enters select mode with checkboxes
- Bulk action bar appears with selection count
- Tab pills toggle between uncategorized and auto-review

- [ ] **Step 6: Commit**

```bash
git add webapp/src/components/categorize/mobile-category-inbox.tsx webapp/src/components/categorize/mobile-category-drawer.tsx webapp/src/app/\(dashboard\)/categorizar/page.tsx
git commit -m "feat: add mobile card feed + drawer for Categorizar page"
```

---

### Task 5: Final build gate

- [ ] **Step 1: Full build verification**

Run:
```bash
cd webapp && pnpm install && pnpm build
```
Expected: Clean build with no errors or warnings.

- [ ] **Step 2: Visual verification checklist**

Start dev server (`cd webapp && pnpm dev`) and verify at 390px and 1440px:

1. **Accounts** (`/accounts`) — type badge visible, no clipping at 320px, no Inicio badge
2. **Plan** (`/plan`) — no top pill bar on mobile, "Más en Plan" list at bottom with 4 items, tapping navigates correctly
3. **Plan tab** (`/plan?tab=presupuesto`) — bottom list shows 4 other tabs (not presupuesto), top pills visible on desktop
4. **Settings** (`/settings`) — accordion on mobile with Perfil expanded, cards on desktop unchanged
5. **Categorizar** (`/categorizar`) — card feed on mobile, desktop layout unchanged, drawer opens on card tap

- [ ] **Step 3: Commit any final tweaks**

If any visual adjustments are needed, commit them:
```bash
git add -A
git commit -m "fix: mobile polish visual adjustments"
```

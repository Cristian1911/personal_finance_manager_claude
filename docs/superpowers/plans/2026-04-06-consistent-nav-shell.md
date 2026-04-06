# Consistent Navigation Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the mobile header into a single component (`MobileHeader`) with two variants (`main`/`sub`), and clean up movimientos utilidades by removing redundant pills.

**Architecture:** Refactor the existing `MobileHeader` component to support both main-tab and subpage modes. Migrate all 16 `MobilePageHeader` consumers to the new API. Simplify `MovimientosUtilidades` by removing duplicated controls.

**Tech Stack:** React, TypeScript, Tailwind CSS v4, Lucide icons, shadcn/ui components (Drawer, Popover). All existing — no new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-06-consistent-nav-shell-design.md`

**Design tokens:** Use existing Zeta tokens from `globals.css` — `z-brass`, `z-ink`, `z-sage-light`, `z-surface-2`, etc. Style classes from `src/lib/constants/styles.ts` — `MOBILE_BG_CLASS`, `PANEL_INSET_CLASS`, `GHOST_BUTTON_CLASS`.

---

### Task 1: Refactor MobileHeader component

**Files:**
- Modify: `webapp/src/components/mobile/v2/mobile-header.tsx`

This is the core change. The current component has `variant: "dashboard" | "page"`. We refactor to `variant: "main" | "sub"` where:
- `main`: `[Title] [subtitle?] ··· [action?] [Avatar]` — used by the 4 tab screens
- `sub`: `[← back] [Title] ··· [action?] [Avatar]` — used by all drill-down pages

Avatar is always rendered via `MobileAvatarMenu` (no props needed — it reads from `MobileShellProvider` context).

- [ ] **Step 1: Rewrite MobileHeader with new variant types**

Replace the full content of `webapp/src/components/mobile/v2/mobile-header.tsx` with:

```tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOBILE_BG_CLASS } from "@/lib/constants/styles";
import { MobileAvatarMenu } from "./mobile-avatar-menu";

// ─── Main tab variant (Inicio, Movimientos, Plan, Deudas) ──────────────────

interface MainHeaderProps {
  variant: "main";
  title: string;
  subtitle?: string;
  /** Extra slot rendered before the avatar (e.g. MonthSelector, CTA link) */
  action?: ReactNode;
}

// ─── Subpage variant (Categorizar, Destinatarios, etc.) ─────────────────────

interface SubHeaderProps {
  variant: "sub";
  title: string;
  /** Where the back arrow navigates. Falls back to browser history. */
  backHref?: string;
  /** Extra slot rendered before the avatar (e.g. MonthSelector on Presupuesto) */
  action?: ReactNode;
}

type MobileHeaderProps = MainHeaderProps | SubHeaderProps;

export function MobileHeader(props: MobileHeaderProps) {
  const base = cn(
    "sticky top-0 z-30 flex h-12 items-center border-b border-white/6 px-4 backdrop-blur-md lg:hidden",
    MOBILE_BG_CLASS,
    "supports-[backdrop-filter]:bg-background/90"
  );

  if (props.variant === "sub") {
    const backEl = props.backHref ? (
      <Link
        href={props.backHref}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-z-sage-light transition-colors hover:bg-white/5"
        aria-label="Volver"
      >
        <ArrowLeft className="size-4" />
      </Link>
    ) : (
      <BackButton />
    );

    return (
      <header className={base}>
        <div className="flex flex-1 items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {backEl}
            <p className="truncate text-[15px] font-semibold leading-tight text-foreground">
              {props.title}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {props.action && <div className="shrink-0">{props.action}</div>}
            <MobileAvatarMenu />
          </div>
        </div>
      </header>
    );
  }

  // variant === "main"
  return (
    <header className={base}>
      <div className="flex flex-1 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-tight text-foreground">
            {props.title}
          </p>
          {props.subtitle && (
            <p className="truncate text-[11px] text-muted-foreground leading-tight">
              {props.subtitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {props.action && <div className="shrink-0">{props.action}</div>}
          <MobileAvatarMenu />
        </div>
      </div>
    </header>
  );
}

// ─── Client-only back button (uses router.back()) ───────────────────────────

"use client";
import { useRouter } from "next/navigation";

function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-z-sage-light transition-colors hover:bg-white/5"
      aria-label="Volver"
    >
      <ArrowLeft className="size-4" />
    </button>
  );
}
```

Wait — we can't mix server and client in one file like that. The `BackButton` needs `"use client"` but the main component should stay as a server component so it works in server-rendered pages. Let's split it.

- [ ] **Step 1 (revised): Create BackButton client component**

Create `webapp/src/components/mobile/v2/mobile-back-button.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function MobileBackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-z-sage-light transition-colors hover:bg-white/5"
      aria-label="Volver"
    >
      <ArrowLeft className="size-4" />
    </button>
  );
}
```

- [ ] **Step 2: Rewrite MobileHeader**

Replace the full content of `webapp/src/components/mobile/v2/mobile-header.tsx`:

```tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOBILE_BG_CLASS } from "@/lib/constants/styles";
import { MobileAvatarMenu } from "./mobile-avatar-menu";
import { MobileBackButton } from "./mobile-back-button";

// ─── Main tab variant (Inicio, Movimientos, Plan, Deudas) ──────────────────

interface MainHeaderProps {
  variant: "main";
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

// ─── Subpage variant (drill-down pages) ─────────────────────────────────────

interface SubHeaderProps {
  variant: "sub";
  title: string;
  backHref?: string;
  action?: ReactNode;
}

type MobileHeaderProps = MainHeaderProps | SubHeaderProps;

export function MobileHeader(props: MobileHeaderProps) {
  const base = cn(
    "sticky top-0 z-30 flex h-12 items-center border-b border-white/6 px-4 backdrop-blur-md lg:hidden",
    MOBILE_BG_CLASS,
    "supports-[backdrop-filter]:bg-background/90"
  );

  if (props.variant === "sub") {
    return (
      <header className={base}>
        <div className="flex flex-1 items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {props.backHref ? (
              <Link
                href={props.backHref}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-z-sage-light transition-colors hover:bg-white/5"
                aria-label="Volver"
              >
                <ArrowLeft className="size-4" />
              </Link>
            ) : (
              <MobileBackButton />
            )}
            <p className="truncate text-[15px] font-semibold leading-tight text-foreground">
              {props.title}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {props.action && <div className="shrink-0">{props.action}</div>}
            <MobileAvatarMenu />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className={base}>
      <div className="flex flex-1 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-tight text-foreground">
            {props.title}
          </p>
          {props.subtitle && (
            <p className="truncate text-[11px] text-muted-foreground leading-tight">
              {props.subtitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {props.action && <div className="shrink-0">{props.action}</div>}
          <MobileAvatarMenu />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Verify build compiles**

Run: `cd webapp && pnpm build 2>&1 | head -30`

Expected: Build errors from consumers still using old API (`variant="dashboard"`, `variant="page"`, `chip` prop). This is expected — we fix them in Tasks 2-4.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/mobile/v2/mobile-header.tsx webapp/src/components/mobile/v2/mobile-back-button.tsx
git commit -m "refactor: unify MobileHeader with main/sub variants"
```

---

### Task 2: Migrate main tab consumers

**Files:**
- Modify: `webapp/src/components/mobile/v2/inicio/inicio-root.tsx`
- Modify: `webapp/src/components/mobile/v2/movimientos/movimientos-root.tsx`
- Modify: `webapp/src/components/mobile/v2/plan/plan-root.tsx`
- Modify: `webapp/src/components/mobile/v2/deudas/deudas-root.tsx`

Each main tab currently uses `variant="page"` or `variant="dashboard"`. Switch to `variant="main"`.

- [ ] **Step 1: Migrate inicio-root.tsx**

In `webapp/src/components/mobile/v2/inicio/inicio-root.tsx`, change the MobileHeader usage from:

```tsx
<MobileHeader variant="dashboard" name={name} email={email} />
```

to:

```tsx
<MobileHeader variant="main" title="Inicio" />
```

Remove `name` and `email` from the `InicioRootProps` interface and the destructured props if they are only used for MobileHeader (the avatar reads from MobileShellProvider context now).

- [ ] **Step 2: Migrate movimientos-root.tsx**

In `webapp/src/components/mobile/v2/movimientos/movimientos-root.tsx`, change:

```tsx
<MobileHeader
  variant="page"
  title="Movimientos"
  chip="Mesa operativa"
  action={
    <Suspense>
      <MonthSelector />
    </Suspense>
  }
/>
```

to:

```tsx
<MobileHeader
  variant="main"
  title="Movimientos"
  action={
    <Suspense>
      <MonthSelector />
    </Suspense>
  }
/>
```

The `chip` prop no longer exists — "Mesa operativa" is removed.

- [ ] **Step 3: Migrate plan-root.tsx**

In `webapp/src/components/mobile/v2/plan/plan-root.tsx`, change:

```tsx
<MobileHeader
  variant="page"
  title="Plan"
  subtitle={`${monthLabel} · ${daysInMonth - dayOfMonth}d restantes`}
  action={
    <Suspense fallback={<span className="text-xs capitalize">{monthLabel}</span>}>
      <MonthSelector />
    </Suspense>
  }
/>
```

to:

```tsx
<MobileHeader
  variant="main"
  title="Plan"
  subtitle={`${monthLabel} · ${daysInMonth - dayOfMonth}d restantes`}
  action={
    <Suspense fallback={<span className="text-xs capitalize">{monthLabel}</span>}>
      <MonthSelector />
    </Suspense>
  }
/>
```

Only change is `variant="page"` → `variant="main"`.

- [ ] **Step 4: Migrate deudas-root.tsx**

In `webapp/src/components/mobile/v2/deudas/deudas-root.tsx`, change:

```tsx
<MobileHeader
  variant="page"
  title="Deudas"
  subtitle={`Lectura en ${currency}`}
  action={...}
/>
```

to:

```tsx
<MobileHeader
  variant="main"
  title="Deudas"
  subtitle={`Lectura en ${currency}`}
  action={...}
/>
```

Only change is `variant="page"` → `variant="main"`. Keep the existing `action` slot (the "Simular" link) as-is.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/mobile/v2/inicio/inicio-root.tsx webapp/src/components/mobile/v2/movimientos/movimientos-root.tsx webapp/src/components/mobile/v2/plan/plan-root.tsx webapp/src/components/mobile/v2/deudas/deudas-root.tsx
git commit -m "refactor: migrate main tab screens to MobileHeader variant=main"
```

---

### Task 3: Migrate all MobilePageHeader consumers to MobileHeader variant="sub"

**Files (16 pages):**
- Modify: `webapp/src/app/(dashboard)/categorizar/page.tsx`
- Modify: `webapp/src/app/(dashboard)/destinatarios/page.tsx`
- Modify: `webapp/src/app/(dashboard)/destinatarios/[id]/page.tsx`
- Modify: `webapp/src/app/(dashboard)/accounts/page.tsx`
- Modify: `webapp/src/app/(dashboard)/accounts/[id]/page.tsx`
- Modify: `webapp/src/app/(dashboard)/settings/page.tsx`
- Modify: `webapp/src/app/(dashboard)/settings/analytics/page.tsx`
- Modify: `webapp/src/app/(dashboard)/deudas/planificador/page.tsx`
- Modify: `webapp/src/app/(dashboard)/categories/page.tsx`
- Modify: `webapp/src/app/(dashboard)/pendientes/page.tsx`
- Modify: `webapp/src/app/(dashboard)/gestionar/page.tsx`
- Modify: `webapp/src/app/(dashboard)/etiquetas/page.tsx`
- Modify: `webapp/src/app/(dashboard)/deseos/page.tsx`
- Modify: `webapp/src/app/(dashboard)/import/page.tsx`
- Modify: `webapp/src/app/(dashboard)/recurrentes/page.tsx`
- Modify: `webapp/src/app/(dashboard)/transactions/[id]/page.tsx`

Each page follows the same pattern. The migration is mechanical:

1. Change import from `import { MobilePageHeader } from "@/components/mobile/mobile-page-header"` to `import { MobileHeader } from "@/components/mobile/v2/mobile-header"`
2. Change `<MobilePageHeader title="X" backHref="/Y" />` to `<MobileHeader variant="sub" title="X" backHref="/Y" />`

- [ ] **Step 1: Migrate all 16 pages**

For each file, apply this transformation:

| File | Old | New |
|------|-----|-----|
| `categorizar/page.tsx` | `<MobilePageHeader title="Categorizar" backHref="/gestionar" />` | `<MobileHeader variant="sub" title="Categorizar" backHref="/gestionar" />` |
| `destinatarios/page.tsx` | `<MobilePageHeader title="Destinatarios" backHref="/gestionar" />` | `<MobileHeader variant="sub" title="Destinatarios" backHref="/gestionar" />` |
| `destinatarios/[id]/page.tsx` | `<MobilePageHeader title={destinatario.name} backHref="/destinatarios" />` | `<MobileHeader variant="sub" title={destinatario.name} backHref="/destinatarios" />` |
| `accounts/page.tsx` | `<MobilePageHeader title="Cuentas" backHref="/gestionar" />` | `<MobileHeader variant="sub" title="Cuentas" backHref="/gestionar" />` |
| `accounts/[id]/page.tsx` | `<MobilePageHeader title={account.name} backHref="/accounts" />` | `<MobileHeader variant="sub" title={account.name} backHref="/accounts" />` |
| `settings/page.tsx` | `<MobilePageHeader title="Ajustes" backHref="/gestionar" />` | `<MobileHeader variant="sub" title="Ajustes" backHref="/gestionar" />` |
| `settings/analytics/page.tsx` | `<MobilePageHeader title="Actividad de uso" backHref="/settings" />` | `<MobileHeader variant="sub" title="Actividad de uso" backHref="/settings" />` |
| `deudas/planificador/page.tsx` | `<MobilePageHeader title="Planificador" backHref="/plan" />` (appears twice in the file) | `<MobileHeader variant="sub" title="Planificador" backHref="/plan" />` (both occurrences) |
| `pendientes/page.tsx` | `<MobilePageHeader title="Pendientes" backHref="/dashboard" />` | `<MobileHeader variant="sub" title="Pendientes" backHref="/dashboard" />` |
| `gestionar/page.tsx` | `<MobilePageHeader title="Bandeja" />` | `<MobileHeader variant="sub" title="Bandeja" />` (no backHref — will use router.back()) |
| `etiquetas/page.tsx` | `<MobilePageHeader title="Etiquetas" backHref="/gestionar" />` | `<MobileHeader variant="sub" title="Etiquetas" backHref="/gestionar" />` |
| `deseos/page.tsx` | `<MobilePageHeader title="Deseos" backHref="/plan" />` | `<MobileHeader variant="sub" title="Deseos" backHref="/plan" />` |
| `import/page.tsx` | `<MobilePageHeader title="Importar Extracto" backHref="/gestionar" />` | `<MobileHeader variant="sub" title="Importar Extracto" backHref="/gestionar" />` |
| `recurrentes/page.tsx` | `<MobilePageHeader title="Recurrentes" backHref="/plan" />` | `<MobileHeader variant="sub" title="Recurrentes" backHref="/plan" />` |
| `transactions/[id]/page.tsx` | `<MobilePageHeader title="Detalle" backHref="/transactions" />` | `<MobileHeader variant="sub" title="Detalle" backHref="/transactions" />` |

**Special case — `categories/page.tsx`:**

This page passes `<MonthSelector />` as children:
```tsx
<MobilePageHeader title="Presupuesto" backHref="/plan">
  <MonthSelector />
</MobilePageHeader>
```

Change to use the `action` prop:
```tsx
<MobileHeader variant="sub" title="Presupuesto" backHref="/plan" action={<MonthSelector />} />
```

- [ ] **Step 2: Verify build compiles**

Run: `cd webapp && pnpm build 2>&1 | tail -5`

Expected: Clean build (or warnings unrelated to this change). All pages should now use the unified `MobileHeader`.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/app/\(dashboard\)/
git commit -m "refactor: migrate all MobilePageHeader consumers to MobileHeader variant=sub"
```

---

### Task 4: Delete MobilePageHeader

**Files:**
- Delete: `webapp/src/components/mobile/mobile-page-header.tsx`

- [ ] **Step 1: Verify no remaining imports**

Run: `grep -r "mobile-page-header" webapp/src/ --include="*.tsx" --include="*.ts"`

Expected: No results. If any remain, migrate them first.

- [ ] **Step 2: Delete the file**

```bash
rm webapp/src/components/mobile/mobile-page-header.tsx
```

- [ ] **Step 3: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -5`

Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/mobile/mobile-page-header.tsx
git commit -m "chore: delete deprecated MobilePageHeader"
```

---

### Task 5: Simplify MovimientosUtilidades

**Files:**
- Modify: `webapp/src/components/mobile/v2/movimientos/movimientos-utilidades.tsx`

Remove the "Registrar" pill (duplicates tab bar +) and "abril" month pill (duplicates header month selector). Change "Buscar" from text to `Search` icon. Keep "Filtrar" with `SlidersHorizontal` icon.

- [ ] **Step 1: Rewrite MovimientosUtilidades**

Replace the full content of `webapp/src/components/mobile/v2/movimientos/movimientos-utilidades.tsx`:

```tsx
"use client";

import { useState, Suspense } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import type { Account, CategoryWithChildren, Tag } from "@/types/domain";

interface MovimientosUtilidadesProps {
  accounts: Account[];
  categories: CategoryWithChildren[];
  tags: Tag[];
}

const pillClass =
  "flex items-center justify-center rounded-full border border-white/6 bg-black/10 text-muted-foreground transition-colors";

export function MovimientosUtilidades({
  accounts,
  categories,
  tags,
}: MovimientosUtilidadesProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {/* Search icon pill */}
        <button
          type="button"
          className={cn(
            pillClass,
            "size-8",
            searchOpen && "border-z-brass/30 text-z-brass"
          )}
          onClick={() => setSearchOpen((prev) => !prev)}
          aria-label="Buscar"
        >
          <Search className="size-3.5" />
        </button>

        {/* Filter pill */}
        <Drawer>
          <DrawerTrigger asChild>
            <button
              type="button"
              className={cn(pillClass, "gap-1.5 px-3 py-1.5 text-[10px] font-semibold")}
            >
              <SlidersHorizontal className="size-3" />
              Filtrar
            </button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[80dvh]">
            <DrawerHeader>
              <DrawerTitle>Filtros</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6 space-y-4">
              <Suspense>
                <TransactionFilters accounts={accounts} tags={tags} />
              </Suspense>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Search input — inline toggle */}
      {searchOpen && (
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Buscar movimiento..."
          autoFocus
          className="w-full rounded-xl border border-white/6 bg-black/10 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-z-brass/30 focus:outline-none"
        />
      )}
    </div>
  );
}
```

This removes:
- `MonthSelector` import and the month pill drawer
- `MobileTransactionForm` import and the "Registrar" pill drawer
- `formatMonthLabel` import (no longer needed)

And changes:
- "Buscar" text → `Search` icon in a round 32px pill
- "Filtrar" text → `SlidersHorizontal` icon + "Filtrar" text

- [ ] **Step 2: Clean up movimientos-root.tsx imports if needed**

Check if `movimientos-root.tsx` imports `MobileTransactionForm` — it shouldn't (it's in `movimientos-utilidades.tsx`), but verify. No changes expected here.

- [ ] **Step 3: Verify build**

Run: `cd webapp && pnpm build 2>&1 | tail -5`

Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/mobile/v2/movimientos/movimientos-utilidades.tsx
git commit -m "fix: simplify movimientos utilidades — remove redundant pills, icon search"
```

---

### Task 6: Update MANUAL_TODOS.md and final build verification

**Files:**
- Modify: `MANUAL_TODOS.md`

- [ ] **Step 1: Mark items #13 and #14 as done**

In `MANUAL_TODOS.md`, change the two unchecked items:

```
- [ ] La barra superior de las pantallas principales no es consistente...
```
to:
```
- [x] La barra superior de las pantallas principales no es consistente. (Resuelto: MobileHeader unificado con variantes main/sub, avatar siempre visible, selector de mes consistente)
```

```
- [ ] La UX de las acciones de filtrado de los movimientos no tiene sentido...
```
to:
```
- [x] La UX de las acciones de filtrado de los movimientos no tiene sentido. (Resuelto: eliminados pills duplicados Registrar y mes, Buscar ahora es icono, Filtrar con drawer funcional)
```

- [ ] **Step 2: Final build gate**

Run: `cd webapp && pnpm install && pnpm build`

Expected: Clean build with zero errors.

- [ ] **Step 3: Commit**

```bash
git add MANUAL_TODOS.md
git commit -m "docs: mark TODO #13 and #14 as resolved"
```

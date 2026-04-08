# Mobile Plan Family Redesign + General Mobile Fixes

**Date:** 2026-04-08
**Status:** Draft
**Scope:** Dedicated mobile views for Plan hub, Presupuesto, Recurrentes, Periodo + targeted fixes for Landing, Settings, Accounts, Transactions list

## Context

The Zeta webapp uses a `lg:hidden` / `hidden lg:block` split architecture to serve dedicated mobile views at `<1024px`. Several pages already have polished mobile views (Dashboard, Categorizar, Gestionar, Deudas, Deseos, Transaction detail). Seven pages currently render the desktop layout on mobile, causing overflow, truncation, and cramped interactions.

This spec covers the full redesign of the Plan family (4 pages) and targeted fixes for 4 additional pages.

## Design Principles

- **"Am I on track?" at a glance** — every hero answers this without scrolling
- **Hybrid: summary card + drill-down** — top-level view shows actionable metrics, tap to go deeper
- **Chart focus mode** — expanded charts take over touch events
- **Bottom nav clearance** — all pages get `pb-20` for the fixed MobileTabBar

---

## 1. Plan Hub (`/plan`)

### Current Problems
- Duplicate month selector (header + section)
- Budget hero mixed with cashflow — tries to be two things
- Long scroll with everything inline
- Content hidden behind bottom nav

### New Mobile Layout

**Structure:** `MobileHeader` → Net Hero Card → 2 Expandable Chips → Drill-down Cards

#### Net Hero Card (tappable → chart)
- **Title:** "NETO DEL MES"
- **Main metric:** Net amount (e.g., `+$4.162.587`) in brass/gold
- **Subtitle:** "22 días restantes"
- **Stacked progress bar:** Full width = total income (green). Red overlaid from left = total payments. Brass remainder on right = net. Single bar, three segments.
- **Legend:** Three dot-labeled values: "Ingresos $35.7M" / "Gastos $31.5M" / "Neto"
- **Tap hint:** "Toca para ver flujo ↓" (muted)
- **Tap action:** Expands the full Flujo del Mes Recharts chart (bars + net line + ingresos/gastos/neto totals) inline. Enters **chart focus mode**.

#### 2 Expandable Chips (grid, 1fr 1fr)
- **Próximo ingreso:** Amount in green, source + date below. Tap → expands an inline list of all upcoming incomes with total.
- **Próximo pago:** Amount in red, source + date below. Tap → expands an inline list of all upcoming payments with total.
- Active chip gets a highlighted border; sibling dims. List slides in below the chips.

#### Drill-down Cards ("IR A" section)
Each card shows title + one-line status hint + chevron. Cards:
- **Presupuesto** — e.g., "914% · 6 sobre límite" (red)
- **Periodo** — e.g., "100% asignado" (green)
- **Recurrentes** — e.g., "$2M/mes" (amber)
- **Deseos** — e.g., "3 items" (muted)

Each navigates to the sub-page via the existing `?tab=` routing.

#### Month Selector
Single instance in the header row, right-aligned. Compact pill: `‹ Abr ›`.

---

## 2. Chart Focus Mode (cross-cutting)

When any chart expands on mobile (Plan hero, Periodo hero, or any future chart):

1. `document.body.style.overflow = 'hidden'` — locks page scroll
2. Touch events within the chart area route to Recharts interactions (pan/scrub to see daily detail, pinch to zoom if applicable)
3. Subtle overlay (semi-transparent dark) dims content below the expanded chart
4. **Exit:** Tap the hero card header/collapse link, or tap the overlay
5. On collapse: restore scroll, remove overlay, animate chart closed

Implementation: a `useChartFocusMode(isExpanded: boolean)` hook that handles body scroll lock and overlay. Applied in any component that has an expandable chart.

---

## 3. Presupuesto (`/plan?tab=presupuesto`)

### New Mobile Layout

**Structure:** `← Plan` header → Budget Hero → Category List

#### Budget Hero Card
- **Title:** "GASTADO ESTE MES"
- **Main metric:** Percentage (e.g., `914%`) in red when over, green when under
- **Secondary:** `$29.7M de $3.25M`
- **Progress bar:** Single bar showing spend vs budget (capped at 100% width, red when over)
- **Status badge:** "ATENCIÓN" (red) or "En control" (green)
- **Distribution row:** "Necesario 34% · Deseos 66%"

This is the budget hero that currently lives on the Plan page — it moves here where it belongs.

#### Category List
Vertical list with each category showing:
- Icon + name (left)
- Amount / budget + mini progress bar (right)
- Warning icon (⚠) for over-budget categories
- Sorted: over-budget first, then by spend descending

---

## 4. Recurrentes (`/plan?tab=recurrentes`)

### Current Problems
- Calendar view has cramped payment rows (name + amount + button overlap)
- Not touch-friendly at 390px

### New Mobile Layout

**Structure:** `← Plan` header → Hero Card → Upcoming List → Completed List

#### Hero Card (informational, no progress bar)
- **Title:** "COMPROMISO MENSUAL"
- **Main metric:** Total monthly commitment (e.g., `$2.025.526`)
- **Subtitle:** "8 plantillas activas"
- **Divider**
- **Three-column row:** Pendientes (count, amber) | Completados (count, green) | Próximo (name + date)

No calendar on mobile. The calendar is a desktop-only view. Mobile gets a chronological list.

#### Upcoming List ("PRÓXIMOS")
Each row: name, date + account, amount (red), "Confirmar" button (brass pill). Sorted by date ascending.

#### Completed List ("COMPLETADOS")
Dimmed rows with checkmark + amount in green. Collapsed by default if >3 items.

---

## 5. Periodo (`/plan?tab=periodo`)

### Current Problems
- "Disponible" label truncated to "Dispo..." on income cards
- No clear hierarchy between income and expense sections

### New Mobile Layout

**Structure:** `← Plan` header → Chart Hero → Period Summary Bar → Income Cards → Expense List

#### Chart Hero
The Flujo del Mes chart is always visible as the hero — not collapsed. It provides the visual context for "where am I in the month" since Periodo is about allocating income to expenses across the period.

Touch interaction: tapping the chart enters **chart focus mode** for scrubbing daily details.

Below the chart: Ingresos / Gastos / Neto totals in a row.

#### Period Summary Bar
Compact bar: "01 abr — 30 abr 2026" with "100% asignado" badge. Shows the active period at a glance.

#### Income Cards
Each income source as a card:
- Name + amount (right-aligned)
- Date + account (subtitle)
- Assignment progress bar (full width)
- **"Disponible: $X"** — full label, never truncated (the whole reason this page needs a mobile view)

#### Expense List ("GASTOS PENDIENTES")
Clean list with name, date + account, and "Pendiente" badge. No cards needed — just rows with proper spacing.

---

## 6. Additional Mobile Fixes (brief treatment)

### Landing Page (`/`)
**Problem:** Hero headline text overflows right edge at 390px. Marquee banner clips.
**Fix:** Add responsive font sizing to the hero section. The headline currently uses a fixed large `text-5xl` or similar — reduce to `text-3xl` or `text-2xl` on mobile via `text-3xl lg:text-5xl`. Ensure the marquee/banner container has `overflow-hidden` and text wraps properly. Check all sections below the fold for similar overflow (most are fine based on audit).

### Settings (`/settings`)
**Problem:** Horizontal profile info cards ("PERFIL ACTIVO", "CORREO", "MIEMBRO DESDE") overflow at 390px. Email truncated, date clipped.
**Fix:** Stack the cards vertically on mobile. Change the grid from `grid-cols-3` to `grid-cols-1 lg:grid-cols-3`. Each card becomes a full-width row showing the label and value. This is a CSS-only fix — no component restructuring needed.

### Accounts (`/accounts`)
**Problem:** Badge text ("Tarjeta") clips on narrow cards. "Ver detalle >" links are small tap targets.
**Fix:** Ensure badge text uses `truncate` with `max-w` or wraps to a second line. Increase tap target for "Ver detalle" — make the entire card row tappable (wrap in a link or add `onClick` to the card container) instead of relying on the small text link. Minimum touch target: 44px height.

### Transactions List (`/transactions`)
**Problem:** Bottom nav overlaps last transaction rows.
**Fix:** Already has `pb-20` pattern from other pages — verify it's applied to the scrollable container. This is likely a missing padding fix, not a redesign. The list layout itself works fine on mobile.

---

## 7. Auth Error i18n (already fixed)

Login error "Invalid login credentials" was in English. Added `translateAuthError()` map in `actions/auth.ts` to translate common Supabase auth errors to Spanish. Applied to all `signIn`, `signUp`, `resetPasswordRequest`, and `updatePassword` actions.

---

## Data Requirements

### Plan Hub Hero
- **Net amount:** `ingresos - gastos` for the current month (from existing `getMonthlyCashflowCached()`)
- **Próximo ingreso:** Next upcoming income from `recurring_transactions` where type is income-like and `next_occurrence_date > today`, ordered by date. Falls back to periodo income assignments if no recurring match.
- **Próximo pago:** Same logic but for outflow/payment recurring entries.
- **Upcoming income/payment lists:** All recurring entries for the current month, separated by direction. Data comes from the same server action that feeds the Recurrentes page.
- **Stacked bar proportions:** `gastos / ingresos` ratio

### Recurrentes Hero
- **Monthly commitment:** Sum of all active recurring `amount` values
- **Pending/completed counts:** Count of recurring entries for current month by confirmed status

### Periodo Chart Hero
- Reuses the existing Flujo del Mes chart component and data — no new data fetching needed

---

## Component Architecture

### New Components
- `MobilePlanHub` — the Plan hub mobile view (lg:hidden wrapper)
- `MobilePlanHero` — net hero card with stacked bar, expandable chart
- `MobileExpandableChips` — 2-chip grid with expand/collapse income/payment lists
- `MobilePlanDrillCards` — drill-down card list
- `MobilePresupuestoView` — budget hero + category list
- `MobileRecurrentesView` — hero card + upcoming/completed lists
- `MobilePeriodoView` — chart hero + period bar + income cards + expense list
- `useChartFocusMode` — hook for scroll lock + overlay when chart is expanded

### Existing Components Reused
- `MobileHeader` — sticky header with back arrow
- `MobileTabBar` — bottom navigation (unchanged)
- Flujo del Mes chart (Recharts) — reused as-is, just placed in new containers
- Budget category rows — extracted from current desktop presupuesto view

### Pattern
All new mobile components follow the established `lg:hidden` / `hidden lg:block` pattern. The desktop views remain completely unchanged. Each page's `page.tsx` renders both branches.

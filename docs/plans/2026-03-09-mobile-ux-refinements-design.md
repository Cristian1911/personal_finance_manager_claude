# Mobile UX Refinements Design

**Date:** 2026-03-09
**Branch:** feat/mobile-ux-rebuild

## Overview

Three UX improvements identified during testing of the webapp mobile experience.

## 1. Tappable Recurring Payment Rows

**Problem:** Only the small "Confirmar ▸" button toggles the confirm form. On mobile, the entire row should be a tap target.

**Solution:** Move the `onClick` handler from the button to the row container `<div>`. Keep the "Confirmar ▸" button as a visual affordance (shows the action is available) but make the whole row respond to tap/click.

**Files:** `webapp/src/components/recurring/recurring-payment-timeline.tsx`

## 2. Presupuesto Shows All Outflow Categories

**Problem:** `MobilePresupuesto` filters to `budget !== null && budget > 0`, hiding categories without a budget. Users lose visibility into spending in those categories.

**Solution:** Split into two sections:

- **Con presupuesto** — Categories with active budgets. Shows progress bar + spent/budget amounts (current behavior).
- **Sin presupuesto** — Categories without a budget that have spending this month. Shows category icon + name + spent amount. No progress bar. Provides visibility into unbudgeted spending.

Categories with no budget AND no spending are omitted (nothing to show).

**Files:** `webapp/src/components/mobile/mobile-presupuesto.tsx`

## 3. Context-Aware FAB

**Problem:** FAB always shows the same 3 actions (Gasto, Ingreso, Transferencia) regardless of current page.

**Solution:** FAB prepends a contextual primary action on pages that have a natural "create" flow. Default transaction actions remain available below.

### Route → Action Map

| Route | Contextual action | Icon | Color |
|-------|------------------|------|-------|
| `/recurrentes` | "Nuevo recurrente" | CalendarPlus | purple-500 |
| `/accounts` | "Nueva cuenta" | Landmark | cyan-500 |
| All other pages | — (defaults only) | — | — |

### Technical Approach

- `MobileSheetProvider` reads `usePathname()` to determine current route
- Computes contextual actions array based on route match
- Passes `contextActions` prop to `FabMenu` alongside existing `onAction`
- `FabMenu` renders contextual actions first (visually distinct), then the 3 defaults
- Contextual actions open their own sheet content (recurring form, account form) instead of the transaction form
- New `FabAction` union type expanded: `"expense" | "income" | "transfer" | "new-recurring" | "new-account"`

**Files:**
- `webapp/src/components/mobile/fab-menu.tsx` — accept + render contextual actions
- `webapp/src/components/mobile/mobile-sheet-provider.tsx` — route detection + sheet content routing

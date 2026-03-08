# Mobile Responsiveness + Recurring Page Redesign

**Date:** 2026-03-08
**Status:** Approved
**Priority pages:** Dashboard, Recurrentes, Import

## Context

The webapp is nearly unusable on mobile. Key issues identified via Playwright screenshots (375px viewport):

- Missing viewport meta tag — browsers may default to desktop rendering
- Calendar grid (7 cols) is illegible on mobile
- Payment checklist is a wall of inputs with no visual hierarchy
- One-click payment confirmation is scary (no undo)
- Hardcoded pixel widths overflow on small screens
- Form grids don't collapse to single column
- Transaction filters and table are cramped

## 1. Global Responsiveness Fixes

**Viewport meta:** Add proper viewport metadata to root layout.

**Form grids:** Convert all `grid-cols-2` to `grid-cols-1 sm:grid-cols-2` across:
- specialized-account-form.tsx (6 instances)
- transaction-form.tsx (2 instances)
- recurring-form.tsx (3 instances)
- recurring-calendar-checklist.tsx
- category-form-modal.tsx
- transaction detail page

**Fixed widths:** Replace `w-[Npx]` with `w-full sm:w-[Npx]` or remove:
- inbox-transaction-row.tsx: `w-[240px]`
- bulk-action-bar.tsx: `w-[240px]`
- transaction-filters.tsx: `w-[180px]`, `w-[140px]`, `w-[160px]`, `w-[130px]`

**Header layouts:** Add `flex-wrap gap-2` to flex rows that contain title + actions:
- dashboard page header
- account detail header
- transaction detail header

**Month selector:** Reduce `min-w-[160px]` to `min-w-[120px] sm:min-w-[160px]`.

## 2. Dashboard (mobile)

**Hero cards:** Change `grid-cols-3` to `grid-cols-1 sm:grid-cols-3`. On mobile, show as compact horizontal rows (icon + label + value inline) instead of stacked cards.

## 3. Recurring Page Redesign (main feature)

Replace the current calendar-grid + checklist with a **timeline-first** layout.

### Layout (top to bottom)

**a) Summary bar** — Single compact line:
```
$2.229.900 en fijos · 3 pendientes · 1 completado
```
Plus the "Nueva recurrente" button.

**b) Mini calendar** — Compact month overview with colored dots on day numbers. No tall cells. Clicking a day filters the timeline to that date. Serves as navigation, not the primary view.

**c) Payment timeline** — Vertical list grouped by date. Each item is a compact row:
```
[category-icon] Netflix · 28 mar · VISA ****7022    $29.900  [Confirmar ▸]
```
- Past unpaid items float to the top with subtle warning styling
- Today's items highlighted
- Future items shown in muted style

**d) Confirm flow** — Two-step confirmation:
1. Tap "Confirmar" → row expands inline (desktop) or opens bottom sheet (mobile)
2. Shows pre-filled amount + date, with "Confirmar pago" (primary) and "Cancelar" buttons
3. After confirming: 5-second undo toast before the action is final

**e) Completed section** — Collapsed accordion: "3 pagos completados este mes". Green-tinted when expanded. Separated from pending items.

### Why this is better
- **Less visual clutter**: Compact rows vs. full cards with multiple inputs
- **Safer**: Two-step confirm + undo vs. one-click irreversible
- **Mobile-first**: Vertical timeline works naturally on narrow screens
- **Calendar preserved**: As navigation aid, not the main interaction surface

## 4. Transactions Page (mobile)

**Filters:** On mobile (< 640px), collapse filter row into a single "Filtros" button that opens a sheet/popover with all filter controls stacked vertically.

**Table → Cards:** On mobile, render transactions as card layout instead of table rows. Each card shows: date, description, amount, category badge.

## 5. Future Task: Contrast Card Design Language

The blue `sugerencias para obligaciones` card in the recurring form introduces welcome visual contrast against the app's dark/neutral palette. Explore applying this pattern (colored accent cards with distinct backgrounds) to:
- Contextual tips and suggestions
- Warning states
- Onboarding hints
- Empty states

Track as a design exploration task — not part of this implementation.

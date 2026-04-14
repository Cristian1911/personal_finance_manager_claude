# Recurring Manager — Mobile Redesign

**Date:** 2026-04-14
**Status:** Draft
**Scope:** New top-level `/recurrentes` route — complete redesign from payment checklist to recurring template manager (mobile)

## Problem

The mobile recurring page is a flat list of pending/completed occurrences. It answers "what's due this month?" but doesn't let users manage their recurring obligations: no visible create button, no template overview, no financial context (yearly cost, history), and a critical layering bug where edit/pause/delete dialogs render behind the action sheet (z-50 behind z-[10000]).

## Design Decisions

All decisions validated through visual companion mockups during brainstorming.

### Routing

Recurring becomes a **top-level route**: `/recurrentes`, `/recurrentes/new`, `/recurrentes/[id]/edit`.

The Plan page's "Recurrentes" card becomes a navigation link to `/recurrentes` (same pattern as Plan → Accounts, Plan → Deudas).

**Back button behavior:** `router.back()` everywhere. Natural browser history handles the chain:
- Plan → `/recurrentes` → back → Plan
- `/recurrentes` → `/recurrentes/new` → back → `/recurrentes`
- `/recurrentes` → `/recurrentes/[id]/edit` → back → `/recurrentes`
- Deep-linked `/recurrentes` with no history → fallback to `/plan`

### Page Structure (top to bottom)

1. **Header** — "Recurrentes" + back arrow (`router.back()`) + profile avatar (existing pattern)
2. **Compact Hero** — proportion bar (red-to-green) showing gastos vs ingresos ratio. Three numbers: gastos total | net balance | ingresos total. Green net = positive, red = negative.
3. **Month navigation** — chevrons + month label (existing pattern, reused)
4. **Segmented control** — "Gastos" / "Ingresos" tabs. Tap or swipe to switch. Active tab shows accent color (brass for gastos, green for ingresos).
5. **Timeline** — vertical timeline grouped by date, one tab visible at a time
6. **Create button** — "+ Nuevo gasto recurrente" or "+ Nuevo ingreso" (contextual to active tab). Navigates to `/recurrentes/new`.

### Timeline Design

- Vertical line on the left with status-colored dots at each date group
- **Status dots:**
  - Filled red + glow → overdue (past due date, not paid)
  - Filled amber + glow → due today
  - Hollow gray → future
  - Filled green → paid/received
  - Dashed hollow → paused templates section
- **Template cards** at each date: name, account info, amount, frequency label, yearly cost estimate
- **Light status hint** — small indicator on each card showing if this month's occurrence is paid/pending. Read-only context, no confirm/skip actions (those stay on the Plan page).
- **One-time payments** distinguished by: square dot (not circle), dashed border, "UNA VEZ" badge
- **Paused templates** collected at timeline bottom: dashed border, dimmed opacity, "Pausado desde [date]"
- Templates sorted: active by next date ascending, paused at bottom

### Expanded View (tap a template card)

Expands inline on the timeline. Only one expanded at a time.

**Instant (no fetch):**
- Header: name, account, amount (larger), frequency
- Action buttons: Edit / Pause / Delete (expense), Edit / Delete (income), Edit / Mark Paid / Delete (one-time)

**Lazy loaded (skeleton → data):**
- Stats chips (fixed height, no layout shift): year-to-date total, annual estimate, payment streak
- Stats fetched via server action on expand

**Varies by type:**
| Type | Stats | Actions |
|------|-------|---------|
| Recurring expense | YTD, annual est., streak | Edit, Pause, Delete |
| Recurring income | YTD, annual est., streak + "Consistente ✓" if stable | Edit, Delete |
| One-time payment | % of monthly income, remaining margin after payment | Edit, Mark Paid, Delete |

**Graph (6-month bar chart) deferred** — can be added later as enhancement inside expanded view.

### Create & Edit Flow

Both use **full page routes**:
- Create: `/recurrentes/new` — reuses `RecurringForm` component
- Edit: `/recurrentes/[id]/edit` — same `RecurringForm` with template data pre-filled

Avoids all z-index layering issues. Consistent pattern. Most space for the 8-field form.

### Dialog Layering Fix (Pause/Delete)

Current bug: `TemplateActionSheet` (Sheet z-[10000]) nests `RecurringImpactDialog` (AlertDialog z-50). Dialog renders behind sheet.

Fix: sequential overlay pattern. When user taps Pause/Delete in the action sheet:
1. Close the Sheet
2. Wait for close animation (350ms)
3. Open `RecurringImpactDialog` as controlled AlertDialog (at page level, outside Sheet)

For Edit: Sheet closes → navigate to `/recurrentes/[id]/edit`. No overlay needed.

## Data Model Changes

### New frequency value: `ONCE`

Add `ONCE` to the `recurring_frequency` enum in Supabase. A template with `frequency = 'ONCE'` generates exactly one occurrence, then the template auto-deactivates (`is_active = false`) after the occurrence is paid/skipped.

**Migration:** `ALTER TYPE recurring_frequency ADD VALUE 'ONCE';`

**Occurrence generation:** `ensureCurrentOccurrences()` generates a single occurrence at `start_date` for `ONCE` templates. No recurrence calculation needed.

**Form changes:** Add "Una vez" option to frequency select. When selected, hide end_date field (irrelevant).

### Template stats server action

New server action: `getTemplateStats(templateId)` → returns:
```typescript
{
  ytdTotal: number;        // sum of paid occurrences this calendar year
  annualEstimate: number;  // amount × frequency multiplier (or ytdTotal for ONCE)
  streak: number;          // consecutive months with a paid occurrence
  impactPercent?: number;  // for ONCE: amount / monthly income × 100
  marginAfter?: number;    // for ONCE: monthly income - monthly expenses - amount
}
```

Fetched on expand, not on page load.

## Components

### New
- `MobileRecurringManager` — top-level page component. Contains hero, segmented control, timeline, expanded views.
- `RecurringTimeline` — the timeline rendering (dots, date groups, template cards)
- `RecurringTemplateCard` — collapsed and expanded states for a single template
- `RecurringHeroCompact` — the proportion bar hero
- `/recurrentes/page.tsx` — route entry point (server component, fetches data)
- `/recurrentes/new/page.tsx` — create form page
- `/recurrentes/[id]/edit/page.tsx` — edit form page

### Reused
- `RecurringForm` (`recurring-form.tsx`) — the form itself, used in create and edit pages
- `RecurringImpactDialog` (`recurring-impact-dialog.tsx`) — extended with optional controlled mode
- `useRecurringMonth` hook — existing occurrence data, adapted for timeline grouping
- `MOBILE_TAB_BAR_CLEARANCE_CLASS`, `PANEL_INSET_CLASS`, `HERO_CARD_GRADIENT_CLASS` — existing style constants
- `formatCurrency`, `formatDate` — existing utilities

### Modified
- `RecurringImpactDialog` — add optional `open`/`onOpenChange` props for controlled mode (backward-compatible)
- `recurring_frequency` enum — add `ONCE` value
- `ensureCurrentOccurrences()` — handle `ONCE` frequency
- `RecurringForm` — add "Una vez" frequency option, conditional end_date visibility
- Plan page "Recurrentes" card — change from tab switch to navigation link to `/recurrentes`

## What's NOT in scope

- 6-month payment history bar chart (deferred enhancement)
- Calendar view overlay (future addition on top of timeline)
- Desktop changes (desktop recurring list stays as-is)
- Checklist/confirm payment flow (stays in monthly plan tab)
- Tags on recurring templates (separate backlog item)
- Swipe gesture for tab switching (tap first, swipe as enhancement)

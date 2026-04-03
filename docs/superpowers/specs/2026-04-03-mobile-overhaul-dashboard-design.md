# Mobile Overhaul — Dashboard Redesign (Sub-project 1/6)

## Context

Zeta's mobile dashboard currently works but reads like a responsive copy of the desktop view — too much information, not enough direction. This redesign makes the mobile dashboard **action-oriented** and **glanceable**, using compact visuals (progress rings, gradient bars, gauges) as the primary communication layer.

This is the first of six sub-projects in a full mobile overhaul:

1. **Dashboard** (this spec)
2. Budget Wizard (onboarding)
3. Design system extraction (consolidate patterns from 1 & 2)
4. Transactions
5. Debt
6. Accounts & Settings

## Design Principles

- **Visuals lead, text supports** — progress rings, gradient bars, and gauges communicate at a glance. Text provides context, not the primary data.
- **Tap = preview, never navigate** — every card expands inline to show more context + a clear CTA button ("Ir a..."). The user decides when to leave the dashboard.
- **Action priority: record > respond > plan** — the FAB handles recording, the alert card handles responding, the budget/spending cards handle planning.
- **No noise** — if something has nothing to show (e.g., no alerts), it disappears. No placeholder content.

## Navigation (Unchanged)

The existing navigation skeleton stays:

- **Bottom tab bar** — 5 items, fixed, keyboard-aware
- **FAB** (floating action button) — quick transaction entry via drawer
- **Mobile topbar** — greeting + avatar, sticky, 56px height

No structural changes to navigation. Only the dashboard content area is redesigned.

## Card Hierarchy

Six cards in a vertical stack. Cards 1-5 are above the fold on a standard phone (~456px usable content area on iPhone 14). Card 6 is below the fold.

### Card 1: Alert (Conditional)

**Purpose:** Surface the single most urgent action the user needs to take.

**Compact state:**
- Icon (contextual) + one-line description + chevron
- Background: subtle amber gradient border
- Color-coded by severity

**Tap → Expand:**
- Shows more detail about the alert (amounts, dates, context)
- CTA button: "Ir a [relevant page] ›"

**Priority logic (highest → lowest):**
1. Overdue bill (red) — shows amount, account, days overdue
2. Stale balance (amber) — account name, days since last update
3. Uncategorized transactions (amber) — count + estimated total
4. Budget category overspend (sage) — category name, amount over

**Empty state:** Card is hidden entirely. No "Todo al día" card (future enhancement: brief animation before disappearing).

**Only shows the single highest-priority alert.** If multiple alerts exist, show the top one. The alert card is NOT a notification list.

### Card 2: Hero — Disponible para Gastar

**Purpose:** Answer "how much can I spend?" — the single most important number on the dashboard.

**Compact state:**
- Label: "DISPONIBLE PARA GASTAR" (uppercase, small, muted)
- Big number: the available amount (e.g., $56,800), bold, largest text on screen
- Contextual subtitle: human-readable spending capacity (e.g., "Compras pequeñas ✓")
- Three stat chips below: Saldo | Fijos | Prox. pago — each in a rounded pill

**Tap interactions (three independent zones):**

1. **Tap the hero number/label area** → Expands to show the math breakdown:
   - Saldo total: $X
   - − Gastos fijos: $X
   - − Ya gastado: $X
   - = Disponible: $X (matches hero number)
   - CTA: "Ver cuentas ›"

2. **Tap "Saldo" chip** → Expands to show per-account balances (account name + balance, one line each)

3. **Tap "Fijos" chip** → Expands to show fixed expenses list (name + amount, one line each, total at bottom)

4. **Tap "Prox." chip** → Expands to show next payment detail (name, amount, date, account)

**Only one section expanded at a time.** Tapping a different zone collapses the current expansion and opens the new one.

**Contextual subtitle logic:**
- Available > 500,000 → "Buen margen este período"
- Available > 100,000 → "Margen moderado"
- Available > 0 → "Compras pequeñas ✓"
- Available ≤ 0 → "Sin margen — revisa tus gastos" (debt color)

Thresholds are examples — actual values should be calibrated to the user's typical spending patterns. For v1, use fixed thresholds. Future: derive from user's average transaction size.

### Card 3: Ritmo de Gasto (Spending Pace)

**Purpose:** Answer "am I spending too fast?" with a visual projection.

**Compact state:**
- Title: "Ritmo de gasto" + "X días" (days left at current pace) — left/right aligned
- Gradient progress bar: starts sage/amber, transitions to red as pace worsens
- Subtitle: "Día X de 30"

**Tap → Expand:**
- **Runway chart** (SVG): ideal spending line (dashed, sage) vs actual spending curve (solid, amber/gold). Current position dot. Projected overshoot (dashed red).
- Actionable insight text: "Si sigues gastando así, te pasas el día 28. Reduce $X/día para llegar al 30."
- CTA: "Ver análisis completo ›"

**The runway chart** uses three visual elements:
1. Dashed line (sage/dark) — ideal linear spending from day 1 to day 30
2. Solid curve (amber/gold) — actual cumulative spending with current position dot
3. Dashed projection (red) — extrapolated trajectory if pace continues

**Tap again or scroll → collapse** back to compact bar.

### Card 4: Presupuesto (Budget)

**Purpose:** Answer "am I on budget?" at a glance.

**Compact state:**
- Progress ring (44px diameter) showing % used — sage fill on dark track
- "Presupuesto" label + "$Xk de $Xk — [status message]"
- Chevron indicating expandability

**Tap → Expand:**
- Same ring + full amounts (not abbreviated)
- Top 3 categories by usage %, each with:
  - Category name + percentage
  - Thin progress bar (color-coded: red >80%, amber >60%, sage ≤60%)
- CTA: "Ir a presupuesto ›"

### Card 5: Próximos Pagos (Upcoming Payments)

**Purpose:** Show what's due soon so the user can act.

**Compact state:**
- Title: "PRÓXIMOS PAGOS" (uppercase, small)
- Max 3 items, each showing: urgency dot + payment name + amount + relative date
- Urgency dots: red (due today/overdue), amber (within 3 days), green (later this period)

**Tap on individual payment → Expand that item:**
- Payment detail: amount, account, frequency
- Two action buttons: "Marcar pagado ✓" (primary) + "Ver detalles ›" (secondary)

**Tap on "Ver todos" link** (if >3 payments exist) → Navigate to recurring payments view. This is the one explicit navigation — clearly labeled.

### Card 6: Últimos Movimientos (Below the Fold)

**Purpose:** Quick glance at recent activity.

**Compact state:**
- Title: "ÚLTIMOS MOVIMIENTOS" + "Ver todos ›" link
- 3 most recent transactions: icon + merchant name + amount
- No category, no date — minimal

**Tap on transaction** → Opens transaction detail as a **bottom sheet** (drawer from bottom). Same sheet component used across the app.

**"Ver todos" link** → Navigates to `/transactions`.

## Data Loading Strategy

The dashboard uses tiered data loading with Suspense boundaries:

**Tier 1 (instant, SSR):**
- Hero card data (account balances, fixed expenses, available calculation)
- Alert card (priority check)
- Upcoming payments

**Tier 2 (streaming, deferred):**
- Spending pace / burn rate calculation
- Budget progress
- Recent transactions

Tier 2 cards show compact skeleton placeholders (matching card dimensions) while loading. Skeletons should match the actual card height to prevent layout shift.

## Component Architecture

New/modified files (all under `webapp/src/components/`):

```
mobile/
  mobile-dashboard-v2.tsx        — New orchestrator (replaces current mobile-dashboard.tsx)
  cards/
    mobile-alert-card.tsx         — Alert card with priority logic
    mobile-hero-card.tsx          — Hero with expandable chips + math
    mobile-spending-pace.tsx      — Compact bar + expandable runway chart
    mobile-budget-ring.tsx        — Progress ring + expandable categories
    mobile-upcoming-payments.tsx  — Payment list with per-item expansion
    mobile-recent-transactions.tsx — Compact list + bottom sheet
  charts/
    runway-chart.tsx              — SVG runway chart (ideal vs actual vs projected)
```

**Reuse from existing codebase:**
- Bottom sheet / drawer pattern (already exists via Vaul)
- Transaction detail sheet (already exists in mobile-movimientos)
- Urgency dot colors (already in the design token system)
- FAB menu (unchanged)
- Bottom tab bar (unchanged)
- Mobile topbar (unchanged)

**The existing `mobile-dashboard.tsx` is replaced, not modified.** The old file stays until the new one is validated, then gets removed.

## Expand/Collapse Animation

All card expansions use the same animation:
- **Expand:** height auto-animate (CSS `grid-template-rows: 0fr → 1fr` pattern or Framer Motion `AnimatePresence`), 200ms ease-out
- **Collapse:** reverse, 150ms ease-in
- **Content fade:** opacity 0 → 1 on expand, staggered 50ms after height animation starts

No spring physics, no bounces. Quick and direct — matches the "speed over animation" principle.

## Interaction States

| Gesture | Behavior |
|---------|----------|
| Tap card | Expand inline (or expand the specific chip/item tapped) |
| Tap expanded card | Collapse |
| Tap different card while one is expanded | Both can be expanded simultaneously (independent state per card) |
| Tap different chip within hero | Collapse current chip, expand new one (one chip at a time) |
| Tap CTA button | Navigate to target page |
| Scroll while expanded | Card stays expanded (doesn't auto-collapse on scroll) |
| Pull to refresh | Standard Next.js revalidation via router.refresh() |

## What Gets Removed from Mobile Dashboard

These sections exist in the current mobile dashboard and are **removed**:

| Current section | Disposition |
|----------------|-------------|
| Quick account value updates | Moved to Accounts tab |
| Health meters (4-bar card) | Absorbed into hero chips + spending pace + budget ring |
| Activity heatmap | Desktop only |
| Cash flow chart | Desktop only |
| Wishlist section | Desktop only |
| Impact widgets | Desktop only |
| Reminders section | Absorbed into alert card |
| Plan teaser (full) | Replaced by compact budget ring (card 4) |

## Desktop Dashboard

**No changes.** The desktop dashboard keeps its current layout and sections. The `lg:hidden` / `hidden lg:block` fork pattern continues — the new mobile dashboard is a complete replacement of the mobile branch only.

## Out of Scope

- Budget wizard (sub-project 2)
- Changes to other mobile screens (sub-projects 4-6)
- Mobile design system extraction (sub-project 3 — after this ships)
- "Todo al día" animation for empty alert state (future enhancement)
- Dynamic spending capacity thresholds (future — v1 uses fixed values)
- Navigation changes (tabs, FAB, topbar stay as-is)

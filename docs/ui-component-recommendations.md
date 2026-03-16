# UI Component & Interaction Pattern Recommendations

**Date:** 2026-03-16
**Status:** Proposal — awaiting review
**Scope:** Mobile-first improvements + desktop consistency

---

## Current Stack

- **UI primitives:** shadcn/ui (29 components) — Button, Card, Dialog, Sheet, Popover, Tooltip, Select, Command, etc.
- **Charts:** Recharts (AreaChart, BarChart, PieChart via shadcn ChartContainer)
- **Animations:** framer-motion (^12.34.3) + tw-animate-css — only used in onboarding currently
- **Drag-and-drop:** @dnd-kit (core + sortable) — imported but not actively used
- **Toasts:** sonner (^2.0.7) — configured with custom financial icons
- **Icons:** Lucide React (732+ icons)
- **Forms:** React Hook Form + Zod (via `useActionState` pattern)
- **Currency input:** Custom component with math evaluation support

---

## 1. Navigation & Page Structure

### Bottom Tab Bar (Mobile)
**Current:** 4 static tabs with center FAB gap. No visual feedback beyond active color.
**Recommendation:**
- Add **haptic-style scale animation** on tap (CSS `active:scale-95 transition-transform duration-100`)
- Consider **badge dots** (not just count badges) for tabs that have new content
- The center FAB gap works well — keep it

### Page Transitions
**Current:** No transition between pages. Hard cuts.
**Recommendation:**
- Add `framer-motion` for page-level transitions (fade + slight slide)
- For bottom sheets: already using `animate-in slide-in-from-bottom` — good
- For detail pages (push navigation): add `slide-in-from-right` enter, `slide-out-to-right` exit

### Back Navigation (Mobile)
**Current:** `MobilePageHeader` with back arrow + title. Children slot used for MonthSelector.
**Recommendation:** This pattern works well. Consider making the title tappable to scroll-to-top (common mobile pattern).

---

## 2. Cards & Containers

### Financial Metric Cards
**Current:** shadcn Card with manual padding/layout. Inconsistent across pages.
**Recommendation:**
- Standardize a **`KPIWidget`** component matching the brand handoff spec:
  - `bg-z-surface-2`, `rounded-[14px]`, `p-4`
  - Label: 11px, muted
  - Value: 22px, weight 800, foreground
  - Trend: 11px, semantic color (z-income for up, z-debt for down)
- Use across: dashboard hero metrics, debt overview cards, budget summaries

### Status Surface Cards
**Current:** Random bg-muted/bg-primary approaches. Inconsistent.
**Recommendation:**
- Use the new **Status Surface pattern** (added to brand handoff):
  - `surface-income`: `bg-z-income/[0.08] border-z-income/20 text-z-income`
  - `surface-expense`: `bg-z-expense/[0.08] border-z-expense/20 text-z-expense`
  - `surface-debt`: `bg-z-debt/[0.08] border-z-debt/20 text-z-debt`
  - `surface-alert`: `bg-z-alert/[0.08] border-z-alert/20 text-z-alert`
- Apply to: insight cards, timeline date groups, CTA callouts, import results

### Card Interaction
**Current:** Static cards with no tap feedback.
**Recommendation:**
- Tappable cards: `active:scale-[0.98] transition-transform duration-100`
- Hover (desktop): `hover:brightness-105 transition-[filter] duration-150`
- Consider `motion.div` (framer-motion) for swipe-to-action cards (mark paid, dismiss)

---

## 3. Charts & Data Visualization

### Chart Library
**Current:** Recharts via shadcn `ChartContainer`. Works well for basic charts.
**Recommendation:** Keep Recharts for now. If richer mobile interactions are needed later (pinch-to-zoom, pan, touch tooltips), consider migrating to **Nivo** or **visx** which have better touch support.

### Chart Tooltips
**Current:** shadcn `ChartTooltipContent` — basic label + value.
**Recommendation:**
- Keep the shadcn tooltip wrapper
- For mobile: increase tooltip padding and font size (touch targets need 44px minimum)
- Add a **vertical reference line** on hover/touch that follows the cursor
- Consider a **persistent tooltip** on mobile (last touched point stays visible) since hover doesn't exist

### Chart Color Convention
**Recommendation:** Always use CSS variables, never hardcoded hex:
```
Income line:  stroke="var(--z-income)"
Expense line: stroke="var(--z-expense)"
Projected:    strokeDasharray="4 3" (dashed)
Fill:         gradient from 40% to 5% opacity
```

### Sparklines
**Current:** Custom SVG sparklines in dashboard cards.
**Recommendation:** Keep these — they're lightweight and effective. Ensure they use brand color tokens.

---

## 4. Tooltips, Popovers & Menus

### Tooltips
**Current:** Radix Tooltip (shadcn) with arrow.
**Recommendation:**
- Keep for desktop hover interactions
- On mobile (touch devices): **replace with Popover** — tooltips don't work well with touch since there's no hover
- Detection: use `@media (pointer: fine)` for tooltip, `@media (pointer: coarse)` for popover fallback
- Or simply use Popover everywhere (click-to-show works on both)

### Dropdown Menus
**Current:** Radix Select for form selects, DropdownMenu for actions.
**Recommendation:**
- Desktop: keep current Radix components
- Mobile: for action menus, prefer **bottom sheets** over dropdown menus (thumb-reachable, more space)
- The FAB bottom sheet pattern is good — extend it for context menus on transaction rows, account cards, etc.

### Bottom Sheets
**Current:** Custom bottom sheet in FAB menu. No reusable component.
**Recommendation:**
- Extract a reusable `BottomSheet` component from the FAB menu implementation
- Or adopt **vaul** (`vaul` by emilkowalski) — a drawer component designed for mobile with:
  - Drag-to-dismiss gesture
  - Snap points (half-height, full-height)
  - Nested scrolling support
  - Already built for Radix/shadcn ecosystem
- Use for: transaction details, confirm dialogs, filters, forms on mobile

---

## 5. Buttons & Actions

### Button Styles
**Current:** shadcn Button with variants: default, outline, ghost, secondary, destructive.
**Recommendation:**
- Primary actions: `default` variant (sage bg, ink text) — keep
- Secondary actions: `outline` or `ghost` — keep
- Financial actions: consider a **semantic button** pattern:
  - "Confirmar pago" → green tint: `bg-z-income/10 text-z-income border-z-income/20 hover:bg-z-income/20`
  - "Eliminar" → red tint: `bg-z-debt/10 text-z-debt border-z-debt/20`
- **Mobile button sizing:** all tappable buttons should be minimum 44px height on mobile. Currently some use `size="sm"` which may be too small.

### FAB (Floating Action Button)
**Current:** Center-bottom FAB, opens bottom sheet with primary actions.
**Recommendation:**
- Current pattern (FAB + bottom sheet) is good
- The FAB could show a **subtle pulse animation** on first visit to draw attention
- Consider adding a **long-press** gesture on FAB to show a quick-action radial menu (advanced — phase 2)

### Swipe Actions (NEW)
**Current:** No swipe gestures anywhere.
**Recommendation:**
- For transaction rows: **swipe-left to categorize**, **swipe-right to mark reviewed**
- For recurring payment items: **swipe-right to confirm payment**
- Implementation: use `framer-motion` drag gesture or `@use-gesture/react`
- This is a major mobile UX improvement — transactions become much faster to process

---

## 6. Forms & Input

### Form Layout
**Current:** Full-page forms or bottom sheet forms. `useActionState` pattern with Zod validation.
**Recommendation:**
- Keep the server action pattern
- For mobile: prefer **bottom sheet forms** for quick inputs (amount, date, category)
- For complex forms (new account, import settings): keep full-page
- Add **auto-focus** on first input when sheet opens

### Amount Input
**Current:** Standard number input.
**Recommendation:**
- Consider a **large-format amount input** for mobile:
  - Big centered numbers (32px+)
  - Currency prefix inline
  - Numpad-optimized (`inputMode="decimal"`)
- This is the most common input in a finance app — make it feel premium

### Date/Month Pickers
**Current:** Native `<input type="month">` in cash step, custom `MonthSelector` for page-level.
**Recommendation:**
- Page-level: keep `MonthSelector` (prev/label/next pattern) — it works well
- For forms: consider a **scrollable month wheel** (iOS-style) instead of native input
- Or keep native for now but ensure consistent styling

---

## 7. Loading & Empty States

### Skeleton Loading
**Current:** No consistent skeleton pattern found.
**Recommendation:**
- Create a `Skeleton` component (shadcn has one) with Zeta branding:
  - Base: `bg-z-surface-2`
  - Shimmer: subtle pulse using `animate-pulse` (already in Tailwind)
  - Match the shape of the component it replaces (rounded cards, text blocks)
- Apply to: dashboard cards, transaction lists, charts

### Empty States
**Current:** Simple text messages.
**Recommendation (from brand handoff):**
- Show the Z motif at 0.05 opacity as background
- Single line of sage-colored text
- **Always include a CTA** — "Importa tu primer extracto", "Agrega una cuenta"
- Never show raw "No data"

---

## 8. Mobile-Specific Patterns

### Pull-to-Refresh
**Current:** Not implemented.
**Recommendation:**
- Add pull-to-refresh on main data pages (dashboard, transactions, budget)
- Use `next-pwa` or a custom implementation with `touch` events
- Animation: Z motif spinner or circular progress

### Gesture Navigation
**Current:** No gesture support.
**Recommendation (phased):**
- **Phase 1:** Swipe actions on list items (transactions, recurring)
- **Phase 2:** Swipe between tabs (dashboard sections)
- **Phase 3:** Long-press context menus on cards
- Library: `@use-gesture/react` + `framer-motion`

### Haptic Feedback (PWA)
**Current:** No haptic feedback.
**Recommendation:**
- Use `navigator.vibrate()` (Android) for:
  - Confirming a payment
  - Completing an import
  - Categorizing a transaction
- Subtle, not aggressive — 10ms pulse

### Safe Areas
**Current:** `env(safe-area-inset-bottom)` used in FAB and tab bar.
**Recommendation:** Audit all fixed-position elements for safe area handling. Bottom sheets, modals, and sticky headers should all respect notch/home indicator areas.

---

## 9. Library Status & Proposed Additions

### Already Installed (use more!)
| Library | Purpose | Current Usage |
|---------|---------|---------------|
| `framer-motion` (^12.34.3) | Animations + gestures | Only used in onboarding. Should be used for page transitions, swipe actions, card animations |
| `sonner` (^2.0.7) | Toast notifications | Already configured with custom icons. Underused — should replace more alert() patterns |
| `@dnd-kit` (core + sortable) | Drag-and-drop | Imported but not found in active use. Ready for reorder features |
| `cmdk` (^1.1.1) | Command palette | Available but underused — could power a global search |

### Proposed Additions
| Library | Purpose | Size | Priority |
|---------|---------|------|----------|
| `vaul` | Drawer/bottom sheet with drag gestures | ~5KB | High — replaces custom bottom sheet code, adds snap points |
| `@use-gesture/react` | Touch gesture recognition | ~8KB | Medium — swipe-to-action on list items |

---

## 10. Priority Order

1. **Brand color standardization** (in progress) — immediate visual improvement everywhere
2. **Bottom sheet extraction** (vaul) — foundation for better mobile forms/menus
3. **Swipe actions on transactions/recurring** — biggest mobile UX win
4. **KPIWidget standardization** — consistent dashboard metrics
5. **Page transitions** — polish and feel
6. **Pull-to-refresh** — expected mobile behavior
7. **Large amount input** — premium feel for core interaction

---

## Decision Needed

- **vaul vs custom bottom sheet:** vaul gives us drag gestures, snap points, and nested scroll for free. Worth the 5KB?
- **framer-motion:** powerful but 32KB. Could use CSS animations for most things and only add framer for swipe gestures. Worth it?
- **Swipe actions scope:** start with recurring payments (confirm on swipe) or transactions (categorize on swipe)?

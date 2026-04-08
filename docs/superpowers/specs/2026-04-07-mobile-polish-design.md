# Mobile Polish — Design Spec

**Date:** 2026-04-07
**Scope:** 4 mobile fixes bundled into one implementation pass
**Approach:** Mobile extraction for Categorizar (new component), inline CSS/responsive fixes for the other 3

---

## 1. Categorizar — Mobile Redesign (P0)

### Problem
`category-inbox.tsx` (774 lines) is a desktop table with checkboxes, inline suggestion pills, and expandable confirmation panels. Unusable on mobile — no card layout, no touch-optimized interactions.

### Solution
New `mobile-category-inbox.tsx` component rendered on mobile (`lg:hidden`), existing component kept for desktop (`hidden lg:block`). Both receive the same props from `categorizar/page.tsx`.

### Mobile Layout (top to bottom)

1. **MobileHeader** (sub variant) — "Categorizar" + back button (already exists in page)
2. **Stats strip** — "24 sin categoría · 8 auto-categorizadas" as tappable filter pills that toggle active tab
3. **Card feed** — Scrollable list of rich transaction cards, grouped by date with sticky date headers
4. **Floating bulk bar** — Appears when multi-select active (reuses `bulk-action-bar.tsx` pattern)

### Transaction Card (rich, two-line)

```
┌─────────────────────────────────────┐
│ ○  Rappi                    -$45,200│
│    Bancolombia · 3 abr    💡Delivery│
└─────────────────────────────────────┘
```

- **Left:** checkbox + merchant name (line 1), account colored dot + date + suggestion chip (line 2)
- **Right:** amount, colored by direction (OUTFLOW: red, INFLOW: green)
- **Merchant name:** 3-field fallback: `merchant_name` → `clean_description` → `raw_description` (same as desktop)
- **Suggestion chip:** yellow pill with lightbulb icon, shows auto-categorize suggestion when available
- **Tap card** → opens category action sheet (Drawer)
- **Long-press** → enters multi-select mode (checkboxes become active)

### Action Sheet (Drawer from bottom)

Opens when user taps a transaction card. Uses shadcn `Drawer` component (vaul).

Contents (top to bottom):
1. **Transaction summary** — merchant name, account + date, amount
2. **Category picker grid** — 3-column grid of parent categories (from the same category tree used by desktop `CategoryInbox`). Tap parent → expands to show subcategories inline below the grid. Suggested category pre-highlighted with brass/gold border.
3. **"Aplicar a N similares" toggle** — shown when merchant group exists (from `extractPattern` utility). Toggle on = batch apply to all matching transactions.
4. **Destinatario suggestion banner** — shown when destinatario match found. "Vincular con [Destinatario]" with accept/dismiss.
5. **Confirm button** — brass/gold CTA at bottom. Applies category, closes drawer, shows success toast.

### Bulk Flow

1. Long-press first card → enters selection mode (all checkboxes become visible/tappable)
2. Tap additional cards to add to selection
3. Floating action bar appears at bottom: "[N] seleccionadas" + "Categorizar" button
4. "Categorizar" button opens same Drawer but applies chosen category to all selected transactions
5. Success toast: "N transacciones categorizadas"

### State Management

- Selection state: local `useState<Set<string>>` for selected transaction IDs
- Tab state: local `useState<"uncategorized" | "auto">` for active filter
- No shared hooks with desktop — independent state management
- Mutations call same server actions as desktop (`categorizeTransaction`, `bulkCategorize`)
- On success: `revalidateTag("categorize")` handles refresh

### Files

| File | Action |
|------|--------|
| `components/categorize/mobile-category-inbox.tsx` | NEW — mobile feed + selection logic |
| `components/categorize/mobile-category-drawer.tsx` | NEW — action sheet with category picker |
| `app/(dashboard)/categorizar/page.tsx` | MODIFY — add `lg:hidden` / `hidden lg:block` split |

---

## 2. Accounts — Badge Clipping Fix

### Problem
`account-card.tsx` header uses `flex justify-between` with type badges and action button on the right. On narrow mobile screens, badges clip outside the card boundary.

### Solution
- Keep type badge (e.g., "Cheques") top-right next to the action button
- Remove "Inicio" (`show_in_dashboard`) badge from the card entirely — it's a settings concern, not a display concern
- Add flex constraints to prevent clipping: `shrink-0` on action button, `min-w-0` on left section, `overflow-hidden` on badge container

### Mobile Layout

```
┌──────────────────────────────┐
│ 🏦 Bancolombia  [Cheques] [⚡]│
│    $2,340,000                │
└──────────────────────────────┘
```

- Type badge and action button stay on the same row as the name
- Name truncates with ellipsis if space is tight
- No layout change between desktop and mobile — just proper flex constraints

### Files

| File | Action |
|------|--------|
| `components/accounts/account-card.tsx` | MODIFY — remove Inicio badge, add flex constraints |

---

## 3. Plan Tab Bar — Bottom List on Mobile

### Problem
`plan-tab-nav.tsx` renders 5 horizontal pills with `shrink-0 whitespace-nowrap`. On mobile screens, tabs overflow and `scrollbar-none` hides the scroll indicator, so users don't know there are more tabs.

### Solution
- **Desktop:** keep current horizontal pill bar (`hidden lg:flex`)
- **Mobile:** hide top pill bar, render a grouped navigation list at the bottom of each tab's content

### Bottom Navigation List

```
─── Más en Plan ───────────────
┌─────────────────────────────┐
│  Presupuesto              → │
│─────────────────────────────│
│  Periodo                  → │
│─────────────────────────────│
│  Recurrentes              → │
│─────────────────────────────│
│  Deseos                   → │
└─────────────────────────────┘
```

- Uses `MCardTight` + `MListRow` pattern from mobile/v2
- Shows all tabs except the currently active one
- Each row is a `Link` to `/plan?tab=<name>`
- Section header: "Más en Plan" (eyebrow style)
- Rendered after tab content, with `lg:hidden`

### Files

| File | Action |
|------|--------|
| `components/plan/plan-mobile-nav-list.tsx` | NEW — ~30 lines, receives current tab, renders remaining tabs as list |
| `components/plan/plan-tab-nav.tsx` | MODIFY — add `hidden lg:flex` to the nav element |
| `app/(dashboard)/plan/page.tsx` | MODIFY — render `PlanMobileNavList` with `lg:hidden` after tab content |

---

## 4. Settings — Accordion on Mobile

### Problem
Settings page now has 6+ sections after Etiquetas was embedded (PR #97). On mobile, this creates an excessively long scroll with no way to jump between sections.

### Solution
- **Desktop:** keep current layout (all sections visible as cards)
- **Mobile:** wrap sections in a Radix `Accordion` (`type="single"`, one open at a time)

### Mobile Layout

```
┌─────────────────────────────┐
│ ▼ Perfil                    │
│   [expanded form content]   │
└─────────────────────────────┘
┌─────────────────────────────┐
│ ▶ Integraciones             │
└─────────────────────────────┘
┌─────────────────────────────┐
│ ▶ Email                     │
└─────────────────────────────┘
┌─────────────────────────────┐
│ ▶ Etiquetas                 │
└─────────────────────────────┘
┌─────────────────────────────┐
│ ▶ Reportar bug              │
└─────────────────────────────┘
```

- First section (Perfil) expanded by default via `defaultValue`
- Accordion trigger styled to match existing card headers
- Content inside each item is the existing component, just wrapped
- Smooth open/close animation from Radix
- Desktop: sections render as normal cards (no accordion wrapper)

### Implementation

Use responsive rendering: on mobile (`lg:hidden`), render all sections inside `<Accordion type="single" defaultValue="perfil">`. On desktop (`hidden lg:block`), render the same sections without accordion wrapping. Share section content via a helper that returns the inner JSX.

### Files

| File | Action |
|------|--------|
| `app/(dashboard)/settings/page.tsx` | MODIFY — add mobile accordion wrapper with `lg:hidden` / `hidden lg:block` split |

---

## Cross-Cutting

### Design Tokens & Patterns
- All new components use existing mobile/v2 primitives: `MCard`, `MCardTight`, `MListRow`, `MobileHeader`
- Breakpoint: `lg` (1024px) is the mobile/desktop split — consistent with rest of app
- Colors: use design tokens from `lib/constants/styles.ts`, no hardcoded colors
- Drawer: shadcn `Drawer` component (vaul) for action sheets

### Testing
- Visual verification at 390px (iPhone) and 1440px (desktop) — ensure desktop is unchanged
- Categorizar: test single categorize, bulk categorize, tab switching, empty state
- Accounts: verify no badge clipping at 320px minimum width
- Plan: verify all tabs reachable via bottom list, active tab excluded from list
- Settings: verify accordion open/close, form submission works within accordion

### Build Gates
- `pnpm install` (if deps change)
- `pnpm build` must pass clean

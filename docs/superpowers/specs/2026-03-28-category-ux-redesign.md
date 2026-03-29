# Category UX Redesign

**Date:** 2026-03-28
**Status:** Approved
**Scope:** Full category design system — Wave 1 (picker + management), Wave 2 (combobox, budget, inbox)

## Problem

The category UX across Zeta is functional but frustrating:

- **Picker** is a searchable text list — slow for known categories (no visual recognition), unhelpful for ambiguous ones (no guidance on which category fits), and can't create categories inline
- **Management** is a flat list with minimal editing — can't reorder, can't edit inline, no visual identity, feels like a database admin panel
- **No shared visual language** — picker, management, budget, and inbox each render categories differently with no cohesive identity

## Design Decisions

- **Tile Zones** layout for category management (grid of colored region tiles with chip subcategories)
- **Two-step zone picker** for category selection (zone first → subcategory second)
- **Smart suggestions only when high-confidence** (rule match exists, not guessing)
- **Budget view stays as-is** for now — revisit after more usage data
- **Wave 2 adopts visual language only** — no interaction redesign, just zone colors/chips/grouping

## Shared Visual Language: "Category Zones"

Foundation used by all surfaces. No new DB columns — derives from existing `color`, `icon`, `parent_id`.

| Primitive | Definition |
|-----------|-----------|
| Zone identity | Each parent category has a color, icon (emoji), tinted background (8-12% opacity), tinted border (20-25% opacity) |
| Subcategory chip | Rounded pill inside a zone, stronger tint (~15%) of parent color, text color matches zone |
| Zone tile | Reusable card: icon + name + child count + chip cloud. Used in management AND picker |

## Wave 1: Category Picker

Replaces `category-picker-dialog.tsx` and `category-combobox.tsx` with one unified component.

### Component: `CategoryZonePicker`

**Props:**
- `categories: CategoryWithChildren[]`
- `value: string | null`
- `onValueChange: (id: string | null) => void`
- `direction?: TransactionDirection`
- `variant?: "dialog" | "popover" | "drawer"` (auto-detected from viewport if omitted)
- `categoryRules?: CategoryRule[]` (for smart suggestions)
- `transactionDescription?: string` (for matching against rules)

**Layout (top to bottom):**

1. **Smart suggestion banner** (conditional)
   - Only appears when `category_rules` has a high-confidence match for the transaction's description
   - Shows suggested category as a tappable chip with reason (e.g., "Rappi aparece 8 veces aqui")
   - One tap accepts and closes picker

2. **Search bar** — "Buscar o crear categoria..."
   - Typing filters all zones and subcategories
   - If no results match, shows "Crear [typed name]" action
   - This is the inline creation flow — no modal

3. **Zone grid** — 2-column grid of zone tiles (icon + name)
   - Tapping a zone expands it below the grid to reveal subcategories
   - Selected zone gets accent border
   - Tapping another zone switches expansion

4. **Expanded subcategory list**
   - Vertical list within selected zone: icon + name + checkmark if selected
   - Tapping selects and closes picker

5. **"+ Crear categoria" link** — always visible at bottom
   - Opens minimal inline form (name, auto-assigns to currently selected zone as parent)

**Behavior:**
- If opened with a current value, the containing zone is pre-expanded
- Search bypasses two-step: results appear as flat filtered list grouped by zone color
- Keyboard: arrows between zones, Enter expands, arrows between subcategories
- Trigger button shows selected category as colored chip (icon + name + zone tint), not text with tiny dot

**Replaces:** `category-picker-dialog.tsx` + `category-combobox.tsx` → one component

## Wave 1: Category Management

Replaces `category-manage-list.tsx` with a zone-based visual organizer.

### Component: `CategoryZoneManager`

**Layout:**

1. **Zone grid** — Responsive (2 cols mobile, 3-4 desktop). Each tile shows:
   - Zone icon + name + color as header
   - Subcategory chips as wrapping cloud
   - Small "+" button for inline subcategory add
   - Count badge
   - Drag handle on tile corner for reordering zones

2. **Zone edit mode** — Tap a tile to expand in-place:
   - Editable zone name (inline text input)
   - Icon picker (grid of common emojis)
   - Color picker (palette of 12-16 curated colors)
   - Direction toggle (Gasto / Ingreso)
   - Subcategory list:
     - Each row: editable name (inline on tap), delete button
     - Drag handles for reordering within zone
     - "Add subcategory" input at bottom (type + Enter)
   - Toggle visibility (eye icon)
   - Delete zone (with reassignment flow if transactions exist)

3. **"+ Nueva zona" tile** — Dashed-border tile at end of grid
   - Tap to create new parent category inline (name, color, icon)

**Key changes from current:**
- No modals for basic editing — everything inline or in-place expansion
- Colors and icons are prominent, not hidden behind forms
- Reordering via drag (desktop) or long-press + drag (mobile)
- Visual grid matches mental model of "my category map"

**Retains:** `category-form-modal.tsx` as fallback for edge cases (e.g., changing subcategory parent via dropdown)

## Wave 2: Extended Surfaces (validate before building)

These surfaces adopt zone visual language without interaction redesign.

### CategoryCombobox → Unified Picker

- Replace popover with mini two-step picker using `variant="popover"`
- Trigger button becomes colored chip
- Effectively merges into `CategoryZonePicker`

### Budget Grid (`budget-category-grid.tsx`)

- Cards adopt zone tinted backgrounds
- Group cards by zone: zone header row → subcategory budget cards below
- No structural change to card internals (progress bar, amounts, expense type)
- Mostly CSS/layout pass

### Categorize Inbox (`category-inbox.tsx`)

- Transaction rows show category as colored chip (zone color + icon) instead of plain text
- "Categorize" action opens new two-step picker
- Bulk action bar uses same picker
- No change to tab structure or auto-review flow

## Files Changed

### Wave 1 — New
- `src/components/categories/category-zone-picker.tsx` — unified picker
- `src/components/categories/category-zone-manager.tsx` — zone grid manager
- `src/components/categories/zone-tile.tsx` — shared zone tile primitive
- `src/components/categories/subcategory-chip.tsx` — shared chip primitive
- `src/components/categories/inline-category-form.tsx` — inline create form
- `src/components/categories/icon-picker.tsx` — emoji grid picker
- `src/components/categories/color-picker.tsx` — curated palette picker
- `src/lib/utils/category-suggestion.ts` — high-confidence matching logic

### Wave 1 — Modified
- `src/app/(dashboard)/categories/page.tsx` — swap management tab to `CategoryZoneManager`
- `src/components/categorize/category-inbox.tsx` — swap picker to `CategoryZonePicker`
- `src/components/categorize/bulk-action-bar.tsx` — swap picker
- `src/components/categorize/inbox-transaction-row.tsx` — swap picker
- `src/components/categorize/auto-review-row.tsx` — swap picker
- `src/components/mobile/mobile-transaction-form.tsx` — swap combobox to picker

### Wave 1 — Deprecated (keep until Wave 2 complete)
- `src/components/categorize/category-picker-dialog.tsx`
- `src/components/ui/category-combobox.tsx`

### Wave 2 — Modified
- `src/components/budget/budget-category-grid.tsx` — zone colors + grouping
- `src/components/budget/budget-category-card.tsx` — zone tinted background
- `src/components/categorize/category-inbox.tsx` — category chips in rows

## Data Model

No schema changes. All visual information derives from existing columns:

- `categories.color` → zone tint, chip color, border color
- `categories.icon` → emoji in zone tiles and chips
- `categories.parent_id` → zone grouping
- `categories.display_order` → zone and subcategory ordering
- `category_rules.pattern` + `category_rules.match_count` → smart suggestion confidence (threshold: `match_count >= 2`, i.e., the pattern has been confirmed at least twice by the user)

## Ship Sequence

1. **Wave 1a:** Shared primitives (`zone-tile`, `subcategory-chip`, `icon-picker`, `color-picker`)
2. **Wave 1b:** `CategoryZonePicker` — replace all picker/combobox usages
3. **Wave 1c:** `CategoryZoneManager` — replace management tab
4. **Checkpoint:** Use Wave 1 for a few days. Revisit Wave 2 decisions.
5. **Wave 2a:** Budget grid zone styling
6. **Wave 2b:** Inbox category chips

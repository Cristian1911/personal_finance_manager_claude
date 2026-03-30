# Destinatarios & Budget Redesign — Design Spec

**Date:** 2026-03-29
**Scope:** Two independent redesigns — destinatarios list page (personified cards) and standalone budget management page (dual-mode with wizard).

---

## Part 1: Destinatarios Redesign

### Goal

Replace the flat table list with a card grid that treats merchants as profiles. Core job: quickly find a merchant and manage its rules, with better visual identity and category browsing.

### Page Structure

**Route:** `/destinatarios` (existing, redesigned in place)

**Header:** Existing PageHero pattern. Stats stay (Activos, Con reglas, Sugerencias). Two tabs stay (Mis destinatarios, Sugerencias). Sugerencias tab is unchanged.

### Filter Bar

Replaces the current search-only bar. Three elements:

1. **Search input** — left side, filters by merchant name (client-side)
2. **Category filter pills** — horizontal scrollable row of zone-colored pills
   - "Todos" always first, always selected by default
   - Only shows categories that have at least one destinatario
   - Uses zone color (subtle background, colored text) matching category zone tiles
   - Active pill gets stronger background (same pattern as Dominio/Ritmo toggle)
   - Horizontally scrollable on mobile, wraps on desktop
3. **Sort dropdown** — stays (Nombre, Más usado, Reciente)

### Card Grid

- **Desktop:** 3 columns (`grid-cols-3`)
- **Tablet:** 2 columns
- **Mobile:** 1 column

### Card Design — Collapsed State

```
┌──────────────────────────────┐
│  [R]  Rappi                  │
│       Comer Fuera · $85k/mes │
│       3 reglas · Activo      │
└──────────────────────────────┘
```

- **Avatar:** Circle with first letter of merchant name, colored by category zone color
- **Name:** Bold, truncated if needed
- **Line 2:** Category chip (small, zone-colored) + monthly average spend
- **Line 3:** Rule count + active/inactive badge (subtle)

### Card Design — Expanded State

Click card to toggle expansion. Reveals:

```
┌──────────────────────────────┐
│  [R]  Rappi                  │
│       Comer Fuera · $85k/mes │
│       3 reglas · Activo      │
│  ─────────────────────────── │
│  🏷 Tags: Domicilios, Fijo  │
│  [Editar] [Categoría] [⏻]   │
└──────────────────────────────┘
```

- **Tags row:** TagChips from the tag system (only if merchant has tags)
- **Action buttons:**
  - **Editar** — navigates to `/destinatarios/[id]` (existing detail page)
  - **Categoría** — inline category change via CategoryZonePicker popover, saves immediately
  - **Activar/Desactivar** — toggle, inline with optimistic update

### Inactive Merchants

Shown at the bottom of the grid with `opacity-60`, regardless of sort order. Visible but not cluttering the active view.

### Empty States

- **No destinatarios:** Centered message + CTA to create one or check Sugerencias tab
- **Filter returns nothing:** "No hay destinatarios en [Categoría]" with link to clear filter
- **Search returns nothing:** "Sin resultados para '[query]'" — no create CTA

---

## Part 2: Budget Redesign

### Goal

Create a standalone budget management page with two modes: simple per-category limits and YNAB-style zero-based budgeting. A setup wizard guides first-time configuration.

### Route & Navigation

- **Route:** `/presupuesto` (new page)
- **Gestionar page:** Added to "Organizar y reglas" section
- **Plan page:** "Ajustar presupuesto" button changed to "Gestionar presupuesto" → `/presupuesto`
- **Mobile nav:** Added to "Más" group

### Data Model

- Budget amounts stored in existing `budgets` table (no schema change)
- New field: `profiles.budget_mode` — `'per_category' | 'zero_based'`, nullable (null = hasn't set up yet)
- Income estimate: reuses existing `getEstimatedIncome()` or profile field

### Setup Wizard

Shown on first visit when `budget_mode` is null. Three steps:

**Step 1 — Elige tu estilo**

Two selectable cards side by side:

- **Por categoría:** "Pon límites a lo que más importa. Flexible, sin presión de cuadrar todo." Badge: "Recomendado para empezar"
- **Base cero:** "Cada peso de tu ingreso tiene un trabajo asignado. Más control, más intención." Badge: "Recomendado para YNAB fans"

**Step 2 — Confirma tu ingreso**

Shows detected income estimate pre-filled. User can adjust. Label: "Este es mi ingreso mensual neto."

**Step 3 — Asignación inicial**

- **Por categoría mode:** Category list with suggested amounts based on 50/30/20 split. User adjusts each. No enforcement of totals.
- **Base cero mode:** "Disponible: $X" bar at top. Same category list but amounts decrement the available bar. Bar color feedback: green → yellow → exact zero celebration → red if over.

Wizard saves `budget_mode` to profile and budget amounts to `budgets` table. After completion, lands on the budget page in the chosen mode.

### Budget Page — Por Categoría Mode

**Header:** "Presupuesto" title + MonthSelector + "⚙ Modo" settings button

**Summary bar:** Three stat cards in a row:
- Ingreso (monthly income)
- Asignado (total budgeted across categories)
- Libre (income minus assigned — informational, not enforced)

**Category cards grid** (3 cols desktop / 2 tablet / 1 mobile):

Each card:
- Zone-colored left border or subtle background tint
- Category icon + name
- Budget amount: **click to edit inline** (input replaces number, blur/Enter saves)
- Mini progress bar: spent / budget (green → yellow → red)
- Below bar: "$X gastado de $Y" small text
- Expand to see subcategory breakdown (each sub with its own spent amount; budget set at parent level)

**"⚙ Modo" button:** Popover with "Cambiar a Base cero" + "Cambiar ingreso". Mode switch is instant (same data, different UI).

### Budget Page — Base Cero Mode

**Header:** "Presupuesto (Base cero)" title + MonthSelector + "⚙"

**Assignment bar (sticky when scrolling):**
- Full-width progress bar: assigned / income
- Right side: remaining amount in bold
- Color states:
  - Green: >10% remaining
  - Yellow: 1-10% remaining
  - Exact zero: celebratory state ("✓ Todo asignado")
  - Red: over-assigned (shows deficit)

**Category list** (single column — list feels more intentional for zero-based):
- Each row: icon + name + inline amount input (right-aligned)
- Progress bar below: spent vs assigned
- Typing updates the assignment bar immediately (optimistic)
- Expand for subcategory detail
- Unassigned categories show "$0" with muted "Sin asignar" label

**Key difference from por-categoría:** The sticky assignment bar creates gentle pressure to allocate everything. Over-assigning is visually flagged but not blocked.

### Shared Infrastructure

Both modes read/write the same `budgets` table. The only difference is UI presentation and whether the assignment bar is shown. `profiles.budget_mode` controls which view renders.

### Plan Page Changes

Minimal:
- **PlanBudgetSection stays as-is** (50/30/20 allocation, attention categories, Ritmo toggle)
- **CTA change:** "Ajustar presupuesto" → "Gestionar presupuesto" linking to `/presupuesto`
- **Mode badge:** Small pill in budget section header showing "Por categoría" or "Base cero"

---

## Migration & Schema

### New profile field

```sql
ALTER TABLE public.profiles
ADD COLUMN budget_mode TEXT CHECK (budget_mode IN ('per_category', 'zero_based'));
```

No other schema changes. The existing `budgets` table already stores per-category monthly amounts.

---

## Out of Scope

- Budget sharing / multi-user
- Automated budget suggestions based on spending history (future)
- Budget rollover (unspent budget carries to next month)
- Plan page redesign beyond the CTA and badge changes
- Sugerencias tab redesign (working well as-is)

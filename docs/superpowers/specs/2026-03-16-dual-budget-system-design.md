# Dual Budget System

**Date:** 2026-03-16
**Status:** Approved
**Branch:** feat/debt-scenario-planner (continuing)

---

## Problem

The current budget system stores a single declared amount per category per month. Users can see spending vs budget, but there's no distinction between fixed and variable expenses, no month-over-month planning ritual, and the comparison UI is basic.

## Design

### Part 1: Expense Archetypes

**Migration:** Add `expense_type` column to `categories` table.

```sql
ALTER TABLE categories ADD COLUMN expense_type text
  CHECK (expense_type IN ('fixed', 'variable'));
```

Nullable — existing categories start as null (unclassified). User sets the type per category.

**Auto-suggestion logic:** When a user opens the budget/category editor:
- If the category has active recurring templates → pre-select "fixed"
- Otherwise → pre-select "variable"
- User can always override

**UI impact:**
- Category cards show a small badge: "Fijo" or "Variable"
- Budget summary bar shows a fixed/variable split: "65% fijo · 35% variable"
- Insight text: "Tu gasto fijo es $X/mes. Lo variable es donde puedes ajustar."

### Part 2: Enhanced Budget Comparison UI

**Budget category cards** — clearer breakdown:
- Current: "350.000 / 500.000 — 70%"
- New: Three lines:
  - "Presupuesto: $500.000"
  - "Gastado: $350.000 (70%)"
  - "Disponible: $150.000" (green if positive, red if over)
- Progress bar unchanged (solid for spent, striped for recurring committed)

**Budget summary bar** — fixed vs variable split:
- Current: single stacked bar of all categories
- New: two stacked bars (or one bar with visual separator):
  - Fixed portion (left, muted/striped): rent, Netflix, insurance
  - Variable portion (right, solid): food, transport, lifestyle
- Labels: "Fijo: $X de $Y (Z%)" · "Variable: $X de $Y (Z%)"

**Month-end insight card** (new):
- Appears in the last 5 days of the month or first 3 days of next month
- Shows: "Este mes gastaste 92% de lo fijo y 78% de lo variable."
- If variable is under budget: "Tu gasto flexible tiene margen de $X."
- If variable is over: "Gastaste $X más de lo planeado en gastos variables."

### Part 3: Monthly Planning Mode

**"Planificar mes" button:**
- Visible on budget page header
- Opens a focused card/section (not a separate page) showing:
  - Each budgeted category with last month's actual spending
  - Current budget amount (editable inline)
  - "Usar gasto real del mes pasado" quick-fill button per category
- On save: upserts budgets for all edited categories, `updated_at` records when planning happened
- If user never clicks it: budgets carry forward (current behavior)

**No new table needed.** The existing `budgets` table handles this. The `updated_at` field tells us when the user last reviewed/adjusted. If `updated_at` is from a prior month, we can show a subtle "Revisa tu presupuesto para este mes" prompt.

### Part 4: Future Expansion (NOT in scope)

- **Bounded-variable type** with min/max range and range-based progress bar
- **Historical budget tracking** — per-month snapshots of declared vs actual
- **Budget scenario planning** — "what if I cut food by 20%?"

## Files Changed

**Migration:**
- Add `expense_type` to `categories` table

**Modified files:**
- `webapp/src/types/database.ts` — regenerated
- `webapp/src/actions/categories.ts` — return expense_type in CategoryBudgetData, compute fixed/variable totals
- `webapp/src/types/domain.ts` — add expense_type to CategoryBudgetData type
- `webapp/src/components/budget/budget-category-card.tsx` — archetype badge, enhanced comparison display
- `webapp/src/components/budget/budget-category-grid.tsx` — add expense_type selector to budget edit popover
- `webapp/src/components/budget/budget-summary-bar.tsx` — fixed vs variable split display

**New files:**
- `webapp/src/components/budget/month-planner.tsx` — monthly planning flow component
- `webapp/src/components/budget/month-end-insight.tsx` — month-end insight card

**Page changes:**
- `webapp/src/app/(dashboard)/categories/page.tsx` — add planner button, wire month-end insight

## Success Criteria

1. User can mark categories as "Fijo" or "Variable"
2. Budget summary shows fixed/variable split with percentages
3. Category cards show clearer declared vs actual vs available
4. Month-end insight appears with fixed vs variable analysis
5. "Planificar mes" flow lets user review and adjust budgets with last month's context
6. Existing users unaffected — expense_type defaults to null (unclassified), everything works as before

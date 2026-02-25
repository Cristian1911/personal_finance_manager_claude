# Category Management — Design Doc
**Date:** 2026-02-25
**Status:** Approved

## Problem

The web app has no UI for managing categories. Users can only reorder them. There is no way to create new categories, edit existing ones, or delete them from the web interface.

## Goals

1. Full CRUD for categories on the web app (create, edit, delete)
2. Support both parent (group) and leaf categories
3. Show aggregated budgets on parent categories (sum of children, read-only)
4. Allow modification of system categories with a warning

## Out of Scope

- Mobile category management UI (separate task)
- Drag-and-drop reorder (already exists, keep as-is)

---

## Design

### Route

New page at `/categories/manage`, linked from the existing categories page.

### Category Tree View

```
▼ 🏠 Essentials          OUTFLOW   $1,200/mes  ⋮
    ├ 🍕 Alimentación               $400/mes   ⋮
    ├ 🚌 Transporte                 $300/mes   ⋮
    └ 🏡 Vivienda                   $500/mes   ⋮

▼ ✈️  Viajes  ✦           OUTFLOW          —   ⋮
    └ ✈️  Vuelos                        —     ⋮

[+ Agregar grupo]
```

- System categories: no badge
- User-created categories: ✦ badge
- Parent budget = sum of children's monthly budgets (read-only, `—` if none)
- ⋮ menu per row: Edit / Add subcategory / Delete
- "+ Nueva categoría" button in header → creates parent category
- "+ Agregar grupo" at the bottom as a shortcut

### Create / Edit Modal

Fields:
- Nombre (required)
- Nombre ES (optional)
- Ícono + Color picker
- Dirección: INFLOW | OUTFLOW (required)
- Grupo padre: dropdown (null = this is a parent/group)

System category warning banner shown when `is_system: true`.

### Delete Flow

**No transactions:** Simple confirm dialog.

**Has transactions — 2-step flow:**
1. Step 1: Show transaction count + "Reasignar a:" dropdown (excludes current category)
2. Step 2: Confirm summary ("Se moverán N transacciones a X y se eliminará Y")

**Parent with children:** Reassign children first (same flow), then delete parent.

**System categories:** Extra warning before delete.

### Parent Budget Aggregation

- Computed server-side when building the category tree in `getCategories`
- Sums `budget.amount` of all direct children with an active monthly budget
- Displayed as read-only — no edit option on parent rows
- Shows `—` if no child has a budget

---

## Implementation Notes

### New server actions needed

- `reassignAndDeleteCategory(id, reassignToCategoryId?)` — reassign transactions, then delete
- Update `getCategories` to include aggregated parent budget amounts

### New components needed

- `CategoryManagePage` — `/categories/manage`
- `CategoryTree` — recursive tree render
- `CategoryRow` — single row with ⋮ menu
- `CategoryFormModal` — create/edit form
- `DeleteCategoryModal` — 2-step delete with reassignment

### Existing actions to reuse

- `createCategory(formData)` — already exists
- `updateCategory(id, formData)` — already exists
- `deleteCategory(id)` — exists but needs to be wrapped with reassignment logic

---

## Mobile Sync Investigation (Separate Task)

Known suspects from code review:
1. Pull uses `created_at` as fallback for categories instead of `updated_at` — modified categories may never sync
2. Local SQLite may be empty if sync never ran successfully
3. Sync error: need real stack trace before diagnosing

To be investigated after category management feature ships (or in parallel).

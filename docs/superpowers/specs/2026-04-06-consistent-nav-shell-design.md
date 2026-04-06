# Consistent Navigation Shell & Movimientos Filter Cleanup

**Date:** 2026-04-06
**Status:** Approved
**Addresses:** MANUAL_TODOS.md items #13, #14

## Problem

The mobile app has two different header systems (`MobileHeader` and `MobilePageHeader`) creating visual inconsistency across screens. The movimientos page duplicates controls (month selector appears twice, "Registrar" duplicates the tab bar +), and its filter/search UX doesn't work well (text label instead of icon, broken draggable drawer).

## Decision: Unified Header Component

Replace both `MobileHeader` and `MobilePageHeader` with a single `MobileHeader` component that supports two modes:

### Main Tab Mode (Inicio, Movimientos, Plan, Deudas)

```
[Title] [optional context] · · · [Month selector?] [Avatar]
```

- **Title**: Page name (bold, 15px) — replaces ZETA wordmark
- **Context**: Optional inline text (e.g., "· 9d restantes" on Plan)
- **Month selector**: Only on screens with monthly data (Movimientos, Plan)
- **Avatar**: Always present — 1-tap access to settings from any screen
- **Height**: 48px fixed, sticky top

### Subpage Mode (Categorizar, Destinatarios, Cuentas, Ajustes)

```
[← back] [Title] · · · [Avatar]
```

- **Back arrow**: Replaces ZETA/title position
- **Title**: Page name next to back arrow
- **Avatar**: Always present
- **Height**: 48px fixed, same as main tabs

### Per-Screen Mapping

| Screen | Mode | Title | Context | Month? |
|--------|------|-------|---------|--------|
| Dashboard | main | "Inicio" | — | No |
| Movimientos | main | "Movimientos" | — | Yes |
| Plan | main | "Plan" | "· Xd restantes" | Yes |
| Deudas | main | "Deudas" | — | No |
| Categorizar | sub | "Categorizar" | — | No |
| Destinatarios | sub | "Destinatarios" | — | No |
| Cuentas | sub | "Cuentas" | — | No |
| Ajustes | sub | "Ajustes" | — | No |

### Component API

```tsx
// Main tab usage — avatar always rendered, month opt-in
<MobileHeader variant="main" title="Movimientos" month />

// Subpage usage — avatar always rendered, back arrow automatic
<MobileHeader variant="sub" title="Categorizar" backHref="/transactions" />
```

Avatar is always rendered (not a prop) — it's a core part of the shell.

The existing `MobileHeader` component at `webapp/src/components/mobile/v2/mobile-header.tsx` is refactored. `MobilePageHeader` at `webapp/src/components/mobile/mobile-page-header.tsx` is deprecated — all consumers switch to the unified component.

## Decision: Movimientos Utilidades Cleanup

The `MovimientosUtilidades` component (`webapp/src/components/mobile/v2/movimientos/movimientos-utilidades.tsx`) is simplified:

### Remove

- **"Registrar" pill** — duplicates the + button in `MobileTabBar`
- **Month selector pill** ("abril") — duplicates the month selector now in the unified header

### Change

- **"Buscar"** → `Search` icon (Lucide) in a round pill. Tap expands an inline text input below the pill row (existing behavior, just visual change)
- **"Filtrar"** → `SlidersHorizontal` icon (Lucide) + "Filtrar" text. Opens a proper drawer (not the broken draggable one). When filters are active, show a count badge on the pill

### Keep

- `MovimientosLectura` — month summary with expandable flow chart (unchanged)
- `MovimientosHerramientas` — the 3 expandable action chips: Categorizar, Destinatarios, Importar (unchanged)

### Result

The utility bar goes from 4 pills (Buscar, Filtrar, abril, Registrar) to 2 (🔍, Filtrar) — cleaner, no redundancy.

## Files to Modify

### Header unification
1. `webapp/src/components/mobile/v2/mobile-header.tsx` — refactor: rename variants to `"main" | "sub"`, always render avatar, add `month` boolean prop, add `backHref` prop for sub variant
2. `webapp/src/components/mobile/v2/mobile-avatar-menu.tsx` — no changes needed
3. `webapp/src/components/mobile/v2/inicio/inicio-root.tsx` — switch from `variant="dashboard"` to `variant="main" title="Inicio"`
4. `webapp/src/components/mobile/v2/movimientos/movimientos-root.tsx` — switch to `variant="main" title="Movimientos" month`, remove `chip="Mesa operativa"`
5. `webapp/src/components/mobile/v2/plan/plan-root.tsx` — switch to `variant="main" title="Plan"` with subtitle context, add `month`
6. `webapp/src/app/(dashboard)/deudas/page.tsx` — update to `variant="main" title="Deudas"`

**MobilePageHeader consumers → migrate to `MobileHeader variant="sub"`:**

7. `webapp/src/app/(dashboard)/categorizar/page.tsx`
8. `webapp/src/app/(dashboard)/destinatarios/page.tsx`
9. `webapp/src/app/(dashboard)/destinatarios/[id]/page.tsx`
10. `webapp/src/app/(dashboard)/accounts/page.tsx`
11. `webapp/src/app/(dashboard)/accounts/[id]/page.tsx`
12. `webapp/src/app/(dashboard)/settings/page.tsx`
13. `webapp/src/app/(dashboard)/settings/analytics/page.tsx`
14. `webapp/src/app/(dashboard)/deudas/planificador/page.tsx`
15. `webapp/src/app/(dashboard)/categories/page.tsx`
16. `webapp/src/app/(dashboard)/pendientes/page.tsx`
17. `webapp/src/app/(dashboard)/gestionar/page.tsx`
18. `webapp/src/app/(dashboard)/etiquetas/page.tsx`
19. `webapp/src/app/(dashboard)/deseos/page.tsx`
20. `webapp/src/app/(dashboard)/import/page.tsx`
21. `webapp/src/app/(dashboard)/recurrentes/page.tsx`
22. `webapp/src/app/(dashboard)/transactions/[id]/page.tsx`
23. `webapp/src/components/mobile/mobile-page-header.tsx` — delete after all consumers migrated

### Movimientos cleanup
11. `webapp/src/components/mobile/v2/movimientos/movimientos-utilidades.tsx` — remove Registrar and month pills, change Buscar to icon, fix Filtrar drawer
12. `webapp/src/components/mobile/v2/movimientos/movimientos-root.tsx` — remove `MobileTransactionForm` import if no longer needed in utilidades

## Out of Scope

- Dashboard attention section redesign (TODO #15 — separate effort)
- Plan page chips/options redesign (TODOs #17-19 — separate effort)
- Desktop layout changes (this spec targets mobile `lg:hidden` only)

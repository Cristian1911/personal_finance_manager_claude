# Design System Audit - 2026-04-03

## Reference

- Primary benchmark: the debt redesign merged on `origin/main`
- Use it for: page hierarchy, section eyebrows, condensed summary cards, panel surfaces, spacing rhythm, and token discipline
- Do not copy: the debt page expanded-detail interaction or its heavier reveal pattern

## Shared Primitives

- `PAGE_STACK_CLASS`: consistent vertical rhythm for page shells
- `SECTION_EYEBROW_CLASS` + `SectionEyebrow`: one eyebrow style across dashboard pages
- `PANEL_SURFACE_CLASS`: standard elevated summary surface
- `PANEL_SURFACE_SUBTLE_CLASS`: lighter elevated surface for nested/hero-adjacent content
- `PANEL_INSET_CLASS`: compact inset tile surface
- `PANEL_INSET_INTERACTIVE_CLASS`: hoverable inset tile surface
- `GHOST_BUTTON_CLASS` and `BRASS_BUTTON_CLASS`: standardized secondary and primary actions

## Audit Snapshot

### Strong Reference Pages

- `/deudas`
- `/deudas/planificador`
- `/import`
- `/transactions/[id]`
- `/accounts/[id]`
- `/settings/analytics`

These already carry the clearest version of the current system: strong headers, cleaner information density, and better desktop/mobile translation.

### Normalized In This Pass

- `/plan`
- `/categorizar`
- `/deseos`
- `/etiquetas`
- `/pendientes`
- `/gestionar`
- `webapp/src/components/tags/tag-manager.tsx`
- budget/mobile shell surfaces in:
  - `webapp/src/components/budget/budget-page-client.tsx`
  - `webapp/src/components/budget/budget-treemap.tsx`
  - `webapp/src/components/mobile/cards/*`

Changes focused on shell consistency, not feature rewrites:

- unified eyebrow and title rhythm
- tokenized panel surfaces instead of page-local backgrounds
- standardized mobile page header treatment
- reduced one-off utility styling in small cards and management panels

### Partial Alignment / Next Candidates

- `/dashboard`
- `/accounts`
- `/categories`
- `/transactions`
- `/destinatarios`
- `/recurrentes`

These are already closer to the target system, but they still contain page-local surfaces or older secondary card treatments that should be folded into the same primitives over time.

## Mobile Findings

- Fixed undefined token usage:
  - `text-z-sage-lightest`
  - `bg-z-bg`
- Replaced multiple ad-hoc mobile surfaces with shared inset or elevated panels
- Tightened the mobile page-header pattern so deeper routes no longer invent their own top spacing or back-button styling

## Design Rules Going Forward

1. Every page needs a clear eyebrow, title, and one-sentence framing before detail.
2. Summary state should be compact and scannable; detail state should stay quieter than the debt-page expansion.
3. Mobile surfaces should come from shared tokens first, not page-local `bg-*` or hardcoded hex values.
4. Deep utility pages should use `MobilePageHeader` plus the same shell rhythm as strategic pages.
5. New dashboard work should reuse the shared panel classes before adding another custom card treatment.

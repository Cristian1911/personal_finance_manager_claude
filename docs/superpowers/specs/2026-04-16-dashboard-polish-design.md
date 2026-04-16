# Dashboard polish — Phase 2 design

**Date:** 2026-04-16
**Scope:** Mobile `/dashboard` view (`webapp/src/components/mobile/v2/inicio/*`)
**Predecessor:** Phase 1 mobile polish (PR #168, merged) — tab-bar clearance, dev-tools gate, month-pager sync, etiquetas deep-link.
**Source:** Full mobile UX audit at `audit/MOBILE_AUDIT_2026-04-16.md` + `audit/2026-04-16/01-dashboard.png`.

## Context & motivation

The mobile Dashboard today renders five client zones (`InicioHero`, `InicioImportStrip`, `InicioMetricsGrid`, `InicioAttention`, `InicioDiscovery`, `InicioActivity`). Each works in isolation but the page as a whole lacks a clear rhythm: the ATENCIÓN chips (Vencidos / Pagos / Emails) read as static status rather than actionable navigation, RITMO + GASTO HOY compete at equal weight with the hero, and the two Discovery tiles (`¿Puedo comprarlo?`, `Plan del mes`) sit at the same visual elevation as the metrics above them, diluting hierarchy. "Plan del mes" is also redundant with the tab-bar Plan entry.

User's framing from the brainstorm: Dashboard must answer **"Am I on track?"** and **"What needs my attention?"** in the first two seconds. Habit-reinforcement metrics (today vs yesterday vs avg-7d) are secondary and may live as drill-downs.

## Decisions locked

### D1 — Dashboard job
Co-dominant: **Status** (Am I on track?) and **Triage** (What needs my attention?). Habit-reinforcement metrics are secondary, accessible via drill-down but not a top-level signal.

### D2 — Information architecture (top-to-bottom)
```
1. Hero (Disponible para gastar /día)     — unchanged content, tap-to-expand preserved
2. Timeline "Por resolver"                  — NEW, replaces ATENCIÓN chips
3. Widget grid: RITMO + GASTO HOY          — ~2x1 status tiles
4. ¿Puedo comprarlo? (full-width tool row) — replaces 2-tile Discovery
5. Reciente                                — tap-to-expand inline category picker
```

Hero always leads. Attention (Timeline) is second. Predictable daily rhythm.

### D3 — Hero treatment
- Collapsed state: `$138.279 /día` + three-fact subhead `= $1.521.064 · 11 días hasta 27 abr` + chevron (∨).
- Expanded state (tap anywhere on the hero): show existing content — `CÓMO SE CALCULA` card (Saldo líquido − Obligaciones pendientes − Ya gastado = Disponible, with ÷ days formula), income-config nudge when income isn't set, and CUENTA PRINCIPAL card with balance. This behavior already exists via `useExpandableZone`; preserve it.
- **Do not** change the subhead density. The three-fact line is informative and acceptable.

### D4 — "Por resolver" timeline (replaces ATENCIÓN chips)
A horizontal scrollable strip under the Hero that merges the three current signals (overdue reminders, upcoming payments, pending emails) plus upcoming income into one chronological queue ordered by `when`.

Item shape:
- **Eyebrow:** `<when> · <type>` (e.g., `Hoy · Email`, `27 abr · Pago`, `27 abr · Ingreso`, `Vencido · Pago`)
- **Title:** descriptive (merchant, count, or description)
- **Secondary line:** amount (with `+` for income, neutral for expenses) or context label
- **Color accents:**
  - **Red** border + red eyebrow (`#d97064`) — overdue: occurrence `date < today` AND `status = 'pending'`, or an unresolved item whose deadline has passed.
  - **Brass** border + brass eyebrow (`#b58e48`) — requires action today: pending emails to review, pagos due today, overdue items that the user should tackle first.
  - **Neutral** white/6 border + grey eyebrow — future-dated confirmed items (upcoming pagos, upcoming ingresos) that are on track and need no action yet.
- **Tap target:** each item routes to its underlying action — email → `/settings#email` or the email detail, pago → `/plan?tab=recurrentes` with focus on that occurrence, ingreso → same with income focus.

Section header: `POR RESOLVER` (eyebrow style) + `Ver todo →` link to `/gestionar`.

Empty state (no urgent or near-term items): single card "Todo tranquilo. Sin pendientes esta semana." with a checkmark. Timeline does not hide — the empty state is informative.

### D5 — Widget grid (replaces MetricsGrid + Discovery)
2-column top row of status widgets + 1-row full-width tool widget underneath.

**Top row (status):**
- **RITMO** — widget with eyebrow `RITMO`, SVG gauge ring (existing `ArcRing` component), percentage text centered, sub `día X de Y`. Preserves existing tap-to-expand showing burn rate + runway chart (`RunwayMiniChart`). Yesterday and avg-7d spending move into this expand to avoid losing the data.
- **GASTO HOY** — widget with eyebrow `GASTO HOY`, large amount, sub `Sin gastos` / `vs ayer +X` / `vs promedio -Y`. Tap-to-expand shows spent yesterday + avg last 7d + optional mini sparkline.

Both widgets use: `rounded-2xl`, `border-white/6`, `bg-white/[0.02]`, centered column layout, `min-h-[120px]`.

**Bottom row (tool), full-width:**
- **¿Puedo comprarlo?** — horizontal layout: 44×44px icon box (brass/12 bg, 💡 or lightbulb icon), title + subtitle stacked, brass `→` arrow. Tap opens the existing `PurchaseRecommenderDrawer`.

**Removed from current Dashboard:** `Plan del mes` tile. Reason: redundant with tab-bar Plan entry. Purchase recommender stays because it's a tool with no tab-bar home.

### D6 — Reciente with tap-to-expand
- **Remove** the inline yellow `Sin cat.` tag from every row. (The cross-app signal for uncategorized tx lives on `/transactions` already; duplicating on Dashboard is visual clutter.)
- **Row interaction:** tap row to toggle expand. When expanded, the row itself highlights with a brass-tinted background and brass/18% border, and an inline panel renders below with quick actions — scoped for this phase:
  - **Category picker** (horizontal scroll chip row of outflow categories; tap to assign; optimistic update).
  - *Out of scope for this PR* but supported by the design: destinatario picker, tag chips, "Hacer recurrente" CTA (depends on backlog feature #1 → promote-to-template).
- Expand state model: at most one row is expanded at a time. Tapping an already-expanded row collapses it; tapping a different row swaps the expanded target.
- Navigation to detail page (`/transactions/[id]`): `→` chevron inside the expanded panel labeled "Ver detalle". The collapsed row itself does **not** navigate — that's a behavioral change from today (tap-to-navigate replaced by tap-to-expand). Users who expected navigation will learn quickly; the detail is 1 extra tap away, and the new inline-categorize workflow is higher-frequency.

### D7 — Import strip behavior
`InicioImportStrip` stays but becomes conditional:
- Render when *no* pending emails AND `daysSinceImport > 14` (adjustable threshold).
- Hide when the Timeline already surfaces "N movimientos sin importar" — the two signals are redundant.
- Position: between Hero and Timeline (unchanged).

## Component-level changes

| Component | Change | Notes |
|---|---|---|
| `inicio-root.tsx` | Reorder children: Hero → ImportStrip (conditional) → AttentionTimeline → WidgetRow → ToolRow → Activity | Remove `InicioMetricsGrid` + `InicioDiscovery`, add `InicioAttentionTimeline` + `InicioStatusWidgets` + `InicioToolRow` |
| `inicio-hero.tsx` | No content change. Verify chevron indicator and tap-target cover the full card | Existing expand content (`CÓMO SE CALCULA` card + nudge + `CUENTA PRINCIPAL` card) preserved |
| `inicio-attention.tsx` | **Replace** with new `inicio-attention-timeline.tsx` — renders `z-timeline` horizontal scroll | Merges `overdueReminders` + `upcomingPayments` + `pendingEmails` + upcoming income into a single sorted list. Keeps `useLiveDashboard` wiring for freshness. |
| `inicio-metrics-grid.tsx` | **Replace** with `inicio-status-widgets.tsx` — 2-col grid, RITMO + GASTO HOY | Preserve `ArcRing`, `RunwayMiniChart`, existing expand behavior. Move yesterday/avg-7d into GASTO HOY expand. |
| `inicio-discovery.tsx` | **Replace** with `inicio-tool-row.tsx` — single full-width tool tile (¿Puedo comprarlo?) | `Plan del mes` deleted. `PurchaseRecommenderDrawer` trigger unchanged. |
| `inicio-activity.tsx` | Remove `Sin cat.` inline tag rendering. Add row-level expand state. Add inline category picker panel | Reuse the zone-picker pattern from `/transactions` list rows. Delete the yellow tag JSX. |
| `inicio-import-strip.tsx` | Add conditional render — hide when `pendingEmails.length > 0` | Pass `hasPendingEmails` prop from `inicio-root.tsx`. |

## Data flow

No backend changes in this PR. All data already flows from:
- `getDashboardHeroData` — hero
- `getAttentionItems` — timeline source
- `getBurnRate`, `getDailySpending` — widgets
- `getBudgetSummary` — RITMO budget reference
- `getRecentTransactions` — reciente list

Timeline construction happens client-side in the new `InicioAttentionTimeline`: merge the three attention arrays + upcoming income into one list, sort by date ascending, apply urgency color rules based on date vs today.

## Out of scope (moved to BACKLOG.md)

1. **Account aliases + mini icons** — `Bancolombia Ahorros ****4398` → `<alias> · ****<mask>` with tiny colored icon. Affects Reciente and many other surfaces. Separate PR (requires migration).
2. **"Hacer recurrente" CTA on transaction detail** — promote a transaction to a recurring template with prefill. Pairs with next item.
3. **Link Destinatario ↔ Recurring Template** — when a destinatario matcher hit corresponds to a destinatario attached to a recurring template, prompt to link the new tx to the pending occurrence.
4. **`is_subscription` dead flag** — toggle on `/transactions/new` writes a field no one reads. Connect to the template-creation flow OR remove.
5. **Dual-back pills on `/transactions/[id]` and `/deudas/planificador`** — deferred from Phase 1. Revisit as redesign (breadcrumb tag vs back chip), not removal.

## Open questions

1. **Timeline "Ver todo →" destination**: `/gestionar` (Bandeja hub) is the natural candidate but today it surfaces categorization + destinatarios, not a time-ordered attention list. Decide during implementation: either (a) Bandeja gets a "Por resolver" section that mirrors the Dashboard timeline, or (b) the link routes to `/plan` with a near-term filter, or (c) no "Ver todo" link if the timeline surfaces everything.
2. **Empty-state threshold for Timeline**: definition used for this design — zero overdue occurrences + zero pagos due in next 7 days + zero pending emails → "Todo tranquilo". Anything above zero in any bucket renders the strip. Confirm during implementation whether upcoming income alone is worth surfacing when everything else is empty.
3. **Tool row — future expansion**: only `¿Puedo comprarlo?` ships. If future tools (Simular compra, Ver recurrentes) justify a second row or a horizontal scroll, that's a separate iteration and should not be designed-in prematurely.

## Testing strategy

- **Visual** — Playwright screenshots at 390×844 for: logged-in with populated data (all zones render), Timeline with 0 items (empty state), Hero collapsed vs expanded, Reciente with a row expanded.
- **Interaction** — clicks on Timeline items route correctly; Reciente row expand/collapse works; category picker assigns optimistically.
- **Regression** — ensure `/plan?tab=recurrentes` (touched by Phase 1) and `/dashboard` don't conflict on the `?month=` URL param.
- **Type-check + build** — `pnpm build` must pass. Spawn `zetas-front-guy` for design-token compliance after TSX changes. Spawn `perf-auditor` for the new Timeline component since it adds a client-side sort.

## Success criteria

- Dashboard first viewport (390×844) shows Hero + first 1-2 Timeline items without scroll.
- `POR RESOLVER` timeline horizontally scrolls smoothly, urgent items visually distinct.
- Tap-to-expand on Hero reveals existing detail; tap-to-collapse works.
- Tap-to-expand on Reciente row opens inline category picker; selecting a category optimistically updates and closes.
- `Plan del mes` tile absent.
- No `Sin cat.` yellow tag anywhere on Dashboard.
- `pnpm build` passes; `zetas-front-guy` finds no token violations.

# Plan page polish — design

**Date:** 2026-04-17
**Scope:** Mobile `/plan` root + three tabs (`?tab=periodo`, `?tab=recurrentes`, `?tab=presupuesto`).
**Predecessor:** Dashboard polish Phase 2 (PR #169, merged 2026-04-16) — horizontal "Por resolver" timeline, widget tiles, inline categorize, `useRecurringMonth` URL-param sync.
**Source:** Full mobile UX audit at `audit/MOBILE_AUDIT_2026-04-16.md` (sections §06, §10, §11, §17) + captures under `audit/2026-04-16/`.

## Context & motivation

The mobile `/plan` surface carries the four canonical Plan questions of the app: **what's my month shape**, **what's coming up**, **what's left to plan**, and **am I within my envelopes**. Today each tab individually answers its question well, but the hierarchy drifts:

- **Root** shows `PlanNetHero` with a split-bar, small NETO text and a low-contrast `Toca para ver flujo ↓` hint; `Próximo ingreso` and `Próximo pago` chips sit at equal weight; the `Recurrentes 8` chip badge uses brass (warning tone) even when 8 is a neutral total.
- **Periodo** buries NETO in a stat row at the top of the section, despite NETO being the single most important number on that screen — and the `Pago AMEX BC` style repeating rows could benefit from a `Parcial` state.
- **Recurrentes** has two pagers still rendered (a global `<MonthSelector />` and an inner `‹ Abril 2026 ›` in the hero card — Phase 1 synchronized them via URL param but did not remove the duplicate); and `MIS PLANTILLAS` (the creation + admin surface) still lives as a collapsible footer below 10+ occurrences, so the create path is not discoverable.
- **Presupuesto** renders 7 of 11 categories red simultaneously, saturating the alert signal; the `Necesario 86% · Deseos 14%` ratio is displayed without a legend explaining the 50/30/20 target.

User's framing from the brainstorm: Plan answers **"What's the shape of this month — income, fixed obligations, room to breathe?"** Periodo is the canonical drill-down; root is a dashboard overview; Presupuesto + Recurrentes are inputs/audits.

## Decisions locked

### D1 — Root NETO hero: collapsed-simple → expanded-rich

**Collapsed state (default):**
- Eyebrow row: `NETO DEL MES` (brass, small caps) · right-aligned `N días restantes`
- Big number: `±$X.XXX.XXX` (30–36px, bold, color-coded — `text-z-income` when ≥0, `text-z-expense` when <0, `text-z-brass` at exactly zero)
- Single breakdown chip: `+ $A.BBBk · − $C.DDDk` (muted)
- Expand cue: centered `Toca para ver flujo ↓` in **full-opacity `text-z-brass`** with a `ChevronDown` icon (replaces today's `text-z-brass/50`)

**Expanded state (tap hero anywhere):**
- Same eyebrow + big NETO number (unchanged)
- Split-bar (`Ingresos · Gastos · Neto` — existing geometry, retokenized)
- Three-cell legend: `Ingresos $X / Gastos $X / Neto $X` (amounts, not just names)
- `PlanFlowChart` renders below (existing component, unchanged)
- Collapse cue: `Ocultar flujo ↑` with `ChevronUp`, same tone as the expand cue
- Tap backdrop/overlay behavior preserved via `useChartFocusMode`

**Color tokens (globally in this component):**
- `bg-emerald-500/80` → `bg-z-income/80`
- `bg-red-500/80` → `bg-z-expense/80`
- `text-z-brass` for NETO zero-case (kept)
- Any other hardcoded `emerald-*` / `red-*` classes in `plan-net-hero.tsx` swapped to tokens.

### D2 — Próximo ingreso / próximo pago ordering

- Sort the two chips by **soonest-date-first**. The item whose date is nearest to today occupies the left slot; the other, the right.
- When dates tie: payments first (debt outflow is more urgent than income inflow when the user is checking "what hits first").
- The left (sooner) chip gets a subtle highlight: `bg-z-brass/5` + `border-z-brass/20`. The right chip stays neutral (`bg-white/[0.02]` + `border-white/6`).
- No change to the content of either chip (amount, date, obligation name).

### D3 — Periodo tab: NETO elevated, `Parcial` state

**NETO elevation:**
- Replace today's stat-row NETO with the same hero treatment as D1 collapsed (eyebrow + big color-coded number + tiny breakdown chip). No expand on Periodo — the list below *is* the detail.
- Period-specific subline in the eyebrow right-slot: `Mitad de mes` / `Fin de mes` / `Comienzo de mes` based on `dayOfMonth` (informational, not load-bearing).

**`Parcial` state:**
- Check the `recurring_occurrences` schema during implementation. If the table has `paid_amount` (or an equivalent field that can be compared against `scheduled_amount`), introduce a `Parcial` execution state rendered with brass foreground + a `{percent}%` mini-chip under the row name.
- If the schema does not support partial payments yet, **do not** expand the schema for polish. Document the gap in `BACKLOG.md` and ship the other D3 changes.
- Execution states (assuming schema supports it): `Pagado` (green) · `Pendiente` (brass) · `Parcial` (brass with percent) · `Omitido` (neutral). Reuse existing state-chip tokens; add `Parcial` only if feasible.

### D4 — Recurrentes tab: `Mis plantillas` promoted, inner month pager dropped

**Templates strip at top** — the `TemplatesSection` today lives as a collapsible footer (eyebrow + `Ver ↓/Ocultar ↑`) below the occurrences list and `CompletedSection`. Move it to sit directly under the hero card (above `Pendientes` list):

- Strip visual: `rounded-2xl` · gradient `from-z-brass/10 to-z-brass/2` · border `border-z-brass/18` · padding `px-3.5 py-3`.
- Contents:
  - Left: eyebrow `MIS PLANTILLAS` · count line below `N activas · N pausadas` (body text).
  - Right: `Ver ↓` / `Ocultar ↑` toggle (brass).
- Expanded body: the existing template list (rows: merchant · account · frequency · amount · `Editar`). No route change — expand inline at the strip location, same markup as today's `TemplatesSection`.
- The existing `+ Nueva recurrente` dashed-brass CTA **moves from its current location (above the old footer templates section)** into the strip's expanded body (below the template list), so all template admin lives in one place. Alternatively, keep `+ Nueva recurrente` as a sticky CTA at the bottom of the expanded strip list — pick whichever is cleaner at implementation.
- Remove the original footer `TemplatesSection` + dashed-brass `+ Nueva recurrente` — now duplicated.
- If there are zero templates, the strip's expanded body shows `Aún no tienes plantillas` + the `+ Nueva recurrente` CTA already. Collapsed state still shows counts (`0 activas`).

**Inner month pager removed** — today `mobile-recurrentes-view.tsx` renders its own `‹ Abril 2026 ›` chevrons inside the hero card (lines 230-248), calling `hook.goPrevMonth` / `hook.goNextMonth`. Phase 1's `useRecurringMonth` rewrite synced this inner pager with the global `<MonthSelector />` via URL param — but the visual duplication persists. Drop the inner chevrons entirely:

- Remove the inner `<button>` chevrons and the centered month label from the hero card.
- The global `<MonthSelector />` at the top of `/plan` is now the single pager (audit §17 findings).
- The hero's `Compromiso mensual` + total + `Pendientes/Completados` stat split stay.

### D5 — `Recurrentes` badge semantics → folded into D10

Originally this decision locked neutral-by-default / brass-on-overdue colors for the `Recurrentes` top-right badge on the drill card. **D10 replaces the top-right badge entirely with an icon-led layout**, so the brass / neutral signal moves into the caption line (`N este mes · M vencidas`). This decision number is retained for continuity with earlier mockups; its substance is subsumed by D10's caption rules.

### D6 — Presupuesto tab: grouped by risk state

- Sort categories into three visual groups in this order:
  1. **`SOBRE LÍMITE`** (`actualSpent > budgetAmount`) — red group label + count pill
  2. **`CERCA DEL LÍMITE`** (`actualSpent >= 0.85 * budgetAmount && actualSpent <= budgetAmount`) — brass group label + count pill
  3. **`DENTRO DEL LÍMITE`** (remaining) — green group label + count pill
- Threshold for "near": `>= 85%`. Configurable as a constant if a different threshold later proves better.
- Each group has a small uppercase header with its color + a count pill: e.g., `SOBRE LÍMITE 3`.
- **Remove** the `⚠` icon from every category row — progress-bar color alone carries the state signal.
- Progress-bar colors follow the group: red fill for over-limit (clipped to 100%, optionally with a tiny `over-indicator` chevron to the right of the bar), brass for near-limit, green for within-limit.
- Within each group, sort by **highest variance first** (most over for SOBRE, closest to limit for CERCA, smallest for DENTRO).

### D7 — 50/30/20 sheet, entry = tap the chip

- The chip `Necesario X% · Deseos Y%` (today rendered as static text on Presupuesto tab) becomes a **button** that opens a bottom sheet.
- Add a subtle `↗` glyph to the chip so it reads as tappable. No secondary "Ver 50/30/20 ↗" link — single affordance.
- Sheet content:
  - Title: `Distribución 50/30/20`
  - Subtitle: `Cómo estás repartiendo tus gastos este mes`
  - Three buckets rendered as rows: `Necesario` · `Deseos` · `Ahorro`.
  - Each row: name + meta label `Meta X%` + actual label `Actual Y%` · progress bar with the **actual fill** (colored by variance: red when actual overruns meta for Necesario, brass when within ±5pp, green when under for Deseos/Ahorro, inverted for Necesario) · **meta marker** — 2px vertical line positioned at the target percent.
  - Footer: short helper line `50/30/20 es una guía, no una regla estricta.`
- Sheet uses `MOBILE_TAB_BAR_CLEARANCE_CLASS` on its content, close-on-overlay-tap, and `SheetContent` from `@/components/ui/sheet`.
- The `50/30/20` actuals are already computed by the budget summary action (`getBudgetSummary` or equivalent). Confirm during implementation; if the ratios need a new computation, add it to the existing summary action rather than creating a new server action.

### D8 — Expand-cue contrast fix (root hero)

- `Toca para ver flujo ↓` today renders `text-z-brass/50` — too dim. Change to `text-z-brass` + `ChevronDown` icon (from `lucide-react`).
- On expand: `Ocultar flujo ↑` + `ChevronUp`.
- Keep center alignment, keep the "button-inside-button" behavior (tap anywhere on the hero toggles).

### D10 — "IR A" chips: icon-led identity (match RITMO proportions)

Today's four drill cards (`Presupuesto`, `Periodo`, `Recurrentes`, `Deseos`) on `/plan` root are compact: a small icon in the top-left corner, a number/badge in the top-right, and the label at the bottom-left. They blend visually because every chip looks the same except for the badge color.

Match the **RITMO** widget rhythm from Dashboard (`inicio-metrics-grid.tsx`):

- **Layout:** eyebrow label at top → **centered logo** (visual anchor) → caption underneath.
- **Size:** `min-h-[150px]` (RITMO is ~120–130; bump slightly for 4-in-a-2x2 grid balance).
- **Background:** `bg-z-surface-2` / `bg-white/[0.02]` · `border-white/6` · `rounded-2xl`.
- **Logo treatment:** single-stroke `lucide-react` icon at ~40px, color `text-muted-foreground` (~78% opacity). **No colored backgrounds, no rings, no donut gauges.** Monochrome identity — the icon alone carries recognition.
- **Icons:**
  - `Presupuesto` → `Wallet` (or `WalletCards`)
  - `Periodo` → `CalendarCheck` (calendar with checkmark)
  - `Recurrentes` → `RefreshCw` (cycle arrow)
  - `Deseos` → `Heart`
- **Caption (`text-xs` · muted):** the only source of dynamic color — brass text when there's something to attend to, neutral otherwise.

**Caption rules per chip:**
| Chip | Neutral | Attention |
|---|---|---|
| Presupuesto | `dentro del límite` | `N sobre límite` (brass) |
| Periodo | `al día` / `100%` | `N pendientes` (brass) · `N vencidas` (expense red) |
| Recurrentes | `N este mes` | `N este mes · M vencidas` (brass tail) |
| Deseos | `N activos` | *(no attention state — wishlist isn't time-critical)* |

**What this replaces:**
- The current `7 sobre límite`, `100%`, `8`, `2` badges in the top-right corner are gone; that information moves into the caption line with consistent voice.
- The current `plan-drill-cards.tsx` rendering of `7 sobre límite` as a red pill in the corner becomes `7 sobre límite` as brass caption text under the `Wallet` logo.
- D5's "neutral-by-default, brass-on-overdue" rule for `Recurrentes` folds into D10's caption rules and is no longer a separate decision.

**Interaction:** entire chip still tappable, still routes to `/plan?tab=*`. No change to navigation.

### D9 — Out of scope (deferred to BACKLOG.md)

1. **Empty states for `/plan` surfaces** — no income, no budgets, no recurrentes, no wishlist. Minimal template empty state in D4 is the single exception. All other empty states deferred as follow-up to match Dashboard Phase 2 scoping.
2. **`/plan?tab=deseos`** — §14 of the audit (score `48` unlabeled, inconsistent per-item state density, `rapido` spelling) is a separate polish. Not blocked by this spec.
3. **Dual-back pills on `/deudas/planificador`** — HANDOVER explicit carry-over from Phase 2. Revisit as redesign later.
4. **Month pager elevation on `/plan` root** — today the page has a small centered `‹ Abril ›`. Working as-is; no change this phase.
5. **Richer widgets on `/plan` root** — adding burndown, health-score, or attention-count tiles. Out of this polish; user's Q1=B framing keeps root lean.

## Component-level changes

| Component | Change | Notes |
|---|---|---|
| `webapp/src/components/mobile/v2/plan/plan-net-hero.tsx` | D1 + D8 retoken + restructure | Split collapsed vs expanded; retokenize emerald/red → z-income/z-expense; color-code NETO number; upgrade expand cue to full-opacity + icon. |
| `webapp/src/components/mobile/v2/plan/plan-expandable-chips.tsx` | D2 — sort by soonest date | Accept `incomes[]` + `payments[]`; compute next-date for each; reorder slots; apply brass hint styling to the sooner chip. |
| `webapp/src/components/mobile/v2/plan/plan-drill-cards.tsx` | D10 — icon-led layout, caption rules | Restructure all 4 chips to eyebrow → centered lucide icon (40px, monochrome) → caption. Caption text = the only state-aware color. Remove top-right numeric badges. Replace corner-icon + bottom-label pattern with RITMO-style vertical rhythm. |
| `webapp/src/components/mobile/v2/plan/mobile-periodo-view.tsx` | D3 — NETO elevated + Parcial state | Replace the stat-row NETO with hero treatment; add `Parcial` execution state if schema supports. |
| `webapp/src/components/mobile/v2/plan/mobile-recurrentes-view.tsx` | D4 — templates strip promoted | Create `mobile-recurrentes-templates-strip.tsx` subcomponent placed above the occurrences list; remove the footer `MIS PLANTILLAS VER ↓`. |
| `webapp/src/components/mobile/mobile-presupuesto.tsx` | D6 + D7 — group-by-risk + tappable chip | Group transform in render; remove ⚠ JSX; convert `Necesario X% · Deseos Y%` static row to a button that opens the sheet. |
| `webapp/src/components/mobile/v2/plan/plan-budget-hero.tsx` | Possible retokenize of progress-bar colors | Audit for hardcoded `emerald-*` / `red-*`; swap to `z-income` / `z-expense`. |
| **New:** `webapp/src/components/mobile/v2/plan/plan-5030-20-sheet.tsx` | New bottom-sheet component | `Sheet` from `@/components/ui/sheet`, three buckets, meta-marker bars. |
| **New:** `webapp/src/components/mobile/v2/plan/mobile-recurrentes-templates-strip.tsx` | New header strip | Template counts + `Gestionar →` link. Minimal empty state if zero templates. |

## Data flow

No backend changes. All data already flows:

- `getPlanPageData` / `getPendingOccurrences` — root data, Periodo list, Recurrentes occurrences
- Recurring templates list — existing action (pick `getRecurringTemplatesCached` or equivalent); confirm during implementation which function already returns the active/paused counts used by the footer link today.
- `getBudgetSummary` — Presupuesto categories + 50/30/20 ratios
- `overdueCount` for D5 — may require extending the existing plan data action with a small aggregation; prefer computing in SQL rather than client-side JS to avoid a second round-trip.

Risk-state grouping in D6 is a pure client-side sort/partition over the existing category list — no new fetch.

## Testing strategy

- **Visual regression** — Playwright screenshots at 390×844 for:
  - `/plan` root, collapsed hero, populated state
  - `/plan` root, expanded hero, populated state
  - `/plan?tab=periodo` with at least one `Parcial` row (if schema supports)
  - `/plan?tab=recurrentes` with templates strip + occurrences
  - `/plan?tab=presupuesto` with categories spanning all three risk groups
  - Presupuesto 50/30/20 sheet open
- **Interaction** —
  - Tap NETO hero → expands to bar + chart, tap again → collapses
  - Tap `Necesario X% · Deseos Y%` chip → sheet opens; tap overlay → closes
  - Tap `Gestionar →` on templates strip → routes correctly
- **Token compliance** — spawn `zetas-front-guy` after TSX changes. No `emerald-*` or `red-500` should remain in `plan-*.tsx` files.
- **Perf** — `perf-auditor` run to confirm no new server-action queries were added for D5/D6 (both should be client-side).
- **Type-check + build** — `pnpm build` clean.

## Review gate

Follow the same layered pattern that worked on Dashboard Phase 2 (HANDOVER §7):

1. `zetas-front-guy` + `perf-auditor` (parallel) — immediately after implementation
2. Push → Gemini bot review
3. `frontend-auditor` + `ux-analyst` (parallel)
4. `/simplify` skill — reuse + quality + efficiency pass

Each layer's findings land as a separate commit for clean review history.

## Success criteria

- `/plan` root first viewport (390×844): NETO hero + Próximo chips + first chip link row all visible without scroll.
- NETO number is color-coded and ≥ 28px in the collapsed hero.
- Expand cue is legible on the first glance — not a hint.
- Periodo NETO ties the screen together; no user needs to scan a stat row to find the sign.
- Recurrentes `Mis plantillas` is visible in the first viewport.
- Presupuesto never renders a wall of red — grouping makes the actionable 3 distinct from the 6 safe.
- 50/30/20 sheet opens on a single tap from Presupuesto.
- `pnpm build` passes; `zetas-front-guy` reports zero token violations.

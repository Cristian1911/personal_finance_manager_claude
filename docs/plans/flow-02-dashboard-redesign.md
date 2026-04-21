# Flow 02 — Home redesign (webapp mobile)

**Variant:** B / Bold — Widget-driven
**Surface:** webapp mobile breakpoint only (`lg:hidden` branch of `/dashboard`)
**Desktop:** out of scope this milestone. Stays stacked-zone layout.
**Branch:** `feat/flow-02-dashboard-redesign`

---

## Why Variant B

- Current webapp mobile (`InicioRoot`) is Variant A-ish: single hero + scannable rows. Works, but the home is *curated by us*, not the user.
- Variant B promise: **user owns the home**. Fixed Pulse strip answers the 5-second question; everything below is user-arranged widgets.
- RN mobile app already shipped Variant B infra in PR #199 (`mobile/components/inicio/`) — types, catalog, grid, Pulse, AddWidgetSheet. Port + adapt, don't re-invent.

## Wireframe → existing component map

Wireframe frame (B1 Glance + B2 Edit mode) vs today's webapp mobile:

| Wireframe element | Webapp today | Action |
|---|---|---|
| **Pulse strip** (fixed top, spending/day + spark + "on track") | `InicioHero` (availablePerDay + breakdown expand) | Rewrite as `PulseWidget`. Always-on, non-removable. Retain breakdown-expand from hero; add sparkline. |
| **Widget: Next bill** (S) | `InicioAttentionTimeline` renders upcoming payments inline | Extract chip-size renderer; keep timeline as expanded detail (reuse). |
| **Widget: Where today** (S) | — | New. Source: existing `getDailySpending` + category breakdown. |
| **Widget: Accounts** (S) | — (webapp desktop has `AccountsOverview`, no mobile equivalent in `InicioRoot`) | New mobile renderer. Source: `getAccounts()` (already in shell). |
| **Widget: Goal** (S) | — | New, `available: false` stub — no saving-goals data model yet. |
| **Widget: Recent** (L) | `InicioActivity` | Port in-place as widget. **Fold backlog item**: inline category assign on row expand. |
| **"+ Add widget"** CTA | `InicioToolRow` (tool shortcuts, not widgets) | New. Replaces tool row (moves those actions to avatar menu / `/gestionar` per Flow 06 convention). |
| **Edit mode header** ("Arrange · Drag · Resize · Remove") | — | New toggle. Remove (×) ships PR 2; drag + S/M/L ships PR 4. |
| **Catalog sheet** (AddWidgetSheet) | — | New. Port from RN `AddWidgetSheet` structure. |
| **Storage** | `profiles.dashboard_config` JSONB, type `WidgetConfig = {id, visible, order, section}` | Extend — add `size: WidgetSize`, drop `section` (or keep for desktop-back-compat), keep `visible` gating for desktop. |

## Gaps

1. **Per-widget renderer layer** — mobile InicioRoot today hands each component its own props shape. Variant B wants a uniform `(instance) → {chip, detail}` render contract. Port from RN `WidgetGrid`.
2. **Chip + accordion primitive** — desktop has `Card` shell; mobile needs the RN-style `ExpandableChip` (tap to expand, dimmed sibling, brass border active). Port or build webapp-equivalent using existing Radix + token classes.
3. **Sparkline data for Pulse** — need last-N days of net cashflow (or spend). BACKLOG already flags this on RN side ("Pulse trend data shape") — decide once, use for both.
4. **Layout persistence** — `dashboard_config` is already a `use cache` read via `getDashboardConfigWithPurpose`. Mutation path via existing `updateDashboardConfig` server action. Confirm `updateTag` on save.
5. **RECIENTE inline category assign** — `InicioActivity` needs row-expand with `CategoryZonePicker` inline (not drawer). Backlog-listed High priority; rides this slice.

## PR split

Four PRs, each merges cleanly to main, each leaves `/dashboard` working end-to-end.

### PR 1 — Scaffolding & Pulse (visual parity, no feature changes)
- Types: port `webapp/src/lib/dashboard/widgets.ts` from RN (`WidgetSize`, `WidgetType`, `WidgetInstance`, `DashboardLayout`, `WIDGET_CATALOG`).
- Extend `WidgetConfig` with `size` (default `"S"`). Back-compat: absent `size` → `"S"`.
- Component: `PulseWidget` (webapp). Always-on, non-removable, sparkline stub (reuse `AreaChart` from recharts with tiny preset). Collapse = value + /day + status. Expand = breakdown (port `InicioHero` detail).
- Component: `WidgetGrid` (webapp) — 2-col expandable chip grid. Primitive: `ExpandableChip` (tap → expand, sibling dims, brass border active).
- Wire new layout storage helper: read from `dashboard_config.widgets` (with `size`), persist via `updateDashboardConfig`.
- `InicioRoot` rewrite behind same component name — renders Pulse + WidgetGrid. Initial layout seeds: all existing sub-components become widgets (accounts, next-bill = timeline, where-today, recent).
- **Ships visible:** Pulse fully working + widgets render the old content through the new grid. Feels like Variant B glance, no edit mode yet.

### PR 2 — Edit mode + remove + Add widget catalog
- Edit toggle button in `MobileHeader` ("Organizar" ↔ "Listo"). Matches RN convention.
- `WidgetGrid editing` prop renders × on each non-Pulse chip → `onRemove` persists layout.
- `AddWidgetSheet` (port RN): renders `WIDGET_CATALOG` as tappable list, disabled for `available: false` with "Próximamente" pill.
- Available widgets at ship: `next_income`, `next_bill`, `accounts`, `where_today`, `recent`. Others `available: false` stubs matching RN catalog.
- **Ships visible:** user can add/remove/reorder-via-recreate widgets. Edit mode feels owned.

### PR 3 — ~~RECIENTE inline category assignment~~ → already shipped
- **Finding (2026-04-20 inventory):** `InicioActivity` already implements this. Row tap expands to an action chip row (`actions` phase), tapping "Categorizar" switches to `categorize` phase with inline `CategoryPickerBody`, optimistic state. See `inicio-activity.tsx:280-455`.
- Backlog entry is stale — remove when we ship PR 2.
- The only remaining ask would be row-level "category pill" affordance without requiring the expand-first step. Scope decision: not needed; expand-first is consistent with the rest of the row.

### PR 3 — Arrange mode (drag + S/M/L)
- Same visual state as Edit, plus per-chip S/M/L toggle row (tap to cycle size, or inline S/M/L chip row per widget).
- Drag-to-reorder: use native HTML5 drag-and-drop API (no new dep) OR `@dnd-kit/core` if reorder animations look shaky. Decide in PR.
- `size` affects grid span: S = 1 col, M = 1 col × taller chip, L = 2 cols. Matches RN `widgetColSpan`.
- Persist on drag-end / size change via same `updateDashboardConfig` path.
- **Closes** BACKLOG "Mobile dashboard — Arrange mode (drag/resize)" *for webapp*. RN side remains open.

## Verification gates per PR

- `pnpm install` (root) if deps change (only PR 4 if `@dnd-kit/core` chosen).
- `pnpm build` must pass.
- `cache-doctor` review: confirm `updateTag("dashboard-config")` fires on layout mutation; confirm Pulse's sparkline query is cached.
- `zetas-front-guy` review: chip + pulse tokens, no hardcoded colors, `MOBILE_TAB_BAR_CLEARANCE_CLASS` on any sheet.
- `server-action-reviewer` on any new/modified action (layout persist, category assign from dashboard).
- `perf-auditor` build gate once PR 2 merges — widget layer is new render path.

## Deferred / later

- **Desktop Variant B** — separate milestone. Possibly once mobile shape validates.
- **Goal widget** — needs savings_goals data model first (Flow 05 territory).
- **`spending_by_category`, `cashflow_calendar`, `debt_progress`, `merchants_this_month`, `shared_with_partner`** — catalog stubs matching RN; each gets its own ticket when prioritized.
- **RN parity** — RN already had Pulse first. After webapp ships, evaluate whether RN's Arrange mode (still open backlog) can reuse any webapp bits or stays native-gesture-only.

## Risks

1. **Storage schema churn** — adding `size` to `WidgetConfig`. Must accept absent `size` as `"S"` for existing rows. No migration, JSONB is permissive.
2. **Pulse sparkline signal** — RN still unresolved ("net cashflow vs outflow"). Decide once in PR 1 so RN + webapp agree.
3. **Drag-and-drop library** — if `@dnd-kit/core` needed, it's ~15kb. Acceptable; lazy-load if concerned.
4. **Hero replaced by Pulse** — users who expect the big "Available $X/day" hero lose the expand-in-place breakdown panel unless we preserve it in Pulse expand. **Mitigation:** Pulse expand IS the breakdown (PR 1 scope).
5. **Mobile tab bar overlap** — `AddWidgetSheet` must use `MOBILE_TAB_BAR_CLEARANCE_CLASS`.

## Visual companion

- **Current state:** `http://localhost:3000/dashboard` on mobile viewport (DevTools → iPhone 12 Pro, 390×844).
- **Target state:** open `claude-ai-design/Zeta Wireframes.html` in browser, scroll to "Flow 02 · Home — Variant B / Bold (Widget-driven)". Frames B1 (Glance) + B2 (Edit mode).

## Decisions (locked with user)

1. **`InicioToolRow` collapses.** The row today contains *only* the "Puedo comprarlo" button (see `inicio-tool-row.tsx`). Since Puedo-comprarlo moves to the widget catalog (decision 3), the row has nothing left — delete the component. Layout order becomes: **Pulse → Widget grid → "Organizar" toggle at bottom of widgets section → "+ Add widget" (only visible when editing)**. If we need a distinct slot below Pulse later, it gets a purpose-built component, not a resurrected tool row.
2. **No long-press.** "Organizar" toggle button sits at the bottom of the widgets section (above the add-widget CTA), not in the header. Tapping enters edit mode; button label flips to "Listo".
3. **"Puedo comprarlo" → widget catalog entry.** Removed from `InicioToolRow`. Becomes a catalog widget that opens `purchase-recommender-drawer` from its chip. Starts `available: true` in catalog (data is ready) but NOT in `DEFAULT_LAYOUT` — users opt in via Add widget.

# Polish Plan — full webapp sweep (2026-06-11)

Two multi-agent audit passes covered 16 surface groups of the webapp at the mobile (390px) lens.
This file is the continuation plan. Work through waves in order; each item cites the audit evidence.

**North star:** every screen answers "¿Voy bien?" at a glance — dense, judgment-bearing, action-oriented.
**Exemplars (do not regress):** /deudas mobile lenses, /presupuesto mobile + sandbox, dashboard HybridHero, import wizard mobile, settings hub, transaction detail, fab-menu.

---

## Done (2026-06-11 session, branch `feat/presupuesto-simular-cambio`)

- **Budget editing restored** (was: no way to edit/manage budgets at all on mobile; desktop create-only):
  - `MobileBudgetList` — tap-to-edit rows + "Sin límite" section → `BudgetEditorSheet` (edit/create/delete, fijo/variable, usar promedio)
  - `BudgetAjustesSheet` — budget mode (Flexible/Estricto) + estimated income editable post-wizard (header action slot móvil, botón Ajustes desktop)
  - Desktop grid: budgeted cards now open the editor on tap (controlled-Popover bug), Eliminar in popover
  - `deleteBudgetForCategory` action; `updateEstimatedIncome` now invalidates cache (`updateTag profile/budgets`)
  - Dead code removed: budget-page-client, budget-treemap, budget-form-dialog, upsertBudgetForCategory, getBudgets
- **Presupuesto chrome:** removed double `px-4` gutters + double tab-bar clearance (layout main already provides both); `bg-[#111]`×8 → `bg-black/10` / `bg-z-surface-2/95` tokens in scenario components
- **Wave-1 polish (4 agents):** accounts restructure, categorizar restructure, PageHeaderRow desktop-only central fix + consumer follow-through, suscripciones wiring + deseos token/copy sweep — see commits of this session

---

## Wave 2 — remaining Priority-1/2 (next session)

| Item | Surface | Effort | Notes |
|---|---|---|---|
| **UTC "today" bug family** — add `todayLocalISO()` to `lib/utils/date.ts`; fix `voice-capture-sheet.tsx:166/189/240` + `mobile-transaction-form.tsx` default date (captures after ~7pm save tomorrow) | fab-stack, tx/new | min | **correctness bug, do first** |
| Landing footer legal links are `href="#"` — wire /privacy, /terms, link /eliminar-cuenta | landing | min | trust-critical |
| Debt-direction trend chip: growing CREDIT_CARD/LOAN balance shows green ▲ — invert via `isDebtAccountType()` (`components/accounts/graph-face.tsx`) | accounts/[id] | min | correctness |
| Query-param prefill contract for `/transactions/new` (account, amount, name, category) — fixes 2 broken `?account=` callers, unblocks puedo-pagar handoff | tx/new | hrs | then add /puedo-pagar → prefilled handoff + FOCUS_MODE_PATHS |
| Replace `/settings/analytics` with the wireframe's privacy explainer + share-usage toggle; move funnel telemetry behind dev-only block | settings | hrs | last fully old-verbose page |
| Presupuesto hero honesty: surface "gastado fuera de presupuesto" (unbudgeted spend invisible today), move Restante into hero | presupuesto | hrs | |
| Sandbox exits: header back must route through dirty-draft confirm (today destroys drafts; in-card button confirms) + return to `?tab=presupuesto` | presupuesto | hrs | consider shared `useDirtyExitGuard` |
| Dashboard starter mode: mobile renders desktop starter card; mount the built-but-unreachable `InicioStarter`; tokenize `page.tsx:219` button + `:160` rgba | dashboard | hrs | + delete pulse-widget.tsx, dead `hero`/`last7Spend` plumbing |
| Remove doubled `MOBILE_TAB_BAR_CLEARANCE` wrapper at `transactions/page.tsx:108` (+ grep remaining double-applies) | transactions | min | layout main already applies it |
| Sheet body padding: `mobile-sheet-provider.tsx:151` hand-rolls padding → `MOBILE_SHEET_SAFE_AREA_CLASS` (~56px dead space under every FAB sub-sheet) | fab-stack | min | |
| Voice sheet: Registrar → BRASS_BUTTON_CLASS, direction pickers → GHOST_BUTTON_CLASS, tokenize purple/cyan context chips, formatDate() on summary | fab-stack | hrs | |
| Nav IA parity: add Deseos/¿Comprarlo?/Etiquetas/Suscripciones to desktop `WORKSPACE_NAV`; one canonical "Categorías" route (3 today); attention badge on Más tab (needs MobileTab.badge — see API gaps) | nav-chrome | hrs | |
| Delete unreachable legacy chrome: `mobile-nav.tsx`, `user-menu.tsx`, QuickViewMenu drawer branch (Topbar hamburger permanently hidden) | nav-chrome | hrs | ~150 dead lines |
| Auth CTAs → BRASS_BUTTON_CLASS (login/forgot/reset use default shadcn Button); bring forgot/reset pages up to login/signup treatment | auth | hrs | |

## Wave 3 — Priority-3 alignment

- **deudas-personales**: MobileHeader sub + backHref="/deudas"; surface computed-but-hidden `overview.overdue` as alert strip; fix 3-col overflow (compact currency); restyle with lens primitives (PANEL_INSET, Expand, DetailCell)
- **deudas/planificador**: strip PageHero prose + 4 StatCards → one context strip; lead with ScenarioPlanner; saved scenarios tappable
- **Plan tab chrome map** (`plan/page.tsx`): declarative per-tab config — MobileHeader first, MonthSelector in header action slot only on month-scoped tabs (presupuesto/recurrentes), remove from periodo/deseos; periodo tab gets MobileHeader sub + tokenized expired banner
- **Account detail**: kill triple identity statement; CompactTransactionRow → link to /transactions/[id]; cupo/disponible/utilization on credit-card hero; tappable débito banner; loading.tsx missing
- **Transaction detail**: rebuild stale loading.tsx; desktop back affordance; provider enum → Spanish label; tokenize hero gradient
- **Import desktop**: gut PageHero (3 StatCards + prose + explainer boxes) → one-line; brass action bars in step-review/reconcile; "Importar Extracto"→"Importar extracto", gender agreement
- **Onboarding**: fix voseo "Configurá" (first screen!), "aparecen→aparecerán"; collapse triple progress encoding; step count starts at "Paso 2 de 3"; currency confirm chip (silently inferred from timezone); "Importa tu extracto" on done screen for all purposes; skip on steps 2-3
- **Puedo-pagar**: FOCUS_MODE_PATHS + prefilled handoff (depends on Wave-2 prefill contract)
- **Plan desktop resumen**: status headline instead of "Tu capa estratégica"; delete meta-advisory box (plan-hero.tsx:148); stat captions → judgments
- **Mobile avatar menu**: add sign-out (mobile has none in chrome!) + attention line
- **Landing 390px**: demote 3rd/4th hero CTAs to text links; extract duplicated AuthErrorBanner ×5; re-skin global-error.tsx (light-gray + indigo on obsidian app)

## Chrome API gaps (prereqs for the above)

1. `MobileHeader` sub variant: add `subtitle` prop (judgment line on drill-downs) + `hideAvatar` prop (focus-mode single escape hatch)
2. `MonthSelector`: token-canon chip variant that fits the h-12 header action slot (today shadcn outline buttons)
3. `MobileTab` + `MobileTabBar`: `badge` field + attention data channel (computed in layout, thrown away today)
4. Tab bar FAB overshoot hardcodes `-mt-4` + raw rgba glow — tie to `--z-mobile-fab-overshoot`

## Systemic sweeps (fix once, gate forever)

1. **Judgment-line primitive** in components/ui replacing stat-card-as-hero (8 call sites: accounts✓, presupuesto desktop, planificador, import desktop✓?, categorizar✓, analytics, suscripciones✓, plan captions) — then deprecate in TOKENS.md
2. **Color/button lint gate**: ESLint/CI grep banning raw color literals + bare `<Button>` default/outline outside ui/ — pairs with repo-wide sweep
3. **Dead-code sweep**: codebase-memory degree-0 query; "delete or wire the predecessor" added to redesign definition-of-done
4. **Loading-skeleton parity**: every redesign PR rebuilds the route's loading.tsx (stale skeletons undo the redesign's first impression)
5. **Spanish copy sweep**: one repo-wide pass (accents, ¿?, gender, Title Case) with fixed checklist
6. **Dead-end audit**: any card/row advertising depth must link to it (CompactTransactionRow, StatementSnapshotsCard, débito banner…)
7. **AttentionCard decision**: delete component or rework — signals as badges on owning cards (flagged on accounts✓ + presupuesto desktop + transactions)
8. **Desktop alignment pass**: accounts, presupuesto, deudas, plan resumen, import — new-era mobile beside old-verbose desktop; one scheduled pass reusing mobile primitives
9. **CLAUDE.md addition**: date GENERATION rule (todayLocalISO) next to the existing parsing rule

## Deferred / feature-scope (not polish)

- Onboarding import-first rebuild per Flow 01 frames 4-6 (P4, day+)
- Transferencia tab in mobile-transaction-form saves a plain OUTFLOW with no transfer semantics — wire real transfers or remove the tab (P1 but day+, product decision)
- "Exportar datos" (settings wireframe) doesn't exist — feature gap
- Settings hub "Datos" destructive zone rows (tone="destructive" prop is built but unused)

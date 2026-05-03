# HANDOVER — 2026-05-03 — Mobile RN ↔ Webapp parity (Phase 0 foundations)

> Supersedes prior handovers. For earlier handovers see git history (`HANDOVER.md@HEAD~N`).

Branch: `feat/mobile-shared-engines` (despite the name, it's the home for all Phase 0–2 parity work; rename on PR if desired).

## What landed (7 commits on this branch)

| Commit | Phase | Summary |
|---|---|---|
| `398f4bd` | 0a | PayoffResultCard ported to `@zeta/shared` `runScenario` (engine drift fix). 175 LOC of local sim removed. |
| `754119f` | 0b | Tab bar parity: `getMobileTabs(focus)`, `Más` tab, `useHideTabBar`, `FocusModeAccent`, `(tabs)/menu.tsx` relocation |
| `9b65fa8` | 0c | Tab-bar clearance sweep — 13 files, `paddingBottom: 100/120` → `MOBILE_TAB_BAR_CLEARANCE` constant; `useTabBarClearance` hook added |
| `15e234f` | 0d | Hardcoded color codemod — 38 files, 148 token replacements (`bg-white`, `text-gray-*`, `text-sky-*`, etc.) |
| `903a2f5` | 1 | Scaffolded `/transactions/new` (focus-mode), `/pendientes`, `/etiquetas` |
| `3d30b6e` | 2 | Enabled 3 dashboard widgets that already had implementations (next_bill, next_income, accounts) |

Mobile `tsc --noEmit` clean throughout. Shared `scenario-engine` tests green (19/19). Pre-existing failures in `auto-categorize` + `debt-stats` tests are unrelated to this branch.

## Why we stopped here

The audit's full P0 list (`BACKLOG.md` line 903–1199) is ~80 items spread across 12 phases. Phases 0–2 above are the mechanical/foundational subset. Phases 3–8 each represent multi-hour to multi-day feature work (planificador 4-step, account hero variants, destinatario CRUD, import wizard restoration). Pushing through all of them in one session would produce shallow, half-built work — better to ship foundations now and tackle each remaining phase as its own follow-up PR.

## Suggested next session

Pick one of:

- **Phase 3 planificador 4-step** — biggest UX impact, depends only on Phase 0a engines (already merged). Webapp source: `webapp/src/components/deudas/planificador/*`. Spawn `mobile-perf-doctor` after.
- **Phase 5 destinatarios CRUD** — biggest functional gap, low blast radius. Webapp source: `webapp/src/components/destinatarios/*` + `actions/destinatarios.ts`. Spawn `mobile-webapp-parity` + `mobile-sync-doctor`.
- **Phase 6 import wizard** — restores feature completeness on a cluster the user runs every month. Spawn `import-flow-doctor`.

## Deferred (still P0 in BACKLOG.md §3 onwards)

Each item below is a focused session of its own. Listed with the most natural agent gate.

### Phase 2 remainder — heavy widgets (mobile-perf-doctor)
- HealthZone (multiple meters + score + runway)
- FlujoSection (burn rate card + waterfall + cashflow charts)
- ActividadHeatmap (calendar SVG grid)
- DashboardAlerts banner
- UpcomingPayments standalone widget
- BurnRate, RunwayMiniChart sparkline
- DashboardHero / StatusHeadline + 50/30/20 strip
- MonthSelector / DashboardAccountPicker
- InicioDiscoveryRail + DemoBanner / GuestBanner / DebtFreeBanner
- `useLiveDashboard` parity (silent stale-value correction)
- `dashboard_config` Supabase persistence (mobile currently AsyncStorage only) — `mobile-sync-doctor` gate

### Phase 3 — Decision tools (mobile-webapp-parity, mobile-perf-doctor)
- Planificador: 4-step flow (Cash → Allocate → Compare → Detail), multi-cashEntry input, scenario persistence (`getScenarios`/save A/B/C cap)
- Puedo-pagar: category picker, name field, scroll-to-verdict focus, `funding_type` + `last_verdict` + `last_score` + `category_id` on save-to-wishlist
- Deseos: live re-score on list, `DeseosEnrichDrawer`, `DeseosNudgeBanner`, `DeseosReflectionCard`, bought-items section, urgency/desire-type chips, per-row CTAs

### Phase 4 — Account detail heroes
- AccountHero variants (`flip` for CC/SAVINGS, `pulse` for CHECKING/CASH/OTHER, `graph` for LOAN/INVESTMENT)
- FlipZone / CardFace / GraphFace
- BalanceGraphHero + RangePills (30/90/180/365)
- SpendingPulseHero (30-day sparkline)
- QuickActionsBar: Pagar, Transferir, Agregar, Ajustar, Más
- QuickPaymentDialog, TransferDialog, ReconcileBalanceDialog
- StatementSnapshotsCard / StatementHistoryTimeline
- Move `RecentTransactions` to use webapp's full row pattern
- Replace `Alert.alert` delete confirm with styled AlertDialog

### Phase 5 — CRUD parity (mobile-webapp-parity, mobile-sync-doctor)
- `/destinatarios`: create, edit (rename / category / active / notes), rule add/edit/delete, merge, suggestions tab, `bulkLinkToDestinatario`, delete, zone picker, spend stats / monthly chart on detail
- `/recurrentes`: template editor (RecurringFormSheet), templates strip, link-picker / merge-picker sheets, `recurring-impact-dialog`, `recurring-mini-calendar`, payment timeline, "Próximas" 30/60/90-day tile
- `/categorizar`: Auto-review tab + `bulkConfirmAutoCategory`, bulk-select + `bulkCategorize`, suggestion chips inline, undo toast
- `/categories`: `IconPicker` (Lucide+emoji), zone assignment (essentials/wants/savings), kit picker, `displayOrder` drag reorder
- `/etiquetas`: full CRUD UI (file scaffolded; needs list, create, edit, delete, assign-to-tx)
- `/movimientos`: filter pills (`tagId`, `dateFrom`, `dateTo`, `amountMin`, `amountMax`, `capture_method`), `pendingEmails` tile, "Compra consciente" entry, inline zone pickers on rows, `Link2`/`Repeat` badges
- `/transactions/[id]`: PromoteToRecurringButton, LinkPickerSheet, destinatario picker, tag picker, linked-recurring surface, installment surface, capture_method tier badge
- `/pendientes`: real list + actions (file scaffolded)

### Phase 6 — Import wizard parity (import-flow-doctor)
- Restore "Confirmar" step (current RN collapses 6 → 4)
- "Destinatarios sugeridos" sub-flow (return to wizard, not deep-link away)
- `previewImportReconciliation` parity (use canonical `ReconciliationPreviewResult`)
- Multi-statement / multi-account mapping table
- "Create account from statement" inline flow
- PDF password vault suggestions UI (`initialVaultSuggestions`)
- Pending-email-statement entry (`EMAIL_PDF_IMPORT`)
- Screenshot/OCR entry (`?mode=screenshot` + `getPendingScreenshotFile()`)
- WizardActionBar parity, `STEP_DESCRIPTIONS` Narrator, `step-results.tsx` parity

### Phase 7 — Onboarding / auth / settings (mobile-webapp-parity)
- Onboarding step count: 5 → 4 (match webapp `FUNCTIONAL_STEPS=3` + celebration)
- `finishOnboarding` server action wiring with same payload (`app_purpose`, `estimated_monthly_income/expenses`, `preferred_currency`, `timezone`, `locale`, default account, `dashboard_config`, `mobile_layout`)
- `skipOnboardingWithDefaults` path
- `trackClientEvent` analytics
- Magic-link / passwordless auth path
- `/reset-password` deep-link callback
- Auth callback error states
- `SettingsIdentityHero` (avatar + name + member-since)
- `/settings/perfil`, `/integraciones`, `/email`, `/pdf-passwords`, `/etiquetas`, `/analytics`, `/bug` sub-routes
- Tab bar: read `profile.nav_focus` from SQLite (requires column add — `mobile-sync-doctor`)

### Phase 8 — Webapp `/suscripciones` (recurring-doctor, server-action-reviewer, perf-auditor, zetas-front-guy)
- New webapp route `/suscripciones` filtering recurring templates to `SUBSCRIPTIONS_CATEGORY_ID`
- Suggested-name chips
- After ship, re-verify RN `/subscriptions` shape parity

## How to ship this branch

```sh
git push -u origin feat/mobile-shared-engines
gh pr create --title "Mobile parity foundations (Phase 0–2)" --body "$(cat <<'EOF'
## Summary
Foundations subset of the mobile RN ↔ webapp parity audit (BACKLOG.md §903+).
- Engine drift fix: PayoffResultCard now uses @zeta/shared runScenario
- Tab bar parity: getMobileTabs(focus), Más tab, focus-mode hide, brass accent
- Tab-bar clearance sweep (13 files), color token codemod (38 files)
- Scaffolds: /transactions/new, /pendientes, /etiquetas
- 3 dashboard widgets enabled (next_bill, next_income, accounts)

Phases 3–8 are deferred — see HANDOVER.md.

## Test plan
- [ ] Mobile typecheck (`pnpm --filter mobile exec tsc --noEmit`)
- [ ] Open /menu from Más tab, verify navigation
- [ ] Open /transactions/new, confirm tab bar hides + brass accent shows
- [ ] Confirm /pendientes and /etiquetas reachable
- [ ] Open AddWidgetSheet, confirm Próximo pago/Próximo ingreso/Cuentas selectable
- [ ] Run planificador, confirm payoff numbers match webapp scenario tool
EOF
)"
```

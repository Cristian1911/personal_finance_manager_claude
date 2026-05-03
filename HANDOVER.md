# HANDOVER — 2026-05-03 — Mobile RN ↔ Webapp parity (Phase 3 wrap shipped)

> Supersedes prior handovers. For earlier handovers see git history (`HANDOVER.md@HEAD~N`).

## Status snapshot

| Phase | What | Status |
|---|---|---|
| 0–2 | Engine drift fix, tab bar parity, clearance sweep, color codemod, page scaffolds, 3 dashboard widgets enabled | ✅ Shipped — PR #247 |
| 3a | Planificador 4-step (Cash → Allocate → Compare → Detail), scenario A/B/C persistence | ✅ Shipped — PR #248 |
| 3b | Deseos parity (live re-score, verdict chips, EnrichDrawer, NudgeBanner, bought section, per-row CTAs, urgency/desire chips) + Puedo-pagar parity (name, category, reset, full afford-save shape) | ✅ Shipped — PR #249 (this branch) |
| 2 remainder | Heavy dashboard widgets (HealthZone, Flujo, Heatmap, etc.) | ⏸ Deferred |
| 4 | Account hero variants + QuickActionsBar dialogs | ⏸ Deferred |
| 5 | CRUD parity (destinatarios, recurrentes, categorizar, categories, etiquetas, movimientos, tx detail) | ⏸ Deferred |
| 6 | Import wizard restoration | ⏸ Deferred |
| 7 | Onboarding / auth / settings parity | ⏸ Deferred |
| 8 | Webapp `/suscripciones` port | ⏸ Deferred |

## What landed this session (PR #249 — `feat/mobile-deseos-puedopagar-parity`)

| Commit | Summary |
|---|---|
| `6dd45dd` | Wishlist scoring + enrich/mutate repo. `getFinancialSnapshot` extracted; `scoreWishlistItemWithSnapshot` mirrors webapp `scoreItemWithSnapshot`; new repo mutations (enrich/markBought/dismissNudge/delete/persistScore) all enqueue UPDATE/DELETE through `enqueueInsert/Update/Delete`. |
| `a7f1b9c` | Deseos UI — verdict chips, EnrichDrawer, NudgeBanner (local computation: score_transition + desire_maturity), bought section (incl. `reflected`), per-row CTAs (Reevaluar / Completar / Comprado / Eliminar), urgency/desire chips. |
| `7feebfa` | Puedo-pagar — Name field, Category picker (reuses `CategoryPickerSheet`), Reset, save-to-wishlist with `last_verdict` / `last_score` / `funding_type` / `installments` / `account_id` / `category_id` / `enriched=true`. |
| `9f3806d` | Gate fixes: CC `available_balance` parity (`getSelectedAccountAvailable`), `getBoughtWishlistItems` includes `reflected`, `React.memo` on `DeseosRow` + `BoughtRow`, 30s TTL on `loadData` to skip rescore-write storm on every focus. |
| `c9edeb9` | BACKLOG entries marking Phase 3 wrap done; deferred items logged. |
| `a2f75d3` | `/simplify` pass — 10 fixes, net −77 LOC. New `mobile/components/ui/FormField.tsx` (`FieldGroup` + `SegmentedRow`); new `mobile/lib/constants/verdict.ts` (single `VERDICT_META`); `applyScore` shared helper; `getWishlistItemById` (single-row query); no-op write skip; `persistWishlistScore` branch collapse via `COALESCE`; typed urgency/funding with shared types; `formatDate` from `@zeta/shared`. |
| `dd71fdf` | Gemini comment — rename `selectedDebtAfterPurchase` → `selectedAccountCurrentDebt`. |

Mobile `tsc --noEmit` clean. Webapp build clean. `pnpm audit --audit-level high` shows 4 high in `@xmldom/xmldom` via Expo CLI dev tooling — pre-existing on `main`, not introduced.

Gates run: `mobile-webapp-parity` (2 issues found and fixed), `mobile-sync-doctor` (passed clean), `mobile-perf-doctor` (2 high fixed, 1 medium deferred).

## Tracked follow-ups (from this branch)

Logged in `BACKLOG.md` under `/deseos` and `/puedo-pagar` sections:
- **[P0] Reflections + Insights** — needs `wishlist_reflections` SQLite schema + push/pull + repository. User chose deferred over online-only fetch. Spawn `mobile-sync-doctor` when picked up.
- **[P1] Nudge variants `debt_milestone` + `budget_surplus`** — webapp computes server-side via cross-table queries. Port the budget cross-ref + the upcoming-payment heuristic.
- **[P1] Per-category `budgetRemaining`** — mobile passes `categoryId` to `analyzeLocally` but the snapshot doesn't fetch the matching `budgets` row + spent-this-month sum. Webapp does this inside `scoreItemWithSnapshot`.
- **[P1] Scroll-to-verdict** — `AppKeyboardAwareScrollView` doesn't forward refs; needs a small wrapper change first.
- **[P2] Single-tx batch persist** in `getWishlistItemsWithFreshScores` — collapse N `withTransactionAsync` calls into one.
- **[P2] SQL aggregate snapshot** — replace 1k-row scan in `getFinancialSnapshot` with `SELECT direction, SUM(...) GROUP BY direction`.

Carryover from PR #247:
- **PaymentSheet atomic balance update** (Gemini review on PR #247, line 91) — `updateAccountBalanceRemote` reads then writes a computed value; racey under concurrent payment creation. Fix is a Supabase RPC with row-level locking. Needs `supabase-migrator`.

## Suggested next session

Pick one:

1. **Phase 4 — Account heroes** (UX-visible, contained). Webapp source: `webapp/src/components/accounts/{flip-zone,balance-graph-hero,spending-pulse-hero,quick-actions-bar}*`. Add `flip` for CC/SAVINGS, `pulse` for CHECKING/CASH/OTHER, `graph` for LOAN/INVESTMENT. Spawn `mobile-perf-doctor` (animations) + `zetas-front-guy`.

2. **Phase 2 remainder — heavy dashboard widgets** (HealthZone, Flujo, Heatmap, BurnRate, Runway, DashboardHero/StatusHeadline). The dashboard is the entry point — biggest single perceived-quality jump. Skia chart work. Spawn `mobile-perf-doctor`.

3. **Phase 5 — CRUD parity** (highest functional gap, lowest UX risk). Start with `/destinatarios` (create/edit/merge/rules) since destinatarios are referenced from many surfaces. Spawn `mobile-webapp-parity` + `mobile-sync-doctor` per surface.

4. **Phase 3 follow-ups** (small, quick wins): port the `wishlist_reflections` sync table, then build `DeseosReflectionCard` + `DeseosInsights`. Or fix per-category `budgetRemaining` + scroll-to-verdict.

Avoid Phase 6 (import wizard) right after Phase 3 — too much serial shipping in the same area; let user soak Phase 3 first.

## How to ship this branch

PR #249 is open. Once approved:

```sh
gh pr merge 249 --squash --delete-branch
git checkout main && git pull origin main
```

Then for the next session, pick a phase from the table above and create a fresh branch (`feat/mobile-phase4-account-heroes` or similar).

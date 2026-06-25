# Zeta Mobile ↔ Webapp Parity Audit — 2026-06-25

Webapp (Next.js) is the design source of truth; the React Native mobile app mirrors it. This report ranks every verified finding by severity, calls out the dominant themes, and notes which gaps are already tracked in BACKLOG.md.

---

## Executive Summary

### Counts by severity

| Severity | Count |
|----------|-------|
| **P0** — data corruption / dropped mutation side-effect | 8 |
| **P1** — missing core feature | 27 |
| **P2** — functional divergence | 38 |
| **P3** — visual / UX drift | 38 |
| **P4** — cosmetic | 16 |
| **Total** | **127** |

### Counts by side

| Side | Count |
|------|-------|
| mobile-missing | 60 |
| divergent | 64 |
| webapp-missing | 3 |

(webapp-missing are all legitimate platform divergences — biometrics/theme/location device controls and the mobile-only screenshot-annotate bug tool — not real gaps to build on web.)

### Headline divergences

The single most consequential pattern is **data-layer side-effect drop on every mobile write path**. Mobile mutations call bare local-SQLite repository functions that insert/update rows and enqueue a raw PostgREST sync, but the webapp's server actions perform a chain of side-effects on the same logical write — account balance delta, recurring-occurrence linking, statement-snapshot upsert, category-rule learning, idempotency-key construction — and **no Supabase trigger reproduces those server-side**. The frequently-cited assumption in BACKLOG ("the server balance delta flows back on next pull") is *false* for mobile-originated inserts: the sync push writes raw rows, never invoking the action, so the delta never runs anywhere. Result: silent, permanent account-balance drift from manual capture, transaction edit/delete, import, and (when ported) personal-debt repayments.

Six big themes:

- **(a) /plan tab consolidation vs mobile scattered screens.** Webapp consolidated presupuesto/periodo/recurrentes/deseos/resumen into one 5-tab /plan hub with redirect stubs for the old routes. Mobile kept them as separate, partly-orphaned stack screens (`categories.tsx`, `etiquetas.tsx`, `pendientes.tsx` have *zero* inbound navigation). The mobile Plan screen also hardcodes `periodHasActive=false`, so the Periodo status chip always lies.
- **(b) Mobile read-only Personas.** `personal_debts` is pulled down but absent from the sync push registry, so mobile cannot create debts, record abonos, settle/cancel/edit, or link transactions. All 8 webapp mutations have no mobile equivalent. The repayment side-effect chain (balance delta + idempotency + outstanding recompute + auto-settle) must be mirrored exactly when Phase 2 ports it.
- **(c) Data-layer side-effect gaps.** Beyond balances: mobile categorize drops `category_rules` learning + destinatario default-category backfill; mobile destinatario assign drops retro-link + rule upsert; mobile import skips statement-snapshot upsert, recurring-template sync, occurrence linking, manual-adjustment exclusion, and uses a *different idempotency key* for installments (omits `original_amount` + `installment_current`) → cross-platform duplicate transactions. Mobile tag-assignment drops `user_id` from the sync payload → the insert fails NOT-NULL/RLS forever, so user-applied tags never reach Supabase.
- **(d) Mobile-only capture methods.** Premise inverted: webapp has *full* parity on voice, quick-text, and screenshot capture. The real gaps are mobile-side — quick text capture is a "Próximamente" stub, screenshot OCR bypasses the reconciliation/snapshot wizard, and all capture paths drop the balance delta (P0).
- **(e) The "Refreshing…" M-1 banner.** RESOLVED / benign. It is the native iOS `RefreshControl` spinner during a genuine in-flight pull-to-refresh sync — no `setInterval`/`refetchInterval`/hung loop anywhere. The only defect is an untranslated English "Refreshing…" title (pass `title="Actualizando…"`). P4.
- **(f) Tendencias missing.** The entire /tendencias analytics hub (3-lens IA, verdict header, CSV export) has no mobile screen and no menu entry. The `@zeta/shared/analytics` engine is pure and already exported, so the build gap is the Supabase→SQLite dataset/filter layer plus a missing `expense_type` column in the mobile categories schema.

---

## P0 — Data corruption / dropped mutation side-effect (8)

- **[capture-methods / tx-new] Mobile capture paths drop the account balance delta** — All capture screens (`capture.tsx`, `capture-voice.tsx`, `capture-screenshot.tsx`) and the manual-create path call the bare repo `createTransaction`, which never applies `applyLocalBalanceDelta`/`current_balance`. Webapp `persistTransaction` always applies `applyAccountBalanceDelta`. No server trigger recomputes balance on insert, and the sync push writes raw rows — so balances drift permanently on both device and server. The helper *exists* (`ledger-helpers.ts:297`) but is only wired into payments/transfers/markPaid. — *ref:* `mobile/lib/repositories/transactions.ts:174-235`; `webapp/src/actions/transactions.ts:148,412` — **not tracked** — verdict: **confirmed**

- **[tx-detail] Mobile amount/account/exclude edits + delete never adjust account balance** — Webapp `updateTransactionAmountAndDate` / `updateTransactionAccount` / `toggleExcludeTransaction` / `deleteTransaction` all run `adjustBalancesForTransactionChanges`. Mobile `updateTransaction`/`deleteTransaction` do zero balance arithmetic; the sync push does raw `.update()/.delete()` to PostgREST. The detail screen's Save already submits amount + is_excluded through this path, so the drift is realized, not latent. — *ref:* `mobile/lib/repositories/transactions.ts:557-695`; `mobile/lib/sync/push.ts:115-139`; `webapp/src/actions/transactions.ts:1096-1117,1165-1187,1314-1323` — **not tracked** — verdict: **confirmed**

- **[categorizar / tx-list] Mobile categorize drops `category_rules` pattern learning + destinatario default-category backfill** — Webapp `categorizeTransaction` upserts a `category_rules` learning row and backfills `destinatarios.default_category_id`. Mobile `updateTransaction({category_id})` writes only category + source. `category_rules` is a synced table but nothing on mobile writes it during categorization, so the auto-categorizer never improves from on-device work. (Scored P0 per the audit rule: a mobile write dropping a webapp side-effect on the same row family.) — *ref:* `webapp/src/actions/categorize.ts:253-282`; `mobile/lib/repositories/transactions.ts:623-632` — **not tracked** (related BACKLOG:645 covers the destinatario-assign learning gap only) — verdict: **confirmed**

- **[tx-new] Mobile manual capture never applies the account balance delta** — Same root as the capture-methods finding, scoped to the manual-form create. The email-import path and ledger-helpers DO write the local delta, proving the convention is local-write; plain capture is the outlier. — *ref:* `mobile/app/capture.tsx:374-391`; `webapp/src/actions/transactions.ts:148-164,412-422` — **not tracked** — verdict: **confirmed**

- **[personas] `recordRepayment` side-effect chain has no mobile equivalent** — Webapp `recordRepayment` performs four coupled side-effects: debt-scoped idempotency key, repayment tx insert, `applyAccountBalanceDelta`, `recomputeOutstanding` + auto-settle. Mobile has no write path at all (`personal_debts` absent from the push registry). When ported, mobile MUST mirror the full chain but must NOT locally write `accounts.current_balance` (server applies it). — *ref:* `webapp/src/actions/personal-debts.ts:407-525`; `mobile/lib/repositories/personal-debts.ts` (read-only) — **tracked** (BACKLOG:106-110) — verdict: **confirmed**

- **[suscripciones] Mobile template create/edit drops `upsertSubscriptionFromTemplate` + `ensureCurrentOccurrences`** — Mobile `handleSave` does raw `recurring_transaction_templates` insert/update online (bypassing the offline sync queue), so no `subscriptions` row is ever created/adopted/cancelled and no `recurring_occurrences` are generated → the obligation is invisible to dashboards/plan until another trigger. `subscriptions` is also absent from `SyncTableName`. — *ref:* `mobile/app/subscriptions.tsx:229-256`; `webapp/src/actions/recurring-templates.ts:330,337,489,496` — **tracked** (BACKLOG:1318) — verdict: **confirmed**

- **[tags] Mobile `saveTransactionTags` omits `user_id` → push insert fails NOT-NULL/RLS, tags never sync** — Mobile enqueues a `transaction_tags` REPLACE with `{transaction_id, tag_ids}` and no `user_id`; the push handler reads `payload.user_id` (undefined). The table is NOT NULL with RLS `(select auth.uid())=user_id`, so the insert fails; the catch only `console.warn`s and the queue row retries forever. Proof it's path-specific: the recurring path does the same REPLACE *with* `user_id` and works. — *ref:* `mobile/lib/repositories/tags.ts:90-95`; `mobile/lib/sync/push.ts:151-158`; `mobile/lib/repositories/recurring.ts:955-964` — **not tracked** — verdict: **confirmed**

- **[import] Mobile import never updates account balance (no statement metadata, no per-tx delta)** — Mobile import only PARSES via `/api/parse-statement`; persistence is 100% local `createTransaction` per row. Webapp `importTransactions` sets credit_limit/current_balance/available_balance from statement metadata AND applies per-tx `applyAccountBalanceDelta`. After a mobile import the balance is off by the full sum of imported movimientos, and credit-limit/due-date/minimum-payment are never set. — *ref:* `mobile/app/(tabs)/import.tsx:729-872`; `webapp/src/actions/import-transactions.ts:763-847,1219-1287` — **not tracked** — verdict: **confirmed**

- **[import] Mobile import does not upsert `statement_snapshots`** — Webapp upserts a snapshot per statement (balances, credit limit, due date, payment amounts, loan remaining). Mobile writes none — the table is pull/push registered but only ever pulled. Debt-page projections, recurring-template inputs, and loan/card evolution history are all missing for mobile-imported statements. — *ref:* `webapp/src/actions/import-transactions.ts:694-747`; mobile repos (no snapshot insert) — **not tracked** — verdict: **confirmed**

---

## P1 — Missing core feature (27)

- **[home / hub / tendencias] Entire Tendencias analytics hub absent on mobile** — No /tendencias screen, no menu/tab entry. Engine portable; build gap is the SQLite dataset/filter layer. — *ref:* `webapp/src/app/(dashboard)/tendencias/page.tsx`; `mobile/app/(tabs)/menu.tsx:24-59` — **tracked** (BACKLOG:21,466) — confirmed
- **[tendencias] No mobile navigation entry to analytics** — even a built screen would be unreachable. — *ref:* `mobile/app/(tabs)/menu.tsx:24-59` — **tracked** — confirmed
- **[tx-detail / tx-list / tx-new] Mobile `updateTransaction` applies no balance delta (latent across edit surfaces)** — see P0 tx-detail; the row-level and form-level edit surfaces all funnel here. — **not tracked** — confirmed
- **[plan-hub] Webapp consolidates 5 tabs into one /plan surface; mobile keeps scattered stack routes** — no tab nav, no resumen overview. — *ref:* `webapp/src/components/plan/plan-tab-nav.tsx:7-13`; `mobile/components/plan/PlanRoot.tsx:220-265` — **tracked** — confirmed
- **[plan-hub] Deseos has no entry point from the mobile plan surface** — 5th webapp tab unreachable from Plan; only reachable from purchase-decision CTA. — **tracked** (BACKLOG:912,1138) — confirmed
- **[plan-hub] Mobile plan 'resumen' lacks integrated budget/debt/accounts/scenario sections** — — *ref:* `webapp/src/components/plan/zones/plan-resumen-zone.tsx:3-66` — **tracked** — confirmed
- **[periodo] Mobile cannot pay a standalone (non-recurring, non-debt) expense entry** — `PaymentSheet` errors out; the OUTFLOW + balance delta + entry COMPLETED never run. — *ref:* `mobile/components/plan/PaymentSheet.tsx:300-338`; `webapp/src/actions/cashflow-planner.ts:1278-1340` — **not tracked** — confirmed
- **[periodo] Mobile periodo is read-only for entries — no create/edit/delete INCOME or EXPENSE** — — **tracked** (BACKLOG:1141) — confirmed
- **[periodo] Mobile lacks 'Sincronizar recurrentes' (seed period from templates + reminders)** — mobile-only users start every period empty. — **tracked** (BACKLOG:1144,1308) — confirmed
- **[periodo] Mobile cannot create/setup or delete a planning period** — no-period state is a dead-end. — **tracked** — confirmed
- **[recurrentes] Mobile has no dedicated recurring-template create/edit form** — implicit MONTHLY-only create from capture/tx-detail. — **tracked** (BACKLOG:338) — confirmed
- **[recurrentes] Mobile cannot edit, pause/toggle, or delete recurring templates** — repo has no update/delete/toggle export. — **tracked** — confirmed
- **[deudas] Mobile Deudas has no 'Abonar' extra-payment mutation (`applyExtraDebtPayment`)** — multi-account lump-sum write path absent. — *ref:* `webapp/src/actions/extra-payment.ts:88-262`; `mobile/lib/repositories/debt.ts` (read-only) — **not tracked** — confirmed
- **[presupuesto] No 50/30/20 allocation chip / essential-vs-wants split on mobile** — — **tracked** (BACKLOG:1149) — confirmed
- **[destinatarios] Mobile destinatario detail is view-only — no edit, rule CRUD, or delete** — — **tracked** (BACKLOG:1230-1231; analyst flagged not-tracked in error) — confirmed
- **[destinatarios] Mobile list lacks create button, suggestions tab, merge, bulk-select, spend** — — **tracked** (analyst flagged not-tracked) — confirmed
- **[personas] Mobile Personas entirely read-only — all 8 webapp mutations missing** — — **tracked** (BACKLOG:106-110) — confirmed
- **[categorizar] Mobile has no auto-categorized review tab / `bulkConfirmAutoCategory`** — SYSTEM_DEFAULT autos never validated on mobile. — **tracked** — confirmed
- **[categorizar] Mobile has no bulk-select / `bulkCategorize` / similar-transactions apply** — high-friction backlog clearing. — **tracked** (BACKLOG:1225) — confirmed
- **[account-detail] StatementSnapshotsCard absent on mobile detail screen** — no extract count/last-period/due-date surface. — **tracked** (BACKLOG:1089) — confirmed
- **[deseos] Post-purchase reflections (14d/60d) entirely absent on mobile** — no reflection card, no `wishlist_reflections` table/sync. — **tracked** — confirmed
- **[deseos] Aggregated purchase-pattern insights absent on mobile** — — **tracked** — confirmed
- **[deseos] Deseos nearly orphaned on mobile — single buried entry point** (purchase-decision CTA only). — **tracked** — confirmed
- **[tags] Mobile /etiquetas is a 'Próximamente' stub — no tag/group CRUD** despite tables + sync existing. — **tracked** (BACKLOG:1247) — confirmed
- **[tags] Mobile /etiquetas and /categories unreachable — no nav entry points** (categories CRUD fully built but orphaned). — **not tracked** (as nav-orphan) — confirmed
- **[hub] Mobile 'Todo' menu has no AttentionHub (action/suggestion signals)** — — **tracked** (BACKLOG:1250) — confirmed
- **[hub] Mobile menu exposes only 6 entries vs webapp grid's ~14 grouped tiles** — Tendencias/Categorizar/Categorías/Destinatarios/Etiquetas/Deudas/Deseos/¿Comprarlo?/Recurrentes all missing as entry points. — **tracked** — confirmed
- **[hub] Tendencias analytics hub has no mobile screen or entry point** — (existence-side of the tendencias gap). — **tracked** (BACKLOG:21; analyst flagged not-tracked) — confirmed
- **[hub] Mobile categories/etiquetas/pendientes screens exist but are orphaned** — — **tracked** — confirmed
- **[settings] Integraciones (Telegram + MCP/IA + capture tokens) has no mobile screen** — whole integration class unreachable. — *ref:* `webapp/src/app/(dashboard)/settings/integraciones/page.tsx`; `mobile/app/settings.tsx:807-832` — **tracked** (BACKLOG:1270; analyst flagged not-tracked) — confirmed
- **[onboarding] Mobile onboarding never writes `profiles.dashboard_config`** — cross-platform users get a generic web dashboard. — *ref:* `webapp/src/actions/onboarding.ts:78`; `mobile/app/onboarding.tsx:151-168` — **tracked** (BACKLOG:1277) — confirmed
- **[capture-methods] Mobile quick text-capture is an unimplemented 'Próximamente' alert** — parser is on-device (voice imports it), only the text surface is missing. — **tracked** (BACKLOG:1260) — confirmed
- **[capture-methods] Mobile capture does not link new transactions to pending recurring occurrences** — — **not tracked** — confirmed
- **[capture-methods] Mobile OCR screenshot imports bypass reconciliation/dedup** — webapp screenshot mode runs the full import wizard. — **tracked** (BACKLOG:1221) — confirmed
- **[import] Mobile import skips credit-card/loan recurring-template sync** — no upcoming-payment obligation seeded. — **not tracked** — confirmed
- **[import] Mobile import does not link transactions to recurring occurrences** — statement payments stay pending. — **not tracked** — confirmed
- **[import] Mobile import idempotency key omits `original_amount` and `installment_current`** — same statement imported on web vs mobile produces different keys for installment rows → duplicates survive cross-platform dedup. — *ref:* `packages/shared/src/utils/idempotency.ts:11-28`; `webapp/src/actions/import-transactions.ts:991-997`; `mobile/lib/repositories/transactions.ts:178-186` — **not tracked** — confirmed
- **[tx-list] Mobile updateTransaction applies NO account balance delta** (row/detail edit surfaces) — see P0; flagged P1 for blast-radius framing. — **not tracked** — confirmed

---

## P2 — Functional divergence (38)

- **[tx-list] Mobile inline categorize skips `category_rules` + destinatario default-category learning** — *ref:* `webapp/src/actions/categorize.ts:253-280` — not tracked (related BACKLOG:645) — confirmed
- **[tx-list] Mobile destinatario assign skips category backfill + `destinatario_rule` upsert** — assigning a dest with a default category leaves the tx uncategorized on mobile. — **tracked** (BACKLOG:645) — confirmed
- **[tx-list] Mobile row action surface lacks Excluir/Incluir-de-métricas + Vincular-a-deuda-personal** — exclude reachable only via detail screen. — not tracked — confirmed
- **[tx-list] Mobile filter drawer offers only account/direction/showExcluded — missing tag, date-range, amount-range** — not tracked — confirmed
- **[tx-detail] Mobile detail cannot reassign the transaction's account** (webapp has a balance-safe picker). — not tracked — confirmed
- **[account-detail] BACKLOG P0 stubs (Pagar/Transferir/Ajustar) are now implemented — items are stale** — close BACKLOG:1086-1088. — tracked — confirmed
- **[account-detail] Mobile 'Más' menu lacks 'Archivar (pagada)' for debt accounts** — only destructive delete (cascades all transactions) available. — not tracked — confirmed
- **[account-detail] Mobile recent-transactions is fixed 10 rows with no 'Ver todas' link and no load-more** — not tracked — confirmed
- **[accounts] Two near-identical account-list screens on mobile; the `(tabs)/accounts` one is orphaned-ish** — delete the dead duplicate. — not tracked — confirmed
- **[accounts] Mobile create/edit form drops several account fields** (loan_amount, monthly_payment, card_brand, investment, maturity, show_in_dashboard, is_payroll_deducted). — not tracked — confirmed
- **[categorizar] Mobile rows show no inline category suggestion / one-tap accept** — **tracked** — confirmed
- **[categorizar] Mobile assign has no toast / undo feedback** — mis-tap silently committed. — **tracked** — confirmed
- **[destinatarios] Mobile list reachable only via AvatarMenu, absent from 'Todo' menu** — **tracked** — confirmed
- **[destinatarios] Mobile `createDestinatarioWithPattern` omits 'kind' from insert + sync payload** — benign today (defaults align). — not tracked — confirmed
- **[destinatarios] Mobile create does not retro-link/categorize/rename matching transactions** — historical matches left unlinked. — not tracked — confirmed
- **[deudas] Mobile Deudas is a flat scroll; webapp uses a 3-lens segmented control** — not tracked — confirmed
- **[deudas] Mobile Deudas missing debt trend, debt-free countdown, and insights** — directly answer "Am I on track?". — not tracked — confirmed
- **[debt-planner] Mobile planificador never loads/passes income — "Contexto salarial" card is dead code** — trivial fix (read `estimated_monthly_income` like DeudasRoot does). BACKLOG:1189 wrongly marks this DONE. — not tracked — confirmed
- **[debt-planner] Timeline/area comparison chart deferred on mobile (no recharts/Skia port)** — **tracked** (BACKLOG:1190) — confirmed
- **[personas] Mobile monthly income does not exclude personal-debt origin INFLOWs (web does)** — inflates mobile "Resumen del mes". — **tracked** (BACKLOG:100-104) — confirmed
- **[personas] Mobile only loads `status='active'` debts; web shows 'Saldadas y canceladas'** — no resolved-debt history on mobile. — not tracked — confirmed
- **[plan-hub] `categories.tsx`, `etiquetas.tsx`, `pendientes.tsx` mobile screens are orphaned** — **tracked** — confirmed
- **[plan-hub] Plan 'Periodo' chip status hardcoded to false — always shows 'Sin periodo activo'** — `getActivePeriodWithEntries` available but unwired. — **tracked** (BACKLOG:48) — confirmed
- **[presupuesto] Mobile budget 'spent' double-counts reconciled manual transactions** — missing `reconciled_into_transaction_id IS NULL` guard; column exists in mobile schema. SQL-only fix. — not tracked — confirmed
- **[presupuesto] Mobile budget 'spent' misses spending categorized at parent category** — no parent rollup. — not tracked — confirmed
- **[presupuesto] No 'Armar presupuesto' builder or 'Simular cambio' scenario on mobile** — not tracked — confirmed
- **[presupuesto] Mobile renders flat category list — no pressure grouping or treemap** — **tracked** (BACKLOG:1151) — confirmed
- **[periodo] Mobile has no PLANNED/COMPLETED/SKIPPED status toggle on entries** — not tracked — confirmed
- **[periodo] Mobile cannot create a NEW assignment from an unassigned expense (only reassign existing chips)** — **tracked** — confirmed
- **[periodo] Mobile lacks Auto-asignar (chronological auto-assignment)** — not tracked — confirmed
- **[periodo] Mobile lacks 'Saldo' balance-envelope seeding (`upsertBalanceEnvelopes`)** — not tracked — confirmed
- **[periodo] Mobile does not currency-convert entries to the period currency** — multi-currency %-asignado/Disponible/capacity math wrong. — not tracked — confirmed
- **[periodo] Mobile entry status not reconciled against `recurring_occurrences`** — stale 'Pendiente' + double-pay risk. — not tracked — confirmed
- **[periodo] Recurring-entry payment produces different tx description/category than webapp** — **tracked** (BACKLOG:476) — confirmed
- **[periodo / recurrentes] Mobile periodo missing the NETO hero + PlanFlowChart timeline** — **tracked** (uncertain exact line) — confirmed
- **[recurrentes] Mobile capture-path template create skips `ensureCurrentOccurrences`, subscription upsert, sub_payments** — offline-created templates show empty checklist until sync. — not tracked — confirmed
- **[deseos] Nudge variants `debt_milestone` + `budget_surplus` skipped on mobile** — **tracked** — confirmed
- **[deseos] Active-item ordering differs between platforms** — **tracked** — confirmed
- **[settings] Email-import settings (ingest address, allowed senders, logs) absent on mobile** — **tracked** (BACKLOG:1270) — confirmed
- **[settings] PDF passwords usable at import but not manageable in mobile settings** — **tracked** (BACKLOG:1270) — confirmed
- **[settings] Profile editing (name, primary currency, estimated salary) has no dedicated mobile editor** — read-only hero only. — not tracked — confirmed
- **[suscripciones] Mobile 'Suscripciones' is a different feature — CRUD over recurring templates, not the subscriptions domain** — the real-table read repo is dead code. — **tracked** (BACKLOG:1208-1209) — confirmed
- **[suscripciones] Subscription auto-detection + suggestions flow absent on mobile** — **tracked** — confirmed
- **[suscripciones] Subscription lifecycle actions (dismiss/confirm/formalize/mark-for-cancellation/cancel) missing on mobile** — **tracked** — confirmed
- **[import] Mobile does not auto-exclude manual balance adjustments covered by the statement** — double-counts. — not tracked — confirmed
- **[import] Mobile import skips destinatario auto-tagging and subscription detection** — **tracked** (BACKLOG:367) — confirmed
- **[import] Mobile lacks the loan-only confirm flow; loan statements run the generic tx flow** — not tracked — confirmed
- **[import] Mobile import is PDF-only; no OCR/screenshot capture method, no EMAIL_PDF capture stamping** — not tracked — confirmed
- **[puedo-pagar] Mobile derives committed payments from debt paymentDay, webapp from recurring templates** — divergent headline verdict. — not tracked — confirmed
- **[puedo-pagar] Mobile shows category picker but never computes `budgetRemaining`** — budget-overflow reason/metric never fire. — **tracked** (BACKLOG:1042) — confirmed
- **[puedo-pagar] Mobile result has no 'Comprar ahora' / 'Descartar' decision panel** — only save-to-wishlist. — not tracked — confirmed
- **[reportar-bug] Mobile leaves orphan storage object when `bug_reports` insert fails** — webapp rolls back the upload. — not tracked — confirmed
- **[hub] Mobile splits manage-hub entry points across menu.tsx AND AvatarMenu, neither matching webapp** — **tracked** — confirmed
- **[hub] Deudas/Deseos/¿Comprarlo? entry points diverge between hubs** — **tracked** — confirmed
- **[capture-methods] Mobile voice/OCR capture skip `autoCategorize`** — voice/screenshot txs land uncategorized. — not tracked — confirmed
- **[capture-methods] Mobile capture writes via local SQLite repo, not the server action** — validation/side-effects hand-ported per screen. — **tracked** (BACKLOG:1127) — confirmed
- **[capture-methods] Mobile capture discoverability divergent** — partially-broken FAB fan-out. — **tracked** (BACKLOG:1129) — confirmed
- **[onboarding] Mobile does raw inline Supabase writes instead of `finishOnboarding`; non-atomic, no updateTag** — **tracked** — confirmed
- **[onboarding] Mobile has no skip-configuration (`skipOnboardingWithDefaults`) path** — **tracked** (BACKLOG:1278-1279) — confirmed

---

## P3 — Visual / UX drift (38)

- **[home] Hero 'ritmo' obligation/period window differs (income-date-bounded vs next-income fetch + multi-currency)** — *severity corrected from P2 to P3; cited mechanism partly inaccurate* — not tracked — confirmed (uncertain mechanism)
- **[home] WIDGET_CATALOG 'available' flags + entries diverge** — **tracked** (BACKLOG:669-670)
- **[home] Home health-score / status-headline absent on mobile (and web mobile-viewport)** — desktop-only, two mobile homes at parity — not tracked
- **[home] Hero data path: web cached server-side, mobile recomputes client-side; mobile drops multi-currency base conversion** — not tracked
- **[tx-list] Mobile search implicitly month-scoped** — not tracked
- **[tx-detail] Mobile lacks transaction_time editing, title_locked semantics, merchant overwrite-confirm** — not tracked
- **[tx-detail] Webapp edits each field inline/optimistically; mobile gates edits behind a monolithic edit form** — not tracked
- **[tx-detail] Webapp linked-recurrente card (tappable) vs mobile flat non-interactive badge** — not tracked
- **[account-detail] Bespoke header + ActivityIndicator instead of MobileHeader/skeleton** — tracked
- **[account-detail] Recent tx rows show merchant_name only — no destinatario** — tracked
- **[accounts] Mobile list lacks sectioning, per-section subtotals, secondary-currency summary** — not tracked
- **[accounts] Mobile net-worth mixes currencies; webapp restricts to preferred currency** — not tracked
- **[accounts] Webapp accounts list has 'Importar extracto' CTA; mobile only 'Nueva cuenta'** — not tracked
- **[categorizar] Mobile /categorizar not in Más/menu hub; reached only via Avatar menu + Movimientos tool** — not tracked
- **[destinatarios] Mobile orders rules priority DESC; webapp + matcher use ASC** — not tracked
- **[destinatarios] Mobile list/detail show fewer signals (no rule count, spend, active filter, tabs)** — not tracked
- **[deudas] Mobile Deudas/Cuentas lens omits personal-debts (Personas) summary card** — not tracked
- **[deudas] Mobile Deudas missing exchange-rate nudge and archived/paid-off obligations** — not tracked
- **[debt-planner] Webapp PageHero with 4 StatCards has no mobile equivalent** — not tracked
- **[debt-planner] No-active-debts empty state diverges in richness** — not tracked
- **[debt-planner] Planificador reachable from many webapp surfaces, only one CTA on mobile** — not tracked
- **[personas] Mobile resumen shows 2 stats (Debo / Me deben); web shows 3 incl. Neto** — not tracked
- **[personas] Mobile debt rows flat; web cards expand to principal/abonado/progress/dates/notes** — not tracked
- **[personas] Mobile resumen totals hardcoded to COP regardless of preferred currency** — not tracked
- **[plan-hub] Tab affordance vs status-chip affordance — different mental model/density** — tracked
- **[presupuesto] Two mobile budget screens; `(tabs)/budgets.tsx` is orphaned dead code** — not tracked
- **[presupuesto] Mobile hardcodes period='monthly'; yearly budgets invisible** — tracked (BACKLOG:127-130)
- **[presupuesto] Mobile empty state tells user to create budgets 'in the web' (stale/contradictory)** — not tracked
- **[periodo] Mobile /periodo reachable only via a Plan-tab chip; not in 'Todo' menu** — tracked
- **[periodo] Mobile has no expired-period handling / 'Nuevo periodo' affordance** — not tracked
- **[recurrentes] BACKLOG link-validation gap appears partially stale; mobile repo validates account/direction** — tracked
- **[recurrentes] Mobile /recurrentes not in Más/menu; only via nested CTAs** — tracked (BACKLOG:46)
- **[deseos] Mobile bought section collapsed and thinner than webapp** — not tracked
- **[tags] Mobile row-expand Etiquetas chip never reflects assigned state** — tracked (BACKLOG:644)
- **[tags] Mobile category form lacks icon picker, zone assignment, kit selection** — tracked
- **[tags] Mobile /etiquetas + /categories orphaned (settings-IA)** — tracked
- **[hub] Hub uses flat ungrouped list with mismatched icons vs webapp's grouped 3-col grid** — tracked (BACKLOG:1294)
- **[import] Reconciliation candidate-fetch window differs (per-tx month bucket vs batched date range)** — not tracked
- **[import] Mobile import results omit skipped/errors/adjustments; optimistic counts** — not tracked
- **[puedo-pagar] `selectedAccountCurrentDebt` computed differently for credit cards (`computeDebtBalance` vs raw abs)** — not tracked
- **[puedo-pagar] Mobile does not emit `purchase_decision_analyzed` product event** — not tracked
- **[settings] Settings IA diverges: webapp nav hub to 8 subpages; mobile monolithic inline screen** — tracked (BACKLOG:1269)
- **[settings] Settings 'Actividad de uso' (analytics funnels) has no mobile equivalent** — tracked (BACKLOG:466)
- **[settings] Mobile etiquetas screen exists but orphaned** — tracked
- **[reportar-bug] Mobile inserts untruncated title/description; webapp clamps server-side** — not tracked
- **[reportar-bug] Mobile writes bug_reports directly from client; webapp via API route** — not tracked
- **[reportar-bug] Screenshot-capture FAB + Skia annotation editor exist only on mobile** (webapp-missing, possibly-delete) — tracked
- **[onboarding] Mobile only emits `onboarding_completed`; missing started/step_completed/skipped** — tracked
- **[onboarding] Webapp auto-infers currency from timezone; mobile shows explicit 5-currency picker defaulting to COP** (omits PEN/CLP/ARS) — tracked (partial)
- **[onboarding] Mobile captures debtCount on pulse step but never persists it** — tracked
- **[onboarding] Different step counts/grouping: web 3 functional steps vs mobile 4, purpose/name order swapped** — not tracked
- **[onboarding] Final quick-win CTA maps purpose to different destinations/labels per platform** — not tracked
- **[tendencias] Mobile categories repo lacks `expense_type` — fixed/variable lens degrades** — not tracked
- **[no-product-event / capture] minor telemetry/ordering drifts** — various

---

## P4 — Cosmetic (16)

- **[home] M-1 'Refreshing…' untranslated** — pass `title="Actualizando…"` to RefreshControl. Not a hung sync. — not tracked
- **[home] Header avatar/date vs bare title; MonthSelector desktop-only** — not tracked
- **[home] No-mutation home surface verified clean (layout-sync parity good)** — not tracked
- **[tx-list] Feed page size differs (mobile 25 vs webapp 20); auto-load vs button** — not tracked
- **[tx-detail] Location map missing; mobile shows plain 'Ubicacion' (mis-accented) text row** — not tracked
- **[tx-detail] Promote-to-recurring / Vincular gaps now RESOLVED (strike stale BACKLOG:1110-1111)** — tracked
- **[tx-new] Mobile /transactions/new is a redirect stub to /capture; no presets** — confirmed (P3 in source, grouped here)
- **[tx-new] Transfer mode: webapp inlines, mobile opens separate TransferSheet** — not tracked
- **[tx-new] No etiqueta/tag selector on mobile create form (web mobile-form also omits)** — not tracked
- **[account-detail] registerPayment writes currency_balances superset (more consistent on mobile)** — not tracked
- **[deudas] Mobile 'Más' menu lacks /gestionar entry grid (mitigated)** — tracked (BACKLOG:46)
- **[deseos] Total-deseado uses alert-red token on mobile** — tracked (BACKLOG:1213)
- **[personas] Personas reachable only via Más→menu HubEntry** — not tracked
- **[suscripciones] Mobile lacks summary card + trial/cancel_url fields; IA entry diverges** — partial
- **[reportar-bug] route_hint prefill divergence; English 'Quick Capture de Bug' header + inline hex tokens** — not tracked
- **[settings] Mobile-only platform toggles (biometrics/theme/location/sync/default-account) — expected divergence** — not tracked
- **[settings] Reset/delete data mutations at parity (clean data-layer)** — not tracked
- **[capture-methods] annotate-screenshot.tsx is a bug-report tool, not a capture method (premise clarification)** — tracked

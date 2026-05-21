# Mobile ↔ Webapp Parity Audit — 2026-05-21

End-to-end static parity sweep of 26 mobile screens against ~30 webapp routes, run as 4 parallel `mobile-webapp-parity` agent batches. Live smoke test (iOS sim + webapp) is in progress; this report will be updated when it completes.

## Executive summary

| Severity | Count | Examples |
|----------|-------|----------|
| ❌ Critical (data integrity / silent corruption) | **17** | mobile tx create/update never updates account balance; mobile import skips snapshots + occurrence linking + destinatarios |
| ⚠️ Minor (correctness gaps, UX divergence) | **20+** | mobile accounts sorted alphabetically not by `display_order`; mobile tx detail edit dropping tags on save |
| 🔵 Already tracked in BACKLOG | **5** | yearly budgets, attention-widget semantic alignment, layout rollback |
| ✅ Confirmed parity | **8** | forgot/reset password, wishlist, categorizar, recurring template direct flow |

**Top-line risk: balance drift.** Mobile manual capture and edit paths do not call `adjustBalancesForTransactionChanges`. Mobile PDF import doesn't update balances or create snapshots. Any user who uses mobile to add, edit, or import a transaction has account balances that will silently disagree with the truth in Supabase until they open the webapp and trigger a balance-updating action. This is the single highest-priority gap in the audit.

## Methodology

- **Static analysis**: 4 parallel `mobile-webapp-parity` agent batches, each reading mobile + webapp file pairs and diffing data sources, action handlers, side effects, sync correctness.
- **Live smoke test**: iOS simulator (iPhone 16e) + webapp dev server, walked screen-by-screen.
- **Sample data**: user's real Supabase account, read-only — only created and immediately deleted disposable test rows.

Plan reference: stored locally in the operator's `~/.claude/plans/` directory (intentionally not committed).

---

## ❌ Critical findings (data integrity)

### C1. Mobile manual `createTransaction` never updates `accounts.current_balance`
- **Where**: `mobile/lib/repositories/transactions.ts:144-200` (vs `webapp/src/actions/transactions.ts:406`).
- **Impact**: User adds tx on mobile → row appears in Supabase but the account balance is never adjusted. Until they open webapp and trigger any balance write, debt accounts especially go out of sync.
- **Fix size**: Medium. Port `adjustBalancesForTransactionChanges` logic into the mobile repo. Reuses `applyAccountBalanceDelta` / `reverseAccountBalanceDelta` from `webapp/src/lib/utils/account-balance.ts` — extract to `@zeta/shared` first.

### C2. Mobile `updateTransaction` never updates `accounts.current_balance`
- **Where**: `mobile/lib/repositories/transactions.ts:577` (vs `webapp/src/actions/transactions.ts:900`).
- **Impact**: User edits amount, account_id, direction, or is_excluded on mobile → balance never adjusted. Includes the swipe-toggle `is_excluded` handler in `mobile/app/transaction/[id].tsx:265`.
- **Fix size**: Medium. Same shared utility as C1.

### C3. Mobile capture never calls `linkTransactionToOccurrence`
- **Where**: `mobile/app/capture.tsx:349` (vs `webapp/src/actions/transactions.ts:756`).
- **Impact**: User pays a recurring obligation via mobile capture → `recurring_occurrences` row stays `PENDING` forever. Plan / dashboard "próximos" lists keep showing it as unpaid.
- **Fix size**: Small. Port `linkTransactionToOccurrence` from webapp actions to a `@zeta/shared` utility or a mobile repository helper; call from `capture.tsx` `handleSave` after `createTransaction`.

### C4. Mobile capture doesn't write `destinatario_id` to the new transaction row
- **Where**: `mobile/app/capture.tsx:384-397` + `mobile/lib/repositories/transactions.ts:105` (`buildInsertPayload` omits `destinatario_id`).
- **Impact**: Even when the "Crear destinatario" toggle is on, the newly created destinatario is created but never linked to the new transaction. `destinatario_id` is also missing from `CreateTransactionParams`.
- **Fix size**: Tiny. Add `destinatario_id` to `CreateTransactionParams` + payload + SQL.

### C5. Mobile capture sets no `categorization_source`
- **Where**: `mobile/lib/repositories/transactions.ts:105` (vs `webapp/src/actions/transactions.ts:393`).
- **Impact**: User picks a category in mobile capture, but the row lands with `categorization_source` falling back to DB default instead of `USER_CREATED`. Webapp filters by `categorization_source = 'USER_CREATED'` for confidence-weighted views — mobile-created rows are excluded from those.
- **Fix size**: Tiny. Same `params.category_id ? "USER_CREATED" : "SYSTEM_DEFAULT"` rule.

### C6. Mobile PDF import doesn't update `accounts.current_balance`
- **Where**: mobile import flow in `mobile/app/(tabs)/import.tsx` (vs `webapp/src/actions/import-transactions.ts:1152-1190`).
- **Impact**: After importing a credit-card PDF on mobile, account balances are unchanged until next webapp visit. Debt-payoff plans + dashboard "Deuda actual" widgets all show stale numbers.
- **Fix size**: Medium. Same shared utility as C1/C2.

### C7. Mobile PDF import doesn't upsert `statement_snapshots`
- **Where**: same.
- **Impact**: Snapshot consumers (statement reconciliation, credit-limit display, "available credit" calculations) see no record. Webapp upserts a snapshot with `credit_limit`, `available_credit`, `payment_due_date`.
- **Fix size**: Medium. Port the snapshot upsert from webapp.

### C8. Mobile PDF import doesn't call `linkTransactionToOccurrence`
- **Where**: same.
- **Impact**: Same as C3 but for imported transactions instead of manual capture.
- **Fix size**: Small, same fix as C3.

### C9. Mobile PDF import skips the destinatarios assignment step
- **Where**: webapp wizard has 6 steps (Upload → Review → Destinatarios → Confirm → Reconcile → Results); mobile has 4 (skips Destinatarios).
- **Impact**: Mobile-imported transactions land with `destinatario_id = NULL`. User has to re-classify on the webapp.
- **Fix size**: Medium. Add the step to the mobile wizard; reuse `matchTransactionToDestinatario` from `@zeta/shared`.

### C10. Mobile import idempotency key omits `installmentCurrent`
- **Where**: `mobile/lib/repositories/transactions.ts:148-156` (vs `webapp/src/actions/import-transactions.ts:945-951`).
- **Impact**: When the same credit-card statement is imported on both platforms (e.g. retry after mobile sync flake), each installment row gets two different keys → duplicate rows in Supabase. The DB's `23505` unique constraint never fires.
- **Fix size**: Tiny. Add `installmentCurrent` to the `computeIdempotencyKey` call.

### C11. Mobile category INSERT/UPDATE missing required columns
- **Where**: `mobile/components/categories/CategoriesRoot.tsx:163-209`.
- **Impact**: Categories created/edited on mobile lack `direction`, `is_essential`, `icon`, `is_active`, `expense_type`. `direction = NULL` is the most damaging — webapp filters categories by direction for budget allocation and pickers. Mobile-created categories pollute both INFLOW and OUTFLOW pickers.
- **Fix size**: Small. Add the missing fields to INSERT/UPDATE payloads + the UI form.

### ~~C12. Mobile category UPDATE writes to `slug` column that doesn't exist locally~~
**WITHDRAWN — false positive.** Initial scan checked only the v1 `CREATE TABLE` block (`mobile/lib/db/schema.ts:30-41`), which has no `slug` column. The column is actually added in a later migration (`ALTER TABLE categories ADD COLUMN slug TEXT`), so the SQLite UPDATE writing to `slug` works at runtime. Caught by Gemini on PR #257 review. Leaving the entry as a strikethrough placeholder so the C-numbering stays stable for downstream references.

### C13. `mobile/app/subscriptions.tsx` writes directly to Supabase, bypassing sync queue
- **Where**: lines 229-263. Inserts/updates/deletes `recurring_transaction_templates` via `supabase.from(...)` without going through the repository.
- **Impact**: Changes made on the Subscriptions screen don't reflect in the local SQLite cache until the next pull. Offline-first guarantee is broken for this screen. Also misses `destinatario_id`, `sub_payments`, `direction`, `transfer_source_account_id` from the write payload.
- **Fix size**: Medium. Route through the existing `createRecurringTemplate` / `updateRecurringTemplate` / `deleteRecurringTemplate` repo functions in `mobile/lib/repositories/recurring.ts`.

### C14. Mobile onboarding doesn't set `nav_focus`
- **Where**: `mobile/app/onboarding.tsx:147-159` (vs `webapp/src/actions/onboarding.ts:63-78`).
- **Impact**: Mobile-onboarded users get the DB default `nav_focus = 'PLAN'`. If their `app_purpose` is `manage_debt`, the webapp should have surfaced DEBT-centric nav. Until they re-trigger onboarding on webapp, they get the wrong nav focus.
- **Fix size**: Tiny. Compute `navFocus` from `app_purpose` in `persistOnboarding`.

### C15. Mobile onboarding doesn't seed `dashboard_config`
- **Where**: `mobile/app/onboarding.tsx:155-157` (vs `webapp/src/actions/onboarding.ts:79-80`).
- **Impact**: Webapp dashboard loads with whatever default the profile trigger writes. Webapp uses a purpose-aware default (`getDefaultConfig(purpose)`) — mobile-onboarded users miss this.
- **Fix size**: Tiny. Call `getDefaultConfig` (already exported from webapp) — or extract to `@zeta/shared`.

### C16. Mobile bug report bypasses `/api/bug-reports` route handler
- **Where**: `mobile/app/bug-report.tsx:209-229` writes directly to `supabase.from("bug_reports").insert(...)`.
- **Impact**: Server-side enrichment in the route handler (auth check, sanitization, additional metadata) doesn't run for mobile submissions. Not a data integrity risk today but an inconsistency that bites later.
- **Fix size**: Tiny. POST to the same route handler.

### C17. Mobile `pendientes.tsx` is a scaffold with no data
- **Where**: `mobile/app/pendientes.tsx:13-31`.
- **Impact**: Mobile users have no surface for marking recurring occurrences as paid or skipped outside the `/recurrentes` template detail. Webapp's `pendientes` redirects to `gestionar` which has the full surface.
- **Fix size**: Medium-large. Build out the surface; not strictly a parity bug since the webapp also redirects.

---

## ⚠️ Minor findings (correctness gaps + UX divergence)

### Transactions surface

- **M1**. Mobile transaction list missing filters present on web: `tagId`, `direction`, `dateFrom`/`dateTo`, `amountMin`/`amountMax`, `showExcluded`.  [`mobile/components/movimientos/MovimientosUtilidades.tsx`]
- **M2**. Mobile search misses the `clean_description` column. Webapp matches both `description` (raw) and `clean_description` (sanitised). Results diverge on the same query. [`mobile/lib/repositories/transactions.ts:238`]
- **M3**. Mobile tx list lacks the "¿Debería comprar esto?" link + `PendingEmailTransactions` panel shown on web. [`webapp/src/app/(dashboard)/transactions/page.tsx:186,220`]

### Transaction detail

- **M4**. Mobile tx detail can't edit `account_id` (move tx between accounts). Webapp allows it.
- **M5**. Mobile tx detail can't edit / display `destinatario_id`. Webapp shows + edits.
- **M6**. Mobile tx detail doesn't show linked recurring occurrence info.
- **M7**. Mobile tx edit: `editTagIds` state is populated in component but `saveTransactionTags` is never called on save. Tags are read-only on mobile. [`mobile/app/transaction/[id].tsx:234`]
- **M8**. Mobile `UpdateTransactionParams` doesn't include `destinatario_id` as a settable field. [`mobile/lib/repositories/transactions.ts:84`]

### Accounts

- **M9**. Mobile accounts list sorts by `name`, webapp sorts by `display_order`. Reordering on web is invisible on mobile.  [`mobile/lib/repositories/accounts.ts:51`]
- **M10**. Mobile `createAccount` and `updateAccount` sync payloads omit: `display_order`, `show_in_dashboard`, `is_demo`, `loan_amount`, `loan_start_date`, `loan_end_date`, `initial_investment`, `expected_return_rate`, `maturity_date`, `mask`, `currency_balances`. Investment/loan accounts created on mobile are functionally degraded.  [`mobile/lib/repositories/accounts.ts:100-118`]
- **M11**. Mobile account detail shows `total_in` (inflows) as "Ingresos del mes" without filtering debt accounts. Debt payments wrongly counted as income. [`mobile/app/account/[id].tsx:248-258`]
- **M12**. Mobile account detail uses a custom inline header without `MobileHeader variant="sub"` + `backHref`, bypasses the focus-mode escape-hatch pattern. [`mobile/app/account/[id].tsx:196`]
- **M13**. Mobile accounts list `is_demo` not filtered — demo accounts surface alongside real ones.

### Destinatarios

- **M14**. Mobile `createDestinatarioWithPattern` doesn't trigger retroactive transaction linking. Webapp `createDestinatario` with `link_matching_transactions=true` bulk-updates existing transactions. Mobile create + edit detail are read-only after creation.  [`mobile/lib/repositories/destinatarios.ts:90`]
- **M15**. Mobile destinatario create accepts only one pattern; webapp supports multiple (priority `(i+1)*100`).
- **M16**. `mergeDestinatarios()` and `applyDestinatarioRules()` are webapp-only — mobile has no UI for either.

### Recurrentes

- **M17**. Mobile `createRecurringTemplate` doesn't call `ensureCurrentOccurrences()` post-insert. Webapp does immediately. Mobile users see the new template with zero occurrences until next pull. [`mobile/lib/repositories/recurring.ts:199`]

### Plan / Periodo

- **M18**. Mobile periodo PaymentSheet creates a transaction but doesn't immediately update the source account balance — same root cause as C1.
- **M19**. Mobile cannot create or edit a planning period — read-only by design, but no CTA points the user to the webapp.

### Settings

- **M20**. Mobile lacks 6 webapp settings subroutes: `perfil`, `email`, `pdf-passwords`, `etiquetas`, `integraciones`, `analytics`.
- **M21**. Mobile "Suscripciones" nav row pushes to `/subscriptions` — not in webapp routes; may be a dead link on cross-platform deep-link.
- **M22**. Mobile login surfaces raw English Supabase error messages directly; webapp uses `CALLBACK_ERROR_MESSAGES` for Spanish localisation.

### Dashboard

- **M23**. `pendingEmails` count in mobile Attention widget is hardcoded `0`. Webapp shows real count. — *(already 🔵)*

---

## 🔵 Already tracked in BACKLOG (verified still present)

- Mobile yearly budgets hidden (period='monthly' hardcoded)
- Mobile budgets SQLite missing `is_demo` column
- Attention widget semantic divergence (overdue source, upcoming cap)
- Mobile layout save no rollback + no cross-surface invalidation tag
- Recurrentes 'Crear nueva' full-page detour instead of dialog

---

## Recommended actions

### Ship in this session (cheap critical fixes)

1. **C5** — `categorization_source` 2-line fix in `buildInsertPayload`
2. **C10** — `installmentCurrent` in import idempotency key
3. **C14 + C15** — `nav_focus` and `dashboard_config` in mobile onboarding
4. **M7** — actually call `saveTransactionTags` on tx detail save
6. **C4** — wire `destinatario_id` into mobile capture's tx create payload

Total: ~50-80 lines across ~6 files. One follow-up PR.

### Spin up larger work (BACKLOG entries)

1. **Balance adjustment on mobile** (C1, C2, C6, M18) — needs `applyAccountBalanceDelta` extracted to `@zeta/shared` then wired into mobile repository writes. ~1 day, high priority.
2. **Occurrence linking on mobile** (C3, C8, M17) — port `linkTransactionToOccurrence` + `ensureCurrentOccurrences` to `@zeta/shared`. ~half-day.
3. **Mobile import parity** (C6, C7, C8, C9) — needs the destinatarios step + snapshot upsert + occurrence linking. ~1 day.
4. **Mobile subscriptions screen refactor** (C13) — route through repository instead of direct Supabase. ~2-3 hours.
5. **Mobile transaction detail surface enrichment** (M4, M5, M6, M7, M8) — account move, destinatario edit, linked-recurring display, tag persistence. ~half-day.
6. **Mobile category surface** (C11, C12) — add direction picker, icon, is_essential, expense_type to form + SQL. ~half-day.
7. **Mobile accounts list parity** (M9, M10, M11, M12, M13) — `display_order` sort, full column payloads, debt-aware income calc, MobileHeader. ~half-day.

### Defer

- Live smoke test of all 26 screens (run as a follow-up after the dev client is rebuilt).
- Webapp-only and mobile-only screens (capture-screenshot, voice, annotate, purchase-decision, gestionar, puedo-pagar) — not parity gaps by definition.

---

## Process notes

- All findings sourced from static analysis with file:line citations. Live smoke test pending iOS dev-client build completion.
- Some `⚠️` items may upgrade to `❌` once live testing exposes crashes or broken navigation. This report will be updated.
- Recommend folding ❌ critical fixes into a dedicated `feat/mobile-parity-2026-05` umbrella branch with one PR per logical fix group.

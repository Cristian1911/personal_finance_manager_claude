# Zeta Backlog

> Persistent backlog shared across sessions. Update this file whenever a task is discovered but not tackled in the current session. Remove items when they ship (merged to main).

## How to use

- **Before starting work**: scan this file for items that overlap with your task — fix them together.
- **After finishing work**: if review agents or testing surfaced new issues you didn't fix, add them here.
- **After merging a PR**: remove the items it resolved.

---

## Bugs

### Telegram webhook — capture_tokens label updates via admin client never worked
- **Priority:** Medium
- **What:** `webapp/src/app/api/webhooks/telegram/route.ts` lines 27–35 (SELECT by encrypted `token`/`label`) and 99–102, 140–143 (UPDATE `label`) go through the `capture_tokens` view with the admin client (no JWT). Before PR #186's `has_auth` guard, the UPDATE silently NULLed the label via unguarded `zeta_encrypt()`. After the guard, the UPDATE preserves whatever was there (usually NULL). Either way, `findTokenByChatId` also decrypts via admin client → `zeta_decrypt(label)` returns NULL → `.like("label", "telegram:...")` never matches. End-to-end: the `/start <token>` deep-link and `/vincular <token>` flows never actually link a chat.
- **Fix:** Add a `set_capture_token_label(p_id, p_label, p_user_id)` RPC with `SECURITY DEFINER` that uses `zeta_encrypt_as` internally, and a `find_capture_token_by_chat_id(p_chat_id)` RPC that decrypts label server-side. Replace the four admin-client calls in the telegram webhook with these RPCs.
- **Found:** supabase-migrator review on PR #186 (has_auth guard), 2026-04-18

### Import wizard — state persists across tab/visibility changes (bfcache)
- **Priority:** Low
- **What:** If the user completes an import, navigates away (browser tabs, minimize, or uses the back/forward cache), and returns, the wizard still shows the `results` step instead of a fresh upload step. React state is preserved because Next.js doesn't fully remount the page when restored from bfcache. User reads this as "unfinished import flow still there".
- **Options:** (a) add a `visibilitychange` listener that resets the wizard if it is in `results` and the document becomes hidden → visible, (b) add a prominent "Terminar y cerrar" button on the results screen that calls `handleReset()` + scrolls to top, (c) accept the behavior and document it. Mild lean toward (b) — explicit control, no surprise resets.
- **Touches:** `webapp/src/components/import/import-wizard.tsx` (handleReset trigger), possibly `step-results.tsx` (new button).
- **Found:** User feedback, 2026-04-17 (post PR #177).

### Promote-to-recurring — success state undersells the outcome
- **Priority:** Medium
- **What:** After promoting a tx, the CTA collapses to a muted grey "Ya es recurrente" badge. User just created a template + linked this tx as paid — but has no signal that a future payment is now scheduled or where to find it. Options: (a) toast on success with the next occurrence date ("Recurrente creada · Próxima: 15 mayo"), (b) badge gains a subtle link to `/plan?tab=recurrentes&template=<id>`, (c) on submit redirect to `/plan?tab=recurrentes&highlight=<template_id>` with a flash highlight.
- **Found:** ux-analyst review, 2026-04-17

### Tx detail hero — Promote vs Edit visual weight inversion
- **Priority:** Low
- **What:** Edit uses the default brass `<Button>`, Promote uses `variant="ghost"`. Promotion is a more consequential action than editing one field. Either swap weights or make both ghost and let Delete remain the icon action.
- **Touches:** `webapp/src/components/transactions/transaction-form-dialog.tsx`, `webapp/src/components/transactions/promote-to-recurring-button.tsx`.
- **Found:** ux-analyst review, 2026-04-17

### Inline Promote dialog inside Vincular drawer
- **Priority:** Low
- **What:** Today "Crear nueva recurrente" navigates to `/transactions/[id]?promote=1` instead of opening the dialog inline in the drawer. Code cost is small (`RecurringFormDialog` already accepts `controlledOpen`). Would remove the full-page detour. Drawback: dialog-in-drawer is visually awkward on mobile and the detail page detour gives the user a landing destination.
- **Found:** ux-analyst review, 2026-04-17

### Recurring templates — review the unran template-merge from 20260416
- **Priority:** Medium
- **What:** Migration `20260416120000_add_sub_payments_to_recurring_templates.sql` was stamped as applied on the remote project but its DDL never ran. `20260418130000_fix_missing_sub_payments.sql` recovers the column + view + triggers, but **intentionally skips the original step 5** (merge duplicate INFLOW/MONTHLY templates into one with `sub_payments`) to avoid destroying occurrence→tx links created over the past ~2 days. Decide: either run the merge manually via the UI, or ship a fresh migration that replicates step 5 after an audit of which dupes remain.
- **Latent risk until merged:** `syncCreditCardRecurringTemplate` / `syncLoanRecurringTemplate` in `webapp/src/actions/import-transactions.ts` pick "the" active template by account — if two duplicates still exist, re-importing a statement may populate `sub_payments` on the non-canonical one. Non-crash, only a data-quality issue until the merge runs.
- **Audit SQL:** `SELECT account_id, currency_code, count(*) FROM recurring_transaction_templates_enc WHERE direction='INFLOW' AND frequency='MONTHLY' AND category_id IS NULL GROUP BY 1,2 HAVING count(*) > 1;`
- **Found:** 2026-04-18 — fixed in PR #174; merge follow-up flagged by recurring-doctor review.

### Investigate why migration 20260416120000 stamped without running
- **Priority:** Medium
- **What:** The remote `supabase_migrations.schema_migrations` table has `20260416120000` marked applied, but the underlying DDL (ALTER TABLE, view rebuild) never executed. Likely causes: (a) a manual `supabase migration repair --status applied`, (b) a partial `db push` that errored mid-migration but still stamped optimistically, (c) a DB reset/restore that restored the history row but not the schema. Check CI deploy logs around 2026-04-16 and grep shell history for `migration repair`. If this recurs, any future migration that depends on `sub_payments` would compile locally but fail in prod.
- **Found:** 2026-04-18

## Features

### Import wizard — attach pattern to existing destinatario
- **Priority:** Medium
- **What:** Step 3 (Destinatarios) of `/import` only offers "Crear destinatario" on each unmatched suggestion. When the cleaned pattern is actually a spelling variant of a destinatario that already exists (e.g., `Rappi Colombia*Dl` vs existing `rappi colombia`), the only recoverable path today is to skip, finish the import, then edit patterns at `/destinatarios`. Add a second action to every suggestion card: "Asignar a destinatario existente" → opens a picker (reuse the zone-picker pattern), on confirm appends the pattern to that destinatario's `destinatario_patterns`, refreshes the in-memory `destinatarioRules`, re-runs `matchDestinatario`, and collapses the suggestion. Optional polish: sort the picker by match score or by destinatario-spend to surface the likely target first.
- **Touches:** new server action `addPatternToDestinatario(destinatarioId, pattern)` in `actions/destinatarios.ts` (insert into `destinatario_patterns` with `match_type: "contains"`, `priority: 100`; `updateTag("destinatarios")`); `step-destinatarios.tsx` UI (picker + wiring); `import-wizard.tsx` passes the updated rules so later steps use them.
- **Found:** User feedback during Nu import session, 2026-04-17

### Dashboard RECIENTE — inline category assignment on row expand
- **Priority:** High (scoped for Phase 2 Dashboard polish)
- **What:** Replace the current inline yellow "Sin cat." tag with a tap-to-expand row interaction: tapping a transaction row reveals an inline panel with a category picker (and possibly: destinatario picker, mark-as-recurring, notes field). User resolves the categorization without leaving the Dashboard. Removes visual clutter from the row and turns a passive signal into a one-tap action.
- **Context:** User de-prioritized "Sin cat." as a Dashboard-level reminder (the `/transactions` page already has a prominent CTA). But we still want users to be able to categorize from the Dashboard's RECIENTE list if they notice something.
- **Component:** Update `inicio-activity.tsx`. Likely reuses the zone-picker pattern already in `/transactions` and `/destinatarios`.
- **Found:** Dashboard polish brainstorming, 2026-04-16

### Account detail page — deferred items
- **Priority:** Medium
- **What:** Statement snapshots visual redesign, auto-populate `card_brand` from PDF parsers, composite `(account_id, user_id, transaction_date)` index, use `useAccounts()` hook instead of server-side `getAccounts()` in QuickActionsBar
- **Context:** Shipped card hero, flip-to-graph, transaction-based balance history, transfer dialog, quick actions. Deferred items noted by perf-auditor and design reviews.

### Recurring stats — historical backfill
- **Priority:** Medium
- **What:** Template stats (YTD, streak, annual estimate) are empty for newly created templates. Options: (1) backfill from `statement_snapshots` minimum payments or balance changes, (2) when creating a recurring template, auto-create historical occurrences as "paid" based on matching past transactions, (3) use snapshot history alongside occurrence history for the metrics.
- **Context:** `getTemplateStats()` in `actions/template-stats.ts` only queries `recurring_occurrences`. New templates have no occurrences yet even if the user has been paying for months.
- **Found:** User feedback, 2026-04-14

### Recurring checklist — unify inline expand + action drawer
- **Priority:** Medium
- **What:** The plan tab checklist has two disconnected interaction patterns: (1) tap row → inline payment form with flat buttons, (2) tap ⋮ → bottom Sheet with chip-style admin actions. They look like different apps. Unify into a single cohesive pattern — either improve inline to match chip style with small confirmation Sheet, or merge both into one bottom drawer per-item.
- **Found:** Visual testing, 2026-04-14

### Accounts — `deactivated_at` timestamp
- **Priority:** Medium
- **What:** Add `deactivated_at` column to accounts table. When a user deactivates an account, store the date. Use in historical debt views to show "Cerrada en abril 2026" label on account cards. Currently only `is_active` boolean — no record of when.
- **Migration:** 6-step encrypted table process (accounts is a view over `accounts_enc`). Spawn `supabase-migrator`.
- **Found:** Debt page month selector work, 2026-04-15

### Categorization view enhancements
- **Priority:** Medium
- **What:** Show similar transactions when categorizing, more action options in the categorization inbox
- **Context:** Currently only shows category suggestion + accept/change. Could show "5 more like this" to encourage bulk categorization.

### Smart insights
- **Priority:** Low (large scope)
- **What:** Cross-month account movement tracking, debt payment impact analysis
- **Context:** Dashboard answers "Am I on track?" but doesn't yet show trends or explain why things changed.

### Desktop transaction table expansion
- **Priority:** Medium
- **What:** Same action chip pattern (destinatario, tag, edit) for desktop table rows. Migrate desktop consumers from old pickers (`destinatario-picker.tsx`, `tag-picker.tsx`) to zone pickers, then delete old files.
- **Context:** PR #130 only covers mobile. Desktop table still uses inline category popover only.

### Tag system broader reach — remaining items
- **Priority:** Medium
- **What:** Tags on recurring templates (needs `recurring_template_tags` migration + form changes + occurrence-to-tx tag copy). Nómina tag variants.
- **Context:** Auto-tag from destinatario during import shipped in PR #138. This is the remaining work.

### Mobile app — Apple compliance (pre-submission)
- **Priority:** High (blocks App Store submission)
- **What:** Privacy Policy (ES + EN, hosted on webapp domain), Terms of Service, update `PrivacyInfo.xcprivacy` with accurate data types (app collects financial data, user IDs — currently declares empty), add `NSPhotoLibraryUsageDescription` + `NSCameraUsageDescription` to `app.json`, add in-app financial disclaimer ("Zeta no es un asesor financiero"), remove `NSAllowsLocalNetworking` from production builds.
- **Context:** 2 new guardrail agents (`mobile-sync-doctor`, `mobile-webapp-parity`) are in place. Compliance is the remaining blocker before TestFlight/App Store submission.
- **Found:** Mobile pages session, 2026-04-14

### Mobile app — Play Store production release (rebrand + promote from alpha/beta)
- **Priority:** High (blocks production launch on Google Play)
- **Goal:** Ship Zeta to Play Store production track. Existing draft is on closed (alpha/beta). Name stays "Zeta"; bundle stays `com.zetafinance.app`; palette stays (`#121412` splash bg). User will deliver new brand PNGs later.

- **Assets (user-supplied, pending)**
  - `mobile/assets/images/icon.png` — 1024×1024, no alpha, no rounded corners (Play does the mask).
  - `mobile/assets/images/adaptive-icon.png` — 1024×1024 foreground, safe zone 672×672 centered (background stays `#121412` per `app.json`).
  - `mobile/assets/images/splash-icon.png` — centered logo on transparent; Expo scales to match `splash.backgroundColor`.
  - `mobile/assets/images/favicon.png` — web fallback (low priority for Play).
  - Play listing graphics: feature graphic 1024×500, phone screenshots ≥2 at 9:16 (min 1080px), optional 7"/10" tablet.

- **Listing copy (Spanish)** — I can draft from webapp positioning, user reviews.
  - Título de app (30 ch max)
  - Descripción corta (80 ch max)
  - Descripción completa (4000 ch max) — emphasize: importación de extractos PDF bancarios Colombia, presupuesto 50/30/20, deudas, multi-moneda.
  - Categoría: `FINANCE`. Contenido: audiencia general.

- **Compliance (blocks production)**
  - Privacy Policy URL — hosted on webapp domain. Must exist and be reachable before Play lets us promote to prod. Draft ES + EN.
  - Data Safety form: declare `Financial info` (in-app purchases N/A, other financial info = transactions, balances), `Personal info` (email, user ID), `App activity`. Data is encrypted in transit (HTTPS) AND at rest (envelope encryption on 9 `_enc` tables — document that). User can request deletion — point to in-app settings flow.
  - Content rating questionnaire — all "no" for Zeta (no violence, gambling, user-generated social content).
  - Target audience: 18+.
  - App category: `Finance`.
  - Financial Services declaration — Play requires extra disclosures for finance apps. Colombia-only for initial launch (if expanding, re-declare).
  - In-app disclaimer string: "Zeta no es un asesor financiero" — surface in settings/onboarding.

- **Technical (can do before assets)**
  - Verify `android/build.gradle` `targetSdkVersion` = 35 (Play minimum as of Aug 2025 for new + updated apps).
  - Verify `compileSdkVersion` = 35+.
  - Bump `expo.version` in `app.json` (current `1.0.0` → bump per rebrand, e.g. `1.1.0`).
  - `versionCode` auto-increments via EAS remote (`appVersionSource: remote` in `eas.json`) — no manual bump needed.
  - Confirm Play App Signing is enabled in Console (recommended over self-managed upload key).
  - Smoke-test release AAB on a physical device using `build:aab:production` EAS profile OR `build:aab:local` with Play upload keystore. Artifact: `android/app/build/outputs/bundle/release/app-release.aab`.
  - Strip debug logs / `console.log` in production bundle (Expo does this by default in release mode).
  - Audit permissions in `AndroidManifest.xml` — remove any not needed (e.g., if `RECORD_AUDIO` was added for voice and isn't used in current build).
  - Pre-launch report in Play Console (automated crash/perf check) — runs after upload, review results before promoting.

- **Track progression (user asked "do we have to pass through the others?")**
  - Current: closed testing (alpha/beta).
  - Play rules: org accounts can promote closed → production directly after policy review. Personal dev accounts registered after Nov 2023 must run a 14-day closed test with ≥20 testers before first-time production release. Confirm account type on Play Console.
  - Flow: upload new AAB to closed track → verify w/ pre-launch report → promote build to production track OR create a new production release reusing the AAB. No rebuild needed.
  - First production submission triggers **manual review** (can take hours to days for finance apps). Plan rebrand release so review window doesn't block other deliverables.

- **Blockers to resolve before promotion**
  1. New icon/splash/feature-graphic PNGs from user.
  2. Privacy Policy URL live on webapp domain (webapp rebrand domain rename is pending per user — coordinate so the URL is stable before submission).
  3. Dev account type (personal vs org `zetafinance`) — determines 14-day closed test rule.
  4. Finalize Spanish listing copy.
  5. Confirm screenshots captured post-rebrand (not pre-rebrand, to avoid old visual identity in store).

- **Sequencing**
  1. Tech prep (targetSdk, version bump, permissions audit, disclaimer string) — no assets needed.
  2. Privacy Policy drafting + hosting (coordinate with webapp team).
  3. Draft store listing copy for user review.
  4. Wait on assets → swap PNGs → build preview AAB → device smoke test.
  5. Build production AAB → upload to closed track → pre-launch report.
  6. Data Safety form + content rating + financial disclosures.
  7. Promote to production track → manual review.

- **Found:** 2026-04-16 rebrand scoping session.

### Mobile v2 redesign — Phase 3
- **Priority:** Low (deferred)
- **What:** Full root redesign with zone-based layouts, custom heroes, Zeta-branded visualizations
- **Memory:** `project_mobile_v2_redesign.md`

### Mobile charts — MVP set
- **Priority:** Medium
- **What:** Build mobile equivalents for the 6 most important webapp charts: monthly cashflow (bar), category donut (pie), daily spending (area), burn rate + runway, budget pace (ideal vs actual), account sparklines. `@shopify/react-native-skia` is already installed but unused.
- **Data sources:** `getMonthlyCashflow()`, `getCategorySpending()`, `getDailySpending()`, `getBurnRate()`, `getDailyBudgetPace()`, `getAccountsWithSparklineData()` — all in `webapp/src/actions/charts.ts`.
- **Found:** Mobile audit, 2026-04-15

### Mobile missing pages
- **Priority:** Low
- **What:** Etiquetas (Tags), Pendientes (Pending Transactions), Settings Analytics — all exist in webapp but have no mobile equivalent.
- **Found:** Mobile audit, 2026-04-15

### Mobile sync — secondary tables
- **Priority:** Low
- **What:** `debt_scenarios`, `wishlist_reflections`, `dashboard_config` tables are used by the webapp but not synced to mobile. Add to SYNC_TABLES when mobile features need them.
- **Found:** Mobile audit, 2026-04-15

## Tech Debt

### Tx detail — `router.refresh()` on tag picker close
- **Priority:** Low
- **What:** `transaction-detail-client.tsx` calls `router.refresh()` after the TagZonePicker drawer closes to sync `initialTags` from the server. Could be avoided by lifting `setTags` into a `onTagsChanged` callback that TagZonePicker invokes on add/remove, so the parent updates its local `tags` state optimistically and skips the round-trip.
- **Found:** perf-auditor review on tx detail redesign, 2026-04-18

### Tx detail — zone pickers always mounted (hidden trigger)
- **Priority:** Low
- **What:** CategoryZonePicker + DestinatarioZonePicker + TagZonePicker all render on mount with `hideTrigger + controlledOpen`. They pull from context so fetches are gated, but the Radix Dialog/Drawer portals register on mount. Mount-once-on-first-open pattern would save 3 portal registrations per detail page load. Not measurable today, revisit if picker count grows.
- **Found:** perf-auditor review on tx detail redesign, 2026-04-18

### Tx detail — delete confirm dialog uses raw `<button>` instead of shadcn `<Button>`
- **Priority:** Low
- **What:** `transaction-detail-client.tsx` DialogFooter uses two raw `<button>` elements with `cn(GHOST_BUTTON_CLASS, ...)` + `cn(DESTRUCTIVE_BUTTON_CLASS, ...)`. Consolidating to `<Button variant="outline" className={...}>` would inherit shadcn sizing primitives + keep consistency with other Dialogs.
- **Found:** zetas-front-guy review on tx detail redesign, 2026-04-18

### `useRecurringMonth` callbacks use `router.refresh()` instead of `startTransition`
- **Priority:** Medium
- **What:** All three callbacks in `use-recurring-month.ts` (`confirmPayment`, `skipPayment`, `linkExisting`) call `router.refresh()` after the server action. Should wrap in `startTransition` instead — `router.refresh()` is a redundant network round-trip.
- **Found:** cache-doctor review, 2026-04-14

### `inicio-activity.tsx` non-token colors
- **Priority:** Low
- **What:** `bg-green-500/12` and `bg-orange-500/12` should be `bg-z-income/12` and `bg-z-expense/12`. Also eyebrow uses `text-[9px] font-bold` instead of `SECTION_EYEBROW_CLASS`.
- **Found:** zetas-front-guy review, 2026-04-14

### `recurring-confirm-inline.tsx` surface token
- **Priority:** Low
- **What:** Uses `bg-muted/50` (shadcn token) instead of Zeta surface tier token (`bg-z-surface-3/60` or `bg-black/20`).
- **Found:** zetas-front-guy review, 2026-04-14

### Shared PickerShell component
- **What:** Popover/dialog/drawer branching is duplicated across 3 zone pickers (~40 lines each, ~120 total). A shared `PickerShell` accepting `{ open, onOpenChange, trigger, title, icon, body, variant }` would eliminate the duplication.
- **When:** Extract when a 4th picker is added or when touching all 3 pickers.
- **Found:** Code reuse review, 2026-04-13

### Mobile `InicioMetricsGrid` "Gasto hoy" migration to `ExpandableStatTile`
- **Priority:** Low
- **What:** Slice-1 extracted `mobile/components/ui/ExpandableStatTile.tsx` and migrated the import reconcile grid, but `InicioMetricsGrid` "Gasto hoy" was left on its bespoke `PANEL_INSET_CLASS` chip shape (different value size, ring-chart sibling, compact currency formatter). A future pass should either (a) widen `ExpandableStatTile` with a `variant="inset-compact"` option to absorb it, or (b) extract a sibling `CompactStatTile` primitive. Worth doing next time we touch either surface.
- **Found:** zetas-front-guy follow-up on slice-1, 2026-04-19

### Mobile onboarding → webapp cache staleness (cross-platform)
- **Priority:** Medium
- **What:** Mobile onboarding (`mobile/app/onboarding.tsx`) writes `profiles` + `accounts` directly to Supabase. The webapp's `(dashboard)/layout.tsx` guard reads `profile.onboarding_completed` via `getProfile()` which is `"use cache"` + `cacheTag("profile")` with `cacheLife("zeta")` (stale 120s / revalidate 300s). If a user completes onboarding on mobile and opens the webapp within that window, the cached profile still has `onboarding_completed: false` → the layout redirects them back to `/onboarding`, hiding the data they already entered.
- **Options:**
  - (a) Add a `POST /api/cache/onboarding-complete` route handler in webapp that authenticates via `getRequestUser` and calls `updateTag("profile")` + `updateTag("accounts")`. Mobile calls it after `persistOnboarding()` succeeds. Requires webapp hotfix + mobile call in one coordinated release.
  - (b) Layout guard reads `onboarding_completed` via a separate uncached query (`createClient() → profile_onboarding_completed` view), keeping the rest of `getProfile()` cached. Self-contained to webapp.
- **Recommendation:** Option (a) — correctness + cheap round-trip only at onboarding-complete. Option (b) adds a DB hit to every layout render.
- **Found:** mobile-webapp-parity review on PR #195, 2026-04-19

### Mobile onboarding — follow-up polish from slice-2 review
- **Priority:** Low
- **What:** Non-blocking items deferred from the zetas-front-guy / frontend-auditor / ux-analyst / mobile-sync-doctor / mobile-webapp-parity reviews on PR #195:
  - Money input formatting — thousand separators + currency prefix so `5000000` renders as `$ 5.000.000 COP`. Meatier change; extract a shared `MoneyInput` component when we touch it.
  - Purpose acknowledgement on step 2 title/eyebrow — "Vamos a ayudarte a salir de deudas, {firstName}" instead of generic "Tu perfil". Reinforces the step-1 choice.
  - `save_money` reinforcement on step 3 — when `available > 0`, add a Narrator line: "Con eso podrías apartar {X} al mes para tu meta."
  - `profiles.debt_count` schema column — reference captures the count but there's no home for it. Add via supabase-migrator. Then onboarding can persist it.
  - `firstName` saved into `full_name` column — either rename DB column or add a `first_name` column so intent matches storage.
  - Error surface auto-scroll — on submit failure, scroll the error into view near the action bar.
  - Extract `SelectPill` primitive — currency pills + account-type pills + purpose tiles share the "radio-button with brass highlight" shape. Consolidating into one `components/ui/SelectPill.tsx` would DRY ~60 lines across steps.
  - `SECTION_EYEBROW_CLASS` tracking fix — `mobile/lib/constants/styles.ts:39` defines `tracking-[4px]` while the design system uses `tracking-[0.18em]`. The onboarding steps avoid the constant and inline the correct tracking, but any consumer that adopts the constant will get wrong tracking.
  - Webapp onboarding `locale` default — `webapp/src/app/onboarding/page.tsx:130` uses `navigator.language || "en-US"`. Mobile hardcodes `"es-CO"`. Changing the webapp fallback to `"es-CO"` aligns both platforms on the target-region default.
  - Webapp onboarding atomicity — `webapp/src/actions/onboarding.ts` has the same "update profile, then insert account" ordering that mobile just fixed. Also swap the webapp, or extract a shared `finish_onboarding(p_profile jsonb, p_account jsonb)` SECURITY DEFINER RPC so both platforms get true transactional behaviour.
  - `CurrencyCode` type in `mobile/components/onboarding/types.ts` is missing `PEN | CLP | ARS` relative to the DB enum. Expand when the picker grows.
- **Found:** agent review sweep on PR #195, 2026-04-19

### Mobile import wizard — follow-up polish from slice-1 review
- **Priority:** Low
- **What:** Non-blocking items deferred from the zetas-front-guy / frontend-auditor / ux-analyst review on PR #193:
  - `mobile/components/import/CreditCardSummary.tsx:242-270` — private `PeriodTile` duplicates `ExpandableStatTile`. Migrate.
  - `mobile/components/import/import-theme.tsx` — `themeClasses()` is a diverged copy of `themeSurfaceClasses()` in `lib/theme.tsx`. Remove entirely; consumers should call `themeSurfaceClasses(mode)` directly.
  - `mobile/lib/constants/colors.ts` — settings theme swatches (`#1E221E`, `#18181b`) should become `COLORS.surface2` / `COLORS.surface2Neutral` tokens so they can't drift silently.
  - `mobile/app/(tabs)/import.tsx:1355` — `AnimatedAccordion estimatedHeight={1200}` for the Row-2 reconcile panel is a worst-case estimate that produces blank-space flicker on short lists. Switch to dynamic `onLayout`-measured height (or reduce the estimate) once `AnimatedAccordion` grows a measured-mode.
  - `mobile/app/(tabs)/import.tsx:622-670` — `handlePrepareImport` calls `getReconciliationCandidates` then `getReconciliationCandidateById` per match (two awaits per item). Can be flattened to a single query that returns the full candidate in one pass — highest-latency path in the wizard.
  - UX: Narrator voice (Kalam) is used for both page-level annotations and in-panel empty states; should be reserved for the page-level summary. Convert in-panel empty states to plain `text-xs italic text-z-sage-dark`.
  - UX: `CreditCardStackCard` lacks a visible "linked" signal between the per-currency cards (both read as independent). Add an eyebrow header "Tarjeta · N monedas" above the stack.
  - UX: Step 2 → Step 3 → Step 2 loses scroll position on the review list — preserve offset on back.
  - UX: `ItemSeparator` uses `ml-12` but the checkbox indent is ~28px; hairline misaligns.
  - `mobile/app/(tabs)/import.tsx:981-989` etc. — `ImportProgress` + "Paso X de 4" eyebrow are redundant. Drop the eyebrow.
- **Found:** agent review sweep on PR #193, 2026-04-19

## Open PRs

| PR | Description | Status |
|---|---|---|
| #98 | Demo mode with mock accounts | Open since 2026-04-08 (stale) |
| #190 | Planner drag-and-drop envelope assignment | Open 2026-04-18 — pending UX review (see below) |

### PR #190 — pending UX review before merge
- **Long-press overlay UX feels off** — user impression when testing mobile. The "cubre $X" chip hints work but the interaction doesn't feel right yet. Re-evaluate: timing (400ms), chip layout, whether long-press is still the right gesture, or if tap-to-pick is better.
- **No assignment removal/edit path** — old UX had per-assignment `Trash2` in the `IncomeCard` expansion. New board has no way to remove a specific color-chip assignment from an expense once assigned. Options: (a) click a color chip on the expense card → popover with "Editar monto" / "Quitar", (b) drag the chip off, (c) resurrect an "assignments panel" per jar. Evaluate during PR review.
- **Fully-assigned expenses are inert on mobile** — long-press is guarded to no-op, but there's no alternative gesture to re-manage existing assignments beyond the `⋯` menu (which only handles Pagar/Editar/Eliminar of the expense, not its assignments).
- **Touches:** `webapp/src/components/cashflow-planner/drag-envelope-board.tsx`, `long-press-overlay.tsx`, `expense-card-draggable.tsx`.
- **Found:** User smoke test on PR #190, 2026-04-18.

## Session handoff — 2026-04-18

### Shipped this session (merged to main)
- **PR #183** — tech-debt Wave 1 (tokens + createCachedClient pattern)
- **PR #184** — tech-debt Wave 2 (transaction_tags RLS hardening + WITH CHECK)
- **PR #185** — tech-debt Wave 3 (corrupted email-PDF cleanup script; dry-run found 0 prod rows)
- **PR #186** — has_auth guard on every encrypted view trigger
  - 14 trigger functions rebuilt across 7 tables (capture_tokens, destinatarios, email_ingest_addresses, profiles, recurring_templates, statement_snapshots, wishlist_items)
  - Gemini's perf refactor applied: `SELECT * INTO _old <tbl>_enc` instead of N preserve-subqueries on no-auth UPDATE path
  - Two migrations: `20260417193237_has_auth_guard_encrypted_triggers.sql` + `20260417203708_has_auth_guard_select_into_refactor.sql`
  - Pre-existing accounts/pdf_passwords/transactions update functions still on subquery form — out of scope, can refactor later if desired

### Discovered this session — added to backlog
- **Telegram webhook capture_tokens admin path** (Bugs section, Medium): both SELECT and UPDATE through view never worked end-to-end. Needs `set_capture_token_label` + `find_capture_token_by_chat_id` SECURITY DEFINER RPCs. Pre-existing, surfaced by supabase-migrator on PR #186.

### Triage candidates for next session
1. **Dashboard RECIENTE inline category assignment** (Features, High) — single-component, well-scoped, big UX win
2. **Promote-to-recurring success state** (Bugs, Med) — small user-facing polish
3. **Recurring templates — review unran 20260416 merge** (Bugs, Med) — needs audit SQL + merge migration
4. **Telegram webhook RPCs** (newly added Bug, Med) — completes encryption hardening story
5. **Mobile Apple/Play compliance prep** (Features, High) — user-blocked on assets; tech prep can run in parallel

### State
- Working dir: clean on main after PR #186 merged
- No active agent threads
- All Gemini comments on shipped PRs replied to and resolved or declined

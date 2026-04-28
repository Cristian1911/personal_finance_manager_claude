# Zeta Backlog

> Persistent backlog shared across sessions. Update this file whenever a task is discovered but not tackled in the current session. Remove items when they ship (merged to main).

## How to use

- **Before starting work**: scan this file for items that overlap with your task — fix them together.
- **After finishing work**: if review agents or testing surfaced new issues you didn't fix, add them here.
- **After merging a PR**: remove the items it resolved.

---

## Bugs

### Import reconciliation — `truncate` on `<span>` inside `<li>` ineffective
- **Priority:** Low
- **What:** `webapp/src/components/import/reconciliation-step.tsx:304` applies `truncate` to a `<span>` inside a block-level container. `<span>` is inline by default so `truncate` has no effect — long merchant names can overflow. Fix: move `truncate` onto the `<li>` and drop the extra `<span>`.
- **Found:** Gemini review on PR #216, 2026-04-23.

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

### Mobile — `expo-system-ui` para tema claro/oscuro en Android
- **Priority:** Low
- **What:** Al correr `npx expo prebuild --clean` Expo emite la advertencia `android: userInterfaceStyle: Install expo-system-ui in your project to enable this feature.` — `app.json` declara `"userInterfaceStyle": "automatic"` pero Android lo ignora sin el módulo. iOS sí honra la clave nativamente, así que el bug es sólo Android.
- **Fix:** `cd mobile && npx expo install expo-system-ui`. No requiere config plugin adicional; Expo lo detecta y la próxima prebuild respeta la preferencia del sistema.
- **Impacto actual:** la status bar y los fondos de Android no siguen el tema del sistema; se queda con lo que pinte la app.
- **Found:** prebuild en `feat/mobile-capture-photo-voice`, 2026-04-22.

### Mobile — `budgets` SQLite missing `is_demo` column (sync drift)
- **Priority:** Medium
- **What:** Supabase `budgets` view exposes `is_demo: boolean`. SQLite `budgets` table in `mobile/lib/db/schema.ts` has only 7 columns (no `is_demo`). `getTableColumns()` in `mobile/lib/sync/pull.ts` silently drops the field every pull. Demo-seeded budgets cannot be distinguished from real ones on device. User-created budgets work today because Supabase defaults `is_demo=false` on insert.
- **Fix:** DB_MIGRATIONS v11 → `ALTER TABLE budgets ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0`. Then add `budgets: ["is_demo"]` to `BOOLEAN_FIELDS` in `mobile/lib/sync/pull.ts` so pull converts `true/false → 1/0` on write.
- **Found:** mobile-sync-doctor on PR #223, 2026-04-22.

### Mobile — yearly budgets not displayed
- **Priority:** Low
- **What:** `getBudgetProgress` in `mobile/lib/repositories/budgets.ts` filters `b.period = 'monthly'` (hardcoded). Webapp accepts `"monthly" | "yearly"` via `budgetSchema`. Any yearly budget created on webapp is invisible on mobile.
- **Fix:** widen the SQL filter + surface a period chip in BudgetRow. Only needed once the webapp exposes yearly creation.
- **Found:** mobile-webapp-parity on PR #223, 2026-04-22.

### Webapp — `DESTRUCTIVE_GHOST_BUTTON_CLASS` parity
- **Priority:** Low
- **What:** PR #223 added `DESTRUCTIVE_GHOST_BUTTON_CLASS` to `mobile/lib/constants/styles.ts` for the budget-row Eliminar button. Webapp `src/lib/constants/styles.ts` has a solid `DESTRUCTIVE_BUTTON_CLASS` but no ghost variant. Webapp components currently re-invent the pattern ad hoc when needed.
- **Fix:** mirror the token on webapp: `DESTRUCTIVE_GHOST_BUTTON_CLASS = "border-z-debt/25 bg-black/10 text-z-expense hover:bg-z-debt/10"` (using Tailwind v4 `/` opacity syntax — webapp supports it). Opportunistic cleanup of existing ad-hoc sites follows.
- **Found:** zetas-front-guy on PR #223, 2026-04-22.

### Webapp — expose "Reset all my data" in Settings
- **Priority:** Medium
- **What:** PR #227 shipped the `reset_user_data()` RPC + mobile Settings entry, but webapp Settings has no equivalent. Users who only use the web still can't wipe their own data. The RPC + confirmation copy already exist — webapp just needs a destructive-ghost button in `/settings` that calls the RPC, clears Route Cache (`updateTag` for all domain tags), and signs the user out to `/onboarding`.
- **Touches:** `webapp/src/app/(dashboard)/settings/page.tsx` (or the nearest Settings surface), new server action `resetAllUserData` in `webapp/src/actions/profile.ts`.
- **Found:** 2026-04-24, PR #227.

### `reset_user_data()` RPC — drift guard
- **Priority:** Medium
- **What:** PR #227 took five hardening passes (`obligation_skips`, `profiles.updated_at` type, NOT NULL currency/locale, `design_reviews`, CI `clearDatabase` FK order) because the RPC hard-codes the table list and every schema change risks silent drift. Today it's resilient to dropped tables via `to_regclass` guards, but new tables added after 2026-04-24 won't be wiped unless someone remembers to touch the RPC.
- **Fix options:** (a) CI check that diffs `information_schema.tables WHERE table_schema='public'` against the RPC's table list and fails the build on drift; (b) rewrite the RPC to iterate `information_schema` dynamically with an allowlist of system tables to preserve; (c) accept manual upkeep and add a pre-commit reminder when `supabase/migrations/*.sql` adds a `CREATE TABLE`.
- **Found:** 2026-04-24, PR #227.

## Claude Design — Wireframe Handoff

Source of truth: `claude-ai-design/Zeta Wireframes.html`. Variant A (Safe) ships unless noted. Each flow below = one milestone slice.

### Flow 01 — Onboarding redesign (webapp)
- **Priority:** Medium
- **Status:** Webapp mobile-first slice shipped (PR #205, 2026-04-21). Mobile slice-2 shipped (PR #195).
- **What shipped (PR #205):**
  - Signup drops email confirmation — redirect straight to `/onboarding` when the session is returned, hard error if the Supabase "Confirm email" toggle is still ON.
  - `fullName` moved from signup to onboarding step 2 (one less field before the app opens).
  - Auth + onboarding layouts: mobile-first Obsidian & Brass shell.
  - Onboarding: chip pickers for purpose, currency, account type. `formatCurrency` + `tabular-nums` on the disponible preview. Completed-user guard added to `/onboarding/layout.tsx`.
  - "Ver demo" entry points (landing hero + signup page) start an anonymous Supabase session, seed demo data, land on `/dashboard`.
  - Anonymous → real: when an anonymous visitor signs up, `signUp` promotes the session via `updateUser({ email, password })` so seeded data carries over. `DemoBanner` swaps the "Salir" button for a brass "Crear cuenta" CTA when the current user is anonymous.
- **Operator prereqs:** `Auth → Email → Confirm email` OFF, `Auth → Anonymous Sign-Ins` ON.
- **Deferred to follow-ups:**
  - PIN (wireframe F2) — needs custom auth flow, Supabase has no primitive.
  - Cadence + partner chips (wireframe F3) — needs new profile columns.
  - Embedded parse step (wireframe F5) — import stays on `/import` after onboarding.
  - Anonymous cleanup cron — see new Tech Debt entry.

### Flow 02 — Home redesign (webapp dashboard)
- **Priority:** Done (mobile + desktop zones) · follow-up deferred
- **Status:** Variant B shipped PR #204 (2026-04-20). Mobile Pulse widget + widget grid + arrange sheet; desktop `HeroZone` / `WidgetsZone` / `HealthZone` / `MobileZone` in `webapp/src/app/(dashboard)/dashboard/page.tsx`.
- **Deferred (PR 3):** true drag-to-reorder + inline S/M/L resize for the widget zone (wireframe "Arrange" frame). Reanimated + gesture-handler work. Current edit mode = WidgetEditSheet move up/down + size chips.

### Flow 03 — Add transaction (quick-capture redesign)
- **Priority:** Shipped (webapp mobile viewport) · follow-ups deferred
- **Status:** Mobile RN shipped PR #201. Webapp mobile `/transactions/new` redesigned to Layout B (sectioned: `Detalles` → `Asignar` → `Más opciones`) — 2026-04-21. Full-page route preserved (kept out of drawer due to virtual-keyboard interactions).
- **What shipped (webapp):**
  - Form restructured into three visual sections with `SectionEyebrow` — `Detalles` (descripción, cuenta, fecha, categoría), `Asignar` (destinatario picker), `Más opciones` collapsible (es suscripción, crear recurrente, notas).
  - `DestinatarioZonePicker` replaces the legacy "Crear destinatario" switch — supports inline create + recents in one control.
  - `is_subscription` now wired end-to-end: schema (`transactionSchema`) + action (`persistTransaction` INSERT) + form Switch row.
  - `destinatario_id` now accepted by `transactionSchema` — user-picked destinatarios flow through to `persistTransaction` and `linkTransactionToOccurrence` (prior code only honored "create-via-switch" destinatarios, so occurrence matching improves).
  - Submit button uses `BRASS_BUTTON_CLASS` (brass + `text-z-ink`, per token rule).
- **Deferred / follow-ups:**
  - Tags picker inline (today requires entity id; `TagZonePicker` needs a "pending tags" mode). Users add tags via transaction detail after save.
  - Cuenta + Fecha paired side-by-side (reverted — layout clipped at narrow viewports; stacked stays).
  - Missing `htmlFor` on DatePicker / CategoryZonePicker / DestinatarioZonePicker labels (sub-components don't expose `id`; a11y gap is loose labeling only).
  - Desktop `TransactionFormDialog` (unchanged — out of scope per user decision).

### Flow 04 — Import redesign (webapp)
- **Priority:** Done
- **Status:** Variant A (mobile-first 4-step) shipped PR #209 — 2026-04-21.
- **What shipped:**
  - Collapsed from 6 steps (upload/review/destinatarios/confirm/reconcile/results) to **4 steps** (subir/revisar/reconciliar/listo) matching the mobile app + wireframe Variant A.
  - Destinatario matching and auto-categorization now run silently in step 2; users fix later on the dedicated `/destinatarios` and `/transactions` pages.
  - Multi-currency credit card imports use the mobile `CreditCardStackCard` pattern — one chip + one account assignment + per-currency compact cards with inline projection, instead of a card per statement.
  - New `AccountAssignControl` popover (replaces buried `Select`): brass attention state when unmatched, single-line pill trigger merged with the currency selector on one row.
  - Reconcile step replaced the stat row with a 2×2 grid of expandable `ReconcileChip` tiles (Nuevos / Destinatarios / Duplicados / Ambiguos) + `Narrator` line. Clicking a chip expands a detail panel below.
  - Sticky `WizardActionBar` pinned to the bottom of the viewport on mobile (safe-area + tab-bar clearance). Desktop reverts to inline.
  - Pending email queue now renders **below** the wizard, collapsed by default with a summary strip ("2 listos · 1 necesita clave · 1 con error"), and hides entirely once the user starts a flow.
  - Pending-email queue row clears automatically on completed import (skipped-only counts — previously it required `imported > 0`).
  - Step 1 drop zone restyled (large dashed brass box + file-type hint).
  - `projectMinimumPayoff12mo` moved from `mobile/lib/utils/cc-projection` to `@zeta/shared`.
- **Touches:** `webapp/src/components/import/*`, `webapp/src/app/(dashboard)/import/page.tsx`, `packages/shared/src/utils/cc-projection.ts`, `mobile/components/import/CreditCard{Summary,StackCard}.tsx`.
- **Deferred / follow-ups:**
  - Variant B (always-on inbox) — future slice; current "Cola de importación" is a step toward it.
  - Inline `CreateDestinatarioDialog` in the reconcile "Destinatarios" panel — today it links to `/destinatarios?new=<name>`; wiring the dialog inline requires threading `categories` through the step.
  - Per-tx category override in the flow — removed to match mobile. If we re-add, use an accordion inside the review transaction list (data path still supports it).
  - Manual QA pass — auth-guarded, so browser-based verification needs a real session. Walk-throughs: multi-currency CC, loan statement, email-queue re-import.

### Flow 05 — Plan redesign
- **Priority:** Medium
- **Status:** PR #170 polished `/plan` (NETO, chips, templates, presupuesto grouping, zone-based tabs `PlanResumenZone` / `PlanMobileZone`). Not an explicit wireframe-Variant-A pass — decide whether polish is sufficient or full redesign is still needed.
- **What:** A = current de-noised, B = 50/30/20 as a story, C = calendar-first.

### Flow 06 — Settings redesign (Variant A)
- **Priority:** High · **Ready to merge** (branch `feat/settings-visual-polish`, 2026-04-20)
- **Approach shift:** Original plan stood up sub-editors inside `/settings/*` for every domain (cuentas, categorías, recurrentes, fuentes). We pivoted to **trim settings to pure preferences/credentials** and route domain CRUD through existing hubs. Rationale: `/accounts`, `/plan?tab=presupuesto`, `/plan?tab=recurrentes` already expose full CRUD — duplicating editors under `/settings` was redundant.
- **Final surfaces:**
  - **Settings** — 7 preference rows: Perfil, Integraciones, Importación por correo, Contraseñas de PDF, Etiquetas, Actividad de uso, Reportar bug. Identity hero + search preserved.
  - **Bandeja (`/gestionar`)** — now renders the "Ir a" link grid on desktop (was mobile-only). 8 entries: Cuentas, Categorías, Recurrentes, Destinatarios, Categorizar, Importar, Deudas, Ajustes.
  - **Avatar quick menu** — gained a 4-icon "Ir a" row (Cuentas, Categorías, Recurrentes, Importar) above the footer. One-tap jump from anywhere.
- **Chrome unification:** `/settings/analytics` rewrote `PageHero` → `PageHeaderRow`. All `/settings/*` sub-pages get a desktop "← Volver a Ajustes" back link. Top-level `Analytics` sidebar entry removed.
- **Perf fix bundled:** `getEmailIngestAddress()` was uncached (DB hit every load). Now wrapped with `"use cache"` + `cacheTag("email-ingest")`. Settings page also stopped duplicating the profile query (now uses cached `getProfile()`).
- **Deferred (not in this slice):** anonymous-telemetry toggle, export-all-data (CSV/JSON), delete-account self-serve (confirmation + soft-delete flow), settings search indexing beyond keyword arrays.

### Flow 06 — Settings Variant B (People / couples mode)
- **Priority:** Low · **Future**
- **What:** Settings gains a People section for invite partner + shared pools + roles. Seed for couples tracking without a separate app. Needs new tables + RLS (`shared_pools`, `pool_members`, `pool_allocations`). Do not start until Variant A ships.

### Flow 07 — Can I afford it? (redesign)
- **Priority:** Done
- **Status:** Webapp shipped PR #211 — 2026-04-21. Mobile shipped slice-5 (PR #197).
- **What shipped (PR #211):**
  - New `/puedo-pagar` route replaces the old dashboard-card dialog + mobile v2 drawer. Mirrors Flow 07 Variant A + R2-05 wireframes.
  - `AffordPageClient`: sectioned form (qué · cuánto · cuenta · urgencia · pago · cuotas · categoría) → verdict hero (icon + label + score/100) → metric tiles (`PANEL_INSET_CLASS`) → reasons → "Caminos más seguros" → 3 decision actions (Comprar / Guardar en deseos [BRASS_GHOST, only for WAIT/NOT_RECOMMENDED/BUY_WITH_CAUTION] / Descartar).
  - `saveAffordToWishlist` server action: Zod-validated (verdict enum, 3-char uppercase currency, 0–100 score), `updateTag("wishlist")`, scoped error logging.
  - Dashboard `¿Comprarlo?` widget expands inline with a short explainer + brass CTA that navigates to the page.
  - Entry points wired on `/transactions` (link card replacing the dialog), mobile v2 dashboard widget, `MobileLinkGrid` at `/gestionar`.
  - Perf: page uses `useAccounts()` / `useOutflowCategories()` from `AppDataProvider`, no redundant fetch on the render path. Month is derived dynamically in the handler (not as a prop) to avoid staleness on long-lived sessions.
  - Removed: `purchase-decision-card.tsx` (547 lines), `purchase-recommender-drawer.tsx` (470 lines). Net -920 lines.
- **Touches:** `webapp/src/app/(dashboard)/puedo-pagar/`, `webapp/src/components/afford/`, `webapp/src/actions/wishlist.ts`, `webapp/src/components/mobile/v2/inicio/widgets/puedo-comprarlo-widget.tsx`, `webapp/src/components/mobile/mobile-link-grid.tsx`.
- **Deferred / follow-ups:** none flagged during review.

## Features

### Import support — PDF redaction before "send to devs"
- **Priority:** Medium
- **What:** When a user opts into "send for support" on a failed import, give them a redaction step before upload so they can hide PII (name, document ID, account number, address, balances) without losing the structural data we need to build a parser.
- **Why:** Bank statements are dense with PII. The current flow asks users to upload an unmodified PDF — many won't, even if it would help us add their bank. Privacy gate = higher conversion + safer storage of `save-unrecognized` blobs.
- **Approach (MVP, ~2-3 days):**
  1. Auto-redact pass on the server: extract bbox positions for known PII patterns (NIT/CC formats, common name lines via heuristics, account numbers via regex). Return a JSON of suggested redaction rectangles.
  2. Client preview: render the PDF page-by-page (pdf.js) with the suggested rectangles overlaid as semi-opaque boxes. User can toggle each suggestion on/off and drag a new rectangle for anything missed.
  3. On submit: client posts the redaction list + original file to `/api/save-unrecognized`. Server applies the rectangles using `pypdf` or `reportlab` (draw black rect on top of each page) and stores the redacted output. Original is discarded.
- **Approach (full, ~1 week):** Add per-rectangle reasons ("name", "account", "amount") for analytics on what users hide most; let user blur instead of black-box; preserve text-layer for rectangles outside the redaction zone so devs can still parse the structure.
- **Tradeoff:** image-only redaction (rasterize → paint → re-encode) loses text fidelity → defeats the dev-support purpose. Stick with vector overlay.
- **Touches:** `services/pdf_parser/main.py` (`/save-unrecognized` accepts redaction rectangles + applies them; new `/suggest-redactions` endpoint for the auto-pass), `webapp/src/components/import/step-upload.tsx` (the existing `unsupportedFile` block grows a "Revisar y censurar" intermediate step), new `webapp/src/components/import/redaction-editor.tsx`, dependency: `pdfjs-dist` for client render + a server-side redaction lib.
- **Found:** User request, 2026-04-28.

### Budget setup — per-category opt-in + calculator shortcut
- **Priority:** Medium
- **What:** When setting up budgets the user wants to pick categories one by one and only assign amounts to the ones they care about — leaving the rest blank is a valid state, not an error. Also: every amount input should expose a small calculator button (popover/drawer) so the user can do quick math without leaving the form.
- **Why:** Current budget setup assumes every category needs a number. For people starting lean, that's friction. The calculator lets "we spend ~300k on groceries + ~120k on café" become one inline add without switching apps.
- **Touches:** budget setup UI (`webapp/src/app/presupuesto/...` or the plan presupuesto tab), `CurrencyInput` component — add an adornment button that opens a lightweight calculator.
- **Found:** User request, 2026-04-21.

### Empty-state "Primeros pasos recomendados" — 4×4 grid layout
- **Priority:** Low
- **What:** The "Primeros pasos recomendados" view shown when the app has no data should render the suggested actions as a 4×4 grid (or close to it) instead of the current stacked list. Gives the user a richer menu of entry points at a glance.
- **Touches:** wherever the first-run recommendations render on the dashboard / /import / /plan empty states — locate and unify.
- **Found:** User request, 2026-04-21.

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
- **Priority:** High · **Mostly shipped** (branch `feat/settings-visual-polish`, 2026-04-20)
- **Done:**
  - `/privacy` + `/privacy/en` + `/terms` + `/terms/en` routes created on webapp with `LegalLayout` chrome. Host domain currently `pfm.sanson1911.cloud` (pending rebrand rename).
  - `PrivacyInfo.xcprivacy` declares collected data types: email, user ID, other financial info, other user content — all linked to user, not tracking, purpose = app functionality.
  - `NSAllowsLocalNetworking: true` removed from `ios/Zeta/Info.plist`. `NSBonjourServices` + `NSLocalNetworkUsageDescription` kept for Expo dev launcher discovery with Spanish description that clarifies dev-only behavior.
  - Mobile `/settings` page: new "Legal" section with Privacy + Terms links (via `expo-web-browser` → `EXPO_PUBLIC_API_URL`) + bottom disclaimer "Zeta no es un asesor financiero".
- **Deferred — add when actual camera/photo feature lands:**
  - `NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription` in `app.json` `ios.infoPlist`. Apple flags unused permission strings — don't add preemptively. Hook into whichever PR introduces `expo-camera` / `expo-image-picker`. Current `DocumentPicker` (Files app) doesn't need either.
- **Still required before submission:**
  - Privacy Policy URL must be **stable** (pending webapp domain rebrand rename — coordinate so URL is final before App Store Connect submission; updating later triggers re-review).
  - Financial-app disclosure in App Store Connect submission form.
  - `privacy@zeta.app` + `legal@zeta.app` mailboxes must accept mail (or replace placeholders in `legal-layout.tsx` + privacy/terms-content).
- **Found:** Mobile pages session, 2026-04-14

### Mobile app — Play Store production release (rebrand + promote from alpha/beta)
- **Priority:** High · **Tech prep done** — branch `feat/settings-visual-polish`, 2026-04-20
- **Shipped this session:**
  - Bundle drift fixed: `app.json` now uses `com.zetafinance.app` for both `ios.bundleIdentifier` and `android.package` (was `com.venti5.zeta`, out of sync with `build.gradle` + Xcode project).
  - Version bumped 1.0.0 → 1.1.0 across `app.json`, `ios/Info.plist`, `android/app/build.gradle`. `versionCode` auto-increments via EAS (`appVersionSource: remote`).
  - `AndroidManifest.xml` hardened: removed `SYSTEM_ALERT_WINDOW` (overlay permission — Play flags for finance apps); set `android:allowBackup="false"` to prevent sensitive data in ADB backups.
  - `targetSdkVersion` + `compileSdkVersion` inherited from Expo SDK 55 version catalog → both 35+ automatically.
  - Data Safety declaration drafted at `docs/play-store/DATA_SAFETY.md`.
  - Spanish listing copy drafted at `docs/play-store/LISTING_ES.md` (título, descripción corta, descripción completa, categorías, screenshots checklist).
  - In-app disclaimer + Privacy/Terms links live in mobile `/settings` (see Apple compliance entry).
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

### Mobile /periodo PaymentSheet — pre-existing parity bugs (surfaced 2026-04-23)
- **Priority:** High (data integrity)
- **What:** `mobile/components/plan/PaymentSheet.tsx` `handleCreatePayment` + `handleLinkTransaction` write transactions + recurring_occurrences with several shape gaps vs webapp `webapp/src/actions/cashflow-planner.ts`:
  1. **Wrong column names** (lines ~265, ~289): writes `description: "Pago: ..."` but `transactions_enc` view has `raw_description` + `clean_description`. PostgREST silently drops the unknown field, leaving both columns NULL. Breaks downstream queries (transaction list, search, reconciliation `findCandidateTransactions`).
  2. **Raw idempotency key** (lines ~270, ~294): emits `MANUAL_FORM|${id}|${date}|${amount}|${label}` as the literal key. Webapp hashes the same inputs via `computeIdempotencyKey()` from `@zeta/shared` (SHA-256). The UNIQUE constraint compares raw vs hashed → mobile-created tx never dedups against webapp/PDF-imported counterpart.
  3. **Missing `linked_manually: true`** in link-mode occurrence update (lines ~215-226). Webapp sets it. Breaks audit queries.
  4. **Missing `recurrence_group_id` stamp + `categorization_source` backfill** on the linked transaction. Webapp `linkExistingTransactionToOccurrence` (occurrences.ts:915-932) handles both.
  5. **Missing `applyAccountBalanceDelta`** on create-mode — webapp updates source + debt account `current_balance` inline; mobile waits for next pull. Balance shown on mobile/webapp diverges until next sync.
- **Context:** Flagged by `mobile-webapp-parity` agent during the planning_* sync PR. All bugs pre-date that PR (present on main). Left intentionally out of scope to keep that PR reviewable.
- **Scope of fix:** replace the two `transactions.insert` payloads with webapp-shaped ones + switch to `computeIdempotencyKey` + expand the occurrence UPDATE + extract/reuse a mobile `applyAccountBalanceDelta` helper (or add one in `lib/repositories/accounts.ts`).
- **Found:** mobile-webapp-parity on planning_* sync PR, 2026-04-23.

### Mobile Settings — v2 polish (layout + sizes)
- **Priority:** Medium
- **What:** Settings screen (`mobile/app/(tabs)/settings.tsx`) funciona pero no ha pasado el sweep de v2. Usuario quiere planificarlo con calma en vez de improvisar. Slice actual solo metió la ToggleRow del BugFAB; el resto queda pendiente.
- **Áreas a discutir antes de tocar:**
  - **IdentityHero**: hoy vive sin card (flex row suelto con `px-4 py-4`). ¿Convertirlo en `PANEL_INSET_CLASS` con avatar más grande (h-16)? ¿O mantenerlo aéreo y solo tocar tipografía?
  - **Agrupación**: "Limpiar cola de sincronización" + "Resincronizar desde cero" están en Sincronización — ¿mover a "Avanzado" separada? ¿o son aceptables donde están?
  - **Spacing**: `gap-5` entre secciones, `mb-2` bajo headings, `py-3` en filas. ¿Apretar, holgar, o quedarse?
  - **Tipografía**: Nombre en hero `text-base`, títulos de fila `text-sm`, meta `text-xs`. ¿Subir un paso para jerarquía más clara?
  - **Pill "Cerrar sesión"**: `BRASS_GHOST_BUTTON_CLASS` + `text-[11px]`. Pequeño. ¿Crece o se convierte en icon-button?
  - **Orden de secciones**: Perfil → Sincronización → Apariencia → Seguridad → Privacidad. ¿Cambia?
  - **Secciones faltantes**: ¿Lugar para idioma, notificaciones, export de datos, eliminar cuenta (flagged en backlog existing)?
- **Recomendación para arranque**: sesión corta de diseño en papel/wireframe antes de tocar TSX. Decidir 3-4 cambios concretos y ejecutar.
- **Found:** User feedback, 2026-04-23.

### Mobile Plan — restaurar "FLUJO DEL MES" chart
- **Priority:** Medium
- **What:** El chart de flujo diario (línea de balance + marcadores diarios de ingresos/gastos verdes/rojos + líneas verticales de ingreso/gasto + marker de "Hoy" + totales INGRESOS/GASTOS/NETO debajo) se perdió en el rediseño del Plan (PR #224). User feedback: lo quiere de vuelta. Referencia visual en el adjunto del usuario 2026-04-23.
- **Scope:** portar como expandable section dentro de `PlanRoot` o como standalone dentro de `PlanNetHero` (o un nuevo `PlanFlowSection`). Código previo: buscar `PlanFlowChart` en history (`git show 01953a4^:mobile/components/plan/PlanFlowChart.tsx` — eliminado en el redesign).
- **Found:** User feedback, 2026-04-23 (post PR #224).

### Webapp mobile/v2/plan — parity with native execution hero
- **Priority:** Medium
- **What:** PR #224 moved native Plan to the execution hero (`disponible` = confirmed income − paid obligations − pending − discretionary) with inline mini-chart + expandable math breakdown. Webapp `mobile/v2/plan-root.tsx` still uses the simpler "neto del mes" projection (planned ingresos − gastos, chart expands into hero). They now diverge semantically: native answers "what's left to spend?"; webapp answers "what's the projected net?". Both render on mobile-width viewport.
- **Direction picked (2026-04-22):** port native's execution hero back to webapp. Requires expanding `getPlanPageData()` to return the full `PlanExecution` shape (confirmedIncome/paidExpenses/pendingIncome/pendingExpenses/discretionarySpent/disponible). Also port `PlanWeekTiles` expand pattern + `PlanToolsChips` nav grid.
- **Touches:** `webapp/src/actions/plan.ts` (data shape), `webapp/src/components/mobile/v2/plan/plan-net-hero.tsx`, `plan-expandable-chips.tsx`, `plan-drill-cards.tsx`, `plan-root.tsx`.
- **Found:** PR #224 scope decision, 2026-04-22.

### Mobile dashboard — Arrange mode (drag/resize)
- **Priority:** Medium
- **What:** Slice-3 shipped the widget shell (Pulse fixed + 4 widgets + catalog) with edit mode = remove/add only. The Arrange frame from the Claude Design handoff (long-press → header swaps to "Arrange · Drag · Resize · Remove" + S/M/L chips per widget) needs reanimated + gesture-handler work. All catalog entries currently render as `rounded-2xl border bg-black-10` placeholders while disabled.
- **Touches:** `mobile/components/inicio/WidgetGrid.tsx`, new drag/resize gesture code, `widgets.ts` size contract already supports S/M/L.
- **Found:** Slice-3 scope split, 2026-04-19

### Mobile dashboard — Pulse trend data shape
- **Priority:** Low
- **What:** `PulseWidget` sparkline currently uses last-7 OUTFLOW sum per day (spend, not net cashflow). Design intent likely wants net cashflow (income - spend) or a moving-average disposable-per-day curve. Decide signal before hardening.
- **Found:** Slice-3 dev, 2026-04-19

### Mobile `transactions` table — `recurrence_group_id` column drift
- **Priority:** Low
- **What:** Supabase `transactions_enc` / `transactions` view has `recurrence_group_id` TEXT (nullable), but SQLite schema never added it. `pull.ts` silently drops it every cycle. Not blocking any feature today (`is_recurring` boolean covers the pill), but close the drift before any feature needs the group id.
- **Fix:** `ALTER TABLE transactions ADD COLUMN recurrence_group_id TEXT` as a DB_MIGRATIONS v10 entry.
- **Found:** mobile-sync-doctor, slice-3 audit, 2026-04-19

### Mobile dashboard — widget catalog stubs
- **Priority:** Medium
- **What:** `spending_by_category`, `cashflow_calendar`, `debt_progress`, `merchants_this_month`, `shared_with_partner`, `goal` are listed in `WIDGET_CATALOG` but marked `available: false` and render a "Widget próximamente" placeholder if somehow added. Build them as each feature comes online so the catalog stops feeling hollow.
- **Touches:** `mobile/lib/dashboard/widgets.ts`, new widget components under `mobile/components/inicio/widgets/`.
- **Found:** Slice-3 scope, 2026-04-19

### Observabilidad — Sentry / crashlytics en mobile
- **Priority:** Low (post-v1, antes del crecimiento más allá de beta cerrada)
- **What:** Añadir reporte de crashes + performance para detectar bugs sin esperar a que el usuario los reporte. Candidatos: Sentry (free tier generoso, integra con Supabase), Expo's `expo-application` + custom logging, o BetterStack.
- **Play Store implicaciones al activar:**
  - Data Safety → App info and performance: marcar "Crash logs", "Diagnostics", "Other app performance data" (según lo que se recoja).
  - Collected=Yes · Shared=Yes (Sentry es un tercero) · Optional · Purpose=Analytics · Encrypted in transit=Yes · User can request deletion=Yes.
  - Actualizar política de privacidad con mención del proveedor de observabilidad.
- **Criterio de activación:** cuando haya >50 usuarios en beta y no queramos depender solo de bug reports manuales.

### In-app eliminación de cuenta (Ajustes → Eliminar cuenta)
- **Priority:** High (antes de Play Store producción; OK para internal testing)
- **What:** Implementar flujo self-service de eliminación de cuenta y todos los datos asociados. Hoy solo existe vía email a `giraldo.0302@gmail.com` (documentado en `/eliminar-cuenta`). Google Play prefiere in-app; lo acepta por email para v1 pero la UI más tarde reduce fricción y baja tickets.
- **Touches:**
  - `webapp/src/actions/account.ts` (nuevo) — `deleteAccount()` server action que borra cascadas de user data + `supabase.auth.admin.deleteUser(user.id)` vía admin client
  - `webapp/src/app/(dashboard)/settings/cuenta/page.tsx` — sección "Zona de peligro" con doble confirmación
  - Mobile: equivalente en `app/(tabs)/settings.tsx`
  - Considerar "soft delete" con grace period (7 días) antes del purge definitivo
- **Requisitos antes de marcar done:** actualizar `/eliminar-cuenta` para reintroducir la vía in-app como método 1; email queda como fallback.

### MCP — acceso de IAs de terceros configurado por el usuario
- **Priority:** Low (post-v1)
- **What:** Permitir que el usuario conecte clientes MCP (Claude Desktop, Cursor, etc.) para consultar sus datos financieros vía protocolo MCP. Ya existe scaffolding en `webapp/src/app/api/mcp/`; falta mobile + documentación de onboarding.
- **Implicaciones Play Store:**
  - Data Safety sigue siendo **Sí** a la pregunta global (ya se recopila desde v1).
  - En el desglose por tipo de dato: NO marcar como "Shared" siempre que (a) el usuario active MCP opt-in explícito, (b) conecte su propio cliente (no uno pre-configurado por Zeta), (c) Zeta no enrute datos a un LLM propio con su API key. Esto califica como "user-initiated action" exento según Google Data Safety FAQ.
  - Si Zeta llegase a enrutar a un LLM de tercero con credenciales propias (ej. OpenAI con API key de la empresa), **sí** cuenta como Shared y hay que declararlo.
  - Actualizar política de privacidad y términos para documentar qué datos quedan visibles al cliente MCP.
  - Añadir pantalla de consentimiento explícito antes del primer uso.
- **Touches:** `webapp/src/app/api/mcp/`, nueva settings page en mobile, tokens MCP en Supabase, docs.
- **Estado:** scaffolding en webapp, no expuesto al usuario.

### Zeta Premium — paywall + Google Play Billing / StoreKit
- **Priority:** Medium (post-v1 launch)
- **What:** Monetización del mobile app vía suscripción o compras únicas. Funcionalidades premium previstas: widgets avanzados del dashboard, temas visuales adicionales, posibles funciones exclusivas.
- **Decisiones abiertas:**
  - SDK: RevenueCat (`react-native-purchases`) vs. self-hosted `react-native-iap`. `expo-in-app-purchases` está deprecated.
  - Modelo: suscripción (mensual/anual) vs. compras únicas por widget/tema vs. híbrido.
  - Precio en COP vs. USD como base.
  - Freemium con trial vs. gratis con premium opcional.
- **Requisitos obligatorios antes de activar:**
  - Integrar SDK de Google Play Billing (Android) + StoreKit (iOS). RevenueCat unifica ambos.
  - Crear productos en Play Console (`zeta_premium_monthly`, `zeta_premium_yearly`, etc.) y App Store Connect.
  - Completar perfil fiscal en Google Play Console → Pagos.
  - Server-side receipt validation (RevenueCat webhook → Supabase Edge Function → UPSERT `user_subscriptions`).
  - Tabla `user_subscriptions (user_id, product_id, status, expires_at, source, receipt)` con RLS.
  - Botón "Restaurar compras" en Ajustes (obligatorio Play Store + App Store).
  - Pantalla de paywall (revisar `claude-ai-design/Zeta Wireframes.html` por si hay flow definido).
  - Hook `usePremium()` + componente `<PremiumLock>` para gate de features.
  - Actualizar política de privacidad: recibir tokens de facturación (Google/Apple manejan los datos de pago, Zeta solo recibe receipt tokens).
  - Actualizar términos de servicio: renovación automática, cancelación, reembolsos.
  - Al activar, flipear respuestas en Play Console:
    - Clasificación de contenido → Compras digitales: **Sí**
    - Funciones financieras → Compras dentro de la app: **Sí**
  - Actualizar ficha Play Store con rango de precios.
- **Docs de referencia:** `docs/play-store/submission-checklist.md` sección 8.1 (recrear cuando se implemente), `docs/play-store/data-safety.md` (actualizar purchase history + user payment info).
- **Estado actual:** la primera publicación a Play Store NO incluye paywall — declarar compras digitales como **No**.

## Tech Debt

### Mobile Inicio parity — follow-ups from slice-1 review
- **Priority:** Low
- **What:** Non-blocking items deferred from the zetas-front-guy + mobile-webapp-parity + /simplify + Gemini reviews on PR #215 (2026-04-23):
  - **Attention widget semantic alignment** — mobile `overdue` counts `pending_occurrences` with `occurrence_date < today`; webapp uses a dedicated `financial_reminders` source. `upcoming` lacks the webapp's 7-day cap. `pendingEmails` is hardcoded `0` on mobile — needs a real query. Same user sees different "Por resolver" counts across surfaces. Target: dedicated attention slice or slice 2.
  - **Mobile layout save rollback** — `saveDashboardLayout` optimistically applies locally and only logs on Supabase failure; the next `pullAll` silently overwrites the SQLite change. Add `setLayout(prev)` rollback mirroring webapp `persist()`.
  - **Cross-surface layout cache invalidation** — webapp `getMobileLayoutCached` tagged `dashboard-config` (stale 120s / revalidate 300s). Mobile save has no `updateTag("dashboard-config")` hook → up to 5 min of staleness on webapp. Either call a lightweight revalidation action from mobile or accept + document.
  - **`ARRANGEABLE_TYPES` coupled with `normalizeLayout`** — future `WIDGET_CATALOG` `available: true` flips will silently disappear from saved layouts on reload because both `normalizeLayout` implementations filter on the set. Gate changes behind a matching normalizer update or document the coupling in `dashboard-layout.ts`.
  - **Add `import_strip` to mobile `WIDGET_CATALOG`** — present on webapp (`available: false`), missing on mobile. Keep the arrays in sync even for disabled entries.
  - **Eyebrow token consolidation** — `SECTION_EYEBROW_CLASS` already defines `text-[10px] font-inter-semibold uppercase tracking-[4px]`. Inline repeats in `InicioRoot` (Organizar pill), `PulseWidget` (breakdown headers), `SectionDivider` (9px variant), and `ExpandableChip.ChipEyebrow`/`ChipDetailHeading` should fold into the constant.
  - **Promote `RangeChip` → shared `PillToggle`** — Pulse's Semana/Mes chips and the Organizar pill are the same shape (rounded-full, active brass border/fill, inactive white-6/black-10). Extract into `components/ui/` and reuse.
  - **Migrate `PlanExpandableChips` onto `ExpandableChip` + `ToneActionRow`** — predates the new tone palette; currently hand-rolls inline `style={{ borderColor: 'rgba(...)' }}` tint workarounds. Now that `ExpandableChip` + `ToneActionRow` own the tinting, unify.
  - **`useMemo` rendered rows in `WidgetGridRow`** — `render(w)` fires N times per summary tick. Not measurable yet; revisit if render thrash appears under frequent sync.
  - **Memoize Pulse breakdown JSX** — `formatCurrency` runs 5× per Pulse render even when the accordion is collapsed. Cheap enough to ignore today; memoize if sync ticks get chatty.
- **Found:** zetas-front-guy + mobile-webapp-parity + code-simplifier + code-reviewer + efficiency + Gemini reviews on PR #215, 2026-04-23

### Import page — defer `suggestPdfPasswordsForAccount(null, null)` to file-select time
- **Priority:** Medium
- **What:** `webapp/src/app/(dashboard)/import/page.tsx` fetches all vault suggestions for the user on every page load, even though the payload isn't read until the user picks an encrypted PDF. The action is intentionally uncached (plaintext passwords). Move the call into `StepUpload`, fired only after a file is selected and a bank key is detected. Removes one uncached SELECT from the initial render.
- **Found:** perf-auditor review, 2026-04-21 (import flow redesign).

### `markEmailPdfStatementImported` — redundant `revalidateFinancialViews()` call
- **Priority:** Low
- **What:** `webapp/src/actions/email-pdf-ingest.ts:221` invalidates every financial tag at the end of the status flip. The preceding `importTransactions` already did the work. Trim to `updateTag("email-ingest")` only.
- **Found:** perf-auditor review, 2026-04-21.

### Consolidate `ReconcileChip` into `widget-chip`'s `ExpandableChip`
- **Priority:** Low
- **What:** `webapp/src/components/import/reconcile-chip.tsx` duplicates the `ExpandableChip` + `ChipEyebrow` pattern from `webapp/src/components/mobile/v2/inicio/widget-chip.tsx`. Layout differs (centered label/value/hint, chevron bottom-right vs space-between) and the reconcile version needs an `"alert"` tone that doesn't exist upstream. Upstream the tone first, then fold the variants.
- **Found:** zetas-front-guy review, 2026-04-21.

### Anonymous demo session — captcha + rate limiting
- **Priority:** Medium (pairs with the cleanup cron that shipped via pg_cron)
- **Context:** The daily pg_cron deletes idle anonymous users older than 7 days, but nothing stops a bot from creating 10k anonymous users in an hour. Supabase's built-in per-IP rate limit helps; captcha on the anonymous sign-in endpoint is the real guardrail.
- **What to configure (no code):**
  1. Supabase Dashboard → Auth → Rate Limits → reduce anonymous sign-ins per IP/hour (default 30).
  2. Supabase Dashboard → Auth → Captcha → enable hCaptcha/Turnstile specifically for `signInAnonymously`. Requires passing a captcha token from the client — wire it into `startDemoSession` and `startGuestSession` if enabled.
  3. Weekly observability query: `SELECT count(*) FROM auth.users WHERE is_anonymous = true;` — alert if growth spikes between cron runs.
- **Found:** PR #205 follow-up, 2026-04-21.

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

### Mobile Afford — follow-up polish from slice-5 review
- **Priority:** Low
- **What:** Non-blocking items deferred from the zetas-front-guy / frontend-auditor / ux-analyst review on PR #197:
  - Extract the private `MetricTile` in `mobile/app/purchase-decision.tsx` into a shared `mobile/components/ui/StatTile.tsx` (non-interactive variant of `ExpandableStatTile`). Reuse opportunity flagged by multiple reviewers across slices.
  - Wishlist save errors currently reuse the top-level `setError` slot, which renders above the Analizar button. After a result is visible, wishlist errors appear far from the wishlist CTA that produced them. Add a local inline error under the "Guardar en deseos" button.
  - Surface `selectedAccount.name` in the verdict hero ("Con tu cuenta Bancolombia…") to anchor the analysis context.
  - Re-tapping Analizar while `savedToWishlist === true` silently resets the saved confirmation. Either preserve the flag when inputs are unchanged (stable input hash) or show a subtle toast "Guardaste una versión anterior".
  - Engine-level: when `urgency === "NECESSARY"` but verdict is `NOT_RECOMMENDED`, add a dedicated reason that names the tension ("Aunque lo marcaste como necesidad, tu colchón no aguanta este gasto.") — UI is already ready to render it.
  - `w-[47.5%]` arbitrary value on `MetricTile` — swap to `basis-[47%] flex-grow` or normalize container paddings and use `w-1/2 minus gap`.
  - Treat SQLite `SQLITE_CONSTRAINT_UNIQUE` (code 19) as success when saving to deseos (currently shows a red error for what should be a no-op).
- **Found:** agent review sweep on PR #197, 2026-04-19

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

## Session handoff — 2026-04-21

### Shipped this session
- **PR #204** — Flow 02 webapp mobile dashboard redesign (Variant B) — Pulse hero, chip-based widget grid with pack rows + shared accordion, arrangeable widgets zone, catalog sheet, Gemini comments addressed (useId for SVG gradient, optimistic-rollback snapshot on persist failure). *Merged.*
- **PR #205** — Flow 01 onboarding redesign + anonymous demo session. See the Flow 01 entry above for the full rundown.

### Discovered this session — added to backlog
- **Anonymous demo cleanup cron + rate limiting** (Tech Debt, Medium) — necessary follow-up to PR #205's anonymous "Ver demo" entry point. Scheduled deletion of anonymous users older than 7 days + captcha on the anonymous sign-in endpoint.

### Triage candidates for next session
1. **Anonymous demo cleanup cron** (newly added Tech Debt, Medium) — short migration or cron route, unblocks scaling the demo CTA.
2. **Flow 02 PR 3** — true drag-to-reorder + inline S/M/L resize for the widget zone (wireframe "Arrange" frame). Reanimated + gesture-handler work.
3. **Flow 03 webapp** — Add transaction rethink. Three variants in the wireframe, need to pick one before building.
4. **Flow 07 webapp** — "Can I afford it?" redesign. Mobile slice-5 shipped, webapp hasn't been touched yet.
5. **PR #190 drag-envelope UX review** — still pending user re-evaluation of long-press timing + assignment removal path.

## Session handoff — 2026-04-21 (evening)

### Shipped this session
- **PR #209** — Flow 04 Variant A: mobile-first 4-step import wizard + queue refactor. *Merged.*
- **PR #210** — Flow 03 webapp: Layout B transaction form redesign. *Merged.*
- **PR #211** — Flow 07 webapp: dedicated `/puedo-pagar` page replacing the old dialog + drawer. Includes `saveAffordToWishlist` server action, expanded widget with inline explainer + CTA, MobileLinkGrid entry. Gemini comments addressed (dynamic month, accountId effect-init; `parseMoney` declined — webapp `CurrencyInput` already strips formatting). *Merged.*

### Triage candidates for next session
1. **Anonymous demo cleanup cron** (Tech Debt, Medium) — still pending.
2. **Flow 02 PR 3** — drag-to-reorder + S/M/L resize for dashboard widget zone (Reanimated + gesture-handler).
3. **Flow 05 Plan redesign** — decide: PR #170 polish sufficient, or full Variant A pass?
4. **PR #190 drag-envelope UX review** — long-press timing + assignment removal path still pending re-evaluation.
5. **Bugs** — promote-to-recurring success state, recurring templates 20260416 merge audit, telegram webhook RPC migration.

## Session handoff — 2026-04-22

### Shipped this session
- **PR #212** — Mobile capture crea destinatario + recurrente + cuentas v2 tokens. *Merged* (commit `5d22762`).
  - `mobile/app/capture.tsx`: replaced `Alert("Próximamente")` stubs with Switch toggles that run alongside `createTransaction`. DEBT account (CREDIT_CARD/LOAN) guard at UI + repo layers.
  - `mobile/lib/repositories/destinatarios.ts` + `recurring.ts`: new write methods (`createDestinatarioWithPattern`, `createRecurringTemplate`) with local INSERT + sync_queue enqueue. SQLite migration v10 adds `destinatario_id` to `recurring_transaction_templates` for linkage.
  - `mobile/lib/sync/queue.ts`: new `enqueueInsert/Update/Delete` helpers — used by the two new repos.
  - `mobile/components/accounts/AccountFormFields.tsx`: extracted `FormField`, `NumericInput`, `DayPicker` (were duplicated byte-for-byte between create + edit).
  - `mobile/app/(tabs)/accounts.tsx` + `account/create.tsx` + `account/edit/[id].tsx` + `AccountTypeGrid.tsx` + `CurrencyPicker.tsx`: pre-v2 light-mode classes (`bg-gray-100/white`, `text-gray-500/900`, `bg-primary`) → v2 tokens (`bg-background`, `text-foreground`, `bg-z-brass`, `PANEL_SURFACE_SUBTLE_CLASS`, etc.) + `MobileHeader`.
  - Supabase migration `20260422003433_auto_generate_recurring_occurrences.sql` + `20260422010000_refine_recurring_occurrence_trigger.sql`: AFTER INSERT/UPDATE trigger on `recurring_transaction_templates_enc` auto-generates `recurring_occurrences` for current month + 14 days. UPDATE trigger has `WHEN` clause so it only fires on schedule changes.
  - Audit/gate agents run: `mobile-webapp-parity`, `mobile-sync-doctor`, `feature-dev:code-reviewer`. Gemini comments addressed (param reassignment fixed; drift logged as cross-cutting backlog item).

### Triage candidates for next session
1. **Mobile capture amount live-formatting** (Bugs, Medium) — COP thousand grouping while typing. ~30 min slice. Finishes the capture flow polish arc.
2. **Recurrence engine end-of-month drift** (Bugs, Medium) — paired `@zeta/shared/recurrence.ts` + Supabase trigger fix. Medium lift, rewards users with calendar-end recurring payments (31st of month).
3. **Anonymous demo cleanup cron** (Tech Debt, Medium) — still pending from last session.
4. **Flow 02 PR 3** — drag-to-reorder + S/M/L resize for dashboard widget zone.
5. **Subscriptions.tsx / bug-report.tsx / annotate-screenshot.tsx / purchase-decision.tsx** — mobile stubs flagged in the mobile audit (2026-04-22). Lower urgency.

### Memory added
- `feedback_webapp_source_of_truth.md` — principle that webapp is canonical; mobile mirrors. Parity gate before any mobile Supabase mutation. Drove the "fix drift in both places or not at all" decision on Gemini's recurrence comments.

## Session handoff — 2026-04-22 (evening)

### Shipped this session
- **PR #213** — `feat(mobile): captura formatea monto con separadores de miles`. *Merged* (commit `79aff3f`).
  - `mobile/app/capture.tsx`: TextInput muestra formato COP en vivo (`124124` → `124.124`) mientras el usuario escribe.
  - `mobile/lib/amount.ts`: nuevas `formatAmountInput` + `parseFormattedAmount` (dot = miles, coma = decimal); helper privado `isDecimalTail`. `parseLocalizedAmount` intacta — otros inputs numéricos (subscriptions, edit tx, budgets, plan sheets) no cambian.
- **PR #214** — `fix(recurrence): corrige drift de fin de mes en ambas implementaciones`. *Merged* (commit `551fc80`).
  - `packages/shared/src/utils/recurrence.ts`: `occurrenceAt(start, k, freq)` reemplaza `advanceByFrequency(current, freq)`. Ancla en `start_date` con contador `k` → Jan 31 MONTHLY preserva 31 (Feb 28 solo cuando hay clamp).
  - `supabase/migrations/20260422020000_fix_recurrence_eom_drift.sql`: mismo patrón con `v_start_date + (v_step * interval '1 month')`; un solo loop que inserta cuando `v_cursor >= v_range_start` (colapsa doble CASE).
  - 8 tests cubren Jan 31 / Jan 30 MONTHLY, Jan 31 QUARTERLY, Feb 29 ANNUAL en años no bisiestos, WEEKLY y `getNextOccurrence`.
  - Gemini HIGH comments atendidos: `toISOString().split("T")[0]` reemplazado por `format(d, "yyyy-MM-dd")` (date-fns) en las 4 apariciones para evitar off-by-one en zonas este de UTC.
  - `recurring-doctor` agent: PASS. Alcance: solo nuevas generaciones; ocurrencias ya drifted no se auto-corrigen.

### Pipeline
Gate pipeline: implement → `/simplify` (3 reviewers en paralelo) → aplicar (SQL CASE colapsado, `isDecimalTail` extraído) → Gemini review → aplicar fix (date-fns format) / declinar (2-decimal cap intencional).

### Triage candidates for next session
1. **Anonymous demo cleanup cron** (Tech Debt, Medium) — aún pendiente desde 2026-04-21.
2. **Flow 02 PR 3** — drag-to-reorder + S/M/L resize para widget zone del dashboard (Reanimated + gesture-handler).
3. **Backfill de ocurrencias drifted** — `recurring_occurrences` pendientes con fechas mal generadas (ej. Feb 28 de plantilla Jan 31) no se auto-corrigen. Migración opcional: delete `status='pending' AND generated_before fix_date` + regenerar. Bajo impacto — el próximo ciclo natural ya generará bien.
4. **Consolidar helpers de formato de monto en `@zeta/shared`** — `formatAmountInput`/`parseFormattedAmount` (mobile) y `formatDisplay`/`stripFormatting` (webapp `currency-input.tsx`) hacen lo mismo. Subir uno al shared package. Low priority.
5. **Mobile stubs** — `subscriptions.tsx`, `bug-report.tsx`, `annotate-screenshot.tsx`, `purchase-decision.tsx` (usuario indica: bug-report + annotate no se usan, bajar prioridad o eliminar).
6. **PR #190 drag-envelope UX review** — aún pendiente.

## Session handoff — 2026-04-22 (late night)

### Shipped this session
- **PR #221** — `feat(mobile): Movimientos parity slice 1 + perf refactor + mobile-perf-doctor agent`. *Merged* (commit `81229c3`).
  - Movimientos parity: `MovimientosRoot` (FlatList + pagination), `Lectura` (3-col summary + expandable SVG flow-by-day chart + rotating ChevronDown affordance), `Herramientas` (Categorizar + Importar chips with expandable inline panel, retain-last-tool close animation), `Utilidades` (search pill + MobileSheet filter drawer), `TransactionRow` (memoized, account dot + name, Categoría + Editar chips).
  - Perf: React.memo'd rows with stable `TransactionListRow` refs (no toItem wrapper), hoisted + conditionally mounted `CategoryPickerSheet`, request-id race guard, `txCountRef` to stop `loadData` recreation on append, summary totals via new `getMonthlyAggregates` SQL rollup (prev: summed paginated feed, numbers grew as user scrolled).
  - New agent `.claude/agents/mobile-perf-doctor.md` + `CLAUDE.md` review-gate entry. Bible sections §3.2 (AnimatedAccordion scale/close/affordance rules), §4.4 (race guards), §5.2 (summary totals from SQL) added during this PR's own review cycle.
- **PR #221 follow-up commit** — Gemini review fixes: `toISOString` timezone bug, useFocusEffect dep simplification, React.memo on Lectura/Herramientas + stabilized callbacks to stop chart re-render on search typing, narrowed `getTopUncategorized` SELECT. Also fixed pre-existing `mobile/lib/demo-data.ts` broken imports (category constants renamed in shared package; demo mode had been compile-broken).
- **`.github/workflows/mobile-pr-verify.yml`** — new CI workflow. Runs `pnpm install --frozen-lockfile` + `npx tsc --noEmit` against `mobile/` on every PR touching `mobile/**`, `packages/shared/**`, or root lockfile. Proven green on PR #221. Mobile now has the same pre-merge gate the webapp has via `pr-build-images.yml`.

### Parity/infra follow-ups committed on branch `chore/movimientos-followups`
- `categorization_source` alignment: mobile `updateTransaction` now flags `USER_OVERRIDE` on any category change (assign OR clear), matching webapp (`actions/transactions.ts:841` uses `categoryChanged`, true in both directions). Prior mobile behavior wrote `null` on clear — diverged from webapp.
- `getTransactions SELECT t.*` narrowing was considered, **declined for now**: 6 callers each consume many columns; narrowing is a real refactor with marginal perf gain (mobile SQLite rows are plaintext, no encrypted-column parse cost). Filed as a low-priority follow-up below.

### Triage candidates for next session
1. **Dogfood `mobile-perf-doctor` on main** — agent was registered during PR #221 so existing sessions can't see it. Next session will have it. Spawn as a retroactive audit against `mobile/components/movimientos/*` to validate the bible rules on the merged code, then on whatever tab we polish next.
2. **Mobile tab polish — pick one:** Budgets (smallest; still pre-v2 tokens `bg-z-surface-2-55`), Plan (`PlanRoot` parity vs `/plan` webapp; high-traffic), Deudas (`DeudasRoot` parity vs `/deudas`; high-visibility), or Movimientos slice 2 (destinatario/tag/vincular chips + email-pending sync — large, reopens recently-shipped files).
3. **Narrow `getTransactions` SELECT** (deferred from PR #221 Gemini review) — 6 callers, marginal gain. Do only when refactoring the repo anyway.
4. **Anonymous demo cleanup cron** — still pending from 2026-04-21.
5. **Flow 02 PR 3** — drag-to-reorder + S/M/L resize for the dashboard widget zone.
6. **Mobile stubs** — `subscriptions.tsx`, `bug-report.tsx`, `annotate-screenshot.tsx`, `purchase-decision.tsx` (user: bug-report + annotate unused — consider delete).
7. **PR #190 drag-envelope UX review** — still pending.
8. **Backfill drifted `recurring_occurrences`** — opt-in migration.

### Memory added / updated
- `feedback_mobile_perf_doctor.md` — commitment to grow the agent's bible after every mobile perf bug debugged.
- `.claude/agents/mobile-perf-doctor.md` — added §3.2 AnimatedAccordion close-animation + scale rules, §4.4 race guards on paginated loaders, §5.2 summary totals from SQL.

## Session handoff — 2026-04-22 (Plan polish)

### Shipped this session
- **PR #224** — `feat(mobile): Plan page polish` — open on `feat/mobile-plan-polish`.
  - `PlanNetHero` rewritten: always-visible inline SVG mini-chart (balance polyline, past solid / future dashed, today marker, zero line) + `AnimatedAccordion` breakdown (ingresos/fijos/gasto libre tinted panels + bottom-line math). Wrapped in `React.memo`.
  - New `PlanWeekTiles` (replaces `PlanExpandableChips`): two expandable tiles (próximo pago/ingreso) using shared `ExpandableChip` + `ChipEyebrow` + `ChipDetailHeading` primitives. Sooner-date tile gets brass ring hint; opposite dims when one is active. Accordion panel renders full pending list + "Crear en Recurrentes" CTA on empty state.
  - New `PlanToolsChips` (replaces `PlanDrillCards`): 3 plain chips (Presupuesto/Periodo/Recurrentes) with brass lucide icons + narrative status — alert words emphasized via `text-z-brass-hot`, no red/yellow tinted surfaces. Deseos removed from Plan entirely (lives in dashboard widget + `/puedo-pagar`).
  - `PlanRoot`: dropped `getWishlistCount` + `getActiveTemplates` queries. Planned totals now derived from occurrences (paid+pending+skipped sum) instead of `toMonthlyAmount × frequency` — more accurate and one less query. UTC→local date bug fixed via `toLocalDateString`.
  - New `/presupuesto` stack route (`mobile/app/presupuesto.tsx`) renders `<BudgetsRoot variant="sub">` for the back-arrow context. `BudgetsRoot` gained an optional `variant: "main" | "sub"` prop. Plan's Presupuesto chip now routes here instead of `/(tabs)/budgets`.
  - `/periodo` SWR cache: screen was spinning on every focus because planning_* tables aren't in `SYNC_TABLES`. Shipped module-scope cache at `mobile/lib/sync/periodoCache.ts` keyed by user_id, wired `clearPeriodoCache()` into `handleUserBoundary` (logout + user-switch).
  - Deleted 5 dead/replaced files: `PlanFlowChart`, `PlanExpandableChips`, `PlanDrillCards`, `PlanRecurringSummary`, `PlanBudgetSection`. Net: -540 lines across the feature folder.
  - `mobile/.gitignore` now excludes `*.aab` + `*.apk` (rescued a failed push where a 108MB EAS build was accidentally staged).
- **`.claude/agents/mobile-sync-doctor.md`** — new rule §6 "Screen data source" catches screens that hit Supabase directly instead of going through repositories. Added failure-pattern example with SWR cache snippet. User declined a separate `mobile-cache-doctor` agent — sync-doctor is the right home.

### Discovered this session — added to backlog
- **Mobile sync — planning_* tables** (Medium). Proper fix for `/periodo` SWR workaround.
- **Webapp mobile/v2/plan — parity with native execution hero** (Medium). Direction picked: port native's hero back to webapp. Requires expanding `getPlanPageData()` shape.

### Pipeline
Design preview → 3-col HTML mock (`claude-ai-design/plan-mobile-proposal.html`) → user picks direction → implement → `perf` + `zetas-front-guy` reviewers (parallel) → fix tokens+a11y+memo → `mobile-sync-doctor` + `feature-dev:code-reviewer` (parallel) → fix UTC date bug + accordion clip + cache leak → `/simplify` (reuse + quality + efficiency parallel) → fix ExpandableChip reuse + drop templates query + CHIP_CONFIG table → rescue from failed push (aab in gitignore).

### Triage candidates for next session
1. **Proper /periodo sync** — port planning_* tables into the engine + delete `periodoCache.ts`. Medium.
2. **Webapp mobile/v2/plan parity PR** — port native execution hero to webapp. Medium.
3. **Anonymous demo cleanup cron** — still pending since 2026-04-21.
4. **Flow 02 PR 3** — dashboard drag-to-reorder + S/M/L resize.
5. **Mobile tab polish — Deudas** (next in the sweep after Plan). Or Movimientos slice 2 if we want to return to that arc.

## Session handoff — 2026-04-23

### Shipped this session
- **PR #225** — `feat(mobile): /periodo sync via SQLite + opt-in BugFAB`. *Merged* (commit `36d2159`).
  - Planning sync: `planning_periods` / `planning_entries` / `planning_assignments` ahora viven en SQLite + pasan por el sync engine. DB_MIGRATIONS v11 mirror exacto de Supabase (con `currency_code`), `UNIQUE(income_entry_id, expense_entry_id)` + FKs.
  - `mobile/lib/repositories/planning.ts`: reads (`getActivePeriod`, `getPeriodEntries`, `getPeriodAssignments`, composite `getActivePeriodWithEntries`) + writes (`markEntryCompleted`, `updateAssignmentAmount`, `deleteAssignment`, `createAssignment`) con SQLite + `enqueueInsert/Update/Delete` en transacción.
  - `mobile/lib/repositories/recurring.ts`: nueva `getTemplatesByIds(ids)` (fix N+1 flagged en review).
  - `mobile/app/periodo.tsx` `loadData`: cero Supabase directo, lee solo de repos.
  - `PaymentSheet.tsx` + `ReassignSheet.tsx`: escrituras a `planning_entries` / `planning_assignments` via repo. `ReassignSheet` gana `periodId` prop — elimina el fallback de re-fetch a Supabase.
  - `mobile/lib/sync/periodoCache.ts` **eliminado**. Callsites en `auth.tsx` removidos.
  - BugFAB opt-in: `BugReportProvider` persiste `isFabEnabled` en SecureStore (`zeta.bug_fab_enabled`, default OFF). `BugFAB` devuelve `null` si off. ToggleRow en Ajustes → Privacidad y soporte.

### Discovered this session — added to backlog
- **Mobile /periodo PaymentSheet — pre-existing parity bugs** (High, data integrity). 5 findings flagged por `mobile-webapp-parity`: `description` en vez de `raw_description`/`clean_description`, idempotency key sin hash, `linked_manually: true` faltante, `recurrence_group_id` no stampado, balance delta faltante en create-mode. Pre-existentes en main, out-of-scope del PR para mantenerlo revisable.
- **Mobile Settings v2 polish** (Medium). Usuario quiere planificarlo con calma antes de tocar. Este PR solo metió la ToggleRow del BugFAB; todo lo demás (IdentityHero, agrupación, spacing, tipografía, orden de secciones) queda para sesión de diseño.
- **Mobile Plan — restaurar FLUJO DEL MES chart** (Medium). Chart de flujo diario (balance line + markers + hoy + totales) se perdió en rediseño PR #224. User quiere de vuelta. Scope: `PlanFlowSection` nuevo o expandable dentro de `PlanNetHero`.

### Pipeline
orient → mobile-sync-doctor + mobile-webapp-parity (paralelo) → fix push.ts type union → zetas-front-guy + feature-dev:code-reviewer (paralelo) en BugFAB → revert settings polish por discusión con calma → review PR → aplicar fix N+1 (`getTemplatesByIds`) → responder Gemini (falso positivo, recomendó lo ya hecho).

### Triage candidates for next session
1. **Webapp mobile/v2/plan parity** — port native execution hero a webapp (expandir `getPlanPageData()` shape). Pendiente desde 2026-04-22.
2. **PaymentSheet parity bugs** (nuevo, High) — fix los 5 gaps vs webapp. Data integrity issue, prioridad real.
3. **Anonymous demo cleanup cron** — pendiente desde 2026-04-21.
4. **Flow 02 PR 3** — dashboard drag-to-reorder + S/M/L resize.
5. **Mobile tab polish — Deudas** (próximo en el sweep) o Movimientos slice 2.
6. **Settings v2 polish** — sesión de diseño antes de tocar TSX.
7. **Restaurar FLUJO DEL MES chart** en Plan.

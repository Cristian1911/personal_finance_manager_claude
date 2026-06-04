# Zeta Audit — Ship to Stores + Drive Activation (2026-05-30)

> Goal context: (1) deploy a new version to **both App Store + Play Store**, (2) **make people use the app** (activation/retention). Scope: mobile-webapp (responsive Next.js UI) + the Expo native app.
> Method: 23-agent workflow — 8 parallel finders over docs + live code, 14 adversarial verifications of broken/blocker claims, 1 teaching-system design pass. 128 raw findings → deduped + corrected below.
> **Corrections matter**: several BACKLOG "P0" items are stale/already-fixed. Verified status is marked ✅ done / ⚠️ partial / ❌ confirmed-broken.

---

## 0. TL;DR — critical path to ship

The build is **not blocked by code defects** for a beta; it's blocked by **operator decisions + store-form work + a few embarrassing dead buttons**. Order:

1. **Decisions only you can make** (longest pole): final bundle ID, final production domain, Play dev-account type, brand assets. Until these land, both submissions are blocked.
2. **Fix the dead/embarrassing surfaces** a reviewer hits in 60s: account-detail Pagar/Transferir/Ajustar = "Próximamente", `/transactions/new` dead route, FAB "Captura rápida" = "Próximamente", transfer type = "Próximamente". A finance app with dead primary buttons risks rejection + bad first impression.
3. **Reconcile store privacy forms** with the permissions the app now actually declares (camera/photos/audio/**background location**) — currently they say "not collected" → instant rejection risk for finance apps.
4. **Wire EAS Android submit** (no service-account/track configured) so `eas submit -p android` works.
5. **Activation** (post-ship, but design now): no push notifications (the #1 retention lever is entirely absent), no per-page teaching, no funnel tracking on native.

---

## 1. STORE-SHIP BLOCKERS

### 1a. Decisions only the user can make (hard blockers)
| # | Item | State | Why it blocks |
|---|------|-------|---------------|
| B1 | **Final bundle ID** | Live = `com.venti5.zeta` everywhere (app.json, pbxproj, build.gradle) — **internally consistent, no drift**. BACKLOG claim of `com.zetafinance.app` is **stale doc, never landed** (PR #217 intentionally kept venti5 to match the existing Play Console draft). | Changing it after first submission = brand-new listing. Decide now; reconcile BACKLOG:304/311. |
| B2 | **Final production domain** | All privacy/terms/support URLs resolve to `pfm.sanson1911.cloud` (personal VPS subdomain), flagged pending rebrand. Lives in `mobile/lib/constants/urls.ts:5`, `mobile/eas.json` (5 entries), `docs/{app-store,play-store}/*`. | Both stores require a **stable** privacy URL; changing it post-submit triggers re-review. |
| B3 | **Play dev-account type** | Unconfirmed: personal vs org `zetafinance`. | Personal accounts created after Nov-2023 must run a **14-day closed test with ≥20 testers** before first production. Hard timeline gate — resolve first. |
| B4 | **Brand assets + final screenshots** | icon 1024² (no alpha), adaptive-icon, splash, Play feature graphic 1024×500, ≥2 phone screenshots 9:16. Listing copy drafts exist (`docs/{play,app}-store/LISTING_ES.md`); Play phone screenshots marked **"pendiente"**. | Long-pole asset dependency. Screenshots must be captured **post-rebrand** so the store doesn't show stale identity. |

### 1b. Code/config blockers (I can fix these)
| # | Item | File | Severity |
|---|------|------|----------|
| B5 | **Store privacy forms contradict declared permissions.** app.json now declares camera, photo-library, **background location** (`ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE_LOCATION`, iOS `UIBackgroundModes:[location]`), audio; privacyManifests declare PhotosOrVideos + AudioData. But Play Data Safety + Apple Nutrition Labels still say location **"not collected."** | `mobile/app.json` vs `docs/play-store/DATA_SAFETY.md`, `docs/app-store/PRIVACY_NUTRITION_LABELS.md` | ❌ HIGH — rejection risk for finance apps, esp. background location |
| B6 | **Dev/debug surfaces ship unguarded in production build.** `BugFAB` mounted unconditionally (`_layout.tsx:329`, no `__DEV__` guard); `bug-report`, `annotate-screenshot`, `capture-screenshot` routes registered in the prod Stack. | `mobile/app/_layout.tsx:30,259-263,329` | ❌ HIGH — looks unfinished / fails review. *(Confirm whether intentional for beta track first.)* |
| B7 | **EAS Android submit not configured.** `eas.json` submit.production has a full `ios` block but **no `android`** (no `serviceAccountKeyPath`, no track). `eas submit -p android` fails. | `mobile/eas.json:72-87` | HIGH (blocks automated submit) |
| B8 | **terms-content.tsx uses placeholder `legal@zeta.app`** (×2) — privacy-content was already fixed to the real address; `/eliminar-cuenta` uses `giraldo.0302@gmail.com`. Inconsistent + undeliverable mailbox linked from published Terms. | `webapp/src/components/legal/terms-content.tsx:109,220` | MEDIUM |
| B9 | Reduce permission surface? Background + foreground-service location is a heavy disclosure burden for an **opt-in, off-by-default** feature. Consider dropping `ACCESS_BACKGROUND_LOCATION` to foreground-only for v1 to ease review. | `mobile/app.json:28,107-110,158-165` | MEDIUM (decision) |

### 1c. Submission-time operator tasks (no code)
- Apple financial-app disclosure in ASC form; Google Play Financial Services declaration + content-rating questionnaire (all "no") + 18+ + FINANCE category. In-app disclaimer "Zeta no es un asesor financiero" is **✅ shipped** (`mobile/app/settings.tsx:923`).
- Validate **demo mode runs on a production build** (reviewer access path: "Probar demo sin cuenta" → `seedDemoData()`).
- Reconcile App-Review contact email (`venti5.labs@gmail.com`) vs listing (`giraldo.0302@gmail.com`).
- Bump store docs: live version is **1.1.3**, docs still say 1.1.0 (versionCode auto-increments via EAS remote — fine).

### 1d. Stale — already done (don't re-do)
- ✅ **In-app account deletion** ships on both platforms (`webapp deleteAccount()` → `/settings/perfil`; `mobile deleteUserAccount()` → `settings.tsx:646`; `/eliminar-cuenta` presents in-app as method 1). BACKLOG "High / email-only" is **stale**. *(Residual: confirm cascade-delete covers all user data + auth user.)*

---

## 2. BROKEN — doesn't work as expected

### Mobile native (Expo) — highest user-facing impact
| Item | File | Verified |
|------|------|----------|
| **Account-detail Pagar / Transferir / Ajustar = `Alert.alert("Próximamente")`.** Shell shipped (PR #252); the 3 primary actions are stubs. | `mobile/components/accounts/QuickActionsBar.tsx:91-128` | ❌ confirmed |
| **FAB "Captura rápida" (NL text) = "Próximamente".** Central create action on every tab, half-dead. | `mobile/components/ui/MobileTabBar.tsx:99-102` | ❌ confirmed |
| **`/transactions/new` is a 33-line "Formulario en construcción" stub** — *but reachable* from QuickActionsBar "Agregar". Normal manual add **does work** via `/capture`; this dead route + the NL-capture + transfers are the gaps. Fix: redirect `/transactions/new` → `/capture` (preserve `?account/?type`). | `mobile/app/transactions/new.tsx` | ⚠️ partial (manual add works elsewhere) |
| **Transfer transactions can't be created on mobile** — `/capture` `transfer` type alerts "Próximamente". | `mobile/app/capture.tsx:292-299` | ❌ confirmed |
| **Manual create/update never adjusts `accounts.current_balance`** → silent balance drift. `applyAccountBalanceDelta` used only in PaymentSheet, not in the core transactions repo. | `mobile/lib/repositories/transactions.ts` | ❌ confirmed (data integrity) |
| **Mobile PDF import** writes no balance delta, no `statement_snapshots` upsert, never calls `linkTransactionToOccurrence`. | `mobile/app/(tabs)/import.tsx` | ❌ confirmed |
| **Subscriptions screen writes directly to Supabase**, bypassing repo/sync queue (offline writes lost; no local mirror). | `mobile/app/subscriptions.tsx:231-313` | ❌ confirmed |
| **Account detail counts debt-account inflows as "Ingresos del mes"** — violates project income rule. | `mobile/app/account/[id].tsx:248-258` | ❌ confirmed |
| PaymentSheet balance update has read-then-write race (no row lock) — needs atomic RPC. | (HANDOVER:97) | confirmed |
| `/pendientes` + `/etiquetas` = "Próximamente" stubs. | `mobile/app/{pendientes,etiquetas}.tsx` | ❌ confirmed |

### Mobile-webapp (responsive Next.js)
| Item | File |
|------|------|
| **Transaction search debounce never clears** — returned cleanup from onChange is ignored; every keystroke fires `router.push`. | `transaction-filters.tsx:90-96,~197,~209` |
| **Multi-currency formatters hardcode COP** — `getDestinatariosWithSpend` sums mixed currencies; hardcoded COP in suggestions/budget surfaces. | `destinatarios.ts:327-353`, `destinatario-suggestions-tab.tsx:181`, budget-form |
| **`updateEstimatedIncome` / `setBudgetMode` incomplete cache invalidation** → stale budget page (no `updateTag`). | `budget.ts:102-115,38` |
| **Budget wizard ignores `Promise.all` results** → silent data loss on save failure; IncomeEditor never re-syncs. | `budget-wizard.tsx:98-113`, `budget-page-client.tsx:149` |
| **50/30/20 buckets Savings into Wants** (any non-`fixed` → Wants) → corrupts the health signal. | `allocation.ts:40-49` |
| Transaction edit page omits `tags` prop → tag selector invisible when editing. | `transactions/[id]/page.tsx:79-83` |
| MergeDialog no `router.refresh()` → merged destinatarios stay visible. | `merge-dialog.tsx:44-55` |
| `addDestinatarioRule` conflicts silently dropped (wrong `useActionState` type). | `destinatario-detail.tsx:279-294` |
| `/accounts` vs `/transactions` "uncategorized" count drift (definition mismatch). | (HANDOVER:37) |

### Backend / shared
| Item | File | Verified |
|------|------|----------|
| **Telegram webhook chat-linking broken end-to-end** — admin client can't decrypt the `capture_tokens` encrypted view, so `/start <token>` + `/vincular <token>` never match. Needs `SECURITY DEFINER` RPCs. | `webapp/src/app/api/webhooks/telegram/route.ts:2,26-30,90,126,157,206` | ❌ confirmed |
| Lulo Bank detection too broad (any uppercase "LULO") — savings statements may misroute to CC parser. | `services/pdf_parser/parsers/__init__.py:37` | (BUGS:60) |
| Nequi (password-protected) PDFs need password param / auto-detection (filename = password). | parser | (BUGS:79) |

---

## 3. PARITY GAPS — native lags the webapp (functional debt)

The native app is a thinner shell than the mobile-webapp. Biggest gaps:

- ❌ **Dashboard missing the entire "Am I on track?" layer**: HealthZone/HealthScore, Flujo (burn/waterfall/cashflow charts), Heatmap, DashboardAlerts banner, full UpcomingPayments, MonthSelector/account scope, ~7 widget-catalog stubs. (`mobile/components/inicio/`, `widgets.ts`) — **this is the core value prop, absent on native.**
- ❌ **Whole CRUD domains missing on native** (largest functional gap): destinatarios (no create/edit/merge/suggestions — detail is read-only), recurring-template editor (can only mark paid/skip, can't create/edit templates), categorizar bulk, categories icon/zone-picker, etiquetas (orphaned stub, no nav reaches it).
- **Budgets**: no 50/30/20 allocation chip/sheet, no pressure grouping, no treemap, no essentials/wants split.
- **Deudas**: no "Pago extra", no multi-currency rollup, no ExchangeRateNudge, no month selector; planificador compare/detail charts deferred.
- **Import**: missing **Destinatarios step** (4 vs 6 steps) — destinatario_id is Zeta's most reliable grouping anchor. *(Note: the #250 reconciliation/cuota scoring fixes ARE on mobile via the shared engine — that BACKLOG P0 is ⚠️ stale; the real gaps are the missing step + side-effects in §2.)*
- **Settings**: flat monolith — missing Integraciones, Email ingest, PDF passwords, Tags, Analytics, Bug report sections.
- **Transactions list**: missing tag/direction/date-range/amount/showExcluded filters; search omits `clean_description`.
- PaymentSheet recurring-payment create-path diverges (descriptions + category) → breaks debt category aggregation. ❌ confirmed.
- Cross-account debt-payment vinculación not supported on mobile TX detail.
- `/suscripciones` (webapp) ↔ `/subscriptions` (RN orphan) not aligned.
- **mobile-webapp** Plan still uses "Neto del mes" projection vs native's "execution hero" (`disponible`). (`plan-net-hero.tsx:28-29`)
- ✅ **Stale/fixed**: mobile `/periodo` PaymentSheet "5 data-integrity bugs" → **already-fixed**. Mobile onboarding "sync unverified" → **stale** (it writes profile to Supabase now); real residual = doesn't set `nav_focus` / seed `dashboard_config` (C14/C15).

---

## 4. ACTIVATION & RETENTION GAPS ("make people use the app")

- ❌ **No push notifications anywhere** (no `expo-notifications`, no token registration, no scheduled local notifs). **The single biggest retention lever is entirely absent** — no payment-due nudge, no spending-spike alert, no weekly digest.
- ❌ **No proactive notification / weekly-digest system** (rule-based) on either platform. (TASKS:31,38)
- ❌ **Native app has ZERO funnel/activation event tracking.** Webapp instruments ~63 `trackProductEvent/trackClientEvent` sites (onboarding steps, import, categorize, capture, dashboard_viewed → `product_events`). Mobile records nothing → can't measure activation on the actual store artifact.
- ❌ **No reusable coach-mark / tour / spotlight primitive on either platform** (only shadcn Tooltip + chart tooltips). → see §5.
- ❌ **Per-page first-run teaching absent** on every complex tool (import, plan/50-30-20, deudas planificador, puedo-pagar, presupuesto, categorizar). Cold landings.
- ❌ **Expo Home has no starter/first-run mode** — new users see empty widgets, not guidance. (webapp + mobile-webapp both have a "Primeros pasos" starter; native doesn't.)
- **`/suscripciones` unreachable** in mobile-webapp nav (no entry in `mobile-link-grid.tsx`) — shipped but hidden.
- Mobile auth has no magic-link/passwordless path (webapp does) — signup friction.
- Demo mode asymmetric/partially hidden on mobile (strongest "see value first" lever).
- Mobile onboarding doesn't set `nav_focus`/`dashboard_config` → generic non-personalized first experience.
- No in-app notification center / alert inbox.
- Nudge variants `debt_milestone` + `budget_surplus` not ported to mobile.
- No "rate the app" (`expo-store-review`) prompt after a positive moment.
- "Primeros pasos" empty state could be a 4×4 grid of entry points (BACKLOG:231).

---

## 5. TEACHING SYSTEM — per-page first-run education (your 2nd ask)

**Finding: greenfield.** Two solid *setup* wizards exist (`webapp /onboarding` 4-step, `mobile onboarding.tsx` 5-step, both with analytics + skip + purpose-driven quick-win routing). But there is **zero in-product teaching layer** — no coach-marks, no per-surface "seen this page" flag, no reusable empty-state "primeros pasos" card. `onboarding_completed` is global/binary and can't answer "has the user seen the import tour."

**Recommended system — small + bespoke, no third-party tour lib** (project rule: speed > animation; joyride/driver.js don't work in RN; Framer Motion + Reanimated already installed):

1. **Persistence** — new `profiles.teaching_state JSONB DEFAULT '{}'` (cross-device truth), shape `{ "<surfaceKey>": { seen, dismissedAt, version } }`. Mirror to mobile SQLite `profiles` (ALTER, the `schema.ts:352` pattern). `version` field re-teaches redesigned pages without a migration. profiles is **not** an `_enc` table → plain migration (spawn `supabase-migrator`).
2. **Two primitives**:
   - `<PrimerosPasos surfaceKey title steps[] cta />` — dismissible getting-started card for empty/first-visit states. The workhorse: inline, no overlay, fast, token-compliant (`PANEL_SURFACE_CLASS` + `BRASS_BUTTON_CLASS`). Auto-hides once seen or once the surface has real data.
   - `<CoachMarks steps={[{anchorRef, title, body, placement}]} />` — guided spotlight for the 2-3 genuinely spatial surfaces only (import wizard, plan 50/30/20). Web: fixed `bg-black/60` overlay + cutout via box-shadow spread on the node's rect + shadcn Popover bubble. Mobile: Reanimated fade + `measure()` + `useSafeAreaInsets`. Both fire teaching analytics (copy `trackClientEvent` shape) + always offer "Saltar"/"No volver a mostrar" + a replay link in the page sub-header.
3. **Content registry** — `packages/shared/src/teaching.ts` (`TEACHING_CONTENT` keyed by surfaceKey, Spanish-first) so web + mobile render identical copy.

**Per-surface plan** (priority = activation order):

| Surface | Why it confuses a new user | Teaching approach | Pri |
|---------|----------------------------|-------------------|-----|
| **Import wizard** | 6 steps; "destinatario", "duplicado", cuota≠full price are alien | CoachMarks per step (account-match, destinatario col, reconcile chip) + PrimerosPasos on empty landing | High |
| **Plan 50/30/20** | buckets/"disponible" unexplained | CoachMarks (3) over flow-chart segments + PrimerosPasos → presupuesto if no budget | High |
| **Presupuesto setup** | asks for limits before any spend history | Annotated empty state pre-filled from onboarding pulse + coach-mark on suggested-limit pill | High |
| **Categorizar inbox** | doesn't know categorizing trains auto-cat + feeds budget | Inline example on first card + 1 coach-mark on bulk bar; persist after first categorize | High |
| **Deudas planificador** | snowball vs avalanche, scenarios dense | PrimerosPasos (2-line strategy explainer) + CoachMarks (2) on toggle + extra-payment | Med |
| **Puedo pagar** | doesn't know what drives the verdict | Annotated empty state with one worked example | Med |
| **Recurrentes** | occurrence lifecycle invisible | PrimerosPasos on empty timeline + coach-mark on pending chip | Med |
| **Destinatarios** | "destinatario" concept novel | One-line PrimerosPasos definition + example | Low |
| **Suscripciones** | multi-per-destinatario / auto-detect non-obvious | PrimerosPasos explaining detection | Low |

**Sequenced rollout**: Phase 0 rails (migration + TeachingProvider + `markSurfaceSeen` action + shared registry + `<PrimerosPasos>` + Storybook) → Phase 1 wire PrimerosPasos on the 4 funnel surfaces (import/presupuesto/categorizar/plan) → Phase 2 build `<CoachMarks>` + apply to import + plan → Phase 3 lower-traffic surfaces → Phase 4 mobile mirror (gate: parity + sync + perf doctors) → Phase 5 measure teaching analytics vs activation, prune high-dismiss tours.

---

## 6. INSIGHTS & METRICS — monthly/weekly spending (your 3rd ask)

What exists vs what's missing:
- **Webapp has the data layer**: `getMonthlyCashflow`, `getCategorySpending`, `getDailySpending`, `getBurnRate`, `getDailyBudgetPace`, `getAccountsWithSparklineData` (`webapp/src/actions/charts.ts`) + the dashboard HealthZone/Flujo/Heatmap render them.
- **Native has almost none of it** (§3): no charts (Skia installed, unused — "Mobile charts MVP" backlog item), no HealthZone/Flujo/Heatmap.
- **No narrative/proactive insight layer anywhere**: "Smart insights" (cross-month trends, *why* things changed) is backlog-only; no weekly/monthly digest; no spending-spike/savings-drop detection.

**Recommended framing — 3 tiers, escalating:**
1. **Surface the metrics on native** (port the 6-chart MVP + HealthZone to mobile). This makes the store artifact actually answer "Am I on track?".
2. **Weekly/monthly digest = the retention engine.** Rule-based (no AI per project constraint): "Gastaste 18% más en Restaurantes esta semana", "Vas $120k bajo presupuesto", "Te quedan 9 días de runway". Deliver via the **push-notification system that must be built anyway** (§4) + an in-app insight feed. This is where insights and the #1 retention lever (push) converge — build them together.
3. **Smart insights narrative** (cross-month deltas, anomaly callouts) layered on the same `charts.ts` aggregations + a thin rules engine. Tie into the notification center / alert inbox.

This work is **synergistic with activation**: the digest *is* the re-engagement loop, and the teaching system (§5) teaches users to read these metrics.

---

## 7. Decisions needed to proceed
1. **Bundle ID**: keep `com.venti5.zeta` (matches existing Play draft) or switch to `com.zetafinance.app`?
2. **Final production domain** for privacy/terms/support URLs (replaces `pfm.sanson1911.cloud`)?
3. **Play dev-account type** (personal post-Nov-2023 → 14-day/20-tester test required, or org → direct promotion)?
4. **First execution thread**: store-blockers / teaching system / mobile parity / insights+push?

*(Full raw findings + verification evidence: workflow run `wf_5b857737-86d`.)*

---

## 8. Session progress — 2026-05-30 (decisions + store-blocker code DONE)

**Decisions locked:** thread = store-blockers first · bundle ID = keep `com.venti5.zeta` · domain = keep `pfm.sanson1911.cloud` for v1 · Play account = personal post-Nov-2023 → **14-day/≥20-tester closed test required** (so the immediate target is a clean *closed-test* build; the half-built buttons are production-promotion blockers, not closed-test blockers) · background location = **keep + declare fully**.

**Shipped this session (code/docs — verified `tsc` 0 errors, eslint clean):**
- ✅ `webapp/.../legal/terms-content.tsx` — placeholder `legal@zeta.app` (ES+EN) → real `giraldo.0302@gmail.com`.
- ✅ `mobile/app/transactions/new.tsx` — dead "Formulario en construcción" stub → `<Redirect href="/capture" />`.
- ✅ `mobile/components/accounts/QuickActionsBar.tsx` — account-detail "Agregar" now routes to the working `/capture` (was the dead route).
- ✅ `mobile/eas.json` — added `submit.production.android` (serviceAccountKeyPath + `track: internal`).
- ✅ `mobile/app/settings.tsx` — added Google-required **prominent disclosure dialog** before the background-location OS prompt (explicit consent + privacy-policy link).
- ✅ `mobile/app.json` iOS privacyManifest — added `Precise`+`Coarse` Location collected-types; removed over-declared `AudioData` (voice is on-device-only, never transmitted).
- ✅ `docs/play-store/DATA_SAFETY.md` + `docs/app-store/PRIVACY_NUTRITION_LABELS.md` — reconciled to the live manifest (Location incl. background + Photos/videos now declared; Audio justified as not-collected; deletion contact fixed). Verified data flows: voice = on-device (`capture-voice.tsx:214-270`), OCR images uploaded to `/api/parse-image` (`capture-screenshot.tsx:151-162`).

**Activation — slice 1 SHIPPED (push, local payment reminders — `tsc` 0 errors):**
- ✅ `expo-notifications ~55.0.23` installed (root lockfile synced) + `expo-notifications` plugin in `app.json`.
- ✅ New `mobile/lib/services/notifications/` (preferences in SecureStore — no migration; permissions; scheduler). `reschedulePaymentReminders()` cancels+reschedules local day-before-6pm reminders from `getPendingOccurrences()` (≤14-day horizon, cap 30), Spanish copy "💸 Mañana vence {merchant} · {amount}".
- ✅ Settings "Notificaciones" → "Recordatorios de pago" toggle (opt-in, default off; permission prompt; reschedule on toggle).
- ✅ Wired: reschedule after `syncAll()` (auth.tsx) + on app foreground (_layout.tsx); notification-tap deep-links to `/pendientes`.
- Caveat: local notifications only fire in a dev/preview/prod build (not Expo Go). Next push slices: server-side weekly/monthly insights digest (needs push tokens + cron) → then per-page teaching once UI settles.

**Activation — slice 2 SHIPPED (mobile funnel tracking — `tsc` 0 errors):**
- ✅ New `mobile/lib/analytics/product-events.ts` — `trackProductEvent()` mirrors webapp shape (`ProductEventInput`/`ProductEventInsert`), `platform:"mobile"`, per-launch `session_id`, fire-and-forget, RLS-backed insert (`product_events` user-insert policy confirmed). Cast via `ProductEventWriter` since `product_events` isn't in `@zeta/shared` Database type (same pattern as webapp).
- ✅ Full funnel wired (5 events): `app_opened` (_layout.tsx, ref-guarded, real-session only), `onboarding_completed` (onboarding.tsx), `transaction_created` (capture.tsx), `import_completed` (import.tsx), `categorize_applied` (CategorizarRoot.tsx). Expo app had ZERO tracking before. Activation is now measurable during the closed test.

**Activation — slice 3 IN PROGRESS (server-side weekly digest):**
- ✅ Engine SHIPPED (TDD, 10/10 green): `packages/shared/src/utils/weekly-digest.ts` — pure `buildWeeklyDigest(input)`, rule-based (no AI), Spanish copy. Inputs: this/last-week spend, top category, monthly budget + month-to-date + day-of-month pace, upcoming 7-day payments. Outputs: `verdict` (on_track/watch/over) + emoji + title + `pushBody` + in-app `lines` + `spentDeltaPct`. Exported from `@zeta/shared`. Reused by web + mobile + cron.
- ⚠️ Pre-existing: `@zeta/shared` test suite has ~40 failing tests in unrelated files (debt-stats, scenario-engine…) — NOT from this change; separate tech-debt (CI may be red).
- ✅ Data-action SHIPPED (tsc clean): `webapp/src/actions/weekly-digest.ts` `getWeeklyDigest(currency)` — composes `getDailySpending` (this+prev month, merged for cross-boundary 7-day windows, TZ-stable), `getCategorySpending` (top, month-scoped proxy), `getDailyBudgetPace` ({totalBudget, totalSpent}), `getUpcomingRecurrences(7)` (OUTFLOW only) → `buildWeeklyDigest`. No `"use cache"` wrapper (composes cached actions, like `getRitmo`).
- Remaining slices: (b) in-app digest surface (card consuming `getWeeklyDigest`); (c) **delivery** — decision pending: email (Resend, already wired, no token infra, reaches web+mobile, simplest cron) vs push (expo push-token table + registration + Expo Push send + cron with `zeta_decrypt_as` for cross-user) vs both; (d) cron trigger (Supabase pg_cron / VPS / GH Action schedule).

**Build pre-flight (expo-doctor) — 16/19 → 18/19, push code build-clean:**
- ✅ Deduped `expo-constants` (the `expo-notifications` install pulled 55.0.16 alongside the project's 55.0.7 → duplicate native module). Fixed via root `pnpm.overrides: { "expo-constants": "55.0.16" }`; mobile now resolves a single 55.0.16; lockfile synced; `tsc` 0.
- ✅ Removed redundant `newArchEnabled: true` from app.json (new arch is default-on in SDK 55; was failing the config-schema check; behavior-neutral).
- Remaining 1 failure = pre-existing SDK patch-drift on ~18 packages (non-fatal, `npx expo install --check` to bump — separate deliberate task, NOT mine).

**Perceived-speed / skeleton strategy (user raised 2026-05-30):** move to cache-first / stale-while-revalidate / skeleton-only-on-cold-start. Primitive already exists (`useLiveDashboard`/`use-live-metrics.ts`, used only on dashboard hero/alerts) — extend it; ensure pages are actually cached (no dynamic leaks into the main Promise.all); mobile should render SQLite-first instead of blocking spinners. Route-level `(dashboard)/loading.tsx` is the main skeleton-wall offender. Recommend `perf-auditor` to find all offenders.

**Corrections baked in (stop trusting stale BACKLOG):** in-app account deletion already ships ✅ · bundle ID is consistent (no drift; "zetafinance" rebrand never landed) ✅ · `/periodo` PaymentSheet "5 bugs" already-fixed ✅ · import #250 reconciliation fixes ARE on mobile ✅ · the `bug-report`/`annotate`/`capture-screenshot`/`BugFAB` set is a legit in-app bug-reporter, **not** a debug leak (B6 downgraded: optional production polish, not a blocker).

### Submission runway — REMAINING (all operator-side; code for the closed-test build is done)
1. **Drop the Google Play service-account JSON** at `mobile/credentials/google-play-service-account.json` (path scaffolded in eas.json).
2. **Confirm Play dev-account type** in Console; if personal, start the **14-day closed test with ≥20 testers** ASAP (it gates first production).
3. **Google background-location declaration form + demo video** (Play Console) — required because we kept background location.
4. **Brand assets**: final icon 1024² / adaptive-icon / splash / Play feature graphic 1024×500 + **≥2 phone screenshots 9:16 captured post-rebrand**.
5. **Submission forms**: Apple financial-app disclosure; Play Financial Services declaration + content rating (all "no") + 18+ + FINANCE.
6. **Validate demo mode** ("Probar demo sin cuenta") on a production build (reviewer access path).
7. Bump store docs version refs 1.1.0 → 1.1.3; reconcile App-Review contact email.

## 9. Perceived-speed (skeletons) + auth — 2026-05-30

**Root cause of the "skeleton walls"** (perf-auditor): every `(dashboard)/*` page awaits its full `Promise.all` before emitting a byte, and the dashboard layout's `connection()` forces the segment dynamic → `loading.tsx` shows on *every* nav even though data is Data-Cache-warm. Mobile screens gate the whole screen on `loading`/`data===null` despite instant SQLite.

**Shipped this session (mobile blank-screen, `tsc` 0 errors):**
- ✅ `mobile/components/deudas/DeudasRoot.tsx` — `EMPTY_OVERVIEW` zero-state instead of `null` → renders layout instantly.
- ✅ `mobile/app/accounts-list.tsx` — removed full-screen `ActivityIndicator` gate → FlatList + header render immediately.

**Ranked queue (perf-auditor, by impact/effort) — not yet done:**
1. [M] `transactions/page.tsx` — split into shell + `<Suspense>` data loader (highest-traffic route).
2. [M] `mobile/app/subscriptions.tsx` — port from direct Supabase to SQLite repos (only mobile screen hitting network on focus, +300–800ms spinner).
3. [S] add `"use cache"` to `getNonDebtAccounts`, `isTransactionLinkedToOccurrence`, `getRitmo`, `get503020Allocation` (currently React `cache()` only → recompute per request).
4. [M] `getPlanPageData` React `cache()` → `"use cache"` (kills the repeated full-page Plan skeleton).
5. [S] `mobile/app/periodo.tsx` empty-state struct (same pattern as DeudasRoot).
6. [M] split `MobileZone` into hero+widgets Suspense zones; extend `useLiveDashboard` to the Plan hero.
- Principle: cache-first / stale-while-revalidate / skeleton-only-on-cold-start. Primitive (`useLiveDashboard`/`use-live-metrics.ts`) already exists; apply broadly.

**Auth diagnosis (webapp, `lib/supabase/middleware.ts` + `auth.ts`) — suspected "awful auth" causes, NOT yet fixed (high blast radius; confirm symptom first):**
- `no-store` on ALL `text/html` responses (middleware.ts:106-111) → kills bfcache; every back/nav is a full server round-trip. Biggest perceived-slowness contributor.
- `getUserSafely` re-throws non-ignorable `getUser()` errors (auth.ts:71) → a transient Supabase blip throws *inside middleware* → error/bounce instead of graceful degrade.
- `clearAuthCookies` (middleware.ts:57-59) wipes all `sb-*-auth-token` cookies on any null-user path.
- Mobile lacks magic-link/passwordless + auth-callback error states (BACKLOG:1177-1182).
- Verification workflow: attach browser tools to an already-authenticated Chrome (remote-debugging) or replay a saved `storageState` so re-login is one-time, not per check.

### Remaining ship-quality CODE (production-promotion, can fast-follow the closed test)
- Account-detail Pagar / Transferir / Ajustar (still "Próximamente") — port quick-payment / transfer / reconcile dialogs (each: SQLite mutation + sync push; gate parity + sync doctors).
- FAB "Captura rápida" (NL) + `/capture` transfer type — both "Próximamente".
- Optional polish: gate `BugFAB` to non-production or move to Settings.
- Stale BACKLOG bundle/version notes (lines ~304/311) — reconcile to reality.

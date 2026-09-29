# Zeta v2 — build plan and spec (v2, 2026-09-29)

**Status:** final spec after 7 planning sessions with the owner. Replaces v1 of this file (2026-09-28).
**Authority:** `12-decision-log.md` holds every decision with its date and what it replaced; if this file and the log ever disagree, the log wins. Use cases: `11-use-cases.md` (IDs like UC-F7). Widget rules: `13-widget-design-rules.md`. Session pages with diagrams: `sessions/01`–`07`.
**Team:** the owner (product owner, manager, stakeholder) and Claude (main developer). The owner accepts each milestone on a real device (S7-2).

---

## 1. What v2 is

A native app (iPhone + Android, same store listing `com.venti5.zeta`) that answers one question: **how much can I still spend until my next payday?** (Disponible), with money movements arriving on their own.

- **Tabs:** Inicio · Movimientos · Revisar. Ajustes from the avatar.
- **Inicio:** the Disponible block (fixed), then a 2-column widget grid the user organizes (S5-4).
- **Other screens:** Detalle (one sheet for every movement), Tu flujo, Pagos (Este ciclo / Próximo / Deudas), Te deben (+ Tú debes), Límites, Mis cuentas, Lo que Zeta sabe, Fuentes, Privacidad, Apariencia; v1.1: Tu plan / paywall, Historia, Viajes.
- **Works offline** for everything except Gmail, PDF parsing, naming never-seen merchants, template updates, detail older than the local window and new-device sign-in (S1-1).
- **The web app** stays as it is until v2 ships, on the same database; afterwards it's reduced to bulk PDF import and account management (S1-4).

## 2. Way of working

| Topic | Rule |
|---|---|
| Branches | Feature branch → PR → owner review → squash to `main`. Never commit to `main` (a push deploys production). |
| Environments | All v2 development against a **separate Supabase dev project** with seed data (S1-5). The owner's real account moves to v2 builds only when a milestone is stable. |
| Migrations | Dev project first; `supabase-migrator` review; production by hand (`supabase db push` + `migration list`); **additive only until v2 ships**. |
| Milestone acceptance | Each milestone ends with a demo the owner runs on a real device (section 10). |
| Build gates | `pnpm install` (if deps changed) · `pnpm build` · `cd mobile && npx tsc --noEmit` · `pnpm --filter @zeta/shared test` (includes engine contract tests) · widget gallery screenshots for touched widgets · `pnpm audit --audit-level high` before PRs. |
| Estimates | Calendar weeks, including owner review and external reviews; re-estimated after M0 (S7-2). |

## 3. Architecture

### 3.1 The pieces
| Where | What runs |
|---|---|
| **Phone** (Expo, `mobile/`) | Screens; the **engine** (`@zeta/shared`); local SQLite (SQLCipher-encrypted, S2-1) with the last 3 cycles of movements + all cycle summaries (S1-3); the **command outbox**; the Android notification listener; Shortcuts App Intent on iPhone; local bill reminders. |
| **Server** (Next.js, `webapp/`) | The **command runner** (same engine, Postgres adapter); Gmail sync job; forwarding-email ingest; PDF parser proxy; merchant naming (Claude Haiku); push sender; signed template pack; RevenueCat webhook (v1.1). |
| **Database** (Supabase) | The truth. RLS per user; envelope encryption (Vault master key → per-user key → `_enc` tables, identifiers encrypted, amounts plain). |
| **PDF parser** (`services/pdf_parser/`) | Unchanged: 9 banks + fallback. |

### 3.2 The engine: offline-first commands (S1-1, S1-2)
- **Every write is a command** (`id` created on the phone, `type`, `payload`, `client_ts`, `device_id`). Row ids are created on the phone too, so nothing is renumbered at sync.
- **Phone:** runs the command through the engine against SQLite → local rows updated → screen shows the final result → command queued in the outbox.
- **Server:** `POST /api/v2/commands` (batch; bearer auth; user-scoped Supabase client so `_enc` INSTEAD OF triggers run as the user) runs the **same code** against Postgres, plus what only it sees (Gmail, PDF, emails). Records `commands.id` → a replay is a no-op.
- **Sync down:** pull of the server's rows (narrowed table set, windows below) replaces local rows when the server knew more.
- **Conflicts (S1-2):** bank facts (amount, date, merchant text) → higher capture tier wins (PDF › email › notification › manual); user choices (category, note, split, cuotas, trip, bill link) → the user's value always survives, same field on two devices → latest `client_ts` wins (`field_versions`); weak duplicate matches → Revisar card.
- **Code layout:**
  - `packages/shared/src/engine/` — command types, `StoragePort` interface, command handlers, `computeDisponible`, `verdict`, template matcher, suggestion pipeline.
  - `mobile/lib/v2/engine/sqlite-adapter.ts` — `StoragePort` over expo-sqlite.
  - `webapp/src/lib/engine/pg-adapter.ts` — `StoragePort` over the user-scoped Supabase client.
  - **Contract tests:** one suite runs every command against both adapters (Node: a SQLite driver and a Postgres driver as dev dependencies; plus an integration run against the dev project). A difference is a failing test, not a production bug.
- **Sync set:** `profiles`, `accounts`, `account_settings`, `categories`, `destinatarios`, `destinatario_rules`, `merchant_policy`, `category_rules` (until merged), `budgets`, `personal_debts`, `personal_debt_allocations`, `recurring_transaction_templates`, `recurring_occurrences`, `occurrence_payments`, `transactions`, `modos`, `user_cycle_settings`, `bill_reservations`, `cycle_summaries`, `user_notification_templates`, `field_versions` (own rows). Windows: transactions last 3 cycles; occurrences previous month → +60 days; summaries all.
- **Replaces:** raw-row pushes in `mobile/lib/sync/push.ts` and the repository re-implementations of server side effects. The pull, single-flight and reset-lock logic of `mobile/lib/sync/` is kept.

### 3.3 Command catalog (v1)
| Command | Use cases |
|---|---|
| `captureTransaction` (sources: manual, voice, notification, sms, wallet, email, pdf, shortcut) | C1–C15 |
| `editTransactionField` | D7 |
| `setCategory` (scope: this / merchant / merchant + past) | D1–D3 |
| `setMerchantPolicy`, `renameMerchant`, `mergeMerchants` | D4–D6 |
| `markNotAMovement`, `deleteTransaction`, `resolveDuplicate` | D8, D9 |
| `setInstallments` | C11 |
| `splitTransaction`, `lendMoney`, `recordBorrowed`, `registerRepayment`, `forgiveDebt` | G1–G12 |
| `createAccount`, `updateAccount` (incl. counts for Disponible), `createAccountFromStatement`, `assignUnknownAccount` | A8, A11–A13, F1, F5 |
| `createRecurring`, `updateRecurring` (this / from now on), `skipOccurrence`, `stopRecurring`, `payOccurrence` (partial ok), `linkPaymentToBill` | E2–E11 |
| `payCard`, `payLoan` (cuota / extra / pay-off) | F3, F6–F8 |
| `setCycleSettings`, `setSavings`, `decideLeftover`, `createReservation` (apartar), `adjustBalance` (cuadrar) | A2–A4, I1, I2, S3-7, D14 |
| `setLimit`, `removeLimit` | H1–H3 |
| `trainTemplate`, `deleteTemplate`, `rescueIgnored` | D11, K3, K4 |
| `setWidgetLayout`, `setTheme` | B16, K10 |

## 4. The number (session 3)

`Disponible = Llega este ciclo − Por pagar − Ahorro − Ya salió (± ajustes)`; per day = Disponible ÷ days left including today, rounded down to $100.

| Rule | Decision |
|---|---|
| Accounts | The user chooses which accounts count (default checking, savings, cash; not investments; never cards or loans). Transfers inside the counted set: no effect; out of it: down (fills Ahorro first); into it: up. (S3-0) |
| Credit cards | Available credit is never Disponible. Card purchases don't lower Disponible; the **card bill** counts in Por pagar in the pay cycle it's due, at the **minimum payment by default** (S3-6), estimated from seen purchases (1-cuota in full + this month's cuota of each purchase + interest) until the PDF/statement email. Paying above Por pagar = extra payment. |
| Look-ahead | Each card's growing next bill is shown ("≈ al corte si sigues a este ritmo"); if next cycle would go below 0, today's verdict is Cuidado with the reason (S3-5). |
| Bills | Promised money is subtracted before it's paid; paying it moves Por pagar → Ya salió. Partial payments (D5), loans with balance/rate/term (D3), pay-off closes remaining cuotas (D6). |
| Horizon | Pagos/Tu flujo show 60 days; bills in the next 12 months > 30% of a cycle's income → "Prepárate" + apartar (reservation subtracted each cycle) (S3-7). |
| Variable bills | Average of last 3 (≈) until the real amount; utilities ask via Revisar on arrival day (S3-8). |
| Te deben / Tú debes | Shared purchase: full amount out, own share is spending, rest is Te deben; repayments are "Te pagaron". Money you owe = Por pagar (D8). |
| Cash | ATM withdrawal counts when made; logging cash relabels it (S3-1). |
| Big card purchases | ≥ $300.000 enter the projected card bill in full until cuotas are answered (S3-2). |
| Leftover / overspend | Ask to save; unanswered → stays ("Te sobró"). Negative carries as a line (S3-3). |
| Verdict | Vas bien ≥ 85% of starting per-day; Cuidado below it (or a bill at risk ≤ 3 days, or next cycle short); Te pasaste < 0. Worsens immediately, improves after 24 h (S3-4). |
| Special | First cycle from the balance anchor; irregular income = calendar month, only received money; foreign currency ≈ day rate + 3%; "Cuadrar con mi saldo"; never hide the number (~ with reason). |
| Summaries | One per closed cycle, derived, rebuilt when late data arrives (S1-3). |

**Tests:** `computeDisponible` and `verdict` are pure functions with a test per row above and per worked example in `sessions/03-disponible.html` (Laura: $421.100 / $35.000 per day; Cuidado at $250.000 spent; card minimum $640.000 of $1.850.000).

## 5. Capture (session 4)
| Path | Where it runs | Notes |
|---|---|---|
| Android bank-app notifications | Phone, offline | Kotlin `NotificationListenerService` (Expo module + config plugin); only chosen apps; full template match → auto; partial → Revisar; unknown with $ → training card; ignore templates (OTP, promo, rechazada) → Ignorados (30 days, phone only). |
| Android SMS and Google Wallet | Phone, offline | Through the SMS app's / Wallet's notifications, SMS filtered by allowed bank senders. No READ_SMS (S4-6). |
| iPhone Apple Pay + bank SMS | Phone, offline | User-installed Shortcuts automations ("Transacción", "Mensaje") calling a Zeta App Intent. **M0 spike** must prove the SMS text arrives without a per-run prompt (S4-6). |
| Bank emails | Server | Forwarding address at launch; Gmail read-only connect for ≤ 100 testers until Google verification + CASA (started in M0) (S4-1). |
| Statement PDFs | Server | Upload from phone or web; creates accounts from the statement (D1); reconciliation summary. |
| Statements by email | Server | Existing pending-statement queue. |
| Manual, voice, text | Phone, offline | Deterministic parser; Claude Haiku only for unparseable text when online (replaces Gemini) (S4-4). |
| Screenshots (v1.1, Plus) | Server | Existing per-layout parsers first, vision model for other banks; always reviewed (S4-7). |

- **One template engine** for notifications and bank emails; signed pack downloaded without releases; user training (auto-capture after 2 confirmed matches); wording-change detection (3 partial matches in 48 h). The Bancolombia email parser becomes the first templates, proven by replaying the saved email corpus (S4-2).
- **Raw notice text** uploaded encrypted, with an off switch (S4-3). **Balance notices** check and ask, never auto-adjust (S4-5).
- **Failure handling:** heartbeat + OEM battery guidance, permission checks, quiet-source line under the number, PDF catches misses.

## 6. Data model (sessions 2, 3, 6)
- **Keep 28 tables** (accounts, transactions, destinatarios, recurring, personal debts, budgets, modos, email capture, platform…). **Freeze 18** (subscriptions, tags ×6, planning ×3, scenarios ×2, wishlist ×2, financial_reminders, statement_tray_dismissals, capture_tokens, design_reviews): untouched while the web lives; 6 months after the web is reduced → exported per user, then dropped; tags wait for D4 (S2-4).
- **New tables (16):** `commands`, `field_versions`, `cycle_summaries`, `occurrence_payments`, `user_cycle_settings`, `merchant_policy`, `category_migration_map`, `notification_template_packs`, `user_notification_templates`, `capture_heartbeats`, `gmail_connections`, `push_tokens`, `merchant_suggestions`, `account_settings`, `bill_reservations`, `entitlements` (v1.1).
- **Changed:** enum `transaction_capture_method` + `NOTIFICATION` (tier 2, and in `CAPTURE_TIER`); `recurring_occurrences.amount_source` (estimate / actual); 25 system categories seeded; `personal_debts.direction = 'borrowed'` used again.
- **Rules:** additive only until v2 ships; new settings in side tables, never new `_enc` columns; command payloads encrypted with the user's key, kept 90 days, ids forever (S2-2); existing users' categories move to the 25 only if they accept (S2-3).

## 7. Interface (session 5)
- **Themes:** Oliva afinada (default) and Nítido (optional; Plus in v1.1), each light and dark → 4 token sets in `mobile/v2/tokens` (S5-1). Oliva's fix: chip/tag borders ≥ 3:1, white cards + soft shadow on deeper sand, stronger Vas-bien tint.
- **Rules:** black = tap, color = state, gray = data; no side stripes anywhere; only Disponible is bold; widgets centered; see `13-widget-design-rules.md` (S5-R).
- **Inicio:** Disponible block + 2-column widget grid (13 widgets), alerts with the most critical auto-opening once a day (S5-4).
- **Tu flujo:** per cycle with 2 edge days; drag to read balance; tap a day for its items; projected line; below $0 in red with the run-out day and per-day cut; next-cycle shortfall in amber with Apartar (S5-2).
- **Screens:** redrawn by Claude Design from `05c-claude-design-v2-prompt.md` (S5-3); implementation follows those screens and the tokens.

## 8. Plans and payments (session 6, ships in v1.1)
- **Free:** the promise (Disponible, all automatic capture, Revisar, Pagos, debts, Te deben, límites, Oliva light/dark, offline, export/delete), 3 statement PDFs per month (unlimited during the first 7 days), last 3 months of history with full metrics.
- **Zeta Plus:** unlimited PDFs, history beyond 3 months, screenshots, Viajes, Nítido, later extra-payment suggestions.
- **Price to test:** $12.900/mes · $99.900/año · 14-day store trial. **RevenueCat** (user id = Supabase id; webhook → `entitlements`; cached offline; server enforces paid server work). **Founders:** Plus free for 12 months. Paywall only when tapping a Plus feature; data kept if Plus ends.

## 9. Existing users and the web app
- **Until v2 ships:** the web app unchanged and in use; one small web change (`NOTIFICATION` in `CAPTURE_TIER`); email pipeline refactor must reproduce the saved corpus exactly. Known difference: shared purchases (web: amount − repaid; v2: own share).
- **First launch of v2:** drain the old outbox, create the SQLCipher database and re-sync, run a short onboarding (payday, income, balance) for users without cycle settings, show the 25-category card, convert subscriptions to bills, grant founders' Plus when v1.1 lands.
- **Rollback:** everything is additive; re-release the last v1 build with a higher version code if needed; keep `release/v1` for two weeks after v2 GA.

## 10. Milestones

| | Weeks | Scope | Owner accepts when… |
|---|---|---|---|
| **M0 Foundations** | 3 | Dev project + seed; engine skeleton (commands, port, both adapters, contract suite; `commands`, `field_versions`); UI shell behind a flag (4 token sets, primitives, `(v2)` routes, widget gallery with screenshot tests); SQLCipher; Shortcuts spike; start Google verification; send the Claude Design prompt | Engine tests pass on both adapters; the v2 shell and gallery open on a device |
| **M1 The number** | 3 | `computeDisponible` + verdict with all session-3 rules; `user_cycle_settings`, `account_settings`, `bill_reservations`; Inicio block + first 6 widgets + alerts; Tu flujo; Movimientos + Detalle; cycle summaries + past cycles | Offline manual expenses move Disponible, verdict, Tu flujo and past cycles correctly |
| **M2 Server engine + capture core** | 3 | Command runner route; outbox drain; narrowed sync; conflict rules; email pipeline → template engine (corpus replay); PDF import as commands; accounts from PDF; unknown last-4 card; `NOTIFICATION` tier | Forwarded emails and PDFs flow through the engine; offline edits survive replay |
| **M3 Revisar + categories** | 2.5 | Merchant policy; 25 categories + opt-in migration; `category_rules` merged; suggestions (rules → dictionary → Haiku); Lo que Zeta sabe | Revisar and "¿Siempre para X?" behave on real data |
| **M4 Pagos, debts, people** | 3 | Pagos 60 days + Prepárate/apartar; variable bills; partial payments; loans; pay-off; card minimum; Deudas; Te deben + Tú debes; Límites; remaining widgets | Bills, debts and people match reality for a full cycle |
| **M5 Android capture** | 4.5 | Listener module; SMS + Wallet; signed pack; training; heartbeats + OEM guidance; Play disclosure + internal-track review | Card purchases appear on their own on the owner's Android device, offline too |
| **M6 iPhone capture + voice** | 2.5 | Forwarding setup; Gmail for testers; Shortcuts + App Intent; voice + Haiku; balance notices | Apple Pay / bank SMS / email purchases arrive on iPhone |
| **M7 Migration + launch** | 3 | First-launch migration; onboarding; push (local + digest); privacy screen; store assets and reviews; flag flipped; old screens deleted; web reduced | The owner's real account runs on v2; store builds approved |

**~25 calendar weeks to v1** (early April 2027). **v1.1** (~6 weeks later): Zeta Plus + paywall + PDF limit + history beyond 3 months, screenshots, Viajes, Nítido gating, Historia, "Ordenar en 1 minuto", Jev gatekeeper after its eval, home-screen widget. **Later:** "Mi historia" recap, extra-payment suggestions, savings goals, tags, biller emails, shared template shapes.

## 11. Quality gates and agents
- **Engine contract tests** (both adapters) and **pure-function tests** (`computeDisponible`, `verdict`, templates, suggestions) run on every PR.
- **Widget gallery**: every allowed size × 360/390/430 × Oliva/Nítido × light/dark × text 100/130% × data cases; screenshot diffs for touched widgets.
- **Agents:** `supabase-migrator` (every migration), `mobile-sync-doctor` (outbox, replay, sync set), `mobile-perf-doctor` (lists, Tu flujo, grid), `import-flow-doctor` (capture, templates, PDF), `recurring-doctor` (Pagos, occurrences), `server-action-reviewer` (command runner and API routes), `zetas-front-guy` retargeted to v2 tokens and widget rules. `mobile-webapp-parity` is retired for v2 (the contract tests replace it).
- **Security review** before M7: SQLCipher key handling, command payload encryption, Gmail tokens server-only, RevenueCat webhook auth.

## 12. The first PR (S7-1)
**Branch** `feat/v2-engine-skeleton`. **Contents:** `packages/shared/src/engine/` (command model, `StoragePort`, `captureManualTransaction`: validation, idempotency key, counted-account balance delta); SQLite and Postgres adapters; one contract suite run against both, including a replayed command (applied once) and an out-of-order field edit (latest wins); migrations for `commands` and `field_versions` applied to the dev project only. **Proves** S1-1/S1-2 before anything depends on them; invisible to the web app and today's mobile app. **Check:** `pnpm --filter @zeta/shared test` green (both adapters), the integration run green against the dev project, `pnpm build` clean. The detailed implementation plan for this PR is written next (writing-plans).

## 13. Risks and external dependencies
| Risk | Mitigation |
|---|---|
| The two adapters drift | Contract suite is a build gate; every command lands with its contract tests |
| Google verification / CASA slow or refused | Forwarding address works without it; Gmail for ≤ 100 testers meanwhile |
| Play policy on notification access | Prominent disclosure; internal track submitted early in M5 |
| iOS Shortcuts "Mensaje" needs a prompt each run | M0 spike; if it fails, iPhone keeps Apple Pay (Transacción) + email + PDF |
| Bank wording changes | Signed pack updated without releases; drift detection; training cards |
| OEMs killing the listener | Heartbeat, per-brand fixes, "~" on the number |
| Scope (~25 weeks) | Milestones are shippable slices; v1.1 items never block v1 |

## 14. To refine later
Widget rules (owner wants them tightened with use) · Plus price (test) · "Mi historia" design · extra-payment suggestion copy · Claude Design screens may change details of section 7.

# Zeta v2 — build plan (2026-09-28)

Status: **plan, no feature code yet.** Inputs: `01`, `03`, `04`, `06`–`08`, `05`/`05b`, and the Claude Design export imported to `design/zeta-v2/` (project `7b1c7914-…`, 4 files). Every claim about current code below was checked against the repo on `main` @ `cf443aca`.

> **Naming:** the product is **Zeta**. The design file uses the designer's working name "Alcanza" (one string, in `Alcanza.dc.html`'s history note). Treat it as Zeta everywhere; no UI copy says "Alcanza".

---

## 0. What the design export actually is

| File | Content | Role for v2 |
|---|---|---|
| `design/zeta-v2/Tema Oliva.dc.html` | Full screen set (onboarding 2a–2h, Inicio 2i/2j/2k, ¿Cómo se calcula? 3o, ¿En qué se me fue? 3p, voz 3l–3n, Te deben 3r/2p, Ajustes 2r, Categorías 3h–3k, nuevo ciclo 2q, Revisar 3a–3g/2l, Dividir 2o, Pago de tarjeta 2m, Cuotas 2n, picker 3q, mini sistema 3s) + artboard **00 "Jerarquía"** | **Proposed visual source of truth** (§10 Q1) |
| `design/zeta-v2/Alcanza Oliva.dc.html` | 7 artboards (4s, 4a–4f) introducing the hierarchy rule | Rationale for Tema Oliva |
| `design/zeta-v2/Alcanza.dc.html` | Same screens in the earlier "Clara" direction + the two initial directions (1a Sereno, 1b Clara) | History only |
| `design/zeta-v2/support.js` | Claude Design canvas runtime (loads React/Babel from unpkg) | Needed to view files locally (`python3 -m http.server` in that folder) |

Facts that shape §3:
- **Light only.** No dark artboards exist. The brand flips from today's dark "Obsidian & Brass" to a warm paper/olive light theme.
- **No CSS variables** — every color is a literal hex. Tokens must be authored by hand from the role map below (extracted by counting where each hex is used).
- **Type:** Geist (UI) + Geist Mono (raw bank text, section eyebrows). Scale labels in 00: Héroe 60 · Clave 16–19 · Fila 15 · Apoyo 13.
- **The hierarchy rule (00/4s):** *"Negro se toca. Color dice cómo vas. Gris es dato."* Buttons are black rectangles (radius 10–12); verdicts are round pills with a dot; row tags are small grey-bordered rectangles; olive appears **only** for Vas bien.

---

## 1. Build approach — **recommend (a): new route tree inside `mobile/`**

| Criterion | (a) new shell in `mobile/` | (b) new app `apps/zeta/` |
|---|---|---|
| Reuse of `lib/sync/`, `lib/db/`, `lib/supabase.ts`, `lib/auth.tsx`, auth-social, notifications | Direct imports, zero moves | Copy or extract to a package first (≈1 week of plumbing before any screen) |
| Risk of dragging old UI | Real: 36.4k LOC in `mobile/app` + `mobile/components`. Mitigated by a hard boundary (below) | None |
| Store continuity (`com.venti5.zeta`, EAS project, `appVersionSource: remote`, signing, fastlane) | Unchanged | Must re-point EAS project, credentials, fastlane, `app.json` — easy to break signing |
| Local SQLite migration | `PRAGMA user_version` migrations in `lib/db/database.ts` continue; v2 adds versions | New DB file; users re-pull everything; outbox rows from v1 could be lost at switch |
| CI | 5 workflows hardcode `mobile/` (`mobile-pr-verify`, `mobile-playstore`, `mobile-ios`, `mobile-apk`, `pr-build-images`) — untouched | All 5 rewritten + path filters |
| Native module (notification listener) | `android/`/`ios/` are gitignored (CNG) → local Expo module in `mobile/modules/` + config plugin | Same, in the new app |

**How (a) avoids the drag:**
1. New code lives only in `mobile/app/(v2)/` (routes), `mobile/v2/` (UI: `tokens.js`, `ui/`, `screens/`) and `@zeta/shared` (engine). **`mobile/v2/**` may not import from `mobile/components/**` or `mobile/lib/dashboard|domain|services/purchase-decision|wishlist-*`** — enforced by `scripts/check-v2-boundary.sh` (a `grep` that fails on those imports and on hex literals outside `tokens.js`), run in `mobile-pr-verify.yml`. Mobile has no ESLint today; not adding it for one rule.
2. Allowed imports from old code: `lib/sync/*`, `lib/db/*`, `lib/supabase.ts`, `lib/auth.tsx`, `lib/auth-social.ts`, `lib/biometrics.ts`, `lib/services/notifications/*`, `lib/repositories/*` (read paths only, until each is replaced).
3. `app/_layout.tsx` redirects to `(v2)` when `EXPO_PUBLIC_ZETA_V2=1` (EAS profile env). Internal builds get v2, production keeps v1 until M6.
4. Each milestone ends with a **deletion list** (§8). At M6 the flag and `(tabs)` group are removed; the old screens are deleted in one PR, not left reachable.

---

## 2. Data layer — **recommend: keep SQLite + sync engine, narrow it, and move captures to a server ingest endpoint with a local outbox**

What `mobile/lib/sync/` really does today:
- `pull.ts`: 21 `SYNC_TABLES`; cursor on `updated_at`; `FULL_REPLACE_TABLES` for 5 tables without it; `WINDOWED_TABLES` limits `transactions`, `transaction_locations`, `recurring_occurrences` to **current + previous month**; 6 concurrent fetches, 1000-row pages, boolean/JSON/rename mapping.
- `push.ts` + `queue.ts`: `sync_queue` outbox of raw INSERT/UPDATE/DELETE row payloads sent straight to PostgREST views (batched consecutive inserts, `23505` skipped, stale UPDATEs dropped).
- `engine.ts`: single-flight `syncAll` with one coalesced rerun, reset lock, foreground-driven retry back-off (15 s → 5 min, 8 tries), 3 s debounced push-only after local writes.

The known weakness (2026-06-25 parity audit): raw row pushes **bypass server side effects**, so `lib/repositories/transactions.ts` (1,117 LOC) and `recurring.ts` (1,297 LOC) re-implement balance deltas, occurrence linking, etc. on-device.

| | Keep offline-first SQLite + sync (narrowed) | Online-first + local cache + capture queue |
|---|---|---|
| New code | ~300 LOC: narrow `SYNC_TABLES`, widen occurrence window, add `capture_outbox` + drainer | Query layer + cache (React Query or hand-rolled) + persistence + queue ≈ 1.5–2 k LOC, plus rewriting every read |
| Inicio load | Local SQLite → `computeDisponible` in <50 ms, offline | Cache hit fast; cold start or stale cache = spinner or stale number |
| Offline notification capture | Outbox row + optimistic local row | Same queue needed anyway |
| Engine location | `computeDisponible` runs on-device from local rows (pure fn) | Needs a server RPC or all rows fetched anyway |
| Parity tax | Only for the few edits that stay raw (note, date, category) | Lower |
| Risk | Known engine, already hardened (single-flight, reset lock, two-phase pull, round-trip budget) | New failure modes at the worst time |

**Decision details:**
1. **`SYNC_TABLES` for v2:** `profiles`, `accounts`, `categories`, `destinatarios`, `destinatario_rules`, `category_rules` (until merged, §5), `budgets`, `personal_debts`, `personal_debt_allocations` (**new to sync**), `recurring_transaction_templates`, `recurring_occurrences`, `transactions`, `modos` (**new to sync**), plus new tables from §5. **Dropped from pull:** `tag_groups`, `tags`, `transaction_tags`, `transaction_locations`, `wishlist_items`, `statement_snapshots`, `planning_periods`, `planning_entries`, `planning_assignments`, `subscriptions`. (Local tables stay until M6 cleanup; they just stop refreshing.)
2. **Windows:** `recurring_occurrences` → previous month through **next** month (Pagos del ciclo shows "Próximo ciclo"). `transactions` → **last 3 cycles** (≈ 90 days): limit suggestions use median per cycle of ≥14 days of data; recurring detection and Movimientos search beyond that go to the server.
3. **Captures don't go through `push.ts`.** The full ingest pipeline already exists server-side, inline in `webapp/src/app/api/webhooks/email-ingest/route.ts` (idempotency, `resolveSuggestedEmailAccountId`, `applyAccountBalanceDelta`, `autoCategorize`, `matchTransactionToDestinatario`, `linkTransactionToOccurrenceWith`, `scheduleSubscriptionDetection`). Extract it to `webapp/src/lib/ingest/ingest-bank-event.ts` and expose **`POST /api/ingest`** (bearer auth via `api/_shared/auth.ts` `getRequestUser`, batch of events, returns per-event `{status: created|duplicate|review, transaction_id}`). Notification capture, Gmail pull (server-side) and manual/voice quick-add all call it. **Client:** `getRequestUser` (`api/_shared/auth.ts`) returns only a `User`, so the route builds a user-scoped Supabase client from the bearer JWT (publishable key + `Authorization` header) and passes it into `ingest-bank-event.ts`; writes to `transactions`/`destinatarios` views then run the `_enc` INSTEAD OF triggers as the user. The email webhook and the Gmail cron keep their existing admin-client path (`zeta_decrypt_as()` for reads), so the extracted function takes the client as a parameter instead of creating one.
4. **`capture_outbox`** (new local SQLite table): `id`, `kind` (`notification|manual|voice`), `payload` JSON, `dedupe_key` (package + notification key + text hash, per 03 §6), `created_at`, `sent_at`, `result`. Written in the same SQLite transaction as an optimistic `transactions` row (`status = 'pending_ingest'`); drained by the existing `requestSync` back-off; on response the optimistic row is replaced by the pulled one. The Kotlin listener writes to its own on-device store when JS isn't running (§6.1) and JS moves those into `capture_outbox` on next start.
5. Simple field edits in the Detalle sheet (note, date, amount on manual rows) stay on `sync_queue`. **Category change with "Siempre", share/split, cuotas, merge, "Cuadrar con mi saldo"** call API routes (same pattern as `/api/ingest`) because they fan out to other rows.

Cost vs scope: 8 screens, ~13 synced tables (from 21), and the two biggest repositories shrink to read paths. Online-first would spend M0–M1 rebuilding plumbing that already works.

---

## 3. Design system → code

**Decision: NativeWind 4.2.2 (Tailwind 3.3.5 syntax, both already installed) for layout + one `mobile/v2/tokens.js` (plain JS + `tokens.d.ts`) as the single source.** `tailwind.config.js` `require`s it (no build step); Reanimated/Skia/gesture code imports the same object. No hex anywhere else (boundary script, §1).

### Tokens (hand-extracted from Tema Oliva; names are semantic)

| Token | Light (from design) | Used for |
|---|---|---|
| `ink` | `#161812` | Primary text, black buttons, selected chip, accepted drop zone |
| `button` | `#141414` | Primary button fill (verify vs `ink` with designer; may collapse) |
| `muted` | `#655F52` | Secondary text ("gris es dato") |
| `faint` | `#857D6D` | Tertiary text, disabled borders |
| `paper` | `#FAF6EC` | Cards / sheet background |
| `canvas` | `#EFE8D9` | Screen background |
| `sunk` | `#E5DDCB` | Inset panels (raw bank text, segmented track) |
| `line` | `#C9BEA6` | Borders (chips, tags, inputs), dashed drop zones |
| `onInk` | `#F6F0E3` | Text on black |
| `ok.bg / ok.fg / ok.solid` | `#DCE0BE` / `#46512A` / `#6C7A3C` | **Vas bien only** |
| `warn.bg / warn.fg / warn.solid` | `#EFDDAE` / `#6E500E` / `#B88A22` | Cuidado, alert blocks |
| `bad.bg / bad.fg / bad.solid` | `#EDCBBB` / `#86361F` / `#B9553A` | Te pasaste, badge dot |
| `radius` | `sm 4 · md 8 · btn 10 · chip 12 · card 20 · pill 999` | |
| `space` | 4-pt scale: 4, 6, 8, 12, 14, 20, 36 (dominant values in file) | |
| `type` | `hero 60/700 tabular` · `title 26–30/700 −0.6` · `key 16–19/600` · `row 15/600` · `support 13/400–500` · `eyebrow 11/500 mono +.08em` · `raw 12 mono` | Geist + Geist Mono via `expo-font` (replace Inter/Kalam) |
| `elevation` | `card: 0 1px 2px .08` · `lifted (dragging): 0 12px 30px .08 + rotate −6°` · `sheet: 0 30px 60px .22` | RN `shadow*` iOS / `elevation` Android |

**Dark mode:** not designed. Plan: ship light-only through M2 (`userInterfaceStyle: "light"` for v2 builds), derive a dark palette in M6 from the same roles (§10 Q2). The token file is keyed `tokens.light` from day one so dark is additive.

### Primitives (`mobile/v2/ui/`)

| Primitive | Design ref | RN implementation | States |
|---|---|---|---|
| `Row` | 03 §10, 2i/2l | `Pressable` + memo; icon · title · amount (`tabular-nums`) · subtitle · ≤1 `Tag`; `onPress` always opens `DetailSheet` | default, pressed, "Por revisar" dot |
| `Tag` | 00 "Etiquetas" | 11 px grey-bordered rectangle | — |
| `Chip` | 3s | `Pressable`, radius 12, 44 px min height | `suggested` (paper + line) · `preselected` (ink border + dot) · `selected` (ink fill, ✓, siblings dim) · `other` (dashed) |
| `VerdictPill` | 00 "Estados" | round pill + dot; only 3 variants from `verdict()` | `ok` · `warn` · `bad` |
| `Button` | 00 "Acciones" | `primary` (ink fill) · `secondary` (ink outline) · `inline` · `link` · `icon` | pressed, disabled, loading |
| `Segmented` | 3s "¿Siempre es así?" | 3 options on `sunk` track, selected = paper | compact (sheet) / explained (3b) |
| `Sheet` | Detalle, 3o, 3j | `@gorhom/bottom-sheet` is **not** installed → use RN `Modal` + Reanimated + Gesture Handler (both installed); one `DetailSheet` instance hoisted in `(v2)/_layout.tsx` | snap: content height / 90% |
| `MerchantCard` + `DropZone` | 3s, 3d–3f | `GestureDetector` pan + Reanimated shared values; drop zones min 120 px, bottom half; `expo-haptics` (**add dep**) on accept | card: rest / lifted; zone: rest / list / over / accepted |
| `AlertBlock` | 00 "Alertas" | tinted block + icon + link | warn / info |
| `EmptyState` | 03 §9 | text + optional button | — |
| `Money` | 00 "Datos" | thin wrapper over `formatCurrency` (`packages/shared/src/utils/currency.ts`): `$1.250.000`, no decimals, `≈` prefix, `+`/`−`/`↔` | out / in / neutral / approx |

**Icons:** keep `lucide-react-native` (installed); the design uses letter avatars for merchants ("R", "A") — `Avatar` primitive, no logo fetching in v1.

**Preview strategy:** no Storybook (not installed on mobile; 41 web stories are the old system). A dev-only route `app/(v2)/dev/preview.tsx` renders every primitive in every state, plus fixture screens (`Inicio` ok/warn/bad) fed by the Laura dataset from `05` as a JSON fixture in `mobile/v2/fixtures/laura.ts`. Verification = simulator screenshot side-by-side with the artboard (00, 3s, 2i). `zetas-front-guy` reviews against `tokens.js` instead of `TOKENS.md` for `mobile/v2/**`.

---

## 4. Engine work in `@zeta/shared` (pure, Vitest-tested)

All new files under `packages/shared/src/utils/`, exported from `index.ts`, tests in `__tests__/` (25 test files exist today).

### 4.1 `disponible.ts` → `computeDisponible(input): DisponibleResult`

Reuse, don't re-derive: movement semantics come from `flow-class.ts` (`effectiveFlowClass`, `SPEND_CLASSES`, `NEUTRAL_CLASSES` — `DEBT_PAYMENT`/`SELF_TRANSFER` are neutral), never from raw `direction`.

```ts
type PaySchedule =
  | { kind: "days"; days: number[] }            // [15, 30] or [30]
  | { kind: "every_n_days"; n: 14; anchor: string }
  | { kind: "irregular" };                      // cycle = calendar month

interface DisponibleInput {
  today: string;                                // YYYY-MM-DD, Colombia (toColombiaDateString)
  schedule: PaySchedule;
  expectedIncomePerCycle: number;               // 0 for irregular
  holidays: string[];                           // CO holidays for "prior business day"
  anchor?: { balance: number; at: string };     // first cycle / "Cuadrar con mi saldo"
  savingsPerCycle: number;
  transactions: Array<{ id; date; amount; flowClass; accountType; ownShare?: number;
                        modoId?: string; installment?: { current; total; perCycleAmount } }>;
  occurrences: Array<{ id; dueDate; amount; status: "pending"|"paid"|"skipped"; kind: "bill"|"card"|"cuota";
                       cardAccountId?: string }>;
  cardPurchasesAlreadyCounted: Record<string /*cardAccountId*/, number>; // for card-bill neutralization
  trips: Array<{ id; from; to; pot; fundedFromCycle: number }>;
  previousCycle?: { closing: number; carryChoice?: "savings"|"keep" };
}

interface DisponibleResult {
  cycle: { start; end; daysLeft; totalDays; source: "anchor"|"income" };
  lines: { llega: number; teLlegoReal: number; porPagar: number; ahorro: number; yaSalio: number;
           ajustes: Array<{ kind: "carry_negative"|"carry_positive"|"trip_overflow"|"balance_adjust"; amount }> };
  disponible: number; perDay: number;
  approx: boolean; approxReasons: Array<"source_silent"|"salary_not_confirmed"|"no_capture"|"fx_pending">;
  teDeben: number;                               // shown, never added
  breakdownByCategory: Array<{ categoryId; amount }>;   // "¿En qué se me fue?"
}
```

**Test cases** (one `it` each, from 03 §6–§7 and 04 §3):

| # | Case | Expect |
|---|---|---|
| 1 | Laura fixture (15/30, $2.1M, bills, spent $520k) on 18 Sep | $412.000, $27.400/day (15 days incl. today) |
| 2 | First cycle, anchor $1.180.000, bills $768.000 | $412.000, `source: "anchor"` |
| 3 | Payday on Sunday 30 → expected Fri 28; salary arrives Fri | cycle starts 28 |
| 4 | Payday passed, no salary inflow | uses expected, `approx`, reason `salary_not_confirmed` |
| 5 | 1-cuota card purchase $100k, then card payment $100k | yaSalio −100k once; payment neutral; card bill porPagar reduced by already-counted |
| 6 | Card bill $640k of which $410k previous-cycle purchases | porPagar counts only $230k |
| 7 | Cuota purchase 12× on $1.2M | only this cycle's cuota (incl. estimated interest via `estimateInstallmentPlan`) |
| 8 | Split dinner $240k, own share $60k | yaSalio −240k; teDeben 180k; category spend 60k |
| 9 | Friend repays $80k | "Te pagaron" +80k in llega; disponible up |
| 10 | Trip pot, spending inside trip | not in yaSalio; overflow line when pot exceeded |
| 11 | Trip funded "de este ciclo" $500k | enters porPagar as a bill |
| 12 | Irregular income, received $1.4M + anchor | only received counts; expected shown separately |
| 13 | Previous cycle −$85k | carry_negative line |
| 14 | Previous cycle +$85k, no choice yet | carry_positive "Te sobró" (default keep) |
| 15 | Refund linked to purchase | nets against yaSalio, never income |
| 16 | Own transfer / `SELF_TRANSFER` | neutral |
| 17 | Two cycles per month + card cut on 22 spanning both | card bill due 5th lands in cycle 1 of next month; purchases after cut counted when made (04 §3 worked example — write it in the test file header) |
| 18 | Foreign-currency row without reconciliation | `approx`, reason `fx_pending` |
| 19 | No transactions at all | anchor-based number, `no_capture` |

### 4.2 `verdict.ts` → `verdict(input, prev?): VerdictResult`

Today there are **three** verdict vocabularies: `ritmo.ts` `VerdictState` (4 states: `vas-bien|cerca|te-pasaste|atencion`, 0.75 threshold, "overspent today" rule), `weekly-digest.ts` `WeeklyDigestVerdict` (`on_track|watch|over`), and the web Plan page's raw number. v2 has one:

```ts
type Verdict = "ok" | "warn" | "bad";   // Vas bien / Cuidado / Te pasaste
verdict({ available, perDayNow, perDayAtStart, billAtRiskWithin3Days, now },
        prev?: { state: Verdict; since: string }): { state; since; copy }
```
Rules: `bad` if available < 0; `warn` if `perDayNow < 0.85 × perDayAtStart` or bill at risk; else `ok`. **Hysteresis:** worsening applies immediately; improving only if the better state has held ≥24 h (`prev.since`). Same function for limits (`spent vs limit × elapsed/total`) and trips (pot). `weekly-digest.ts` and `ritmo.ts` are rewired to call it; `ritmo.ts` (`deriveRitmoStatus`, still read by the web) is deleted only when the web dashboard is retired at M6. Tests: each boundary (0.85 exact, 0, −1), flicker on refund within 24 h, bill-at-risk override, limit and trip adapters.

### 4.3 `merchant-policy.ts` → `resolveCategory(tx, merchant, policy)`

```ts
type CategoryPolicy = { mode: "always" | "usually" | "ask"; defaultCategoryId: string;
                        usualCategoryIds: string[]; askAboveAmount?: number };
resolveCategory({ amount, destinatarioId }, policy):
  { action: "apply"; categoryId } | { action: "ask"; chips: string[]; preselect?: string }
```
`always` → apply. `usually` → apply unless `amount > askAboveAmount` or outside the merchant's usual range (p10–p90 of its history, passed in) → ask with `usualCategoryIds`. `ask` → ask. Plus `onCorrection(policy, newCategoryId)`: adds to `usualCategoryIds`; 2 corrections in 30 days downgrade `always → usually` (08 metrics). Tests: all three modes, threshold edge, downgrade rule.

### 4.4 `category-suggestion.ts` → `suggestCategories(tx, ctx): Suggestion`

Pipeline, first hit wins, **3 chips always**:
1. Merchant resolved (`matchDestinatario` on `cleanDescription`) with a policy → `resolveCategory`.
2. Legacy `category_rules` via `autoCategorize` (until merged).
3. Shipped merchant dictionary (`packages/shared/src/constants/merchant-dictionary.ts`, new, e.g. RAPPI→Domicilios).
4. Cached LLM answer for this merchant (`merchant_suggestions` table, §5), `confidence ≥ 0.8` → `preselect` (eval: 24% of rows at 95% precision).
5. Fill remaining chips with the user's top-3 categories.
Output: `{ chips: [id,id,id], preselect?: id, source }`. The LLM call itself is **server-side** (`POST /api/merchant-suggest`, once per new merchant, masked input per `07`, model `claude-haiku-4-5`), never on-device, never blocking a capture. Tests: each stage, dedupe of chips, no preselect below threshold.

### 4.5 Smaller pure pieces
- `notification-template.ts`: `matchTemplate(text, templates) → full|partial|none + slots`; `generalizeTemplate(text, taggedSpans)`; ignore templates (OTP, promo, saldo, rechazada). Kotlin only filters packages; matching runs in JS so templates live in one language (§6.1).
- `cycle-limits.ts`: `suggestLimits(history, cycles)` = median per cycle of top-3 discretionary by variance, −10 %, round to $10.000.
- `te-deben-signal.ts`: >20 % of cycle income, item >45 days, or ≥3 open items per person.
- `quick-capture.ts` (exists, `parseQuickCaptureText`): extend with slang ("45 lucas", "2 palos") and "me debe la mitad" → split.

---

## 5. Schema changes (Supabase)

Rule of thumb for v2: **non-PII settings go in new side tables keyed by FK** so we avoid the 6-step `_enc` column process; only columns that must live on an encrypted row go through `supabase-migrator`. Encrypted today: `profiles_enc`, `accounts_enc`, `transactions_enc`, `destinatarios_enc`, `recurring_transaction_templates_enc`, `statement_snapshots_enc`, `pdf_passwords_enc`, `email_ingest_addresses_enc`, `capture_tokens_enc`, `transaction_locations_enc`, `wishlist_items_enc`.

| # | Change | Table(s) | Kind | Notes |
|---|---|---|---|---|
| S1 | Pay cycle settings: `schedule_kind` (`days`/`every_n_days`/`irregular`), `pay_days smallint[]`, `pay_anchor date`, `income_per_cycle numeric`, `savings_per_cycle numeric`, `anchor_balance numeric`, `anchor_at timestamptz` | **new** `user_cycle_settings` (PK `user_id`) | Additive | `profiles.monthly_salary` exists but has no schedule. Salary is sensitive: `supabase-migrator` decides if `income_per_cycle`/`anchor_balance` use the envelope helper. Synced. |
| S2 | Merchant policy: `mode`, `usual_category_ids uuid[]`, `ask_above_amount`, `corrections_30d` | **new** `destinatario_category_policy` (PK `destinatario_id`) | Additive | Default category stays on `destinatarios.default_category_id` (exists). `destinatario_kind` enum is **`merchant \| person`** — use `merchant`, no new value. |
| S3 | 25 default categories: system rows with stable slugs, `categories.parent_id` groups | `categories` (seed) | Additive | New users get the 25; existing users keep theirs until migration (§7). |
| S4 | Category mapping for existing users | **new** `category_migration_map` (`user_id`, `from_category_id`, `to_category_id`, `applied_at`) | Additive | Proposed map derived from the 98→25 remap in `scripts/jev-eval/` (07 round 2); applied per user on opt-in. |
| S5 | Te deben semantics | none required — `personal_debts` already has `origin_transaction_id`, `split_group_id`, `group_total_amount`, `direction = 'lent'`; own share = `amount − Σ principal_amount` of `lent` origin debts | **Semantic, breaking for aggregates** | Today 10 files read `split_repaid_amount` for spending (`monthly-aggregates.ts`, `actions/charts.ts`, `budgets.ts`, …). v2 engine ignores it for spending. Web aggregates change meaning → acceptable (web frozen) but noted. Optional perf denormalization `transactions.own_share_amount` only if the local join proves slow (then via `supabase-migrator`, `transactions_enc`). |
| S6 | Notification templates | **new** `notification_template_packs` (`version`, `signed_payload jsonb`, `signature`, `published_at`) — public read; **new** `user_notification_templates` (`user_id`, `package_name`, `kind` txn/ignore, `pattern jsonb`, `confirmed_matches int`, `active bool`, `last_matched_at`) | Additive | Pack signed with an Ed25519 key; public key pinned in the app. User templates contain bank text shapes → RLS per user; no amounts stored in patterns. |
| S7 | Capture method | enum `transaction_capture_method` add **`NOTIFICATION`**; `CAPTURE_TIER.NOTIFICATION = 2` in `packages/shared/src/utils/capture-hierarchy.ts` | Additive | `CAPTURE_TIER` is `satisfies Record<TransactionCaptureMethod, …>` so TS fails until both land. **Do not regenerate types** (CLI 2.90 breakage memory) — add the literal by hand to `webapp/src/types/database.ts` and `packages/shared` types. Also add `NOTIFICATION` to `EMAIL_IMPORT`-style provenance in `transactions.capture_input_text` (raw text, encrypted). |
| S8 | Gmail link | **new** `gmail_connections` (`user_id`, `google_sub`, `refresh_token_enc bytea`, `scopes`, `history_id`, `last_sync_at`, `status`) | Additive | Token encrypted with the same envelope key path; server-only (no mobile sync, no client RLS select of the token column — expose status via a view). |
| S9 | Push tokens (for server digest) | **new** `push_tokens` (`user_id`, `expo_token`, `platform`, `updated_at`) | Additive | Doesn't exist today — push is local-only (`mobile/lib/services/notifications/scheduler.ts`). |
| S10 | LLM merchant cache | **new** `merchant_suggestions` (`merchant_key` = normalized name hash, `category_slug`, `confidence`, `model`, `created_at`) | Additive | Global (not per user), keyed by masked name; no PII. |
| S11 | Source health | **new** `capture_heartbeats` (`user_id`, `source`, `package_name`, `last_event_at`, `last_heartbeat_at`) | Additive | Drives "Sin avisos de Nu desde el 18". |
| S12 | Merge `category_rules` → `destinatario_rules` | data migration, later drop of `category_rules` | **Breaking (deferred)** | M2 migrates rules into merchants with `default_category_id`; drop only after web stops reading it. |

Every migration: `supabase-migrator` review; `npx supabase db push` + `migration list` after merge (deploy doesn't apply migrations).

---

## 6. Native capabilities

### 6.1 Android notification capture — **4–5 weeks, highest risk**
- **Module:** `mobile/modules/zeta-notification-listener/` (Expo Modules API, Kotlin) + config plugin adding the `<service android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">` and a `<queries>` block listing known bank packages only (Bancolombia, Nu, Nequi, Davivienda, Bogotá, Falabella, Lulo).
- **In Kotlin:** `onNotificationPosted` → drop if package ∉ allowlist (in memory, never logged) → persist `{package, key, postTime, title, text}` to a small Room/SQLite table (JS may not be running) → emit event if JS alive. `getActiveNotifications()` for the 6A.3 "instant proof". Heartbeat timestamp on every callback + on `onListenerConnected`. `requestRebind` on boot/`onListenerDisconnected`. Discard counter (count only) for the privacy screen.
- **In JS:** drain Kotlin store → `matchTemplate` → full match: optimistic row + `capture_outbox`; partial/none: Revisar card; ignore: Ignorados (30-day local only).
- **OEM guidance:** deep links per manufacturer (Xiaomi autostart, Samsung "never sleeping apps", Huawei, Motorola) behind a "Tu Xiaomi está apagando la lectura de avisos" card when heartbeat gap >24 h with screen-on usage.
- **Play policy:** prominent in-app disclosure before the system screen (6A.2 copy), Data Safety form ("financial info", "not shared", "encrypted in transit"), permissions declaration video. Submit an internal-track build in **M4 week 1**.
- **Risks:** Play rejection (mitigate early submission); OEM kills (7-day soak on 5 models); template brittleness (server pack from day one); iOS has no equivalent (by design).

### 6.2 Gmail read-only (iPhone path) — **2–3 weeks build, verification is the long pole**
- OAuth via `expo-auth-session`/Google Sign-In (`@react-native-google-signin/google-signin` already installed) requesting `gmail.readonly` with **server auth code**; mobile sends the code to `POST /api/gmail/connect`; server exchanges it, stores the refresh token in `gmail_connections` (S8). Tokens never live on-device.
- Server job (`/api/webhooks/gmail-sync`, cron via GitHub Actions like `fx-rates-cron.yml`, every 15 min + push via Gmail `watch`/Pub/Sub later): query `from:(<bank sender list>) newer_than:60d`, reuse `parseBancolombiaEmail` and the extracted `ingest-bank-event.ts`.
- **Verification:** `gmail.readonly` is a **restricted scope** → OAuth verification + annual CASA security assessment. Start the application **in M0**; beta runs unverified (≤100 test users, "unverified app" warning) per 04 §2 #5. This conflicts with 01's locked "No Gmail OAuth (avoids CASA)" — the kickoff overrides it; flagged in §10 Q3.
- **Risks:** CASA cost/timeline (weeks–months); Google rejecting a finance app's justification; users on Outlook (PDF fallback).

### 6.3 Speech-to-text — **0.5 week**
`expo-speech-recognition` already used by `app/capture-voice.tsx`. Reuse the hook, new UI (3l–3n), `parseQuickCaptureText` extended (§4.5), LLM fallback server-side only when parse fails.

### 6.4 Push — **1.5 weeks**
Local: keep `lib/services/notifications/scheduler.ts` (bill day-before, quiet hours 21:30–7:30, caps). Server: `push_tokens` (S9) + Sunday 19:00 digest via Expo Push API from a cron route using `buildWeeklyDigest` (rewired to `verdict()`); payday/verdict-change pushes computed server-side from the same engine. Global cap 2/day enforced server-side.

---

## 7. Migration of existing users (~45 accounts, ~12 active)

| Data | Mapping | When |
|---|---|---|
| Categories (~100 per user) → 25 | `category_migration_map` proposed from the 07 remap; user-created categories stay as extra categories. Transactions are **not rewritten** until the user accepts a one-card "Simplificamos tus categorías" in Revisar (shows the map; [Usar las 25] [Mantener las mías]) | First v2 launch |
| `category_rules` (266) | Converted to merchant defaults: pattern → matched destinatario (or new `merchant`) + `default_category_id`, policy `always` | M2 migration script, idempotent |
| Recurring templates/occurrences | Unchanged; surfaced as Pagos del ciclo. Subscriptions (`subscriptions` table, 5 rows) shown as bills via their templates | Nothing to migrate |
| Personal debts / splits | Semantics change only (S5). Existing `lent` debts appear in Te deben as-is; historical spending recomputed by the engine (own share instead of `amount − split_repaid_amount`) | Nothing to migrate |
| Trips (`modos`, 3 rows) | Read-only history in v1; trip creation v1.1 (§10 Q4) | — |
| Budgets | Existing rows become limits only for categories that survive the map; if >3, keep the 3 highest-spend and hide the rest (kept in DB) | First launch |
| Pay cycle | `user_cycle_settings` empty → first v2 launch runs a **short onboarding** (payday, amount, balance today) for existing users, skipping sign-in | First launch |
| Local SQLite | `user_version` bump adds `capture_outbox` + v2 tables; `sync_queue` rows from v1 are pushed before the migration runs (drain first, then migrate) | First launch |

**Rollback:** v2 is additive in the database (only S12 is destructive, and it's deferred until after release). If v2 misbehaves in production: re-release the last v1 build as a higher version code (v1 still reads all its tables, since nothing v1 needs is dropped). Keep the v1 `(tabs)` code on a `release/v1` branch until two weeks after v2 GA.

---

## 8. Milestones (vertical slices, each to internal testing)

Sizes assume one developer with Claude; "w" = working weeks.

| | Screens | Engine | Schema | Done when | Deletes | Size |
|---|---|---|---|---|---|---|
| **M0 Foundations** | `(v2)` shell, 3 tabs, avatar → Ajustes stub, `dev/preview` | — | none | Primitives match 00/3s screenshots; flag switches shells; lint boundary enforced; CASA/OAuth application submitted | — | 1.5 w |
| **M1 Inicio + Movimientos + Detalle** | Inicio (ok/warn/bad), ¿Cómo se calcula? + Mis cuentas, ¿En qué se me fue?, Movimientos list/search/filters, DetailSheet, + gasto manual | `computeDisponible`, `verdict` | S1, narrowed `SYNC_TABLES` + windows | Laura fixture renders pixel-close to 2i/2j/2k; real account shows a number that matches a hand calc; offline cold start <1 s to number | old `(tabs)/index`, `plan`, `budgets` hidden behind flag | 3 w |
| **M2 Revisar + categories** | Revisar queue (categorize, ¿siempre es así?, casi siempre inusual), picker 3q, Ajustes › Categorías list, merchant sheet, merge | `merchant-policy`, `category-suggestion` (stages 1–3, 5) | S2, S3, S4, S12 data-migration part | Category change on a merchant re-categorizes past rows server-side; automation rate measurable | `categorizar.tsx`, `categories.tsx`, `destinatarios*` | 2.5 w |
| **M3 Pagos + Te deben + Límites** | Pagos del ciclo (card + cuotas), Pago de tarjeta explainer 2m, cuotas 2n, Te deben + person detail + WhatsApp text, Dividir 2o, Límites + suggestion card, nuevo ciclo 2q | `cycle-limits`, `te-deben-signal`, S5 semantics in engine | S5 (none/optional) | Card payment never moves Disponible; split dinner case #8 correct on device; recurring-doctor pass | `periodo`, `subscriptions`, `personas`, `presupuesto*`, `deudas` | 3 w |
| **M4 Android notifications** | 6A.1–6A.3 onboarding, training card, partial-match card, Fuentes + health, Plantillas aprendidas, Ignorados, OEM fix cards | `notification-template` | S6, S7, S11; `/api/ingest` extraction | Full-match auto-capture on 3 real banks; 7-day soak on 5 OEM devices with <5 % heartbeat gaps; internal Play track accepted | `capture.tsx`, `capture-screenshot`, `annotate-screenshot` | 4.5 w |
| **M5 Gmail + PDF + voz** | 6B Gmail connect + backfill result, PDF upload + "Cuadrado ✓" summary, voz 3l–3n | LLM stage 4 (`/api/merchant-suggest`), quick-capture slang | S8, S10 | iPhone test user gets 60-day backfill; PDF re-import produces 0 duplicates (import-flow-doctor); voice case "almuerzo con Juan…" produces the split | `(tabs)/import` | 3 w |
| **M6 Polish + release** | Onboarding 2a–2h polish, Ajustes/Privacidad with discard counter, push opt-in, digest card, dark palette | digest rewired to `verdict` | S9 | Store screenshots per 03 §3; Play + App Store review passed; flag removed; old `(tabs)` + `components/` deleted | everything left in `app/` outside `(v2)`, `(auth)` | 2.5 w |

Total ≈ **20 weeks**. M4 and M5 are independent and can overlap if a second person joins.

---

## 9. Quality gates for v2

| Agent | v2 status |
|---|---|
| `mobile-sync-doctor` | **Applies** — every change to `SYNC_TABLES`, windows, `capture_outbox`, local schema. Update its prompt: v2 table set, outbox, "captures go through `/api/ingest`". |
| `mobile-perf-doctor` | **Applies** — Movimientos list, Revisar card stack, drag-to-zone (Reanimated), sheet. Update NativeWind notes to the v2 token file. |
| `supabase-migrator` | **Applies** — S1–S12, especially anything touching `_enc`. |
| `import-flow-doctor` | **Applies** — `/api/ingest` extraction, NOTIFICATION tier, PDF companion, Gmail path. |
| `recurring-doctor` | **Applies** — Pagos del ciclo, occurrence window, card-bill neutralization. |
| `server-action-reviewer` | **Applies** to new API routes (`/api/ingest`, `/api/gmail/*`, `/api/merchant-suggest`). |
| `zetas-front-guy` | **Retarget** for `mobile/v2/**`: source = `mobile/v2/tokens.js` + `design/zeta-v2/Tema Oliva.dc.html`, rules = hierarchy rule, 3 verdict words, one row grammar. |
| `mobile-webapp-parity` | **Retire for v2** (no parity by decision). Replace with a narrow check inside `mobile-sync-doctor`: "no mobile-only tables; server pipeline is the only writer for captures". |
| `perf-auditor`, `cache-doctor`, `frontend-auditor`, `ux-analyst` | Webapp-only; apply only to the companion/import pages. |

### Proposed `CLAUDE.md` changes
1. **Design Source of Truth:** replace the Wireframes/Flows section with: *"v2 (mobile): `design/zeta-v2/Tema Oliva.dc.html` (view with `python3 -m http.server` in that folder). Tokens in `mobile/v2/tokens.js`. `claude-ai-design/Zeta Wireframes.html` and `docs/design-system/` describe v1 and apply only to the web companion."*
2. **UI Rules:** mark as **webapp-only**: `BRASS_*_BUTTON_CLASS`, `MOBILE_TAB_BAR_CLEARANCE_CLASS`, `MOBILE_SHEET_SAFE_AREA_CLASS`, `--z-layer-*`, focus mode / `FOCUS_MODE_PATHS`, `useHideTabBar`, back-button `router.replace` rule (keep the principle for expo-router), `TOKENS.md`. Add v2 rules: hierarchy rule, 3 verdict words from `verdict()`, one `DetailSheet`, no hex outside `tokens.js`, Geist.
3. **Performance Rules** (`"use cache"`, `cacheLife`, `updateTag`, AppDataProvider): webapp-only; add "mobile reads come from local SQLite; captures go through `/api/ingest`".
4. **Capture Method Hierarchy:** add `NOTIFICATION` (tier 2).
5. **Agents table:** retire `mobile-webapp-parity` for v2; retarget `zetas-front-guy`; move `perf-auditor` from "every feature" to "every webapp feature".
6. **Project section:** replace "Polish & Refinement Milestone" with the v2 north star (Disponible) and link `docs/mlp/`.

---

## 10. Open questions for the owner

| # | Question | Recommendation |
|---|---|---|
| 1 | **Which design file is canonical?** You linked `Alcanza.dc.html` ("Clara"), but `Tema Oliva.dc.html` applies the later hierarchy rule to the full set. | **Tema Oliva.** Clara's colored buttons/pills are exactly what the Oliva note says it fixed. |
| 2 | **Light-first brand flip.** v1 is dark Obsidian & Brass; v2 design is light-only. | Ship v2 light-only through internal testing; ask Claude Design for dark artboards (Inicio ×3, Revisar, sheet) before M6. |
| 3 | **Gmail OAuth vs the 01 lock "no Gmail OAuth (avoids CASA)".** The kickoff says iPhone = Gmail read-only. | Build it, beta unverified (≤100 users), start verification in M0; if CASA isn't through by M6, iPhone launches PDF-first + forwarding address (existing `email_ingest_addresses` path). |
| 4 | **Trips in v1 or v1.1?** 01 keeps trips in the MLP; 03/04 accept v1.1 if launch is before November. At ~20 weeks, launch is ~February. | **v1.1** but ship before Dec travel via a small M3.5 (pot + dates + "¿Es del viaje?"); engine support (`trips` input) lands in M1 anyway. |
| 5 | **Existing users' categories:** force the 25 or opt-in? | Opt-in card (§7), default "Usar las 25"; their own categories remain as extras. |
| 6 | **Home Disponible on the web companion?** | No. Companion = PDF bulk import + account admin only. |
| 7 | **One developer or two?** M4 (Kotlin + Play policy) and M5 (Gmail + CASA) are separable. | A second person on M4 cuts ~4 weeks; otherwise sequence as listed. |

---

## 11. The first PR — "v2 shell + tokens + primitives"

**Branch:** `feat/v2-foundations`. **No feature logic, no schema, no sync changes.**

| Path | Content |
|---|---|
| `mobile/v2/tokens.js` (+ `tokens.d.ts`) | Light palette, radii, spacing, type, elevation from §3 |
| `mobile/tailwind.config.js` | `theme.extend` from `tokens.js` (keep old v1 colors side by side until M6) |
| `mobile/v2/ui/{Row,Tag,Chip,VerdictPill,Button,Segmented,Sheet,AlertBlock,EmptyState,Money,Avatar}.tsx` | Primitives, all states, memoized |
| `mobile/v2/fixtures/laura.ts` | The `05` dataset |
| `mobile/app/(v2)/_layout.tsx` | 3-tab `Tabs` (Inicio, Movimientos, Revisar with badge), hoisted `DetailSheet` host |
| `mobile/app/(v2)/{index,movimientos,revisar}.tsx` | Static screens from fixtures (Inicio ok/warn/bad toggle in dev) |
| `mobile/app/(v2)/dev/preview.tsx` | Every primitive × state |
| `mobile/app/_layout.tsx` | Redirect to `(v2)` when `EXPO_PUBLIC_ZETA_V2=1`; load Geist/Geist Mono via `expo-font` |
| `mobile/eas.json` | `development-v2` profile with the flag |
| `mobile/scripts/check-v2-boundary.sh` + step in `.github/workflows/mobile-pr-verify.yml` | Import boundary + no-hex check |
| `mobile/package.json` | `@expo-google-fonts/geist` (or bundled TTF), `expo-haptics` |
| `CLAUDE.md` | §9 changes 1–2 only |

**What it proves:** the token file drives NativeWind and Reanimated from one source; the v2 shell coexists with v1 in the same binary and bundle ID; primitives reproduce the design's hierarchy rule; fonts load on both platforms.

**How to verify:**
1. `pnpm install` from repo root (lockfile), `cd mobile && npx tsc --noEmit` (what `mobile-pr-verify.yml` runs).
2. `EXPO_PUBLIC_ZETA_V2=1 pnpm ios` (simulator) and `pnpm android` (Pixel emulator); open `zeta:///dev/preview`.
3. Screenshot `dev/preview` and Inicio (ok/warn/bad) and place next to artboards **00**, **3s**, **2i/2j/2k** from `design/zeta-v2/Tema Oliva.dc.html` — colors, radii and type sizes match.
4. Without the flag, the app boots into v1 unchanged (smoke: login, tabs, a transaction).
5. `zetas-front-guy` (retargeted) + `mobile-perf-doctor` on the diff.

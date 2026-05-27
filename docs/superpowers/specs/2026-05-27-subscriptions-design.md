# Subscriptions — Design

**Date:** 2026-05-27
**Status:** Approved (design forks confirmed with user)

## Problem

Zeta already models **recurring obligations** (internet, mobile plan, home services)
via `recurring_transaction_templates` + `recurring_occurrences`. But a large, growing
class of recurring spend — **subscriptions** (Spotify, YouTube Premium, streaming,
SaaS) — is *optional and discardable*, and the app treats it no differently from a
fixed obligation.

Today the only distinction is **implicit and category-driven**:

- A leaf category **"Suscripciones"** exists under the **"Estilo de Vida"** parent,
  `is_essential = false` (so it lands in the Wants/30% bucket of the 50/30/20 plan).
  Category id `c0000001-0012-4000-8000-000000000004`
  (`supabase/migrations/20260329121902_expand_category_tree.sql`).
- The Ritmo-YNAB tag system tags streaming/entertainment as **"Calidad de Vida"**
  (`supabase/migrations/20260329122607_create_tag_system.sql`).

There is **no explicit subscription concept** anywhere — no flag, no metadata, no
dedicated surface. The recurring form (`webapp/src/components/recurring/recurring-form.tsx`)
has no "this is optional/cancellable" affordance. So the app can *store* a subscription
but never **treats** it as a managed, reviewable, "what can I cut?" class: no
subscription total, no cancel-candidate view, no detection of forgotten subscriptions.

**Goal:** make subscriptions a first-class, **phased** concept — classification +
a dedicated audit surface + (later) active management — built on the data model the
app already trusts most.

## Decided design forks (confirmed with user)

| Fork | Decision |
|------|----------|
| Core job | **First-class, phased** — classification + audit view + (deferred) active management. Data model built to support all three. |
| Source | **Manual + auto-detect** — user flags/creates subscriptions, *and* a deterministic detector surfaces candidates from imported transaction history. |
| Architecture anchor | **B′ — destinatario recognition + a dedicated `subscriptions` table.** Recognition reuses the proven multi-pattern destinatario engine; subscription state lives in its own thin table; billing rides the existing recurring template/occurrence lifecycle (optional link). |
| Billing link | **Optional** — `recurring_template_id` is nullable. With a template, totals come from `recurring_occurrences` (authoritative). Without one, an `estimated_amount` is shown, clearly labeled "estimado". |
| Audit surface | **Dedicated `/suscripciones` page.** Entry points (bandeja / dashboard widget / plan CTA / nav) deferred — built standalone. |
| Detection | **Deterministic, no AI**, grouped by `destinatario_id`. Monthly cadence only; annual/quarterly are manual-only. |

## Why B′ (the anchor decision)

Destinatarios are already the app's most reliable categorization/detection mechanism,
and they already provide the multi-pattern recognition a subscription detector needs —
so the feature **reuses** that engine rather than rebuilding a fragile merchant-string
matcher:

- **Multi-pattern is real.** `destinatario_rules`
  (`supabase/migrations/20260310044637_create_destinatarios_and_rules.sql`) holds *many*
  patterns per destinatario (`match_type` ∈ `contains|exact`, `priority`, first-match-wins).
  Three Netflix merchant strings collapse to one Netflix destinatario.
  Matcher: `packages/shared/src/utils/destinatario-matcher.ts`.
- **The link is persisted.** `transactions.destinatario_id` is set on import, on manual
  entry (which *learns* a rule — `webapp/src/actions/categorize.ts` `assignDestinatario`),
  and via bulk retroactive apply (`bulkApplyDestinatarioMatches`,
  `applyDestinatarioRules` in `webapp/src/actions/destinatarios.ts`).
- **Reliable categorization is built in.** `destinatarios.default_category_id`
  auto-applies a category to matched transactions (`USER_LEARNED`) — the same path that
  routes a subscription into Suscripciones → Wants.
- **The recurring system is already destinatario-aware.**
  `recurring_transaction_templates.destinatario_id`
  (`supabase/migrations/20260417170859_add_destinatario_id_to_recurring_templates.sql`)
  exists, and the occurrence matcher anchors on **destinatario + account** rather than
  amount proximity.
- **A suggestion engine already exists.** `getDestinatarioSuggestions()` /
  `detectDestinatarioSuggestions()` group un-matched repeating charges into candidates —
  reusable as the no-destinatario fallback path for detection.

We do **not** bolt subscription state onto destinatarios (overloads a shared entity,
forces a 6-step encrypted ALTER on a hot table) nor onto the recurring template (forces
a template on every subscription, double-flag risk). Instead, a dedicated table holds it.

## The three layers

1. **Recognition — destinatarios, untouched.** Multi-pattern `destinatario_rules` +
   `default_category_id` reused as-is. Answers "who is this merchant" reliably.

2. **Subscription state — new `subscriptions` table** (one *live* row per destinatario;
   cancelled/dismissed rows kept as history). Holds the lifecycle + subscription-specific
   metadata. The *existence of a non-terminal row* is the subscription flag — nothing
   double-flagged on destinatario or template.

3. **Billing — recurring template (optional link).** When linked, amount / next charge /
   total come from `recurring_occurrences` (authoritative source of truth). When not,
   `estimated_amount` (median of recent charges) is shown, labeled "estimado", with a
   one-tap "Formalizar" to create the schedule.

## Data model

### New table `subscriptions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK profiles | RLS + defense-in-depth `.eq("user_id", …)` |
| `destinatario_id` | uuid FK destinatarios | the recognition anchor; see partial-unique rule below |
| `recurring_template_id` | uuid FK recurring_transaction_templates **NULL** | optional billing schedule |
| `status` | enum | `suggested \| active \| trial \| marked_for_cancellation \| cancelled \| dismissed` |
| `estimated_amount` | numeric NULL | median of recent charges; used only when no template |
| `currency_code` | text | |
| `trial_ends_on` | date NULL | phase-3 metadata |
| `cancel_url` | text NULL | phase-3 metadata |
| `detected_at` | timestamptz NULL | set when auto-detected |
| `dismissed_at` | timestamptz NULL | sticky dismissal memory |
| `created_at` / `updated_at` | timestamptz | |

- **Lifecycle in one enum.** A detected candidate is a `suggested` row; dismissal sets
  `status = dismissed` (+ `dismissed_at`) so the detector never re-nags. Confirmation
  promotes to `active`/`trial`.
- **Encryption:** `cancel_url` (and any free-text notes) may be PII → run the table
  through `supabase-migrator`, which decides which columns need the `_enc` envelope.
  Because this is a **new** table, encryption is a clean fresh setup, **not** a 6-step
  ALTER on `destinatarios_enc`.
- **No new columns on `destinatarios_enc` or `recurring_transaction_templates`.**

**Partial-unique rule (resubscription-safe).** One *live* subscription per destinatario,
but history preserved: a cancelled/dismissed row must not block a later resubscription.

```sql
CREATE UNIQUE INDEX subscriptions_one_live_per_destinatario
  ON subscriptions (user_id, destinatario_id)
  WHERE status NOT IN ('cancelled', 'dismissed');
```

So resubscribing after a cancel = a **new** `active` row (the old `cancelled` row stays
as history); re-detecting a dismissed merchant is blocked by the dismissal guard below,
not by this index.

### Migration

- `supabase migration new create_subscriptions` — table, enum, RLS
  (`(select auth.uid()) = user_id`), the partial-unique index above, plus indexes on
  `user_id`, `destinatario_id`, `recurring_template_id`, `status`.
- **FK precision for `supabase-migrator`:** both `destinatarios` and
  `recurring_transaction_templates` are **encrypted** (`_enc` real tables + decrypting
  views). The FKs must target the **`_enc`** tables (`destinatarios_enc`,
  `recurring_transaction_templates_enc`), matching the existing
  `recurring → destinatarios_enc` FK pattern. Reads on `/suscripciones` that join through
  the views must use the **`!fk_name` join-hint** syntax (plain joins through views
  silently return empty).
- Regenerate `webapp/src/types/database.ts` and `packages/shared/src/types/database.ts`.
- **Spawn `supabase-migrator`** (RLS, encryption decision, FK targets, view join hints).

### Backfill (one-shot, in the same migration)

Seed `status = active` rows for existing **recurring templates categorized as
Suscripciones (`c0000001-0012-…`) that already carry a `destinatario_id`**, linking
`recurring_template_id` + `destinatario_id`. Templates without a destinatario, and
category-only matches with no schedule, are **not** force-seeded — they surface through
detection instead. Conservative: no false positives, but the audit view is not empty on
first open.

## Detection — `packages/shared/src/subscription-detector.ts`

Deterministic, rule-based (no AI, per project constraint). Pure function consumed by
both webapp and mobile (lives in `@zeta/shared`).

**Primary path — group by `destinatario_id`.** For each destinatario's OUTFLOW
transactions, qualify as a candidate when:

- **≥ 3** charges
- **monthly cadence:** median gap between consecutive charges ∈ **[28, 34] days**
- **stable amount:** within **±10%** of the median (tolerates FX / price bumps)
- no `active`/`trial` `subscriptions` row already exists for that destinatario

Qualified groups upsert a `status = suggested` row carrying `estimated_amount`
(median), `currency_code`, `detected_at`.

**Fallback path — no destinatario.** For repeating charges with `destinatario_id IS NULL`,
reuse `getDestinatarioSuggestions()` to group by cleaned description; surface as a
"create destinatario + track as subscription" nudge (so the user gains both a
destinatario *and* a subscription in one step).

**Trigger / timing.** Detection runs **after `importTransactions()` completes**
(`webapp/src/actions/import.ts`) — new transactions just arrived, so that is the natural
moment to (re)scan and upsert `suggested` rows. Detection is a **write** path and must
never run inside a Server Component render: the `/suscripciones` page only **reads**
already-persisted `suggested` rows. (A future cron path is possible but out of scope.)

**Re-detection idempotency (protects sticky dismissal).** The detector upserts keyed on
`(user_id, destinatario_id)`. It only ever **inserts a new `suggested` row when no row
exists** for that destinatario. If a row already exists in **any** status
(`dismissed`, `cancelled`, `active`, `trial`, `marked_for_cancellation`, or a prior
`suggested`), the detector does **nothing** — it must not undismiss, re-suggest, or
overwrite. This makes dismissal permanent and avoids re-nagging.

**Non-goal:** no auto-detection of ANNUAL/quarterly cadence (too few data points per
year) — those are manual-only. Thresholds are intentionally conservative and tunable.

**Total bleed is occurrence-based.** The audit total sums `expected_amount` from
`recurring_occurrences` of linked active templates — never raw `transactions`. The page
data loader **calls `ensureCurrentOccurrences()` before reading** (per the
recurring-doctor rule: idempotent `ON CONFLICT DO NOTHING`), so landing right after a
month rolls over does not undercount. Template-less subscriptions contribute
`estimated_amount` shown on a **separate "estimado" line**, never silently merged into
the authoritative total.

## Audit surface — `/suscripciones`

New route + page (Server Component, server-first data fetch; `"use cache"` +
`cacheTag("subscriptions")` + `cacheLife("zeta")` for the reads).

- **Total-bleed hero:** authoritative monthly total + annualized projection; `estimado`
  shown as a distinct secondary line. Framed against the Wants/30% bucket.
- **Active list:** per row — destinatario name/icon, amount, next charge date (from
  occurrences), status badge. Row actions: **Formalizar** (template-less → create
  schedule), **Marcar para cancelar**, **Cancelar**, **Editar**.
- **Suggestions section:** detected `suggested` rows → "Esto parece una suscripción —
  ¿rastrearla?". Confirm → promote to `active` (+ optionally pre-filled recurring
  template). Dismiss → `status = dismissed` (sticky).
- **Entry points = OPEN QUESTION** (bandeja / dashboard widget / plan-page CTA /
  top-level nav). Page is built standalone; entry wired at implementation.

Reuse existing UI primitives from `webapp/src/components/ui/` (cards, badges, stat
displays) per the design-system rules. All strings Spanish. Tokens only — no hardcoded
colors. Mobile tab-bar clearance + focus-mode rules apply.

## Server actions — `webapp/src/actions/subscriptions.ts`

`(prevState, formData) => Promise<ActionResult<T>>` shape, `getAuthenticatedClient()`,
defense-in-depth `.eq("user_id", user.id)`, `updateTag("subscriptions")` (+
`updateTag` for any affected financial views) on every mutation.

- `confirmSubscription(suggestionId | destinatarioId)` — promote/create `active` row;
  optionally create+link a recurring template pre-filled from detected cadence/amount
  (single transactional action — flag + template together).
- `dismissSubscription(id)` — `status = dismissed`, `dismissed_at = now()`.
- `markForCancellation(id)` / `cancelSubscription(id)` — see cancel rules below.
- `formalizeSubscription(id)` — create+link a recurring template for a template-less sub.
- `updateSubscription(id, …)` — edit `trial_ends_on` / `cancel_url` / status.
- Reads via `getSubscriptions()` (cached) feeding the page + any widget.

## Recurring form integration

`webapp/src/components/recurring/recurring-form.tsx` — add an **"Es una suscripción"**
toggle. On save (in `webapp/src/actions/recurring-templates.ts`), upsert the
`subscriptions` row (`status = active`/`trial`) linked to the saved template + its
destinatario. Toggle reveals optional `trial_ends_on` / `cancel_url` inputs. A recurring
template still requires a destinatario for the subscription link (the form already
exposes the destinatario picker).

## Budget integration — no new math

Subscriptions categorize via the destinatario's `default_category_id` → Suscripciones →
`is_essential = false` → Wants/30%, already wired in
`webapp/src/components/plan/tabs/plan-tab-presupuesto.tsx` and `get503020Allocation`.
The audit page **frames** that subset; it never adds a parallel allocation bucket
(no double-counting).

## Cancel rules (no drift)

- `marked_for_cancellation` = **visual intent only** — does **not** stop occurrence
  generation.
- **Real cancellation** = recurring template `is_active = false` **and**
  `subscriptions.status = cancelled`, performed together in `cancelSubscription`.
- **Drift guard (any path).** A user can also deactivate a subscription-linked template
  directly through the existing recurring form (or mobile). To keep the two entities in
  sync regardless of entry point, a DB trigger on `recurring_transaction_templates`
  UPDATE syncs the linked subscription: when a linked template flips `is_active → false`,
  set the subscription's `status = cancelled` (if not already terminal); when it flips
  back `→ true`, restore `status = active`. The DB trigger (not just the action) is what
  makes "one authoritative stopped-billing path" actually true across web, mobile, and
  direct edits.

## Mobile parity (hard gate)

The new `subscriptions` table must be mirrored on mobile per the parity rule:

- Mobile SQLite schema (`mobile/lib/db/schema.ts`) + repository
  (`mobile/lib/repositories/subscriptions.ts`) + pull/push sync
  (`mobile/lib/sync/pull.ts`, `push.ts`) — view-aligned columns (not `_enc`), enum +
  date mapping, boolean handling.
- Push payload must exclude any DB-/trigger-computed fields and go through the view.
- The detector lives in `@zeta/shared` (cross-consumed). Suggestion **UI** is
  webapp-first; mobile mirrors in a later pass.
- **Spawn `mobile-webapp-parity` (before any mobile write) and `mobile-sync-doctor`
  (when adding the synced table).**

## Phasing

- **Phase 1 (webapp):** `subscriptions` table + enum + RLS + backfill · recurring-form
  toggle + action wiring · `/suscripciones` page (active list + occurrence-based total)
  · manual confirm/cancel paths.
- **Phase 2:** `subscription-detector.ts` + no-destinatario fallback · suggestions
  section + sticky dismissal · mobile parity for the new table.
- **Phase 3 (separate spec, deferred — out of scope here):** active management —
  trial-ending alerts, price-increase detection, cancel-flow UX. The nullable
  `trial_ends_on` / `cancel_url` columns already enable it.

## Review gates (per CLAUDE.md)

- `supabase-migrator` — the migration (RLS, encryption decision, view/FK joins).
- `server-action-reviewer` — `subscriptions.ts` actions (auth, validation, `updateTag`).
- `perf-auditor` + `zetas-front-guy` — the `/suscripciones` page.
- `recurring-doctor` — confirm totals query `recurring_occurrences`, and that
  confirm/formalize auto-link via `findMatchingOccurrence()`.
- `mobile-webapp-parity` + `mobile-sync-doctor` — the synced table (phase 2).
- `import-flow-doctor` — if detection touches the import path.

## Open questions

1. **Entry points / placement** of `/suscripciones` (bandeja, dashboard widget, plan
   CTA, nav) — decide at implementation.
2. **Encryption** of `subscriptions` columns (`cancel_url`?) — `supabase-migrator` decides.
3. **Detection on mobile** in phase 2, or webapp-only initially?

## Non-goals

- No ML / AI categorization or detection (deterministic only).
- No phase-3 active-management workflows in this spec.
- No changes to the 50/30/20 budget math.
- No annual/quarterly auto-detection.

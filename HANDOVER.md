# Session Handover — 2026-04-22 (Mobile capture ungate + Cuentas v2)

> Supersedes prior handovers. For earlier handovers see git history (`HANDOVER.md@HEAD~N`).

## 1. Session Summary

Shipped **PR #212** (merged as `5d22762`): mobile capture screen now creates destinatarios + recurring templates alongside a transaction save, and the Cuentas tab + forms migrated from pre-v2 light-mode classes to the design-system tokens used everywhere else. Also landed a Supabase trigger that auto-generates `recurring_occurrences` for newly created/reactivated templates — closing a webapp/mobile divergence where mobile-created templates were invisible in Plan until a webapp user visited the page. Session ran the full pipeline: audit (Explore agent) → implement → gate agents (`mobile-webapp-parity`, `mobile-sync-doctor`) → fix findings → `/simplify` (3 review agents in parallel) → apply → Gemini review → reply + backlog.

## 2. Changes Made (shipped in PR #212, now on main)

### Mobile — capture + new repo writes
- **`mobile/app/capture.tsx`** (modified) — replaced two `Alert("Próximamente")` Pressables under "Opciones relacionadas" with Switch toggles. On save, optionally calls `createDestinatarioWithPattern` + `createRecurringTemplate` alongside `createTransaction`. DEBT account guard at UI + repo; repo throws surfaced via Alert.
- **`mobile/lib/repositories/destinatarios.ts`** (modified) — added `createDestinatarioWithPattern({ user_id, name, default_category_id?, notes?, pattern? })` — single SQLite transaction inserting destinatario + optional rule + both sync_queue entries.
- **`mobile/lib/repositories/recurring.ts`** (modified) — added `createRecurringTemplate(params)` + `CreateRecurringTemplateParams` type. Uses shared `TransactionDirection` / `RecurrenceFrequency` from `@zeta/shared` (not hand-rolled unions — fixes `ONCE` drift). Defense-in-depth DEBT guard. Uses `effectiveDirection` const (no param reassignment, per Gemini review).
- **`mobile/lib/sync/queue.ts`** (created) — `enqueueInsert` / `enqueueUpdate` / `enqueueDelete` helpers. Replaces 3 duplicated `INSERT INTO sync_queue ...` blocks.
- **`mobile/lib/db/schema.ts`** (modified) — migration v10 adds `destinatario_id TEXT` to `recurring_transaction_templates` so capture can link both when toggled together.

### Mobile — Cuentas v2 migration
- **`mobile/app/(tabs)/accounts.tsx`** (modified) — `MobileHeader` (narrator title font), `PANEL_SURFACE_SUBTLE_CLASS` net-worth card, `BRASS_BUTTON_CLASS`, `SECTION_EYEBROW_CLASS`, `MOBILE_TAB_BAR_CLEARANCE`. Dropped per-item `<View className="px-4">` wrapper (padding moved to `contentContainerStyle`).
- **`mobile/app/account/create.tsx`** (modified) — `MobileHeader variant="sub"`, `PANEL_INSET_CLASS` inputs, `BRASS_BUTTON_CLASS` submit, dark-mode `DayPicker`. Imports shared form primitives from `AccountFormFields.tsx`.
- **`mobile/app/account/edit/[id].tsx`** (modified) — same treatment.
- **`mobile/components/accounts/AccountFormFields.tsx`** (created) — extracted `FormField`, `NumericInput`, `DayPicker` (were duplicated byte-for-byte between create + edit).
- **`mobile/components/accounts/AccountTypeGrid.tsx`** (modified) — dark tiles + brass selection; replaced undefined `bg-primary` class.
- **`mobile/components/accounts/CurrencyPicker.tsx`** (modified) — same.
- **`mobile/lib/constants/styles.ts`** (modified) — added `FORM_INPUT_CLASS` token.

### Supabase migrations (applied to remote `tgkhaxipfgskxydotdtu`)
- **`supabase/migrations/20260422003433_auto_generate_recurring_occurrences.sql`** (created) — AFTER INSERT + AFTER UPDATE triggers on `recurring_transaction_templates_enc`. `generate_occurrences_for_template(uuid)` SECURITY DEFINER function materializes pending occurrences for current-month + 14 days. `ON CONFLICT DO NOTHING` for idempotency. `SET search_path = public`. Reversible.
- **`supabase/migrations/20260422010000_refine_recurring_occurrence_trigger.sql`** (created) — refinement: moves the "should we regenerate?" predicate into the UPDATE trigger's `WHEN` clause so the SECURITY DEFINER function isn't invoked for `updated_at`-only touches.

### .mcp.json (project-level)
- Added `ios-simulator` server via `npx -y ios-simulator-mcp`. Allows `ui_tap`, `ui_swipe`, `screenshot`, `ui_describe_all`, etc. from future sessions.

### Memory (`~/.claude/projects/.../memory/`)
- **`feedback_webapp_source_of_truth.md`** (created) — principle that webapp is canonical; mobile mirrors validation/shapes/side effects. Parity gate before any mobile Supabase mutation.
- **`MEMORY.md`** (modified) — indexed the above.

### Post-merge (uncommitted)
- **`BACKLOG.md`** (modified) — removed resolved "Mobile capture ungate" entry, added new "Recurrence end-of-month drift" bug entry (paired `@zeta/shared` + trigger fix), added 2026-04-22 session handoff section.
- **`.claude/worktrees/agent-a29c6afc`** (staged deletion) — stale worktree dir, unrelated to this session but picked up by `git status`.

## 3. Key Decisions

- **Toggles-on-save UX** for the two "Opciones relacionadas" actions instead of dedicated modal routes. Ships in one slice; matches user intent ("also create X alongside this tx").
- **DEBT guard duplicated** at UI + repo. UI surfaces a Spanish Alert pointing to Recurrentes; repo throws for defense-in-depth against future callers. Both branches hit the same invariant.
- **Occurrence generation via DB trigger**, not mobile sync-push hook. Single invariant for all clients. Beats mobile-side RPC because (a) offline-then-sync would leave a gap, (b) future-proofs against any other write path.
- **Drift bug left as-is.** Gemini flagged Jan 31 → Feb 28 drift. Webapp `getOccurrencesBetween` (date-fns `addMonths`) has identical drift. Per the source-of-truth principle, fixing the trigger alone would silently diverge. Logged on BACKLOG as a paired fix.
- **Types regen skipped.** `npx supabase gen types` output showed `| null` on every Row field (CLI 2.90.0 breakage, per memory). Tracked `webapp/src/types/database.ts` is manually maintained and already has `destinatario_id`.
- **sync_queue payload for destinatarios omits `name_hmac`** — supabase-migrator confirmed INSTEAD OF INSERT trigger on view hardcodes `zeta_hmac(NEW.name)`.
- **SQLite migration v10** instead of schema rewrite — additive `ALTER TABLE ADD COLUMN` runs non-destructively on existing installs.

## 4. Current State

- **Build:** webapp `pnpm build` passed at end of session. Mobile `npx tsc --noEmit` clean on touched files (pre-existing `demo-data.ts` errors unrelated, on main).
- **Branch:** `main`, 0 commits ahead of origin/main. PR #212 merged (`5d22762`).
- **Uncommitted:** `BACKLOG.md` modified, `.claude/worktrees/agent-a29c6afc` deletion staged.
- **Remote DB:** both 20260422 migrations applied. Trigger fires on view INSERT via INSTEAD OF forwarding to `_enc`.
- **Simulator:** iPhone 17 Pro (UDID `AFBA8440-2959-4DC9-8B8D-ABD7CFE5B14A`) booted with dev-client installed; Metro bundler was running in background task `bg212ini3` (check before assuming alive).

## 5. Open Issues & Gotchas

- **Recurrence engine end-of-month drift** (BACKLOG, Medium) — `packages/shared/src/utils/recurrence.ts:68-106` `getOccurrencesBetween` + `supabase/migrations/20260422003433_auto_generate_recurring_occurrences.sql` both drift. Fix together: use `day_of_month` column as anchor with end-of-month clamping.
- **Mobile capture amount live-formatting** (BACKLOG, Medium) — `mobile/app/capture.tsx:420-433` TextInput shows raw digits. Want COP thousand grouping. Formula prototyped in 2026-04-20 session (see BACKLOG entry).
- **Mobile stubs from audit** — `subscriptions.tsx`, `bug-report.tsx`, `annotate-screenshot.tsx`, `purchase-decision.tsx` still partial/stub. Not yet in BACKLOG.
- **Gemini PR #212 replies** sent via `gh api` on comments 3121025656, 3121025657, 3121025661.

## 6. Suggested Next Steps

1. **Commit pending BACKLOG.md + stale worktree deletion** — small housekeeping.
2. **Mobile capture amount live-formatting** — ~30 min, finishes the capture polish arc.
3. **Recurrence engine drift fix** — medium lift, paired `@zeta/shared` + Supabase trigger. Gate: test covers Jan 31 → Mar 31 chain.
4. **Flow 02 PR 3** — drag-to-reorder + S/M/L resize for dashboard widget zone (Reanimated + gesture-handler). Pending from 2026-04-21.
5. **Next mobile stub** — `subscriptions.tsx` or similar from the 2026-04-22 audit.

## 7. Context for Claude

- **PR #212 diff:** 751 insertions / 287 deletions / 16 files.
- **Route audit** for mobile lives in this session's Explore agent transcript. Re-run on `mobile/app/**/*.tsx` + `mobile/lib/repositories/*.ts` if needed.
- **ios-simulator MCP** loaded from `.mcp.json` — requires `idb-companion` (brew) + `fb-idb` via `uv tool install --python 3.11 fb-idb`. Python 3.14 breaks it.
- **Simulator deep-link scheme** is `zeta://<path>` (e.g. `xcrun simctl openurl <UDID> "zeta://capture"`). Useful when FAB sheets are fragile in the a11y tree.
- **Expo dev-client** needs Metro running separately (`npx expo start --dev-client` in `mobile/`). No Metro → "No development servers found".
- **Unapplied migration picked up** — `supabase/migrations/20260421180000_anonymous_cleanup_cron.sql` was applied during this session's first `db push` (pre-existing, not from PR #212).
- **Webapp-is-source-of-truth** is the governing principle. Before any mobile Supabase mutation, read the webapp action and port verbatim. If webapp has a bug, fix both or neither — never diverge.
- **Gate pipeline order** this session: Explore audit → implement → `mobile-webapp-parity` + `mobile-sync-doctor` in parallel → fix → `pnpm build` → commit → PR → `/simplify` (3 reviewers parallel) → fix → push → Gemini reply.
- **Auto mode + caveman lite** active throughout. Code/commits write normally; prose stays tight.

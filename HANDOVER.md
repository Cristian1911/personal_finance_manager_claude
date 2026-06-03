# HANDOVER — 2026-06-03 — Personal Debts (F1) feature

> Supersedes the 2026-05-21 (Hero V7 + parity) handover. Earlier handovers in git history (`HANDOVER.md@HEAD~N`).

- **Branch:** `feat/personal-debts` (NOT merged; local commits only, nothing pushed)
- **Spec:** `docs/superpowers/specs/2026-06-03-personal-debts-and-shared-spaces-design.md`
- **Plan:** `docs/superpowers/plans/2026-06-03-personal-debts-f1.md` (15 tasks, with line offsets per task)

## What this is

F1 = a destinatario-anchored **lend/borrow tracker** ("Personas"). User records money borrowed from / lent to a person; a `borrowed` inflow is income-excluded but creates a "Debo / Me deben" obligation. F2 (Splitwise shared spaces) is a separate future effort — NOT started. See the spec.

## Status: web feature COMPLETE, committed, build-green, migrations LIVE

Tasks 1–10, 12 (minus Step 6), 13 are **done and committed** on `feat/personal-debts`. `cd webapp && pnpm build` is **green**. The 3 migrations are **pushed to remote Supabase** (`tgkhaxipfgskxydotdtu`).

Commits (newest first):
- `fba10d46` add Personas to workspace nav (Task 13)
- `b6a19f8f` /personas page + PersonaCard + create/repayment flows (Task 10)
- `19b78945` thread kind (merchant|person) through validators/actions/pickers (Task 12, Steps 1–5)
- `a2558b98` clear personal-debts cache tag on full reset (Task 9)
- `20115f31` exclude debt-origin tx from income/spend metrics (Task 8)
- `167cc83d` server actions (Task 7)
- `63422622` **fix: repair database.ts type-gen breakage** (see gotcha below)
- `341045e1` transactions personal_debt_id+pd_role migration (Task 3, pushed)
- `fdf69cef` destinatarios kind migration (Task 2, pushed)
- `376ea72b` personal_debts table migration (Task 1, pushed)
- `0a0050d8` shared pure helpers + vitest (Task 5)
- `6182a79d` validators (Task 6); `feb4ac29` regen types + domain (Task 4, later fixed)

What works now: visit `/personas` → empty state, create a Debo/Me deben debt (person picker filtered to kind=person, inline create person), per-person cards with outstanding + overdue badge, expand → Registrar abono (recordRepayment + balance delta) / Saldar / Cancelar. Income metrics exclude `borrowed` origin inflows; repayments count normally.

## Remaining work (do in this order; details + line offsets in the plan)

1. **`zetas-front-guy` review of the Personas UI — DONE, blocking fixes applied.** Fixed: phantom token `z-danger` → real `z-debt` (overdue/Debo indicators were rendering with NO color), the `new Date().toISOString()` UTC date footgun → `format(new Date(),"yyyy-MM-dd")`, and card-tier alignments (`bg-black/10` Tier 3, `bg-[#111]` Tier 2, `tracking-[0.18em]`). REMAINING non-blocking polish (next session, optional): V5 — `DirectionButton` in `create-personal-debt-sheet.tsx` is a de-facto button variant (add a `TOGGLE_*` constant to `styles.ts`); R1 — replace hand-rolled `SummaryStat` with shared `@/components/debt/stat-tile` (needs a `tone` prop); W5 — `/personas` page may double-apply `MOBILE_TAB_BAR_CLEARANCE_CLASS` if the dashboard `main` already supplies it.
2. **Task 11 — Expand "Vincular" (tx → personal debt)** — plan L1424. Link an existing transaction to a debt (role auto-inferred). Action already exists (`linkTransactionToPersonalDebt`/`unlinkTransactionFromPersonalDebt`); this is the UI surface in the movimientos row's existing "Vincular" menu.
3. **Task 12 Step 6 — Destinatarios management Personas/Comercios segregation** — plan L1525. DEFERRED (cosmetic). Split `destinatario-list.tsx` rendered list by `kind` (data already flows via `getDestinatariosWithSpend`).
4. **Task 14 — Mobile parity** — plan L1630. Whole mobile SQLite + sync + repo + route for personal_debts + new columns (`transactions.personal_debt_id/pd_role`, `destinatarios.kind`). Gates: `mobile-webapp-parity` + `mobile-sync-doctor`. **Nuance already found:** mobile `createTransaction` does NOT write local `accounts.current_balance` (only `accounts.ts:137` does) → the mobile repayment mirror must NOT double-apply a balance delta on pull. `packages/shared/src/types/database.ts` may also need the new enums/columns hand-added (separate from webapp's).
5. **Task 15 — final gate sweep** — plan L1730. `perf-auditor` on `/personas` + the income-exclusion hot-path edits, then `finishing-a-development-branch` (merge/PR).

## CRITICAL gotchas learned this session (read before touching schema/types)

- **NEVER full-regen `webapp/src/types/database.ts`.** `supabase gen types` (CLI 2.104.0) moves the encrypted VIEWS (`transactions`, `destinatarios`, …) from `Tables` to `Views` and types their DECRYPTED columns (`raw_description`, `merchant_name`, `notes`, `clean_description`, `capture_input_text`) as `?: never` in Insert — silently breaking `.insert()`/`.update()` app-wide AND breaking `Tables<"transactions">`. Bit us (feb4ac29), reverted in 63422622. **The file is hand-maintained: for any new column, hand-add it to Row/Insert/Update of the affected table(s) + the enum to `Enums`+`Constants`.** (memory `feedback_supabase_type_gen_breakage`).
- **`_enc` trigger bodies drift across migrations.** Adding a column to an `_enc` view (6-step): DO NOT copy trigger bodies from the original `encrypt_*` migration — use the LATEST: destinatarios insert fn=`20260417193237`, update fn=`20260417203708` (has_auth guard + SELECT INTO `_old`); transactions=`20260525120000` (newest full column list). Find with `grep -rl "VIEW <name>\|<name>_view_insert" supabase/migrations | sort | tail`.
- **`personal_debts.currency_code` is `text` (string), not the `currency_code` enum** — cast when feeding a transactions insert or `formatCurrency`.
- A subagent botched the database.ts hand-add (claimed tsc-clean but the columns didn't land); user then asked to implement INLINE. **Keep implementation inline; use custom agents only as review GATES.**

## Also parked (unrelated, in BACKLOG.md)

- **FAB "Nueva transacción" bug** (mobile webapp) — premature submit + re-fires "Guardado" on reopen. Root-caused to two candidate vectors (P=persistence / S=premature-submit); needs one repro to disambiguate. Full analysis in BACKLOG `## Bugs`.
- **RLS UPDATE policies missing `WITH CHECK`** (subscriptions + maybe others). BACKLOG.

## How to resume

1. `git checkout feat/personal-debts`. `cd webapp && pnpm build` should be green.
2. Read this file + the plan. Migrations are already applied to remote — do NOT re-push Tasks 1–3.
3. Start with item 1 (token check), then Task 11 / 14 / 15.

# Next session — start here (Personal Debts F1)

Continuing the **Personas (lend/borrow tracker)** feature. Web is done; mobile shipped **read-only**; writes deferred to Phase 2.

## Status (2026-06-04 session) — all green, NOTHING committed/pushed

Verification: `webapp pnpm build` ✓ · `mobile npx tsc --noEmit` ✓ · shared vitest (`personal-debt.test.ts`) ✓ · webapp vitest (`src/`) ✓. 4 review gates ran (zetas-front-guy, mobile-sync-doctor, mobile-webapp-parity, mobile-perf-doctor) — blocking findings fixed inline, rest backlogged.

Done this session (uncommitted, working tree only):
- **Task 11 — Vincular a persona** ✅ `movimientos-transaction-row.tsx`: sibling chip + 2nd `LinkPickerSheet`, gate `!personal_debt_id && !transfer_group_id`, reuses `isLinking`. (No `onCreateNew` — LinkPickerSheet hardcodes "recurrente" copy.)
- **Task 12 Step 6 — Personas/Comercios split** ✅ `destinatario-list.tsx`: `filtered`→`{personas,comercios}`, single render-list with `col-span-full` `SECTION_EYEBROW_CLASS` headings. `kind` already flows from action+page.
- **Task 14 — Mobile parity (READ-ONLY v1)** ✅ schema v16 (`personal_debts` + `destinatarios.kind` + `transactions.personal_debt_id/pd_role`), pull.ts registration (`is_demo` boolean), read-only repo `personal-debts.ts`, `PersonasRoot.tsx` (Debo/Me deben display), route + `_layout` + menu HubEntry. **push.ts intentionally NOT touched** (mirrors subscriptions pull-only precedent).
- **Task 15 — gates** ✅ (build/tests/tsc + 4 agents).

## What's left
1. **Decide: commit + PR.** Tree also has unrelated pre-session dirty files (`app.json`, `eas.json`, `mobile/lib/analytics/`, `mobile/lib/services/notifications/`, `weekly-digest*`, docs) — stage ONLY the personas files (listed above) for atomic commits; don't sweep the rest. Then dry-merge vs `origin/main` (likely conflicts: `database.ts`, `domain.ts`, mobile `schema.ts`) before PR.
2. **BACKLOG (do before mobile writes):** "Mobile — income metrics don't exclude personal-debt `origin` inflows" — live web/mobile divergence; fix `monthly-aggregates.ts` + mobile `getMonthlyAggregates`.
3. **BACKLOG Phase 2:** "Personal Debts (Personas) — mobile write parity" — repo create/recordRepayment (NO local balance write) + re-add push.ts + create/abono UI + device-verify round-trip.
4. Optional web polish (from prior HANDOVER): Vincular create-with-origin deep-link, V5 `TOGGLE_*` constant, R1 `stat-tile` reuse, W5 double-clearance check.

## Rules (do not skip)
- **NEVER full-regen `webapp/src/types/database.ts`** — hand-add columns.
- Migrations Tasks 1–3 are **already applied to remote** — do NOT re-push.
- **Implement inline.** Custom agents = review gates only.
- Spanish UI, `pnpm` (not npm), build must pass before claiming done.

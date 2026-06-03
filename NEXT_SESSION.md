# Next session — start here (Personal Debts F1)

You're continuing the **Personas (lend/borrow tracker)** feature. The web part is done; finish the rest.

## First 3 steps
1. `git checkout feat/personal-debts` then `cd webapp && pnpm build` — must be green.
2. Read `HANDOVER.md` (full status + gotchas) and the plan `docs/superpowers/plans/2026-06-03-personal-debts-f1.md`.
3. Pick up the remaining tasks below (in order).

## What's left
- **Task 14 — Mobile parity** (the big one): plan L1630. Add `personal_debts` + the new columns (`transactions.personal_debt_id/pd_role`, `destinatarios.kind`) to mobile SQLite schema + sync + repo + a `/personas` route. Gates: `mobile-webapp-parity` + `mobile-sync-doctor`.
- **Task 11 — Vincular UI**: plan L1424. The action already exists (`linkTransactionToPersonalDebt`); just wire it into the movimientos row's existing "Vincular" menu.
- **Task 15 — Finish**: `perf-auditor` on `/personas`, then merge/PR.
- Optional polish: Task 12 Step 6 (mgmt-list Personas/Comercios split) + the UI items noted in HANDOVER.

## Rules (do not skip)
- **NEVER full-regen `webapp/src/types/database.ts`** — it breaks encrypted-view inserts app-wide. Hand-add new columns.
- Migrations for Tasks 1–3 are **already applied to remote** — do NOT re-push them.
- **Implement inline.** Use the custom agents (supabase-migrator, server-action-reviewer, mobile-*-doctor, zetas-front-guy) only as **review gates**, not to write the code.
- For `_enc` column adds, copy the **latest** has_auth-guarded trigger bodies (not the original `encrypt_*` migration). See HANDOVER for the exact migration files.
- Spanish UI, `pnpm` (not npm), build must pass before claiming done.

When everything's green, delete this file.

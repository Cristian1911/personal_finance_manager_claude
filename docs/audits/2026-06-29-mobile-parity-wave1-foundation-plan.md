# Mobile Parity — Wave 1: Foundation P0 data-integrity fixes

> Branch: `feat/mobile-parity-foundation` (off `main`). Source of truth = webapp.
> Approach: **local-first** — apply every webapp server-action side-effect LOCALLY on SQLite
> (there is NO server trigger reproducing them; sync push writes raw rows). Implement INLINE
> (the substrate is delicate — double-apply traps); custom agents are review GATES only.

## Canonical substrate (already on `main`, est. by #307)

`mobile/lib/repositories/ledger-helpers.ts` is the write substrate the 4 ledger mutations +
email-import already use:
- `buildLedgerTxPayload(...)` → view-shaped tx payload (clean_description, real booleans).
- `insertLedgerTransaction(db, payload, now)` → local INSERT + `sync_queue` INSERT; **dupe-SAFE**
  (returns `{inserted:false}` on UNIQUE(idempotency_key) collision, the local 23505 equivalent —
  no throw).
- `applyLocalBalanceDelta(db, account, direction, amount, currency, now)` → signed delta; debt
  accounts clamp + recompute `available_balance`/`currency_balances`; calls
  `enqueueAccountUpdateCoalesced` internally (no push.ts change needed).
- `setLocalBalanceOverwrite(...)` → reconcile OVERWRITE only (never a delta).
- High-level `createTransaction()` (transactions.ts) opens its own `withTransactionAsync`, returns
  txId, **throws** on UNIQUE (caller catches `isUniqueConstraintError`), and **does NOT apply a
  balance delta** — the caller applies it separately. The email path is the reference hybrid.

**Recipe for every create path:** resolve account locally → enrich (destinatario/autoCategorize) →
insert (ledger or generic) → balance delta (skip when reconciling into an existing manual tx) →
sync enqueue is automatic → wrap all writes in ONE `withTransactionAsync` with a single frozen `now`.

## The 9 fixes (all verified against current `main`; none already fixed except P0-6 partial)

| id | title | file(s) | effort | migration |
|----|-------|---------|--------|-----------|
| P0-1 | `saveTransactionTags` omits `user_id` in sync payload → tags never sync (RLS NOT-NULL) | `tags.ts:68-97` | S | none |
| P0-2 | Manual capture (+OCR/PDF) drops balance delta on create → permanent drift | `transactions.ts:180-243`, `capture*.tsx`, `import.tsx`, `pending-email.ts`, `ledger-helpers.ts` | M | none |
| P0-3a | `updateTransaction` drops balance delta → edit saves stale balance | `transactions.ts:597-703` | S | none |
| P0-3b | `deleteTransaction` doesn't reverse balance delta | `transactions.ts:565-595` | S | none |
| P0-4 | Categorize drops `category_rules` learning + destinatario default-category backfill | `CategorizarRoot.tsx`, `transactions.ts`, `schema.ts`, `pull.ts` | M | **v19** (category_rules table) |
| P0-5a | PDF import never updates account balance | `import.tsx:798-851`, `ledger-helpers.ts` | M | none |
| P0-5b | PDF import skips `statement_snapshots` upsert (credit_limit/payment_day/history) | `import.tsx`, `statement-snapshots.ts`, `schema.ts` | M | **v19** (snapshot columns) |
| P0-6 | Idempotency key omits `installment_current`+`original_amount` → installment dups cross-platform | `transactions.ts:66-194`, `import.tsx` | S | none (cols exist) |
| P0-7 | create/import skip recurring occurrence auto-linking (app-wide) | `recurring.ts`, `capture*.tsx`, `pending-email.ts`, `import.tsx` | M | none |

### Migration v19 (single version bump, two concerns)
- `CREATE TABLE category_rules (id, user_id NOT NULL, pattern, category_id, match_count, created_at, updated_at, UNIQUE(user_id,pattern), FK category_id→categories)` + index. (P0-4)
- **P0-5b — VERIFIED 2026-06-29, plan corrected:** the mobile `statement_snapshots` table is a **vestigial mismatch** — it has `period`, `statement_date`, `statement_json` (a blob) which DO NOT exist on the Supabase view; the Supabase table has individual columns (`credit_limit`, `available_credit`, `payment_due_date`, `period_from/to`, `currency_code`, `previous_balance`, `final_balance`, `total_payment_due`, `minimum_payment`, `interest_rate`, `late_interest_rate`, `purchases_and_charges`, `interest_charged`, `loan_number`, `imported_count`, `transaction_count`, `skipped_count`, `source_filename`, …) and NO `statement_json`. So today's pull drops every meaningful column and a mobile-written row would fail to push. Fix = make the mobile table MIRROR the Supabase columns: `ALTER TABLE statement_snapshots ADD COLUMN` for each Supabase column, drop the `statement_json` entry from `JSON_FIELDS` (it has no remote counterpart), and write the Supabase-shaped row in the new repo. **Most involved fix; runs through a `mobile-sync-doctor` gate.**
- `pull.ts`: register `category_rules` in SYNC_TABLES; remove the stale `statement_snapshots: ["statement_json"]` from `JSON_FIELDS`. (`statement_snapshots`, `category_rules`, `recurring_occurrences` already in push.ts SyncTableName.)

## ⚠️ Double-apply traps (the reason this is inline, not parallel)
- **P0-2 × email import:** `pending-email.ts` ALREADY applies its own `applyLocalBalanceDelta` after
  `createTransaction`. Introducing `createTransactionAndApplyBalance` and migrating manual/OCR/PDF to
  it MUST also migrate pending-email to it AND remove its separate delta — else email imports
  double-count. Coordinate P0-2 across ALL create sites at once.
- **P0-2 × P0-7 share call sites** (capture.tsx, capture-screenshot, capture-voice, pending-email,
  import.tsx). Edit each site once for both, not twice.
- **P0-5a Tier-1 OVERWRITE** (bank-reported balance) is idempotent; never create an adjustment tx for
  it (would double-count). `reconcileBalance` uses overwrite, not delta — keep that distinction.
- **P0-3a/3b** guard on `is_excluded`: excluded txs never moved the balance on insert, so never
  delta on their edit/delete. Re-delete → snapshot null → no-op.

## Implementation order (minimizes re-touching the 2 hot files: transactions.ts, import.tsx)
1. **schema.ts v19 + pull.ts** registration (foundation for P0-4, P0-5b).
2. **ledger-helpers.ts**: add `createTransactionAndApplyBalance` (P0-2), `applyStatementMetaBalance` (P0-5a).
3. **transactions.ts** (one pass): `CreateTransactionParams` += installment/original_amount; idempotency fix (P0-6); extract `_insertTxBody`; `updateTransaction` delta (P0-3a) + category_rules learning (P0-4); `deleteTransaction` reversal (P0-3b).
4. **recurring.ts**: `findAndLinkLocalOccurrence` (P0-7).
5. **statement-snapshots.ts**: `upsertLocalStatementSnapshot` (P0-5b).
6. **create call sites** capture.tsx / capture-screenshot / capture-voice: switch to `createTransactionAndApplyBalance` + occurrence link (P0-2 + P0-7).
7. **pending-email.ts**: switch to `createTransactionAndApplyBalance`, REMOVE separate delta, add occurrence link (P0-2 + P0-7).
8. **import.tsx**: statement-meta balance (P0-5a) + snapshot upsert (P0-5b) + installment idempotency fields (P0-6) + occurrence link (P0-7).
9. **tags.ts**: add `user_id` to sync payload (P0-1).
10. **CategorizarRoot.tsx**: wire categorize → learning-enabled update (P0-4).

## Verification (Wave 1 exit gate)
- `cd mobile && npx tsc --noEmit` clean.
- GATES (review only): `mobile-sync-doctor` (payload/RLS/column drift), `mobile-webapp-parity` (side-effect fidelity vs webapp). Fix blocking findings inline.
- iOS simulator smoke: create a manual tx → balance moves; edit/delete → reverses; categorize → rule persists; PDF import → balance + snapshot land, re-import = no dup. Screenshots per check.
- Then PAUSE for review before Wave 2.

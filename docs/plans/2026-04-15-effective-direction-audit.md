# Plan: effectiveDirection Audit + Import Queue Cache Fix

## Context

The user pays their Lulo Bank loan from their Bancolombia savings account. The recurring template is modeled as INFLOW on the Lulo Préstamo (LOAN) account, but the email notification creates a transaction as OUTFLOW from Bancolombia Ahorros. These are the same real-world event viewed from two accounts, but the matching logic in `occurrences.ts` only matches `template.account_id == tx.account_id AND template.direction == tx.direction` — so they never auto-link, the "Vincular" button doesn't appear, and even manual linking would be rejected.

Separately, the import queue in `movimientos-herramientas.tsx` has redundant `router.refresh()` calls inside `startTransition()` — the same stale-cache pattern fixed in PR #145 for the recurring page.

## Key insight

Templates already store `transfer_source_account_id` (required for debt accounts since PR #146). This is the precise key for cross-account matching — no fuzzy description matching needed.

---

## Changes

### 1. Cache fix: Remove `router.refresh()` in import queue (trivial)

**File:** `webapp/src/components/mobile/v2/movimientos/movimientos-herramientas.tsx`

- Remove `router.refresh()` at lines 455, 467, 496
- Remove `const router = useRouter()` at line 438
- Remove `import { useRouter } from "next/navigation"` at line 4
- Server actions already call `revalidateTag()` inside `startTransition` — that propagates globally

### 2. Cross-account debt payment matching in `occurrences.ts`

All changes in **`webapp/src/actions/occurrences.ts`**. Import `isDebtAccountType` from `@/lib/utils/account-balance`.

#### 2a. `getAccountIdsWithPendingOccurrencesCached` (line 975) — Vincular visibility

Expand select to include `transfer_source_account_id`. Add those IDs to the returned set so the "Vincular" button appears on savings-account transactions that fund debt payments.

#### 2b. `getCandidateOccurrencesForTransaction` (line 893) — picker from tx side

Expand the template select (line 922-925) to include `transfer_source_account_id` and `account:accounts!...(account_type)`. Update the JS filter at line 935-937:
- Keep existing: `t.account_id === tx.account_id && t.direction === tx.direction`
- Add: `tx.direction === "OUTFLOW" && t.direction === "INFLOW" && t.transfer_source_account_id === tx.account_id && isDebtAccountType(t.account.account_type)`

#### 2c. `getCandidateTransactionsForOccurrence` (line 811) — picker from occurrence side

Expand occurrence select (line 824) to include `transfer_source_account_id` and account type. When template is a debt payment with `transfer_source_account_id`, use `.or()` filter:
```
.or(`and(account_id.eq.${template.account_id},direction.eq.INFLOW),and(account_id.eq.${transferSourceId},direction.eq.OUTFLOW)`)
```
to fetch candidates from both accounts in one query.

#### 2d. `linkExistingTransactionToOccurrence` (line 698) — validation

Expand select at line 712 to include `transfer_source_account_id` and account type. Replace strict check at line 737 with:
- Direct match: `tx.account_id === template.account_id && tx.direction === template.direction` → allow
- Cross-account debt: `isDebtAccountType(accountType) && template.direction === "INFLOW" && tx.direction === "OUTFLOW" && template.transfer_source_account_id === tx.account_id` → allow
- Else → reject

#### 2e. `findMatchingOccurrence` (line 633) — auto-linking

After the primary query returns no match, if `direction === "OUTFLOW"`, run a secondary query:
```
.eq("template.transfer_source_account_id", accountId)
.eq("template.direction", "INFLOW")
.eq("template.is_active", true)
```
with same date range/tolerance. Filter results client-side with `isDebtAccountType(account_type)`.

### 3. UI label fix in recurring form

**File:** `webapp/src/components/recurring/recurring-form.tsx`, line 163

Change `<SelectItem value="INFLOW">Ingreso</SelectItem>` to:
```tsx
<SelectItem value="INFLOW">{isDebtAccount ? "Abono a deuda" : "Ingreso"}</SelectItem>
```

---

## Implementation order

1. Change 1 (cache fix — independent, zero risk)
2. Change 2a (Vincular visibility)
3. Change 2b (candidate occurrences for tx)
4. Change 2c (candidate transactions for occurrence)
5. Change 2d (manual linking validation)
6. Change 2e (auto-linking — highest impact, after manual works)
7. Change 3 (UI label)
8. `pnpm build`

## Files modified

- `webapp/src/actions/occurrences.ts` — 5 functions
- `webapp/src/components/mobile/v2/movimientos/movimientos-herramientas.tsx` — remove router.refresh
- `webapp/src/components/recurring/recurring-form.tsx` — label fix

## Verification

1. `pnpm build` passes
2. Manual test: create an OUTFLOW transaction from a savings account matching a debt payment template amount/date → should auto-link
3. Manual test: "Vincular" button appears on savings-account OUTFLOW transactions when debt-payment occurrences are pending
4. Manual test: recurring form shows "Abono a deuda" instead of "Ingreso" for debt accounts
5. Manual test: approve/dismiss email in import queue → data refreshes without stale state

# Installment/Cuota Tracking Design

**Date:** 2026-02-23
**Status:** Approved
**Scope:** Extract, store, display, and link installment (cuota) data for credit card and loan transactions.

## Problem

PDF parsers already extract installment strings (e.g. "1/24", "4 de 6") for credit card transactions, but this data is silently dropped during import. It never reaches the database, is not shown in the UI, and cuotas of the same purchase are not linked. Loan cuota numbers are detected by a regex but never stored.

## Decision: Approach A — Flat Columns + Group ID

Add three nullable columns to `transactions`. Rejected alternatives:
- **JSONB column**: harder to query/index for simple int pairs, breaks flat column convention
- **Separate `installment_plans` table**: over-engineered for data that arrives piecemeal from monthly statements

## Database

### Migration

```sql
ALTER TABLE transactions
  ADD COLUMN installment_current SMALLINT,
  ADD COLUMN installment_total   SMALLINT,
  ADD COLUMN installment_group_id TEXT;

ALTER TABLE transactions
  ADD CONSTRAINT chk_installment_range
  CHECK (
    (installment_current IS NULL AND installment_total IS NULL)
    OR (installment_current > 0 AND installment_total > 0 AND installment_current <= installment_total)
  );

CREATE INDEX idx_transactions_installment_group
  ON transactions (installment_group_id, user_id)
  WHERE installment_group_id IS NOT NULL;
```

- `installment_current`: which cuota this is (e.g. 3)
- `installment_total`: total cuotas in the plan (e.g. 24)
- `installment_group_id`: deterministic hash linking all cuotas of the same purchase
- All nullable — non-installment transactions remain NULL

## Parser Normalization (Python)

### Model Change

Replace `ParsedTransaction.installments: str | None` with:
```python
installment_current: int | None = None
installment_total: int | None = None
```

### Per-Parser Changes

| Parser | Current | Change |
|---|---|---|
| bancolombia_credit_card | `"1/24"` string | Split on `/` → two ints |
| nu_credit_card | Regex groups → `"1/24"` | Assign capture groups directly to ints |
| falabella_credit_card | `"4 de 6"` string | Parse two numbers |
| popular_credit_card | `"12/18"` string | Split on `/` → two ints |
| bogota_credit_card | `"28/36 left"` string | Extract two numbers |
| bancolombia_loan | Dead `CUOTA_NUMERO_RE` | Wire up: set installment_current from regex, derive installment_total from loan term metadata when available |

### Loan Handling

For bancolombia_loan, the cuota number is statement-level. Apply it to the main payment transaction (direction=OUTFLOW matching the cuota amount). Derive installment_total from loan term in LoanMetadata if available.

## Import Flow (TypeScript)

### Type Updates

**`ParsedTransaction`** (import.ts): replace `installments: string | null` with `installment_current: number | null`, `installment_total: number | null`.

**`TransactionToImport`** (import.ts): add `installment_current: number | null`, `installment_total: number | null`, `installment_group_id: string | null`.

### Group ID Generation

In `buildPayload()`:
```
installment_group_id = SHA-256(account_id + "|" + normalizeDescription(description) + "|" + amount)
```
- Only generated when installment data is present
- Excludes installment_current so all cuotas share the same group
- Reuses existing `computeIdempotencyKey` pattern

### Idempotency Key Update

Include `installment_current` in the idempotency hash when present. This prevents cuota 1/24 and 2/24 from different months from colliding (same description, amount, date pattern).

### Validator Update

Add `installment_current`, `installment_total` (nullable z.number()), `installment_group_id` (nullable z.string()) to `transactionToImportSchema`.

### Import Action Update

Pass the 3 new fields through to the Supabase insert in `import-transactions.ts`.

## Frontend

### Import Review Table

Add a "Cuotas" column to the parsed transaction table in step-confirm.tsx. Display `"3/24"` when installment data is present, empty when null.

### Future (Not in Scope)

- Installment plan view (grouped timeline of all cuotas for a purchase)
- Installment progress indicators on transaction detail
- Filtering transactions by "has installments"

## Testing

- Parser unit tests: verify each parser produces correct `installment_current`/`installment_total` for known statement excerpts
- Import integration: verify installment fields survive the full pipeline (parse → review → insert → query)
- Idempotency: verify that cuota 1/24 and 2/24 of the same purchase get distinct idempotency keys
- Group ID: verify that cuotas of the same purchase share the same group ID across monthly imports

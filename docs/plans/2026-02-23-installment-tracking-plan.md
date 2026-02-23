# Installment/Cuota Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract, store, display, and link installment (cuota) data from credit card and loan PDF statements.

**Architecture:** Add `installment_current`, `installment_total`, and `installment_group_id` columns to the `transactions` table. Normalize all parser output from freeform strings to structured integers. Thread the data through the full import pipeline (parser → types → validator → buildPayload → server action → DB). Display cuotas in the import review table.

**Tech Stack:** Python/Pydantic (parser models), PostgreSQL (migration), TypeScript/Zod (validators), Next.js/React (UI), Web Crypto API (hashing).

**Design doc:** `docs/plans/2026-02-23-installment-tracking-design.md`

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/<timestamp>_add_installment_columns.sql`

**Step 1: Create the migration file**

Run: `npx supabase migration new add_installment_columns`

**Step 2: Write migration SQL**

Write to the generated file:

```sql
-- Add installment tracking columns to transactions
ALTER TABLE transactions
  ADD COLUMN installment_current SMALLINT,
  ADD COLUMN installment_total   SMALLINT,
  ADD COLUMN installment_group_id TEXT;

-- Ensure consistency: both current and total must be present together and valid
ALTER TABLE transactions
  ADD CONSTRAINT chk_installment_range
  CHECK (
    (installment_current IS NULL AND installment_total IS NULL)
    OR (installment_current > 0 AND installment_total > 0 AND installment_current <= installment_total)
  );

-- Partial index for efficient grouped queries (only rows with installments)
CREATE INDEX idx_transactions_installment_group
  ON transactions (installment_group_id, user_id)
  WHERE installment_group_id IS NOT NULL;
```

**Step 3: Push migration**

Run: `npx supabase db push`

**Step 4: Regenerate TypeScript types**

Run: `npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > webapp/src/types/database.ts`

Verify `export type Json =` header is intact (see CLAUDE.md gotcha about compdef warning stripping).

**Step 5: Commit**

```bash
git add supabase/migrations/ webapp/src/types/database.ts
git commit -m "feat: add installment columns to transactions table"
```

---

### Task 2: Python Parser Model — Replace String with Structured Fields

**Files:**
- Modify: `services/pdf_parser/models.py:28` (replace `installments` field)

**Step 1: Update ParsedTransaction model**

In `services/pdf_parser/models.py`, replace line 28:

```python
# OLD (line 28):
    installments: str | None = None  # e.g. "1/24"

# NEW:
    installment_current: int | None = None  # e.g. 3 (cuota 3 of 24)
    installment_total: int | None = None    # e.g. 24
```

**Step 2: Verify no other model references**

Search for `installments` in `models.py` — the only reference should be in `LoanMetadata.installments_in_default` (line 61), which is a different field and should NOT be changed.

**Step 3: Commit**

```bash
git add services/pdf_parser/models.py
git commit -m "refactor: replace ParsedTransaction.installments string with structured int fields"
```

---

### Task 3: Normalize Bancolombia Credit Card Parser

**Files:**
- Modify: `services/pdf_parser/parsers/bancolombia_credit_card.py:198-203,231`

**Step 1: Update installment extraction**

At lines 198-203, replace:

```python
# OLD:
    # Check for installments (e.g. "1/1", "1/24") after the amount
    rest = first_part[num_match.end() :].strip()
    installments = None
    inst_match = re.match(r"(\d+/\d+)", rest)
    if inst_match:
        installments = inst_match.group(1)

# NEW:
    # Check for installments (e.g. "1/1", "1/24") after the amount
    rest = first_part[num_match.end() :].strip()
    installment_current = None
    installment_total = None
    inst_match = re.match(r"(\d+)/(\d+)", rest)
    if inst_match:
        installment_current = int(inst_match.group(1))
        installment_total = int(inst_match.group(2))
```

**Step 2: Update the ParsedTransaction constructor call**

At the line where the transaction is built (~line 231), replace `installments=installments` with:

```python
    installment_current=installment_current,
    installment_total=installment_total,
```

**Step 3: Verify with test script**

Run: `cd services/pdf_parser && uv run python test_parser.py <path-to-bancolombia-cc-pdf> -v`

Check that installment fields appear correctly (e.g. `installment_current=1, installment_total=24`).

**Step 4: Commit**

```bash
git add services/pdf_parser/parsers/bancolombia_credit_card.py
git commit -m "feat: normalize Bancolombia CC installments to structured ints"
```

---

### Task 4: Normalize NU Credit Card Parser

**Files:**
- Modify: `services/pdf_parser/parsers/nu_credit_card.py:291-295,309`

**Step 1: Update installment extraction**

At lines 291-295, replace:

```python
# OLD:
        # Look for installments
        installments = None
        inst_match = INSTALLMENT_RE.search(desc_part)
        if inst_match:
            installments = f"{inst_match.group(1)}/{inst_match.group(2)}"

# NEW:
        # Look for installments (e.g. "1 de 24")
        installment_current = None
        installment_total = None
        inst_match = INSTALLMENT_RE.search(desc_part)
        if inst_match:
            installment_current = int(inst_match.group(1))
            installment_total = int(inst_match.group(2))
```

**Step 2: Update the ParsedTransaction constructor call**

At ~line 309, replace `installments=installments` with:

```python
    installment_current=installment_current,
    installment_total=installment_total,
```

**Step 3: Commit**

```bash
git add services/pdf_parser/parsers/nu_credit_card.py
git commit -m "feat: normalize NU CC installments to structured ints"
```

---

### Task 5: Normalize Falabella Credit Card Parser

**Files:**
- Modify: `services/pdf_parser/parsers/falabella_credit_card.py:220-224,251`

**Step 1: Update installment extraction**

At lines 220-224, replace:

```python
# OLD:
                        # Parse installments: "4 de 6" in rest
                        installments = None
                        inst_match = re.match(r"(\d+\s+de\s+\d+)", rest_str)
                        if inst_match:
                            installments = inst_match.group(1)

# NEW:
                        # Parse installments: "4 de 6" in rest
                        installment_current = None
                        installment_total = None
                        inst_match = re.match(r"(\d+)\s+de\s+(\d+)", rest_str)
                        if inst_match:
                            installment_current = int(inst_match.group(1))
                            installment_total = int(inst_match.group(2))
```

**Step 2: Update the ParsedTransaction constructor call**

At ~line 251, replace `installments=installments` with:

```python
    installment_current=installment_current,
    installment_total=installment_total,
```

**Step 3: Commit**

```bash
git add services/pdf_parser/parsers/falabella_credit_card.py
git commit -m "feat: normalize Falabella CC installments to structured ints"
```

---

### Task 6: Normalize Popular Credit Card Parser

**Files:**
- Modify: `services/pdf_parser/parsers/popular_credit_card.py:186-188,198`

**Step 1: Update installment extraction**

At lines 186-188, replace:

```python
# OLD:
                        installments = None
                        if term_total != "00":
                             installments = f"{term_current}/{term_total}"

# NEW:
                        installment_current = None
                        installment_total = None
                        if term_total != "00":
                            installment_current = int(term_current)
                            installment_total = int(term_total)
```

**Step 2: Update the ParsedTransaction constructor call**

At ~line 198, replace `installments=installments` with:

```python
    installment_current=installment_current,
    installment_total=installment_total,
```

**Step 3: Commit**

```bash
git add services/pdf_parser/parsers/popular_credit_card.py
git commit -m "feat: normalize Popular CC installments to structured ints"
```

---

### Task 7: Normalize Bogota Credit Card Parser

**Files:**
- Modify: `services/pdf_parser/parsers/bogota_credit_card.py:268-270,281`

**Step 1: Update installment extraction**

At lines 268-270, replace:

```python
# OLD:
                        installments = None
                        if term_str != "00" and rem_str != "00":
                            installments = f"{rem_str}/{term_str} left"

# NEW:
                        installment_current = None
                        installment_total = None
                        if term_str != "00" and rem_str != "00":
                            installment_current = int(rem_str)
                            installment_total = int(term_str)
```

**Step 2: Update the ParsedTransaction constructor call**

At ~line 281, replace `installments=installments` with:

```python
    installment_current=installment_current,
    installment_total=installment_total,
```

**Step 3: Commit**

```bash
git add services/pdf_parser/parsers/bogota_credit_card.py
git commit -m "feat: normalize Bogota CC installments to structured ints"
```

---

### Task 8: Wire Up Bancolombia Loan Cuota Extraction

**Files:**
- Modify: `services/pdf_parser/parsers/bancolombia_loan.py:58,92,184-191,202-226`

This is more involved because the loan parser currently produces zero transactions. We need to:
1. Extract the cuota number using the existing dead regex
2. Create a single OUTFLOW transaction representing the monthly payment

**Step 1: Add cuota number extraction**

Near the existing `CUOTAS_MORA_RE` extraction block (around line 184), add cuota number extraction. Add a new variable `cuota_numero = None` at the top of the function alongside the other variables (~line 80), then inside the line scanning loop add:

```python
                # Extract current cuota number (e.g. "CUOTA NÚMERO 15")
                if not cuota_numero:
                    m = CUOTA_NUMERO_RE.search(stripped)
                    if m:
                        cuota_numero = int(m.group(1))
```

**Step 2: Build a payment transaction when data is available**

After the line scanning loop ends (around line 191, before the period_to computation), add:

```python
    # Create a single transaction for the monthly payment if we have the data
    if total_payment_due and total_payment_due > 0 and payment_due_date:
        transactions.append(
            ParsedTransaction(
                date=payment_due_date,
                description=f"Pago cuota {loan_type or 'Crédito'} - {loan_number or ''}".strip(),
                amount=total_payment_due,
                direction=TransactionDirection.OUTFLOW,
                installment_current=cuota_numero,
                installment_total=None,  # Loan term not available in statement
            )
        )
```

Note: `installment_total` is `None` for loans because the total term is not reliably available in the statement. If it becomes available later, this can be updated.

**Step 3: Verify with test script**

Run: `cd services/pdf_parser && uv run python test_parser.py <path-to-bancolombia-loan-pdf> -v`

Check that a transaction now appears with `installment_current` set to the cuota number.

**Step 4: Commit**

```bash
git add services/pdf_parser/parsers/bancolombia_loan.py
git commit -m "feat: extract loan cuota number and create payment transaction"
```

---

### Task 9: Update test_parser.py Debug Output

**Files:**
- Modify: `services/pdf_parser/test_parser.py:165` (update `show_transaction_debug`)

**Step 1: Update the transaction debug display**

Find the line that prints `tx.installments` (~line 165) and update it to show the new structured fields:

```python
# OLD:
    if tx.installments:
        print(f"    Installments: {tx.installments}")

# NEW:
    if tx.installment_current is not None:
        total_str = f"/{tx.installment_total}" if tx.installment_total else ""
        print(f"    Installment: {tx.installment_current}{total_str}")
```

**Step 2: Commit**

```bash
git add services/pdf_parser/test_parser.py
git commit -m "chore: update test_parser debug output for structured installment fields"
```

---

### Task 10: TypeScript Types Update

**Files:**
- Modify: `webapp/src/types/import.ts:3-12` (ParsedTransaction)
- Modify: `webapp/src/types/import.ts:73-83` (TransactionToImport)

**Step 1: Update ParsedTransaction type**

At line 11, replace:

```typescript
// OLD:
  installments: string | null; // e.g. "1/24"

// NEW:
  installment_current: number | null;
  installment_total: number | null;
```

**Step 2: Update TransactionToImport type**

At lines 73-83, add 3 new fields at the end of the type (before the closing `}`):

```typescript
  installment_current?: number | null;
  installment_total?: number | null;
  installment_group_id?: string | null;
```

**Step 3: Commit**

```bash
git add webapp/src/types/import.ts
git commit -m "feat: add installment fields to TypeScript import types"
```

---

### Task 11: Add Installment Group ID Utility

**Files:**
- Modify: `webapp/src/lib/utils/idempotency.ts` (add `computeInstallmentGroupId`)

**Step 1: Add the group ID function**

Append to the existing `idempotency.ts` file:

```typescript
export async function computeInstallmentGroupId(params: {
  accountId: string;
  rawDescription: string;
  amount: number;
}): Promise<string> {
  const payload = [
    params.accountId,
    params.rawDescription.trim().toUpperCase(),
    params.amount.toFixed(2),
  ].join("|");

  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "ig_" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

The `ig_` prefix makes group IDs visually distinguishable from idempotency keys.

**Step 2: Update computeIdempotencyKey to accept installment_current**

Modify the existing function to include installment data in the hash when present:

```typescript
export async function computeIdempotencyKey(params: {
  provider: string;
  providerTransactionId?: string;
  transactionDate: string;
  amount: number;
  rawDescription?: string;
  installmentCurrent?: number | null;
}): Promise<string> {
  const payload = [
    params.provider,
    params.providerTransactionId ?? "",
    params.transactionDate,
    params.amount.toFixed(2),
    params.rawDescription ?? "",
    params.installmentCurrent != null ? String(params.installmentCurrent) : "",
  ].join("|");

  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

**Step 3: Commit**

```bash
git add webapp/src/lib/utils/idempotency.ts
git commit -m "feat: add installment group ID utility and include installment in idempotency key"
```

---

### Task 12: Update Zod Validator

**Files:**
- Modify: `webapp/src/lib/validators/import.ts:7-20`

**Step 1: Add installment fields to schema**

Add 3 fields to `transactionToImportSchema` (after `categorization_confidence`):

```typescript
  installment_current: z.number().int().positive().optional().nullable(),
  installment_total: z.number().int().positive().optional().nullable(),
  installment_group_id: z.string().optional().nullable(),
```

**Step 2: Commit**

```bash
git add webapp/src/lib/validators/import.ts
git commit -m "feat: add installment fields to import validator schema"
```

---

### Task 13: Update buildPayload in step-confirm.tsx

**Files:**
- Modify: `webapp/src/components/import/step-confirm.tsx:128-158`

**Step 1: Import the group ID utility**

Add import at the top of the file:

```typescript
import { computeInstallmentGroupId } from "@/lib/utils/idempotency";
```

**Step 2: Make buildPayload async and add installment fields**

The function needs to become async because `computeInstallmentGroupId` uses `crypto.subtle.digest`. Update the function:

```typescript
  async function buildPayload(): Promise<TransactionToImport[]> {
    const txs: TransactionToImport[] = [];
    for (const [stmtIdx, stmt] of parseResult.statements.entries()) {
      const mapping = mappings.find((m) => m.statementIndex === stmtIdx);
      if (!mapping) continue;
      const sel = selections.get(stmtIdx) ?? new Set();
      for (const txIdx of sel) {
        const tx = stmt.transactions[txIdx];
        const categoryId = getCategoryForTx(stmtIdx, txIdx);
        const autoResult = autoCategorize(tx.description);
        const wasAutoAssigned = autoResult?.category_id === categoryId;

        let installmentGroupId: string | null = null;
        if (tx.installment_current != null && tx.installment_total != null) {
          installmentGroupId = await computeInstallmentGroupId({
            accountId: mapping.accountId,
            rawDescription: tx.description,
            amount: tx.amount,
          });
        }

        txs.push({
          account_id: mapping.accountId,
          amount: tx.amount,
          currency_code: stmt.currency,
          direction: tx.direction,
          transaction_date: tx.date,
          raw_description: tx.description,
          category_id: categoryId,
          categorization_source: categoryId
            ? wasAutoAssigned
              ? "SYSTEM_DEFAULT"
              : "USER_OVERRIDE"
            : undefined,
          categorization_confidence: categoryId && wasAutoAssigned ? 0.7 : null,
          installment_current: tx.installment_current,
          installment_total: tx.installment_total,
          installment_group_id: installmentGroupId,
        });
      }
    }
    return txs;
  }
```

**Step 3: Update all callers of buildPayload to await it**

Search for `buildPayload()` calls in the same file and add `await` where needed.

**Step 4: Commit**

```bash
git add webapp/src/components/import/step-confirm.tsx
git commit -m "feat: thread installment data through buildPayload with group ID generation"
```

---

### Task 14: Update Import Server Action

**Files:**
- Modify: `webapp/src/actions/import-transactions.ts:42-64`

**Step 1: Pass installmentCurrent to idempotency key computation**

At lines 42-47, add the installment parameter:

```typescript
    const idempotencyKey = await computeIdempotencyKey({
      provider: "OCR",
      transactionDate: tx.transaction_date,
      amount: tx.amount,
      rawDescription: tx.raw_description,
      installmentCurrent: tx.installment_current,
    });
```

**Step 2: Add installment fields to the Supabase insert**

At lines 49-64, add 3 fields to the insert object:

```typescript
      installment_current: tx.installment_current ?? null,
      installment_total: tx.installment_total ?? null,
      installment_group_id: tx.installment_group_id ?? null,
```

**Step 3: Commit**

```bash
git add webapp/src/actions/import-transactions.ts
git commit -m "feat: persist installment data to database during import"
```

---

### Task 15: Add Cuotas Column to Import Review Table

**Files:**
- Modify: `webapp/src/components/import/parsed-transaction-table.tsx:47-62` (header)
- Modify: Same file, table body rows (add cell)

**Step 1: Add "Cuotas" table header**

After the "Tipo" `<TableHead>` (line 59), add:

```tsx
            <TableHead>Cuotas</TableHead>
```

**Step 2: Add cuotas cell in the table body row**

In the table body, after the "Tipo" badge cell and before the "Monto" cell, add:

```tsx
              <TableCell className="text-sm text-muted-foreground">
                {tx.installment_current != null && tx.installment_total != null
                  ? `${tx.installment_current}/${tx.installment_total}`
                  : tx.installment_current != null
                    ? `${tx.installment_current}/?`
                    : null}
              </TableCell>
```

The `X/?` fallback handles loan cuotas where total is unknown.

**Step 3: Commit**

```bash
git add webapp/src/components/import/parsed-transaction-table.tsx
git commit -m "feat: display cuotas column in import review table"
```

---

### Task 16: Build Verification and Type Check

**Step 1: Run TypeScript build**

Run: `cd webapp && pnpm build`

Fix any type errors that arise from the `installments` → `installment_current`/`installment_total` rename. Search for any remaining references to the old `installments` field:

Run (grep): Search for `\.installments` in `webapp/src/` excluding `node_modules`

**Step 2: Verify Python parser starts**

Run: `cd services/pdf_parser && uv run python -c "from models import ParsedTransaction; print('OK')"`

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve type errors from installment field migration"
```

---

### Task 17: End-to-End Smoke Test

**Step 1: Start both services**

Run: `cd services/pdf_parser && uv run python main.py` (background)
Run: `cd webapp && pnpm dev`

**Step 2: Test with a real PDF**

Upload a Bancolombia credit card PDF through the import wizard. Verify:
- Parser returns `installment_current` and `installment_total` as integers (check Network tab)
- "Cuotas" column appears in the review table showing e.g. "1/24"
- After import, check the database: `SELECT installment_current, installment_total, installment_group_id FROM transactions WHERE installment_group_id IS NOT NULL LIMIT 5;`

**Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during smoke test"
```

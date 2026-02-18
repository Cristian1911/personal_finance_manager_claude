# HANDOVER

## 1. Session Summary

This session implemented two new PDF parsers (Nu Colombia credit card, Lulo Bank loan), completed the full frontend import flow for loan statements, added a database migration for loan-specific snapshot columns, and wired loan metadata through the entire import pipeline (summary card, auto-match, account creation defaults, snapshot storage, account updates, diff tracking, statement history timeline). All changes compile successfully but are **uncommitted**.

## 2. Changes Made

### New PDF Parsers (Python)

- **`services/pdf_parser/parsers/nu_credit_card.py`** — Replaced stub with full implementation. Parses Nu Colombia credit card statements: card info, credit metadata, summary, and transactions from tabular layout. Colombian number format via `parse_co_number()`.
- **`services/pdf_parser/parsers/lulo_loan.py`** — Created. Lulo Bank loan parser: extracts loan metadata (number, balance, rate, payment due) and past payment history as OUTFLOW transactions.
- **`services/pdf_parser/parsers/lulo_savings.py`** — Deleted. Replaced by `lulo_loan.py` since the actual PDF is a loan, not savings.
- **`services/pdf_parser/parsers/__init__.py`** — Updated imports (`lulo_savings` → `lulo_loan`), added `"NU FINANCIERA"` detection keyword.

### Database Migration

- **`supabase/migrations/20260218002245_add_loan_columns_to_snapshots.sql`** — Created. Adds `remaining_balance`, `initial_amount`, `installments_in_default`, `loan_number` columns to `statement_snapshots`. **Already pushed to remote.**
- **`webapp/src/types/database.ts`** — Regenerated from Supabase to include new columns.

### Frontend: Loan Import Flow

- **`webapp/src/lib/validators/import.ts`** — Added `loanMetadataSchema` Zod schema and `loanMetadata` field to `statementMetaSchema`.
- **`webapp/src/components/import/statement-summary-card.tsx`** — Added `loan: "Préstamo"` label and loan metadata display section (loan number, balance, rate, payment due, installments in default).
- **`webapp/src/components/import/import-wizard.tsx`** — Added loan auto-match logic: matches on `account_number` last 4 + `account_type === "LOAN"`.
- **`webapp/src/components/import/create-account-dialog.tsx`** — Added loan branch in `deriveDefaults()`: sets LOAN type, pre-fills balance, loan_amount, interest_rate, payment_day.
- **`webapp/src/components/import/step-confirm.tsx`** — Added `loanMetadata` to `buildStatementMeta()` payload.
- **`webapp/src/actions/import-transactions.ts`** — Snapshot row includes loan columns. Currency balance entry handles loan metadata. Account scalar updates (current_balance, interest_rate, payment_day) work for loans.
- **`webapp/src/lib/utils/snapshot-diff.ts`** — Added tracked fields: `remaining_balance` ("Saldo capital"), `initial_amount` ("Monto inicial"), `installments_in_default` ("Cuotas en mora").
- **`webapp/src/components/accounts/statement-history-timeline.tsx`** — Added MetricRow for "Saldo capital" and inline display for "Cuotas en mora" with color coding.

## 3. Key Decisions

- **Lulo stub renamed** `lulo_savings.py` → `lulo_loan.py` — actual PDF is "Extracto Crédito de Consumo". User approved.
- **Lulo payment history imported as transactions** — each past payment becomes an OUTFLOW transaction. User chose this over metadata-only.
- **New DB columns for loans** — `remaining_balance`, `initial_amount`, `installments_in_default`, `loan_number` are loan-specific. User approved adding columns vs reusing credit card columns.
- **Shared snapshot columns reused** — `interest_rate`, `total_payment_due`, `minimum_payment`, `payment_due_date` already existed and are populated from loan metadata via `??` fallback chain.
- **Nu parser handles multi-line table reconstruction** — PDF extraction splits table rows across multiple lines; parser rebuilds them.
- **Number format varies by bank** — Bancolombia savings/loans use US format (1,234.56), Bancolombia credit cards + Nu + Lulo use Colombian (1.234,56).

## 4. Current State

- **Build**: `pnpm build` passes with 0 errors
- **Git branch**: `main`, ahead of origin by 1 commit (`ccae682` — BC loan parser from prior session)
- **Uncommitted changes**: 12 modified/deleted + 2 new files (all this session's work)
- **DB migration**: Already pushed to remote Supabase
- **Parsers**: Tested standalone during development by pdf-parser-creator agents, not tested via running service + curl

## 5. Open Issues & Gotchas

- **Parsers not tested via running service** — Should run `cd services/pdf_parser && uv run python main.py` and test both new PDFs with `curl -F file=@... http://localhost:8000/parse`.
- **Lulo Bank detection is broad** — `__init__.py:37` checks for `"LULO"` in uppercase text. If Lulo Bank issues savings statements in the future, detection needs sub-type routing.
- **`StatementSnapshot` type in `statement-snapshots.ts`** — The action's return type may not include the new loan columns (`remaining_balance`, `installments_in_default`). The timeline component references `snap.remaining_balance` and `snap.installments_in_default` — verify the action's select query and type export include them.
- **`installments_in_default` display** — Uses inline rendering in timeline, not `MetricRow`, because `MetricRow` always formats with `formatCurrency()`. If more non-currency metrics are needed, consider a formatter prop on `MetricRow`.
- **BC loan parser uses US number format** while Lulo loan parser uses Colombian format — be aware of inconsistency when adding future loan parsers.

## 6. Suggested Next Steps

1. **Test parsers end-to-end**: `curl -F file=@bank_pdf_examples/nu_bank/nu_credit_card.pdf http://localhost:8000/parse` and same for Lulo loan.
2. **Verify `StatementSnapshot` type** in `webapp/src/actions/statement-snapshots.ts` includes new loan columns. Update select query if needed.
3. **Commit all changes** — stage everything and create a commit.
4. **Manual UI test** — Upload Nu credit card and Lulo loan PDFs through import wizard. Verify metadata display, auto-match, account defaults, transaction import, snapshot diffs.
5. **Check statement history timeline** — Import a loan statement, check account detail page for remaining_balance and installments_in_default rendering.
6. **Push to remote** — `git push`.

## 7. Context for Claude

- **PDF samples**: `bank_pdf_examples/nu_bank/nu_credit_card.pdf` and `bank_pdf_examples/lulo_bank/lulo_bank_loan.pdf`.
- **Parser utils**: `services/pdf_parser/parsers/utils.py` has `parse_co_number()`, `parse_us_number()`, `SPANISH_MONTHS`, `resolve_year()`.
- **Plan file**: `.claude/plans/curious-painting-pixel.md` contains the approved implementation plan.
- **DB migration already applied**: `20260218002245` pushed to remote. Don't re-run `supabase db push` unless there are new migrations.
- **Prior commit** `ccae682` added the Bancolombia loan parser — that parser was created in a session before this one.

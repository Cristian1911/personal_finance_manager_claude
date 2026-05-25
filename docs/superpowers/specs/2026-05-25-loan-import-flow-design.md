# Loan Import Flow — Design

**Date:** 2026-05-25
**Status:** Approved (design forks confirmed with user)

## Problem

Two issues with importing loan (préstamo) PDF statements:

1. **Wrong UX.** Loan statements run through the credit-card import wizard, which is
   transaction-centric (select movimientos → assign destinatarios → categorize →
   reconcile duplicates). But a loan statement is **metadata-only**: remaining
   balance, payment due, interest rate, installments in default, etc. It carries
   **zero line-item transactions**. The result is an awkward flow showing "0 de 0
   seleccionadas", "Continuar · 0 movimientos", an empty Reconciliar step, and a
   results screen reporting "0 movimientos importados".

2. **Queue never clears.** When a loan is imported from the email-delivered
   pending-statements queue, the row stays in the queue. Root cause: the queue-clear
   gate in `import-wizard.tsx` (`handleImportComplete`) requires
   `imported > 0 || skipped > 0`. Loan imports produce `imported=0, skipped=0`
   (only account metadata + snapshot + recurring template are written), so the gate
   never fires.

## Reframe — not a parallel wizard

The existing `ImportWizard` already does ~80% of the loan work:
- `autoMatchAccounts` (import-wizard.tsx:156-161) auto-matches `statement_type === "loan"`
  to LOAN accounts.
- `StepReview` branches `isLoan` (step-review.tsx:416, 628) and renders
  `StatementSummaryCard` instead of `CreditCardSummary`.
- `importTransactions` / `processStatementMeta` already write loan snapshots, update
  the loan account (balance, rate, payment day, monthly payment), and call
  `syncLoanRecurringTemplate`.

What's missing is a **loan-tailored set of step components mounted by the same wizard
shell** when the upload is all-loans. We reuse `StepUpload`, the account-mapping
controls, the `importTransactions` call, and the email-statement-id wiring untouched.
This is explicitly **not** a duplicate `StepUpload` / parallel route.

## Decided design forks (confirmed with user)

| Fork | Decision |
|------|----------|
| Trigger | **Auto-detect & branch** — same upload step; when parsed statements are all loans, the wizard mounts the loan path. No separate entry point. |
| Flow shape | **Lean** — Subir → Confirmar → Listo. Drop movimientos selection, destinatarios, categorization, and the Reconciliar step. |
| Payment record | **Metadata only** — no transaction created. Update loan account + snapshot + recurring template (today's side-effects). |
| Insights depth | **One-month diff** — show this statement vs the previous one using `accountUpdates.diffs` that already exist. No new queries. |

## Branch rule

Loan path activates **only when every parsed statement is a loan**
(`parseResult.statements.every((s) => s.statement_type === "loan")`).

Mixed PDFs (loan + credit card in one upload) fall back to the existing standard flow,
which already renders `StatementSummaryCard` next to `CreditCardSummary`. This avoids
the complexity of a hybrid wizard and matches the real-world case (loans almost always
arrive as their own PDF).

## Components

### 1. `ImportWizard` (modify) — `webapp/src/components/import/import-wizard.tsx`

- Compute `isLoanOnly` from the parse result.
- When `isLoanOnly`, drive a 3-step sequence (`upload → review → results`), skipping
  the `reconcile` step entirely.
- Render `LoanStepReview` instead of `StepReview`, and `LoanStepResults` instead of
  `StepResults`, when `isLoanOnly`.
- The progress nav adapts: 3 pills/cards for the loan path (Subir, Confirmar, Listo)
  vs 4 for the standard path.
- `useHideTabBar(step !== "upload")` and the email-id wiring are unchanged.

### 2. `LoanStepReview` (new) — `webapp/src/components/import/loan-step-review.tsx`

- For each loan statement: an `AccountAssignControl` (map to LOAN account or create
  one via the existing `CreateAccountDialog`) + a read-only figures card built from
  `loan_metadata` (saldo capital, cuota / total a pagar, vencimiento, tasa, cuotas en
  mora, monto inicial). Reuse / extend `StatementSummaryCard`.
- No transaction table, no destinatario dialog, no selections state.
- On continue: build `statementMeta` only (transactions = `[]`), then call
  `importTransactions` directly (no `previewImportReconciliation`). Reuse the
  `buildStatementMeta` logic shape from `StepReview`.
- `WizardActionBar`: "Volver" / "Aplicar extracto" (no "· N movimientos" count).

### 3. `LoanStepResults` (new) — `webapp/src/components/import/loan-step-results.tsx`

- Hero headline driven by the saldo-capital diff: e.g. "Saldo capital bajó $600k"
  (decrease = good = `text-z-income`). First import → current saldo + "Primer extracto".
- Promote `accountUpdates[].diffs` (today buried at step-results.tsx:216-254) to the
  top, formatted with the existing `DiffRow` (extract it to a shared spot or import).
  Loan-relevant fields already tracked by `computeSnapshotDiffs`: Saldo capital, Monto
  inicial, Cuotas en mora, Tasa de interés, Total a pagar, Pago mínimo.
- Email-statement dismiss/clear wiring preserved (same as `StepResults`).
- `WizardActionBar`: "Importar otro" / link to the loan/debt detail page.

### 4. Queue-clear gate fix (independent) — `import-wizard.tsx:203`

```ts
if (emailId && result.errors === 0 &&
    (result.imported > 0 || result.skipped > 0 || (result.accountUpdates?.length ?? 0) > 0)) {
```

Covers metadata-only success (loans today, savings-with-no-new-tx later). This is a
standalone one-line change that can ship even if the redesign slips.

## Data flow (loan path)

```
StepUpload (shared) ──onParsed──▶ ImportWizard detects isLoanOnly
   └─▶ LoanStepReview: map LOAN account, review loan_metadata
         └─continue─▶ importTransactions({ transactions: [], statementMeta: [...], captureMethod })
               └─ processStatementMeta: upsert snapshot, update account, sync recurring template,
                  returns accountUpdates[].diffs (prev snapshot vs this one)
         └─▶ LoanStepResults: hero diff + DiffRow list + clear email queue row
```

No server-action changes required — `importTransactions` already handles
`transactions: []` + loan `statementMeta` correctly.

## Out of scope

- Recording the loan payment as a transaction from a funding account.
- Multi-month balance-paydown trend chart (one-month diff only, per decision).
- Mixed loan + CC single-PDF special handling (falls back to standard flow).

## Verification

- `pnpm build` green (baseline confirmed green before work).
- Manual: import a loan PDF (and a loan from the email queue) → confirm the lean
  3-step flow, the evolution diff on Listo, and that the queue row disappears.
- Manual: import a credit-card PDF → confirm the standard 4-step flow is unchanged.
- Manual: import a mixed PDF → confirm fallback to standard flow.
- Review gates: `import-flow-doctor`, `zetas-front-guy`, `server-action-reviewer`
  (gate fix touches import path), `perf-auditor`.

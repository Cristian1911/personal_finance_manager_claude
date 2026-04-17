# Design — "Hacer recurrente" CTA + Remove `is_subscription`

**Date:** 2026-04-17
**Status:** Approved
**Related backlog items:** "Hacer recurrente", "`is_subscription` toggle — connect or remove"

## Problem

Two related gaps surfaced in the Phase 1 PR session (2026-04-16):

1. When a bill (rent, utility, SaaS) first shows up via manual entry, PDF, or email import, there is no way to promote it to a `recurring_templates` row without rebuilding it from scratch at `/recurrentes/new`. The app has every field the user would retype — merchant, amount, account, category, destinatario, date. Yet it asks the user to retype them anyway.
2. A "Marcar como suscripción" Switch exists in three transaction forms (`transaction-form.tsx`, `mobile-transaction-form.tsx`, `voice-capture-sheet.tsx`) and writes `is_subscription: boolean` to the row. Zero code reads that field. The flag is inert — feature disappointment. The actually meaningful flag (`is_recurring`) is only set by the recurring-template occurrence system.

## Decisions

### D1 — "Hacer recurrente" CTA on `/transactions/[id]`
Add a button to `PageHero.actions` next to `DeleteTransactionButton`. Click opens `RecurringFormDialog` pre-filled with the source transaction's data. Submit creates a `recurring_templates` row **and** links the source transaction to the newly-generated current-period occurrence via `findMatchingOccurrence()`.

### D2 — Remove `is_subscription` toggle from forms
Delete the Switch block from `transaction-form.tsx`, `mobile-transaction-form.tsx`, and `voice-capture-sheet.tsx`. Drop the field from the validator and from `createTransaction` param shape. API routes that always wrote `false` (capture, mcp, email-ingest, telegram) drop the property.

The `transactions.is_subscription` DB column stays nullable for now; dropping it is a follow-up migration (nullable deprecation first). Existing `true` rows are untouched — nothing reads them today, and nothing will read them after this PR either.

### D3 — Subscription tracking pattern = tag + destinatario auto-tag
No new schema. Subscription summaries rely on the existing tag system plus the destinatario auto-tag shipped in PR #138:

1. User adds a "Suscripción" tag (built-in if not already, otherwise seeded on first use).
2. User tags the Netflix/Spotify/etc. destinatario with "Suscripción".
3. All future import matches and manual entries against that destinatario get the tag applied.
4. Any dashboard "subscription spend" widget filters transactions by that tag.

Template-level tagging (i.e., adding a tag directly to `recurring_templates`) is explicitly out of scope — it is already listed in the backlog as a separate follow-up ("Tag system broader reach").

### D4 — CTA hidden when already linked
If `tx.recurring_occurrence_id` is not null, the button is replaced by a muted, non-interactive badge: `Ya es recurrente`. This prevents a user from creating two templates from the same tx and keeps the UI truthful.

### D5 — Frequency default = `MONTHLY`
First-cut default. No attempt at auto-detecting frequency from historical same-merchant tx — that is a low-value heuristic for the 80% case (bills are monthly) and adds complexity.

### D6 — Debt-account edge
When the source transaction's account is a `CREDIT_CARD` or `LOAN`, the existing server-side validation in `createRecurringTemplate` kicks in: requires `transfer_source_account_id`, rejects same-account transfer, forces `direction = INFLOW`. The prefill leaves `transfer_source_account_id` empty; the user must pick it. No special UI copy needed.

### D7 — CTA only on tx detail, not list rows (yet)
The backlog mentions list-row 3-dot menu as "ideally". Keep it scoped to the detail page in this PR. List-row placement is a follow-up once the detail-page version is validated.

## Components

### New server action
`webapp/src/actions/recurring-templates.ts` →

```ts
export async function createRecurringTemplateFromTransaction(
  transactionId: string,
  _prevState: ActionResult<RecurringTemplate>,
  formData: FormData,
): Promise<ActionResult<RecurringTemplate>>;
```

Body:
1. Same auth + `recurringTemplateSchema.safeParse` + debt-account validation as `createRecurringTemplate`.
2. Load the source transaction (`.eq("id", transactionId).eq("user_id", user.id)`). If missing → `{ success: false, error: "Transacción no encontrada" }`.
3. If `tx.recurring_occurrence_id` already set → `{ success: false, error: "Esta transacción ya está vinculada a una recurrente." }`.
4. Insert template (same logic as `createRecurringTemplate`).
5. Call `ensureCurrentOccurrences()` — generates pending occurrences from the new template.
6. Call `linkTransactionToOccurrence(tx.account_id, tx.transaction_date, tx.amount, tx.direction, tx.id)` — this wraps `findMatchingOccurrence` + `markOccurrencePaid`, which writes both `transactions.recurring_occurrence_id` and updates the occurrence's `status = "paid"` + `transaction_id`.
7. `updateTag("recurring" | "occurrences" | "dashboard:hero" | "attention" | "transactions")`.
8. Return the template.

### New client component
`webapp/src/components/transactions/promote-to-recurring-button.tsx` —

Props:
```ts
{
  transaction: TransactionWithAccount;   // needs id, direction, account_id, amount, currency_code, merchant_name, clean_description, category_id, transaction_date, recurring_occurrence_id
  accounts: Account[];
  categories: CategoryWithChildren[];
}
```

Render:
- If `transaction.recurring_occurrence_id`: render a muted `<Badge variant="secondary">Ya es recurrente</Badge>`.
- Else: render a Button (`variant="outline"`, icon `CalendarClock` from lucide) that toggles local `open` state. Inside, render `<RecurringFormDialog controlledOpen={open} onClose={() => setOpen(false)} initialValues={prefill(transaction)} actionOverride={createRecurringTemplateFromTransaction.bind(null, transaction.id)} accounts={accounts} categories={categories} />`.

### Extensions to existing components

**`RecurringFormDialog`** (`webapp/src/components/recurring/recurring-form-dialog.tsx`):
Add two optional props:
- `initialValues?: Partial<RecurringTemplate>` — passed through to `<RecurringForm>`.
- `actionOverride?: (prev, formData) => Promise<ActionResult<RecurringTemplate>>` — passed through to `<RecurringForm>`.

**`RecurringForm`** (`webapp/src/components/recurring/recurring-form.tsx`):
Accept the same two props. Behavior:
- When `template` is given, keep current behavior (edit mode with `updateRecurringTemplate`).
- When `template` is absent but `initialValues` is given, seed every `useState` from `initialValues` instead of from empty defaults.
- When `actionOverride` is given, `action = actionOverride` instead of `createRecurringTemplate`.

### Prefill shape
```ts
function prefillFromTransaction(tx: TransactionWithAccount): Partial<RecurringTemplate> {
  const txDate = new Date(tx.transaction_date + "T12:00:00");
  return {
    account_id: tx.account_id,
    amount: tx.amount,
    currency_code: tx.currency_code,
    direction: tx.direction,
    merchant_name: tx.merchant_name ?? tx.clean_description ?? "",
    description: tx.clean_description && tx.clean_description !== tx.merchant_name ? tx.clean_description : null,
    category_id: tx.category_id,
    frequency: "MONTHLY",
    start_date: tx.transaction_date,
    day_of_month: txDate.getDate(),
    day_of_week: null,
    end_date: null,
    transfer_source_account_id: null,  // user picks for debt accounts
    sub_payments: null,
  };
}
```

## Files touched

**Added:**
- `webapp/src/components/transactions/promote-to-recurring-button.tsx`
- `webapp/src/actions/__tests__/create-recurring-from-transaction.test.ts` (unit tests for the new action's link-back and debt-account edge)

**Modified:**
- `webapp/src/actions/recurring-templates.ts` — add `createRecurringTemplateFromTransaction`
- `webapp/src/components/recurring/recurring-form-dialog.tsx` — add `initialValues` + `actionOverride` passthrough
- `webapp/src/components/recurring/recurring-form.tsx` — accept and honor `initialValues` + `actionOverride`
- `webapp/src/app/(dashboard)/transactions/[id]/page.tsx` — mount the CTA in `PageHero.actions`
- `webapp/src/actions/transactions.ts` — drop `is_subscription` from `CreateTransactionParams`, insert payload, and the 3 `formData.get` sites (lines 656, 740, 799)
- `webapp/src/lib/validators/transaction.ts` — drop `is_subscription: formBoolean`
- `webapp/src/components/transactions/transaction-form.tsx` — delete Switch block + state (lines 101, 230, 303-311)
- `webapp/src/components/mobile/mobile-transaction-form.tsx` — same (lines 222, 328-336)
- `webapp/src/components/mobile/voice-capture-sheet.tsx` — drop `formData.set("is_subscription", "false")` (line 244)
- `webapp/src/app/api/capture/route.ts` — drop any `is_subscription` write
- `webapp/src/app/api/mcp/transactions/route.ts` — same
- `webapp/src/app/api/webhooks/email-ingest/route.ts` — same
- `webapp/src/app/api/webhooks/telegram/route.ts` — same
- `webapp/src/actions/email-ingest.ts` — same

## Testing

### Unit (Vitest)
- `createRecurringTemplateFromTransaction` — happy path asserts the source tx's `recurring_occurrence_id` gets patched and the matched occurrence's `status` transitions to `paid`.
- Debt account without `transfer_source_account_id` → validation error; no insert happens.
- Already-linked tx (has `recurring_occurrence_id`) → rejects before insert.

### Manual
- Tx detail page → click "Hacer recurrente" → dialog opens prefilled → save → verify `/recurrentes` lists the new template, `/dashboard` hero reflects an added pending occurrence, and the source tx detail now shows "Ya es recurrente".
- Tx form (web + mobile) no longer shows Switch.
- Voice capture still submits without 400.
- `is_subscription=true` legacy row in DB still renders its tx detail page without error.

### Build gates
- `pnpm build` clean.
- `pnpm vitest run` green (new tests + no regressions).

## Success criteria

- ✅ Button visible on `/transactions/[id]` for any tx without a linked occurrence.
- ✅ Pre-filled dialog saves a template and links the source tx to the current occurrence.
- ✅ `is_subscription` Switch gone from all three forms.
- ✅ No runtime errors from routes that used to write `is_subscription: false`.
- ✅ `pnpm build` passes.
- ✅ No migrations.

## Out of scope

- List-row 3-dot menu CTA (follow-up).
- Dashboard "subscription spend" widget (D3 enables it with zero schema work; designing the widget itself is a separate spec).
- Dropping the `transactions.is_subscription` column (follow-up migration after this PR has been in prod a few days).
- Template-level tag column / `recurring_template_tags` table.
- Auto-detecting frequency from historical same-merchant transactions.

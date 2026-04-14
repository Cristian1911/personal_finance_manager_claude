# Manual Transaction-to-Recurring Linking

> Allow users to manually link any existing transaction to a pending recurring occurrence, from either side.

## Problem

Auto-linking (`findMatchingOccurrence`) matches by account + direction + date ±3 days + amount ±1%. When auto-match fails — nómina arrives via email before the occurrence window, amount differs >1%, or user simply wants to link proactively — the occurrence stays pending and the transaction stays orphaned. No manual override exists.

## Entry Points

### From Transaction (expanded view)

When a transaction row is tapped/expanded, show a **"Vincular a recurrente"** action alongside existing actions (edit, categorize, etc.). This action is **conditionally visible**: only render it when at least one pending occurrence exists on the same account, same direction, within ±30 days of the transaction date.

Tapping opens a **bottom drawer** listing matching pending occurrences, ranked by match score (date proximity + amount proximity). User taps to select, then confirms with a "Vincular" button.

### From Occurrence (expanded confirm form)

When a pending occurrence row is tapped/expanded on the plan page, the inline confirm form already shows "Ya pagué" / "Ya recibí" and "Omitir". Add a **"Vincular existente"** button alongside these.

Tapping opens a **bottom drawer** listing candidate transactions from the same account + direction, within ±30 days of the occurrence date. Ranked by match score. Best match highlighted. "Mostrar todas" escape hatch removes the date filter.

## Picker Design

Both pickers use the same `LinkPickerSheet` component (bottom drawer / Sheet), parameterized by direction:

### Occurrence → Transaction Picker

- **Header**: occurrence name, expected amount, date
- **Search**: text filter on transaction description
- **List**: transactions on same account + same direction, ±30 days from occurrence date
- **Ranking**: sorted by composite score — date proximity (weight 0.6) + amount proximity (weight 0.4)
- **Sections**: "Mejor coincidencia" (top match, green highlight + border) and "Otras opciones"
- **Escape hatch**: "Mostrar todas las transacciones →" removes date filter, shows all unlinked transactions on same account + direction
- **Selection**: tap highlights row, "Vincular" confirm button at bottom
- **Filter out**: transactions already linked to another occurrence (`recurrence_group_id` is set AND a paid occurrence references them)

### Transaction → Occurrence Picker

- **Header**: transaction description, amount, date
- **List**: pending occurrences on same account + same direction, within ±30 days
- **Ranking**: same composite score
- **Sections**: best match highlighted with brass accent
- **Selection**: tap highlights row, "Vincular" confirm button at bottom
- **No escape hatch needed**: occurrence list is small (typically <10 pending)

## Data Model

### New column: `recurring_occurrences.linked_manually`

```sql
ALTER TABLE recurring_occurrences
  ADD COLUMN linked_manually boolean NOT NULL DEFAULT false;
```

- `false` (default): occurrence was resolved by creating a new transaction via `recordRecurringOccurrencePayment` or auto-linked via `linkTransactionToOccurrence`
- `true`: occurrence was resolved by manually linking an existing transaction

No changes to the `transactions` table schema. The existing `recurrence_group_id` column is stamped on the linked transaction.

## Server Action: `linkExistingTransactionToOccurrence`

New action in `webapp/src/actions/occurrences.ts`:

```
linkExistingTransactionToOccurrence(
  occurrenceId: string,
  transactionId: string
): Promise<ActionResult>
```

### Steps

1. Auth via `getAuthenticatedClient()`
2. Validate both UUIDs
3. Fetch occurrence — must be `status: "pending"`, owned by user
4. Fetch transaction — must exist, owned by user, same account + direction as occurrence's template
5. Compute `recurrence_group_id` via `computeRecurringGroupUuid(templateId, occurrenceDate)`
6. Stamp `recurrence_group_id` on the transaction (update, not insert)
7. Mark occurrence as paid: `status: "paid"`, `transaction_id`, `paid_at`, `linked_manually: true`
8. Auto-deactivate ONCE templates (same logic as `markOccurrencePaid`)
9. `revalidateFinancialViews()` + `revalidateTag("occurrences", "zeta")`

### No balance changes

The transaction already exists — its balance impact was applied when it was created. Linking is metadata-only.

## Server Action: `getCandidateTransactionsForOccurrence`

New cached query for the occurrence → transaction picker:

```
getCandidateTransactionsForOccurrence(
  occurrenceId: string,
  showAll?: boolean
): Promise<ActionResult<CandidateTransaction[]>>
```

- Fetches occurrence to get `account_id`, `direction`, `occurrence_date`, `expected_amount` from template
- Queries transactions on same account + direction, not already linked to a paid occurrence
- If `showAll` is false (default): filter ±30 days from `occurrence_date`
- Returns with `matchScore` computed client-side or server-side (date proximity 0.6 + amount proximity 0.4)
- Sorted by `matchScore` descending

## Server Action: `getCandidateOccurrencesForTransaction`

New cached query for the transaction → occurrence picker:

```
getCandidateOccurrencesForTransaction(
  transactionId: string
): Promise<ActionResult<CandidateOccurrence[]>>
```

- Fetches transaction to get `account_id`, `direction`, `transaction_date`, `amount`
- Queries pending occurrences where template matches same account + direction
- Filter ±30 days from `transaction_date`
- Returns with `matchScore`
- Sorted by `matchScore` descending

## Smart Undo in `revertOccurrence`

Current behavior: deletes transactions via `recurrence_group_id` and reverses balance deltas.

Updated behavior — branch on `linked_manually`:

### `linked_manually = false` (unchanged)

Delete transactions in recurrence group, reverse balances, reset occurrence to pending.

### `linked_manually = true` (new path)

1. Clear `recurrence_group_id` from the linked transaction (set to `null`)
2. Reset occurrence: `status: "pending"`, `transaction_id: null`, `paid_at: null`, `linked_manually: false`
3. **No transaction deletion, no balance reversal** — the transaction existed before linking
4. Re-activate ONCE templates if applicable (existing logic)
5. Revalidate tags

## Components

### `LinkPickerSheet`

Shared bottom drawer component used by both directions.

**Props:**
- `open: boolean`
- `onOpenChange: (open: boolean) => void`
- `title: string`
- `subtitle: string`
- `candidates: Array<{ id, label, sublabel, amount, currencyCode, direction, matchScore }>`
- `onConfirm: (selectedId: string) => void`
- `isPending: boolean`
- `showAllLabel?: string` — escape hatch text, triggers parent to reload with `showAll: true`
- `onShowAll?: () => void`

**Behavior:**
- Renders ranked list with match score badges
- Top match gets accent border + "Mejor coincidencia" label
- Tap to select (highlight), "Vincular" button at bottom to confirm
- Loading state while `isPending`

### Transaction-side integration

In the expanded transaction row (both desktop table and mobile activity), conditionally render "Vincular a recurrente" action. On click:
1. Call `getCandidateOccurrencesForTransaction(txId)`
2. Open `LinkPickerSheet` with results
3. On confirm → `linkExistingTransactionToOccurrence(selectedOccurrenceId, txId)`

**Visibility condition:** the parent page/component that renders transactions should call `getAccountIdsWithPendingOccurrences()` (new lightweight cached query — returns `Set<string>` of account IDs that have ≥1 pending occurrence). Show the "Vincular" action only if `tx.account_id` is in the set AND `tx.recurrence_group_id` is null.

### Occurrence-side integration

In `RecurringConfirmInline`, add "Vincular existente" button. On click:
1. Call `getCandidateTransactionsForOccurrence(occurrenceId)`
2. Open `LinkPickerSheet` with results
3. On confirm → `linkExistingTransactionToOccurrence(occurrenceId, selectedTxId)`

## Match Score Algorithm

```typescript
function computeMatchScore(
  candidateDate: string,
  candidateAmount: number,
  referenceDate: string,
  referenceAmount: number
): number {
  const daysDiff = Math.abs(differenceInDays(parseISO(candidateDate), parseISO(referenceDate)));
  const dateScore = Math.max(0, 1 - daysDiff / 30); // 0-1, linear decay over 30 days

  const amountDiff = Math.abs(candidateAmount - referenceAmount);
  const amountScore = referenceAmount > 0
    ? Math.max(0, 1 - amountDiff / referenceAmount)
    : 0;

  return dateScore * 0.6 + amountScore * 0.4; // 0-1
}
```

## Scope Boundaries

**In scope:**
- Manual link from transaction expanded view
- Manual link from occurrence inline confirm form
- Bottom drawer picker with ranking
- Smart undo (linked_manually flag)
- Migration for `linked_manually` column

**Out of scope:**
- Bulk linking (link multiple transactions at once)
- Auto-suggest banner ("this transaction looks like your nómina — link it?")
- Desktop transaction table integration (only mobile + transaction detail page for now — desktop table expand pattern doesn't exist yet)
- Changing the auto-link tolerance (±3 days, ±1%) — that's a separate concern

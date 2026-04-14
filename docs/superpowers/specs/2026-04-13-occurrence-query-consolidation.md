# Occurrence Query Consolidation

> Single cached function for all pending occurrence reads — no more bypass queries.

## Problem

4 separate places query `recurring_occurrences` with different select fragments, different filters, and different `is_active` handling:

| Query | File | Filter `is_active`? | Uses `OCCURRENCE_SELECT`? |
|-------|------|---------------------|---------------------------|
| `getPendingOccurrencesCached` | `occurrences.ts:143` | Yes (JS filter) | Yes |
| `getNextIncomeOccurrenceCached` | `occurrences.ts:175` | Yes (JS loop) | No (own select) |
| Attention items inline query | `attention-items.ts:89` | Yes (JS filter, just added) | No (own select) |
| `findMatchingOccurrence` | `occurrences.ts:433` | Yes (JS guard, just added) | No (own select) |

Every new `is_active`-like filter must be added to all 4. New queries risk forgetting it.

## Goal

One cached function serves all pending occurrence reads. Consumers filter the shared result in JS for their specific needs (direction, currency, amount tolerance, date window).

## Approach

### 1. `getPendingOccurrencesCached` becomes the canonical source

Already the most complete — uses `OCCURRENCE_SELECT`, handles `is_active`, returns `RecurringOccurrence[]`. Keep it as-is but ensure its date range is generous enough for all consumers (currently `rangeStart`→`rangeEnd` params).

### 2. `getNextIncomeOccurrenceCached` → reuse `getPendingOccurrencesCached`

Replace the standalone query with:
```typescript
export async function getNextIncomeOccurrenceCached(
  userId: string, todayStr: string, currency: string, accessToken: string,
): Promise<NextIncomeInfo | null> {
  "use cache";
  cacheTag("occurrences"); cacheTag("recurring"); cacheLife("zeta");

  const rangeEnd = toColombiaDateString(addDays(new Date(todayStr + "T12:00:00"), PAY_CYCLE_LOOKAHEAD_DAYS));
  const occurrences = await getPendingOccurrencesCached(userId, todayStr, rangeEnd, accessToken);

  // Find first INFLOW from non-debt account in matching currency
  const match = occurrences.find((o) =>
    o.direction === "INFLOW" &&
    o.currency_code === currency &&
    o.account_type !== "CREDIT_CARD" &&
    o.account_type !== "LOAN"
  );
  if (!match) return null;

  // ... compute daysUntil, return NextIncomeInfo
}
```

Benefit: `is_active` filter, FK hints, select fragment — all inherited from the shared function.

### 3. Attention items → call `getPendingOccurrencesCached`

Replace the inline Supabase query with:
```typescript
const pendingOccurrences = await getPendingOccurrencesCached(userId, todayStr, in7DaysStr, accessToken);
const upcomingPayments = pendingOccurrences.slice(0, 5).map((o) => ({
  templateId: o.template_id,
  name: o.merchant_name ?? o.description ?? "Pago recurrente",
  amount: o.expected_amount,
  next_date: o.occurrence_date,
  direction: o.direction,
  occurrenceDate: o.occurrence_date,
}));
```

Note: `getAttentionItemsCached` is itself `"use cache"`. Calling `getPendingOccurrencesCached` (also `"use cache"`) from inside it is fine — nested cache boundaries.

### 4. `findMatchingOccurrence` → call `getPendingOccurrencesCached`

Replace the inline query with:
```typescript
const rangeStart = toColombiaDateString(addDays(baseDateObj, -3));
const rangeEnd = toColombiaDateString(addDays(baseDateObj, 3));
const occurrences = await getPendingOccurrencesCached(userId, rangeStart, rangeEnd, accessToken);

const match = occurrences.find((o) =>
  o.account_id === accountId &&
  o.direction === direction &&
  Math.abs(o.expected_amount - amount) <= amount * 0.01
);
return match?.id ?? null;
```

Issue: `findMatchingOccurrence` is NOT inside `"use cache"` — it's a public wrapper. It calls `getAuthenticatedClient()` which provides `user` and `accessToken`. Needs `accessToken` extracted to call cached inner.

### 5. Add `RecurringOccurrence.is_active` to the exported type (optional)

If the monthly calendar view needs to show paused occurrences in a greyed-out state, propagate `is_active` through `mapOccurrenceRow` → `RecurringOccurrence`. Otherwise skip — the query-side filter is sufficient.

## What NOT to change

- `getOccurrencesForMonthCached` — shows all occurrences (paid, skipped, pending) for history. Different concern, different query shape.
- `ensureOccurrencesForRange` — write path, already filters `is_active` at template level.
- `markOccurrencePaid` / `skipOccurrence` — targeted writes on specific IDs, no query consolidation needed.

## Files to modify

| File | Change |
|------|--------|
| `actions/occurrences.ts` | Rewrite `getNextIncomeOccurrenceCached` to call shared function. Rewrite `findMatchingOccurrence` to call shared function. |
| `actions/attention-items.ts` | Replace inline occurrence query with `getPendingOccurrencesCached` call. |
| `types/domain.ts` | (Optional) Add `is_active` to `RecurringOccurrence` if UI needs it. |

## Risks

- **Cache key alignment**: `findMatchingOccurrence` uses ±3 day windows. If the shared function is called with different `rangeStart`/`rangeEnd` params across callers, each gets a separate cache entry. This is acceptable — the shared function's cache is per `(userId, rangeStart, rangeEnd)`. The win is code deduplication, not cache sharing for this particular consumer.
- **Attention items call context**: `getAttentionItemsCached` uses `"use cache"`. Calling `getPendingOccurrencesCached` from inside is nested cache — verified safe in this project.

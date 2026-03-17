# Recipient Management Improvements

**Date:** 2026-03-16
**Status:** Approved
**Branch:** feat/debt-scenario-planner (continuing)

---

## Problem

The recipient (destinatario) system is functional but has UX gaps: users can't preview what a pattern will match before saving, related suggestions appear as separate entries instead of grouped, there's no warning when patterns overlap, and there's no visibility into which rules are actually being used.

## Design

### Part 1: Pattern Testing ("Preview Matches")

**New server action:** `testDestinatarioPattern(pattern, matchType)`
- Queries recent transactions (last 1000, no destinatario_id)
- Applies the pattern using the same `cleanDescription()` + matching logic from `destinatario-matcher.ts`
- Returns: `{ matchCount: number, samples: { id, raw_description, clean_description, date, amount }[] }` (up to 5 samples)

**UI in destinatario detail (rule add form):**
- After typing a pattern and selecting match type, a "Probar" button appears
- On click, calls `testDestinatarioPattern()` and shows:
  - "X transacciones coinciden" (green if >0, muted if 0)
  - Collapsible list of up to 5 sample matches
- Non-blocking — user can save regardless of result

### Part 2: Smarter Suggestion Grouping

**Current behavior:** Groups by exact cleaned description. "NEQUI PAGO", "NEQUI PAGO TRANSFERENCIAS", "NEQUI PAGO 1234" are 3 separate suggestions.

**New behavior:** Group by longest common prefix (minimum 2 tokens):
1. Clean all unmatched descriptions
2. Sort alphabetically
3. Walk sorted list and merge entries that share a common prefix of >= 2 tokens
4. The group's pattern = the common prefix
5. The group's count = sum of all variant counts
6. The group's samples include examples from each variant

**Implementation:** Add `groupByCommonPrefix()` to `packages/shared/src/utils/destinatario-matcher.ts`. The existing `getDestinatarioSuggestions()` server action calls it before returning results.

**UI unchanged** — `destinatario-suggestions-tab.tsx` already renders suggestions as cards. The data shape stays the same, just with better grouping.

### Part 3: Rule Conflict Detection

**When saving a new rule:**
1. Before upsert, query existing rules for the user
2. Check if the new pattern is a substring of any existing pattern, or vice versa
3. If conflicts found, return them in the action result

**Server action change:** `addDestinatarioRule()` returns `{ success: true, data, conflicts?: { pattern, destinatarioName }[] }`

**UI:** If conflicts exist, show a yellow warning below the form:
- "Este patrón puede coincidir con reglas existentes:"
- List of conflicting patterns with their destinatario names
- Non-blocking — user can still save

### Part 4: Match Count Tracking

**Migration:** Add to `destinatario_rules`:
```sql
ALTER TABLE destinatario_rules ADD COLUMN match_count integer NOT NULL DEFAULT 0;
ALTER TABLE destinatario_rules ADD COLUMN last_matched_at timestamptz;
```

**Increment logic:**
- In `assignDestinatario()` (categorize.ts): when a rule is matched, increment its `match_count` and set `last_matched_at = now()`
- In the import flow: when `matchDestinatario()` returns a match, the import action increments the matched rule's count

**UI in destinatario detail (rules list):**
- Each rule shows: "Usada X veces" + relative time of last match
- Rules with `match_count = 0` or `last_matched_at` older than 90 days show a muted "Sin uso reciente" badge

## Files Changed

**Migration:**
- Add `match_count`, `last_matched_at` to `destinatario_rules`

**Modified files:**
- `webapp/src/types/database.ts` — regenerated
- `webapp/src/actions/destinatarios.ts` — add `testDestinatarioPattern()`, update suggestion grouping call, add conflict detection to rule creation
- `webapp/src/actions/categorize.ts` — increment match_count on assignment
- `webapp/src/actions/import-transactions.ts` — increment match_count during import
- `packages/shared/src/utils/destinatario-matcher.ts` — add `groupByCommonPrefix()`
- `webapp/src/components/destinatarios/destinatario-detail.tsx` — pattern test UI, conflict warning, match count display
- `webapp/src/components/destinatarios/destinatario-suggestions-tab.tsx` — use grouped suggestions

## Success Criteria

1. User can test a pattern and see matching transactions before saving
2. Related suggestions (NEQUI PAGO variants) appear as one grouped suggestion
3. Yellow warning appears when a new rule overlaps with existing ones
4. Rule list shows usage count and last matched date
5. Stale rules are visually flagged

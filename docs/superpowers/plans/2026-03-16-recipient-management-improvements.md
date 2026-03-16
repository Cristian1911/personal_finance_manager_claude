# Recipient Management Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve recipient pattern management with testing, smarter grouping, conflict detection, and usage tracking.

**Architecture:** Migration adds match tracking columns. Shared package gets prefix grouping logic. Server actions get pattern testing and conflict detection. UI components enhanced to show test results, conflicts, and usage stats.

**Tech Stack:** Supabase (migration), `@zeta/shared` (matching logic), Next.js server actions, React client components.

---

## Task 1: Migration + match count tracking

**Files:**
- Migration: add `match_count`, `last_matched_at` to `destinatario_rules`
- Modify: `webapp/src/types/database.ts` — regenerate
- Modify: `webapp/src/actions/categorize.ts` — increment on assignment
- Modify: `webapp/src/actions/import-transactions.ts` — increment during import

- [ ] **Step 1: Apply migration**

```sql
ALTER TABLE destinatario_rules ADD COLUMN match_count integer NOT NULL DEFAULT 0;
ALTER TABLE destinatario_rules ADD COLUMN last_matched_at timestamptz;
```

- [ ] **Step 2: Regenerate types**

```bash
cd webapp && npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > src/types/database.ts
```

- [ ] **Step 3: Increment match_count in assignDestinatario**

In `webapp/src/actions/categorize.ts`, find the section where `assignDestinatario()` creates/upserts a rule after matching. After the rule upsert, add:

```typescript
// Increment match count for the matched rule
if (matchedRulePattern) {
  await supabase
    .from("destinatario_rules")
    .update({
      match_count: supabase.rpc("increment_match_count"), // or raw SQL
    })
    .eq("user_id", user.id)
    .eq("pattern", matchedRulePattern);
}
```

Actually simpler — just use a raw increment. After the rule upsert in `assignDestinatario()`, add:

```typescript
await supabase.rpc("increment_rule_match_count", {
  p_user_id: user.id,
  p_pattern: extractedPattern,
});
```

Even simpler — avoid an RPC. Just do a direct update after the upsert:

```typescript
// After the destinatario_rules upsert, increment match count
await supabase
  .from("destinatario_rules")
  .update({
    match_count: 1,  // Will be handled by raw SQL below
    last_matched_at: new Date().toISOString()
  })
  .eq("user_id", user.id)
  .eq("destinatario_id", destinatarioId)
  .ilike("pattern", extractedPattern);
```

Note: Supabase JS client doesn't support atomic increment directly. The simplest approach is to read-then-write, or use a Postgres function. For MVP, just set `last_matched_at` on each match (more useful than an exact count). We can add an RPC for atomic increment later.

Simplified approach: just track `last_matched_at` for now (skip `match_count` atomic increment — it would need an RPC). The migration still adds both columns for future use.

- [ ] **Step 4: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/types/database.ts webapp/src/actions/categorize.ts
git commit -m "feat: add match tracking columns to destinatario_rules"
```

---

## Task 2: Prefix grouping for suggestions

**Files:**
- Modify: `packages/shared/src/utils/destinatario-matcher.ts` — add `groupByCommonPrefix()`
- Modify: `webapp/src/actions/destinatarios.ts` — use grouping in `getDestinatarioSuggestions()`

- [ ] **Step 1: Add groupByCommonPrefix to shared package**

In `packages/shared/src/utils/destinatario-matcher.ts`, add after `detectDestinatarioSuggestions()`:

```typescript
/**
 * Group suggestions by longest common prefix (minimum 2 tokens).
 * Merges "NEQUI PAGO", "NEQUI PAGO TRANSFERENCIAS", "NEQUI PAGO 1234"
 * into one group with pattern "NEQUI PAGO" and combined count.
 */
export function groupByCommonPrefix(
  suggestions: DestinatarioSuggestion[]
): DestinatarioSuggestion[] {
  if (suggestions.length <= 1) return suggestions;

  // Sort alphabetically by pattern for prefix detection
  const sorted = [...suggestions].sort((a, b) =>
    a.cleanedPattern.localeCompare(b.cleanedPattern)
  );

  const groups: DestinatarioSuggestion[] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const prefix = getCommonPrefix(current.cleanedPattern, next.cleanedPattern);
    const prefixTokens = prefix.trim().split(/\s+/).filter(Boolean);

    if (prefixTokens.length >= 2) {
      // Merge: use the prefix as the pattern, combine counts and samples
      current = {
        cleanedPattern: prefix.trim(),
        count: current.count + next.count,
        rawDescriptions: [...current.rawDescriptions, ...next.rawDescriptions],
        transactionPreviews: [
          ...current.transactionPreviews,
          ...next.transactionPreviews,
        ].slice(0, 5),
      };
    } else {
      groups.push(current);
      current = next;
    }
  }
  groups.push(current);

  // Re-sort by count descending
  groups.sort((a, b) => b.count - a.count);
  return groups;
}

function getCommonPrefix(a: string, b: string): string {
  const tokensA = a.split(/\s+/);
  const tokensB = b.split(/\s+/);
  const common: string[] = [];
  for (let i = 0; i < Math.min(tokensA.length, tokensB.length); i++) {
    if (tokensA[i] === tokensB[i]) {
      common.push(tokensA[i]);
    } else {
      break;
    }
  }
  return common.join(" ");
}
```

- [ ] **Step 2: Export from shared package index**

Verify `groupByCommonPrefix` is exported via `packages/shared/src/index.ts` (it should be since `export * from "./utils/destinatario-matcher"` exists).

- [ ] **Step 3: Use grouping in getDestinatarioSuggestions**

In `webapp/src/actions/destinatarios.ts`, at the end of `getDestinatarioSuggestions()`, before returning the results, import and apply the grouping:

Add import at top of file:
```typescript
import { cleanDescription, groupByCommonPrefix } from "@zeta/shared";
```

Then at the end of `getDestinatarioSuggestions()`, after building the results array but before returning, wrap with grouping. The function already builds a `DestinatarioSuggestionResult[]` — convert to the shared `DestinatarioSuggestion` format, group, and convert back.

Actually simpler: apply `groupByCommonPrefix` directly to the server action's result array since the shapes are compatible enough. Just call it on the final sorted array before the `.slice(0, 20)`:

```typescript
// Before: return top 20
// After: group by prefix, then return top 20
const grouped = groupByCommonPrefix(results);
return { success: true, data: grouped.slice(0, 20) };
```

Note: the `DestinatarioSuggestionResult` type in the action and `DestinatarioSuggestion` in shared differ slightly. The grouping function uses `DestinatarioSuggestion`. Either align the types or adapt the function to work with the action's type.

- [ ] **Step 4: Build and commit**

```bash
cd webapp && pnpm build
git add packages/shared/src/utils/destinatario-matcher.ts webapp/src/actions/destinatarios.ts
git commit -m "feat: group recipient suggestions by common prefix"
```

---

## Task 3: Pattern testing server action + UI

**Files:**
- Modify: `webapp/src/actions/destinatarios.ts` — add `testDestinatarioPattern()`
- Modify: `webapp/src/components/destinatarios/destinatario-detail.tsx` — add test UI to rule form

- [ ] **Step 1: Add testDestinatarioPattern server action**

In `webapp/src/actions/destinatarios.ts`, add:

```typescript
export interface PatternTestResult {
  matchCount: number;
  samples: { id: string; rawDescription: string; date: string; amount: number }[];
}

export async function testDestinatarioPattern(
  pattern: string,
  matchType: "contains" | "exact"
): Promise<ActionResult<PatternTestResult>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("transactions")
    .select("id, raw_description, transaction_date, amount")
    .eq("user_id", user.id)
    .is("destinatario_id", null)
    .not("raw_description", "is", null)
    .order("transaction_date", { ascending: false })
    .limit(1000);

  if (error) return { success: false, error: error.message };

  const lowerPattern = pattern.toLowerCase();
  const matches = (data ?? []).filter((tx) => {
    if (!tx.raw_description) return false;
    const desc = tx.raw_description.toLowerCase();
    return matchType === "exact" ? desc === lowerPattern : desc.includes(lowerPattern);
  });

  return {
    success: true,
    data: {
      matchCount: matches.length,
      samples: matches.slice(0, 5).map((tx) => ({
        id: tx.id,
        rawDescription: tx.raw_description!,
        date: tx.transaction_date,
        amount: tx.amount,
      })),
    },
  };
}
```

- [ ] **Step 2: Add test UI to destinatario detail rule form**

In `webapp/src/components/destinatarios/destinatario-detail.tsx`, find the "add rule" form section. Add a "Probar" button next to the submit button that calls `testDestinatarioPattern()` and shows results:

Add state:
```typescript
const [testResult, setTestResult] = useState<PatternTestResult | null>(null);
const [testing, setTesting] = useState(false);
```

Add test handler:
```typescript
async function handleTest() {
  const pattern = /* get from form state */;
  const matchType = /* get from form state */;
  if (!pattern) return;
  setTesting(true);
  const result = await testDestinatarioPattern(pattern, matchType);
  if (result.success) setTestResult(result.data);
  setTesting(false);
}
```

Add UI below the form inputs:
```tsx
<Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
  {testing ? "Probando..." : "Probar"}
</Button>

{testResult && (
  <div className="rounded-md bg-z-surface-2 p-3 text-xs space-y-1">
    <p className={testResult.matchCount > 0 ? "text-z-income font-medium" : "text-muted-foreground"}>
      {testResult.matchCount} transacciones coinciden
    </p>
    {testResult.samples.length > 0 && (
      <ul className="space-y-0.5 text-muted-foreground">
        {testResult.samples.map((s) => (
          <li key={s.id}>{s.rawDescription} · {formatCurrency(s.amount)}</li>
        ))}
      </ul>
    )}
  </div>
)}
```

- [ ] **Step 3: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/actions/destinatarios.ts webapp/src/components/destinatarios/destinatario-detail.tsx
git commit -m "feat: add pattern testing with preview matches"
```

---

## Task 4: Rule conflict detection

**Files:**
- Modify: `webapp/src/actions/destinatarios.ts` — add conflict check to `addDestinatarioRule()`
- Modify: `webapp/src/components/destinatarios/destinatario-detail.tsx` — show conflict warning

- [ ] **Step 1: Add conflict detection to addDestinatarioRule**

In `webapp/src/actions/destinatarios.ts`, in the `addDestinatarioRule()` function, after validation but before insert, check for conflicts:

```typescript
// Check for conflicting patterns
const { data: existingRules } = await supabase
  .from("destinatario_rules")
  .select("pattern, destinatario_id")
  .eq("user_id", user.id);

const newPatternLower = parsed.data.pattern.toLowerCase();
const conflicts: { pattern: string; destinatarioId: string }[] = [];

for (const rule of existingRules ?? []) {
  const existingLower = rule.pattern.toLowerCase();
  if (
    existingLower.includes(newPatternLower) ||
    newPatternLower.includes(existingLower)
  ) {
    conflicts.push({ pattern: rule.pattern, destinatarioId: rule.destinatario_id });
  }
}
```

Then include conflicts in the success response. Modify the return type to include optional conflicts:

```typescript
// After successful insert:
return {
  success: true,
  data: insertedRule,
  conflicts: conflicts.length > 0 ? conflicts : undefined,
} as any; // or extend the ActionResult type
```

Actually, simpler: return conflicts as a separate field on the data object, or log them as a warning. Cleanest approach: the action returns success + data as normal, but also sets a `warning` field.

- [ ] **Step 2: Show conflict warning in UI**

In `webapp/src/components/destinatarios/destinatario-detail.tsx`, after saving a rule, if conflicts are present, show a yellow warning:

```tsx
{conflicts.length > 0 && (
  <div className="rounded-md bg-z-alert/10 border border-z-alert/20 p-2 text-xs text-z-alert">
    Este patrón puede coincidir con reglas existentes:
    <ul className="mt-1 space-y-0.5">
      {conflicts.map((c, i) => (
        <li key={i}>"{c.pattern}"</li>
      ))}
    </ul>
  </div>
)}
```

- [ ] **Step 3: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/actions/destinatarios.ts webapp/src/components/destinatarios/destinatario-detail.tsx
git commit -m "feat: add rule conflict detection with warning UI"
```

---

## Task 5: Match count display in rule list

**Files:**
- Modify: `webapp/src/components/destinatarios/destinatario-detail.tsx` — show match stats per rule

- [ ] **Step 1: Show match count and last_matched_at in rule list**

In `webapp/src/components/destinatarios/destinatario-detail.tsx`, find the rules list section. Each rule item should now show usage stats:

```tsx
<span className="text-xs text-muted-foreground">
  {rule.match_count > 0
    ? `Usada ${rule.match_count} veces`
    : "Sin uso"}
  {rule.last_matched_at && (
    <> · Última: {formatDate(rule.last_matched_at)}</>
  )}
</span>

{/* Stale badge: no matches in 90 days or never matched */}
{(!rule.last_matched_at ||
  Date.now() - new Date(rule.last_matched_at).getTime() > 90 * 24 * 60 * 60 * 1000
) && rule.match_count === 0 && (
  <Badge variant="outline" className="text-[10px] text-muted-foreground">
    Sin uso reciente
  </Badge>
)}
```

The rules query in the destinatario detail page action should already include `match_count` and `last_matched_at` since it uses `select("*")`.

- [ ] **Step 2: Build and commit**

```bash
cd webapp && pnpm build
git add webapp/src/components/destinatarios/destinatario-detail.tsx
git commit -m "feat: show match count and stale badge on recipient rules"
```

---

## Final Verification

- [ ] **Run full build**

```bash
cd webapp && pnpm build
```

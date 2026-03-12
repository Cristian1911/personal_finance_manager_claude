# Recipient Management Enhancement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace noisy n-gram pattern detection with clean description-based grouping, add a dedicated import wizard step for recipient curation, and add a background suggestion scanner on the destinatarios page.

**Architecture:** New `cleanDescription()` strips noise tokens from raw descriptions. `detectDestinatarioSuggestions()` is rewritten to group by cleaned output instead of n-grams. Import wizard gains Step 2.5 "Destinatarios" between Review and Confirm. The `/destinatarios` page gets a "Sugerencias" tab powered by a new server action.

**Tech Stack:** Next.js 15 (App Router), Supabase, TypeScript, shadcn/ui, `@zeta/shared` package

**Spec:** `docs/superpowers/specs/2026-03-11-multicurrency-and-recipient-management-design.md` (Feature 2)

---

## File Structure

| File | Responsibility | Change |
|------|---------------|--------|
| `packages/shared/src/utils/destinatario-matcher.ts` | Pattern matching + suggestion engine | Add `cleanDescription()`, rewrite `detectDestinatarioSuggestions()`, update `DestinatarioSuggestion` type |
| `webapp/src/components/import/step-destinatarios.tsx` | **New** — Import wizard Step 2.5 for recipient curation | Create component with suggestion cards, transaction checklists, inline creation |
| `webapp/src/components/import/import-wizard.tsx` | Wizard orchestrator | Add "destinatarios" step between "review" and "confirm", wire data flow |
| `webapp/src/components/import/step-confirm.tsx` | Transaction confirmation step | Remove `DestinatarioSuggestions` integration |
| `webapp/src/components/import/destinatario-suggestions.tsx` | Old suggestion UI (in confirm step) | **Delete** — replaced by `step-destinatarios.tsx` |
| `webapp/src/actions/destinatarios.ts` | Destinatario server actions | Add `getDestinatarioSuggestions()` for background scanning |
| `webapp/src/app/(dashboard)/destinatarios/page.tsx` | Destinatarios page | Add tabs layout (Mis destinatarios / Sugerencias) |
| `webapp/src/components/destinatarios/destinatario-suggestions-tab.tsx` | **New** — Background suggestions UI on destinatarios page | Create client component for suggestion cards |

---

## Chunk 1: Detection Algorithm Upgrade

### Task 1: Add `cleanDescription()` and rewrite suggestion detection

**Files:**
- Modify: `packages/shared/src/utils/destinatario-matcher.ts`

- [ ] **Step 1: Add noise token constants**

At the top of the file (after the existing types), add:

```typescript
// ─── Noise stripping ─────────────────────────────────────────────────────────

/** Common noise tokens stripped from descriptions (matched as full words only) */
const NOISE_TOKENS = new Set([
  "SUC", "SUCURSAL", "OFC", "OFICINA", "PAG", "PAGO", "COMPRA",
  "DISPONIBLE", "CR", "DB", "REVERSO", "DE",
]);
```

- [ ] **Step 2: Add `cleanDescription()` function**

After the noise tokens constant, add the exported function:

```typescript
/**
 * Clean a raw transaction description by stripping noise tokens and numeric suffixes.
 * Returns a normalized, uppercase string suitable for grouping.
 *
 * Examples:
 *   "MERCADO PAGO SUC 001" → "MERCADO"
 *   "NETFLIX.COM 8843291" → "NETFLIX.COM"
 *   "PAGO SUCURSAL VIRTUAL BANCOLOMBIA" → "VIRTUAL BANCOLOMBIA"
 *   "DLO*GOOGLE Archero" → "DLO*GOOGLE ARCHERO"
 */
export function cleanDescription(raw: string): string {
  const upper = raw.toUpperCase().trim();
  const tokens = upper.split(/\s+/);

  const cleaned = tokens.filter((token) => {
    // Remove known noise tokens (full word match)
    if (NOISE_TOKENS.has(token)) return false;
    // Remove purely numeric tokens (branch codes, terminal IDs)
    if (/^\d+$/.test(token)) return false;
    return true;
  });

  // Collapse whitespace and return
  return cleaned.join(" ").trim();
}
```

- [ ] **Step 3: Update `DestinatarioSuggestion` type**

Replace the existing `DestinatarioSuggestion` interface (line 25) with:

```typescript
export interface DestinatarioSuggestion {
  /** Cleaned pattern used for grouping */
  cleanedPattern: string;
  /** Number of transactions matching this pattern */
  count: number;
  /** Original raw descriptions for display */
  rawDescriptions: string[];
  /** Transaction previews for display (date, raw description, amount) */
  transactionPreviews: { date: string; rawDescription: string; amount: number }[];
}
```

- [ ] **Step 4: Rewrite `detectDestinatarioSuggestions()`**

Replace the entire function (lines 126-202) and remove the `extractTokens` and `generateCandidatePatterns` helper functions (lines 102-119) since they are no longer needed:

```typescript
/**
 * Analyze unmatched transaction descriptions to suggest new destinatario patterns.
 * Groups transactions by cleaned description and returns groups with enough matches.
 *
 * @param transactions - Array of { description, date?, amount? } objects
 * @param minCount - Minimum number of matching transactions to form a suggestion (default: 2)
 */
export function detectDestinatarioSuggestions(
  transactions: { description: string; date?: string; amount?: number }[],
  minCount: number = 2
): DestinatarioSuggestion[] {
  const groups = new Map<
    string,
    { rawDescriptions: Set<string>; previews: { date: string; rawDescription: string; amount: number }[] }
  >();

  for (const tx of transactions) {
    const cleaned = cleanDescription(tx.description);
    if (cleaned.length === 0) continue;

    if (!groups.has(cleaned)) {
      groups.set(cleaned, { rawDescriptions: new Set(), previews: [] });
    }
    const group = groups.get(cleaned)!;
    group.rawDescriptions.add(tx.description);
    if (group.previews.length < 5) {
      group.previews.push({
        date: tx.date ?? "",
        rawDescription: tx.description,
        amount: tx.amount ?? 0,
      });
    }
  }

  const suggestions: DestinatarioSuggestion[] = [];
  for (const [pattern, group] of groups) {
    const totalCount = group.rawDescriptions.size;
    if (totalCount < minCount) continue;
    suggestions.push({
      cleanedPattern: pattern,
      count: totalCount,
      rawDescriptions: Array.from(group.rawDescriptions),
      transactionPreviews: group.previews,
    });
  }

  // Sort by count desc, then pattern alphabetically
  suggestions.sort((a, b) => {
    const countDiff = b.count - a.count;
    if (countDiff !== 0) return countDiff;
    return a.cleanedPattern.localeCompare(b.cleanedPattern);
  });

  return suggestions;
}
```

- [ ] **Step 5: Verify shared package builds**

Run: `cd packages/shared && pnpm build` (or `pnpm tsc --noEmit` if there's no build script)
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/utils/destinatario-matcher.ts
git commit -m "feat(destinatarios): cleanDescription + rewrite suggestion detection"
```

---

### Task 2: Update callers of `detectDestinatarioSuggestions` for new signature

**Files:**
- Modify: `webapp/src/components/import/destinatario-suggestions.tsx` (temporary — will be deleted in Task 5)
- Modify: `webapp/src/components/import/step-confirm.tsx`

The function signature changed: it now takes `{ description, date?, amount? }[]` instead of `string[]`. The return type field changed from `pattern` to `cleanedPattern` and `sample_descriptions` to `rawDescriptions`.

- [ ] **Step 1: Update `destinatario-suggestions.tsx` to use new API**

In `destinatario-suggestions.tsx`, update the `useMemo` at line 57-68 that builds `allDescriptions`. Change it to build transaction objects:

```typescript
const allTransactions = useMemo(() => {
  const seen = new Set<string>();
  const result: { description: string }[] = [];
  for (const desc of [...batchDescriptions, ...historicalDescriptions]) {
    const key = desc.toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push({ description: desc });
    }
  }
  return result;
}, [batchDescriptions, historicalDescriptions]);
```

Update the `suggestions` useMemo at line 70-73:

```typescript
const suggestions = useMemo(
  () => detectDestinatarioSuggestions(allTransactions, 2),
  [allTransactions]
);
```

Update all references from `s.pattern` to `s.cleanedPattern` and from `s.sample_descriptions` to `s.rawDescriptions` throughout the component:
- Line 79: `s.cleanedPattern` instead of `s.pattern`
- Line 86: `s.cleanedPattern` instead of `s.pattern`
- Line 97: `suggestion.cleanedPattern`
- Line 185: `key={suggestion.cleanedPattern}`
- Line 193-195: display `suggestion.cleanedPattern`
- Line 198: `suggestion.rawDescriptions[0]` instead of `suggestion.sample_descriptions[0]`
- Line 205: `creating !== suggestion.cleanedPattern`
- Line 212: `handleStartCreating(suggestion)`
- Line 221: `handleDismiss(suggestion.cleanedPattern)`
- Line 232: `creating === suggestion.cleanedPattern`
- Line 238: use `suggestion.cleanedPattern` in id
- Line 277: `handleCreate(suggestion.cleanedPattern)`

Also update `handleStartCreating` to use `suggestion.cleanedPattern`:

```typescript
const handleStartCreating = useCallback(
  (suggestion: DestinatarioSuggestion) => {
    setCreating(suggestion.cleanedPattern);
    setFormName(capitalize(suggestion.cleanedPattern));
    setFormCategory(null);
    setFormError(null);
  },
  []
);
```

- [ ] **Step 2: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: Clean build

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/import/destinatario-suggestions.tsx webapp/src/components/import/step-confirm.tsx
git commit -m "feat(destinatarios): update callers for new detectDestinatarioSuggestions API"
```

---

## Chunk 2: Import Wizard Step 2.5

### Task 3: Create Step Destinatarios component

**Files:**
- Create: `webapp/src/components/import/step-destinatarios.tsx`

- [ ] **Step 1: Create the component**

Create `webapp/src/components/import/step-destinatarios.tsx`. This component:
- Takes all transactions from mapped statements
- Runs `cleanDescription()` on each
- Groups by cleaned description
- Matches against existing destinatario rules
- Shows "already matched" (collapsed) and "unmatched suggestions" (interactive)

```tsx
"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  cleanDescription,
  matchDestinatario,
  prepareDestinatarioRules,
} from "@zeta/shared";
import type { DestinatarioRule } from "@zeta/shared";
import { createDestinatario } from "@/actions/destinatarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode, CategoryWithChildren } from "@/types/domain";
import type { ParseResponse, StatementAccountMapping } from "@/types/import";

interface StepDestinatariosProps {
  parseResult: ParseResponse;
  mappings: StatementAccountMapping[];
  categories: CategoryWithChildren[];
  destinatarioRules: DestinatarioRule[];
  onContinue: (updatedRules: DestinatarioRule[]) => void;
  onBack: () => void;
}

interface SuggestionGroup {
  cleanedPattern: string;
  transactions: {
    stmtIdx: number;
    txIdx: number;
    date: string;
    rawDescription: string;
    amount: number;
    currency: string;
  }[];
}

/** Capitalize each word */
function capitalize(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function StepDestinatarios({
  parseResult,
  mappings,
  categories,
  destinatarioRules,
  onContinue,
  onBack,
}: StepDestinatariosProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createdPatterns, setCreatedPatterns] = useState<Set<string>>(new Set());
  const [dismissedPatterns, setDismissedPatterns] = useState<Set<string>>(new Set());
  const [currentRules, setCurrentRules] = useState<DestinatarioRule[]>(destinatarioRules);

  // Inline form state
  const [editingPattern, setEditingPattern] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // Track which transactions are checked per suggestion pattern
  const [txSelections, setTxSelections] = useState<Map<string, Set<string>>>(new Map());
  // Track expanded suggestion cards
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Analyze all transactions from mapped statements
  const { matchedGroups, suggestions } = useMemo(() => {
    const prepared = prepareDestinatarioRules(currentRules);
    const matched: { destName: string; count: number }[] = [];
    const matchedByDest = new Map<string, number>();

    const unmatched: {
      stmtIdx: number;
      txIdx: number;
      date: string;
      rawDescription: string;
      amount: number;
      currency: string;
      cleaned: string;
    }[] = [];

    for (const [stmtIdx, stmt] of parseResult.statements.entries()) {
      const mapping = mappings.find((m) => m.statementIndex === stmtIdx);
      if (!mapping?.accountId) continue;

      for (const [txIdx, tx] of stmt.transactions.entries()) {
        const match = matchDestinatario(tx.description, prepared);
        if (match) {
          matchedByDest.set(
            match.destinatario_name,
            (matchedByDest.get(match.destinatario_name) ?? 0) + 1
          );
        } else {
          const cleaned = cleanDescription(tx.description);
          if (cleaned.length > 0) {
            unmatched.push({
              stmtIdx,
              txIdx,
              date: tx.date,
              rawDescription: tx.description,
              amount: tx.amount,
              currency: stmt.currency,
              cleaned,
            });
          }
        }
      }
    }

    // Build matched summary
    for (const [name, count] of matchedByDest) {
      matched.push({ destName: name, count });
    }
    matched.sort((a, b) => b.count - a.count);

    // Group unmatched by cleaned pattern
    const groupMap = new Map<string, SuggestionGroup>();
    for (const tx of unmatched) {
      if (!groupMap.has(tx.cleaned)) {
        groupMap.set(tx.cleaned, { cleanedPattern: tx.cleaned, transactions: [] });
      }
      groupMap.get(tx.cleaned)!.transactions.push(tx);
    }

    // Filter to groups with 2+ transactions, sort by count desc
    const suggs = Array.from(groupMap.values())
      .filter((g) => g.transactions.length >= 2)
      .sort((a, b) => b.transactions.length - a.transactions.length);

    return { matchedGroups: matched, suggestions: suggs };
  }, [parseResult, mappings, currentRules]);

  const totalMatchedCount = matchedGroups.reduce((sum, g) => sum + g.count, 0);

  const visibleSuggestions = suggestions.filter(
    (s) => !createdPatterns.has(s.cleanedPattern) && !dismissedPatterns.has(s.cleanedPattern)
  );

  // Initialize transaction selections when a suggestion is first seen
  const getSelections = useCallback(
    (pattern: string, transactions: SuggestionGroup["transactions"]): Set<string> => {
      if (txSelections.has(pattern)) return txSelections.get(pattern)!;
      // All checked by default
      return new Set(transactions.map((tx) => `${tx.stmtIdx}-${tx.txIdx}`));
    },
    [txSelections]
  );

  function toggleTx(pattern: string, txKey: string, transactions: SuggestionGroup["transactions"]) {
    setTxSelections((prev) => {
      const next = new Map(prev);
      const current = getSelections(pattern, transactions);
      const updated = new Set(current);
      if (updated.has(txKey)) updated.delete(txKey);
      else updated.add(txKey);
      next.set(pattern, updated);
      return next;
    });
  }

  function handleStartEditing(suggestion: SuggestionGroup) {
    setEditingPattern(suggestion.cleanedPattern);
    setFormName(capitalize(suggestion.cleanedPattern));
    setFormCategory(null);
    setFormError(null);
    // Expand the card
    setExpanded((prev) => new Set(prev).add(suggestion.cleanedPattern));
  }

  function handleDismiss(pattern: string) {
    setDismissedPatterns((prev) => new Set(prev).add(pattern));
    if (editingPattern === pattern) setEditingPattern(null);
  }

  function handleCreate(pattern: string) {
    if (!formName.trim()) {
      setFormError("El nombre es obligatorio");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", formName.trim());
      if (formCategory) formData.set("default_category_id", formCategory);
      // Use the cleaned pattern as the rule pattern (contains match)
      formData.set("patterns", JSON.stringify([pattern.toLowerCase()]));

      const result = await createDestinatario(
        { success: false, error: "" },
        formData
      );

      if (result.success) {
        // Add the new rule to currentRules for re-matching
        setCurrentRules((prev) => [
          ...prev,
          {
            destinatario_id: result.data!.id,
            destinatario_name: formName.trim(),
            default_category_id: formCategory,
            match_type: "contains" as const,
            pattern: pattern.toLowerCase(),
            priority: 100,
          },
        ]);
        setCreatedPatterns((prev) => new Set(prev).add(pattern));
        setEditingPattern(null);
        setFormError(null);
        router.refresh();
      } else {
        setFormError(result.error);
      }
    });
  }

  const [matchedOpen, setMatchedOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Destinatarios</h2>
        <p className="text-sm text-muted-foreground">
          Detectamos patrones en tus transacciones. Crea destinatarios para categorizar automáticamente.
        </p>
      </div>

      {/* Already matched summary */}
      {totalMatchedCount > 0 && (
        <Collapsible open={matchedOpen} onOpenChange={setMatchedOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md border bg-emerald-500/5 p-3 text-left text-sm"
            >
              {matchedOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-emerald-600" />
              )}
              <span className="font-medium text-emerald-800">
                {totalMatchedCount} transacciones ya tienen destinatario asignado
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1 rounded-md border bg-background p-3">
              <div className="space-y-1">
                {matchedGroups.map((g) => (
                  <div key={g.destName} className="flex items-center justify-between text-sm">
                    <span>{g.destName}</span>
                    <span className="text-muted-foreground">{g.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Unmatched suggestions */}
      {visibleSuggestions.length > 0 ? (
        <div className="space-y-3">
          {visibleSuggestions.map((suggestion) => {
            const isEditing = editingPattern === suggestion.cleanedPattern;
            const isExpanded = expanded.has(suggestion.cleanedPattern);
            const selections = getSelections(suggestion.cleanedPattern, suggestion.transactions);

            return (
              <div key={suggestion.cleanedPattern} className="rounded-md border bg-background p-3">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      className="flex items-center gap-1 text-sm font-medium"
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(suggestion.cleanedPattern)) next.delete(suggestion.cleanedPattern);
                          else next.add(suggestion.cleanedPattern);
                          return next;
                        })
                      }
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      )}
                      {suggestion.cleanedPattern}
                    </button>
                    <p className="ml-5 text-xs text-muted-foreground">
                      {suggestion.transactions.length} transacciones
                    </p>
                  </div>

                  {!isEditing && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        onClick={() => handleStartEditing(suggestion)}
                      >
                        <Plus className="h-3 w-3" />
                        Crear destinatario
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => handleDismiss(suggestion.cleanedPattern)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Expanded transaction list */}
                {isExpanded && (
                  <div className="mt-2 space-y-1 border-t pt-2">
                    {suggestion.transactions.map((tx) => {
                      const txKey = `${tx.stmtIdx}-${tx.txIdx}`;
                      return (
                        <label
                          key={txKey}
                          className="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={selections.has(txKey)}
                            onCheckedChange={() =>
                              toggleTx(suggestion.cleanedPattern, txKey, suggestion.transactions)
                            }
                          />
                          <span className="text-muted-foreground">{tx.date}</span>
                          <span className="flex-1 truncate">{tx.rawDescription}</span>
                          <span className="shrink-0">
                            {formatCurrency(tx.amount, tx.currency as CurrencyCode)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Inline creation form */}
                {isEditing && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Nombre
                        </label>
                        <Input
                          value={formName}
                          onChange={(e) => {
                            setFormName(e.target.value);
                            if (formError) setFormError(null);
                          }}
                          placeholder="Nombre del destinatario"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Categoría (opcional)
                        </label>
                        <CategoryCombobox
                          categories={categories}
                          value={formCategory}
                          onValueChange={setFormCategory}
                          placeholder="Sin categoría"
                          triggerClassName="h-8 text-xs w-full sm:w-[180px]"
                        />
                      </div>
                    </div>

                    {formError && <p className="text-xs text-red-600">{formError}</p>}

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        disabled={isPending}
                        onClick={() => handleCreate(suggestion.cleanedPattern)}
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Creando...
                          </>
                        ) : (
                          "Crear destinatario"
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        disabled={isPending}
                        onClick={() => setEditingPattern(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        createdPatterns.size === 0 && (
          <div className="rounded-md border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
            No detectamos patrones recurrentes en estas transacciones.
          </div>
        )
      )}

      {createdPatterns.size > 0 && visibleSuggestions.length === 0 && (
        <div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700">
          Todos los patrones sugeridos han sido procesados.
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          Volver
        </Button>
        <Button type="button" onClick={() => onContinue(currentRules)}>
          {visibleSuggestions.length > 0 ? "Omitir y continuar" : "Continuar"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: Build may have warnings about unused import but should pass (component not yet wired)

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/import/step-destinatarios.tsx
git commit -m "feat(destinatarios): create Step 2.5 component for import wizard"
```

---

### Task 4: Wire Step 2.5 into the import wizard

**Files:**
- Modify: `webapp/src/components/import/import-wizard.tsx`

- [ ] **Step 1: Add "destinatarios" to Step type and STEPS array**

In `import-wizard.tsx`, update the type and array at lines 22-30:

```typescript
type Step = "upload" | "review" | "destinatarios" | "confirm" | "reconcile" | "results";

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Subir PDF" },
  { key: "review", label: "Revisar" },
  { key: "destinatarios", label: "Destinatarios" },
  { key: "confirm", label: "Confirmar" },
  { key: "reconcile", label: "Reconciliar" },
  { key: "results", label: "Resultados" },
];
```

- [ ] **Step 2: Add import and state for destinatario rules**

Add the import at the top:

```typescript
import { StepDestinatarios } from "./step-destinatarios";
```

Add state for updated rules (after existing state declarations around line 51):

```typescript
const [activeDestinatarioRules, setActiveDestinatarioRules] = useState<DestinatarioRule[]>(destinatarioRules);
```

- [ ] **Step 3: Update navigation flow**

Change `handleReviewConfirm` to go to "destinatarios" instead of "confirm" (line 133):

```typescript
setStep("destinatarios");
```

Add a handler for when Step 2.5 completes:

```typescript
function handleDestinatariosContinue(updatedRules: DestinatarioRule[]) {
  setActiveDestinatarioRules(updatedRules);
  setStep("confirm");
}
```

- [ ] **Step 4: Add step rendering**

After the `review` step rendering (line 211) and before the `confirm` step rendering, add:

```tsx
{step === "destinatarios" && parseResult && (
  <StepDestinatarios
    parseResult={parseResult}
    mappings={mappings}
    categories={categories}
    destinatarioRules={activeDestinatarioRules}
    onContinue={handleDestinatariosContinue}
    onBack={() => setStep("review")}
  />
)}
```

- [ ] **Step 5: Update confirm step to use activeDestinatarioRules**

In the confirm step rendering (around line 214), change `destinatarioRules` prop to use the active rules:

```tsx
destinatarioRules={activeDestinatarioRules}
```

- [ ] **Step 6: Update confirm step onBack to go to destinatarios**

Change the `onBack` prop of `StepConfirm` from `() => setStep("review")` to:

```tsx
onBack={() => setStep("destinatarios")}
```

- [ ] **Step 7: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: Clean build

- [ ] **Step 8: Commit**

```bash
git add webapp/src/components/import/import-wizard.tsx
git commit -m "feat(destinatarios): wire Step 2.5 into import wizard flow"
```

---

### Task 5: Remove old DestinatarioSuggestions from confirm step

**Files:**
- Modify: `webapp/src/components/import/step-confirm.tsx`
- Delete: `webapp/src/components/import/destinatario-suggestions.tsx`
- Modify: `webapp/src/components/import/import-wizard.tsx` (remove `unmatchedDescriptions` prop)
- Modify: `webapp/src/app/(dashboard)/import/page.tsx` (remove `getUnmatchedDescriptions` call)

- [ ] **Step 1: Remove DestinatarioSuggestions from step-confirm.tsx**

In `step-confirm.tsx`:

1. Remove the import at line 10:
   ```typescript
   import { DestinatarioSuggestions } from "./destinatario-suggestions";
   ```

2. Remove `unmatchedDescriptions` from the component props (line 29) and the destructured params.

3. Remove the `batchUnmatchedDescriptions` useMemo (lines 72-83).

4. Remove the `handleDestinatarioCreated` callback (lines 85-87).

5. Remove the `<DestinatarioSuggestions ... />` JSX (lines 262-267).

- [ ] **Step 2: Delete `destinatario-suggestions.tsx`**

```bash
rm webapp/src/components/import/destinatario-suggestions.tsx
```

- [ ] **Step 3: Remove `unmatchedDescriptions` prop from ImportWizard**

In `import-wizard.tsx`:
1. Remove `unmatchedDescriptions` from the component props interface.
2. Remove the prop from `StepConfirm` rendering.

- [ ] **Step 4: Remove `getUnmatchedDescriptions` from import page**

In `webapp/src/app/(dashboard)/import/page.tsx`:
1. Remove `getUnmatchedDescriptions` from the import statement (line 3).
2. Remove `unmatchedResult` from the `Promise.all` (line 12) and the variable below it (line 17).
3. Remove `unmatchedDescriptions={unmatchedDescriptions}` from the `<ImportWizard>` JSX.

- [ ] **Step 5: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: Clean build

- [ ] **Step 6: Commit**

```bash
git add webapp/src/components/import/step-confirm.tsx
git add webapp/src/components/import/import-wizard.tsx
git add webapp/src/app/\(dashboard\)/import/page.tsx
git rm webapp/src/components/import/destinatario-suggestions.tsx
git commit -m "feat(destinatarios): remove old suggestion UI from confirm step"
```

---

## Chunk 3: Background Suggestions on Destinatarios Page

### Task 6: Add `getDestinatarioSuggestions()` server action

**Files:**
- Modify: `webapp/src/actions/destinatarios.ts`

- [ ] **Step 1: Add the server action**

At the bottom of `destinatarios.ts`, add:

```typescript
// ─── getDestinatarioSuggestions ──────────────────────────────────────────────

export type DestinatarioSuggestionResult = {
  cleanedPattern: string;
  count: number;
  dateRange: { from: string; to: string };
  sampleTransactions: { date: string; rawDescription: string; amount: number }[];
};

export async function getDestinatarioSuggestions(): Promise<
  ActionResult<DestinatarioSuggestionResult[]>
> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Fetch unmatched transactions with raw descriptions
  const { data, error } = await supabase
    .from("transactions")
    .select("transaction_date, raw_description, amount")
    .eq("user_id", user.id)
    .is("destinatario_id", null)
    .not("raw_description", "is", null)
    .order("transaction_date", { ascending: false })
    .limit(1000);

  if (error) return { success: false, error: error.message };

  // Import cleanDescription dynamically to use shared package
  const { cleanDescription } = await import("@zeta/shared");

  // Group by cleaned description
  const groups = new Map<
    string,
    {
      count: number;
      dates: string[];
      samples: { date: string; rawDescription: string; amount: number }[];
    }
  >();

  for (const row of data ?? []) {
    if (!row.raw_description) continue;
    const cleaned = cleanDescription(row.raw_description);
    if (cleaned.length === 0) continue;

    if (!groups.has(cleaned)) {
      groups.set(cleaned, { count: 0, dates: [], samples: [] });
    }
    const group = groups.get(cleaned)!;
    group.count++;
    group.dates.push(row.transaction_date);
    if (group.samples.length < 5) {
      group.samples.push({
        date: row.transaction_date,
        rawDescription: row.raw_description,
        amount: row.amount,
      });
    }
  }

  // Filter to groups with 3+ occurrences, sort by count desc, limit to 20
  const suggestions: DestinatarioSuggestionResult[] = [];
  for (const [pattern, group] of groups) {
    if (group.count < 3) continue;
    const sortedDates = group.dates.sort();
    suggestions.push({
      cleanedPattern: pattern,
      count: group.count,
      dateRange: {
        from: sortedDates[0],
        to: sortedDates[sortedDates.length - 1],
      },
      sampleTransactions: group.samples,
    });
  }

  suggestions.sort((a, b) => b.count - a.count);

  return { success: true, data: suggestions.slice(0, 20) };
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: Clean build

- [ ] **Step 3: Commit**

```bash
git add webapp/src/actions/destinatarios.ts
git commit -m "feat(destinatarios): add getDestinatarioSuggestions server action"
```

---

### Task 7: Add Sugerencias tab to destinatarios page

**Files:**
- Create: `webapp/src/components/destinatarios/destinatario-suggestions-tab.tsx`
- Modify: `webapp/src/app/(dashboard)/destinatarios/page.tsx`

- [ ] **Step 1: Create the suggestions tab component**

Create `webapp/src/components/destinatarios/destinatario-suggestions-tab.tsx`:

```tsx
"use client";

import { useCallback, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createDestinatario } from "@/actions/destinatarios";
import type { DestinatarioSuggestionResult } from "@/actions/destinatarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { CurrencyCode, CategoryWithChildren } from "@/types/domain";

const DISMISS_STORAGE_KEY = "zeta:destinatario-suggestions-dismissed";
const DISMISS_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return new Set();
    const entries: { pattern: string; timestamp: number }[] = JSON.parse(raw);
    const now = Date.now();
    const active = entries.filter((e) => now - e.timestamp < DISMISS_EXPIRY_MS);
    // Clean up expired
    if (active.length !== entries.length) {
      localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(active));
    }
    return new Set(active.map((e) => e.pattern));
  } catch {
    return new Set();
  }
}

function addDismissed(pattern: string) {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    const entries: { pattern: string; timestamp: number }[] = raw ? JSON.parse(raw) : [];
    entries.push({ pattern, timestamp: Date.now() });
    localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

/** Capitalize each word */
function capitalize(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function DestinatarioSuggestionsTab({
  suggestions: initialSuggestions,
  categories,
}: {
  suggestions: DestinatarioSuggestionResult[];
  categories: CategoryWithChildren[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState<Set<string>>(() => getDismissed());
  const [createdPatterns, setCreatedPatterns] = useState<Set<string>>(new Set());
  const [editingPattern, setEditingPattern] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const visibleSuggestions = initialSuggestions.filter(
    (s) => !dismissed.has(s.cleanedPattern) && !createdPatterns.has(s.cleanedPattern)
  );

  const handleDismiss = useCallback((pattern: string) => {
    addDismissed(pattern);
    setDismissed((prev) => new Set(prev).add(pattern));
    setEditingPattern((prev) => (prev === pattern ? null : prev));
  }, []);

  function handleStartEditing(suggestion: DestinatarioSuggestionResult) {
    setEditingPattern(suggestion.cleanedPattern);
    setFormName(capitalize(suggestion.cleanedPattern));
    setFormCategory(null);
    setFormError(null);
  }

  function handleCreate(pattern: string) {
    if (!formName.trim()) {
      setFormError("El nombre es obligatorio");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", formName.trim());
      if (formCategory) formData.set("default_category_id", formCategory);
      formData.set("patterns", JSON.stringify([pattern.toLowerCase()]));

      const result = await createDestinatario(
        { success: false, error: "" },
        formData
      );

      if (result.success) {
        setCreatedPatterns((prev) => new Set(prev).add(pattern));
        setEditingPattern(null);
        setFormError(null);
        router.refresh();
      } else {
        setFormError(result.error);
      }
    });
  }

  if (visibleSuggestions.length === 0) {
    return (
      <div className="rounded-md border bg-muted/50 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No encontramos patrones nuevos. Las sugerencias aparecen cuando tienes transacciones recurrentes sin destinatario asignado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleSuggestions.map((suggestion) => {
        const isEditing = editingPattern === suggestion.cleanedPattern;
        const dateFrom = formatDate(suggestion.dateRange.from);
        const dateTo = formatDate(suggestion.dateRange.to);

        return (
          <div key={suggestion.cleanedPattern} className="rounded-md border bg-background p-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium">{suggestion.cleanedPattern}</h3>
                <p className="text-xs text-muted-foreground">
                  {suggestion.count} transacciones, {dateFrom} — {dateTo}
                </p>
              </div>
              {!isEditing && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    onClick={() => handleStartEditing(suggestion)}
                  >
                    <Plus className="h-3 w-3" />
                    Crear destinatario
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => handleDismiss(suggestion.cleanedPattern)}
                  >
                    Ignorar
                  </Button>
                </div>
              )}
            </div>

            {/* Transaction preview (expandable) */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button type="button" className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <ChevronRight className="h-3 w-3" />
                  Ver transacciones
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-1">
                  {suggestion.sampleTransactions.map((tx, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{tx.date}</span>
                      <span className="flex-1 truncate">{tx.rawDescription}</span>
                      <span className="shrink-0 font-mono">
                        {formatCurrency(tx.amount, "COP" as CurrencyCode)}
                      </span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Inline creation form */}
            {isEditing && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Nombre</label>
                    <Input
                      value={formName}
                      onChange={(e) => {
                        setFormName(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      placeholder="Nombre del destinatario"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Categoría (opcional)</label>
                    <CategoryCombobox
                      categories={categories}
                      value={formCategory}
                      onValueChange={setFormCategory}
                      placeholder="Sin categoría"
                      triggerClassName="h-8 text-xs w-full sm:w-[180px]"
                    />
                  </div>
                </div>

                {formError && <p className="text-xs text-red-600">{formError}</p>}

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    disabled={isPending}
                    onClick={() => handleCreate(suggestion.cleanedPattern)}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      "Crear destinatario"
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    disabled={isPending}
                    onClick={() => setEditingPattern(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Update destinatarios page with tabs**

Replace `webapp/src/app/(dashboard)/destinatarios/page.tsx` with:

```tsx
import { getDestinatarios, getDestinatarioSuggestions } from "@/actions/destinatarios";
import { getCategories } from "@/actions/categories";
import { DestinatarioList } from "@/components/destinatarios/destinatario-list";
import { DestinatarioSuggestionsTab } from "@/components/destinatarios/destinatario-suggestions-tab";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { buildCategoryMap } from "@/lib/utils/categories";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function DestinatariosPage() {
  const [destResult, catResult, suggestionsResult] = await Promise.all([
    getDestinatarios(),
    getCategories(),
    getDestinatarioSuggestions(),
  ]);

  const destinatarios = destResult.success ? destResult.data : [];
  const categories = catResult.success ? catResult.data : [];
  const suggestions = suggestionsResult.success ? suggestionsResult.data : [];
  const categoryMap = buildCategoryMap(categories);

  return (
    <div className="space-y-6">
      <MobilePageHeader title="Destinatarios" backHref="/gestionar" />
      <div className="hidden lg:flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Destinatarios</h1>
          <p className="text-muted-foreground">
            {destinatarios.length} destinatario{destinatarios.length !== 1 ? "s" : ""} registrado{destinatarios.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild>
          <Link href="/destinatarios/nuevo">
            <Plus className="size-4 mr-2" />
            Crear destinatario
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Mis destinatarios</TabsTrigger>
          <TabsTrigger value="suggestions">
            Sugerencias
            {suggestions.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-xs font-medium text-amber-700">
                {suggestions.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          <DestinatarioList
            destinatarios={destinatarios}
            categoryMap={categoryMap}
          />
        </TabsContent>
        <TabsContent value="suggestions">
          <DestinatarioSuggestionsTab
            suggestions={suggestions}
            categories={categories}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 3: Verify build passes**

Run: `cd webapp && pnpm build`
Expected: Clean build

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/destinatarios/destinatario-suggestions-tab.tsx webapp/src/app/\(dashboard\)/destinatarios/page.tsx
git commit -m "feat(destinatarios): sugerencias tab on destinatarios page"
```

---

### Task 8: Final verification

- [ ] **Step 1: Full build**

Run: `cd webapp && pnpm build`
Expected: Clean build, no type errors

- [ ] **Step 2: Manual smoke test**

Start dev server: `cd webapp && pnpm dev`
- Import wizard should show 6 steps: Upload → Revisar → Destinatarios → Confirmar → Reconciliar → Resultados
- After mapping accounts (Step 2), Step 3 should show detected patterns with cleaner grouping
- Each suggestion card should expand to show individual transactions with checkboxes
- Creating a destinatario should remove it from suggestions and update matched count
- "Omitir y continuar" should proceed to confirm step
- Confirm step should no longer show the old DestinatarioSuggestions collapsible
- `/destinatarios` page should have "Mis destinatarios" and "Sugerencias" tabs
- Sugerencias tab shows patterns with 3+ occurrences, with expandable transaction previews
- "Ignorar" dismisses suggestion (stored in localStorage with 7-day expiry)

- [ ] **Step 3: Final commit if any fixes needed**

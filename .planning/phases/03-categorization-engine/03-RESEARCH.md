# Phase 3: Categorization Engine - Research

**Researched:** 2026-03-25
**Domain:** Pure TypeScript string matching engine in `@zeta/shared`
**Confidence:** HIGH

## Summary

Phase 3 is a pure TypeScript engine improvement in `packages/shared/src/utils/auto-categorize.ts`. All decisions are locked in CONTEXT.md — there is nothing exploratory here. The work divides cleanly into four areas: (1) add a `normalizeForMatching()` helper that applies NFD diacritic removal and noise token stripping, (2) replace `description.includes(keyword)` with a pad-and-search word-boundary check, (3) introduce a `REGEX_RULES` array between user-learned rules and keyword rules, and (4) expand the keyword list with real Colombian merchant patterns mined from the bank parsers.

The protection mechanism for manually categorized transactions (CAT-05/CAT-06) requires no schema migration — the existing `categorization_source` enum already carries `USER_OVERRIDE` and `USER_CREATED` values. The guard clause belongs in the two callers of `autoCategorize()`: `step-confirm.tsx` and `category-inbox.tsx`. Neither caller currently checks `categorization_source` before overwriting a category.

The shared package already has Vitest 4.x configured (`packages/shared/vitest.config.ts`) with `globals: true`. There are zero existing test files in the package — Wave 0 must create the test file before implementation begins.

**Primary recommendation:** Implement all changes in a single file (`auto-categorize.ts`), wire the guard clause in the two callers, and write Vitest unit tests in `packages/shared/src/utils/__tests__/auto-categorize.test.ts`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Normalization (CAT-01)**
- D-01: Normalize descriptions inside `autoCategorize()` itself — callers never need to pre-normalize. The function applies: lowercase, NFD accent removal (`str.normalize("NFD").replace(/\p{Diacritic}/gu, "")`), and noise token stripping (bank prefixes, asterisks, slashes, transaction codes).
- D-02: Reuse the NFD + diacritic strip pattern already established in `quick-capture.ts` (line 69) and `reconciliation.ts` (line 48). Extract a shared `normalizeForMatching()` helper within auto-categorize or a co-located util — no external library.
- D-03: Noise tokens to strip: common Colombian bank prefixes (`COMPRA EN`, `PAGO EN`, `RETIRO`, `TRANSFERENCIA A/DE`), trailing transaction IDs (numeric codes after the merchant name), asterisks and slashes used as separators.

**Word Boundary Matching (CAT-02)**
- D-04: Use pad-and-search approach: pad the normalized description with spaces (`' ' + desc + ' '`) and search for `' ' + keyword + ' '` (also check keyword at start/end of string). Do NOT use JavaScript `\b` — it misbehaves with non-ASCII and bank description separators.
- D-05: Clean up existing keywords that use trailing spaces as boundary hacks (e.g., `"d1 "`, `"ara "`, `"metro "`, `"mio "`, `"bar "`, `"pet "`). The engine handles boundaries now — keywords should be plain words.
- D-06: The boundary check must also handle keywords at the very start or end of the description string, not only middle positions.

**Regex Rules (CAT-03)**
- D-07: Add a `REGEX_RULES` array to `auto-categorize.ts`, checked between user-learned rules (confidence 0.9) and keyword rules (0.7). Regex rules get confidence 0.8.
- D-08: Each regex rule is a pre-compiled `RegExp` object with a category UUID and optional merchant name. Patterns target multi-word Colombian bank formats that keywords cannot capture (e.g., `/pago\s+(tc|tarjeta|cred)/i` for debt payments, `/nomina|salario|sueldo/i` for income).
- D-09: Regex rules run against the normalized description (after D-01 transforms), not the raw input.

**Keyword Expansion (CAT-04)**
- D-10: Expand keyword coverage by mining real transaction descriptions from the bank-specific PDF parsers in `services/pdf_parser/parsers/`. Focus on Bancolombia, Nequi, Nu, Davivienda patterns.
- D-11: Add keywords for common Colombian merchants and payment patterns: supermarkets (Exito, Jumbo, Carulla, Olimpica, D1), utilities (EPM, ETB, Codensa), telecoms (Claro, Movistar, Tigo), transport (Uber, DiDi, InDrive), food delivery (Rappi, iFood).
- D-12: Group keywords by category to make the rule set maintainable. Preserve the existing `KEYWORD_RULES` structure.

**Manual Categorization Protection (CAT-05, CAT-06)**
- D-13: No new boolean column or schema migration. Use the existing `categorization_source` enum column which already tracks `USER_OVERRIDE` and `USER_CREATED`.
- D-14: Add a guard clause in `autoCategorize()` callers that skips re-categorization when `categorization_source IN ('USER_CREATED', 'USER_OVERRIDE')`.
- D-15: CAT-06 requirement is satisfied without a migration — the existing `categorization_source` enum already provides the tracking capability.

### Claude's Discretion
- Exact noise tokens list — Claude can expand based on parser output analysis
- Specific regex patterns for REGEX_RULES — Claude designs patterns based on real transaction data
- Internal ordering of keyword groups for maintainability
- Whether to add a `normalizeForMatching()` as a named export or keep it private to the module

### Deferred Ideas (OUT OF SCOPE)
- User-manageable categorization rules CRUD screen — Phase 7 (CATUX) or v2 (CAT-V2-01)
- Category hierarchy / subcategories — v2 (CAT-V2-02)
- Bulk re-categorize existing transactions when rules change — v2 (CAT-V2-03)
- Inline category quick-edit in transaction list — Phase 7 (CATUX-01)
- Unreviewed transactions queue after import — Phase 7 (CATUX-02)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-01 | Normalize transaction descriptions before matching (accent removal, noise token stripping, lowercase) | `normalizeForMatching()` in `auto-categorize.ts`; NFD pattern already in `quick-capture.ts:69` and `reconciliation.ts:48` |
| CAT-02 | Word-boundary matching to prevent false positives ("ara" matching "compra") | Pad-and-search approach; existing `"d1 "`, `"ara "` keyword hacks to be cleaned up |
| CAT-03 | Regex rule support in auto-categorize engine | `REGEX_RULES` array with pre-compiled `RegExp` objects; confidence 0.8 |
| CAT-04 | Expand keyword coverage for Colombian bank transaction formats | Mine bank parsers for description formats; add supermarkets, telecoms, transport, delivery |
| CAT-05 | `manually_categorized` flag (or equivalent) to protect user corrections | Guard clause in both callers (`step-confirm.tsx`, `category-inbox.tsx`) checking `categorization_source` |
| CAT-06 | Schema migration for manually_categorized tracking | Already satisfied by `categorization_source` enum — no migration needed |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9 | Engine implementation | Project standard; `@zeta/shared` is pure TS |
| Vitest | 4.0.18 | Unit testing | Already configured in `packages/shared/vitest.config.ts` |

### No New Dependencies
This phase adds zero new dependencies. All work is pure TypeScript string manipulation using JavaScript built-ins:
- `String.prototype.normalize("NFD")` — Unicode normalization, ES2015+, no import needed
- `/\p{Diacritic}/gu` — Unicode property escape, ES2018+, available in Node 20
- `RegExp` — built-in, pre-compiled at module level

**Installation:** None required.

## Architecture Patterns

### File Map for This Phase

```
packages/shared/src/utils/
├── auto-categorize.ts       # PRIMARY: all engine changes here
└── __tests__/
    └── auto-categorize.test.ts  # NEW: Wave 0 gap — must be created

webapp/src/components/
├── import/step-confirm.tsx      # Add guard clause (CAT-05)
└── categorize/category-inbox.tsx  # Add guard clause (CAT-05)
```

### Pattern 1: normalizeForMatching() helper

Extracted from the NFD pattern already used in `quick-capture.ts` (line 69) and `reconciliation.ts` (line 48). The new version adds noise token stripping on top of accent removal.

```typescript
// Source: packages/shared/src/utils/auto-categorize.ts
// Decision D-01, D-02, D-03

/** Normalize a transaction description for matching.
 * Applied inside autoCategorize() — callers do not pre-normalize.
 * 1. Lowercase
 * 2. NFD accent removal (already used in quick-capture.ts and reconciliation.ts)
 * 3. Noise token stripping (bank prefixes, transaction codes, separators)
 */
function normalizeForMatching(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    // Colombian bank prefix noise
    .replace(/\b(compra\s+en|compra\s+de|pago\s+en|pago\s+a|pago\s+de|retiro\s+en|retiro\s+de|transferencia\s+(a|de|en)|abono\s+(a|de)|debito\s+automatico)\b/g, " ")
    // Auth codes, reference numbers (4+ digit sequences)
    .replace(/\b\d{4,}\b/g, " ")
    // Separators used in bank descriptions
    .replace(/[*/\\|#@]/g, " ")
    // NIT / tax ID references
    .replace(/\b(nit|cc|ce)\s*:?\s*\d+/g, " ")
    // Collapse whitespace
    .replace(/\s{2,}/g, " ")
    .trim();
}
```

### Pattern 2: Word Boundary Check (pad-and-search)

Decision D-04: avoids `\b` which misbehaves with non-ASCII characters present in Colombian bank descriptions.

```typescript
// Source: decisions D-04, D-05, D-06

/** Check if keyword appears as a whole word in normalized description.
 * Pads both sides with spaces and tests for ' keyword ' to avoid
 * false positives ("ara" matching inside "compra", "metro" inside "metropolitano").
 */
function matchesWordBoundary(normalized: string, keyword: string): boolean {
  const padded = " " + normalized + " ";
  return padded.includes(" " + keyword + " ");
}
```

### Pattern 3: REGEX_RULES array

Decision D-07, D-08, D-09: runs against the normalized description at confidence 0.8, slotted between user-learned rules (0.9) and keyword rules (0.7).

```typescript
// Source: decisions D-07, D-08, D-09

interface RegexRule {
  pattern: RegExp;
  categoryId: string;
}

// Pre-compiled at module load time — no per-call compilation cost
const REGEX_RULES: RegexRule[] = [
  // Debt payments — multi-word patterns keywords can't match reliably
  { pattern: /pago\s+(tc|tarjeta|cred(ito)?|obligacion|prestamo)/i, categoryId: CAT.PAGOS_DEUDA },
  { pattern: /cuota\s+(credito|prestamo)/i, categoryId: CAT.PAGOS_DEUDA },
  { pattern: /abono\s+capital/i, categoryId: CAT.PAGOS_DEUDA },
  // Salary / income
  { pattern: /nomina|salario|sueldo/i, categoryId: CAT.SALARIO },
  // Investments / returns
  { pattern: /rendimiento(s)?\s+(financiero|abonado)/i, categoryId: CAT.INVERSIONES },
  { pattern: /pago\s+interes(es)?\s+cdt/i, categoryId: CAT.INVERSIONES },
  // Utilities combos
  { pattern: /gas\s+natural/i, categoryId: CAT.SERVICIOS },
];
```

### Pattern 4: autoCategorize() execution order

The updated priority chain:

```
1. user-learned rules (confidence 0.9)  → includes() match on lower-cased pattern
2. REGEX_RULES (confidence 0.8)         → .test() on normalizeForMatching(description)
3. KEYWORD_RULES (confidence 0.7)       → matchesWordBoundary() on normalizeForMatching(description)
```

The function signature is **unchanged** — `autoCategorize(description, userRules?)` still returns `CategorizationResult | null`. No callers break.

### Pattern 5: Manual Categorization Guard Clause

Guard clause location is in the two callers, not inside `autoCategorize()`. The engine does not receive `categorization_source` — that is a DB field unknown to the pure function.

**In `step-confirm.tsx`** (import pipeline): the `categoryOverrides` map is initialized from `initialCatMap` (destinatario match). Before the import sends `category_id`, check: if the parsed transaction already has `categorization_source` in `('USER_OVERRIDE', 'USER_CREATED')`, skip overwriting with the auto-categorize result.

**In `category-inbox.tsx`**: `suggestions` is computed for all transactions. Add a filter: exclude from `suggestions` any transaction where `tx.categorization_source === 'USER_OVERRIDE' || tx.categorization_source === 'USER_CREATED'`.

```typescript
// category-inbox.tsx — updated suggestions memo
const suggestions = useMemo(() => {
  const map = new Map<string, CategorizationResult>();
  for (const tx of transactions) {
    // CAT-05: skip manually categorized transactions
    if (
      tx.categorization_source === "USER_OVERRIDE" ||
      tx.categorization_source === "USER_CREATED"
    ) continue;
    const desc = tx.merchant_name ?? tx.clean_description ?? tx.raw_description ?? "";
    const result = autoCategorize(desc, userRules);
    if (result) map.set(tx.id, result);
  }
  return map;
}, [transactions, userRules]);
```

### Anti-Patterns to Avoid

- **Calling `normalizeForMatching()` from callers:** Normalization belongs inside `autoCategorize()`. Decision D-01 is explicit.
- **Using `\b` for word boundaries:** Fails for descriptions containing accented characters or bank separators. Use pad-and-search (D-04).
- **Keeping trailing-space keywords:** Remove `"d1 "`, `"ara "`, `"metro "`, `"mio "`, `"bar "`, `"pet "` — word boundary is now handled by the engine (D-05).
- **Compiling RegExp inside the function body:** Pre-compile `REGEX_RULES` at module level to avoid per-call allocation.
- **Adding `categorization_source` parameter to `autoCategorize()`:** The engine is a pure function in `@zeta/shared`. It has no DB context. The guard belongs in callers.
- **Creating a schema migration for CAT-06:** The `categorization_source` enum already exists. D-15 is explicit: no migration.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accent/diacritic removal | Custom char mapping table | `str.normalize("NFD").replace(/\p{Diacritic}/gu, "")` | Already used in two places in this codebase; covers all Unicode combining characters |
| Word boundary detection | Port `\b` regex behavior | Pad-and-search: `" " + desc + " "` | `\b` fails on non-ASCII; pad approach is simple, correct, already recommended in project research docs |
| Noise token removal | Write a full NLP tokenizer | Simple regex replacements for known Colombian bank prefixes | Scope is closed — known bank format prefixes, not general NLP |

**Key insight:** The entire phase touches a single 200-line TypeScript file. Complexity comes from correctness (boundary matching, normalization order), not from system design.

## Common Pitfalls

### Pitfall 1: Normalization Order Matters

**What goes wrong:** Stripping noise tokens before lowercasing causes misses when bank prefixes are uppercase (`COMPRA EN`). Alternatively, stripping before NFD normalization can leave accented chars that break keyword matching.

**Why it happens:** String transforms are order-dependent. The wrong order causes silent misses.

**How to avoid:** Apply transforms in this exact order: `lowercase → NFD + diacritic strip → noise removal → whitespace collapse`. This is the order used in `reconciliation.ts` (lines 47-55) which serves as the reference implementation.

**Warning signs:** Test case `"COMPRA EN D1 BOGOTA 12345"` not matching `"d1"` keyword.

### Pitfall 2: Keyword at String Start/End Missed by Pad-and-Search

**What goes wrong:** Only searching for `" keyword "` (space on both sides) misses a keyword that is the entire description or at the start/end.

**Why it happens:** `" " + "d1" + " "` is not found in `" d1"` (description has trailing space after padding but no leading merchant word before `d1`).

**How to avoid:** Decision D-06 explicitly requires this. The pad-and-search adds a leading and trailing space to the description: `" " + normalized + " "`. This guarantees every keyword at the start or end of the original description is padded to `" keyword "`.

**Warning signs:** Test with description `"d1 kennedy"` — must match; description `"compra d1"` — must match; description `"exito chapinero"` — must match; description `"va a exito"` — must match.

### Pitfall 3: User-Learned Rules Not Normalized

**What goes wrong:** `autoCategorize()` now normalizes the description before keyword matching, but user-learned rules are matched with `lower.includes(rule.pattern)` against the un-normalized description (current code line 176).

**Why it happens:** User-learned rule patterns were stored as extracted merchant fingerprints by `extractPattern()`, which already lowercases but does NOT strip accents.

**How to avoid:** Apply `normalizeForMatching()` to the description before the user-learned rule loop as well. User patterns may contain accented characters; normalize both sides for consistency.

**Warning signs:** User rule for `"rappi"` failing on description `"RAPPI*MCDONALDS"` after normalization strips the asterisk.

### Pitfall 4: Trailing-Space Keywords Left in Place

**What goes wrong:** Keywords like `"ara "` are cleaned up in the `KEYWORD_RULES` array but still appear as trailing-space variants in some category. The word-boundary check becomes redundant/inconsistent.

**Why it happens:** Easy to miss one when doing a manual cleanup of the keywords list.

**How to avoid:** After removing trailing spaces from keywords, write a test that asserts no keyword in `KEYWORD_RULES` contains a leading or trailing space. This prevents regressions.

**Warning signs:** `"ara "` still in Alimentacion keywords; `"bar "` still in Entretenimiento.

### Pitfall 5: REGEX_RULES Running Against Raw Description

**What goes wrong:** Regex patterns designed for normalized text fail when run against raw bank descriptions containing `"COMPRA EN"` prefixes, accents, or asterisks.

**Why it happens:** Forgetting that `normalizeForMatching()` must be applied before both REGEX_RULES and KEYWORD_RULES.

**How to avoid:** In the updated `autoCategorize()` body, compute `const normalized = normalizeForMatching(description)` once, then use it for both steps 2 and 3. Decision D-09 is explicit.

**Warning signs:** Pattern `/nomina/i` missing `"PAGO NÓMINA ENERO"` because the accent was not stripped.

### Pitfall 6: `step-confirm.tsx` Guard Clause — New Transactions Have No categorization_source

**What goes wrong:** Parsed transactions from PDF import arrive as `ParsedTransaction` objects — they have no `categorization_source` field (they don't exist in the DB yet). The guard clause logic cannot read this field from them.

**Why it happens:** CAT-05 is about protecting *existing* manually-categorized transactions from being overwritten during re-import or re-categorize flows. For brand-new imports, every transaction is new and should be auto-categorized.

**How to avoid:** In `step-confirm.tsx`, the guard is only relevant for the reconciliation merge case where a manual transaction's category is being carried forward. The `initialCatMap` from `matchDestinatario()` reflects destinatario-based category assignment (not user manual overrides). The true guard for CAT-05 in the import flow applies inside `importTransactions()` server action when reconciling: `mergeTransactionMetadata()` in `reconciliation.ts` (lines 155-159) already implements this — `shouldCarryCategory` only preserves category when the manual tx has `USER_CREATED` or `USER_OVERRIDE` source. No additional guard is needed in `step-confirm.tsx`.

**Warning signs:** Trying to read `.categorization_source` off a `ParsedTransaction` (which doesn't have that field).

### Pitfall 7: pnpm build Must Pass

**Why it matters:** `packages/shared` is consumed by `webapp` via workspace alias. Any TypeScript error in `auto-categorize.ts` breaks the webapp build. Run `cd webapp && pnpm build` as the final gate.

## Code Examples

### Current vs Updated autoCategorize() Structure

```typescript
// Source: packages/shared/src/utils/auto-categorize.ts (current state, line 167-200)

// CURRENT (broken boundary detection):
export function autoCategorize(description: string, userRules?: UserRule[]) {
  const lower = description.toLowerCase();  // only lowercase, no accent strip
  // ...
  if (lower.includes(keyword)) { ... }      // substring match — false positives
}

// TARGET:
export function autoCategorize(description: string, userRules?: UserRule[]) {
  const normalized = normalizeForMatching(description);  // CAT-01: normalize first

  // 1. User-learned rules (confidence 0.9)
  for (const rule of (userRules ?? [])) {
    if (normalized.includes(rule.pattern)) { ... }  // user patterns also normalized
  }

  // 2. Regex rules (confidence 0.8) — NEW, CAT-03
  for (const rule of REGEX_RULES) {
    if (rule.pattern.test(normalized)) {
      return { category_id: rule.categoryId, categorization_source: "SYSTEM_DEFAULT", categorization_confidence: 0.8 };
    }
  }

  // 3. Keyword rules (confidence 0.7) — with word boundary, CAT-02
  for (const rule of KEYWORD_RULES) {
    for (const keyword of rule.keywords) {
      if (matchesWordBoundary(normalized, keyword)) {
        return { category_id: rule.categoryId, categorization_source: "SYSTEM_DEFAULT", categorization_confidence: 0.7 };
      }
    }
  }

  return null;
}
```

### Noise Tokens Identified from Parser Analysis

From reading `services/pdf_parser/parsers/`:

- **Bancolombia credit card** (`bancolombia_credit_card.py`): descriptions come through the anti-copy deduplication step; typical formats: `"COMPRA EN RAPPI*MCDONALDS BOGOTA"`, `"PAGO TC VISA"`, numeric auth codes at end
- **Bancolombia savings** (`bancolombia_savings.py`): monospace table; descriptions are short, relatively clean — `"TRANSFERENCIA A NOMBRE"`, `"RETIRO CAJERO"`
- **Nequi** (`nequi_savings.py`): US-format numbers; descriptions are plain merchant names with minimal noise — `"Rappi"`, `"Uber"`, `"DiDi"`, balance adjustments labeled `"Saldo anterior"`
- **Nu credit card** (`nu_credit_card.py`): OCR-based parsing; descriptions normalized by `_normalize_ocr_line()`; formats: `"COMPRA 16 FEB"`, installment notation `"X de Y"` present in description

Noise tokens to strip (for D-03, Claude's discretion to finalize):
```
compra en / compra de
pago en / pago a / pago de
retiro en / retiro de
transferencia a / transferencia de / transferencia en
abono a / abono de
debito automatico
\b\d{4,}\b     — auth codes
[*/\\|]        — separators
nit: NNN / cc: NNN  — tax IDs
```

## Runtime State Inventory

> This is a pure code/engine change with no runtime-registered state, stored data, or migration. No runtime state inventory needed.

**Stored data:** None — the `categorization_source` enum column already exists in the live DB schema. No new columns, no new tables.
**Live service config:** None.
**OS-registered state:** None.
**Secrets/env vars:** None.
**Build artifacts:** None — `@zeta/shared` has no compiled output; consumed as raw TypeScript via workspace.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this is pure TypeScript code changes with no external tools, services, or CLIs).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `packages/shared/vitest.config.ts` (exists, `globals: true`) |
| Quick run command | `cd packages/shared && pnpm test` |
| Full suite command | `cd packages/shared && pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAT-01 | Description with accented chars matches after normalization | unit | `cd packages/shared && pnpm test` | Wave 0 |
| CAT-01 | Noise token `"COMPRA EN "` stripped before matching | unit | `cd packages/shared && pnpm test` | Wave 0 |
| CAT-02 | `"ara"` does NOT match description `"compra"` | unit | `cd packages/shared && pnpm test` | Wave 0 |
| CAT-02 | `"ara"` DOES match description `"D1 ARA KENNEDY"` | unit | `cd packages/shared && pnpm test` | Wave 0 |
| CAT-02 | `"d1"` matches description `"d1 kennedy"` (keyword at start) | unit | `cd packages/shared && pnpm test` | Wave 0 |
| CAT-03 | Regex rule `/nomina/i` matches `"pago nomina enero"` | unit | `cd packages/shared && pnpm test` | Wave 0 |
| CAT-03 | Regex rule fires at confidence 0.8 (between user 0.9 and keyword 0.7) | unit | `cd packages/shared && pnpm test` | Wave 0 |
| CAT-04 | New keyword `"indriver"` matches description `"viaje indriver"` | unit | `cd packages/shared && pnpm test` | Wave 0 |
| CAT-05 | Guard clause: transaction with `USER_OVERRIDE` source skipped in `category-inbox.tsx` suggestions | manual | visual inspection in dev | — |
| CAT-06 | No migration required — `categorization_source` enum verified in DB types | manual | verify `webapp/src/types/database.ts` line 1029 | — |

### Sampling Rate
- **Per task commit:** `cd packages/shared && pnpm test`
- **Per wave merge:** `cd packages/shared && pnpm test && cd webapp && pnpm build`
- **Phase gate:** All unit tests pass + `pnpm build` clean before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/shared/src/utils/__tests__/auto-categorize.test.ts` — covers CAT-01 through CAT-04
- [ ] No framework install needed — Vitest already in `packages/shared/package.json`

## Sources

### Primary (HIGH confidence)
- Direct source read: `packages/shared/src/utils/auto-categorize.ts` — current engine implementation
- Direct source read: `packages/shared/src/utils/quick-capture.ts` line 68-70 — NFD pattern reference
- Direct source read: `packages/shared/src/utils/reconciliation.ts` lines 45-55, 155-159 — normalization function and categorization_source guard
- Direct source read: `packages/shared/src/utils/pattern-extract.ts` — NOISE_PATTERNS array
- Direct source read: `webapp/src/types/database.ts` lines 1029-1034 — `categorization_source` enum definition
- Direct source read: `webapp/src/actions/categorize.ts` line 164 — `USER_OVERRIDE` assignment
- Direct source read: `webapp/src/components/categorize/category-inbox.tsx` lines 31-40 — current suggestions memo
- Direct source read: `services/pdf_parser/parsers/bancolombia_credit_card.py` — Bancolombia description formats
- Direct source read: `services/pdf_parser/parsers/nequi_savings.py` — Nequi description formats
- Direct source read: `services/pdf_parser/parsers/nu_credit_card.py` — Nu description formats
- Direct source read: `.planning/phases/03-categorization-engine/03-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- `packages/shared/vitest.config.ts` — Vitest configuration confirmed present

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pure TS, no new deps, all libraries already in project
- Architecture: HIGH — implementation file, helper location, and caller guard location all confirmed by source reads
- Pitfalls: HIGH — derived from actual code analysis and cross-referencing decisions against live code
- Test gaps: HIGH — confirmed `src/utils/__tests__/` does not exist via Glob

**Research date:** 2026-03-25
**Valid until:** This phase is isolated to a single file in a stable shared package — findings remain valid until `auto-categorize.ts` is modified.

# Phase 3: Categorization Engine - Context

**Gathered:** 2026-03-25 (auto mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve auto-categorization accuracy, add word-boundary and regex matching, expand keyword coverage for Colombian banks, and protect manually categorized transactions from being overwritten. No UI changes — this is engine-level work in `@zeta/shared` and guard clauses in server actions. The categorization UX (inline edit, review queue) is Phase 7.

</domain>

<decisions>
## Implementation Decisions

### Normalization (CAT-01)
- **D-01:** Normalize descriptions inside `autoCategorize()` itself — callers never need to pre-normalize. The function applies: lowercase, NFD accent removal (`str.normalize("NFD").replace(/\p{Diacritic}/gu, "")`), and noise token stripping (bank prefixes, asterisks, slashes, transaction codes).
- **D-02:** Reuse the NFD + diacritic strip pattern already established in `quick-capture.ts` (line 69) and `reconciliation.ts` (line 48). Extract a shared `normalizeForMatching()` helper within auto-categorize or a co-located util — no external library.
- **D-03:** Noise tokens to strip: common Colombian bank prefixes (`COMPRA EN`, `PAGO EN`, `RETIRO`, `TRANSFERENCIA A/DE`), trailing transaction IDs (numeric codes after the merchant name), asterisks and slashes used as separators.

### Word Boundary Matching (CAT-02)
- **D-04:** Use pad-and-search approach: pad the normalized description with spaces (`' ' + desc + ' '`) and search for `' ' + keyword + ' '` (also check keyword at start/end of string). Do NOT use JavaScript `\b` — it misbehaves with non-ASCII and bank description separators.
- **D-05:** Clean up existing keywords that use trailing spaces as boundary hacks (e.g., `"d1 "`, `"ara "`, `"metro "`, `"mio "`, `"bar "`, `"pet "`). The engine handles boundaries now — keywords should be plain words.
- **D-06:** The boundary check must also handle keywords at the very start or end of the description string, not only middle positions.

### Regex Rules (CAT-03)
- **D-07:** Add a `REGEX_RULES` array to `auto-categorize.ts`, checked between user-learned rules (confidence 0.9) and keyword rules (0.7). Regex rules get confidence 0.8.
- **D-08:** Each regex rule is a pre-compiled `RegExp` object with a category UUID and optional merchant name. Patterns target multi-word Colombian bank formats that keywords cannot capture (e.g., `/pago\s+(tc|tarjeta|cred)/i` for debt payments, `/nomina|salario|sueldo/i` for income).
- **D-09:** Regex rules run against the normalized description (after D-01 transforms), not the raw input.

### Keyword Expansion (CAT-04)
- **D-10:** Expand keyword coverage by mining real transaction descriptions from the bank-specific PDF parsers in `services/pdf_parser/parsers/`. Focus on Bancolombia, Nequi, Nu, Davivienda patterns — the most commonly imported banks.
- **D-11:** Add keywords for common Colombian merchants and payment patterns: supermarkets (Exito, Jumbo, Carulla, Olimpica, D1), utilities (EPM, ETB, Codensa), telecoms (Claro, Movistar, Tigo), transport (Uber, DiDi, InDrive), food delivery (Rappi, iFood).
- **D-12:** Group keywords by category to make the rule set maintainable. Preserve the existing `KEYWORD_RULES` structure — each entry maps keywords to a category UUID.

### Manual Categorization Protection (CAT-05, CAT-06)
- **D-13:** No new boolean column or schema migration. Use the existing `categorization_source` enum column which already tracks `USER_OVERRIDE` (manual category change) and `USER_CREATED` (manual transaction). The codebase already sets these correctly in `categorize.ts` (line 164), `transactions.ts` (line 269), and bulk operations.
- **D-14:** Add a guard clause in `autoCategorize()` (or its callers in the import pipeline) that skips re-categorization when `categorization_source IN ('USER_CREATED', 'USER_OVERRIDE')`. The reconciliation logic in `reconciliation.ts` (lines 158-159) already uses this exact check — make the auto-categorize path consistent.
- **D-15:** CAT-06 requirement (schema migration) is satisfied without a migration — the existing `categorization_source` enum already provides the tracking capability. Document this as a "requirement met by existing schema" in the plan.

### Claude's Discretion
- Exact noise tokens list — Claude can expand based on parser output analysis
- Specific regex patterns for REGEX_RULES — Claude designs patterns based on real transaction data
- Internal ordering of keyword groups for maintainability
- Whether to add a `normalizeForMatching()` as a named export or keep it private to the module

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auto-Categorize Engine
- `packages/shared/src/utils/auto-categorize.ts` — Current engine: `KEYWORD_RULES` (lines 21-161), `autoCategorize()` entry point, `description.toLowerCase()` only normalization (line 171), `lower.includes(keyword)` matching (line 189)
- `packages/shared/src/index.ts` — Barrel export for `@zeta/shared`

### Normalization Patterns (reuse)
- `packages/shared/src/utils/quick-capture.ts` (line 69) — NFD + diacritic strip pattern
- `packages/shared/src/utils/reconciliation.ts` (line 48) — Same NFD pattern, plus `categorization_source` check (lines 158-159)
- `packages/shared/src/utils/pattern-extract.ts` (lines 9-23) — Existing regex patterns for noise removal

### Category Constants
- `packages/shared/src/constants/categories.ts` — Seed category UUID constants (created in Phase 2)

### Manual Categorization Tracking
- `webapp/src/types/database.ts` (lines 1029-1034) — `categorization_source` enum: `SYSTEM_DEFAULT`, `USER_CREATED`, `ML_MODEL`, `USER_OVERRIDE`, `USER_LEARNED`
- `webapp/src/actions/categorize.ts` (line 164) — Sets `USER_OVERRIDE` on manual category change
- `webapp/src/actions/transactions.ts` (line 269) — Sets source on transaction update
- `webapp/src/actions/categorize.ts` (line 241) — Bulk operations set source

### Import Pipeline (callers of autoCategorize)
- `webapp/src/components/import/step-confirm.tsx` — Calls `autoCategorize()` during import confirm step
- `webapp/src/components/categorize/category-inbox.tsx` (line 36) — Calls `autoCategorize()` in categorize inbox

### Bank Parser Samples (for keyword expansion)
- `services/pdf_parser/parsers/bancolombia_credit_card.py` — Bancolombia credit card description formats
- `services/pdf_parser/parsers/bancolombia_savings.py` — Bancolombia savings description formats
- `services/pdf_parser/parsers/nequi_savings.py` — Nequi description formats
- `services/pdf_parser/parsers/nu_credit_card.py` — Nu description formats

### Research
- `.planning/research/ARCHITECTURE.md` (lines 157-159) — Recommends pad-and-search for word boundaries
- `.planning/research/STACK.md` (lines 79, 110-119) — No external libraries; REGEX_RULES example

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- NFD + diacritic removal pattern in 3 files — extract once, use everywhere
- `categorization_source` enum already distinguishes manual vs automatic — no migration needed
- `pattern-extract.ts` regex patterns for noise token removal — adapt for description normalization
- Category UUID constants from Phase 2 (`@zeta/shared/constants/categories`) — use for rule definitions
- Existing `KEYWORD_RULES` structure with keywords-to-category mapping — extend, don't replace

### Established Patterns
- `autoCategorize()` returns `{ categoryId, merchantName, confidence }` — preserve this interface
- Confidence levels: user-learned (0.9), keyword (0.7) — regex fits at 0.8
- `@zeta/shared` is pure TypeScript, no framework deps — engine changes stay portable
- Existing trailing-space keywords (`"d1 "`, `"ara "`) are boundary hacks — clean up during migration

### Integration Points
- `packages/shared/src/utils/auto-categorize.ts` — Primary file to modify (normalization, word boundary, regex rules, keyword expansion)
- `packages/shared/src/index.ts` — May need to export new types if regex rule interface is public
- Import pipeline callers (`step-confirm.tsx`, `category-inbox.tsx`) — Add `categorization_source` guard to skip re-categorization of manual transactions
- `webapp/src/actions/import-transactions.ts` — Import action should pass `categorization_source` to the guard check

</code_context>

<specifics>
## Specific Ideas

No specific requirements — straightforward engine improvement with clear patterns from research and existing codebase.

</specifics>

<deferred>
## Deferred Ideas

- User-manageable categorization rules CRUD screen — Phase 7 (CATUX) or v2 (CAT-V2-01)
- Category hierarchy / subcategories — v2 (CAT-V2-02)
- Bulk re-categorize existing transactions when rules change — v2 (CAT-V2-03)
- Inline category quick-edit in transaction list — Phase 7 (CATUX-01)
- Unreviewed transactions queue after import — Phase 7 (CATUX-02)

</deferred>

---

*Phase: 03-categorization-engine*
*Context gathered: 2026-03-25*

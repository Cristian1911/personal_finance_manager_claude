# Phase 3: Categorization Engine - Discussion Log (Auto Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-03-25
**Phase:** 03-categorization-engine
**Mode:** auto (assumptions-based, all decisions auto-resolved)
**Areas analyzed:** Normalization, Word Boundary Matching, Regex Rules, Manual Categorization Protection

---

## Normalization Strategy

| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Normalize inside `autoCategorize()` using NFD + diacritic strip pattern | Confident | `quick-capture.ts:69`, `reconciliation.ts:48`, `auto-categorize.ts:171` only does `toLowerCase()` |
| Extract shared helper within auto-categorize module, no external library | Confident | `.planning/research/STACK.md:79` says "Do NOT add a library" |

**Auto-resolved:** Normalize inside engine. Callers never pre-normalize.

---

## Word Boundary Matching

| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Pad-and-search (`' ' + desc + ' '`) over `\b` regex | Likely | `.planning/research/ARCHITECTURE.md:157-159` recommends this approach |
| Clean up existing trailing-space keyword hacks | Likely | `auto-categorize.ts` lines 26, 39, 83, 147 have `"d1 "`, `"ara "`, `"metro "`, etc. |

**Alternatives considered:**
- Alt 1: Pad-and-search (selected) — handles Colombian bank separators, no Unicode edge cases
- Alt 2: `\b` regex after thorough ASCII normalization — cleaner syntax but risky with `*`, `/` separators

**Auto-resolved:** Pad-and-search approach (recommended by research).

---

## Manual Categorization Protection

| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Reuse `categorization_source` enum instead of new boolean | Likely | `database.ts:1029-1034` has `USER_OVERRIDE`, `USER_CREATED`; `reconciliation.ts:158-159` already checks these |
| No schema migration needed | Likely | Existing data already has correct `categorization_source` values set |

**Alternatives considered:**
- Alt 1: Guard clause using `categorization_source IN ('USER_CREATED', 'USER_OVERRIDE')` (selected) — zero changes, consistent with reconciliation
- Alt 2: Add `manually_categorized BOOLEAN` column with backfill migration — more explicit but duplicates existing data

**Auto-resolved:** Guard clause using existing enum (zero schema changes).

---

## Regex Rules Integration

| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| `REGEX_RULES` array at confidence 0.8, between user-learned (0.9) and keywords (0.7) | Confident | `.planning/research/STACK.md:110-119` provides concrete example |
| Pre-compiled `RegExp` objects targeting multi-word Colombian patterns | Confident | `pattern-extract.ts:9-23` establishes regex as an accepted pattern |

**Auto-resolved:** New REGEX_RULES array with confidence 0.8.

---

## Auto-Resolved Summary

All 4 areas auto-resolved with recommended defaults:
1. Normalization → inside engine, NFD pattern
2. Word boundary → pad-and-search
3. Manual protection → existing categorization_source enum
4. Regex rules → REGEX_RULES at confidence 0.8

## Deferred Ideas

- Categorization rules CRUD UI → Phase 7 / v2
- Category hierarchy → v2
- Bulk re-categorize → v2

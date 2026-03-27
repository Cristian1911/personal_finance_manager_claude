---
phase: 02-income-data-foundation
plan: "02"
subsystem: shared-package
tags: [constants, uuid, validation, refactoring, data-hygiene]
dependency_graph:
  requires: []
  provides:
    - packages/shared/src/constants/categories.ts — single source of truth for 21 seed category UUIDs
    - webapp/src/lib/validators/shared.ts — shared permissive UUID validator
  affects:
    - webapp/src/actions/recurring-templates.ts
    - webapp/src/actions/purchase-decision.ts
    - webapp/src/lib/validators/transaction.ts
    - mobile/lib/transaction-semantics.ts
    - mobile/app/subscriptions.tsx
    - mobile/lib/demo-data.ts
tech_stack:
  added: []
  patterns:
    - "Shared constants barrel: packages/shared/src/constants/ → re-exported from @zeta/shared"
    - "Permissive UUID validator: uuidStr() from webapp/src/lib/validators/shared.ts replaces z.string().uuid() for seed UUIDs"
key_files:
  created:
    - packages/shared/src/constants/categories.ts
    - webapp/src/lib/validators/shared.ts
  modified:
    - packages/shared/src/index.ts
    - packages/shared/src/utils/auto-categorize.ts
    - webapp/src/actions/recurring-templates.ts
    - webapp/src/actions/purchase-decision.ts
    - webapp/src/lib/validators/transaction.ts
    - mobile/lib/transaction-semantics.ts
    - mobile/app/subscriptions.tsx
    - mobile/lib/demo-data.ts
decisions:
  - "Re-export DEBT_PAYMENT_CATEGORY_ID from mobile/lib/transaction-semantics.ts via @zeta/shared to preserve backward compat for existing consumers"
  - "Keep SEED_CATEGORY_IDS map shape identical to old CAT object — auto-categorize.ts uses it as drop-in replacement"
metrics:
  duration_minutes: 3
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_changed: 9
---

# Phase 02 Plan 02: UUID Constants Consolidation Summary

**One-liner:** Single-source seed category constants in @zeta/shared and permissive UUID regex validator replacing z.string().uuid() in all server actions.

## What Was Built

### Task 1: Shared Category Constants

Created `packages/shared/src/constants/categories.ts` as the single source of truth for all 21 seed category UUIDs. Exports:
- 21 individual `CATEGORY_*` constants
- `SEED_CATEGORY_IDS` map object (preserves the `CAT.*` access pattern used in auto-categorize)
- Convenience aliases: `DEBT_PAYMENT_CATEGORY_ID`, `TRANSFER_CATEGORY_ID`, `SUBSCRIPTIONS_CATEGORY_ID`

Barrel-exported from `packages/shared/src/index.ts` so all consumers import from `@zeta/shared`.

Updated all consumers:
- `auto-categorize.ts`: replaced local `const CAT = { ... }` with `import { SEED_CATEGORY_IDS as CAT }`
- `recurring-templates.ts`: replaced two hardcoded const strings with `@zeta/shared` named imports
- `mobile/lib/transaction-semantics.ts`: replaced local const with re-export from `@zeta/shared`
- `mobile/app/subscriptions.tsx`: imports `SUBSCRIPTIONS_CATEGORY_ID` from `@zeta/shared`
- `mobile/lib/demo-data.ts`: imports 4 category constants, replaces all hardcoded UUID strings in DEMO_CATEGORIES and demoTransactions arrays

### Task 2: Shared UUID Validator

Created `webapp/src/lib/validators/shared.ts` with:
- `UUID_RE`: permissive 8-4-4-4-12 hex regex (case-insensitive)
- `uuidStr(msg?)`: Zod validator factory using the regex instead of `z.string().uuid()`

Refactored `transaction.ts` to import `uuidStr` from `./shared` (eliminates local duplication).

Fixed all `z.string().uuid()` calls in server actions:
- `recurring-templates.ts`: `templateId` and `sourceAccountId` in `recurringOccurrencePaymentSchema`
- `purchase-decision.ts`: `accountId` and `categoryId` in `purchaseDecisionSchema`

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- `pnpm build` passes clean (zero type errors)
- `grep -rn "z.string().uuid()" webapp/src/actions/` → zero matches
- `grep -rn "a0000001-0001-4000-8000" webapp/src/actions/ packages/shared/src/utils/ mobile/lib/ mobile/app/` → zero matches (all replaced with imports)
- Barrel export confirmed in `packages/shared/src/index.ts`
- `uuidStr` exported from `webapp/src/lib/validators/shared.ts`

## Commits

- `fc52fd3`: feat(02-02): consolidate seed category UUIDs into shared constants
- `12e0371`: fix(02-02): extract shared UUID validator and fix z.string().uuid() calls

## Self-Check: PASSED

---
phase: 01-security-foundation
plan: 02
subsystem: auth
tags: [supabase, admin-client, type-safety, error-handling]

# Dependency graph
requires: []
provides:
  - "createAdminClient() throws descriptive error on missing SUPABASE_SECRET_KEY instead of returning null"
  - "All 36 createAdminClient()! non-null assertions removed from 13 action files"
  - "product-events.ts falls back gracefully via try/catch when admin client unavailable"
affects: [all phases using createAdminClient()]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-fast factory pattern: createAdminClient() throws on misconfiguration instead of returning null"
    - "Graceful degradation via try/catch for optional admin client usage (product-events)"

key-files:
  created: []
  modified:
    - webapp/src/lib/supabase/admin.ts
    - webapp/src/actions/charts.ts
    - webapp/src/actions/recurring-templates.ts
    - webapp/src/actions/profile.ts
    - webapp/src/actions/categorize.ts
    - webapp/src/actions/categories.ts
    - webapp/src/actions/burn-rate.ts
    - webapp/src/actions/budgets.ts
    - webapp/src/actions/accounts.ts
    - webapp/src/actions/income.ts
    - webapp/src/actions/debt.ts
    - webapp/src/actions/payment-reminders.ts
    - webapp/src/actions/destinatarios.ts
    - webapp/src/actions/statement-snapshots.ts
    - webapp/src/actions/product-events.ts

key-decisions:
  - "createAdminClient() return type is now inferred (non-null SupabaseClient<Database>) — no explicit annotation needed since throw eliminates null path"
  - "product-events.ts special-cased with try/catch (not assertion removal) because it has intentional graceful degradation semantics"

patterns-established:
  - "Fail-fast factory pattern: config factory throws descriptive error instead of returning null"
  - "Optional admin client: try/catch fallback to user-scoped client when admin unavailable"

requirements-completed:
  - SEC-04

# Metrics
duration: 12min
completed: 2026-03-25
---

# Phase 01 Plan 02: Admin Client Hardening Summary

**createAdminClient() now throws descriptive Error on missing SUPABASE_SECRET_KEY, removing 36 non-null assertions and replacing a defunct null-check in product-events.ts with a try/catch fallback**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-25T15:00:00Z
- **Completed:** 2026-03-25T15:12:00Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- admin.ts hardened: misconfiguration now fails immediately with a descriptive error instead of silently returning null
- 36 `createAdminClient()!` non-null assertions removed from 13 server action files — TypeScript now correctly infers the non-null return type
- product-events.ts converted from defunct `?? supabase` null-check to `try/catch` fallback, preserving graceful degradation intent
- `pnpm build` passes clean with no TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Change createAdminClient() to throw on missing key** - `c150a17` (feat)
2. **Task 2: Remove ! assertions from 13 action files and fix product-events.ts fallback** - `c5adb5b` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `webapp/src/lib/supabase/admin.ts` - Replaced null return with throw; return type now inferred as non-null SupabaseClient<Database>
- `webapp/src/actions/charts.ts` - 7 ! assertions removed
- `webapp/src/actions/recurring-templates.ts` - 4 ! assertions removed
- `webapp/src/actions/categorize.ts` - 3 ! assertions removed
- `webapp/src/actions/categories.ts` - 5 ! assertions removed
- `webapp/src/actions/destinatarios.ts` - 5 ! assertions removed
- `webapp/src/actions/profile.ts` - 2 ! assertions removed
- `webapp/src/actions/budgets.ts` - 2 ! assertions removed
- `webapp/src/actions/accounts.ts` - 2 ! assertions removed
- `webapp/src/actions/statement-snapshots.ts` - 2 ! assertions removed
- `webapp/src/actions/burn-rate.ts` - 1 ! assertion removed
- `webapp/src/actions/income.ts` - 1 ! assertion removed
- `webapp/src/actions/debt.ts` - 1 ! assertion removed
- `webapp/src/actions/payment-reminders.ts` - 1 ! assertion removed
- `webapp/src/actions/product-events.ts` - Replaced `createAdminClient() ?? supabase` with try/catch fallback

## Decisions Made
- Used inferred return type in admin.ts (no explicit annotation) — TypeScript infers `SupabaseClient<Database>` automatically because the only code path that doesn't throw returns the client
- product-events.ts received try/catch (not plain assertion removal) because it has intentional graceful degradation semantics — admin client is optional there, user-scoped client is the fallback

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- Build lock conflict from parallel agent execution; resolved by removing stale `.next/lock` file before retrying build

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Admin client is now correctly typed and fail-fast; all downstream action files reference it without ! assertions
- TypeScript catches any future misuse at compile time
- Ready for subsequent security foundation work

---
*Phase: 01-security-foundation*
*Completed: 2026-03-25*

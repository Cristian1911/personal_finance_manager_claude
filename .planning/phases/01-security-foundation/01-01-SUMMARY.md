---
phase: 01-security-foundation
plan: 01
subsystem: auth
tags: [middleware, nextjs, error-boundaries, route-protection, security]

# Dependency graph
requires: []
provides:
  - Blacklist-based middleware that automatically protects all future routes
  - Dashboard error boundary (DashboardError) with Spanish recovery UI
  - Custom 404 page with navigation to /dashboard and /login
  - Root layout error boundary (GlobalError) for catastrophic failures
affects:
  - All future routes added to the app (auto-protected by blacklist)
  - 02-type-safety (error handling patterns established)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Blacklist middleware: publicPaths array instead of protectedPaths whitelist
    - Next.js error.tsx requires "use client" and must export reset prop handler
    - global-error.tsx must include <html> and <body> with inline styles (Tailwind unavailable at root crash level)

key-files:
  created:
    - webapp/src/app/(dashboard)/error.tsx
    - webapp/src/app/not-found.tsx
    - webapp/src/app/global-error.tsx
  modified:
    - webapp/src/lib/supabase/middleware.ts

key-decisions:
  - "Blacklist over whitelist: publicPaths=[login,signup,forgot-password,onboarding,auth] — new routes auto-protected"
  - "global-error.tsx uses inline styles, not Tailwind — root layout is unavailable when this fires"
  - "DashboardError uses <a href> not <Link> to /dashboard — Link can re-trigger the same crash context"

patterns-established:
  - "Middleware blacklist: add to publicPaths to opt out of protection, not a whitelist to opt in"
  - "Error pages: Spanish strings, console.error only (no error details in UI)"

requirements-completed: [SEC-01, SEC-02, SEC-03]

# Metrics
duration: 15min
completed: 2026-03-25
---

# Phase 01 Plan 01: Security Foundation — Middleware & Error Boundaries Summary

**Blacklist-based middleware protecting all routes automatically, plus three Spanish error recovery pages for dashboard crashes, 404s, and root layout failures.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-25T14:35:00Z
- **Completed:** 2026-03-25T14:50:29Z
- **Tasks:** 2
- **Files modified:** 4 (1 modified, 3 created)

## Accomplishments

- Replaced 6-item `protectedPaths` whitelist with 5-item `publicPaths` blacklist — future routes auto-protected
- Created `(dashboard)/error.tsx`: client boundary with "Intentar de nuevo" (reset) and hard `<a href>` to /dashboard
- Created `not-found.tsx`: branded 404 server component linking to /dashboard and /login
- Created `global-error.tsx`: root crash boundary with inline styles (Tailwind unavailable at root level), Spanish text

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite middleware to blacklist pattern** - `eb06804` (feat)
2. **Task 2: Add error pages — dashboard error.tsx, not-found.tsx, global-error.tsx** - `186fe83` (feat)

## Files Created/Modified

- `webapp/src/lib/supabase/middleware.ts` - Replaced protectedPaths whitelist with publicPaths blacklist
- `webapp/src/app/(dashboard)/error.tsx` - Dashboard error boundary with Spanish UI and reset/navigate-back buttons
- `webapp/src/app/not-found.tsx` - Custom 404 server component with /dashboard and /login links
- `webapp/src/app/global-error.tsx` - Root layout error boundary with inline styles and Spanish text

## Decisions Made

- **Blacklist pattern**: `publicPaths` contains exactly `/login`, `/signup`, `/forgot-password`, `/onboarding`, `/auth`. `isProtected = !isPublic` ensures any new route is protected by default without a code change.
- **global-error.tsx uses inline styles**: Tailwind CSS is injected by the root layout — when that layout crashes, the stylesheet is not loaded. Inline styles ensure the error UI renders correctly.
- **Hard `<a href>` in DashboardError**: Using `<Link>` to navigate out of an error boundary can re-trigger the same error via React's client-side routing. A plain anchor forces a full browser navigation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Middleware blacklist is active and immediately protects all existing and future routes
- Error boundaries are in place — dashboard crashes and 404s now show friendly Spanish recovery UI instead of blank screens
- Phase 01 Plan 02 can proceed (type safety cleanup); no dependencies from this plan block it

---
*Phase: 01-security-foundation*
*Completed: 2026-03-25*

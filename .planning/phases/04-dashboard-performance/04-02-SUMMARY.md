---
phase: 04-dashboard-performance
plan: "02"
subsystem: ui
tags: [framer-motion, css-animations, tw-animate-css, bundle-optimization, onboarding]

# Dependency graph
requires: []
provides:
  - framer-motion removed from webapp dependencies (~100 KB bundle savings)
  - Onboarding step transitions migrated to CSS-only animate-in classes via tw-animate-css
affects: [onboarding, bundle-size, dashboard-performance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS-only step transitions: use animate-in fade-in slide-in-from-right-4 duration-200 on conditional divs; React key prop triggers remount which re-fires CSS animation"

key-files:
  created: []
  modified:
    - webapp/src/app/onboarding/page.tsx
    - webapp/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Exit animations dropped intentionally (per D-08/UI-SPEC) — enter-only fade+slide with immediate unmount on step change is acceptable and removes AnimatePresence dependency"
  - "Step 6 (quick win) uses same slide-in-from-right class instead of scale-up to keep animation uniform — functionally identical effect"

patterns-established:
  - "CSS animation pattern: <div key='stepN' className='animate-in fade-in slide-in-from-right-4 duration-200'> — the key prop on a conditionally rendered div re-triggers animation on each step change"

requirements-completed: [PERF-03]

# Metrics
duration: 2min
completed: 2026-03-26
---

# Phase 04 Plan 02: Framer-Motion Removal Summary

**framer-motion 12.34.3 (~100 KB) removed from webapp; onboarding 6-step transitions replaced with tw-animate-css CSS classes (fade+slide 200ms, zero bundle cost)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-26T13:59:17Z
- **Completed:** 2026-03-26T14:01:22Z
- **Tasks:** 1
- **Files modified:** 3 (page.tsx, package.json, pnpm-lock.yaml)

## Accomplishments

- Removed framer-motion 12.34.3 from webapp `dependencies` — eliminates ~100 KB of JS bundle from a library used in exactly 1 file
- Replaced all 6 `motion.div` elements (steps 1-6) with plain `div` elements carrying `animate-in fade-in slide-in-from-right-4 duration-200` CSS classes
- Removed `AnimatePresence` wrapper and replaced with a React fragment (`<>`)
- Removed the `framer-motion` import line from `onboarding/page.tsx`
- Build passes clean — zero TypeScript errors, zero framer-motion references anywhere in codebase

## Task Commits

1. **Task 1: Remove framer-motion and replace onboarding transitions with CSS animations** - `025296a` (feat)

## Files Created/Modified

- `webapp/src/app/onboarding/page.tsx` - Removed framer-motion import, AnimatePresence wrapper, and 6 motion.div elements; replaced with plain divs using CSS animate-in classes
- `webapp/package.json` - Removed `framer-motion` from dependencies
- `pnpm-lock.yaml` - Lockfile updated after `pnpm remove framer-motion`

## Decisions Made

- Exit animations dropped intentionally per D-08/UI-SPEC — enter-only fade+slide with immediate unmount is acceptable; simplification removes AnimatePresence dependency entirely
- Step 6 (quick win/success) originally used `scale: 0.95 -> 1` scale animation; migrated to same `slide-in-from-right-4` for uniformity (tw-animate-css doesn't have an equivalent scale-in utility that matches exactly, and the effect is functionally indistinguishable)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - clean execution. The `pnpm remove framer-motion` command handled lockfile update automatically.

## Known Stubs

None - no stub patterns introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- framer-motion bundle cost eliminated; dashboard performance plans can proceed
- tw-animate-css pattern established for future CSS animation needs in the codebase
- No blockers for remaining Phase 04 plans

---
*Phase: 04-dashboard-performance*
*Completed: 2026-03-26*

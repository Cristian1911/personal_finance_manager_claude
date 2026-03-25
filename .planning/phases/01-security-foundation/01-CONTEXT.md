# Phase 1: Security Foundation - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden middleware route protection, add error recovery pages (`error.tsx`, `not-found.tsx`), and make `createAdminClient()` fail explicitly. No visual features — this is invisible infrastructure that makes every subsequent phase safer.

</domain>

<decisions>
## Implementation Decisions

### Middleware Strategy
- **D-01:** Use blacklist approach — protect ALL routes under `/(dashboard)/` by default, only whitelist known public routes (`/login`, `/signup`, `/forgot-password`, `/onboarding`). This is safer than the current whitelist of 6 paths because new routes are automatically protected.
- **D-02:** Replace the `protectedPaths` array with a `publicPaths` array check. If the path is NOT in `publicPaths` and NOT a static asset, it requires authentication.

### Error Boundary
- **D-03:** Add `error.tsx` at `webapp/src/app/(dashboard)/error.tsx` — catches all errors within the dashboard layout segment.
- **D-04:** Error page shows a Spanish message ("Algo salio mal"), a brief explanation, and a "Volver al dashboard" button. No error details in production (log to `console.error` only).
- **D-05:** Must be a Client Component (`"use client"`) per Next.js requirement. Keep it minimal — no heavy imports.

### Not-Found Page
- **D-06:** Add `not-found.tsx` at `webapp/src/app/not-found.tsx` (root level — covers all routes).
- **D-07:** Shows "Pagina no encontrada" with navigation options: link to dashboard and link to login. Spanish copy, consistent with app styling.

### Admin Client
- **D-08:** `createAdminClient()` should throw an explicit `Error("Admin client unavailable: SUPABASE_SECRET_KEY not set")` instead of returning `null`.
- **D-09:** All 37 call sites currently use `createAdminClient()!` (non-null assertion). After the change, remove the `!` assertions since the function now always returns a client or throws.

### Claude's Discretion
- Error boundary reset mechanism (retry vs navigate) — Claude can pick the best UX pattern
- Whether to add a global `error.tsx` at root level in addition to the dashboard one
- Exact middleware path matching logic (startsWith vs regex)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Middleware
- `webapp/middleware.ts` — Entry point, delegates to `updateSession()`
- `webapp/src/lib/supabase/middleware.ts` — Contains `protectedPaths` array (lines 49-56) and redirect logic

### Admin Client
- `webapp/src/lib/supabase/admin.ts` — `createAdminClient()` returns null when key missing (37 callers use `!`)

### Dashboard Layout
- `webapp/src/app/(dashboard)/layout.tsx` — Dashboard layout with auth check
- `webapp/src/app/(dashboard)/loading.tsx` — Existing loading state

### Route Structure
- Dashboard routes: `/dashboard`, `/transactions`, `/accounts`, `/categories`, `/destinatarios`, `/settings`, `/deudas`, `/import`, `/categorizar`, `/recurrentes`, `/gestionar`
- Auth routes: `/login`, `/signup`, `/forgot-password`
- Onboarding: `/onboarding`

### Research Findings
- `.planning/codebase/CONCERNS.md` — Documents middleware gap (lines 106-111) and admin client risk (lines 82-86)
- `.planning/research/PITFALLS.md` — Pitfall 2: middleware security gap

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `webapp/src/app/(dashboard)/loading.tsx` — Existing loading component, can inform skeleton style for error/404 pages
- Tailwind v4 + shadcn/ui — Use `Button`, `Card` components for error/404 pages
- `lucide-react` icons — Available for error state illustrations

### Established Patterns
- Middleware delegates to `updateSession()` in `src/lib/supabase/middleware.ts`
- Auth check: `getUserSafely(supabase)` returns user or null
- All dashboard routes are under `(dashboard)/` route group
- Spanish-first UI: all user-facing strings in Spanish

### Integration Points
- `webapp/middleware.ts` — Only file that needs middleware logic change
- `webapp/src/lib/supabase/middleware.ts` — `protectedPaths` array to replace with `publicPaths`
- `webapp/src/lib/supabase/admin.ts` — Single function to modify
- `webapp/src/app/(dashboard)/error.tsx` — New file
- `webapp/src/app/not-found.tsx` — New file
- 37 files importing `createAdminClient()` — Remove `!` assertions

</code_context>

<specifics>
## Specific Ideas

No specific requirements — straightforward infrastructure hardening with clear best practices.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-security-foundation*
*Context gathered: 2026-03-25*

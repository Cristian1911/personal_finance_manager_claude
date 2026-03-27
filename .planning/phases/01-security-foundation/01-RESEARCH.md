# Phase 1: Security Foundation - Research

**Researched:** 2026-03-25
**Domain:** Next.js 15/16 App Router — middleware auth, error boundaries, admin client hardening
**Confidence:** HIGH

## Summary

This phase is pure infrastructure hardening with zero visual features. Four independent changes
touch: (1) middleware route-protection logic, (2) a new dashboard-level error boundary, (3) a
new root-level 404 page, and (4) the admin Supabase client constructor. All four are well-understood
Next.js App Router patterns with no third-party libraries required.

The riskiest sub-task is the admin client change. One call site — `product-events.ts` — already
uses `createAdminClient() ?? supabase` as a deliberate null-fallback, not a `!` assertion. That
site must NOT have the null-assertion removed; it must instead be updated to use a try/catch so
the throw is caught gracefully. All other 36 call sites use `!` and can safely drop the assertion
once the function throws instead of returning null.

The middleware change is safe and surgical: swap a 6-path whitelist for a public-paths blacklist
using the same `startsWith()` check. The existing matcher in `webapp/middleware.ts` already
excludes static assets, so no change there is needed.

**Primary recommendation:** Implement in this order — (1) middleware rewrite, (2) error.tsx,
(3) not-found.tsx, (4) admin client + call-site cleanup. Each step is independently verifiable.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Blacklist approach — protect ALL routes under `/(dashboard)/` by default, only whitelist known public routes (`/login`, `/signup`, `/forgot-password`, `/onboarding`).
- **D-02:** Replace `protectedPaths` array with a `publicPaths` array check. If the path is NOT in `publicPaths` and NOT a static asset, it requires authentication.
- **D-03:** `error.tsx` at `webapp/src/app/(dashboard)/error.tsx` — catches all errors within the dashboard layout segment.
- **D-04:** Error page shows Spanish message ("Algo salio mal"), brief explanation, "Volver al dashboard" button. No error details in production; log via `console.error` only.
- **D-05:** Must be a Client Component (`"use client"`). Keep minimal — no heavy imports.
- **D-06:** `not-found.tsx` at `webapp/src/app/not-found.tsx` (root level — covers all routes).
- **D-07:** Shows "Pagina no encontrada" with navigation: link to dashboard and link to login. Spanish copy, consistent with app styling.
- **D-08:** `createAdminClient()` throws `Error("Admin client unavailable: SUPABASE_SECRET_KEY not set")` instead of returning null.
- **D-09:** All 37 call sites that use `createAdminClient()!` — remove the `!` assertions since function now throws.

### Claude's Discretion

- Error boundary reset mechanism (retry vs navigate) — pick best UX pattern
- Whether to add a global `error.tsx` at root level in addition to the dashboard one
- Exact middleware path matching logic (startsWith vs regex)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | All dashboard routes protected by middleware (not just the current 6-path list) | Middleware rewrite: replace `protectedPaths` whitelist with `publicPaths` blacklist in `webapp/src/lib/supabase/middleware.ts` |
| SEC-02 | Error boundary (`error.tsx`) at dashboard layout level for graceful failure recovery | New file: `webapp/src/app/(dashboard)/error.tsx` as a Client Component with `reset` prop |
| SEC-03 | Custom 404 page (`not-found.tsx`) with navigation back to dashboard | New file: `webapp/src/app/not-found.tsx` — root level, Server Component |
| SEC-04 | Admin client `createAdminClient()` throws descriptive error instead of returning null with `!` assertions | Modify `webapp/src/lib/supabase/admin.ts`, update 36 `!` call sites across 13 files + handle `product-events.ts` fallback pattern |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.1.6 (in use) | File-based error/404 pages, middleware | Built-in — no install |
| React | 19.2.3 (in use) | Client Component error boundary via error.tsx | Built-in |
| shadcn/ui `Button` | in use | CTA buttons on error/404 pages | Already installed |
| `lucide-react` | in use | Optional icon for error/404 illustrations | Already installed |

### Supporting

No new packages needed. All required capabilities are already in the codebase.

**Installation:** None — zero new dependencies.

---

## Architecture Patterns

### Pattern 1: Next.js App Router Error Boundary (`error.tsx`)

**What:** A `"use client"` file placed in a route segment directory. Next.js wraps the segment's
`page.tsx` (and its subtree) in a React error boundary automatically.

**When to use:** Dashboard layout segment — catches any unhandled throw inside `(dashboard)/`.

**Props signature (verified in Next.js 15/16 docs):**
```typescript
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console only — no details in production UI
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <h2 className="text-xl font-semibold">Algo salió mal</h2>
      <p className="text-muted-foreground text-sm max-w-md">
        Ocurrió un error inesperado. Puedes intentar de nuevo o volver al dashboard.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          Intentar de nuevo
        </Button>
        <Button asChild>
          <a href="/dashboard">Volver al dashboard</a>
        </Button>
      </div>
    </div>
  );
}
```

**Discretion recommendation (retry vs navigate):** Include BOTH buttons. `reset` triggers a
re-render without losing navigation context; the "Volver al dashboard" link is a hard `<a>` so
it works even if client-side router state is corrupted.

**Root-level global-error.tsx:** Recommend adding `webapp/src/app/global-error.tsx` as well.
`global-error.tsx` catches errors in the root layout itself (e.g., header crash). It must also
include `<html>` and `<body>` tags since it replaces the root layout. Keep it simpler — just a
"Volver al inicio" link.

### Pattern 2: Next.js App Router Not-Found Page (`not-found.tsx`)

**What:** A Server Component at `webapp/src/app/not-found.tsx`. Rendered when `notFound()` is
called anywhere, or when no route matches. Root placement covers ALL routes.

**Example:**
```typescript
// webapp/src/app/not-found.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
      <h1 className="text-4xl font-bold">404</h1>
      <h2 className="text-xl font-semibold">Página no encontrada</h2>
      <p className="text-muted-foreground text-sm max-w-md">
        La página que buscas no existe o fue movida.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/dashboard">Ir al dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/login">Iniciar sesión</Link>
        </Button>
      </div>
    </div>
  );
}
```

### Pattern 3: Middleware Blacklist for Auth

**What:** Flip the protection logic from "only listed paths are protected" to "everything is
protected unless listed as public."

**Current code (`webapp/src/lib/supabase/middleware.ts`, lines 49-59):**
```typescript
const protectedPaths = [
  "/dashboard", "/transactions", "/accounts",
  "/categories", "/destinatarios", "/settings",
];
const isProtected = protectedPaths.some((path) =>
  request.nextUrl.pathname.startsWith(path)
);
```

**New code:**
```typescript
const publicPaths = ["/login", "/signup", "/forgot-password", "/onboarding"];
const pathname = request.nextUrl.pathname;
const isPublic = publicPaths.some((p) => pathname.startsWith(p));
const isProtected = !isPublic;
```

**Discretion recommendation (startsWith vs regex):** Use `startsWith` — it's already the
project's established pattern, it's fast, and these paths have no ambiguous prefix overlap.
The root path `/` is implicitly handled by the existing `HomePage` which redirects based on
auth state, so it does NOT need to be in `publicPaths`.

**Important:** The `authPaths` redirect (logged-in user hitting `/login` → redirect to
`/dashboard`) remains unchanged. The `auth` group routes (`/auth/*`) are Next.js Auth Helpers
callback routes — verify they are covered by `publicPaths` or the existing matcher exclusions.
The current matcher already skips `_next/static`, `_next/image`, `favicon.ico`, and static
extensions. The `/auth` callback path (used by Supabase email confirmation) should be added to
`publicPaths` as well.

### Pattern 4: Admin Client — Throw on Missing Key

**What:** Change `createAdminClient()` to throw instead of returning null.

**New implementation:**
```typescript
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;

  if (!serviceRoleKey) {
    throw new Error("Admin client unavailable: SUPABASE_SECRET_KEY not set");
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
```

**Call site cleanup:** 36 occurrences of `createAdminClient()!` across 13 files — remove the
`!` (non-null assertion). The function now returns the client directly or throws; TypeScript will
infer the non-null return type automatically.

**Special case — `product-events.ts` line 39:**
```typescript
// BEFORE (null-fallback pattern — this is intentional, not a bug):
const db = createAdminClient() ?? supabase;

// AFTER (wrap in try/catch to preserve the graceful-fallback intent):
let db;
try {
  db = createAdminClient();
} catch {
  db = supabase;
}
```

This is the only call site that uses the null-return as a feature. After the change, it must
use try/catch to preserve the fallback behavior.

### Anti-Patterns to Avoid

- **Adding `error.tsx` at root without `<html>/<body>`:** Root-level error handling is split
  between `error.tsx` (layout children only) and `global-error.tsx` (entire root layout). If
  you add a root `error.tsx`, it will NOT catch root layout errors — use `global-error.tsx` for
  that. `global-error.tsx` must render `<html>` and `<body>` tags.
- **Using `<Link>` inside `error.tsx` reset button:** The `reset()` function re-renders the
  segment. For navigation OUT of the error state, use an anchor `<a>` or `useRouter().push()`
  inside a click handler — not `<Link>` which may re-trigger the same error.
- **Putting `/auth` in protectedPaths:** The Supabase `auth/confirm` and `auth/callback` routes
  handle email confirmation tokens. They must remain public. Verify the current `(auth)` route
  group paths are covered by the blacklist approach.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error boundary UI | Custom React error boundary class | `error.tsx` file convention | Next.js App Router handles the component boundary automatically |
| 404 detection | Checking `window.location` | `not-found.tsx` file convention | Next.js catches all unmatched routes + `notFound()` calls |
| Auth redirect logic | Custom middleware from scratch | Modify existing `updateSession()` | Already handles cookie refresh, Safari cache headers, auth-route redirects |

---

## Common Pitfalls

### Pitfall 1: The `/auth/*` Callback Path

**What goes wrong:** Supabase email confirmation links hit `/auth/confirm?token=...`. If the
blacklist marks this path as protected, logged-out users following email links get bounced to
`/login` before the token can be exchanged.

**Why it happens:** The route group `(auth)` in Next.js does NOT create a URL prefix — the
routes are still `/login`, `/signup`, etc. But the Supabase SSR library creates its own
`/auth/confirm` route under `webapp/src/app/auth/`. This path is NOT inside the `(auth)` group.

**How to avoid:** Add `/auth` to `publicPaths` alongside the other auth paths.

**Warning signs:** Email confirmation links redirect to login instead of completing sign-in.

### Pitfall 2: `product-events.ts` Silent Fallback

**What goes wrong:** After `createAdminClient()` throws, the existing `?? supabase` null-check
becomes dead code and TypeScript will warn that the left side is never nullish. Worse, an uncaught
throw propagates up through `trackProductEvent` and crashes the caller.

**Why it happens:** The function's type changes from `SupabaseClient | null` to `SupabaseClient`,
so the `??` never fires and the throw is unhandled.

**How to avoid:** Update `product-events.ts` to use try/catch (see Pattern 4 code above).

**Warning signs:** `pnpm build` TypeScript error on `??` operand never being null.

### Pitfall 3: TypeScript Return Type After Removing `!`

**What goes wrong:** After removing `!`, TypeScript infers `createAdminClient()` returns
`SupabaseClient<Database>` (non-null). Variables typed as `const supabase = createAdminClient()!`
become `const supabase = createAdminClient()`. No type change is needed — the type is now
correct without the assertion.

**Why it happens:** Non-null assertions suppress type errors; removing them is safe only because
the function now guarantees a value. This is correct behavior.

**How to avoid:** Do a mechanical find-and-replace of `createAdminClient()!` → `createAdminClient()`.
Run `pnpm build` to confirm no new type errors are introduced.

### Pitfall 4: Root vs Dashboard `error.tsx` Scope

**What goes wrong:** Adding `error.tsx` to `webapp/src/app/(dashboard)/` does NOT catch errors
in the root `layout.tsx` (e.g., global providers). For root layout errors, a separate
`global-error.tsx` at `webapp/src/app/global-error.tsx` is required.

**Why it happens:** `error.tsx` catches errors in its co-located `page.tsx` and the children
of its co-located `layout.tsx`, but NOT in the layout itself.

**How to avoid:** Add `global-error.tsx` with `<html>` and `<body>` tags for belt-and-suspenders
coverage. Keep it minimal — just a "Volver al inicio" message and link.

---

## Runtime State Inventory

> This phase is greenfield additions + in-place code edits. No rename/refactor/migration.

Not applicable — no stored data, service configs, OS state, secrets, or build artifacts are
affected by these changes.

---

## Environment Availability

> Skip: this phase is purely code/config changes. No external tools, services, CLIs, databases,
> or runtimes are added. `SUPABASE_SECRET_KEY` must be set in the deployment environment — this
> is a pre-existing requirement, not a new dependency.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — no test framework configured in `webapp/` |
| Config file | Not present |
| Quick run command | `cd webapp && pnpm build` (type-checking serves as validation gate) |
| Full suite command | `cd webapp && pnpm build` |

No vitest/jest config exists in `webapp/`. Testing infrastructure is deferred to `TEST-V2-01`
through `TEST-V2-03` (out of scope for this milestone). For this phase, `pnpm build` is the
primary automated validation gate — it catches type errors, missing imports, and malformed
React component signatures.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | Unauthenticated GET to `/deudas` redirects to `/login` | manual-only | `pnpm build` (type check) | N/A |
| SEC-02 | Runtime error in dashboard shows error page with "Volver al dashboard" | manual-only | `pnpm build` (type check) | ❌ Wave 0 — new file |
| SEC-03 | GET `/nonexistent` shows custom 404 page | manual-only | `pnpm build` (type check) | ❌ Wave 0 — new file |
| SEC-04 | Missing `SUPABASE_SECRET_KEY` causes `createAdminClient()` to throw, not return null | manual-only | `pnpm build` (type check) | N/A |

**Manual-only justification:** No test framework is available. All behaviors require either
middleware interception (Node.js runtime) or React rendering (browser/JSDOM) which cannot be
tested without a framework. The build gate ensures correct TypeScript signatures, correct
Client/Server Component boundaries, and that no `!` assertions remain on `createAdminClient()`.

### Sampling Rate

- **Per task commit:** `cd webapp && pnpm build`
- **Per wave merge:** `cd webapp && pnpm build`
- **Phase gate:** Full `pnpm build` green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `webapp/src/app/(dashboard)/error.tsx` — new file covering SEC-02
- [ ] `webapp/src/app/not-found.tsx` — new file covering SEC-03
- [ ] `webapp/src/app/global-error.tsx` — new file (discretion: belt-and-suspenders coverage)

*(No test framework installation needed — `pnpm build` is sufficient for this phase.)*

---

## Code Examples

### error.tsx — Dashboard Error Boundary

```typescript
// webapp/src/app/(dashboard)/error.tsx
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <h2 className="text-xl font-semibold">Algo salió mal</h2>
      <p className="text-muted-foreground text-sm max-w-md">
        Ocurrió un error inesperado. Puedes intentar de nuevo o volver al inicio.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          Intentar de nuevo
        </Button>
        <Button asChild>
          <a href="/dashboard">Volver al dashboard</a>
        </Button>
      </div>
    </div>
  );
}
```

### global-error.tsx — Root Layout Error Boundary (discretion addition)

```typescript
// webapp/src/app/global-error.tsx
"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
        <h2 className="text-xl font-semibold">Algo salió mal</h2>
        <button onClick={reset}>Intentar de nuevo</button>
        <a href="/">Volver al inicio</a>
      </body>
    </html>
  );
}
```

### not-found.tsx — Root 404 Page

```typescript
// webapp/src/app/not-found.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
      <h1 className="text-4xl font-bold text-muted-foreground">404</h1>
      <h2 className="text-xl font-semibold">Página no encontrada</h2>
      <p className="text-muted-foreground text-sm max-w-md">
        La página que buscas no existe o fue movida.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/dashboard">Ir al dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/login">Iniciar sesión</Link>
        </Button>
      </div>
    </div>
  );
}
```

### Middleware — Blacklist Pattern

```typescript
// In webapp/src/lib/supabase/middleware.ts — replace lines 49-59
const publicPaths = ["/login", "/signup", "/forgot-password", "/onboarding", "/auth"];
const pathname = request.nextUrl.pathname;
const isPublic = publicPaths.some((p) => pathname.startsWith(p));
const isProtected = !isPublic;

if (!user && isProtected) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("redirect", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}
```

### Admin Client — Throw Pattern

```typescript
// webapp/src/lib/supabase/admin.ts
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;

  if (!serviceRoleKey) {
    throw new Error("Admin client unavailable: SUPABASE_SECRET_KEY not set");
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `protectedPaths` whitelist (6 paths) | `publicPaths` blacklist | This phase | New routes auto-protected |
| `createAdminClient()` returns `null` | `createAdminClient()` throws | This phase | Misconfig surfaces at startup, not silently |
| No error boundary | `error.tsx` + `global-error.tsx` | This phase | Crash → recovery UI |
| Browser 404 (default Next.js) | Custom `not-found.tsx` | This phase | On-brand 404 with navigation |

---

## Open Questions

1. **`/auth` callback path scope**
   - What we know: Supabase SSR places `auth/confirm` at `webapp/src/app/auth/` (not inside the `(auth)` route group)
   - What's unclear: Whether there are additional `/auth/*` sub-paths that need to remain public
   - Recommendation: Add `/auth` to `publicPaths` to cover all Supabase auth callback URLs

2. **Root `page.tsx` under blacklist**
   - What we know: `webapp/src/app/page.tsx` redirects based on auth state — it is NOT a protected page itself
   - What's unclear: With a pure blacklist, `/` (root) is "protected" since it's not in `publicPaths`
   - Recommendation: The redirect at `/` is harmless — the layout auth check redirects unauthenticated users to `/login` anyway. Alternatively add `"/"` to `publicPaths` to be explicit.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — `webapp/middleware.ts`, `webapp/src/lib/supabase/middleware.ts`, `webapp/src/lib/supabase/admin.ts`, `webapp/src/app/(dashboard)/layout.tsx` — ground-truth current state
- Next.js App Router conventions — `error.tsx`, `global-error.tsx`, `not-found.tsx` file conventions verified against project's Next.js 16.1.6 + React 19

### Secondary (MEDIUM confidence)

- Next.js error handling docs pattern — `error: Error & { digest?: string }; reset: () => void` props signature is stable across Next.js 13–16

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all patterns from existing codebase
- Architecture: HIGH — all four changes are direct file edits with established Next.js conventions
- Pitfalls: HIGH — discovered from direct code inspection (product-events.ts null-fallback, /auth path)

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable domain — Next.js App Router conventions don't change frequently)

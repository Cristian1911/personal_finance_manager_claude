# Code Quality Analysis

**Analysis Date:** 2026-03-25

---

## 1. Test Coverage

### TypeScript / Frontend

**Unit tests — `@zeta/shared`:**
- Framework: Vitest 4.x
- Config: `packages/shared/vitest.config.ts` (globals: true)
- Test files:
  - `packages/shared/src/utils/__tests__/debt.test.ts` — `monthlyRateFromEA`, `estimateMonthlyInterest`
  - `packages/shared/src/utils/__tests__/debt-simulator.test.ts` — `runSimulation`, `allocateLumpSum`, `simulateSingleAccount`, `compareStrategies`
  - `packages/shared/src/utils/__tests__/scenario-engine.test.ts` — `expandCashEntries`, `getMinPayment`, `runScenario`
  - `packages/shared/src/utils/__tests__/helpers.ts` — test factory `makeAccount`
- Run: `cd packages/shared && pnpm test` (`vitest run`) or `pnpm test:watch`

**Unit tests — `webapp`:**
- Vitest 4.x is installed as a devDependency but **no `test` script is configured** in `webapp/package.json`
- Single test file: `webapp/src/lib/utils/__tests__/dashboard.test.ts`
  - Tests `getFreshnessLevel`, `getAccountSemanticColor`, `getCreditUtilizationColor`
- **No vitest config in webapp** — tests would require running `vitest` directly without a configured script

**E2E tests — `webapp`:**
- Framework: Playwright 1.58
- Config: `webapp/playwright.config.ts`
- Projects: `setup` (auth), `mobile` (Pixel 7), `desktop` (Chrome 1440px), `security` (no auth)
- Test files:
  - `webapp/e2e/security.spec.ts` — API auth enforcement, upload size limits, protected page redirects
  - `webapp/e2e/ux-audit.spec.ts` — UX audit assertions
  - `webapp/e2e/mobile-redesign.spec.ts` — mobile layout verification
- Auth state stored at `webapp/e2e/.auth/user.json`

**Python service:**
- `services/pdf_parser/test_parser.py` is a **CLI debugging tool**, not a pytest test suite — it contains no `def test_*` functions and no `pytest` import
- **Zero automated unit tests** for the Python parsers
- No `pytest` configuration (`pytest.ini`, `conftest.py`) found

### Coverage Summary

| Area | Unit Tests | E2E / Integration |
|------|-----------|-------------------|
| `@zeta/shared` utils | Good (debt math, scenario engine) | None |
| `webapp` utils | Minimal (1 file, 3 functions) | Security, UX, mobile E2E |
| `webapp` server actions (29 files) | None | None |
| `webapp` components | None | Playwright E2E |
| Python PDF parsers | **None** | Manual CLI only |

**Critical gap:** All 29 server action files in `webapp/src/actions/` have zero unit test coverage. The `webapp` also lacks a configured `test` script despite having vitest installed.

---

## 2. Type Safety

### TypeScript Configuration

Both `webapp/tsconfig.json` and `packages/shared/tsconfig.json` enable `"strict": true`, which activates:
- `strictNullChecks`
- `noImplicitAny`
- `strictFunctionTypes`
- `strictPropertyInitialization`

Additional flags in webapp: `isolatedModules: true`, `skipLibCheck: true`.

### Explicit `any` Usage

12 occurrences of `: any` or `as any` in `webapp/src/`:

| File | Usage | Reason |
|------|-------|--------|
| `src/app/(dashboard)/settings/analytics/page.tsx:51` | `(supabase as any).schema("analytics")` | Analytics schema not in generated types |
| `src/components/charts/enhanced-cashflow-chart.tsx:100` | `{ active, payload, label }: any` | Recharts tooltip callback typing |
| `src/components/debt/scenario-planner.tsx:271` | `savedScenarios as any[]` | Type mismatch with component prop |
| `src/components/mobile/tab-view-router.tsx:25-35` | `(data as any)` × 5 | Dynamic tab routing data passing |
| `src/actions/exchange-rate.ts:95` | `function formatCached(cached: any, ...)` | Cached Supabase row typing |
| `src/actions/import-transactions.ts:117` | `error as any` | Error code access pattern |
| `src/lib/utils/transactions.ts:1,17,18` | `query: any`, `buildQuery: () => any`, return `any` | Supabase query builder not typed |

**Most impactful:** `src/lib/utils/transactions.ts` exports three `any`-typed functions used across multiple action files. This propagates untyped queries through the codebase.

### Type Suppression Directives

4 `eslint-disable` comments found:
- `src/app/(dashboard)/settings/analytics/page.tsx` — `@typescript-eslint/no-explicit-any` (documented reason)
- `src/components/ui/currency-input.tsx` — `react-hooks/exhaustive-deps`
- `src/components/mobile/mobile-movimientos-presupuesto.tsx` — `@typescript-eslint/no-unused-vars`
- `src/components/mobile/mobile-movimientos.tsx` — `@typescript-eslint/no-unused-vars`

**Zero `@ts-ignore` or `@ts-nocheck` directives** — a positive signal.

---

## 3. Error Handling Patterns

### Server Actions

All server actions follow a consistent two-layer pattern:

**Layer 1 — Auth guard (unauthenticated early return):**
```typescript
const { user } = await getAuthenticatedClient();
if (!user) return { success: false, error: "No autenticado" };
```

**Layer 2 — Business logic wrapped in try/catch:**
```typescript
try {
  const data = await getSomethingCached(user.id);
  return { success: true, data };
} catch {
  return { success: false, error: "Error al cargar las cuentas" };
}
```

Errors are swallowed and returned as `ActionResult<T>` (`src/types/actions.ts`) — callers check `result.success` rather than catching. This is consistent across all 29 action files.

**Inconsistency:** Some catch blocks log to `console.error`/`console.warn` (8 occurrences in `categorize.ts`, `onboarding.ts`, `product-events.ts`, `scenarios.ts`), while most silently return error strings. No structured logging.

**Error detail loss:** `catch { }` with no binding (TypeScript 4+ syntax) is used in ~15 actions, meaning the actual error message is permanently discarded server-side. Debugging production errors requires server logs only.

### API Routes

`webapp/src/app/api/parse-statement/route.ts` pattern:
- Auth check first (returns 401)
- File size check (returns 400)
- API key guard (returns 503)
- `AbortSignal.timeout(120_000)` on upstream fetch
- Typed response passthrough with `.catch(() => fallback)`

### Zod Validation

All mutations use `schema.safeParse(...)` before proceeding — never `.parse()` (which throws). Error messages use `.issues[0].message` (Zod 4 convention), not `.errors[0].message`.

Validators live in `src/lib/validators/`:
- `account.ts`, `budget.ts`, `category.ts`, `dashboard-config.ts`, `destinatario.ts`, `import.ts`, `recurring-template.ts`, `scenario.ts`, `transaction.ts`, `auth.ts`

**UUID validation quirk:** `z.string().uuid()` is avoided everywhere in favor of a custom permissive regex (`/^[0-9a-f]{8}-...-$/i`) because Zod 4 rejects seed UUIDs (`a0000001-...`). This is documented in `CLAUDE.md` and in `src/lib/validators/transaction.ts`.

### Python Service

Errors in the FastAPI service (`services/pdf_parser/main.py`) raise `HTTPException` with appropriate HTTP status codes. The `test_parser.py` CLI catches all exceptions at the top level and prints to stderr with optional traceback in debug mode.

---

## 4. Code Organization Consistency

### Server Action Structure

The pattern in `webapp/src/actions/` is highly consistent — every file with cached reads follows:

```
"use server"
→ Cached inner function (private, "use cache" + cacheTag + cacheLife)
→ Public wrapper (auth guard + try/catch → ActionResult<T>)
→ Mutation functions (Zod parse + auth + DB write + revalidateTag)
```

Example from `webapp/src/actions/accounts.ts`:
```typescript
async function getAccountsCached(userId: string): Promise<Account[]> {
  "use cache";
  cacheTag("accounts");
  cacheLife("zeta");
  // uses createAdminClient() — bypasses RLS, user_id filter applied manually
}

export async function getAccounts(): Promise<ActionResult<Account[]>> {
  const { user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  try {
    return { success: true, data: await getAccountsCached(user.id) };
  } catch {
    return { success: false, error: "Error al cargar las cuentas" };
  }
}
```

### Component Organization

- `webapp/src/components/ui/` — shadcn/ui primitives (server-compatible, no `"use client"`)
- `webapp/src/components/dashboard/` — dashboard-specific widgets (mix of server/client)
- `webapp/src/components/charts/` — all 12 chart components are `"use client"` (Recharts requirement)
- `webapp/src/components/mobile/` — mobile-specific views, all client components

**Client vs Server split:**
- 141 files have `"use client"` out of 196 total `.tsx` files (72%)
- Server components are primarily `src/components/ui/` primitives and layout components

### Large Files (Complexity Signals)

Files over 500 lines indicate candidates for splitting:

| File | Lines | Notes |
|------|-------|-------|
| `src/types/database.ts` | 1,237 | Auto-generated — do not edit |
| `src/actions/recurring-templates.ts` | 885 | Multiple responsibilities |
| `src/actions/charts.ts` | 788 | Many chart data queries |
| `src/components/debt/debt-simulator.tsx` | 777 | Complex UI, recently extracted |
| `src/actions/import-transactions.ts` | 713 | Import pipeline logic |
| `src/actions/destinatarios.ts` | 710 | Multiple CRUD operations |
| `src/components/debt/planner/detail-step.tsx` | 657 | Form-heavy UI |
| `src/actions/categories.ts` | 653 | Many query variants |
| `src/app/onboarding/page.tsx` | 598 | Multi-step form |
| `src/components/destinatarios/destinatario-detail.tsx` | 565 | Complex detail view |

`src/actions/recurring-templates.ts` at 885 lines is the largest business logic file and covers template CRUD, occurrence generation, and payment recording. It is a candidate for splitting by responsibility.

---

## 5. Dead Code / Unused Exports

### Suppressed Unused Variable Warnings

Two components suppress `@typescript-eslint/no-unused-vars`:
- `src/components/mobile/mobile-movimientos-presupuesto.tsx:54`
- `src/components/mobile/mobile-movimientos.tsx:33`

These indicate local dead variables that should either be removed or used.

### No `ts-ignore` / `ts-nocheck`

Zero TypeScript suppression directives exist, meaning TypeScript enforces all exports are valid at build time. The `noEmit: true` in `tsconfig.json` combined with `pnpm build` (Turbopack) is the primary dead code detection mechanism.

### Observation

No barrel `index.ts` files in `webapp/src/components/` — all imports are direct file paths. This avoids circular dependency issues but means tree-shaking visibility is limited to what the bundler detects.

---

## 6. Bundle / Performance Considerations

### Next.js Caching Strategy

The app uses Next.js 15/16 `"use cache"` directive pattern (not `unstable_cache`). Cache parameters are defined in `webapp/next.config.ts`:

```typescript
cacheLife: {
  zeta: { stale: 300, revalidate: 300, expire: 3600 }
}
```

36 `"use cache"` directives across action files. Cache tags used: `accounts`, `debt`, `recurring`, `categorize`, `dashboard:charts`, `dashboard:hero`, `snapshots`. Mutations call `revalidateTag` to invalidate relevant tags.

### Code Splitting

Dynamic imports with `next/dynamic` are used in 5 locations:
- `webapp/src/app/(dashboard)/transactions/page.tsx`
- `webapp/src/app/(dashboard)/destinatarios/[id]/page.tsx`
- `webapp/src/app/(dashboard)/categorizar/page.tsx`
- `webapp/src/components/debt/scenario-planner.tsx`
- `webapp/src/components/mobile/tab-view-router.tsx`

All chart components in `src/components/charts/` are `"use client"` — they are only loaded on the client side but are not individually lazy-loaded.

### Suspense Boundaries

`Suspense` is used in `dashboard/page.tsx` (multiple boundaries with `animate-pulse` fallbacks) and `deudas/page.tsx`. Root layout wraps `{children}` in `<Suspense>` without a fallback.

### Heavy Dependencies

- `recharts@2.15.4` — large bundle (~450KB). All 12 chart components import from it directly rather than through a tree-shaken abstraction
- `framer-motion@^12.34.3` — used only in `src/app/onboarding/page.tsx` for `motion` and `AnimatePresence`. This is a large library for a single-page usage
- `date-fns@^4.1.0` — used widely, tree-shakes well with named imports
- `@supabase/supabase-js@^2.95.3` — large but unavoidable

**Optimization opportunity:** `framer-motion` is pulled in for one page only. Consider replacing with CSS transitions or `vaul` (already a dependency) for the onboarding animations.

### Auth Performance

`getAuthenticatedClient()` uses React `cache()` to deduplicate `getSession()` + `getUser()` calls within a single render. The fast path (`getSession()`, ~0ms local JWT) is used for 99% of requests; `getUser()` (~300ms network) is the fallback (`src/lib/supabase/auth.ts`).

### Server-Side Data Fetching

Dashboard page (`src/app/(dashboard)/dashboard/page.tsx`) fires multiple parallel data fetches using `Promise.all` within `charts.ts` cached functions. The dashboard page itself awaits ~8 independent data sources sequentially via individual `Suspense` wrapped components — this is correct for streaming but could benefit from more parallel pre-fetching at the page level.

---

## 7. Security Patterns

### Authentication Enforcement

**Middleware:** `webapp/middleware.ts` → `updateSession()` in `src/lib/supabase/middleware.ts`
- Runs on every request (except static assets)
- Checks `getUserSafely()` and redirects unauthenticated users to `/login?redirect=...`
- Protected paths: `/dashboard`, `/transactions`, `/accounts`, `/categories`, `/destinatarios`, `/settings`
- Clears stale auth cookies when no valid session exists

**Note:** `/import`, `/deudas`, `/presupuesto`, `/categorizar` are NOT in the `protectedPaths` array in `src/lib/supabase/middleware.ts`, even though they contain user data. The E2E test in `security.spec.ts` tests `/import` redirect but the middleware does not protect it.

**Server actions:** All 29 action files guard with:
```typescript
const { user } = await getAuthenticatedClient();
if (!user) return { success: false, error: "No autenticado" };
```

**API routes:** `src/app/api/_shared/auth.ts` handles both Bearer token (mobile/API clients) and session cookie auth. All API routes call `getRequestUser()` before processing.

### Row-Level Security

- `"use cache"` functions use `createAdminClient()` (service role key, bypasses RLS)
- Defense-in-depth: every admin client query includes `.eq("user_id", userId)` manually
- Categories with system rows use `.or(\`user_id.eq.${user.id},user_id.is.null\`)` pattern
- Mutation functions use the authenticated Supabase client (RLS enforced by Supabase)

### Input Validation

All mutation server actions use Zod `safeParse` before executing DB operations. No raw `formData.get()` values are sent to the database without schema validation.

PDF upload route enforces:
- File extension check (`.pdf` only)
- File size limit (10MB hard cap, checked server-side)
- API key requirement for upstream parser call

### PDF Parser Service Security

`services/pdf_parser/main.py` requires `X-Parser-Key` header on all endpoints. The key is validated via `fastapi.security.APIKeyHeader`. The service is not exposed publicly — it is called only through the Next.js proxy route.

### No Secret Leakage in Source

Zero `.env` files read or quoted. No hardcoded credentials found in source files. API keys are accessed via `process.env.*` with no fallback values.

---

## Summary: Quality Health by Area

| Area | Status | Priority |
|------|--------|----------|
| TypeScript strictness | Good — `strict: true` everywhere | — |
| `any` usage | Low (12 occurrences, localized) | Low |
| Server action consistency | Excellent — unified pattern | — |
| Zod validation | Comprehensive on all mutations | — |
| Auth enforcement | Good, with one gap (missing paths) | Medium |
| Unit test coverage | Poor — actions and components untested | High |
| Python unit tests | None — zero automated coverage | High |
| `webapp` test script | Missing — vitest installed but no script | Medium |
| Error detail on server | Lost in silent `catch {}` blocks | Medium |
| Bundle size | `framer-motion` over-imported | Low |
| `transactions.ts` types | `any` propagates through query builder | Low |
| Unused vars (suppressed) | 2 mobile components | Low |

---

*Quality analysis: 2026-03-25*

# Architecture

**Analysis Date:** 2026-03-25

## Pattern Overview

**Overall:** Monorepo — Next.js 15 App Router webapp + React Native mobile app + Python FastAPI microservice + shared utility package, all backed by Supabase (auth + Postgres + storage).

**Key Characteristics:**
- Server-first rendering: pages are async Server Components; data fetches happen server-side via Server Actions
- All mutation goes through Server Actions (`"use server"` functions in `webapp/src/actions/`), never direct API calls from client components
- Zero client-side data fetching for initial page loads — components receive props from their parent Server Component page
- Defense-in-depth auth: middleware + layout-level redirects + per-action auth checks
- Cache invalidation via `revalidateTag()` with a `"zeta"` namespace after every mutation

---

## System Components

```
zeta/ (pnpm monorepo)
├── webapp/          Next.js 15 (App Router) — primary user-facing app
├── mobile/          React Native / Expo — offline-first companion (mirrors webapp UX)
├── packages/
│   └── shared/      @zeta/shared — pure TS utilities consumed by webapp + mobile
├── services/
│   └── pdf_parser/  Python 3.14 / FastAPI — bank PDF statement parser
└── supabase/        Migration files (linked to remote Supabase project)
```

### Webapp (`webapp/`)
- **Framework:** Next.js 15 App Router, TypeScript, Tailwind CSS v4, shadcn/ui
- **Output mode:** `standalone` (Docker-deployable)
- **Build:** Turbopack (configured in `webapp/next.config.ts`)

### PDF Parser (`services/pdf_parser/`)
- **Framework:** FastAPI / Uvicorn on port 8000
- **Auth:** Shared secret `X-Parser-Key` header; requests without the key get 503
- **Parsers:** Bank-specific modules in `services/pdf_parser/parsers/` — Bancolombia, Banco de Bogotá, Davivienda, Nu, Falabella, Nequi, Confiar, Popular, Lulo, plus an OpenDataLoader fallback
- **Fallback:** `opendataloader_fallback.py` catches `ValueError` and unexpected exceptions from named parsers

### Shared Package (`packages/shared/`)
- Exported as `@zeta/shared` (workspace alias)
- Pure TypeScript — no framework dependencies (only `date-fns`)
- Consumed by both `webapp` and `mobile`
- Key exports: `autoCategorize`, `computeIdempotencyKey`, `reconciliation`, `debt`, `debt-simulator`, `scenario-engine`, `recurrence`, `snapshot-diff`, `destinatario-matcher`, `salary-breakdown`, `purchase-decision`, shared database/domain types

### Mobile (`mobile/`)
- React Native / Expo with NativeWind (Tailwind v3-compatible classes only)
- Offline-first: local SQLite via repositories in `mobile/lib/repositories/`
- Expo Router with `app/(auth)/` and `app/(tabs)/` route groups
- Webapp is the **design source of truth** — mobile mirrors it

### Supabase
- Project ID: `tgkhaxipfgskxydotdtu` (sa-east-1)
- No local Docker; all work against remote
- Migrations in `supabase/migrations/`; applied with `npx supabase db push`
- RLS enabled on all core tables (enforced via `(select auth.uid()) = user_id`)

---

## Layers (webapp)

**Route Layer:**
- Purpose: URL-to-page mapping, layout nesting, loading states
- Location: `webapp/src/app/`
- Contains: `page.tsx`, `layout.tsx`, `loading.tsx`, route handlers (`route.ts`)
- Depends on: Action Layer, Component Layer
- Used by: Browser / Next.js router

**Action Layer:**
- Purpose: Server-side data access and mutations — the only layer that reads/writes Supabase
- Location: `webapp/src/actions/`
- Contains: `"use server"` async functions, each returning `ActionResult<T>` or domain data
- Depends on: `@/lib/supabase/auth` (for `getAuthenticatedClient()`), `@zeta/shared`, validators
- Used by: Server Component pages (data reads), Client Components via `useActionState` (mutations)

**Component Layer:**
- Purpose: UI rendering
- Location: `webapp/src/components/`
- Contains: Server Components (read-only, receive data as props), Client Components (`"use client"` for interactivity)
- Depends on: Action Layer (Server Components call actions directly; Client Components call actions via hooks or `useActionState`)
- Used by: Route Layer

**Library Layer:**
- Purpose: Utilities, validators, Supabase client factories, constants
- Location: `webapp/src/lib/`
- Contains: `supabase/` (client factories), `validators/` (Zod schemas), `utils/` (currency, date, analytics, idempotency, recurrence)
- Depends on: Nothing app-specific
- Used by: Action Layer, Component Layer

**Type Layer:**
- Purpose: TypeScript type definitions
- Location: `webapp/src/types/`
- Contains: `database.ts` (Supabase-generated), `domain.ts` (aliased row types + computed shapes), `actions.ts` (`ActionResult<T>`, `PaginatedResult<T>`), `import.ts`, `dashboard-config.ts`
- Depends on: Nothing
- Used by: All layers

---

## Data Flow

**Server-rendered page load:**

1. Next.js middleware (`webapp/middleware.ts`) runs `updateSession()` — refreshes Supabase auth cookie and redirects unauthenticated requests to `/login`
2. Layout Server Component (`(dashboard)/layout.tsx`) calls `getUserSafely()` → redirects if unauthenticated or onboarding incomplete
3. Page Server Component calls actions in parallel via `Promise.all([...])`
4. Actions call `getAuthenticatedClient()` (React `cache()`-wrapped, deduplicates auth per request) → queries Supabase
5. Data passed as props to child components; page renders to HTML

**Client mutation:**

1. Client Component holds a `useActionState(action, initialState)` hook
2. User submits form → action called server-side
3. Action validates via Zod, queries Supabase, calls `revalidateTag(tag, "zeta")`
4. Next.js revalidates cached segments with that tag
5. `ActionResult<T>` returned to client — component shows success/error

**Cache tags in use:**
- `"dashboard:hero"`, `"dashboard:charts"`, `"dashboard:budgets"`, `"dashboard:cashflow"`, `"dashboard:accounts"` — invalidated by transaction mutations
- `"accounts"`, `"categorize"`, `"snapshots"`, `"debt"`, `"budgets"` — domain-scoped tags

**State Management:**
- Server state: Supabase + `revalidateTag`
- UI state: React `useState` / `useReducer` in Client Components (forms, wizards, modals)
- No global client-side state store (no Redux, no Zustand)
- Dashboard layout config: stored in `profiles.dashboard_config` JSONB column; read in layout, exposed via `DashboardConfigProvider` context

---

## Authentication Flow

**Signup:**
1. `(auth)/signup` page → `signUp()` Server Action in `webapp/src/actions/auth.ts`
2. `supabase.auth.signUp()` → Supabase sends email verification
3. User clicks email link → `GET /auth/callback` (`webapp/src/app/auth/callback/route.ts`)
4. `supabase.auth.exchangeCodeForSession(code)` → session cookie set
5. Redirect to `/dashboard` (or `/onboarding` if `onboarding_completed = false`)

**Login:**
1. `(auth)/login` page → `signIn()` Server Action
2. `supabase.auth.signInWithPassword()` → session cookie set
3. Redirect to `/dashboard`

**Session verification (two-tier):**
- Fast path: `getUserSafely()` tries `getSession()` first — local JWT check, ~0ms, no network
- Slow path: falls back to `getUser()` — ~300ms network call to Supabase Auth
- `getAuthenticatedClient()`: React `cache()`-wrapped, deduplicates within one server render; used by all Server Actions

**Supabase clients:**
- `webapp/src/lib/supabase/server.ts` — `createClient()` using `@supabase/ssr`, reads/writes cookies; used in layouts, pages, Server Actions
- `webapp/src/lib/supabase/client.ts` — `createClient()` using browser client; used in Client Components that need direct Supabase access
- `webapp/src/lib/supabase/admin.ts` — `createAdminClient()` using service role key; bypasses RLS; used sparingly
- `webapp/src/lib/supabase/auth.ts` — `getUserSafely()`, `getUserSafelyStrict()`, `getAuthenticatedClient()`

**Route protection:**
- Middleware (`webapp/middleware.ts`): guards `/dashboard`, `/transactions`, `/accounts`, `/categories`, `/destinatarios`, `/settings`
- Layout check (`(dashboard)/layout.tsx`): verifies user + profile + `onboarding_completed`

**API route auth (`/api/*`):**
- `webapp/src/app/api/_shared/auth.ts` `getRequestUser()`: accepts Bearer token (for mobile) or session cookie (for browser)

---

## App Router Structure

```
webapp/src/app/
├── layout.tsx                    Root layout — fonts, Toaster, ServerActionRecovery
├── page.tsx                      Root page — redirects to /dashboard or /login
│
├── (auth)/                       Route group — centered card layout, no sidebar
│   ├── layout.tsx                Auth layout (logo + card wrapper)
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
│
├── (dashboard)/                  Route group — sidebar + topbar + bottom tab bar
│   ├── layout.tsx                Dashboard layout (auth check, profile fetch, nav)
│   ├── loading.tsx               Skeleton for dashboard group
│   ├── dashboard/
│   │   ├── page.tsx              Main dashboard — widgets, hero, charts
│   │   └── loading.tsx
│   ├── transactions/
│   │   ├── page.tsx              Transaction list with filters
│   │   └── [id]/page.tsx         Transaction detail
│   ├── accounts/
│   │   ├── page.tsx              Account list
│   │   └── [id]/page.tsx         Account detail
│   ├── categories/page.tsx       Budget + category management
│   ├── categorizar/page.tsx      Bulk categorization inbox
│   ├── import/page.tsx           PDF import wizard
│   ├── deudas/
│   │   ├── page.tsx              Debt overview
│   │   └── planificador/page.tsx Debt payoff planner
│   ├── destinatarios/
│   │   ├── page.tsx              Recipients list
│   │   └── [id]/page.tsx         Recipient detail + rules
│   ├── recurrentes/page.tsx      Recurring transactions
│   ├── gestionar/page.tsx        Manage tools hub
│   └── settings/
│       ├── page.tsx              User settings
│       └── analytics/page.tsx    Analytics dashboard
│
├── auth/callback/route.ts        OAuth/email callback — exchanges code for session
├── onboarding/
│   ├── layout.tsx                Centered layout for onboarding flow
│   └── page.tsx                  6-step onboarding wizard (client component)
│
└── api/
    ├── _shared/auth.ts           Shared API auth helper (Bearer + cookie)
    ├── parse-statement/route.ts  PDF proxy → pdf_parser service
    ├── save-unrecognized/route.ts Forward unrecognized PDFs to parser storage
    ├── bug-reports/route.ts      Bug report submission (with file upload to Supabase Storage)
    └── health/route.ts           Health check
```

---

## PDF Import Flow

The import flow is a 6-step wizard in `webapp/src/components/import/import-wizard.tsx`.

**Step 1 — Upload (`step-upload.tsx`):**
- User selects PDF(s); optional password field for encrypted PDFs
- Client POSTs to `POST /api/parse-statement` (Next.js route handler)
- Route handler validates auth, checks file size (10 MB limit), proxies to `PDF_PARSER_URL/parse` with `X-Parser-Key` header and 120s timeout
- Python FastAPI service (`services/pdf_parser/main.py`) calls `detect_and_parse()` → routes to bank-specific parser
- Returns `ParseResponse { statements: ParsedStatement[] }`

**Step 2 — Review (`step-review.tsx`):**
- Wizard auto-matches each parsed statement to an existing account (by card last-4 or account number)
- User can reassign statement → account mappings, or create a new account
- User selects primary currency per account when multiple currencies appear

**Step 3 — Destinatarios (`step-destinatarios.tsx`):**
- Parsed transactions are matched against `DestinatarioRule[]` from `@zeta/shared`'s `destinatario-matcher`
- User confirms/adjusts merchant → destinatario assignments

**Step 4 — Confirm (`step-confirm.tsx`):**
- Final transaction list shown; user can deselect individual transactions
- Auto-categorization runs via `autoCategorize()` from `@zeta/shared`
- `previewImportReconciliation()` Server Action checks for existing manual transactions that may duplicate imports

**Step 5 — Reconcile (`reconciliation-step.tsx`):**
- Shown only when `reconciliationPreview` has `autoMerge` or `review` items
- `AUTO_MERGE`: manual transaction linked automatically, no user action needed
- `REVIEW`: user decides per-transaction — merge or keep both

**Step 6 — Results (`step-results.tsx`):**
- Client calls `importTransactions()` Server Action with final payload
- Action inserts transactions (idempotency via `idempotency_key` unique constraint; duplicate = skip with `23505`)
- Applies reconciliation decisions: links manual tx to imported tx via `reconciled_into_transaction_id`
- Updates account metadata and `statement_snapshots` from statement metadata
- Auto-excludes manual balance adjustments now covered by the import
- Calls `revalidateTag()` for all affected segments
- Returns `ImportResult` with counts: `imported`, `skipped`, `errors`, `autoMerged`, `manualMerged`

---

## Module Boundaries

**webapp → packages/shared:**
- Imports `autoCategorize`, `computeIdempotencyKey`, `reconciliation`, `debt`, `snapshot-diff`, `destinatario-matcher`, etc.
- No reverse dependency — shared never imports from webapp

**webapp → services/pdf_parser:**
- HTTP only: `POST /parse`, `POST /save-unrecognized`
- Proxied through `/api/parse-statement` route handler (never called directly from client)
- Auth: shared secret `X-Parser-Key`

**mobile → packages/shared:**
- Same shared utilities; mobile-only concern is NativeWind Tailwind v3 class compatibility

**webapp → supabase:**
- All DB access through `@supabase/ssr` server client or `@supabase/supabase-js` browser client
- Types from `webapp/src/types/database.ts` (regenerated from Supabase schema)
- RLS enforced at DB level; webapp adds defense-in-depth `.eq("user_id", user.id)` on all queries

---

## Error Handling

**Strategy:** Return-value errors (never throw for business logic)

**Patterns:**
- Server Actions return `ActionResult<T>`: `{ success: true, data: T }` or `{ success: false, error: string }`
- Zod validation errors surfaced as `parsed.error.issues[0].message` (first issue only)
- Duplicate insert: check `error.code === "23505"` and return user-friendly message
- Auth errors: `isIgnorableAuthError()` suppresses token-expired/missing errors cleanly
- API routes return `NextResponse.json({ error: "..." }, { status: 4xx/5xx })`
- PDF parser errors: mapped from FastAPI error shapes to user-facing Spanish messages

---

## Cross-Cutting Concerns

**Logging:** Server-side via `console.log` in Next.js; Python parser uses `logging` module with structured format `%(asctime)s %(levelname)s [%(name)s] %(message)s`

**Analytics / Product Events:** `trackProductEvent()` (server) and `trackClientEvent()` (client) from `webapp/src/lib/utils/analytics.ts`; inserts into `product_events` table; async and fire-and-forget (never awaited in critical path)

**Validation:** Zod schemas in `webapp/src/lib/validators/` per domain (transaction, account, auth, budget, import, etc.); `.safeParse()` used everywhere — never `.parse()` which throws

**Cache:** `next.config.ts` defines `cacheLife.zeta` with `stale: 300s, revalidate: 300s, expire: 3600s`; invalidated via `revalidateTag(tag, "zeta")`

**i18n:** No i18n library — all user-facing strings are written directly in Spanish; no locale switching

**Responsive / Mobile UX:** Pages render both a mobile layout and a desktop layout, toggled by Tailwind `lg:hidden` / `lg:block`; mobile uses `BottomTabBar` + `MobileTopbar` from `webapp/src/components/mobile/`

---

*Architecture analysis: 2026-03-25*

# Codebase Structure

**Analysis Date:** 2026-03-25

## Directory Layout

```
zeta/                                   # pnpm monorepo root
├── webapp/                             # Next.js 15 App Router (primary app)
│   ├── src/
│   │   ├── app/                        # App Router routes + API handlers
│   │   │   ├── (auth)/                 # Route group: login/signup/reset
│   │   │   ├── (dashboard)/            # Route group: all protected pages
│   │   │   │   ├── accounts/
│   │   │   │   ├── categories/
│   │   │   │   ├── categorizar/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── destinatarios/
│   │   │   │   ├── deudas/
│   │   │   │   ├── gestionar/
│   │   │   │   ├── import/
│   │   │   │   ├── recurrentes/
│   │   │   │   ├── settings/
│   │   │   │   └── transactions/
│   │   │   ├── api/                    # Route handlers (HTTP API endpoints)
│   │   │   │   ├── _shared/            # Shared API utilities (auth helper)
│   │   │   │   ├── bug-reports/
│   │   │   │   ├── health/
│   │   │   │   ├── parse-statement/    # PDF proxy to Python service
│   │   │   │   └── save-unrecognized/
│   │   │   ├── auth/callback/          # Supabase OAuth/email callback
│   │   │   └── onboarding/             # 6-step new-user wizard
│   │   ├── actions/                    # Server Actions ("use server" functions)
│   │   ├── components/                 # React components
│   │   │   ├── accounts/
│   │   │   ├── app/                    # App-level utilities (ServerActionRecovery)
│   │   │   ├── auth/
│   │   │   ├── budget/
│   │   │   ├── categories/
│   │   │   ├── categorize/
│   │   │   ├── charts/
│   │   │   ├── dashboard/              # Dashboard widgets and sections
│   │   │   ├── debt/
│   │   │   │   └── planner/
│   │   │   ├── destinatarios/
│   │   │   ├── import/                 # ImportWizard + step components
│   │   │   ├── layout/                 # Sidebar, Topbar
│   │   │   ├── mobile/                 # Mobile-specific UI (BottomTabBar, MobileTopbar)
│   │   │   ├── providers/
│   │   │   ├── recurring/
│   │   │   ├── settings/
│   │   │   ├── transactions/
│   │   │   └── ui/                     # shadcn/ui primitives + custom atoms
│   │   ├── hooks/                      # Custom React hooks
│   │   ├── lib/
│   │   │   ├── constants/
│   │   │   ├── supabase/               # Supabase client factories + auth helpers
│   │   │   ├── utils/                  # Utility functions (currency, date, analytics…)
│   │   │   └── validators/             # Zod schemas per domain
│   │   └── types/                      # TypeScript types
│   ├── middleware.ts                    # Next.js edge middleware (auth session)
│   └── next.config.ts                  # Next.js config (Turbopack, cacheLife, redirects)
│
├── mobile/                             # React Native / Expo app
│   ├── app/
│   │   ├── (auth)/
│   │   └── (tabs)/
│   ├── components/
│   ├── lib/
│   │   ├── db/                         # SQLite setup
│   │   ├── repositories/               # Offline-first data access
│   │   ├── services/
│   │   └── sync/
│   └── constants/
│
├── packages/
│   └── shared/                         # @zeta/shared — pure TS utilities
│       └── src/
│           ├── types/                  # database.ts, domain.ts
│           └── utils/                  # auto-categorize, debt, reconciliation…
│
├── services/
│   └── pdf_parser/                     # Python FastAPI service (port 8000)
│       ├── main.py                     # FastAPI app, /parse + /save-unrecognized
│       ├── models.py                   # Pydantic models (ParsedStatement, etc.)
│       ├── storage.py                  # Unrecognized PDF storage
│       └── parsers/                    # Bank-specific parser modules
│           ├── __init__.py             # detect_and_parse() router
│           ├── utils.py                # Shared parser utilities
│           └── <bank>_<type>.py        # e.g. bancolombia_credit_card.py
│
├── supabase/
│   └── migrations/                     # SQL migration files (applied with supabase db push)
│
├── package.json                        # Monorepo root (scripts: web, mobile, ios, android)
└── pnpm-workspace.yaml                 # Workspace: webapp, mobile, packages/*
```

## Directory Purposes

**`webapp/src/app/`:**
- Purpose: URL-to-component mapping for Next.js App Router
- Contains: `page.tsx` (Server Components), `layout.tsx`, `loading.tsx`, `route.ts` (API handlers)
- Key files:
  - `webapp/src/app/layout.tsx` — root layout (fonts, Toaster)
  - `webapp/src/app/middleware.ts` (at `webapp/middleware.ts`) — auth session middleware
  - `webapp/src/app/(dashboard)/layout.tsx` — authenticated shell (sidebar, topbar, nav)
  - `webapp/src/app/api/parse-statement/route.ts` — PDF proxy
  - `webapp/src/app/auth/callback/route.ts` — Supabase auth callback

**`webapp/src/actions/`:**
- Purpose: All server-side data access (reads + mutations)
- Contains: One file per domain; all functions marked `"use server"` at top of file
- Key files:
  - `webapp/src/actions/transactions.ts` — CRUD for transactions
  - `webapp/src/actions/import-transactions.ts` — bulk import + reconciliation
  - `webapp/src/actions/charts.ts` — dashboard hero data, cashflow, sparklines
  - `webapp/src/actions/auth.ts` — signIn, signUp, signOut, password reset

**`webapp/src/components/`:**
- Purpose: All React UI components
- Contains: Server Components (plain async functions) and Client Components (`"use client"`)
- Key files:
  - `webapp/src/components/import/import-wizard.tsx` — 6-step PDF import wizard
  - `webapp/src/components/dashboard/` — all dashboard widgets and sections
  - `webapp/src/components/layout/sidebar.tsx`, `topbar.tsx`
  - `webapp/src/components/mobile/bottom-tab-bar.tsx`, `mobile-topbar.tsx`
  - `webapp/src/components/ui/` — shadcn/ui primitives

**`webapp/src/lib/supabase/`:**
- Purpose: Supabase client factories and auth helpers
- Key files:
  - `webapp/src/lib/supabase/server.ts` — `createClient()` for Server Components/Actions (SSR, cookie-based)
  - `webapp/src/lib/supabase/client.ts` — `createClient()` for browser Client Components
  - `webapp/src/lib/supabase/auth.ts` — `getAuthenticatedClient()`, `getUserSafely()`
  - `webapp/src/lib/supabase/admin.ts` — `createAdminClient()` (service role, no RLS)
  - `webapp/src/lib/supabase/middleware.ts` — `updateSession()` for Next.js middleware

**`webapp/src/lib/validators/`:**
- Purpose: Zod schemas for request validation
- One file per domain: `transaction.ts`, `account.ts`, `auth.ts`, `budget.ts`, `import.ts`, `category.ts`, `destinatario.ts`, `recurring-template.ts`, `scenario.ts`, `dashboard-config.ts`

**`webapp/src/lib/utils/`:**
- Purpose: Pure utility functions
- Key files:
  - `webapp/src/lib/utils/currency.ts` — `formatCurrency(amount, code)`
  - `webapp/src/lib/utils/date.ts` — `formatDate()`, `parseMonth()`, `formatMonthLabel()`
  - `webapp/src/lib/utils/idempotency.ts` — `computeIdempotencyKey()`
  - `webapp/src/lib/utils/analytics.ts` — `trackProductEvent()` (server), `trackClientEvent()` (browser)
  - `webapp/src/lib/utils/transactions.ts` — `executeVisibleTransactionQuery()` (filters reconciled-out txns)

**`webapp/src/types/`:**
- Purpose: TypeScript types shared across the webapp
- Key files:
  - `webapp/src/types/database.ts` — Supabase-generated row types (regenerate with `npx supabase gen types`)
  - `webapp/src/types/domain.ts` — Aliased domain types (`Transaction`, `Account`, `Profile`, etc.) + computed shapes
  - `webapp/src/types/actions.ts` — `ActionResult<T>`, `PaginatedResult<T>`
  - `webapp/src/types/import.ts` — All import-flow types (`ParseResponse`, `TransactionToImport`, `ImportResult`, etc.)

**`packages/shared/src/`:**
- Purpose: Pure TypeScript utilities shared between webapp and mobile
- Key files:
  - `packages/shared/src/index.ts` — barrel export
  - `packages/shared/src/utils/auto-categorize.ts` — `autoCategorize(merchantName)`
  - `packages/shared/src/utils/reconciliation.ts` — `findReconciliationCandidates()`
  - `packages/shared/src/utils/debt.ts` — debt computation, `sanitizeInterestRate()`
  - `packages/shared/src/utils/idempotency.ts` — `computeIdempotencyKey()`
  - `packages/shared/src/utils/scenario-engine.ts` — debt payoff scenarios

**`services/pdf_parser/parsers/`:**
- Purpose: One module per bank + statement type
- Naming: `<bank>_<type>.py` — e.g. `bancolombia_credit_card.py`, `nequi_savings.py`
- Key files:
  - `services/pdf_parser/parsers/__init__.py` — `detect_and_parse()` dispatcher
  - `services/pdf_parser/parsers/utils.py` — shared parser helpers (amount convention docs)
  - `services/pdf_parser/parsers/opendataloader_fallback.py` — last-resort OCR fallback

---

## Key File Locations

**Entry Points:**
- `webapp/src/app/layout.tsx` — root HTML shell
- `webapp/src/app/page.tsx` — root redirect (auth → /dashboard or /login)
- `webapp/middleware.ts` — edge middleware (runs before every request)
- `services/pdf_parser/main.py` — Python FastAPI app

**Configuration:**
- `webapp/next.config.ts` — Next.js config (Turbopack, cacheLife, standalone output)
- `webapp/middleware.ts` — middleware matcher (all routes except static assets)
- `pnpm-workspace.yaml` — workspace packages: `webapp`, `mobile`, `packages/*`
- `supabase/migrations/` — database schema history

**Core Business Logic:**
- `webapp/src/actions/import-transactions.ts` — full import pipeline including reconciliation
- `webapp/src/actions/charts.ts` — dashboard data aggregation
- `packages/shared/src/utils/debt.ts` — debt calculations
- `packages/shared/src/utils/reconciliation.ts` — duplicate-detection scoring
- `services/pdf_parser/parsers/__init__.py` — PDF bank detection

**Testing:**
- `packages/shared/src/utils/__tests__/` — unit tests for shared utilities
- `webapp/src/lib/utils/__tests__/` — unit tests for webapp utilities

---

## Naming Conventions

**Files:**
- Next.js reserved: `page.tsx`, `layout.tsx`, `loading.tsx`, `route.ts`
- Components: kebab-case, e.g. `import-wizard.tsx`, `dashboard-hero.tsx`
- Actions: kebab-case by domain, e.g. `import-transactions.ts`, `debt-countdown.ts`
- Validators: kebab-case by domain matching their action file
- Python: snake_case, e.g. `bancolombia_credit_card.py`

**Directories:**
- Route groups: `(auth)`, `(dashboard)` — parentheses = no URL segment
- Dynamic segments: `[id]` — standard Next.js convention
- Feature slices in components mirror route names: `components/import/`, `components/dashboard/`

---

## Where to Add New Code

**New protected page:**
- Create `webapp/src/app/(dashboard)/<route>/page.tsx` (async Server Component)
- Add data fetching via actions; pass props to components
- If a Client Component with forms, add validator in `webapp/src/lib/validators/<domain>.ts`

**New Server Action:**
- Add to `webapp/src/actions/<domain>.ts` (or create new file for new domain)
- Top-of-file `"use server"` directive
- Call `getAuthenticatedClient()` first; return `ActionResult<T>`
- Call `revalidateTag(tag, "zeta")` after mutations

**New UI component:**
- Feature-specific: `webapp/src/components/<feature>/<component-name>.tsx`
- Shared primitive: `webapp/src/components/ui/<component-name>.tsx`
- Mark `"use client"` only if interactivity is required

**New database table:**
- Create migration: `npx supabase migration new <name>` in project root
- Apply: `npx supabase db push`
- Regenerate types: `npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > webapp/src/types/database.ts`
- Add domain type alias to `webapp/src/types/domain.ts` if needed

**New PDF parser (new bank):**
- Create `services/pdf_parser/parsers/<bank>_<type>.py`
- Register in `services/pdf_parser/parsers/__init__.py` `detect_and_parse()` function

**New shared utility:**
- Add to `packages/shared/src/utils/<name>.ts`
- Export from `packages/shared/src/index.ts`
- Write tests in `packages/shared/src/utils/__tests__/<name>.test.ts`

**New API route (HTTP endpoint):**
- Create `webapp/src/app/api/<name>/route.ts`
- Use `getRequestUser()` from `webapp/src/app/api/_shared/auth.ts` for auth

---

## Special Directories

**`.planning/codebase/`:**
- Purpose: GSD codebase map documents
- Generated: Yes (by mapping agents)
- Committed: Yes

**`supabase/migrations/`:**
- Purpose: Database migration SQL files
- Generated: Via `npx supabase migration new`
- Committed: Yes — migration history is the source of truth

**`webapp/.next/`:**
- Purpose: Next.js build output and dev cache
- Generated: Yes
- Committed: No
- Recovery: `rm -rf .next` + restart dev server if Turbopack panics

**`services/pdf_parser/.venv/`:**
- Purpose: Python virtual environment
- Generated: Yes (via `uv`)
- Committed: No

**`packages/shared/src/utils/__tests__/`:**
- Purpose: Vitest unit tests for shared utilities
- Run with: `pnpm --filter @zeta/shared test`

---

*Structure analysis: 2026-03-25*

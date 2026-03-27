# CLAUDE.md — Zeta

## Build & Dev
- `cd webapp && pnpm dev` — start Next.js dev server
- `cd webapp && pnpm build` — production build (uses Turbopack)
- `cd services/pdf_parser && uv run python main.py` — start PDF parser on :8000
- Living context docs: `python3 .claude/skills/codebase-context/scripts/build_context.py`
- If Turbopack panics during dev: kill the server, `rm -rf .next`, restart `pnpm dev`

## Project Structure
- `webapp/` — Next.js 15 (App Router) + TypeScript + Tailwind v4 + shadcn/ui
- `services/pdf_parser/` — Python/FastAPI PDF parser for Bancolombia statements
- `supabase/` — migrations and config (linked to remote, no local Docker)

## Code Patterns
- Server Actions: `(prevState, formData) => Promise<ActionResult<T>>` with `useActionState`
- Zod validation errors: `.issues[0].message` (not `.errors[0].message`)
- UUID validation: use permissive regex `/^[0-9a-f]{8}-...$/i`, NOT `z.string().uuid()` — Zod 4 rejects seed UUIDs
- Currency: `formatCurrency(amount, code)` from `src/lib/utils/currency.ts`
- Dates: Spanish locale via `formatDate()` from `src/lib/utils/date.ts`
- Idempotency: `computeIdempotencyKey()` from `src/lib/utils/idempotency.ts` for dedup

## Supabase
- Project ID: `tgkhaxipfgskxydotdtu` (sa-east-1, org: zybaordjrezdjajzwisk)
- See `~/.claude/rules/supabase.md` for RLS, auth, migration patterns

## Gotchas
- Zod 4 `.uuid()` enforces RFC 9562 — seed category UUIDs (a0000001-...) fail validation
- shadcn/ui Checkbox: use `checked="indeterminate"`, not an `indeterminate` prop
- Radix Select sends empty string (not null/undefined) when no value — use `z.preprocess` to normalize
- Shell `compdef` warning leaks into stdout redirects — always strip first line if piping to file

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Zeta — Polish & Refinement Milestone**

Zeta is a personal finance management app for Colombian users. It tracks transactions across multiple banks (via PDF statement import), manages budgets with 50/30/20 allocation, models debt payoff strategies, handles multi-currency accounts, and provides a dashboard with financial health metrics. Built as a Next.js 15 webapp with a Python PDF parser microservice, backed by Supabase.

This milestone is a comprehensive polish pass — the features exist, but the experience doesn't tell a clear story. The app should answer "Am I on track?" at a glance, without explanation.

**Core Value:** **Every screen should answer "Am I on track?" without requiring explanation.** The app has the data — it needs to present it with purpose, hierarchy, and visual clarity so the user feels informed, not overwhelmed.

### Constraints

- **Tech stack**: Next.js 15, Tailwind v4, shadcn/ui, Supabase — no stack changes
- **Language**: Spanish-first UI, all user-facing strings in Spanish
- **Performance**: Speed over animations. Optimistic updates preferred. No heavy client-side libraries without lazy loading.
- **No AI**: Auto-categorization must be deterministic rule-based, not ML
- **Supabase**: RLS + defense-in-depth (`user_id` filter even with RLS). Auth via `getAuthenticatedClient()`.
- **Package manager**: pnpm for JS, uv for Python
- **Build gates**: `pnpm install` + `pnpm build` must pass before any work is considered done
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.9 — all webapp (`webapp/`) and shared package (`packages/shared/`) code
- Python 3.11+ — PDF parser microservice (`services/pdf_parser/`)
- JavaScript — Babel config (`mobile/babel.config.js`), PostCSS config (`webapp/postcss.config.mjs`)
## Runtime
- Node.js 20 (pinned in `/.nvmrc`, enforced via `"engines": { "node": ">=20" }` in root `package.json`)
- Python 3.11+ (required by `services/pdf_parser/pyproject.toml`)
- pnpm (workspace monorepo) — manages `webapp/`, `mobile/`, `packages/*`
- uv — Python package manager for `services/pdf_parser/`
- Lockfile: `pnpm-lock.yaml` present at root
## Monorepo Structure
- `webapp` — Next.js web application
- `mobile` — Expo React Native app
- `packages/*` — shared libraries (`packages/shared/`)
## Frameworks
- Next.js 16.1.6 — App Router, Server Actions, standalone output mode
- Expo 55.0.6 with expo-router 55.0.5 — file-based routing
- React Native 0.83.2
- EAS Build — cloud builds for Android (AAB, APK) and iOS
- FastAPI 0.115+ — REST API for PDF parsing
- Uvicorn 0.30+ — ASGI server, runs on port 8000
## UI Layer
- React 19.2.3
- Tailwind CSS v4 (postcss plugin: `@tailwindcss/postcss ^4`)
- shadcn/ui 3.8.4 — component library (components added via CLI, not imported as a package)
- Radix UI 1.4.3 — headless primitives underlying shadcn
- class-variance-authority 0.7.1 — variant composition
- clsx 2.1.1 + tailwind-merge 3.4.0 — conditional class utilities
- Framer Motion 12.34.3 — animations
- tw-animate-css 1.4.0 — Tailwind animation utilities
- lucide-react 0.563.0 — icon set
- next-themes 0.4.6 — dark/light mode
- sonner 2.0.7 — toast notifications
- vaul 1.1.2 — drawer/sheet component
- cmdk 1.1.1 — command palette
- recharts 2.15.4 — charts and data visualization
- NativeWind 4.2.2 — Tailwind for React Native (uses Tailwind v3.3.5 — NativeWind not yet compatible with v4)
- react-native-reanimated 4.2.1 — animations
- @shopify/react-native-skia 2.4.18 — canvas-based graphics
- lucide-react-native 0.575.0 — icons
- zustand 5.0.11 — state management (mobile only)
## Forms & Validation
- react-hook-form 7.71.1 — form state management
- @hookform/resolvers 5.2.2 — validation adapter
- zod 4.3.6 — schema validation (both web and mobile via shared package)
## Data & Dates
- date-fns 4.1.0 — date utilities (in both `webapp/` and `packages/shared/`)
## Shared Package (`packages/shared/`)
- `@zeta/shared` — shared TypeScript types and business logic utilities consumed by both `webapp/` and `mobile/`
- Entry point: `packages/shared/src/index.ts`
- Contains: debt calculations, shared types, utility functions
## Testing
- Vitest 4.0.18 — test runner for webapp and `packages/shared/`
- Playwright 1.58.2 — browser automation
- react-test-renderer 19.1.0 — React Native component testing (dev dep)
## Dev Tooling
- ESLint 9 — configured in `webapp/eslint.config.mjs`
- TypeScript 5.9 — `strict: true`, `moduleResolution: bundler`
- PostCSS — `webapp/postcss.config.mjs` (only plugin: `@tailwindcss/postcss`)
- Turbopack — Next.js bundler, workspace root set to `..` to resolve monorepo packages
- Babel 7.29 with `babel-preset-expo 55.0.11`
## Infrastructure
- Supabase (PostgreSQL 17) — hosted on sa-east-1 (São Paulo)
- Supabase Auth — JWT-based, cookie storage via `@supabase/ssr 0.8.0`
- Docker — both services containerized
- Docker Compose — `docker-compose.yml` (local dev), `docker-compose.prod.yml` (production)
- Images published to GitHub Container Registry (GHCR): `ghcr.io/cristian1911/personal_finance_manager_claude`
- Hostinger VPS — production host, managed via GitHub Actions `deploy.yml`
- Nginx reverse proxy — `infra/nginx/` (custom Docker image, handles SSL termination)
- GitHub Actions CI/CD — `.github/workflows/deploy.yml`
- frankfurter.app API — external exchange rate data, cached 24h in `exchange_rate_cache` Supabase table
## Configuration
- `NEXT_PUBLIC_SUPABASE_URL` — public Supabase URL (build-time arg for Docker)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — public anon key (build-time arg for Docker)
- `NEXT_PUBLIC_APP_URL` — canonical app URL
- `SUPABASE_SECRET_KEY` — service role key (server-only, production)
- `PDF_PARSER_URL` — internal URL to PDF parser service (default: `http://localhost:8000`)
- `PDF_PARSER_API_KEY` — shared secret for parser auth
- `PARSER_API_KEY` — shared secret, validated via `X-Parser-Key` header
- `LOG_LEVEL` — logging verbosity (default: `INFO`)
- `@/*` — resolves to `webapp/src/*`
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Server-first rendering: pages are async Server Components; data fetches happen server-side via Server Actions
- All mutation goes through Server Actions (`"use server"` functions in `webapp/src/actions/`), never direct API calls from client components
- Zero client-side data fetching for initial page loads — components receive props from their parent Server Component page
- Defense-in-depth auth: middleware + layout-level redirects + per-action auth checks
- Cache invalidation via `revalidateTag()` with a `"zeta"` namespace after every mutation
## System Components
```
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
## Layers (webapp)
- Purpose: URL-to-page mapping, layout nesting, loading states
- Location: `webapp/src/app/`
- Contains: `page.tsx`, `layout.tsx`, `loading.tsx`, route handlers (`route.ts`)
- Depends on: Action Layer, Component Layer
- Used by: Browser / Next.js router
- Purpose: Server-side data access and mutations — the only layer that reads/writes Supabase
- Location: `webapp/src/actions/`
- Contains: `"use server"` async functions, each returning `ActionResult<T>` or domain data
- Depends on: `@/lib/supabase/auth` (for `getAuthenticatedClient()`), `@zeta/shared`, validators
- Used by: Server Component pages (data reads), Client Components via `useActionState` (mutations)
- Purpose: UI rendering
- Location: `webapp/src/components/`
- Contains: Server Components (read-only, receive data as props), Client Components (`"use client"` for interactivity)
- Depends on: Action Layer (Server Components call actions directly; Client Components call actions via hooks or `useActionState`)
- Used by: Route Layer
- Purpose: Utilities, validators, Supabase client factories, constants
- Location: `webapp/src/lib/`
- Contains: `supabase/` (client factories), `validators/` (Zod schemas), `utils/` (currency, date, analytics, idempotency, recurrence)
- Depends on: Nothing app-specific
- Used by: Action Layer, Component Layer
- Purpose: TypeScript type definitions
- Location: `webapp/src/types/`
- Contains: `database.ts` (Supabase-generated), `domain.ts` (aliased row types + computed shapes), `actions.ts` (`ActionResult<T>`, `PaginatedResult<T>`), `import.ts`, `dashboard-config.ts`
- Depends on: Nothing
- Used by: All layers
## Data Flow
- `"dashboard:hero"`, `"dashboard:charts"`, `"dashboard:budgets"`, `"dashboard:cashflow"`, `"dashboard:accounts"` — invalidated by transaction mutations
- `"accounts"`, `"categorize"`, `"snapshots"`, `"debt"`, `"budgets"` — domain-scoped tags
- Server state: Supabase + `revalidateTag`
- UI state: React `useState` / `useReducer` in Client Components (forms, wizards, modals)
- No global client-side state store (no Redux, no Zustand)
- Dashboard layout config: stored in `profiles.dashboard_config` JSONB column; read in layout, exposed via `DashboardConfigProvider` context
## Authentication Flow
- Fast path: `getUserSafely()` tries `getSession()` first — local JWT check, ~0ms, no network
- Slow path: falls back to `getUser()` — ~300ms network call to Supabase Auth
- `getAuthenticatedClient()`: React `cache()`-wrapped, deduplicates within one server render; used by all Server Actions
- `webapp/src/lib/supabase/server.ts` — `createClient()` using `@supabase/ssr`, reads/writes cookies; used in layouts, pages, Server Actions
- `webapp/src/lib/supabase/client.ts` — `createClient()` using browser client; used in Client Components that need direct Supabase access
- `webapp/src/lib/supabase/admin.ts` — `createAdminClient()` using service role key; bypasses RLS; used sparingly
- `webapp/src/lib/supabase/auth.ts` — `getUserSafely()`, `getUserSafelyStrict()`, `getAuthenticatedClient()`
- Middleware (`webapp/middleware.ts`): guards `/dashboard`, `/transactions`, `/accounts`, `/categories`, `/destinatarios`, `/settings`
- Layout check (`(dashboard)/layout.tsx`): verifies user + profile + `onboarding_completed`
- `webapp/src/app/api/_shared/auth.ts` `getRequestUser()`: accepts Bearer token (for mobile) or session cookie (for browser)
## App Router Structure
```
```
## PDF Import Flow
- User selects PDF(s); optional password field for encrypted PDFs
- Client POSTs to `POST /api/parse-statement` (Next.js route handler)
- Route handler validates auth, checks file size (10 MB limit), proxies to `PDF_PARSER_URL/parse` with `X-Parser-Key` header and 120s timeout
- Python FastAPI service (`services/pdf_parser/main.py`) calls `detect_and_parse()` → routes to bank-specific parser
- Returns `ParseResponse { statements: ParsedStatement[] }`
- Wizard auto-matches each parsed statement to an existing account (by card last-4 or account number)
- User can reassign statement → account mappings, or create a new account
- User selects primary currency per account when multiple currencies appear
- Parsed transactions are matched against `DestinatarioRule[]` from `@zeta/shared`'s `destinatario-matcher`
- User confirms/adjusts merchant → destinatario assignments
- Final transaction list shown; user can deselect individual transactions
- Auto-categorization runs via `autoCategorize()` from `@zeta/shared`
- `previewImportReconciliation()` Server Action checks for existing manual transactions that may duplicate imports
- Shown only when `reconciliationPreview` has `autoMerge` or `review` items
- `AUTO_MERGE`: manual transaction linked automatically, no user action needed
- `REVIEW`: user decides per-transaction — merge or keep both
- Client calls `importTransactions()` Server Action with final payload
- Action inserts transactions (idempotency via `idempotency_key` unique constraint; duplicate = skip with `23505`)
- Applies reconciliation decisions: links manual tx to imported tx via `reconciled_into_transaction_id`
- Updates account metadata and `statement_snapshots` from statement metadata
- Auto-excludes manual balance adjustments now covered by the import
- Calls `revalidateTag()` for all affected segments
- Returns `ImportResult` with counts: `imported`, `skipped`, `errors`, `autoMerged`, `manualMerged`
## Module Boundaries
- Imports `autoCategorize`, `computeIdempotencyKey`, `reconciliation`, `debt`, `snapshot-diff`, `destinatario-matcher`, etc.
- No reverse dependency — shared never imports from webapp
- HTTP only: `POST /parse`, `POST /save-unrecognized`
- Proxied through `/api/parse-statement` route handler (never called directly from client)
- Auth: shared secret `X-Parser-Key`
- Same shared utilities; mobile-only concern is NativeWind Tailwind v3 class compatibility
- All DB access through `@supabase/ssr` server client or `@supabase/supabase-js` browser client
- Types from `webapp/src/types/database.ts` (regenerated from Supabase schema)
- RLS enforced at DB level; webapp adds defense-in-depth `.eq("user_id", user.id)` on all queries
## Error Handling
- Server Actions return `ActionResult<T>`: `{ success: true, data: T }` or `{ success: false, error: string }`
- Zod validation errors surfaced as `parsed.error.issues[0].message` (first issue only)
- Duplicate insert: check `error.code === "23505"` and return user-friendly message
- Auth errors: `isIgnorableAuthError()` suppresses token-expired/missing errors cleanly
- API routes return `NextResponse.json({ error: "..." }, { status: 4xx/5xx })`
- PDF parser errors: mapped from FastAPI error shapes to user-facing Spanish messages
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

## Workflow: Lean Orchestration (default)

Work directly — no GSD agent swarm by default. The main conversation is the orchestrator.

### How it works
1. **Read context once** — STATE.md, current plan, relevant code. Do this in the main conversation.
2. **Plan inline** — write or update the plan yourself, no planner agent.
3. **Spawn agents with embedded context** — when parallelism helps, pass the full context in the agent prompt so agents start working immediately (zero orientation reads).
4. **Verify inline** — check results + run `pnpm build` yourself. No verifier agent.

### When to use GSD commands
- `/gsd:new-project` or `/gsd:new-milestone` — starting from scratch, need roadmap
- `/gsd:discuss-phase` — genuinely ambiguous scope that needs structured questions
- `/gsd:execute-phase` — only for large multi-plan phases where full ceremony is worth it

### Rules
- **1-3 agents max** per task, not 6-7
- Agents receive context in their prompt — they should NOT re-read STATE.md, ROADMAP.md, or phase files
- Planning artifacts (PLAN.md, STATE.md) are still maintained — just updated inline, not by spawning dedicated agents
- Build gates still enforced: `pnpm install` (if deps changed) + `pnpm build` before claiming done
- Atomic commits with clear messages

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

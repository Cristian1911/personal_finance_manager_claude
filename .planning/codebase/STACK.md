# Technology Stack

**Analysis Date:** 2026-03-25

## Languages

**Primary:**
- TypeScript 5.9 — all webapp (`webapp/`) and shared package (`packages/shared/`) code
- Python 3.11+ — PDF parser microservice (`services/pdf_parser/`)

**Secondary:**
- JavaScript — Babel config (`mobile/babel.config.js`), PostCSS config (`webapp/postcss.config.mjs`)

## Runtime

**Environment:**
- Node.js 20 (pinned in `/.nvmrc`, enforced via `"engines": { "node": ">=20" }` in root `package.json`)
- Python 3.11+ (required by `services/pdf_parser/pyproject.toml`)

**Package Manager:**
- pnpm (workspace monorepo) — manages `webapp/`, `mobile/`, `packages/*`
- uv — Python package manager for `services/pdf_parser/`
- Lockfile: `pnpm-lock.yaml` present at root

## Monorepo Structure

**Workspaces** (`pnpm-workspace.yaml`):
- `webapp` — Next.js web application
- `mobile` — Expo React Native app
- `packages/*` — shared libraries (`packages/shared/`)

Root scripts in `package.json` delegate to workspaces via `pnpm --filter <name>`.

## Frameworks

**Web (webapp/):**
- Next.js 16.1.6 — App Router, Server Actions, standalone output mode
  - Config: `webapp/next.config.ts`
  - Build mode: Turbopack (configured in `next.config.ts` via `turbopack: { root: ".." }`)
  - Output: `standalone` for Docker containerization
  - Component caching: `cacheComponents: true` with custom `zeta` cache life (stale 5min, expire 1h)

**Mobile (mobile/):**
- Expo 55.0.6 with expo-router 55.0.5 — file-based routing
- React Native 0.83.2
- EAS Build — cloud builds for Android (AAB, APK) and iOS

**Python service (services/pdf_parser/):**
- FastAPI 0.115+ — REST API for PDF parsing
- Uvicorn 0.30+ — ASGI server, runs on port 8000

## UI Layer

**Web:**
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

**Mobile:**
- NativeWind 4.2.2 — Tailwind for React Native (uses Tailwind v3.3.5 — NativeWind not yet compatible with v4)
- react-native-reanimated 4.2.1 — animations
- @shopify/react-native-skia 2.4.18 — canvas-based graphics
- lucide-react-native 0.575.0 — icons
- zustand 5.0.11 — state management (mobile only)

## Forms & Validation

**Web:**
- react-hook-form 7.71.1 — form state management
- @hookform/resolvers 5.2.2 — validation adapter
- zod 4.3.6 — schema validation (both web and mobile via shared package)

**Critical gotcha:** Zod 4 `.uuid()` enforces RFC 9562 — seed category UUIDs (format `a0000001-...`) fail validation. Use permissive regex instead: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`.

## Data & Dates

- date-fns 4.1.0 — date utilities (in both `webapp/` and `packages/shared/`)

## Shared Package (`packages/shared/`)

- `@zeta/shared` — shared TypeScript types and business logic utilities consumed by both `webapp/` and `mobile/`
- Entry point: `packages/shared/src/index.ts`
- Contains: debt calculations, shared types, utility functions

## Testing

**Unit:**
- Vitest 4.0.18 — test runner for webapp and `packages/shared/`
  - Run: `pnpm test` (in `packages/shared/`) or `pnpm vitest` in `webapp/`

**E2E:**
- Playwright 1.58.2 — browser automation
  - Config: `webapp/playwright.config.ts`
  - Test dir: `webapp/e2e/`
  - Projects: `setup` (auth), `mobile` (Pixel 7 viewport), `desktop` (1440x900), `security` (no auth)
  - Auth state saved to `webapp/e2e/.auth/user.json`

**Mobile:**
- react-test-renderer 19.1.0 — React Native component testing (dev dep)

## Dev Tooling

**Linting:**
- ESLint 9 — configured in `webapp/eslint.config.mjs`
  - Uses `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
  - Flat config format

**Build:**
- TypeScript 5.9 — `strict: true`, `moduleResolution: bundler`
  - Path alias: `@/*` → `webapp/src/*`
  - Config: `webapp/tsconfig.json`
- PostCSS — `webapp/postcss.config.mjs` (only plugin: `@tailwindcss/postcss`)
- Turbopack — Next.js bundler, workspace root set to `..` to resolve monorepo packages

**Mobile Build:**
- Babel 7.29 with `babel-preset-expo 55.0.11`

## Infrastructure

**Database:**
- Supabase (PostgreSQL 17) — hosted on sa-east-1 (São Paulo)
  - Project ID: `tgkhaxipfgskxydotdtu`
  - No local Docker — linked directly to remote
  - Migrations in `supabase/migrations/`
  - Edge Functions in `supabase/functions/`
  - Type generation: `npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu`
  - Types output: `webapp/src/types/database.ts`

**Authentication:**
- Supabase Auth — JWT-based, cookie storage via `@supabase/ssr 0.8.0`
  - Server client: `webapp/src/lib/supabase/server.ts`
  - Browser client: `webapp/src/lib/supabase/client.ts`
  - Auth helper (cached): `webapp/src/lib/supabase/auth.ts` — `getAuthenticatedClient()` uses React `cache()` to deduplicate within a single server render
  - Admin client: `webapp/src/lib/supabase/admin.ts` — uses `SUPABASE_SECRET_KEY`
  - Middleware: `webapp/src/lib/supabase/middleware.ts`

**Containerization:**
- Docker — both services containerized
  - `webapp/Dockerfile` — Next.js standalone build
  - `services/pdf_parser/Dockerfile` — Python/uvicorn service
- Docker Compose — `docker-compose.yml` (local dev), `docker-compose.prod.yml` (production)
- Images published to GitHub Container Registry (GHCR): `ghcr.io/cristian1911/personal_finance_manager_claude`

**Deployment:**
- Hostinger VPS — production host, managed via GitHub Actions `deploy.yml`
- Nginx reverse proxy — `infra/nginx/` (custom Docker image, handles SSL termination)
- GitHub Actions CI/CD — `.github/workflows/deploy.yml`
  - Triggers on push to `main`
  - Path-aware: only rebuilds changed services (webapp vs parser)
  - PR image promotion: reuses SHA-tagged images built during PR to avoid double builds
  - Security audit workflow: `.github/workflows/security-audit.yml`
  - Mobile builds: `.github/workflows/mobile-apk.yml`, `mobile-ios.yml`, `mobile-playstore.yml`

**Exchange Rates:**
- frankfurter.app API — external exchange rate data, cached 24h in `exchange_rate_cache` Supabase table

## Configuration

**Required environment variables (webapp):**
- `NEXT_PUBLIC_SUPABASE_URL` — public Supabase URL (build-time arg for Docker)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — public anon key (build-time arg for Docker)
- `NEXT_PUBLIC_APP_URL` — canonical app URL
- `SUPABASE_SECRET_KEY` — service role key (server-only, production)
- `PDF_PARSER_URL` — internal URL to PDF parser service (default: `http://localhost:8000`)
- `PDF_PARSER_API_KEY` — shared secret for parser auth

**Required environment variables (pdf_parser):**
- `PARSER_API_KEY` — shared secret, validated via `X-Parser-Key` header
- `LOG_LEVEL` — logging verbosity (default: `INFO`)

**TypeScript path aliases:**
- `@/*` — resolves to `webapp/src/*`

---

*Stack analysis: 2026-03-25*

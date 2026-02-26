# PROJECT_CONTEXT

Auto-generated project intelligence for fast onboarding and safe edits.

- Generated (UTC): `2026-02-26T06:30:41.645457+00:00`
- Project root: `/Users/cristian/Documents/developing/personal_finance_manager`

## Stack Snapshot
- Next.js
- Expo/React Native
- FastAPI
- Supabase
- pnpm workspace

## File/Lang Distribution
- Text files scanned: 424
- TypeScript/React: 140
- JSON: 116
- TypeScript: 81
- Markdown: 24
- Python: 19
- SQL: 19
- Shell: 9
- YAML: 7
- JavaScript: 5
- CSS: 2
- TOML: 2

## Top-level Areas
- mobile: 169 files
- webapp: 165 files
- services: 21 files
- supabase: 20 files
- packages: 14 files
- docs: 12 files
- (root): 10 files
- .claude: 9 files
- infra: 2 files
- .github: 2 files

## Key Commands
### root_scripts
- `start`: `pnpm --filter mobile start`
- `web`: `pnpm --filter webapp dev`
- `mobile`: `pnpm --filter mobile start`
- `ios`: `pnpm --filter mobile ios`
- `android`: `pnpm --filter mobile android`
- `build:web`: `pnpm --filter webapp build`
### webapp_scripts
- `dev`: `next dev`
- `build`: `next build`
- `start`: `next start`
- `lint`: `eslint`
### mobile_scripts
- `start`: `expo start`
- `android`: `expo run:android`
- `ios`: `expo run:ios`
- `web`: `expo start --web`

## Patterns Detected
- `supabase-integration` (15 files): Supabase clients/services in app code
  - e.g. `webapp/middleware.ts`
  - e.g. `webapp/src/app/page.tsx`
  - e.g. `webapp/src/app/auth/callback/route.ts`
- `next-app-router` (15 files): Next.js App Router pages/layouts
  - e.g. `webapp/src/app/layout.tsx`
  - e.g. `webapp/src/app/page.tsx`
  - e.g. `webapp/src/app/auth/callback/route.ts`
- `server-actions` (15 files): Server Action handlers under webapp/src/actions
  - e.g. `webapp/src/actions/statement-snapshots.ts`
  - e.g. `webapp/src/actions/recurring-templates.ts`
  - e.g. `webapp/src/actions/debt.ts`
- `expo-router` (15 files): Expo Router file-based routes
  - e.g. `mobile/app/+not-found.tsx`
  - e.g. `mobile/app/onboarding.tsx`
  - e.g. `mobile/app/_layout.tsx`
- `fastapi-service` (15 files): FastAPI service modules
  - e.g. `services/pdf_parser/test_parser.py`
  - e.g. `services/pdf_parser/models.py`
  - e.g. `services/pdf_parser/storage.py`
- `zod-validators` (9 files): Validation layer using Zod
  - e.g. `webapp/src/actions/profile.ts`
  - e.g. `webapp/src/lib/validators/account.ts`
  - e.g. `webapp/src/lib/validators/category.ts`
- `repository-pattern` (4 files): Repository pattern in mobile/lib/repositories
  - e.g. `mobile/lib/repositories/budgets.ts`
  - e.g. `mobile/lib/repositories/categories.ts`
  - e.g. `mobile/lib/repositories/transactions.ts`

## Entrypoints
- `mobile/app/(auth)/_layout.tsx`
- `mobile/app/(tabs)/_layout.tsx`
- `mobile/app/_layout.tsx`
- `packages/shared/src/types/domain.ts`
- `services/pdf_parser/main.py`
- `webapp/src/app/(auth)/forgot-password/page.tsx`
- `webapp/src/app/(auth)/layout.tsx`
- `webapp/src/app/(auth)/login/page.tsx`
- `webapp/src/app/(auth)/reset-password/page.tsx`
- `webapp/src/app/(auth)/signup/page.tsx`
- `webapp/src/app/(dashboard)/accounts/[id]/page.tsx`
- `webapp/src/app/(dashboard)/accounts/page.tsx`
- `webapp/src/app/(dashboard)/categories/manage/page.tsx`
- `webapp/src/app/(dashboard)/categories/page.tsx`
- `webapp/src/app/(dashboard)/categorizar/page.tsx`
- `webapp/src/app/(dashboard)/dashboard/page.tsx`
- `webapp/src/app/(dashboard)/deudas/page.tsx`
- `webapp/src/app/(dashboard)/deudas/simulador/page.tsx`
- `webapp/src/app/(dashboard)/import/page.tsx`
- `webapp/src/app/(dashboard)/layout.tsx`
- `webapp/src/app/(dashboard)/recurrentes/page.tsx`
- `webapp/src/app/(dashboard)/settings/analytics/page.tsx`
- `webapp/src/app/(dashboard)/settings/page.tsx`
- `webapp/src/app/(dashboard)/transactions/[id]/page.tsx`
- `webapp/src/app/(dashboard)/transactions/page.tsx`
- `webapp/src/app/api/parse-statement/route.ts`
- `webapp/src/app/api/save-unrecognized/route.ts`
- `webapp/src/app/auth/callback/route.ts`
- `webapp/src/app/layout.tsx`
- `webapp/src/app/onboarding/layout.tsx`

## Dependency Signals (Folder-level)
- `webapp` -> `webapp` (409)
- `mobile` -> `mobile` (1)

## Recent Changes (git status)
- `docs/agent/PROJECT_CONTEXT.md`
- `docs/agent/project_context.json`
- `services/pdf_parser/parsers/nu_credit_card.py`
- `webapp/src/actions/import-transactions.ts`
- `webapp/src/actions/product-events.ts`
- `webapp/src/app/(dashboard)/settings/analytics/page.tsx`
- `webapp/src/types/database.ts`

## Agent Playbook
- Read this file first, then open only relevant folders/files.
- Prefer paths listed under Patterns and Entrypoints for feature work.
- Regenerate this file after non-trivial code changes.

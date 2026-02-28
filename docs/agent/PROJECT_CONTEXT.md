# PROJECT_CONTEXT

Auto-generated project intelligence for fast onboarding and safe edits.

- Generated (UTC): `2026-02-28T00:22:18.132607+00:00`
- Project root: `/Users/cristian/Documents/developing/personal_finance_manager`

## Stack Snapshot
- Next.js
- Expo/React Native
- FastAPI
- Supabase
- pnpm workspace

## File/Lang Distribution
- Text files scanned: 474
- TypeScript/React: 151
- JSON: 140
- TypeScript: 90
- Markdown: 25
- SQL: 22
- Python: 20
- Shell: 9
- YAML: 8
- JavaScript: 5
- CSS: 2
- TOML: 2

## Top-level Areas
- mobile: 201 files
- webapp: 174 files
- supabase: 23 files
- services: 22 files
- packages: 16 files
- docs: 13 files
- (root): 11 files
- .claude: 9 files
- .github: 3 files
- infra: 2 files

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
- `build:apk:local`: `eas build --platform android --profile preview-local`
- `build:apk:device`: `eas build --platform android --profile preview-device`

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
  - e.g. `mobile/app/subscriptions.tsx`
  - e.g. `mobile/app/+not-found.tsx`
  - e.g. `mobile/app/onboarding.tsx`
- `fastapi-service` (15 files): FastAPI service modules
  - e.g. `services/pdf_parser/test_parser.py`
  - e.g. `services/pdf_parser/models.py`
  - e.g. `services/pdf_parser/storage.py`
- `zod-validators` (10 files): Validation layer using Zod
  - e.g. `webapp/src/actions/recurring-templates.ts`
  - e.g. `webapp/src/actions/profile.ts`
  - e.g. `webapp/src/lib/validators/account.ts`
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
- `webapp/src/app/api/bug-reports/route.ts`
- `webapp/src/app/api/parse-statement/route.ts`
- `webapp/src/app/api/save-unrecognized/route.ts`
- `webapp/src/app/auth/callback/route.ts`
- `webapp/src/app/layout.tsx`

## Dependency Signals (Folder-level)
- `webapp` -> `webapp` (448)
- `mobile` -> `mobile` (1)

## Recent Changes (git status)
- `mobile/app/(tabs)/index.tsx`
- `docs/plans/SECURITY_MIGRATION.md`

## Agent Playbook
- Read this file first, then open only relevant folders/files.
- Prefer paths listed under Patterns and Entrypoints for feature work.
- Regenerate this file after non-trivial code changes.

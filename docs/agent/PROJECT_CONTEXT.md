# PROJECT_CONTEXT

Auto-generated project intelligence for fast onboarding and safe edits.

- Generated (UTC): `2026-02-28T05:17:58.436669+00:00`
- Project root: `/Users/cristian/Documents/developing/personal_finance_manager`

## Stack Snapshot
- Next.js
- Expo/React Native
- FastAPI
- Supabase
- pnpm workspace

## File/Lang Distribution
- Text files scanned: 1174
- TypeScript/React: 457
- TypeScript: 275
- JSON: 170
- Markdown: 73
- SQL: 71
- Python: 60
- YAML: 26
- Shell: 15
- JavaScript: 15
- CSS: 6
- TOML: 6

## Top-level Areas
- .worktrees: 695 files
- mobile: 202 files
- webapp: 176 files
- supabase: 23 files
- services: 22 files
- packages: 17 files
- docs: 13 files
- (root): 11 files
- .claude: 9 files
- docs: 8 files
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
- `build:aab:production`: `eas build --platform android --profile production-android`
- `build:ios:simulator:local`: `eas build --platform ios --profile preview-ios-simulator-local`
- `build:ios:simulator:device`: `eas build --platform ios --profile preview-ios-simulator-device`
- `build:ios:device`: `eas build --platform ios --profile preview-ios-device`
- `build:ios:production`: `eas build --platform ios --profile production-ios`

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
- `zod-validators` (11 files): Validation layer using Zod
  - e.g. `webapp/src/actions/recurring-templates.ts`
  - e.g. `webapp/src/actions/profile.ts`
  - e.g. `webapp/src/actions/purchase-decision.ts`
- `expo-router` (15 files): Expo Router file-based routes
  - e.g. `mobile/app/subscriptions.tsx`
  - e.g. `mobile/app/+not-found.tsx`
  - e.g. `mobile/app/onboarding.tsx`
- `fastapi-service` (15 files): FastAPI service modules
  - e.g. `.worktrees/security/services/pdf_parser/main.py`
  - e.g. `.worktrees/main-integration/services/pdf_parser/main.py`
  - e.g. `services/pdf_parser/test_parser.py`
- `repository-pattern` (12 files): Repository pattern in mobile/lib/repositories
  - e.g. `mobile/lib/repositories/budgets.ts`
  - e.g. `mobile/lib/repositories/categories.ts`
  - e.g. `mobile/lib/repositories/transactions.ts`

## Entrypoints
- `.worktrees/main-integration/mobile/app/(auth)/_layout.tsx`
- `.worktrees/main-integration/mobile/app/(tabs)/_layout.tsx`
- `.worktrees/main-integration/mobile/app/_layout.tsx`
- `.worktrees/main-integration/packages/shared/src/types/domain.ts`
- `.worktrees/main-integration/services/pdf_parser/main.py`
- `.worktrees/main-integration/webapp/src/app/(auth)/forgot-password/page.tsx`
- `.worktrees/main-integration/webapp/src/app/(auth)/layout.tsx`
- `.worktrees/main-integration/webapp/src/app/(auth)/login/page.tsx`
- `.worktrees/main-integration/webapp/src/app/(auth)/reset-password/page.tsx`
- `.worktrees/main-integration/webapp/src/app/(auth)/signup/page.tsx`
- `.worktrees/main-integration/webapp/src/app/(dashboard)/accounts/[id]/page.tsx`
- `.worktrees/main-integration/webapp/src/app/(dashboard)/accounts/page.tsx`
- `.worktrees/main-integration/webapp/src/app/(dashboard)/categories/manage/page.tsx`
- `.worktrees/main-integration/webapp/src/app/(dashboard)/categories/page.tsx`
- `.worktrees/main-integration/webapp/src/app/(dashboard)/categorizar/page.tsx`
- `.worktrees/main-integration/webapp/src/app/(dashboard)/dashboard/page.tsx`
- `.worktrees/main-integration/webapp/src/app/(dashboard)/deudas/page.tsx`
- `.worktrees/main-integration/webapp/src/app/(dashboard)/deudas/simulador/page.tsx`
- `.worktrees/main-integration/webapp/src/app/(dashboard)/import/page.tsx`
- `.worktrees/main-integration/webapp/src/app/(dashboard)/layout.tsx`
- `.worktrees/main-integration/webapp/src/app/(dashboard)/recurrentes/page.tsx`
- `.worktrees/main-integration/webapp/src/app/(dashboard)/settings/analytics/page.tsx`
- `.worktrees/main-integration/webapp/src/app/(dashboard)/settings/page.tsx`
- `.worktrees/main-integration/webapp/src/app/(dashboard)/transactions/[id]/page.tsx`
- `.worktrees/main-integration/webapp/src/app/(dashboard)/transactions/page.tsx`
- `.worktrees/main-integration/webapp/src/app/api/bug-reports/route.ts`
- `.worktrees/main-integration/webapp/src/app/api/parse-statement/route.ts`
- `.worktrees/main-integration/webapp/src/app/api/save-unrecognized/route.ts`
- `.worktrees/main-integration/webapp/src/app/auth/callback/route.ts`
- `.worktrees/main-integration/webapp/src/app/layout.tsx`

## Dependency Signals (Folder-level)
- `.worktrees` -> `.worktrees` (919)
- `webapp` -> `webapp` (469)
- `mobile` -> `mobile` (1)

## Recent Changes (git status)
- `docs/agent/PROJECT_CONTEXT.md`
- `docs/agent/project_context.json`
- `mobile/eas.json`
- `mobile/package.json`
- `.pnpm-store/`

## Agent Playbook
- Read this file first, then open only relevant folders/files.
- Prefer paths listed under Patterns and Entrypoints for feature work.
- Regenerate this file after non-trivial code changes.

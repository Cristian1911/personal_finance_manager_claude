# PROJECT_CONTEXT

Auto-generated project intelligence for fast onboarding and safe edits.

- Generated (UTC): `2026-03-03T17:38:48.292794+00:00`
- Project root: `/Users/cristian/Documents/developing/personal_finance_manager`

## Stack Snapshot
- Next.js
- Expo/React Native
- FastAPI
- Supabase
- pnpm workspace

## File/Lang Distribution
- Text files scanned: 1322
- TypeScript/React: 468
- TypeScript: 286
- JSON: 285
- Markdown: 78
- SQL: 75
- Python: 60
- YAML: 28
- Shell: 15
- JavaScript: 15
- CSS: 6
- TOML: 6

## Top-level Areas
- .claude: 365 files
- .worktrees: 352 files
- mobile: 329 files
- webapp: 177 files
- supabase: 27 files
- services: 22 files
- packages: 17 files
- docs: 15 files
- (root): 11 files
- .github: 5 files
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
- `build:aab:local`: `cd android && ./gradlew bundleRelease`
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
- `zod-validators` (15 files): Validation layer using Zod
  - e.g. `webapp/src/actions/recurring-templates.ts`
  - e.g. `webapp/src/actions/profile.ts`
  - e.g. `webapp/src/actions/purchase-decision.ts`
- `fastapi-service` (15 files): FastAPI service modules
  - e.g. `.claude/worktrees/rescue-forgotten-branches/services/pdf_parser/main.py`
  - e.g. `.worktrees/main-integration/services/pdf_parser/main.py`
  - e.g. `services/pdf_parser/test_parser.py`
- `expo-router` (15 files): Expo Router file-based routes
  - e.g. `mobile/app/subscriptions.tsx`
  - e.g. `mobile/app/purchase-decision.tsx`
  - e.g. `mobile/app/+not-found.tsx`
- `repository-pattern` (12 files): Repository pattern in mobile/lib/repositories
  - e.g. `.claude/worktrees/rescue-forgotten-branches/mobile/lib/repositories/budgets.ts`
  - e.g. `.claude/worktrees/rescue-forgotten-branches/mobile/lib/repositories/categories.ts`
  - e.g. `.claude/worktrees/rescue-forgotten-branches/mobile/lib/repositories/transactions.ts`

## Entrypoints
- `.claude/worktrees/rescue-forgotten-branches/mobile/app/(auth)/_layout.tsx`
- `.claude/worktrees/rescue-forgotten-branches/mobile/app/(tabs)/_layout.tsx`
- `.claude/worktrees/rescue-forgotten-branches/mobile/app/_layout.tsx`
- `.claude/worktrees/rescue-forgotten-branches/packages/shared/src/types/domain.ts`
- `.claude/worktrees/rescue-forgotten-branches/services/pdf_parser/main.py`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/(auth)/forgot-password/page.tsx`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/(auth)/layout.tsx`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/(auth)/login/page.tsx`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/(auth)/reset-password/page.tsx`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/(auth)/signup/page.tsx`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/(dashboard)/accounts/[id]/page.tsx`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/(dashboard)/accounts/page.tsx`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/(dashboard)/categories/manage/page.tsx`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/(dashboard)/categories/page.tsx`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/(dashboard)/categorizar/page.tsx`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/(dashboard)/dashboard/page.tsx`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/(dashboard)/deudas/page.tsx`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/(dashboard)/deudas/simulador/page.tsx`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/(dashboard)/import/page.tsx`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/(dashboard)/layout.tsx`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/(dashboard)/recurrentes/page.tsx`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/(dashboard)/settings/analytics/page.tsx`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/(dashboard)/settings/page.tsx`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/(dashboard)/transactions/[id]/page.tsx`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/(dashboard)/transactions/page.tsx`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/api/bug-reports/route.ts`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/api/parse-statement/route.ts`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/api/save-unrecognized/route.ts`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/auth/callback/route.ts`
- `.claude/worktrees/rescue-forgotten-branches/webapp/src/app/layout.tsx`

## Dependency Signals (Folder-level)
- `.claude` -> `.claude` (472)
- `webapp` -> `webapp` (471)
- `.worktrees` -> `.worktrees` (470)
- `mobile` -> `mobile` (1)

## Recent Changes (git status)
- `docs/agent/PROJECT_CONTEXT.md`
- `docs/agent/project_context.json`
- `mobile/ANDROID_RELEASE.md`
- `.claude/worktrees/`
- `.github/workflows/mobile-playstore.yml`

## Agent Playbook
- Read this file first, then open only relevant folders/files.
- Prefer paths listed under Patterns and Entrypoints for feature work.
- Regenerate this file after non-trivial code changes.

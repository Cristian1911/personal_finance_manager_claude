# PROJECT_CONTEXT

Auto-generated project intelligence for fast onboarding and safe edits.

- Generated (UTC): `2026-03-02T13:31:06.333790+00:00`
- Project root: `/Users/cristian/Documents/developing/personal_finance_manager`

## Stack Snapshot
- Next.js
- Expo/React Native
- FastAPI
- Supabase
- pnpm workspace

## File/Lang Distribution
- Text files scanned: 1195
- TypeScript/React: 462
- TypeScript: 282
- JSON: 171
- Markdown: 76
- SQL: 75
- Python: 60
- YAML: 27
- Shell: 15
- JavaScript: 15
- CSS: 6
- TOML: 6

## Top-level Areas
- .claude: 364 files
- .worktrees: 352 files
- mobile: 206 files
- webapp: 177 files
- supabase: 27 files
- services: 22 files
- packages: 17 files
- docs: 13 files
- (root): 11 files
- .github: 4 files
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
  - e.g. `.claude/worktrees/mobile-bugfixes/services/pdf_parser/main.py`
  - e.g. `.worktrees/main-integration/services/pdf_parser/main.py`
  - e.g. `services/pdf_parser/test_parser.py`
- `expo-router` (15 files): Expo Router file-based routes
  - e.g. `mobile/app/subscriptions.tsx`
  - e.g. `mobile/app/+not-found.tsx`
  - e.g. `mobile/app/onboarding.tsx`
- `repository-pattern` (12 files): Repository pattern in mobile/lib/repositories
  - e.g. `.claude/worktrees/mobile-bugfixes/mobile/lib/repositories/budgets.ts`
  - e.g. `.claude/worktrees/mobile-bugfixes/mobile/lib/repositories/categories.ts`
  - e.g. `.claude/worktrees/mobile-bugfixes/mobile/lib/repositories/transactions.ts`

## Entrypoints
- `.claude/worktrees/mobile-bugfixes/mobile/app/(auth)/_layout.tsx`
- `.claude/worktrees/mobile-bugfixes/mobile/app/(tabs)/_layout.tsx`
- `.claude/worktrees/mobile-bugfixes/mobile/app/_layout.tsx`
- `.claude/worktrees/mobile-bugfixes/packages/shared/src/types/domain.ts`
- `.claude/worktrees/mobile-bugfixes/services/pdf_parser/main.py`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/(auth)/forgot-password/page.tsx`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/(auth)/layout.tsx`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/(auth)/login/page.tsx`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/(auth)/reset-password/page.tsx`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/(auth)/signup/page.tsx`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/(dashboard)/accounts/[id]/page.tsx`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/(dashboard)/accounts/page.tsx`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/(dashboard)/categories/manage/page.tsx`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/(dashboard)/categories/page.tsx`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/(dashboard)/categorizar/page.tsx`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/(dashboard)/dashboard/page.tsx`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/(dashboard)/deudas/page.tsx`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/(dashboard)/deudas/simulador/page.tsx`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/(dashboard)/import/page.tsx`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/(dashboard)/layout.tsx`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/(dashboard)/recurrentes/page.tsx`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/(dashboard)/settings/analytics/page.tsx`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/(dashboard)/settings/page.tsx`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/(dashboard)/transactions/[id]/page.tsx`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/(dashboard)/transactions/page.tsx`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/api/bug-reports/route.ts`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/api/parse-statement/route.ts`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/api/save-unrecognized/route.ts`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/auth/callback/route.ts`
- `.claude/worktrees/mobile-bugfixes/webapp/src/app/layout.tsx`

## Dependency Signals (Folder-level)
- `webapp` -> `webapp` (471)
- `.claude` -> `.claude` (470)
- `.worktrees` -> `.worktrees` (470)
- `mobile` -> `mobile` (1)

## Recent Changes (git status)
- `.github/workflows/deploy.yml`
- `.github/workflows/mobile-ios.yml`
- `.gitignore`
- `docker-compose.prod.yml`
- `docker-compose.yml`
- `docs/agent/PROJECT_CONTEXT.md`
- `docs/agent/project_context.json`
- `infra/setup-vps.sh`
- `mobile/app.json`
- `mobile/package.json`
- `webapp/Dockerfile`
- `webapp/src/app/api/parse-statement/route.ts`
- `webapp/src/app/api/save-unrecognized/route.ts`
- `.claude/worktrees/`
- `.pnpm-store/`
- `mobile/ANDROID_RELEASE.md`
- `webapp/src/app/api/_shared/`

## Agent Playbook
- Read this file first, then open only relevant folders/files.
- Prefer paths listed under Patterns and Entrypoints for feature work.
- Regenerate this file after non-trivial code changes.

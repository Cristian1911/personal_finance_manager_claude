# PROJECT_CONTEXT

Auto-generated project intelligence for fast onboarding and safe edits.

- Generated (UTC): `2026-02-28T03:00:03.381520+00:00`
- Project root: `/Users/cristian/Documents/developing/personal_finance_manager`

## Stack Snapshot
- Next.js
- Expo/React Native
- FastAPI
- Supabase
- pnpm workspace

## File/Lang Distribution
- Text files scanned: 821
- TypeScript/React: 303
- TypeScript: 182
- JSON: 155
- Markdown: 49
- SQL: 46
- Python: 40
- YAML: 16
- Shell: 12
- JavaScript: 10
- CSS: 4
- TOML: 4

## Top-level Areas
- .worktrees: 343 files
- mobile: 202 files
- webapp: 176 files
- supabase: 23 files
- services: 22 files
- packages: 17 files
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
- `zod-validators` (15 files): Validation layer using Zod
  - e.g. `webapp/src/actions/recurring-templates.ts`
  - e.g. `webapp/src/actions/profile.ts`
  - e.g. `webapp/src/actions/purchase-decision.ts`
- `expo-router` (15 files): Expo Router file-based routes
  - e.g. `mobile/app/subscriptions.tsx`
  - e.g. `mobile/app/+not-found.tsx`
  - e.g. `mobile/app/onboarding.tsx`
- `fastapi-service` (15 files): FastAPI service modules
  - e.g. `.worktrees/security/services/pdf_parser/main.py`
  - e.g. `services/pdf_parser/test_parser.py`
  - e.g. `services/pdf_parser/models.py`
- `repository-pattern` (8 files): Repository pattern in mobile/lib/repositories
  - e.g. `mobile/lib/repositories/budgets.ts`
  - e.g. `mobile/lib/repositories/categories.ts`
  - e.g. `mobile/lib/repositories/transactions.ts`

## Entrypoints
- `.worktrees/security/mobile/app/(auth)/_layout.tsx`
- `.worktrees/security/mobile/app/(tabs)/_layout.tsx`
- `.worktrees/security/mobile/app/_layout.tsx`
- `.worktrees/security/packages/shared/src/types/domain.ts`
- `.worktrees/security/services/pdf_parser/main.py`
- `.worktrees/security/webapp/src/app/(auth)/forgot-password/page.tsx`
- `.worktrees/security/webapp/src/app/(auth)/layout.tsx`
- `.worktrees/security/webapp/src/app/(auth)/login/page.tsx`
- `.worktrees/security/webapp/src/app/(auth)/reset-password/page.tsx`
- `.worktrees/security/webapp/src/app/(auth)/signup/page.tsx`
- `.worktrees/security/webapp/src/app/(dashboard)/accounts/[id]/page.tsx`
- `.worktrees/security/webapp/src/app/(dashboard)/accounts/page.tsx`
- `.worktrees/security/webapp/src/app/(dashboard)/categories/manage/page.tsx`
- `.worktrees/security/webapp/src/app/(dashboard)/categories/page.tsx`
- `.worktrees/security/webapp/src/app/(dashboard)/categorizar/page.tsx`
- `.worktrees/security/webapp/src/app/(dashboard)/dashboard/page.tsx`
- `.worktrees/security/webapp/src/app/(dashboard)/deudas/page.tsx`
- `.worktrees/security/webapp/src/app/(dashboard)/deudas/simulador/page.tsx`
- `.worktrees/security/webapp/src/app/(dashboard)/import/page.tsx`
- `.worktrees/security/webapp/src/app/(dashboard)/layout.tsx`
- `.worktrees/security/webapp/src/app/(dashboard)/recurrentes/page.tsx`
- `.worktrees/security/webapp/src/app/(dashboard)/settings/analytics/page.tsx`
- `.worktrees/security/webapp/src/app/(dashboard)/settings/page.tsx`
- `.worktrees/security/webapp/src/app/(dashboard)/transactions/[id]/page.tsx`
- `.worktrees/security/webapp/src/app/(dashboard)/transactions/page.tsx`
- `.worktrees/security/webapp/src/app/api/bug-reports/route.ts`
- `.worktrees/security/webapp/src/app/api/parse-statement/route.ts`
- `.worktrees/security/webapp/src/app/api/save-unrecognized/route.ts`
- `.worktrees/security/webapp/src/app/auth/callback/route.ts`
- `.worktrees/security/webapp/src/app/layout.tsx`

## Dependency Signals (Folder-level)
- `webapp` -> `webapp` (469)
- `.worktrees` -> `.worktrees` (449)
- `mobile` -> `mobile` (1)

## Recent Changes (git status)
- `mobile/app/(tabs)/budgets.tsx`
- `mobile/app/capture.tsx`
- `mobile/app/subscriptions.tsx`
- `mobile/app/transaction/[id].tsx`
- `mobile/lib/amount.ts`

## Agent Playbook
- Read this file first, then open only relevant folders/files.
- Prefer paths listed under Patterns and Entrypoints for feature work.
- Regenerate this file after non-trivial code changes.

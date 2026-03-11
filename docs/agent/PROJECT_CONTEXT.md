# PROJECT_CONTEXT

Auto-generated project intelligence for fast onboarding and safe edits.

- Generated (UTC): `2026-03-11T20:20:39.682488+00:00`
- Project root: `/Users/cristian/Documents/developing/current-projects/zeta`

## Stack Snapshot
- Next.js
- Expo/React Native
- FastAPI
- Supabase
- pnpm workspace

## File/Lang Distribution
- Text files scanned: 745
- JSON: 282
- TypeScript/React: 193
- TypeScript: 108
- Markdown: 67
- SQL: 29
- Python: 22
- YAML: 10
- Shell: 10
- JavaScript: 10
- CSS: 7
- HTML: 5
- TOML: 2

## Top-level Areas
- mobile: 354 files
- webapp: 258 files
- supabase: 31 files
- docs: 26 files
- services: 24 files
- packages: 18 files
- (root): 15 files
- .claude: 10 files
- .github: 5 files
- infra: 2 files
- brand: 1 files
- test-results: 1 files

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
- `zod-validators` (15 files): Validation layer using Zod
  - e.g. `webapp/playwright-report/trace/uiMode.CQJ9SCIQ.js`
  - e.g. `webapp/playwright-report/trace/sw.bundle.js`
  - e.g. `webapp/playwright-report/trace/assets/defaultSettingsView-CJSZINFr.js`
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
  - e.g. `mobile/app/annotate-screenshot.tsx`
  - e.g. `mobile/app/purchase-decision.tsx`
- `fastapi-service` (15 files): FastAPI service modules
  - e.g. `services/pdf_parser/test_parser.py`
  - e.g. `services/pdf_parser/models.py`
  - e.g. `services/pdf_parser/storage.py`
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
- `webapp/src/app/(dashboard)/categories/page.tsx`
- `webapp/src/app/(dashboard)/categorizar/page.tsx`
- `webapp/src/app/(dashboard)/dashboard/page.tsx`
- `webapp/src/app/(dashboard)/destinatarios/[id]/page.tsx`
- `webapp/src/app/(dashboard)/destinatarios/page.tsx`
- `webapp/src/app/(dashboard)/deudas/page.tsx`
- `webapp/src/app/(dashboard)/deudas/simulador/page.tsx`
- `webapp/src/app/(dashboard)/gestionar/page.tsx`
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

## Dependency Signals (Folder-level)
- `webapp` -> `webapp` (608)
- `mobile` -> `mobile` (1)

## Recent Changes (git status)
- `.gitignore`
- `pnpm-lock.yaml`
- `webapp/package.json`
- `webapp/src/components/dashboard/accounts-overview.tsx`
- `webapp/src/components/dashboard/dashboard-account-picker.tsx`
- `webapp/src/components/dashboard/interactive-metric-card.tsx`
- `webapp/src/components/import/parsed-transaction-table.tsx`
- `webapp/src/components/mobile/bottom-tab-bar.tsx`
- `webapp/src/components/mobile/fab-menu.tsx`
- `webapp/src/components/mobile/mobile-presupuesto.tsx`
- `webapp/src/components/settings/bug-report-form.tsx`
- `webapp/src/components/ui/tabs.tsx`
- `.claude/launch.json`
- `webapp/e2e/`
- `webapp/playwright.config.ts`

## Agent Playbook
- Read this file first, then open only relevant folders/files.
- Prefer paths listed under Patterns and Entrypoints for feature work.
- Regenerate this file after non-trivial code changes.

# PROJECT_CONTEXT

Auto-generated project intelligence for fast onboarding and safe edits.
Treat this as a durable snapshot; prefer jcodemunch for live structure and symbol queries.

- Generated (UTC): `2026-03-27T15:17:11.878000+00:00`
- Project root: `/Users/cristian/Documents/developing/current-projects/zeta`

## Stack Snapshot
- Node.js
- Docker
- pnpm workspace
- pnpm

## File/Lang Distribution
- Text files scanned: 937
- JSON: 283
- TypeScript/React: 249
- Markdown: 146
- TypeScript: 143
- SQL: 34
- HTML: 26
- Python: 23
- YAML: 12
- Shell: 11
- JavaScript: 5
- CSS: 3
- TOML: 2

## Top-level Areas
- mobile: 354 files
- webapp: 302 files
- .planning: 62 files
- docs: 58 files
- supabase: 36 files
- packages: 28 files
- services: 24 files
- (root): 16 files
- .superpowers: 16 files
- .claude: 14 files
- .agents: 7 files
- ui-showcases: 7 files
- .github: 7 files
- infra: 2 files
- mockups: 2 files

## Key Commands
### mobile (package.json)
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
### (root) (package.json)
- `start`: `pnpm --filter mobile start`
- `web`: `pnpm --filter webapp dev`
- `mobile`: `pnpm --filter mobile start`
- `ios`: `pnpm --filter mobile ios`
- `android`: `pnpm --filter mobile android`
- `build:web`: `pnpm --filter webapp build`
### packages/shared (package.json)
- `test`: `vitest run`
- `test:watch`: `vitest`
### webapp (package.json)
- `dev`: `next dev`
- `build`: `next build`
- `start`: `next start`
- `lint`: `eslint`

## Patterns Detected
- `app-router` (15 files): App-router style entrypoints
  - e.g. `webapp/src/app/auth/callback/route.ts`
  - e.g. `webapp/src/app/api/save-unrecognized/route.ts`
  - e.g. `webapp/src/app/api/bug-reports/route.ts`
- `ui-components` (15 files): Reusable UI component modules
  - e.g. `webapp/src/components/month-selector.tsx`
  - e.g. `webapp/src/components/ui/tabs.tsx`
  - e.g. `webapp/src/components/ui/card.tsx`
- `server-actions` (15 files): Server-side action modules
  - e.g. `webapp/src/actions/statement-snapshots.ts`
  - e.g. `webapp/src/actions/dashboard-config.ts`
  - e.g. `webapp/src/actions/interest-paid.ts`
- `data-layer` (15 files): Schemas, migrations, or database-related code
  - e.g. `supabase/migrations/20260214100003_add_transaction_is_excluded.sql`
  - e.g. `supabase/migrations/20260227000001_add_updated_at_to_statement_snapshots.sql`
  - e.g. `supabase/migrations/20260214100001_seed_categories.sql`
- `tests` (11 files): Unit, integration, or e2e tests
  - e.g. `webapp/e2e/security.spec.ts`
  - e.g. `webapp/e2e/ux-audit.spec.ts`
  - e.g. `webapp/e2e/auth.setup.ts`
- `api-routes` (4 files): HTTP or API route handlers
  - e.g. `webapp/src/app/api/save-unrecognized/route.ts`
  - e.g. `webapp/src/app/api/bug-reports/route.ts`
  - e.g. `webapp/src/app/api/_shared/auth.ts`
- `cli-scripts` (4 files): CLI or automation scripts
  - e.g. `.agents/skills/codebase-context/scripts/install_git_hook.sh`
  - e.g. `.agents/skills/codebase-context/scripts/build_context.py`
  - e.g. `.claude/skills/codebase-context/scripts/install_git_hook.sh`

## Entrypoints
- `.agents/skills/codebase-context/scripts/build_context.py`
- `.agents/skills/codebase-context/scripts/install_git_hook.sh`
- `.claude/skills/codebase-context/scripts/build_context.py`
- `.claude/skills/codebase-context/scripts/install_git_hook.sh`
- `mobile/app/(tabs)/index.tsx`
- `packages/shared/src/index.ts`
- `services/pdf_parser/main.py`
- `supabase/functions/notify-bug-report/index.ts`
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
- `webapp/src/app/(dashboard)/deudas/planificador/page.tsx`
- `webapp/src/app/(dashboard)/gestionar/page.tsx`
- `webapp/src/app/(dashboard)/import/page.tsx`
- `webapp/src/app/(dashboard)/layout.tsx`
- `webapp/src/app/(dashboard)/recurrentes/page.tsx`
- `webapp/src/app/(dashboard)/settings/analytics/page.tsx`
- `webapp/src/app/(dashboard)/settings/page.tsx`
- `webapp/src/app/(dashboard)/transactions/[id]/page.tsx`
- `webapp/src/app/(dashboard)/transactions/page.tsx`

## Dependency Signals (Folder-level)
- `webapp` -> `webapp` (892)
- `mobile` -> `mobile` (1)

## Recent Changes (git status)
- `.planning/STATE.md`
- `IDEAS.md`
- `packages/shared/src/constants/categories.ts`
- `packages/shared/src/utils/__tests__/auto-categorize.test.ts`
- `packages/shared/src/utils/auto-categorize.ts`
- `webapp/src/actions/accounts.ts`
- `webapp/src/actions/charts.ts`
- `webapp/src/actions/interest-paid.ts`
- `webapp/src/actions/recurring-templates.ts`
- `webapp/src/actions/transactions.ts`
- `webapp/src/app/(dashboard)/accounts/[id]/page.tsx`
- `webapp/src/app/(dashboard)/dashboard/page.tsx`
- `webapp/src/components/accounts/reconcile-balance-dialog.tsx`
- `webapp/src/components/dashboard/accounts-overview.tsx`
- `webapp/src/components/dashboard/cash-flow-hero-strip.tsx`
- `webapp/src/components/dashboard/dashboard-hero.tsx`
- `webapp/src/components/mobile/mobile-dashboard.tsx`
- `webapp/src/components/recurring/recurring-confirm-inline.tsx`
- `webapp/src/components/recurring/recurring-payment-timeline.tsx`
- `webapp/src/components/recurring/recurring-timeline-view.tsx`
- `webapp/src/components/recurring/use-recurring-month.ts`
- `webapp/src/components/ui/category-combobox.tsx`
- `webapp/src/lib/supabase/auth.ts`
- `.agents/`
- `.planning/phases/05-onboarding-audit/5-CONTEXT.md`
- `AGENTS.md`
- `ui-showcases/.gitkeep`
- `ui-showcases/ship-now/`
- `webapp/src/components/dashboard/quick-value-updates.tsx`
- `webapp/src/lib/utils/__tests__/account-balance.test.ts`

## Agent Playbook
- Read this file first, then use jcodemunch for live repo outline, tree, and symbol lookups.
- Prefer paths listed under Patterns and Entrypoints for feature work.
- Regenerate this file after non-trivial code changes.

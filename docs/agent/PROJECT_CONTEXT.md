# PROJECT_CONTEXT

Auto-generated project intelligence for fast onboarding and safe edits.
Treat this as a durable snapshot; prefer jcodemunch for live structure and symbol queries.

- Generated (UTC): `2026-03-31T17:46:08.962729+00:00`
- Project root: `/Users/cristian/Documents/developing/current-projects/zeta`

## Stack Snapshot
- Node.js
- Docker
- pnpm workspace
- pnpm

## File/Lang Distribution
- Text files scanned: 1086
- TypeScript/React: 296
- JSON: 285
- Markdown: 186
- TypeScript: 174
- HTML: 50
- SQL: 38
- Python: 24
- YAML: 12
- Shell: 11
- JavaScript: 5
- CSS: 3
- TOML: 2

## Top-level Areas
- webapp: 378 files
- mobile: 354 files
- .planning: 90 files
- docs: 66 files
- supabase: 40 files
- .superpowers: 37 files
- packages: 32 files
- services: 24 files
- (root): 17 files
- .claude: 14 files
- ui-showcases: 14 files
- .agents: 7 files
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
### packages/mcp-server (package.json)
- `build`: `tsc`
- `dev`: `tsx src/index.ts`
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
  - e.g. `webapp/src/app/api/capture/route.ts`
- `ui-components` (15 files): Reusable UI component modules
  - e.g. `webapp/src/components/month-selector.tsx`
  - e.g. `webapp/src/components/ui/tabs.tsx`
  - e.g. `webapp/src/components/ui/card.tsx`
- `server-actions` (15 files): Server-side action modules
  - e.g. `webapp/src/actions/statement-snapshots.ts`
  - e.g. `webapp/src/actions/dashboard-config.ts`
  - e.g. `webapp/src/actions/interest-paid.ts`
- `data-layer` (15 files): Schemas, migrations, or database-related code
  - e.g. `supabase/migrations/20260329050657_create_capture_tokens.sql`
  - e.g. `supabase/migrations/20260214100003_add_transaction_is_excluded.sql`
  - e.g. `supabase/migrations/20260227000001_add_updated_at_to_statement_snapshots.sql`
- `tests` (14 files): Unit, integration, or e2e tests
  - e.g. `webapp/e2e/security.spec.ts`
  - e.g. `webapp/e2e/ux-audit.spec.ts`
  - e.g. `webapp/e2e/auth.setup.ts`
- `api-routes` (13 files): HTTP or API route handlers
  - e.g. `webapp/src/app/api/save-unrecognized/route.ts`
  - e.g. `webapp/src/app/api/capture/route.ts`
  - e.g. `webapp/src/app/api/mcp/debts/route.ts`
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
- `packages/mcp-server/src/index.ts`
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
- `webapp/src/app/(dashboard)/etiquetas/page.tsx`
- `webapp/src/app/(dashboard)/gestionar/page.tsx`
- `webapp/src/app/(dashboard)/import/page.tsx`
- `webapp/src/app/(dashboard)/layout.tsx`
- `webapp/src/app/(dashboard)/plan/page.tsx`
- `webapp/src/app/(dashboard)/presupuesto/page.tsx`
- `webapp/src/app/(dashboard)/recurrentes/page.tsx`

## Dependency Signals (Folder-level)
- `webapp` -> `webapp` (1264)
- `mobile` -> `mobile` (1)

## Recent Changes (git status)
- `webapp/src/app/page.tsx`
- `MANUAL_TODOS.md`
- `webapp/src/components/marketing/`

## Agent Playbook
- Read this file first, then use jcodemunch for live repo outline, tree, and symbol lookups.
- Prefer paths listed under Patterns and Entrypoints for feature work.
- Regenerate this file after non-trivial code changes.

# CLAUDE.md

## Build & Dev
- `cd webapp && pnpm dev` — start Next.js dev server
- `cd webapp && pnpm build` — production build (uses Turbopack)
- `cd services/pdf_parser && uv run python main.py` — start PDF parser on :8000
- Package manager: **pnpm** (not npm), **uv** for Python
- Living context docs: `python3 .claude/skills/codebase-context/scripts/build_context.py`
- Install auto-refresh hook: `bash .claude/skills/codebase-context/scripts/install_git_hook.sh`

## Project Structure
- `webapp/` — Next.js 15 (App Router) + TypeScript + Tailwind v4 + shadcn/ui
- `services/pdf_parser/` — Python/FastAPI PDF parser for Bancolombia statements
- `supabase/` — migrations and config (linked to remote, no local Docker)
- `.claude/` — agents, skills, and todo tracked in git

### Key Directories (webapp/src/)
- `actions/` — Server Actions (auth, accounts, categories, transactions, profile, import, debt, statement-snapshots)
- `components/` — React components organized by feature (accounts/, import/, debt/, ui/)
- `lib/supabase/` — Client factories: `client.ts` (browser), `server.ts` (SSR), `middleware.ts`
- `lib/validators/` — Zod schemas per entity
- `lib/utils/` — currency, date, idempotency, auto-categorize, snapshot-diff
- `types/` — `database.ts` (auto-generated), `domain.ts`, `import.ts`, `actions.ts`, `account-form.ts`
- `app/(auth)/` — login, signup, forgot/reset-password
- `app/(dashboard)/` — accounts, transactions, import, deudas, dashboard, categories, settings

## Code Patterns
- Spanish UI — all user-facing strings in Spanish
- Server Actions: `(prevState, formData) => Promise<ActionResult<T>>` with `useActionState`
- Zod validation errors: `.issues[0].message` (not `.errors[0].message`)
- UUID validation: use permissive regex `/^[0-9a-f]{8}-...$/i`, NOT `z.string().uuid()` — Zod 4 rejects seed UUIDs
- Currency: `formatCurrency(amount, code)` from `src/lib/utils/currency.ts`
- Dates: Spanish locale via `formatDate()` from `src/lib/utils/date.ts`
- Idempotency: `computeIdempotencyKey()` from `src/lib/utils/idempotency.ts` for dedup

## Supabase
- Project ID: `tgkhaxipfgskxydotdtu` (sa-east-1, org: zybaordjrezdjajzwisk)
- Types: `src/types/database.ts` — regenerate after migrations
- Regen command: `npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu`
- Migrations: `npx supabase migration new <name>`, push with `npx supabase db push`
- RLS pattern: `(select auth.uid()) = user_id`
- Duplicate insert error code: `23505`

### Database Schema
- 5 tables: `profiles`, `accounts`, `categories`, `transactions`, `statement_snapshots`
- 7 enums: transaction_direction, currency_code, account_type, connection_status, categorization_source, transaction_status, data_provider
- Categories: hierarchical (adjacency list), system defaults (user_id=NULL, is_system=true), 17 flat seed categories
- Transactions: idempotency_key (SHA-256), amount always positive + direction enum
- Statement snapshots: one per account+period, stores statement metadata + credit card metadata, enables month-over-month diff tracking

## PDF Import Flow
- Upload PDF → `/api/parse-statement` proxies to Python parser → returns `ParsedStatement[]`
- 4-step wizard: Upload → Review (map to accounts) → Confirm (select transactions + auto-categorize) → Results
- On import: transactions inserted with idempotency, account metadata updated from statement, snapshot created/upserted
- Results show transaction counts + per-account diff (old → new for credit limit, balance, interest rate, etc.)
- Account detail page shows statement history timeline for credit cards, loans, savings

## Gotchas
- Zod 4 `.uuid()` enforces RFC 9562 — seed category UUIDs (a0000001-...) fail validation
- shadcn/ui Checkbox: use `checked="indeterminate"`, not an `indeterminate` prop
- Radix Select sends empty string (not null/undefined) when no value — use `z.preprocess` to normalize
- Shell `compdef` warning leaks into stdout redirects — always strip first line if piping to file
- When piping `supabase gen types` to file, verify `export type Json =` header is intact

## Codebase Search (jcodemunch)
- The codebase is pre-indexed by jcodemunch — prefer these tools over Grep/Glob for discovery:
  - `mcp__jcodemunch__search_symbols` — find functions, classes, types by name
  - `mcp__jcodemunch__search_text` — full-text search across the codebase
  - `mcp__jcodemunch__get_file_outline` — list all symbols in a specific file
  - `mcp__jcodemunch__get_symbol` — get details on a specific symbol
- Fall back to Grep only for regex patterns not supported by jcodemunch
- Re-index when: new files added, functions/classes renamed or deleted, large refactors
- No need to re-index for: logic edits inside existing functions, style/config changes
- Prefer incremental re-index (faster): `mcp__jcodemunch__index_folder` with `incremental: true`
- Good habit: re-index at the start of a new session after a productive coding session

## Agent Context Workflow
- **Code discovery**: use jcodemunch (see above) — do NOT read `PROJECT_CONTEXT.md` upfront every session
- **Read `docs/agent/PROJECT_CONTEXT.md` only when** you need architectural overview, conventions, or gotchas not covered by CLAUDE.md
- **Update `PROJECT_CONTEXT.md`** only after significant architectural changes (not routine edits); run `python3 .claude/skills/codebase-context/scripts/build_context.py` to regenerate
- `PROJECT_CONTEXT.md` should stay lean — remove file/symbol inventories that jcodemunch already covers

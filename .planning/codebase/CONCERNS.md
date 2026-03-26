# Codebase Concerns

**Analysis Date:** 2026-03-25

---

## Tech Debt

**Reconciliation column null-check wrapped in `any` casts:**
- Issue: `reconciled_into_transaction_id` column may not exist on older DB instances, so every query that filters by it is wrapped in a try/fallback pattern using `any`-typed helpers.
- Files: `webapp/src/lib/utils/transactions.ts`, `webapp/src/actions/categorize.ts`, `webapp/src/actions/budgets.ts`, `webapp/src/actions/import-transactions.ts`, `webapp/src/app/(dashboard)/dashboard/page.tsx`
- Impact: All five callers carry the dual-query overhead and `any` type leakage. The column now exists in `database.ts` types, making the fallback dead code for all current deployments.
- Fix approach: Confirm the column exists on all active DB instances, then remove `isMissingReconciliationColumnError`, `executeVisibleTransactionQuery`, and the fallback path. Replace with a direct `.is("reconciled_into_transaction_id", null)` filter.

**`TabViewRouter` spreads `data as any` into every mobile tab component:**
- Issue: `data: Record<string, unknown>` is passed directly to five different strongly-typed components via `as any` spread casts.
- Files: `webapp/src/components/mobile/tab-view-router.tsx`
- Impact: Type errors in any mobile tab component will silently pass. Prop renames break at runtime, not compile time.
- Fix approach: Define a discriminated union type or per-variant typed props; replace the switch with typed conditional renders.

**`applyVisibleTransactionFilter` function accepts and returns `any`:**
- Issue: The Supabase query builder is not typed generically, so the filter wrapper uses `any` for both input and output.
- Files: `webapp/src/lib/utils/transactions.ts`
- Impact: Callers lose the return type, making downstream `.data` access untyped.
- Fix approach: Type the function with a generic that preserves the query builder type, or (after reconciliation cleanup above) delete the wrapper entirely.

**Analytics schema cast with `as any`:**
- Issue: The `analytics` Supabase schema is not in the generated `Database` type, so the client is cast with `(supabase as any).schema("analytics")`.
- Files: `webapp/src/app/(dashboard)/settings/analytics/page.tsx:51`
- Impact: No type safety on analytics queries; schema changes go undetected until runtime.
- Fix approach: Either extend the generated `Database` type to include the `analytics` schema, or create typed view definitions in a local type file.

**`formatCached` in exchange-rate returns `any`:**
- Issue: `formatCached(cached: any, pair: string)` loses all type safety from the DB row.
- Files: `webapp/src/actions/exchange-rate.ts:95`
- Fix approach: Type the parameter using `Database["public"]["Tables"]["exchange_rate_cache"]["Row"]`.

**Hardcoded seed category UUIDs scattered across the codebase:**
- Issue: Non-RFC-9562 seed UUIDs (`a0000001-0001-4000-8000-000000000XXX`) are hardcoded directly in business logic files instead of being imported from a single constants file.
- Files:
  - `webapp/src/actions/recurring-templates.ts:21-22` (DEBT_PAYMENT_CATEGORY_ID, TRANSFER_CATEGORY_ID)
  - `mobile/app/subscriptions.tsx:18` (SUBSCRIPTIONS_CATEGORY_ID)
  - `mobile/lib/transaction-semantics.ts:1` (DEBT_PAYMENT_CATEGORY_ID)
  - `packages/shared/src/utils/auto-categorize.ts:21-30` (full map)
- Impact: Category UUID changes require grep-and-replace across three packages. The IDs are also duplicated between `webapp` and `mobile` independently.
- Fix approach: Consolidate all seed category constants into `packages/shared/src/constants/categories.ts` and import from there.

**Dashboard config stored in `localStorage` with fire-and-forget DB sync:**
- Issue: `use-dashboard-config.ts` treats `localStorage` as the optimistic source of truth and calls `updateDashboardConfig()` with `.catch(() => {})` — silent failures mean DB and client can drift permanently.
- Files: `webapp/src/hooks/use-dashboard-config.ts`
- Impact: If a write fails (network error, RLS violation), the user sees their config but it is not persisted. On a new device/browser, the server config wins, which can feel like data loss.
- Fix approach: Surface errors with a toast notification, or switch to server-first with optimistic local update.

---

## Known Gotchas and Mitigations

**Zod 4 `.uuid()` rejects seed category UUIDs:**
- Cause: Zod 4 enforces RFC 9562 version/variant bits. Seed UUIDs (`a0000001-...`) have non-standard version bytes.
- Mitigation: All validators that handle category IDs use a permissive regex instead: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`.
- Files: `webapp/src/lib/validators/transaction.ts:4-6`, `webapp/src/lib/validators/category.ts:3`, `webapp/src/lib/validators/destinatario.ts:3`, `webapp/src/lib/validators/budget.ts:6`, `webapp/src/lib/validators/recurring-template.ts:4`, `webapp/src/lib/validators/import.ts:5`
- Risk: Two actions (`webapp/src/actions/recurring-templates.ts:390,394` and `webapp/src/actions/purchase-decision.ts:25-26`) still use `z.string().uuid()` directly and will reject any category UUID that happens to be a seed ID in those flows.

**Radix Select sends empty string instead of `null`/`undefined`:**
- Mitigation: Use `z.preprocess((val) => (val === "" || val === null ? undefined : val), ...)` before optional UUID fields. See `webapp/src/lib/validators/transaction.ts:18-21`.
- Risk: Any new form using `<Select>` for an optional field must include this preprocess step or it will pass `""` to the DB query.

**Turbopack panics require `.next` cleanup:**
- Trigger: Occurs occasionally during development, especially after dependency upgrades.
- Mitigation: Kill the dev server, run `rm -rf .next`, restart `pnpm dev`.
- Files: `webapp/` dev server only; does not affect production builds.

**Falabella PDF parser has doubled-character output:**
- Cause: The Falabella CMR PDF renders text in overlapping layers, so pdfplumber extracts every character twice (e.g., `"CCMMRR"` instead of `"CMR"`).
- Mitigation: `_normalize_line()` in the parser detects and collapses fully-doubled tokens before regex matching.
- Files: `services/pdf_parser/parsers/falabella_credit_card.py:7-12`

**`getSession()` vs `getUser()` auth performance tradeoff:**
- `getUserSafely()` tries `getSession()` first (local JWT, ~0ms) then falls back to `getUser()` (~300ms network call). Revoked sessions are caught only on the next middleware check.
- Files: `webapp/src/lib/supabase/auth.ts:48-74`

**`createAdminClient()` returns `null` if `SUPABASE_SECRET_KEY` is missing:**
- 36 call sites use `createAdminClient()!` (non-null assertion). If the environment variable is missing in production, every one of these will throw `Cannot read properties of null`.
- Files: `webapp/src/lib/supabase/admin.ts`, all files in `webapp/src/actions/` that call `createAdminClient()`.
- Mitigation: `createAdminClient()` failing means `SUPABASE_SECRET_KEY` was not set during deploy — the Docker Compose healthcheck would fail before serving traffic in that case.

---

## Missing Features / Incomplete Implementations

**Banco de Bogotá savings account parser is an empty stub:**
- Issue: `parse_bogota_savings` opens the PDF but does nothing — it contains four `# TODO:` comments and always raises `ValueError("No se encontraron transacciones...")`. It is registered in the parser detection system.
- Files: `services/pdf_parser/parsers/bogota_savings.py`
- Impact: Any Bogotá savings PDF upload will fail with an error response even after being detected as Bogotá savings format.
- Fix approach: Gather a sample PDF and implement the regex patterns; all other Banco de Bogotá parsers can serve as reference.

**No `error.tsx` error boundary in the Next.js app:**
- Issue: Neither the root app nor any route segment defines an `error.tsx` file. Unhandled exceptions in Server Components will show the default Next.js error page with no user-friendly fallback.
- Files: Entire `webapp/src/app/` tree
- Fix approach: Add `webapp/src/app/(dashboard)/error.tsx` as a minimum, wrapping the dashboard layout segment.

**No `not-found.tsx` 404 page:**
- Issue: No custom 404 page exists; Next.js default is shown.
- Files: `webapp/src/app/`

**Middleware protected-path list is incomplete:**
- Issue: Several authenticated routes are missing from the `protectedPaths` array in the middleware. Routes like `/deudas`, `/import`, `/categorizar`, `/recurrentes`, `/gestionar`, `/onboarding` are not in the list.
- Files: `webapp/src/lib/supabase/middleware.ts:49-57`
- Impact: Unauthenticated users can reach these routes via direct URL (the page-level `if (!user) return null` or `redirect("/login")` catches most, but only two pages do that check — `dashboard/page.tsx` and `gestionar/page.tsx`). Server Actions are still protected because they call `getAuthenticatedClient()`.
- Fix approach: Either list all routes explicitly or use a glob pattern that matches the entire `/(dashboard)/` segment.

**Settings page uses `supabase.auth.getUser()` directly instead of `getAuthenticatedClient()`:**
- Issue: `webapp/src/app/(dashboard)/settings/page.tsx` calls `createClient()` + `supabase.auth.getUser()` separately, bypassing the React `cache()` deduplication.
- Impact: On a page load, two separate JWT checks run instead of one cached one.
- Fix approach: Replace with `getAuthenticatedClient()` per the pattern used by all other dashboard pages.

**Onboarding phone mockup is a visual placeholder:**
- Issue: The "dashboard preview" shown during onboarding step 3 is a static grey box with the text "Tu dashboard".
- Files: `webapp/src/app/onboarding/page.tsx:427-431`
- Impact: Low-fidelity visual reduces onboarding polish but does not break functionality.

**Mobile app is a design-source follower, not production-complete:**
- Issue: Per project notes, the React Native `mobile/` app is being rebuilt to match the webapp design. Several screen files exist but have reduced functionality compared to the webapp equivalents.
- Files: `mobile/app/(tabs)/budgets.tsx`, `mobile/app/(tabs)/import.tsx`

---

## Performance Bottlenecks

**Dashboard page fires 10+ parallel data fetches on every load:**
- Location: `webapp/src/app/(dashboard)/dashboard/page.tsx`
- The page awaits `Promise.all` of multiple server action calls on each request. The `"use cache"` directive with `cacheLife("zeta")` (5min stale, 5min revalidate, 1h expire) mitigates this for most users, but first loads and post-invalidation loads are expensive.
- Impact: On cache miss, the dashboard incurs 10+ DB queries in a single request.
- Improvement path: Consider streaming individual dashboard sections with `<Suspense>` wrappers around each section so above-the-fold content loads first.

**`framer-motion` bundle is significant (62 import sites):**
- The `framer-motion` v12 package is used in 62 component files. It is a large client-side bundle dependency that loads on every animated component mount.
- Files: Check with `grep -r "framer-motion" webapp/src --include="*.tsx" -l`
- Improvement path: Per the `feedback_speed_critical.md` note, speed is the #1 priority. Evaluate whether CSS `@keyframes` or `transition` can replace motion animations in hot paths like the dashboard.

**Exchange rate fetch makes 2 external HTTP calls per cache miss:**
- Location: `webapp/src/actions/exchange-rate.ts:48-51`
- Calls `frankfurter.app/latest` and `frankfurter.app/{date}..` in parallel. On failure, silently falls back to stale cache.
- Impact: If frankfurter.app is slow or down, the dashboard stalls for up to the fetch timeout.
- Improvement path: Add a stricter timeout with `AbortController`; consider a background cron job to pre-warm the cache instead of lazy cache on user request.

**`getEstimatedIncome` falls back to scanning transaction history:**
- Location: `webapp/src/actions/income.ts`
- When no `monthly_salary` is set in the profile, income is estimated by scanning INFLOW transactions in liquid accounts. This is a full table scan filtered to recent months.
- Impact: Affects health meters, 50/30/20 allocation, and debt countdown — all of which call this function.
- Improvement path: Encourage users to set `monthly_salary` during onboarding; add a banner for users without it.

---

## Security Concerns

**Admin client non-null assertion (`!`) at 36 call sites:**
- Risk: `createAdminClient()` returns `null` when `SUPABASE_SECRET_KEY` is not set. Non-null assertions will throw at runtime, not return a typed error.
- Files: All action files listed under `webapp/src/actions/` that call `createAdminClient()`.
- Current mitigation: The `SUPABASE_SECRET_KEY` env var is required in `docker-compose.prod.yml`. The PDF parser healthcheck fails if the key is absent, blocking traffic.
- Recommendation: Replace `!` assertions with an explicit guard that throws a descriptive error: `if (!supabase) throw new Error("Admin client unavailable: SUPABASE_SECRET_KEY not set")`.

**Middleware protected-path list does not cover all authenticated routes:**
- Risk: `/deudas`, `/import`, `/categorizar`, `/recurrentes`, `/onboarding`, `/settings/analytics` are not in the middleware `protectedPaths` array.
- Files: `webapp/src/lib/supabase/middleware.ts:49-57`
- Current mitigation: Server Actions and page-level auth checks provide a second layer. RLS ensures DB queries return no data for unauthenticated requests.
- Recommendation: Add all `(dashboard)` route prefixes to the protected list, or use a wildcard pattern.

**PDF parser API key has dual-env-var aliasing:**
- Issue: The proxy route accepts `PDF_PARSER_API_KEY` OR `PARSER_API_KEY` as the key env var (`process.env.PDF_PARSER_API_KEY ?? process.env.PARSER_API_KEY ?? ""`). This can mask a missing key in environments that only set one.
- Files: `webapp/src/app/api/parse-statement/route.ts:5`, `webapp/src/app/api/save-unrecognized/route.ts:5`
- Recommendation: Standardize on `PDF_PARSER_API_KEY` and remove the fallback alias.

**File size mismatch between proxy (10 MB) and parser service (50 MB):**
- The Next.js proxy enforces a 10 MB PDF limit (`MAX_FILE_SIZE = 10 * 1024 * 1024`), but the FastAPI service allows up to 50 MB (`MAX_PDF_BYTES = 50 * 1024 * 1024`). The proxy is the effective limit.
- Files: `webapp/src/app/api/parse-statement/route.ts:6`, `services/pdf_parser/main.py` (inferred from `MAX_PDF_BYTES`)
- Impact: Inconsistency could confuse future developers; not a security risk but documents an undocumented 10 MB cap.

**`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` used in middleware with `!` assertion:**
- Files: `webapp/src/lib/supabase/middleware.ts:24`
- If the env var is not set, middleware throws on every request. Validated at deploy time by Docker Compose, but no startup check in the Next.js app itself.

---

## Fragile Areas

**PDF parser detection scoring system (multi-signal scoring):**
- Files: `services/pdf_parser/parsers/__init__.py:30-250`
- Why fragile: Bank statement PDF formats change without notice (bank redesigns, new generator versions). The weighted-signal approach requires hand-tuning per parser and can false-positive if a transaction description contains a bank name.
- Minimum score of 6 was added to prevent description-only matches. Bogotá savings parser is registered but its parse function is a stub, so detection without parsing creates silent failures.
- Safe modification: Always test the full `test_parser.py` suite against all sample PDFs before changing signal weights or adding new parsers.
- Test coverage: Manual test script at `services/pdf_parser/test_parser.py`; no CI integration.

**`isMissingReconciliationColumnError` fallback logic:**
- Files: `webapp/src/lib/utils/transactions.ts`, callers listed under Tech Debt above
- Why fragile: The error check matches on `code === "42703"` AND message substring `"reconciled_into_transaction_id"`. If Postgres changes error codes or message formatting, the fallback fails silently (returns the errored result instead of retrying without the filter).
- Safe modification: Delete after confirming the column exists on all deployments.

**`useDashboardConfig` optimistic state with silent sync failures:**
- Files: `webapp/src/hooks/use-dashboard-config.ts`
- Why fragile: State diverges between devices when DB writes fail silently. No version/checksum to detect stale cache.
- Test coverage: None.

**`computeRecurringGroupUuid` manual UUID construction in recurring templates:**
- Files: `webapp/src/actions/recurring-templates.ts:32-46`
- Why fragile: Manually constructs a UUID v4 from SHA-256 bytes by patching version/variant bits. RFC compliance depends on exact byte offsets. A change in the hash input format (`templateId|occurrenceDate`) would generate different UUIDs for existing occurrences, breaking idempotency.
- Safe modification: Do not change the pipe-separated input format without a migration to regenerate all existing `recurring_group_id` values.

---

## Scaling Limits

**All data is user-scoped with no multi-tenancy tiers:**
- Current capacity: Single Supabase project (`tgkhaxipfgskxydotdtu`, sa-east-1) serves all users. No row limits or storage quotas per user are enforced at the application layer (only Supabase plan limits apply).
- Limit: High-volume users with years of transaction history will generate unbounded query costs on full-table-scan actions like income estimation.
- Scaling path: Add server-side pagination for the transaction scan in `getEstimatedIncome`; consider archiving transactions older than N years.

**PDF parser is a single-process FastAPI service:**
- Current capacity: One Uvicorn worker per container; long PDF parsing (up to 120s timeout) blocks a worker slot.
- Limit: Concurrent uploads from multiple users will queue behind each other. The 120s fetch timeout in the proxy means users can wait 2 minutes for a large PDF.
- Scaling path: Add `--workers 4` to the Uvicorn start command, or switch to a task queue (Celery/ARQ) with webhook callbacks. The Docker Compose `healthcheck` already validates readiness before webapp starts.

**`"use cache"` with `cacheLife("zeta")` is process-local in standalone mode:**
- The Next.js `"use cache"` directive (experimental) stores data in the process memory when running `output: "standalone"`. With a single webapp container, this works well. With horizontal scaling (multiple webapp replicas), each replica has its own cache, potentially serving inconsistent data after mutations.
- Files: `webapp/next.config.ts:6-12`, all action files using `"use cache"`
- Scaling path: Configure an external cache adapter (Redis) as Next.js cache storage before adding replicas.

---

## Dependencies at Risk

**`next@16.1.6` with `"use cache"` (experimental):**
- Risk: The `"use cache"` directive and `cacheTag`/`cacheLife` APIs are a Next.js 15+ experimental feature. The API surface may change before stabilization. Currently pinned to `16.1.6`; minor version upgrades may require cache strategy updates.
- Impact: 128 uses of `"use cache"`, `cacheTag`, or `cacheLife` across action files.
- Files: `webapp/package.json`, all `webapp/src/actions/*.ts` files.

**`zod@^4.3.6` — Zod 4 is a breaking major:**
- Risk: Zod 4 changed `.uuid()`, `.errors[]` → `.issues[]`, and several other APIs from Zod 3. The codebase has been migrated, but any third-party libraries that depend on Zod 3 (e.g., `@hookform/resolvers` v5) must be kept in sync.
- Files: `webapp/package.json`

**`framer-motion@^12.34.3` — very recent major:**
- Risk: framer-motion v12 was released recently and may have breaking changes from v11. Check changelogs before upgrading minor versions.
- Files: `webapp/package.json`

**`opendataloaders` is an optional external binary with no version pin:**
- Risk: The `OPENDATALOADER_BIN` env var or `shutil.which("opendataloaders")` locates the binary at runtime with no version check. A system upgrade could silently change parser behavior.
- Files: `services/pdf_parser/parsers/opendataloader_fallback.py:32-36`
- Current mitigation: Feature is disabled by default (`ENABLE_OPENDATALOADER_FALLBACK=false`).

**`frankfurter.app` is a free, community-maintained exchange rate API:**
- Risk: No SLA, no auth, could go offline or change format without notice. The codebase falls back to stale cache on failure, but if the cache is empty (first use of a currency pair), exchange rate data will not be available.
- Files: `webapp/src/actions/exchange-rate.ts:14`
- Migration plan: Replace with Open Exchange Rates, ECB, or Fixer.io if reliability becomes an issue.

---

## Test Coverage Gaps

**Server actions have zero unit or integration tests:**
- What's not tested: All 29 server action files in `webapp/src/actions/`.
- Files: `webapp/src/actions/` (entire directory)
- Risk: Regressions in import, categorization, debt calculation, or recurring template logic go undetected until a user reports a bug.
- Priority: High

**Only one unit test file exists for the webapp:**
- What's not tested: Everything except `getFreshnessLevel`, `getAccountSemanticColor`, `getCreditUtilizationColor`.
- Files: `webapp/src/lib/utils/__tests__/dashboard.test.ts` (single file, ~50 lines)
- Risk: The `health-levels.ts` classification logic, `recurrence.ts` date calculation, `idempotency.ts` hash function, and all validators are untested.
- Priority: High

**PDF parser tests require live PDF files:**
- What's not tested: The `test_parser.py` script runs against real PDF samples on disk. There is no fixture-based or mock-based test that can run in CI without sample PDFs committed to the repo.
- Files: `services/pdf_parser/test_parser.py`
- Risk: Parser regressions only caught manually or in production.
- Priority: Medium

**No E2E tests cover authenticated flows:**
- The `webapp/e2e/ux-audit.spec.ts` contains UX audit tests but does not set up authenticated sessions. Most tests either skip or test public pages.
- Files: `webapp/e2e/ux-audit.spec.ts`
- Risk: Core flows (import → categorize → dashboard KPIs) have no automated regression coverage.
- Priority: High

**`bogota_savings` parser is untestable (always raises):**
- Files: `services/pdf_parser/parsers/bogota_savings.py`
- Risk: Parser is registered and will be called on Bogotá savings PDFs, always erroring. No test documents expected behavior.
- Priority: Medium (blocked on getting sample PDFs)

---

## Known Bugs (Documented in E2E Tests)

**FAB backdrop (z-40) blocks bottom nav taps:**
- Symptom: When the floating action button menu is open, tapping a bottom navigation link only closes the FAB instead of navigating. The URL stays at `/dashboard`.
- Files: `webapp/e2e/ux-audit.spec.ts:217-253`, `webapp/src/components/mobile/fab-menu.tsx`, `webapp/src/components/mobile/bottom-tab-bar.tsx`
- Fix approach: Raise the bottom nav z-index above the FAB backdrop, or close FAB and navigate on tab tap.

**Active tab indicator has insufficient WCAG contrast (1.3:1, need 3:1):**
- Symptom: Active and inactive tab items in the bottom nav have a contrast ratio of approximately 1.3:1 between their text colors. WCAG requires 3:1 for UI components.
- Files: `webapp/e2e/ux-audit.spec.ts:114-139`, `webapp/src/components/mobile/bottom-tab-bar.tsx`

**Active tab has no font-weight or indicator bar differentiation:**
- Symptom: The active tab has no visual weight difference (same font-weight, no underline or indicator bar) compared to inactive tabs.
- Files: `webapp/e2e/ux-audit.spec.ts:142-172`, `webapp/src/components/mobile/bottom-tab-bar.tsx`

---

*Concerns audit: 2026-03-25*

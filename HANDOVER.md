# HANDOVER — Session 2026-03-28/29

## 1. Session Summary

Massive feature session: built the entire AI capture pipeline from research to implementation. Started with mobile keyboard UX fixes (FAB/tab bar hide on keyboard), rewrote the category picker for mobile, restructured the dashboard layout, then built voice capture (Web Speech API + Gemini Flash AI parsing), a universal `/api/capture` endpoint with capture token auth, a Telegram bot with deep-link account linking, and a full MCP server package that exposes Zeta's financial data to any AI assistant (Claude Desktop, etc.).

## 2. Changes Made

### Mobile Keyboard UX
- **`webapp/src/hooks/use-keyboard-inset.tsx`** (created) — Context provider + hook wrapping `visualViewport` API. Single listener shared across all consumers.
- **`webapp/src/components/mobile/fab-menu.tsx`** (modified) — FAB hides when keyboard open. Added `data-testid`. Added "Captura por voz" action.
- **`webapp/src/components/mobile/bottom-tab-bar.tsx`** (modified) — Returns `null` when keyboard open.
- **`webapp/src/components/categorize/bulk-action-bar.tsx`** (modified) — Repositions above keyboard, added safe-area inset, `aria-label` on clear button, `bottom-20` to clear tab bar.
- **`webapp/src/components/mobile/mobile-transaction-form.tsx`** (modified) — Uses shared `useKeyboardInset` hook instead of inline logic.
- **`webapp/src/app/(dashboard)/layout.tsx`** (modified) — Wrapped mobile section with `KeyboardInsetProvider`.
- **`webapp/e2e/mobile-keyboard.spec.ts`** (created) — Playwright tests mocking `visualViewport` for keyboard simulation.

### Category Picker Rewrite
- **`webapp/src/components/categorize/category-picker-dialog.tsx`** (rewritten) — Was 94vh full-screen two-panel Dialog. Now: Drawer on mobile with searchable Command list, compact Dialog on desktop.

### Dashboard Layout
- **`webapp/src/app/(dashboard)/dashboard/page.tsx`** (modified) — Hero full-width. Below: 3-column grid with Attention + Upcoming Payments + Quick Updates as peers.

### Voice Capture (Phase 1)
- **`webapp/src/hooks/use-voice-capture.ts`** (created) — Web Speech API wrapper with `es-CO` locale.
- **`webapp/src/types/speech-recognition.d.ts`** (created) — TypeScript declarations for Web Speech API.
- **`webapp/src/components/mobile/voice-capture-sheet.tsx`** (created) — Chat-style conversational UI with mic + text input, missing field prompts, summary card, confirm flow.
- **`webapp/src/components/mobile/mobile-sheet-provider.tsx`** (modified) — Wired `VoiceCaptureSheet` for "voice" FAB action.

### AI Transaction Parsing
- **`webapp/src/actions/voice-capture.ts`** (created) — Server action: regex first, Gemini 2.0 Flash fallback with JSON schema enforcement.
- **Env var needed:** `GEMINI_API_KEY` (free tier)

### Capture Token System (Phase 2)
- **`supabase/migrations/20260329050657_create_capture_tokens.sql`** (created + pushed) — Table with RLS, indexes, default account FK.
- **`webapp/src/actions/capture-tokens.ts`** (created) — CRUD actions + `createTelegramLink()` deep link generator.

### Universal Capture Endpoint (Phase 2)
- **`webapp/src/app/api/_shared/capture-auth.ts`** (created) — Shared `authenticateCaptureToken()` helper.
- **`webapp/src/app/api/capture/route.ts`** (created) — `POST /api/capture` with text parsing, auto-categorization, idempotency.

### Telegram Bot (Phase 3)
- **`webapp/src/lib/telegram.ts`** (created) — API helpers.
- **`webapp/src/app/api/webhooks/telegram/route.ts`** (created) — Webhook with deep-link auto-linking, text → transaction flow.
- **`webapp/src/app/api/webhooks/telegram/setup/route.ts`** (created) — One-time webhook registration.
- **Env vars needed:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`

### MCP Server (Phase 6) — UNCOMMITTED
- **`webapp/src/app/api/mcp/summary/route.ts`** (created) — Financial summary endpoint.
- **`webapp/src/app/api/mcp/accounts/route.ts`** (created) — Account list endpoint.
- **`webapp/src/app/api/mcp/transactions/route.ts`** (created) — Filtered transactions with pagination.
- **`webapp/src/app/api/mcp/budgets/route.ts`** (created) — Budget status per category.
- **`webapp/src/app/api/mcp/debts/route.ts`** (created) — Debt overview endpoint.
- **`packages/mcp-server/`** (created) — Full MCP server package with 6 tools using `@modelcontextprotocol/sdk`.

### Planning
- **`.planning/quick/260328-ai-capture-pipeline/PLAN.md`** (created) — Full 6-phase architecture with research sources.

## 3. Key Decisions

- **Web Speech API over Whisper** — Free, instant, no server cost. Falls back to text on Firefox.
- **Gemini 2.0 Flash over Claude Haiku** — $0/month free tier. User explicitly chose this. `responseMimeType: "application/json"` enforces valid JSON.
- **Regex-first, AI-fallback** — `parseQuickCaptureText()` handles structured input instantly. Gemini only when regex confidence < 0.8.
- **Capture tokens over Supabase JWTs** — Scoped, revocable, `zeta_` prefixed. Used for Telegram, MCP, any future integration.
- **Chat-style voice capture** — User rejected form-based preview. Wants conversational flow that asks for missing fields one at a time.
- **Deep link for Telegram** — User rejected copy-paste token flow. Now: one click in Settings → Telegram opens → auto-linked.
- **Dashboard hero full-width** — User rejected removing the attention card. Wanted layout restructure, not content removal.
- **MCP as separate package** — Runs locally on user's machine, calls Zeta API via capture token.
- **`overflow-y-auto` rule saved to memory** — Never use `overflow-hidden` on scrollable areas inside Dialog/Drawer/Popover.

## 4. Current State

- **Build:** Webapp `pnpm build` passes. MCP server `pnpm build` passes.
- **Branch:** `codex/redesign-management-surfaces`
- **Uncommitted:**
  - `packages/mcp-server/` (entire package)
  - `webapp/src/app/api/mcp/*` (5 route files)
  - `pnpm-lock.yaml`
- **Migration:** `capture_tokens` already pushed to production Supabase.
- **Turbopack cache:** If build fails on files that look correct, `rm -rf webapp/.next && pnpm build`.

## 5. Open Issues & Gotchas

- **No Settings UI for token management** — Server actions exist but no frontend. Needs `/settings/integraciones` or similar.
- **Telegram webhook not registered** — After deploy: `GET /api/webhooks/telegram/setup?secret=BOT_TOKEN_ID`
- **Env vars not in production config** — `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `GEMINI_API_KEY` are in `.env.local` only. Need to add to `docker-compose.prod.yml`.
- **No balance adjustment in `/api/capture`** — Inserts transaction but doesn't call `adjustBalancesForTransactionChanges()`. Balance updates on next page load.
- **`capture_method` enum missing `CAPTURE_API`** — Routes use `TEXT_QUICK_CAPTURE` as workaround. Consider adding `CAPTURE_API` and `TELEGRAM` via migration.
- **MCP `get_budget_status`** — Uses raw query, not `get503020Allocation()`. 50/30/20 split not exposed via MCP.
- **Telegram `/undo` not implemented** — Users will want it.
- **`CategoryPickerDialog` was replaced with `CategoryZonePicker`** by user between sessions. Several files reference the new component.

## 6. Suggested Next Steps

1. **Commit MCP server + routes** — All uncommitted files are ready.
2. ~~Build Settings UI for Integrations~~ — DONE. `IntegrationsCard` added to Settings page with Telegram deep-link, MCP description, and token CRUD.
3. **Add balance adjustment to `/api/capture`** — Import and call `adjustBalancesForTransactionChanges()` after insert.
4. **Add env vars to production** — `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `GEMINI_API_KEY`.
5. **Register Telegram webhook** — Call setup endpoint once after deploy.
6. **Phase 4: Receipt OCR** — Architecture in plan doc. Extends PDF parser service.
7. **Phase 5: WhatsApp** — Start Meta Business verification now (1-2 weeks). Implementation is 2 days after.

## 7. Context for Claude

- **`parseQuickCaptureText()`** — `packages/shared/src/utils/quick-capture.ts`. Regex parser for Colombian Spanish.
- **`parseVoiceCapture()`** — `webapp/src/actions/voice-capture.ts`. Server action: regex → Gemini Flash fallback. Needs `GEMINI_API_KEY`.
- **Capture tokens** — Format: `zeta_` + 48 hex chars. Auth via `Bearer` header. Helper: `webapp/src/app/api/_shared/capture-auth.ts`.
- **MCP server** — `packages/mcp-server/`. Separate TS package. `@modelcontextprotocol/sdk` v1.27. Builds to `dist/`.
- **Telegram deep linking** — `createTelegramLink(accountId)` → `{ deepLink: "https://t.me/Bot?start=zeta_token" }`. Bot auto-links on `/start`.
- **Plan doc** — `.planning/quick/260328-ai-capture-pipeline/PLAN.md` has full 6-phase architecture with research sources from `/last30days`.
- **Scrollable containers rule** — Saved to memory. Always `overflow-y-auto` inside Dialog/Drawer/Popover.

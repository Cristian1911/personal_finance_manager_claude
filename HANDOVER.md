# Session Handover — 2026-04-19 (Mobile Import Redesign · Slice 1 continued)

> Supersedes prior handovers. For earlier handovers see git history (`HANDOVER.md@HEAD~N`).

## 1. Session Summary

Continued the Claude Design "Zeta Wireframes" implementation in the mobile app. Shipped a working end-to-end Bancolombia CC PDF import (fixed a prod middleware bug that was blocking mobile uploads), redesigned the reconcile step with a 2×2 stat grid + in-place expansion animation, introduced a global "narrator" voice (Kalam handwritten font), added a Sage/Neutral theme selector on Settings with persistence, and laid groundwork for a shared `ExpandableStatTile` primitive. App currently runs against local webapp (`http://192.168.1.6:3000`) for testing; the prod middleware fix is local-only and not yet deployed.

## 2. Changes Made

### Webapp — prod hotfix (NOT YET DEPLOYED)
- `webapp/src/lib/supabase/middleware.ts:49-57` — added `/api` to `publicPaths`. Fixes mobile Bearer-token requests being redirected to `/login` (then 500'd as `Failed to find Server Action`).
- `webapp/src/app/api/parse-statement/route.ts` — top-level `try/catch` so unhandled exceptions return JSON instead of generic `"Internal Server Error"`.

### Mobile — import flow
- `mobile/app/(tabs)/import.tsx`:
  - iOS upload swapped to `FileSystem.uploadAsync` (`expo-file-system/legacy`) + 30s `Promise.race` timeout. Replaced hanging `fetch`+FormData.
  - Response parsing made content-type-agnostic (iOS omits `content-type` in `uploadResult.headers`).
  - Multi-statement CC: `allStatements` state + `switchStatement()` helper.
  - `useSafeAreaInsets` applied to all 4 step roots so headers clear the Dynamic Island.
  - Step 3 (reconcile) redesigned as 2×2 stat grid (Nuevos / Destinatarios / Duplicados / Ambiguos) with `AnimatedAccordion` expansion between rows.
  - `StatTile` component with tones `white | brass | alert | income`. Zero values dim to `z-sage-dark`.
  - `Narrator` annotation always visible below the grid (removed earlier gate).
  - Account indicator softened from brass chip → baseline caption + hair-line divider.
  - Removed local `neutralTheme` state; reads from global `useTheme()`.
- `mobile/components/import/CreditCardStackCard.tsx` — **new**. Per-currency compact CC card with expandable detail metrics.
- `mobile/components/import/CreditCardSummary.tsx` — added `useImportTheme` for surface swaps.
- `mobile/components/import/StatementChip.tsx` — **new** (earlier session). Bank · ••last4 chip with period.
- `mobile/components/import/SectionDivider.tsx` — **new** (earlier session).
- `mobile/components/import/ImportProgress.tsx` — **new** (earlier session). 4-segment brass progress.
- `mobile/components/import/import-theme.tsx` — refactored to delegate to global `useTheme()`. `ImportThemeProvider` is now a no-op shim.
- `mobile/lib/utils/cc-projection.ts` — **new**. 12-month minimum payment projection math (`r_mo = (1+EA)^(1/12)-1`).

### Mobile — theme + narrator
- `mobile/lib/theme.tsx` — **new**. `ZetaThemeProvider` + `useTheme()` with `SecureStore` persistence. Modes: `"sage" | "neutral"` (light later). Key: `zeta.theme-mode`.
- `mobile/app/_layout.tsx` — wrapped root in `ZetaThemeProvider`. Added `Kalam_700Bold` font. (Earlier: `Inter_*_Italic` variants too.)
- `mobile/app/(tabs)/settings.tsx` — new "Apariencia" section with `ThemeSelector` (Sage / Neutral pill cards). Settings root respects the theme for instant visual feedback.
- `mobile/components/common/Narrator.tsx` — **new**. Centered 24px `font-narrator` (Kalam 700) annotation. Tones: `brass | sage`. Spacing: `default | tight`.
- `mobile/tailwind.config.js` — added tokens: `z-ink-neutral (#0d0d0e)`, `z-surface-neutral (#121214)`, `z-surface-2-neutral (#18181b)`, `z-surface-3-neutral (#1f1f23)`. Added `font-narrator: ["Kalam_700Bold"]`.
- `mobile/package.json` / `pnpm-lock.yaml` — added `@expo-google-fonts/kalam ^0.4.1`. Tried + removed `@expo-google-fonts/caveat`.

### Mobile env (testing only — revert before ship)
- `mobile/.env` — `EXPO_PUBLIC_API_URL=http://192.168.1.6:3000`. **Revert to `https://pfm.sanson1911.cloud` before release.**

## 3. Key Decisions

- **Prod middleware bug root cause** confirmed via SSH + `docker logs` on the VPS: the `Failed to find Server Action "x"` stack trace pointed at `app-page` chunks, not API chunks. Unauthenticated POST returned `307 → /login?redirect=/api/parse-statement`. iOS `FileSystem.uploadAsync` follows redirects, so the multipart POST hit `/login` and Next.js tried to parse it as a Server Action. Fix: treat `/api` as public in middleware; route handlers self-auth via `getRequestUser()` (supports cookie AND Bearer).
- **Font is Kalam, not Caveat.** User said the reference looked like "Kammus"-ish — nearest Google Font is Kalam. 700 Bold matches the reference weight; Caveat was too uniform.
- **Multi-currency CC → V2 stacked cards** (user confirmed). Each currency is its own `CreditCardStackCard` with expandable detail row. Account auto-match + selection swap on currency toggle.
- **Neutral theme is a palette swap, not a CSS rebuild.** Added `*_neutral` tokens in Tailwind; components decide surface class via `useImportTheme`/`useTheme`. Light theme (future) can reuse the same pattern.
- **Destinatarios copy changed** from "se crean" to "sugeridos" per user. Mobile import will not auto-create destinatarios; user reviews/approves after. (Creation code is currently not present in mobile import; copy now matches behavior.)
- **Narrator always visible** under the reconcile grid — hiding it when a panel is open felt jarring.
- **Shared expansion primitive = `AnimatedAccordion`** (`components/ui/AnimatedAccordion.tsx`). User flagged 3 inconsistent expansion patterns (dashboard, plan, import). Import now uses this primitive. Dashboard and plan already do. `CreditCardStackCard` still has its own state — migrate later.
- **Theme selector scope: global state, instant feedback.** Settings root now swaps bg by theme so the user sees the change immediately instead of having to navigate to Import.
- **Tool limitation accepted:** I cannot process video input. User will provide verbal description, key frames, or a video path ffmpeg can split.

## 4. Current State

- **Typecheck:** `npx tsc --noEmit` clean in import.tsx, theme.tsx, Narrator.tsx. Pre-existing errors remain in `mobile/app/(tabs)/settings.tsx` (missing COLORS) and `mobile/lib/demo-data.ts` (missing `@zeta/shared` exports) — untouched, not from this session's edits.
- **Mobile build:** iOS debug build succeeded (0 errors, 1165 warnings). App installed on sim `AFBA8440-2959-4DC9-8B8D-ABD7CFE5B14A` (iPhone 17 Pro, iOS 26.2). Metro re-bundles fine after `--clear` reset.
- **End-to-end import verified:** 200 / `statementCount: 2` from real Bancolombia CC PDF (multi-currency) in 1.17 s.
- **Local services running:**
  - Webapp dev on `:3000` (needed for current mobile testing).
  - PDF parser on `:8000` (`uv run python main.py`).
- **Git:** branch `feat/planner-drag-drop` — **NOT a clean slice-1 branch**. Still stacked on planner work.

```
 M HANDOVER.md
 M mobile/app/(tabs)/import.tsx
 M mobile/app/(tabs)/settings.tsx
 M mobile/app/_layout.tsx
 M mobile/package.json
 M mobile/tailwind.config.js
 M pnpm-lock.yaml
 M webapp/src/app/api/parse-statement/route.ts
 M webapp/src/lib/supabase/middleware.ts
?? mobile/components/common/Narrator.tsx
?? mobile/components/import/ (StatementChip, SectionDivider, ImportProgress, CreditCardSummary, CreditCardStackCard, import-theme)
?? mobile/lib/theme.tsx
?? mobile/lib/utils/cc-projection.ts
 M mobile/.env (EXPO_PUBLIC_API_URL pointed at local)
```

## 5. Open Issues & Gotchas

- **`zetas-front-guy` agent review findings not yet fixed:**
  - `settings.tsx:325,343,426,428,444,446` — hardcoded hex (`#EF4444`, `#C5BFAE`, `#3A3A3A`). Use `COLORS.debt`, `COLORS.sageLight`, and add a `switchTrack` token.
  - `import.tsx:1427,1449` — "Fusionar" / "Mantener ambas" buttons bypass `BRASS_BUTTON_CLASS`/`GHOST_BUTTON_CLASS`. Missing `accessibilityRole`/`accessibilityLabel`.
  - `import.tsx:1549,1561` — result-step buttons same issue.
  - `import.tsx:1275,1350` — English loanword "fresh" in user-facing Spanish copy. Replace ("limpios"/"sin duplicados").
  - `import.tsx:1122,1195` — `paddingBottom: 120` magic number. Extract `MOBILE_TAB_BAR_CLEARANCE` constant in `lib/constants/styles.ts`.
  - **Neutral theme gap:** fixed action bar uses `bg-background-92` (sage-only token). Add `z-ink-neutral-92` / a semantic `bg-action-bar` token.
  - **Pattern duplication:** `CreditCardStackCard` has its own `expanded` state. Migrate to `AnimatedAccordion`.
  - **Reuse gap:** `StatTile` (import) and "Gasto hoy" (`InicioMetricsGrid`) are the same pattern. Extract `components/ui/ExpandableStatTile.tsx`.
- **Mobile `/api/parse-statement` points at local webapp** — revert `mobile/.env` before shipping.
- **Prod middleware fix NOT deployed.** Mobile uploads in prod will still 500 until the middleware PR lands + deploys.
- **Video input not possible** from the agent side. Closing-animation feedback needs description, frames, or ffmpeg path.
- **`AnimatedAccordion` `estimatedHeight` is hardcoded** in import (`700` row1, `1200` row2). Long transaction lists may clip.
- **Expansion happens between rows**, not directly under the clicked tile. Acceptable but not identical to dashboard's "Gasto hoy" (accordion inside the tile itself). Shared `ExpandableStatTile` would unify this.
- **Pre-existing TS errors** (settings COLORS, demo-data exports) still present — untouched.

## 6. Suggested Next Steps

1. **Fix `zetas-front-guy` blockers** (§5 above).
2. **Extract `ExpandableStatTile`** in `components/ui/ExpandableStatTile.tsx`. Use in import reconcile grid and `InicioMetricsGrid` "Gasto hoy". Migrate `CreditCardStackCard` expansion to `AnimatedAccordion` too.
3. **Revert `mobile/.env`** to `https://pfm.sanson1911.cloud`.
4. **Cut a new branch off `main`** for slice-1 PR. Don't stack on `feat/planner-drag-drop`. Split commits logically:
   - Webapp: middleware fix + route try/catch.
   - Mobile: import-flow components + theme system + narrator + Kalam font + safe-area + reconcile grid.
5. **Deploy webapp hotfix first.** Mobile slice-1 depends on it to work against prod.
6. **Move `ParsedStatement` / `ParsedTransaction` to `packages/shared`** — duplicated between mobile and webapp.
7. **Slice 2 (ranked):** onboarding redesign (6 frames), dashboard Variant B + widgets, Settings visual polish, Afford + "add to wishlist" CTA, Loan Step 2 variant.
8. **Wire up light theme mode** (user mentioned as future). `lib/theme.tsx` is ready to extend — need light palette tokens + accent decisions.

## 7. Context for Claude

- **Global theme hook:** `mobile/lib/theme.tsx` exports `useTheme()` (`{ mode, setMode }`) + `themeSurfaceClasses(mode)` helper. Persistence: `SecureStore`, key `zeta.theme-mode`. Wrap new themed screens:
  ```ts
  const { mode } = useTheme();
  const inkCls = mode === "neutral" ? "bg-z-ink-neutral" : "bg-background";
  ```
- **`ImportThemeProvider` is a no-op shim.** `useImportTheme()` delegates to `useTheme()`. Safe to delete once all import components are migrated.
- **Narrator rules:** only for conversational, low-stakes guidance. Never for errors / critical copy. Centered, `font-narrator` (Kalam 700), `text-z-brass`. Use `tone="sage"` for zero-state "nothing-to-see-here" messages.
- **Kalam font** — `Kalam_700Bold`. Available weights: 300 / 400 / 700. Caveat was tried and removed.
- **`AnimatedAccordion`** at `mobile/components/ui/AnimatedAccordion.tsx`. Props: `expanded: boolean`, `estimatedHeight: number`, `duration?: number`. Uses `react-native-reanimated`. Always mounts children; clips to 0 when collapsed.
- **iOS sim UDID:** `AFBA8440-2959-4DC9-8B8D-ABD7CFE5B14A` (iPhone 17 Pro, iOS 26.2).
- **Local API for sim:** `http://192.168.1.6:3000` (Mac LAN IP). Simulator reaches this.
- **Logs:** `tail -F /tmp/zeta-ios.log`.
- **Mobile upload path:** `mobile/app/(tabs)/import.tsx:handleParse` → `FileSystem.uploadAsync` from `"expo-file-system/legacy"`. Main namespace doesn't export the legacy API in expo-file-system v55.
- **VPS access:** `ssh root@147.93.41.103`. Webapp container: `personal-finance-manager-webapp-1`. Parser: `personal-finance-manager-pdf-parser-1`. Use `docker logs <container> --tail N`. Reverse-proxy config read is blocked by sandbox permission.
- **Reconcile state:** `reconExpanded` union is `"none" | "duplicates" | "review" | "unmatched" | "merchants"`. Toggle helper is inline inside the IIFE at ~`import.tsx:1186`.
- **`StatTile` location:** bottom of `mobile/app/(tabs)/import.tsx`. When extracting the shared component, generalize signature (`tone` union, `hint`, `active`, `onPress`).
- **BACKLOG.md** at repo root is the canonical backlog. Update it with slice-1 PR status and the unfixed `zetas-front-guy` items.

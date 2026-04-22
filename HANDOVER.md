# HANDOVER — 2026-04-22 (late afternoon) — Play Store login fix + PR triage + Budgets tab polish

> Supersedes prior handovers. For earlier handovers see git history (`HANDOVER.md@HEAD~N`).

## 1. Session Summary

Three concurrent threads:

1. **Fixed the Play Store AAB login failure** — user downloaded the Play Console bundle and got `"Network request failed"` at login. Root cause: EAS `production` environment had **no variables**, so the shipped build fell through to `mobile/lib/supabase.ts:9`'s `https://invalid.localhost` fallback. Populated EAS remote env + fixed a `.env` prefix typo + bumped app version for re-upload.
2. **Merged/closed the 3 open PRs** — addressed Gemini comments on each before acting. #222 merged with the real parity fix (Gemini caught my initial misread). #219 merged with Gemini's nit applied. #203 closed (fully obsolete — every BACKLOG change had been superseded by newer commits).
3. **Shipped the Budgets tab polish slice** (PR #223, open) — first of the remaining mobile design slices. Structural extraction + `MobileHeader` + canonical tokens + `FlatList` + memoized rows + Reanimated chevron + Alert-surfaced errors. 5 review agents (mobile-perf-doctor, zetas-front-guy, superpowers:code-reviewer, mobile-sync-doctor, mobile-webapp-parity) + Gemini — all findings triaged, real fixes applied, pre-existing issues filed to BACKLOG.

## 2. Changes Made

### EAS / mobile-release fix (shipped via PR #222)

- **`mobile/.env`** (modified, gitignored) — renamed `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Wrong prefix meant Expo silently ignored it; locally the `ANON_KEY` fallback masked the bug.
- **`mobile/app.json`** (modified, rode on PR #222) — bumped `expo.version` 1.1.0 → 1.1.1 so Play Console accepts the re-upload. `versionCode` auto-increments via EAS remote.
- **EAS remote env** (not in git) — pushed three production-env vars via `eas env:create --environment production`:
  - `EXPO_PUBLIC_SUPABASE_URL=https://tgkhaxipfgskxydotdtu.supabase.co`
  - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable__1o6wPIiW_9cVOwEx6izxg_QCnniqyu`
  - `EXPO_PUBLIC_API_URL=https://pfm.sanson1911.cloud`
  - ANON_KEY was denied by the permission system (agent-inferred); not needed — code reads PUBLISHABLE first.

### PR #222 — `fix(mobile): align categorization_source clear with webapp` (MERGED `123fe2b`)

- **`mobile/lib/repositories/transactions.ts`** (modified) — `updateTransaction`: when `params.category_id !== undefined` (assign OR clear), always sets `categorization_source = "USER_OVERRIDE"`. Matches webapp `actions/transactions.ts:841` which uses `categoryChanged` (true in both directions). Applied to SQLite UPDATE + `syncPayload`.
  - **Correction story:** initial PR #222 attempt guarded the set with `if (params.category_id)` — only flagged on assign, not clear. I told the user Gemini was wrong. Gemini was right; I re-read `webapp/src/actions/transactions.ts:824` (`categoryChanged = existing.category_id !== parsed.data.category_id`) and confirmed it flips `USER_OVERRIDE` on clears too. Applied the correct fix before merge.
- **`HANDOVER.md`** + **`BACKLOG.md`** (modified) — updated stale claims that said "webapp doesn't flag USER_OVERRIDE on clear".
- **`mobile/app.json`** — v1.1.1 bump bundled here.

### PR #219 — `docs(backlog): expo-system-ui for Android theme` (MERGED `04f1798`)

- **`BACKLOG.md`** — moved the `expo-system-ui` entry from `## Features` to `## Bugs` per Gemini's nit. Amended the single commit + force-push-with-lease.

### PR #203 — CLOSED (not merged)

- Stale. Gemini had approved with no feedback, but the 2-day-old BACKLOG changes had all been superseded (Flow 01 PR #205, Flow 02 shipped as Variant B in PR #204, Flow 06 already marked shipped, Import reconciliation truncate entry added to main via PR #216, etc). Closed with rationale comment.

### PR #223 — `feat(mobile): Budgets tab polish` (OPEN, CI green, branch `feat/mobile-budgets-polish`)

Three commits:
- `9de6195` — initial slice (structural extraction + tokens + FlatList + memo).
- `a68b1e2` — post-review fixes (stale amountInput, error surface via `Alert`, slash-opacity token).
- `132ef7d` — Gemini fixes (Reanimated chevron, className gap).

Files:
- **`mobile/app/(tabs)/budgets.tsx`** (modified) — 276 lines → 5-line thunk delegating to `BudgetsRoot`.
- **`mobile/components/budgets/BudgetsRoot.tsx`** (created) — `MobileHeader variant="main" title="Presupuestos"` + `AvatarMenuTrigger` + `MonthSelector`, race-guarded `loadData` via `requestIdRef`, `FlatList` for rows (`initialNumToRender=10`, `windowSize=5`, Android `removeClippedSubviews`), `KeyboardAvoidingView` for the inline edit inputs, memoized `listHeader` + `listEmpty`.
- **`mobile/components/budgets/BudgetsHero.tsx`** (created) — memoized summary card: spent / target / % usado / "Quedan $X" line. Falls back to "Aún no has fijado un presupuesto" when none configured.
- **`mobile/components/budgets/BudgetRow.tsx`** (created) — memoized row with `AnimatedAccordion` inline edit. Chevron rotation via `useSharedValue` + `withTiming(220ms)` + `Animated.View` wrapper. `useEffect` resyncs `amountInput` to `item.amount` on collapse so external data refresh isn't stale on next open. `handleSave` / `handleDelete` wrap mutations in `try/catch` + `Alert.alert` for user-visible errors. Invalid amount (≤ 0) surfaces `Alert.alert("Monto inválido", …)` — parity with webapp's Zod `.min(0)`.
- **`mobile/lib/constants/styles.ts`** (modified) — added `DESTRUCTIVE_GHOST_BUTTON_CLASS = "border border-z-debt-25 bg-black-10 text-z-expense"`. Note: `border-z-debt-25` pre-computed token (NativeWind v3 can't consume `/25` slash-opacity).

### BACKLOG additions (carried in PR #223 commit `a68b1e2`)

Three entries added to `## Bugs` section:
- **Mobile — `budgets` SQLite missing `is_demo` column (sync drift).** Supabase view has `is_demo: boolean`; SQLite schema doesn't. Pull drops it silently. Pre-existing; not blocking. Fix: v11 migration + `BOOLEAN_FIELDS["budgets"]` entry.
- **Mobile — yearly budgets not displayed.** `getBudgetProgress` hardcodes `period = 'monthly'`. Webapp supports `"monthly" | "yearly"`. Read-side gap.
- **Webapp — `DESTRUCTIVE_GHOST_BUTTON_CLASS` parity.** PR #223 added to mobile; webapp only has solid destructive. Components re-invent ad hoc.

## 3. Key Decisions

- **EAS env via `eas env:create` (remote secrets) rather than hardcoding in `eas.json`.** Cleaner; keeps creds out of git even when they're public-safe. `EXPO_PUBLIC_API_URL` is now set in both places (eas.json build-profile + remote env) — EAS emits a harmless duplication warning; build-profile value wins. User OK'd leaving as-is.
- **Did NOT push `EXPO_PUBLIC_SUPABASE_ANON_KEY` to EAS remote.** Permission system denied it as "agent-inferred value". Not needed — `mobile/lib/supabase.ts:12-15` reads PUBLISHABLE first and that's present. User has the exact command to run manually if they want the fallback.
- **Closed PR #203 rather than rebasing.** 2 days of main drift made every one of its BACKLOG edits obsolete. Rebasing would produce a near-empty PR. Closed with a detailed rationale comment listing each superseded change.
- **Applied Gemini's PR #222 fix even though I had told the user Gemini was wrong.** Verified against `webapp/src/actions/transactions.ts:824,841` and confirmed Gemini was right on the parity rule. Corrected HANDOVER + BACKLOG claims; wrote the commit message to call out the correction arc.
- **Started with Budgets tab over Movimientos slice 2 / Plan / Deudas.** User picked; rationale was "smallest scope, fast feedback loop, validates mobile-perf-doctor on a fresh tab".
- **Budget row holds its own `expanded` + `amountInput` state, Root holds `savingId`.** Mirrors `MovimientosTransactionRow` (each row owns its local UI state). Only the saving row re-renders on save-state flip.
- **Used `useSharedValue` + `useEffect` + `useAnimatedStyle` for chevron rotation, not the Gemini-suggested inline `useAnimatedStyle(() => ({ transform: [{ rotate: withTiming(...) }] }))`.** Reanimated 3 worklets can't cleanly capture React state inside useAnimatedStyle; shared-value-driven-by-effect is the canonical pattern.
- **Summary totals from in-memory reduce, not SQL aggregate.** Unlike Movimientos (feed paginated — summing the feed inflates as you scroll), the budgets list is already bounded (~one row per category), so `useMemo` reduce over full `items` is correct and simpler.
- **Empty-list message (`listEmpty`)** still says "Crea presupuestos desde categorías en la web" — kept the original copy verbatim; no mobile-side budget creation flow exists yet.

## 4. Current State

- **Build:** `npx tsc --noEmit` in `mobile/` is clean on the current branch. CI (`Mobile PR Verify` typecheck job) SUCCESS on PR #223 commit `132ef7d` at `2026-04-22T18:17:31Z`.
- **Branch:** `feat/mobile-budgets-polish`, 0 uncommitted changes, up to date with origin. Main has new commits since session start (PR #222, PR #219).
- **PRs state:**
  - #222 MERGED (123fe2b)
  - #219 MERGED (04f1798)
  - #203 CLOSED (not merged)
  - #223 OPEN — CI green, Gemini's 2 comments addressed + replied, ready to merge
- **EAS production env:** populated with `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_API_URL`. `EXPO_PUBLIC_SUPABASE_ANON_KEY` NOT set (user can run manually if desired).
- **Play Store AAB:** v1.1.0 currently live, broken login. **User still needs to run `eas build --platform android --profile production-android`** and re-upload v1.1.1 to Play Console after #223 merges (or before — the build isn't blocked on the Budgets slice).

## 5. Open Issues & Gotchas

- **User must trigger the EAS build themselves.** I did not kick it off (billed). Command: `cd mobile && eas build --platform android --profile production-android`.
- **PR #223 merge sequence with EAS build:** the v1.1.1 bump rides on PR #223. If the user wants to build the AAB sooner, they can either (a) wait for #223 merge or (b) cherry-pick the `app.json` bump onto main directly. Not urgent.
- **Pre-existing mobile-sync drift on `budgets.is_demo`** — filed in BACKLOG. Fix path documented (v11 migration + `BOOLEAN_FIELDS`). User-created budgets work today because Supabase defaults `is_demo=false` on insert. Demo budgets seeded via `mobile/lib/demo-data.ts` would need the flag to filter correctly.
- **Mobile DELETE push lacks defense-in-depth `user_id` filter.** Surfaced by `mobile-webapp-parity` review but deemed non-blocking (RLS covers). Not filed in BACKLOG — consider if encountering during a future mobile-sync slice.
- **Gemini on PR #223 also mentioned AnimatedAccordion `estimatedHeight` caveat.** Kept the default `500`; the edit form fits comfortably. If the form ever grows (e.g., period picker for yearly budgets), bump the estimate.
- **Lockfile not touched this session.** `pnpm install` not needed.

## 6. Suggested Next Steps

1. **Merge PR #223** after any final visual verification on device/simulator (`gh pr merge 223 --squash --delete-branch`).
2. **Trigger EAS build + re-upload AAB** — `cd mobile && eas build --platform android --profile production-android`, wait for build, upload to Play Console closed track.
3. **Next mobile slice.** User-stated plan is sequential through the remaining slices:
   - **Movimientos slice 2** — destinatario / tag / vincular-a-recurrente chips on rows + email-pending detail panel. Reopens recently-shipped files from PR #221.
   - **Plan tab parity** vs webapp `/plan` — high-traffic, lots of moving parts (`PlanResumenZone`, `PlanMobileZone`, tabs).
   - **Deudas tab parity** vs webapp `/deudas` — high-visibility, split-bar hero + rings.
4. **Optional BACKLOG cleanup during next slice:** the three items filed from PR #223 reviews (budgets `is_demo`, yearly budgets display, webapp `DESTRUCTIVE_GHOST_BUTTON_CLASS` parity) are all small and opportunistic.

## 7. Context for Claude

- **EAS env visibility** — `eas env:list --environment production` shows only what's pushed via `eas env:create`. `.env` in the repo is gitignored and NOT used by EAS cloud builds; local dev reads it via Expo's dotenv loader.
- **Supabase publishable vs anon key** — both work for anon role. Publishable (`sb_publishable__…`) is the newer Supabase naming; ANON (`eyJ…` JWT) is the legacy form. Either satisfies `mobile/lib/supabase.ts:85-96`; code tries publishable first.
- **Gemini bot quirk:** when Gemini's comment claim contradicts my stated understanding, re-read the primary source before dismissing. I got this wrong on PR #222 first pass — corrected before merge. Primary sources beat confidence.
- **`MOBILE_CARD_CLASS` already includes `p-3`.** Applying `p-4` on top is a smell (last one wins at style-merge time but both compile). Prefer `PANEL_SURFACE_SUBTLE_CLASS + p-4` when the card needs different padding.
- **`DESTRUCTIVE_GHOST_BUTTON_CLASS` uses pre-computed `border-z-debt-25`**, not `border-z-debt/25`. NativeWind v3 (mobile) cannot consume slash-opacity syntax. The token is defined in `mobile/tailwind.config.js`: `"z-debt-25": "rgba(224,85,69,0.25)"`.
- **Reanimated 3 chevron pattern** — shared value + `useEffect(…, [expanded, sharedValue])` + `useAnimatedStyle` reading `${sharedValue.value}deg`. Works because worklets re-run when shared values change; effect bridges React state → shared value. Applied in `BudgetRow.tsx:53-61`.
- **`useFocusEffect` + `loadData`** re-fires on `loadData` reference change (its callback is captured via `useCallback(…, [loadData])`). When `currentMonth` flips, `loadData` identity changes → effect re-runs. Confirmed working on Movimientos + Budgets.
- **`requestIdRef` race-guard pattern** — both `setItems` and the `finally { setLoading(false) }` check `requestId === requestIdRef.current`. Dropping the guard on `setLoading` is a subtle bug (last-completing fetch clears loading even if its data was dropped).
- **Review gate order for mobile slices:** mobile-perf-doctor → zetas-front-guy → superpowers:code-reviewer → mobile-sync-doctor (if repository writes) → mobile-webapp-parity (if Supabase mutation or cross-platform feature). All 5 ran on #223; future mobile tab polishes should hit the same gates.
- **User explicitly wants sequential mobile slices, not parallel.** Established when picking Budgets first: "Budgets, then Movimientos slice 2, then Plan, then Deudas". Don't bundle.

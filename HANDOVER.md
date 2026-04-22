# HANDOVER — 2026-04-22 (late night) — Movimientos parity + mobile-perf-doctor + mobile CI

> Supersedes prior handovers. For earlier handovers see git history (`HANDOVER.md@HEAD~N`).

## 1. Session Summary

Shipped **PR #221** (merged, commit `81229c3`): mobile `/movimientos` tab structural parity with the webapp mobile viewport + a large perf refactor + a new `mobile-perf-doctor` review-gate agent. Addressed 5 Gemini review comments in a follow-up commit on that PR (timezone bug, useFocusEffect deps, `React.memo` + stable callbacks, narrowed `getTopUncategorized` SELECT, fixed pre-existing broken imports in `lib/demo-data.ts`). Added **`.github/workflows/mobile-pr-verify.yml`** — a new CI workflow that runs `pnpm install --frozen-lockfile` + `npx tsc --noEmit` on mobile-touching PRs; proven green on PR #221 itself. Opened **PR #222** (open at handoff) with a parity fix (don't null `categorization_source` on category clear — matches webapp) + BACKLOG handoff entry.

The session's highest-value pattern went into the agent bible: prop-reference stability is the #1 mobile perf footgun. A `toItem()` "view-model" wrapper we initially wrote rebuilt objects per render → broke `React.memo` on paginated rows → every row re-rendered on every pagination. Fix is passing the repo row directly. Encoded as agent §1.1 "Golden rule".

## 2. Changes Made

### PR #221 (merged — commit `81229c3`)

Movimientos parity:
- `mobile/components/movimientos/MovimientosRoot.tsx` — rewritten. FlatList + pagination (`PAGE_SIZE=25`), memoized list header, hoisted `CategoryPickerSheet` at Root (conditionally mounted), `getMonthlyAggregates` SQL rollup for summary totals (was summing paginated feed), request-id race guard on `loadData`, `txCountRef` so loadData callback doesn't recreate on append.
- `mobile/components/movimientos/MovimientosLectura.tsx` — rewritten. 3-col summary (Movimientos / Ingresos / Gastos) + expandable SVG flow-by-day chart via `react-native-svg`. Rotating `ChevronDown` + "Ocultar / Ver flujo por día" at `tracking-[2px]` matches `PulseWidget` affordance. `React.memo` wrapper. Local-timezone date helper (not `toISOString()`).
- `mobile/components/movimientos/MovimientosHerramientas.tsx` — rewritten. Categorizar + Importar chips with expandable inline panel. Retain-last-tool pattern (260ms timeout, see `feedback_expand_animation_keep_content_mounted.md`). `React.memo` wrapper.
- `mobile/components/movimientos/MovimientosUtilidades.tsx` — **created**. Search-icon pill + `MobileSheet` filter drawer (Dirección / Cuenta / Mostrar excluidas).
- `mobile/components/movimientos/MovimientosTransactionRow.tsx` — rewritten. `React.memo` row, receives `TransactionListRow` directly (prior `toItem()` wrapper broke memo), account dot + name, expanded chips: Categoría picker + Editar link.
- `mobile/lib/repositories/transactions.ts` — added `getMonthlyAggregates` (SQL `SUM + CASE WHEN`, debt-filtered inflow, per-day `GROUP BY`), `getTopUncategorized` (narrowed SELECT + new `UncategorizedSampleRow` type), extended `TransactionListRow` with `account_name` + `account_color`.

Agent + CI:
- `.claude/agents/mobile-perf-doctor.md` — **created**. 8 sections: prop-reference stability (§1), list virtualization (§2), animation cost (§3, incl. §3.2 AnimatedAccordion scale/close/affordance rules), mount/lifecycle (§4, incl. §4.4 race guards on paginated loaders), SQLite data layer (§5, incl. §5.2 summary totals from SQL), NativeWind v3 tokens (§6), Expo/RN gotchas (§7), verification (§8). Refined during this PR's own review cycle.
- `CLAUDE.md` — registered `mobile-perf-doctor` as review gate #6 ("every mobile list screen or animated surface").
- `.github/workflows/mobile-pr-verify.yml` — **created**. Pre-merge typecheck on mobile changes.

Demo data unblock:
- `mobile/lib/demo-data.ts` — fixed broken imports (shared package renamed category constants: `SALARIO → INGRESOS`, `SERVICIOS → HOGAR`, `PAGOS_DEUDA → OBLIGACIONES`). Demo mode had been compile-broken for a while; required for new CI to pass.

### PR #222 (open — commit `610b177`, branch `chore/movimientos-followups`)

- `mobile/lib/repositories/transactions.ts` — `updateTransaction`: on category clear (`category_id → null`), no longer writes `categorization_source = null`. Matches webapp (`webapp/src/actions/transactions.ts:841` only flags `USER_OVERRIDE` when assigning; leaves prior source intact on clear). Applied to both the SQLite UPDATE branch AND the `syncPayload` sent to Supabase.
- `BACKLOG.md` — appended "Session handoff — 2026-04-22 (late night)" entry.

### Memory additions (user-scope, persist across sessions)

- `~/.claude/projects/-Users-cristian-Documents-developing-current-projects-zeta/memory/feedback_mobile_perf_doctor.md` — commitment to keep appending learnings to the agent file after every mobile perf bug debugged.
- `MEMORY.md` index entry under `### Performance` pointing to the new feedback file.

## 3. Key Decisions

- **Slice Movimientos parity into two PRs.** Slice 1 (shipped): structural parity without new picker sheets. Slice 2 (deferred): destinatario + tag + vincular-a-recurrente chips on rows + email-pending detail panel. Reason: slice 2 needs 2–3 new sheet components + `transaction_tags` JOIN extension — too wide to bundle with the perf refactor.
- **Pass `TransactionListRow` directly to the memoized row; no view-model wrapper.** The `toItem()` wrapper we initially wrote was the root cause of the "gets slow after 2–3 paginations" bug — it created new object refs on every feedItems rebuild, breaking memo. Direct pass keeps refs stable.
- **Keep `AnimatedAccordion` chart always-mounted, aggregation conditionally computed.** Initially wrapped chart in `{expanded && <FlowChart/>}` for perf. That caused pop-in tear on expand + blank close animation. Reverted per the `feedback_expand_animation_keep_content_mounted` rule + the "one-per-screen content always mounts, per-row content mounts conditionally" guidance (encoded in agent §3.2).
- **Summary totals via SQL aggregate, not from paginated feed.** Code-reviewer agent caught that Lectura's count / ingresos / gastos / `uncategorizedCount` were summing only the loaded rows, so totals inflated as the user scrolled. Added `getMonthlyAggregates` repository function with SQL `SUM + CASE WHEN` and per-day `GROUP BY`. Added `getTopUncategorized` for the Categorizar sample.
- **Request-id race guard on `loadData`.** Code-reviewer also caught that if the user toggles a filter while a `loadData({ reset: false })` page fetch is in flight, the stale page appends to the freshly-reset state. Added `requestIdRef` pattern from agent §4.4. Also moved `transactions.length` out of `loadData`'s dep list via `txCountRef` so it doesn't recreate on every append.
- **Declined narrowing `getTransactions SELECT t.*`** (Gemini deferred comment). 6 callers consume many columns; mobile SQLite rows are plaintext (no encrypted-column parse cost); gain is marginal. Filed in BACKLOG.
- **Declined re-review from zetas-front-guy on toggle label `tracking-[2px]`.** Agent flagged it as non-canonical vs `SECTION_EYEBROW_CLASS` `[4px]`. But `PulseWidget` (the reference dashboard pattern the user asked us to match) uses `tracking-[2px]` for the exact same toggle label. Kept as-is. Lesson: Zeta has TWO eyebrow tracking values — `[4px]` for section eyebrows, `[2px]` for toggle-label eyebrows. Don't let an agent "normalize" the latter.
- **`mobile-perf-doctor` will grow over time.** Commitment saved as feedback memory + first learning encoded in the agent file during the same PR's review cycle. Future: every mobile perf bug → append to the matching section.

## 4. Current State

- **Branch**: `chore/movimientos-followups` (PR #222 open, waiting on CI + review). `main` contains PR #221 (merged).
- **Build**: `cd mobile && npx tsc --noEmit` → 0 errors. `mobile-pr-verify` CI workflow proven green on PR #221.
- **Uncommitted**: only `D .claude/worktrees/agent-a19574cf` (unrelated worktree cleanup, not ours).
- **Agents loaded in current session**: `mobile-perf-doctor` is on `main` but **sessions started before the merge do not see it in their registry** — the agent list locks at session start. First post-session-restart run should dogfood it.

## 5. Open Issues & Gotchas

### Non-blocking for PR #222

- **`mobile-perf-doctor` not dogfooded yet.** Agent was registered mid-session; current session's registry is frozen. First order of business next session: spawn it against `mobile/components/movimientos/*` + whatever tab is being polished next.
- **`SELECT t.*` in `getTransactions`** (`mobile/lib/repositories/transactions.ts:242`) — flagged by Gemini on PR #221, declined. Do during the next repo-scope refactor.

### Pre-existing, deferred

- **`@zeta/shared` has 2 pre-existing TS errors** in test files / dev deps: `@vitest/spy` `Disposable` missing, `DebtAccount` missing in `scenario-engine.test.ts`. Not caught by mobile tsc (they're in shared's own `tsconfig`). Mobile CI intentionally only typechecks `mobile/` for this reason (documented in the workflow).
- **Slice 2 Movimientos gaps** (tracked in BACKLOG):
  - Row expanded chips: destinatario picker, tag picker, vincular-a-recurrente. All need new sheet components + repo extensions (`transaction_tags` JOIN, pending-occurrences by account).
  - Herramientas Importar chip: email-pending detail. Requires `email_staging` SQLite sync (not currently synced on mobile; `pendingEmails` is hardcoded `0`).

### Gotchas for next session

- **Agent registry locks at session start.** Any agent added mid-session is invisible until `/clear` or new session.
- **`mobile/lib/demo-data.ts` category IDs were remapped**: `CATEGORY_SALARIO → CATEGORY_INGRESOS`, `CATEGORY_SERVICIOS → CATEGORY_HOGAR`, `CATEGORY_PAGOS_DEUDA → CATEGORY_OBLIGACIONES`. Any script that seeds demo data assuming the old IDs will land in wrong buckets.
- **Mobile SQLite is plaintext** — no encryption layer — so the `SELECT t.*` concerns from the webapp don't apply to the same degree. Parse cost is small.
- **`useFocusEffect` in RN fires on every tab refocus**, not just mount. Kept simple with `[loadData]` dep list (PR #221's Gemini fix). Watch for double-load on slow tabs.

## 6. Suggested Next Steps

1. **`/clear` → dogfood `mobile-perf-doctor`** against `mobile/components/movimientos/*` to validate the agent catches what we think it catches on a fresh target. First real test of the agent.
2. **Merge PR #222** once CI + any review returns. Single simple fix, low risk.
3. **Next mobile tab polish.** User's stated priority was "continue polishing mobile based on webapp". Candidates ranked by ROI:
   - **Budgets** — smallest scope, biggest token-compliance debt (still uses `bg-z-surface-2-55` pre-v2 tokens). Good first tab to ship after the agent is loaded — validates the agent on a small surface.
   - **Plan** — high-traffic; Flow 05 backlog open ("decide: PR #170 polish sufficient or full Variant A?"). Medium scope.
   - **Deudas** — high-visibility; debt is core to Zeta value. Medium scope.
   - **Movimientos slice 2** — large scope, reopens recently-shipped files. Only pursue if user wants continuity.
4. **Flow 02 PR 3** (dashboard widget drag-to-reorder + S/M/L resize) — still pending from several sessions back. Reanimated + gesture-handler work; medium-large.
5. **Anonymous demo cleanup cron** (Tech Debt, Medium) — still pending since 2026-04-21.

## 7. Context for Claude

- **Mobile webapp viewport is the design source of truth.** Every mobile parity slice should open `webapp/src/components/mobile/v2/<feature>/*` first and mirror the shape. Deviations need justification (usually: "picker sheet doesn't exist on mobile yet — slice 2").
- **`WidgetGridRow` at `mobile/components/inicio/WidgetGrid.tsx`** is the canonical reference implementation for the retain-last-detail pattern (shared accordion that swaps children by active id). Copy its timer + cleanup pattern whenever you wire an `AnimatedAccordion` with swappable children.
- **`MobileSheet` at `mobile/components/ui/MobileSheet.tsx`** is the canonical bottom-sheet Modal wrapper — handles safe-area inset, scrim, drag handle. Never use raw `<Modal>` + custom scrim — duplicates the safe-area logic.
- **Mobile pre-computed opacity tokens**: NativeWind v3 cannot consume `color/opacity` syntax. Use `bg-black-10`, `text-white-15`, `border-white-6`, `bg-z-brass-10` etc. from `mobile/tailwind.config.js`. Arbitrary `/opacity` silently falls back on some targets.
- **`PulseWidget` at `mobile/components/inicio/widgets/PulseWidget.tsx`** is the canonical dashboard expand/collapse affordance: rotating `ChevronDown` + "Ocultar / Ver …" label at `tracking-[2px]`. Zeta has TWO eyebrow tracking values: `[4px]` for section eyebrows (`SECTION_EYEBROW_CLASS`), `[2px]` for toggle-label eyebrows. Don't let an agent "normalize" the latter.
- **Review gate order after any mobile feature**: `mobile-perf-doctor` + `mobile-webapp-parity` + `zetas-front-guy` + `feature-dev:code-reviewer`. Run foreground when findings are needed to proceed; background when independent.
- **`mobile-perf-doctor` bible sections we added this session**:
  - §1.1 Golden rule: pass the array item directly, don't rebuild it into a view model (the `toItem()` trap)
  - §3.2 AnimatedAccordion scale/close/affordance rules (one-per-screen vs per-row mounting; retain-last-detail pattern; `ChevronDown` + toggle label)
  - §3.3 SVG rendering gated on `expanded` without retention causes close-animation tear
  - §4.4 Race guards on paginated loaders (`requestIdRef` + `txCountRef`)
  - §5.2 Summary totals must come from SQL, not the paginated feed
- **PR merge style**: squash merge via GitHub UI. Don't force-push to `main`. Dry-merge against `origin/main` before pushing any branch (Zeta `CLAUDE.md` rule).
- **Pipeline** (proven across 2026-04-22 sessions): implement → gate agents (foreground when blocking) → apply findings → `/simplify` or equivalent → apply → Gemini review → reply + backlog. Works well; stick with it.

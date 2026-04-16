# Session Handover — 2026-04-16 (Mobile Polish — Phase 1 + 2)

> Supersedes prior handovers in this file. For the 2026-04-08 performance-audit handover, see git history (`HANDOVER.md@HEAD~N`).

## 1. Session Summary

Two-phase mobile polish milestone. Phase 1 shipped structural fixes — production leak of dev tooling, tab-bar clipping on list rows, month-pager desync, `/etiquetas` deep-link. Phase 2 reshaped the mobile `/dashboard` end-to-end via the `brainstorming → writing-plans → executing-plans` superpowers flow. Also performed a full mobile audit (28 screenshots, 30+ findings) before any code landed. Five review passes (zetas-front-guy, perf-auditor, frontend-auditor, ux-analyst, Gemini, `/simplify`) shaped the final implementation.

---

## 2. Changes Made

### Phase 1 — PR #168 (MERGED → `93f1cf3`)

- **`webapp/src/app/(dashboard)/settings/page.tsx:235-244`** — Gate "Herramientas de Desarrollo" card behind `process.env.NODE_ENV === 'development'` (was rendering to prod).
- **`webapp/src/app/(dashboard)/layout.tsx:107`** — Swap `pb-20` for `MOBILE_TAB_BAR_CLEARANCE_CLASS`. 80px was less than `56px + env(safe-area-inset-bottom)` on iPhones with home indicator, clipping the last list row on `/transactions`, `/accounts/[id]`, `/plan?tab=periodo`, etc.
- **`webapp/src/components/settings/settings-mobile-accordion.tsx`** — Added `useEffect` hash handler + `scroll-mt-16` + per-section refs so `/settings#etiquetas` auto-opens the matching accordion and scrolls into view.
- **`webapp/src/app/(dashboard)/etiquetas/page.tsx`** — Redirect target changed to `/settings#etiquetas` (was `/settings` top).
- **`webapp/src/components/recurring/use-recurring-month.ts`** — Rewired month-cursor from local `useState(() => new Date())` to URL-param source via `useRouter`/`useSearchParams`/`parseMonth`/`formatMonthParam`. Inner Recurrentes pager and global `<MonthSelector />` now share one source of truth.
- **`~/.claude/rules/pdf-parser.md`** — Personal rule sync: import wizard is 6 steps (`upload | review | destinatarios | confirm | reconcile | results`), not 4.

### Phase 2 — PR #169 (OPEN, mergeable CLEAN)

**New files:**

- **`webapp/src/components/mobile/v2/inicio/timeline-model.ts`** — Pure module. `TimelineItem`/`TimelineSources`/`UpcomingIncomeItem` types + `buildTimelineItems()` merger. Consumes `formatDate` + `formatCurrency` from `@/lib/utils/*` (was hand-rolling them; simplified in `/simplify` pass).
- **`webapp/src/components/mobile/v2/inicio/timeline-model.test.ts`** — 5 Vitest cases (empty, overdue, today-collapsed-emails, date sort, income styling). All passing.
- **`webapp/src/components/mobile/v2/inicio/inicio-attention-timeline.tsx`** — Replaces `inicio-attention.tsx`. Horizontal "Por resolver" strip + `aria-label` per card + empty-state "Todo tranquilo".
- **`webapp/src/components/mobile/v2/inicio/inicio-tool-row.tsx`** — Replaces `inicio-discovery.tsx`. Single full-width tile wrapping `PurchaseRecommenderDrawer`.
- **`webapp/vitest.config.ts`** — Minimal `defineConfig` with `@` → `src` path alias. Required only because `timeline-model.ts` now imports `@/lib/utils/*`; previously tests worked with no config.

**Modified files:**

- **`webapp/src/components/mobile/v2/inicio/inicio-root.tsx`** — Reorder to Hero → ImportStrip → Timeline → Widgets → Tool → Reciente. `space-y-2` → `space-y-4`. Added `upcomingIncome` + `currency` plumbing.
- **`webapp/src/components/mobile/v2/inicio/inicio-metrics-grid.tsx`** — RITMO + GASTO HOY restyled from chip-style to widget tile (`rounded-2xl`, `min-h-[120px]`, centered col, uses new `PANEL_INSET_SUBTLE_CLASS`). Arc-ring stroke uses `var(--color-z-surface-3)` token.
- **`webapp/src/components/mobile/v2/inicio/inicio-activity.tsx`** — Major. Dropped "Sin cat." yellow tag. Tap-to-expand with inline `CategoryPickerBody` (OUTFLOW only) + optimistic update via `categorizeTransaction`. `CategoryPickerBody` loaded via `next/dynamic({ssr:false})`. Lazy-mount via `openedOnceIds`. `scrollIntoView` after expand to clear tab bar. `aria-expanded` + `aria-label` on row button. `currency_code` typed as `CurrencyCode`. Direction icons use `bg-z-income/12` + `bg-z-expense/12`.
- **`webapp/src/components/mobile/v2/inicio/inicio-import-strip.tsx`** — Added `hasPendingEmails: boolean` prop; hides when true (redundant with timeline's email card).
- **`webapp/src/components/dashboard/zones/mobile-zone.tsx`** — Derive `upcomingIncome` from `heroData.nextIncome*`. Added `category_id` to `mobileRecentTx` mapping. `currency_code` cast to `CurrencyCode`.
- **`webapp/src/actions/transactions.ts:573-588, 604-619`** — Added `category_id` to `RecentTransaction` type + select columns in `getRecentTransactionsCached`.
- **`webapp/src/lib/constants/styles.ts`** — Added `PANEL_INSET_SUBTLE_CLASS` export (`rounded-2xl border border-white/6 bg-white/[0.02]`).

**Deleted:** `inicio-attention.tsx`, `inicio-discovery.tsx`.

### Session artifacts committed (not code, but durable)

- **`audit/MOBILE_AUDIT_2026-04-16.md`** — 368-line full mobile audit, top 10 quick wins, per-screen findings, RN parity gaps.
- **`audit/2026-04-16/*.png`** — 28 original sweep captures + 8 Phase 2 verification captures.
- **`docs/superpowers/specs/2026-04-16-dashboard-polish-design.md`** — Phase 2 design spec (decisions D1–D7).
- **`docs/superpowers/plans/2026-04-16-dashboard-polish.md`** — Phase 2 implementation plan (12 tasks, ~50 steps).
- **`BACKLOG.md`** — Appended 5 entries (see section 5 below).

---

## 3. Key Decisions

- **Dashboard job = Status + Triage (co-dominant), habit-reinforcement de-prioritized.** User framing: "Am I on track + what needs attention." Drove every subsequent layout choice.
- **Hero first, same position always.** Rejected adaptive ordering ("attention leads when urgent") for predictability.
- **"Por resolver" horizontal timeline** (Option D from mockup round) won over stacked cards, unified attention hero, single next action. Chronological mental model absorbs emails/pagos/ingresos.
- **Widget tiles (W2 mockup) over chip or single-tool variants.** RITMO kept (track signal, not habit). GASTO HOY restored after user feedback despite de-prioritizing habit metrics.
- **`Plan del mes` tile removed** — redundant with tab-bar Plan entry. `¿Puedo comprarlo?` kept as single tool row since it has no tab-bar home.
- **Dual-back pills on `/transactions/[id]` + `/deudas/planificador` NOT removed.** User's explicit call: PWA installs lose browser back-swipe; pills are safety insurance. Deferred to redesign (breadcrumb tag vs back chip), not removal.
- **Reciente "Sin cat." yellow tag removed.** Signal moved into tap-to-expand inline category picker. `/transactions` already surfaces the uncategorized count prominently; don't duplicate on Dashboard.
- **Inline execution over subagent-driven** for Phase 2. Reasons: Playwright auth session reuse (agents spawn fresh contexts), shared-file serialization (4 tasks touch `inicio-root.tsx`), visual polish benefits from user-in-the-loop iteration.
- **`CategoryPickerBody` → dynamic import.** `/simplify` efficiency finding: static import shipped ~800 LOC (Radix Command/Popover + inline form + zone tiles) to Dashboard route even though `openedOnceIds` only lazy-*rendered*. `next/dynamic({ssr:false})` defers mount AND bundle.
- **Timeline model accepts `currency` via `TimelineSources`.** Original hardcoded `$`; frontend-auditor + Gemini + `/simplify` all flagged. Now multi-currency-ready (caveat: attention types still carry `amount: number` with no currency per item — see Gotchas).

---

## 4. Current State

- **Branch:** `feat/dashboard-polish-phase-2`
- **PR #169:** OPEN, `mergeStateStatus=CLEAN`, CI green (`verify-webapp: SUCCESS`; others SKIPPED — non-parser, non-deploy PR).
- **PR #168:** MERGED via squash as commit `93f1cf3` on `main`.
- **Build:** `pnpm build` clean. Only diagnostic is pre-existing `totalBudget` deprecation warning at `inicio-root.tsx:159` — not this session's change.
- **Tests:** `pnpm vitest run` — `timeline-model.test.ts` 5/5 passing. No other test files in scope.
- **Uncommitted changes:** 0 tracked. 38 untracked files (stale `.png` mockups + a WhatsApp video from earlier audit work — unrelated, leave alone or archive).
- **Dev server:** Background dev server running on :3000 from bash task `bhf8l4v6e`. Kill with `lsof -i :3000 -P -sTCP:LISTEN -t | xargs kill` if desired.
- **Visual Companion server:** Auto-exits after 30 min idle. Mockup files persist in `.superpowers/brainstorm/9678-1776362397/` (gitignored).

---

## 5. Open Issues & Gotchas

- **`inicio-root.tsx:159`** — pre-existing `totalBudget` deprecation. Not this session's change.
- **Timeline `Ver todo →` destination** is `/gestionar`. `ux-analyst` flagged this isn't strictly a time-ordered attention list today. Revisit if Bandeja gets a "Por resolver" section that mirrors the Dashboard timeline.
- **Category picker is a grid, not chip row** — spec D6 said "horizontal scroll chip row"; implementation uses `CategoryPickerBody` (richer, searchable). `ux-analyst` noted density. Acceptable tradeoff; revisit if real-device feedback shows overflow.
- **`formatCurrency` on attention items uses a single dashboard currency.** Attention types carry `amount: number` with no per-item currency_code. Timeline receives a single `currency: CurrencyCode` prop. Means a USD obligation would render with `$` (COP's symbol in `es-CO` locale) instead of the correct symbol. Out of scope for polish; track if multi-currency obligations become real.
- **Reciente INFLOW rows have no inline picker.** Expanded panel shows only "Vincular" + "Ver detalle". Deliberate — INFLOW categorization is rare on Dashboard and rich forms live at `/transactions/[id]`.
- **Turbopack dev-cache staleness** bit me once when adding a cross-file export. If HMR gets stuck: `lsof -i :3000 -t | xargs kill && rm -rf webapp/.next && cd webapp && pnpm dev`. Codified in CLAUDE.md.
- **Two pre-existing `as CurrencyCode` casts** at `inicio-activity.tsx:331` on `o.currencyCode` from `occurrenceCandidates`. Not touched — from a different type not owned by this feature.

### BACKLOG entries added this session

1. **Promote transaction → recurring template ("Hacer recurrente" CTA)** — HIGH priority. Add action on `/transactions/[id]` that opens prefilled `RecurringFormDialog`. Closes the "I just paid this, mark it recurring" loop.
2. **`is_subscription` toggle is dead flag** — HIGH. The mobile + web transaction forms write `is_subscription` to the tx row, but nothing reads it. Connect to template-creation OR remove.
3. **Link Destinatario ↔ Recurring Template** — HIGH. Add `destinatario_id` column to `recurring_templates`. When destinatario matcher hits a recipient linked to a template, prompt user to link the tx to the pending occurrence.
4. **Account aliases + mini icons** — HIGH (unblocks density gains). `Bancolombia Ahorros ****4398` → `<alias> · ****<mask>` + 16×16 icon. Requires encrypted-table migration (spawn `supabase-migrator`).
5. **Dashboard RECIENTE inline category assignment** — Shipped as part of this PR. (Originally backlogged mid-session, then scoped into Phase 2.)

---

## 6. Suggested Next Steps

**Immediate:** merge PR #169 when workflows pass (user said they'll handle this).

**Phase 2 step 2 — Plan page polish:**

1. Re-read `audit/MOBILE_AUDIT_2026-04-16.md` — sections `10` (Plan), `11` (plan-periodo), `17` (recurrentes), and `06` (plan?tab=presupuesto). Key findings:
   - `/plan` — `Recurrentes 8` badge ambiguous yellow color
   - `/plan?tab=periodo` — NETO value buried in stat row, list clips behind tab bar (hopefully now fixed by Phase 1 layout change)
   - `/plan?tab=recurrentes` — `MIS PLANTILLAS` footer buried; discoverability low
   - `/plan?tab=presupuesto` — all-red category saturation, group by risk state
2. Invoke `superpowers:brainstorming`. Visual Companion files persist in `.superpowers/brainstorm/` from this session — reference prior mockups if useful.
3. Produce `docs/superpowers/specs/2026-04-17-plan-page-polish-design.md`.
4. Produce `docs/superpowers/plans/2026-04-17-plan-page-polish.md`.
5. Execute inline using `superpowers:executing-plans`.
6. Same review-gate pattern: zetas-front-guy + perf-auditor → Gemini → frontend-auditor + ux-analyst → `/simplify`.

**Cross-cutting work worth prioritizing:**

- **Account aliases** — unblocks density in many row surfaces (Reciente, Plan occurrences, Deudas accounts). High backlog priority.
- **"Hacer recurrente" + Destinatario↔Recurring link** — paired features. High backlog priority.

---

## 7. Context for Claude

- **Mobile dashboard tree:** `webapp/src/app/(dashboard)/dashboard/page.tsx` → `<MobileZone>` (`webapp/src/components/dashboard/zones/mobile-zone.tsx`) → `<InicioRoot>` → 5 `inicio-*` children. The Server Component page renders both desktop and mobile branches; desktop is gated to `lg:block`, mobile to `lg:hidden`.
- **`useLiveDashboard`** hook refreshes hero + metrics + attention silently after mount. Treat the props it derives as the source of truth in client components that receive it.
- **`categorizeTransaction(txId, categoryId)`** in `@/actions/categorize` — lightweight server action for category assignment. Not `updateTransaction` (full-shape action for form submissions).
- **`useOutflowCategories()`** in `AppDataProvider` context — cached, no DB call on render. Prefer over `useCategories()` when scope is outflow-only.
- **`<MonthSelector />`** at `webapp/src/components/month-selector.tsx` — canonical `?month=` URL-param navigation pattern. Any month-aware view should read/write it the same way. This session's `useRecurringMonth` rewrite now follows this pattern.
- **Review-gate pattern that worked well this session** (recommend for future phases):
  1. Spawn `zetas-front-guy` + `perf-auditor` in parallel after implementation.
  2. Push + let Gemini's bot review (usually within 2 min).
  3. Spawn `frontend-auditor` + `ux-analyst` for deeper a11y + cohesion.
  4. Run `/simplify` skill (reuse + quality + efficiency).

  Each layer surfaces non-overlapping findings. Apply each as a separate commit for clean review history.
- **CLAUDE.md rules most relevant to mobile dashboard work:** Performance Rules (`"use cache"` + `cacheTag()`), UI Rules (token palette, `MOBILE_TAB_BAR_CLEARANCE_CLASS`, BRASS/GHOST button variants), Cache API (`updateTag` not `revalidateTag`), Debt account direction rule (INFLOW to CREDIT_CARD ≠ income).
- **Superpowers skill flow for polish milestones:** audit → brainstorm (with Visual Companion) → write-spec → write-plan → execute. Each artifact lives under `audit/` + `docs/superpowers/{specs,plans}/`. This session's docs are reusable templates.

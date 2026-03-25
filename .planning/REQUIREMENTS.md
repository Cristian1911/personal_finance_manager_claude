# Requirements: Zeta — Polish & Refinement Milestone

**Defined:** 2026-03-25
**Core Value:** Every screen answers "Am I on track?" without explanation

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Security & Infrastructure

- [ ] **SEC-01**: All dashboard routes protected by middleware (not just the current 6-path list)
- [ ] **SEC-02**: Error boundary (`error.tsx`) at dashboard layout level for graceful failure recovery
- [ ] **SEC-03**: Custom 404 page (`not-found.tsx`) with navigation back to dashboard
- [ ] **SEC-04**: Admin client `createAdminClient()` throws descriptive error instead of returning null with `!` assertions

### Income & Data Foundation

- [ ] **DATA-01**: Fix income column mismatch — `getEstimatedIncomeCached` reads `estimated_monthly_income` (what onboarding writes), not `monthly_salary`
- [ ] **DATA-02**: Health meters show "Sin datos de ingresos" instead of "0% — excelente" when income is null
- [ ] **DATA-03**: Seed category UUIDs consolidated into `@zeta/shared/constants/categories.ts`, imported everywhere
- [ ] **DATA-04**: Fix `z.string().uuid()` usage in recurring-templates and purchase-decision actions to use permissive regex

### Categorization Engine

- [ ] **CAT-01**: Normalize transaction descriptions before matching (accent removal, noise token stripping, lowercase)
- [ ] **CAT-02**: Word-boundary matching to prevent false positives ("ara" matching "compra")
- [ ] **CAT-03**: Regex rule support in auto-categorize engine
- [ ] **CAT-04**: Expand keyword coverage for Colombian bank transaction formats
- [ ] **CAT-05**: `manually_categorized` flag (or equivalent) to protect user corrections from being overwritten by auto-rules
- [ ] **CAT-06**: Schema migration for manually_categorized tracking

### Categorization UX

- [ ] **CATUX-01**: Inline category quick-edit (popover on tap) in transaction lists — no full detail view required
- [ ] **CATUX-02**: Unreviewed transactions badge/queue after import — surfaces auto-categorized exceptions for human review
- [ ] **CATUX-03**: Category correction during review feeds back into rule suggestions

### Dashboard Performance

- [ ] **PERF-01**: Dashboard Suspense streaming — tier 1 (hero/health) renders immediately, tier 2 (charts/sections) streams with skeletons
- [ ] **PERF-02**: Lazy-load recharts via `next/dynamic` — chart components not in initial bundle
- [ ] **PERF-03**: Remove framer-motion dependency (replace single real import with CSS animation)
- [ ] **PERF-04**: Upgrade recharts v2 → v3 (CSS variable syntax alignment with shadcn/ui)
- [ ] **PERF-05**: Meaningful skeleton components for each dashboard section (not generic spinners)

### Dashboard Redesign

- [ ] **DASH-01**: "Am I on track?" single-sentence health headline at top of dashboard
- [ ] **DASH-02**: Composite financial health score (single grade) synthesizing existing health dimensions
- [ ] **DASH-03**: Information hierarchy — clear primary/secondary/tertiary data tiers across all dashboard sections
- [ ] **DASH-04**: Debt-free date promoted to dashboard hero (when debts exist)
- [ ] **DASH-05**: Dashboard sections communicate purpose, not just data — each widget has a clear "so what?"

### Onboarding

- [ ] **ONB-01**: HTML/static walkthrough of current onboarding flow for audit review
- [ ] **ONB-02**: Streamline onboarding — minimum viable setup, progressive disclosure for optional data
- [ ] **ONB-03**: Income capture during onboarding that correctly powers downstream health metrics and 50/30/20
- [ ] **ONB-04**: Onboarding completion state gates dashboard (no placeholder grey boxes)
- [ ] **ONB-05**: Onboarding visual polish — professional feel that inspires confidence

### Visual Polish

- [ ] **UX-01**: Consistent spacing, typography, and color usage across all screens
- [ ] **UX-02**: Empty state designs for all major views (no blank screens)
- [ ] **UX-03**: Friendly, non-guilt-inducing copy across all status messages and health labels
- [ ] **UX-04**: Consistent status color system using `cva` variants (not inline styles)
- [ ] **UX-05**: Visual consistency between desktop and mobile-responsive views

### Tech Debt Cleanup

- [ ] **DEBT-01**: Remove reconciliation column fallback dead code (`isMissingReconciliationColumnError`, `executeVisibleTransactionQuery`, fallback paths)
- [ ] **DEBT-02**: Type the transaction query utils — eliminate `any` in `transactions.ts` (or delete wrappers after reconciliation cleanup)
- [ ] **DEBT-03**: Type `TabViewRouter` data passing with discriminated union instead of `as any` spread
- [ ] **DEBT-04**: Type `formatCached` in exchange-rate action using proper DB row type
- [ ] **DEBT-05**: Type analytics schema access (extend Database type or create local typed definitions)
- [ ] **DEBT-06**: Standardize PDF parser API key env var — remove `PARSER_API_KEY` fallback alias
- [ ] **DEBT-07**: Add `console.error` logging to all silent `catch {}` blocks in server actions

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Enhanced Categorization

- **CAT-V2-01**: User-manageable categorization rules screen (CRUD for custom rules)
- **CAT-V2-02**: Category hierarchy (subcategories)
- **CAT-V2-03**: Bulk re-categorize existing transactions when rules change

### Advanced Dashboard

- **DASH-V2-01**: Customizable dashboard widget layout (drag/drop/hide)
- **DASH-V2-02**: Time period comparison (this month vs last month trends)
- **DASH-V2-03**: Goal tracking with visual progress indicators

### Testing

- **TEST-V2-01**: Unit tests for server actions
- **TEST-V2-02**: Automated tests for Python PDF parsers
- **TEST-V2-03**: Webapp vitest configuration and test script

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Dark mode | High complexity, low priority for single-user; defer to v2+ |
| Gamification (streaks, badges, points) | Contradicts "no-guilt" UX philosophy; can feel patronizing |
| AI/ML categorization | User explicitly prefers deterministic rules |
| Mobile (React Native) changes | Webapp is design source of truth; mobile follows in separate milestone |
| New bank parsers | This milestone is refinement, not new features |
| Fully customizable dashboard layout | Over-engineering for single user; fixed layout with good hierarchy is better |
| Real-time notifications | Not needed for single-user context |
| OAuth/social login | Email/password sufficient |
| Internationalization | Single-locale (Spanish) app |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Pending |
| SEC-03 | Phase 1 | Pending |
| SEC-04 | Phase 1 | Pending |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-04 | Phase 2 | Pending |
| CAT-01 | Phase 3 | Pending |
| CAT-02 | Phase 3 | Pending |
| CAT-03 | Phase 3 | Pending |
| CAT-04 | Phase 3 | Pending |
| CAT-05 | Phase 3 | Pending |
| CAT-06 | Phase 3 | Pending |
| CATUX-01 | Phase 7 | Pending |
| CATUX-02 | Phase 7 | Pending |
| CATUX-03 | Phase 7 | Pending |
| PERF-01 | Phase 4 | Pending |
| PERF-02 | Phase 4 | Pending |
| PERF-03 | Phase 4 | Pending |
| PERF-04 | Phase 4 | Pending |
| PERF-05 | Phase 4 | Pending |
| DASH-01 | Phase 6 | Pending |
| DASH-02 | Phase 6 | Pending |
| DASH-03 | Phase 6 | Pending |
| DASH-04 | Phase 6 | Pending |
| DASH-05 | Phase 6 | Pending |
| ONB-01 | Phase 5 | Pending |
| ONB-02 | Phase 8 | Pending |
| ONB-03 | Phase 8 | Pending |
| ONB-04 | Phase 8 | Pending |
| ONB-05 | Phase 8 | Pending |
| UX-01 | Phase 9 | Pending |
| UX-02 | Phase 9 | Pending |
| UX-03 | Phase 9 | Pending |
| UX-04 | Phase 9 | Pending |
| UX-05 | Phase 9 | Pending |
| DEBT-01 | Phase 10 | Pending |
| DEBT-02 | Phase 10 | Pending |
| DEBT-03 | Phase 10 | Pending |
| DEBT-04 | Phase 10 | Pending |
| DEBT-05 | Phase 10 | Pending |
| DEBT-06 | Phase 10 | Pending |
| DEBT-07 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 44 total (note: original count of 43 was off by one — 44 requirements verified above)
- Mapped to phases: 44
- Unmapped: 0

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after roadmap creation — full traceability populated*

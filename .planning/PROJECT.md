# Zeta — Polish & Refinement Milestone

## What This Is

Zeta is a personal finance management app for Colombian users. It tracks transactions across multiple banks (via PDF statement import), manages budgets with 50/30/20 allocation, models debt payoff strategies, handles multi-currency accounts, and provides a dashboard with financial health metrics. Built as a Next.js 15 webapp with a Python PDF parser microservice, backed by Supabase.

This milestone is a comprehensive polish pass — the features exist, but the experience doesn't tell a clear story. The app should answer "Am I on track?" at a glance, without explanation.

## Core Value

**Every screen should answer "Am I on track?" without requiring explanation.** The app has the data — it needs to present it with purpose, hierarchy, and visual clarity so the user feels informed, not overwhelmed.

## Requirements

### Validated

Shipped and working capabilities (inferred from existing codebase):

- ✓ User authentication (email/password, session persistence) — existing
- ✓ Transaction management (CRUD, filtering, search) — existing
- ✓ PDF statement import (Bancolombia, Nu, Davivienda, Bogota, Falabella, Nequi, Confiar, Popular, Lulo) — existing
- ✓ 4-step import wizard (upload → review → confirm → results) — existing
- ✓ Account management (multiple banks, credit/debit/savings) — existing
- ✓ Category system with seed categories and custom user categories — existing
- ✓ Auto-categorization rules engine (@zeta/shared) — existing
- ✓ Budget management with 50/30/20 allocation model — existing
- ✓ Debt tracking with payoff strategies (avalanche, snowball, custom) — existing
- ✓ Debt scenario planner and simulator — existing
- ✓ Multi-currency support with exchange rate caching — existing
- ✓ Recurring transaction templates — existing
- ✓ Recipients (destinatarios) management — existing
- ✓ Dashboard with health metrics, charts, and widgets — existing
- ✓ Financial health scoring system — existing
- ✓ Onboarding flow (multi-step) — existing
- ✓ Mobile-responsive layout with tab-based navigation — existing
- ✓ Server-side rendering with cache invalidation — existing

### Active

Goals for this milestone — polish, tech debt, and UX improvements:

- [ ] Dashboard redesign: "Am I on track?" as the primary narrative — clear health signal first, details on demand
- [ ] Information hierarchy overhaul: every screen presents data with purpose, not just density
- [ ] Visual polish pass: consistent spacing, typography, colors, and component patterns across all screens
- [ ] Onboarding audit: create visual walkthrough of current flow, then redesign based on findings
- [ ] Onboarding should capture income and financial goals to power downstream features (health, 50/30/20, debt countdown)
- [ ] Auto-categorization improvement: more rules AND better matching accuracy
- [ ] Security hardening: middleware protection for all dashboard routes
- [ ] Dead code removal: reconciliation column fallback, unused `any`-typed wrappers
- [ ] Type safety cleanup: eliminate `any` leaks in transaction utils, tab router, exchange rate
- [ ] Error boundaries: add `error.tsx` and `not-found.tsx` for graceful failure handling
- [ ] Performance: Suspense streaming for dashboard, lazy-load heavy chart libraries
- [ ] Consolidate seed category UUIDs into `@zeta/shared` constants
- [ ] Fix `z.string().uuid()` usage in recurring-templates and purchase-decision actions

### Out of Scope

- Mobile (React Native) app changes — webapp is design source of truth, mobile follows later
- New features (new bank parsers, new financial products) — this milestone is refinement only
- AI/ML-based categorization — deterministic rules only per user preference
- Real-time notifications or push — not needed for current single-user context
- OAuth/social login — email/password sufficient
- Internationalization beyond Spanish — single-locale app

## Context

- **User base:** Single user (the developer), but built to production standards
- **Deployment:** Docker on VPS, Supabase cloud (sa-east-1)
- **Codebase state:** Feature-complete but rough edges. 29 server actions with zero test coverage. 12 `any` usages. Missing error boundaries. Middleware gaps.
- **Recent work:** Dashboard metrics redesign (March 2026) added health widgets and charts but information hierarchy is still unclear
- **Onboarding state:** Multi-step flow exists but hasn't been reviewed in a long time. Dashboard preview is a grey placeholder box. Income not captured during onboarding, which cascades to broken health meters and budget calculations.
- **Auto-categorize state:** Rule engine exists in `@zeta/shared` but has few rules and poor matching. Seed category UUIDs scattered across 3 packages.
- **Performance:** `framer-motion` (62 imports, ~150KB) and `recharts` (~450KB) loaded eagerly. Dashboard fires 10+ parallel queries on cache miss.
- **Key user preference:** Speed is #1 priority. No AI. Deterministic, local-first mindset.

## Constraints

- **Tech stack**: Next.js 15, Tailwind v4, shadcn/ui, Supabase — no stack changes
- **Language**: Spanish-first UI, all user-facing strings in Spanish
- **Performance**: Speed over animations. Optimistic updates preferred. No heavy client-side libraries without lazy loading.
- **No AI**: Auto-categorization must be deterministic rule-based, not ML
- **Supabase**: RLS + defense-in-depth (`user_id` filter even with RLS). Auth via `getAuthenticatedClient()`.
- **Package manager**: pnpm for JS, uv for Python
- **Build gates**: `pnpm install` + `pnpm build` must pass before any work is considered done

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| "Am I on track?" as dashboard north star | User wants clear health signal, not data density | — Pending |
| Onboarding audit before redesign | User hasn't seen the flow in a long time, needs visual review first | — Pending |
| Full polish pass (8-12 phases) | User wants every screen refined, not just quick fixes | — Pending |
| Deterministic categorization only | User explicitly prefers rules over AI/ML | — Pending |
| HTML walkthrough for onboarding review | User wants to click through the current flow as mockups before deciding changes | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-25 after Phase 3 (Categorization Engine) completion*

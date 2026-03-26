# Zeta — Current Tasks

## Completed

- [x] **Dashboard redesign** — PR #32 merged
- [x] **Code review fixes** — PR #33 merged
- [x] **Security audit** — PR #34 merged (user_id filters across 10 action files)
- [x] **Auth dedup** — PR #35 merged (getAuthenticatedClient + React cache)
- [x] **Category budgets** — PR #36 merged (8 ADHD-friendly categories, budget dashboard, summary bar, trends)
- [x] **Build fix** — Stale createClient calls from PR #35/#36 merge conflict
- [x] **Category management polish** — `feat/category-budgets` branch merged
- [x] **Multi-currency validation** — Shipped: primary currency selector for multi-currency credit cards (commit 5b9742c), full multi-currency import support (commit 542c422)
- [x] **Recipient management with pattern detection** — Shipped: auto-detect patterns, pending-to-name queue, import-time review flow (commit 542c422)
- [x] **Sistema dual de presupuesto por categorías** — Shipped: declared vs. real budget by category with matching engine (commit 542c422)
- [x] **Onboarding wizard** — Shipped: 6-step onboarding redesign with tab preview and quick win flow (commit ced0359)
- [x] **Mobile app redesign** — Shipped: brand evolution "Sage Evolved", motion primitives, composite tab views, dashboard config system, profile/settings pages (commits f287963–669f423)
- [x] **Mobile FAB evolution** — Shipped: FAB bottom sheet with quick actions (commit 147d7e0)
- [x] **Burn Rate + Runway metrics** — Shipped: burn rate dashboard with 3-month moving average (commit 147d7e0)
- [x] **Debt payoff simulator (enhanced)** — Shipped: debt scenario planner with snowball/avalanche, salary bar chart, EA interest fix (commits f08b3fb, 1bf1265)
- [x] **E2E test suite** — 38 Playwright tests across 5 phases, all passing (commit 40d0107)
- [x] **Performance sprint** — Optimistic updates, parallel queries, Suspense boundaries, server-side cache, auth speedup (300ms saved), animation tuning (commits 27faed5–1ed5e9b)
- [x] **Dashboard metrics redesign** — Health widgets and charts with sub-component extraction (commits 8760851, 66f9091)

## In Progress

- [ ] **Journey de inversión con nudge anti-deuda** — Investment journey with anti-debt nudge. Connects to existing debt simulator. [Effort: XL, Impact: High]

## High Priority

- [ ] **Transaction search** — Full-text search by description/merchant, arbitrary date range, amount filters
- [ ] **Proactive notifications system** — Rule-based alerts: spending spikes, payment due dates, savings rate drops
- [ ] **PDF parser expansion: Davivienda + BBVA Colombia** — Extend parser coverage to Colombia's other major banks. Pattern from Nu + Lulo builds is fresh. [Effort: M, Impact: High, promoted from IDEAS 2026-03-13]

## Medium Priority

- [ ] **🐛 Fix localStorage race condition** — `use-recurring-month.ts`: second useEffect writes empty `{}` before first hydrates from storage. Add `hasHydrated` ref guard. [Effort: XS, Impact: Medium, promoted from BUGS 2026-03-24]
- [ ] **🐛 Fix transaction filter debounce** — `onChange` handler returns cleanup function but React event handlers ignore it. Timeouts never cleared, causing multiple rapid router pushes. [Effort: XS, Impact: Medium, promoted from BUGS 2026-03-24]
- [ ] **Weekly email digest** — Opt-in summary of weekly spending, top categories, anomalies
- [ ] **FinHealth Score** — Composite 0-100 score (Spend 30%, Save 30%, Borrow 20%, Plan 20%)
- [ ] **Subscription detection** — Algorithm to detect recurring transactions (same description, amount, periodicity)

## Low Priority

- [ ] **Gamification layer** — Streaks (no-spend days), badges, progress rewards
- [ ] **Open Finance integration** — Belvo/Prometeo API for automatic bank sync
- [ ] **Multi-currency support (full)** — Exchange rates, USD accounts for nomads (basic import support shipped, full support TBD)
- [ ] **NLP expense entry** — "Taxi 20000" → Amount=20000, Category=Transport, Date=Today

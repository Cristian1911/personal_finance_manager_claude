# Zeta — Current Tasks

## Completed

- [x] **Dashboard redesign** — PR #32 merged
- [x] **Code review fixes** — PR #33 merged
- [x] **Security audit** — PR #34 merged (user_id filters across 10 action files)
- [x] **Auth dedup** — PR #35 merged (getAuthenticatedClient + React cache)
- [x] **Category budgets** — PR #36 merged (8 ADHD-friendly categories, budget dashboard, summary bar, trends)
- [x] **Build fix** — Stale createClient calls from PR #35/#36 merge conflict

## In Progress

- [ ] **Category management polish** — `feat/category-budgets` branch: toggle active, flat picker, cleanup (ready for PR)

## High Priority

- [ ] **Onboarding wizard** — New users see empty dashboard. Need "Create account → Import first statement" flow with checklist
- [ ] **Transaction search** — Full-text search by description/merchant, arbitrary date range, amount filters
- [ ] **Proactive notifications system** — Rule-based alerts: spending spikes, payment due dates, savings rate drops

## Medium Priority

- [ ] **Weekly email digest** — Opt-in summary of weekly spending, top categories, anomalies
- [ ] **Burn Rate + Runway metrics** — 3-month moving average, liquid assets / burn rate
- [ ] **FinHealth Score** — Composite 0-100 score (Spend 30%, Save 30%, Borrow 20%, Plan 20%)
- [ ] **Subscription detection** — Algorithm to detect recurring transactions (same description, amount, periodicity)
- [ ] **Mobile app redesign** — Approved design doc at `docs/plans/2026-03-07-mobile-redesign-design.md`

## Low Priority

- [ ] **Gamification layer** — Streaks (no-spend days), badges, progress rewards
- [ ] **Open Finance integration** — Belvo/Prometeo API for automatic bank sync
- [ ] **Multi-currency support** — Exchange rates, USD accounts for nomads
- [ ] **NLP expense entry** — "Taxi 20000" → Amount=20000, Category=Transport, Date=Today
- [ ] **Debt payoff simulator** — Snowball vs avalanche visualization with interactive timeline

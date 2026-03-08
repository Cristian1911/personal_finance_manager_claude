# Zeta — Current Tasks

## Completed (this session)

- [x] **Dashboard redesign** — PR #32 merged (Financial Command Center layout)
- [x] **Balance reconciliation** — PR #32 merged (ReconcileBalanceDialog + server action)
- [x] **Code review fixes** — PR #33 merged (budget pace, net worth calc, freshness, accents)
- [x] **Security audit** — PR #34 open (18 missing user_id filters fixed across 10 action files)
- [x] **E2E test PDF parsers** — Davivienda savings + Nequi savings parsers verified working
- [x] **Verify StatementSnapshot type** — Confirmed `remaining_balance` + `installments_in_default` present
- [x] **Git cleanup** — Merged PR #33, deleted stale branches (9 remote, 7 local)

## In Progress

- [ ] **Merge security PR #34** — Awaiting CI + merge

## High Priority

- [ ] **Category budgets** — `budgets` table exists. Need UI for setting monthly limits per category + wire BudgetPaceChart to real data
- [ ] **Onboarding wizard** — New users see empty dashboard. Need "Create account → Import first statement" flow with checklist
- [ ] **Transaction search** — Full-text search by description/merchant, arbitrary date range, amount filters
- [ ] **Proactive notifications system** — Rule-based alerts: spending spikes, payment due dates, savings rate drops. Needs `notifications` table + Supabase Edge Function cron

## Medium Priority

- [ ] **Weekly email digest** — Opt-in summary of weekly spending, top categories, anomalies
- [ ] **Burn Rate + Runway metrics** — Core PFM metrics. 3-month moving average, liquid assets / burn rate
- [ ] **FinHealth Score** — Composite 0-100 score (Spend 30%, Save 30%, Borrow 20%, Plan 20%)
- [ ] **Subscription detection** — Algorithm to detect recurring transactions (same description, amount, periodicity)
- [ ] **Mobile app redesign** — Approved design doc at `docs/plans/2026-03-07-mobile-redesign-design.md`

## Low Priority

- [ ] **Gamification layer** — Streaks (no-spend days), badges, progress rewards
- [ ] **Open Finance integration** — Belvo/Prometeo API for automatic bank sync
- [ ] **Multi-currency support** — Exchange rates, USD accounts for nomads
- [ ] **NLP expense entry** — "Taxi 20000" → Amount=20000, Category=Transport, Date=Today
- [ ] **Debt payoff simulator** — Snowball vs avalanche visualization with interactive timeline

# Zeta — Current Tasks

## In Progress

- [ ] **E2E test new PDF parsers** — Nu credit card + Lulo loan parsers built but untested via running service. Run `cd services/pdf_parser && uv run python main.py` then `curl -F file=@...`
- [ ] **Verify StatementSnapshot type** — Action's return type may not include new loan columns (`remaining_balance`, `installments_in_default`). Check select query and type export

## High Priority

- [ ] **Onboarding wizard** — New users see empty dashboard. Need "Create account → Import first statement" flow with checklist
- [ ] **Proactive notifications system** — Rule-based alerts: spending spikes, payment due dates, savings rate drops. Needs `notifications` table + Supabase Edge Function cron
- [ ] **Category budgets** — `budgets` table + UI for setting monthly limits per category. Skeleton exists in `InteractiveMetricCard`
- [ ] **Transaction search** — Full-text search by description/merchant, arbitrary date range, amount filters

## Medium Priority

- [ ] **Commit uncommitted changes** — 12 modified/deleted + 2 new files from last session (Nu + Lulo parsers, loan import flow)
- [ ] **Weekly email digest** — Opt-in summary of weekly spending, top categories, anomalies
- [ ] **Burn Rate + Runway metrics** — Core PFM metrics from system analysis doc. 3-month moving average, liquid assets / burn rate
- [ ] **FinHealth Score** — Composite 0-100 score (Spend 30%, Save 30%, Borrow 20%, Plan 20%)
- [ ] **Subscription detection** — Algorithm to detect recurring transactions (same description, amount, periodicity)

## Low Priority

- [ ] **Gamification layer** — Streaks (no-spend days), badges, progress rewards (research done in `dashboard_and_gamification.md`)
- [ ] **Open Finance integration** — Belvo/Prometeo API for automatic bank sync (replaces PDF import long-term)
- [ ] **Multi-currency support** — Exchange rates, USD accounts for nomads
- [ ] **NLP expense entry** — "Taxi 20000" → Amount=20000, Category=Transport, Date=Today
- [ ] **Debt payoff simulator** — Snowball vs avalanche visualization with interactive timeline

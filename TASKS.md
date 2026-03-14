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

- [ ] **Multi-currency validation** — Investigate how Zeta handles COP/USD: Do transactions store currency with amount? Is there a configurable base currency? Does debt/interest calc convert? What happens mixing currencies in totals/reports? Any exchange rate logic? (from Notion Ideas Inbox)
- [ ] **Recipient management with pattern detection** — Dedicated Recipients section: auto-detect patterns from Chilean imports (e.g. 'SUC0', 'SUCURSAL'), pending-to-name queue, and import-time review flow with collapsible groups per recipient. Recognized patterns auto-apply; new ones prompt for a readable name. (from Notion Ideas Inbox)
- [ ] **Sistema dual de presupuesto por categorías** — Presupuesto declarado vs. gasto real mapeado por categoría, con onboarding de categorías colombianas, arquetipos de gasto (fijo/variable acotado/variable incierto), motor de matching destinatarios→categorías, y bandeja de categorización agrupada por destinatario (Pareto 80%). [Effort: XL, Impact: High, promoted from IDEAS 2026-03-14]
- [ ] **Onboarding wizard** — New users see empty dashboard. Need "Create account → Import first statement" flow with checklist
- [ ] **Transaction search** — Full-text search by description/merchant, arbitrary date range, amount filters
- [ ] **Proactive notifications system** — Rule-based alerts: spending spikes, payment due dates, savings rate drops

- [ ] **Journey de inversión con nudge anti-deuda** — Sección de inversión que guía al usuario por un flujo psicológico: ¿cuánto planeas invertir? ¿a qué plazo? ¿qué rentabilidad esperas? Muestra opciones reales de inversión fácil en Colombia (Nu cajitas, Fido, Tyba, CDTs, etc.) con simulador de rendimientos estimados. Al final revela: "pero hay una mejor inversión — pagar tu deuda actual", comparando side-by-side los rendimientos de cualquier escenario de inversión vs. el ahorro por pagar deuda y ganar liquidez mes a mes. Conecta con el simulador de deudas existente (snowball/avalanche). [Effort: XL, Impact: High]

## Medium Priority

- [ ] **Debt payoff simulator (enhanced)** — Snowball vs avalanche con timeline interactivo + gráfica complementaria de barras mes a mes: cada barra muestra el salario total segmentado por porciones de color (una por cada deuda + porción libre). Visualiza cuánto del ingreso mensual se va a deuda y cuánto queda disponible, y cómo esa proporción mejora progresivamente al ir pagando. Impacto psicológico: el usuario ve que "lo que te queda libre es casi nada" hoy, y cómo crece mes a mes al ejecutar el plan de pago. Conecta con el Journey de inversión como punto de comparación. [Effort: L, Impact: High]
- [ ] **PDF parser expansion: Davivienda + BBVA Colombia** — Extend parser coverage to Colombia's other major banks. Pattern from Nu + Lulo builds is fresh. High impact for user acquisition. [Effort: M, Impact: High, promoted from IDEAS 2026-03-13]
- [ ] **Mobile FAB evolution** — Redesign the floating action button on mobile: expand into a cohesive, visually integrated component on tap with quick access to key actions (PDF import prominently). Current FAB feels small and disconnected. (from Notion Ideas Inbox)
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

# Feature Landscape: Personal Finance App UX Polish

**Domain:** Personal finance management (transactions, budgets, debt, import)
**Researched:** 2026-03-25
**Research mode:** Ecosystem — focused on UX polish patterns for a v2 pass

---

## Context: What Zeta Already Has

Before categorizing features, it is important to note what exists. This research evaluates what is missing or under-polished in the existing implementation, not what to build from scratch. Zeta already ships: dashboard with health widgets, 50/30/20 budget model, debt payoff planner, rule-based auto-categorization, PDF import wizard, multi-step onboarding, transaction management with filtering, and financial health scoring.

The question for this milestone is: **what UX patterns does Zeta need to tell a coherent story, not just display data?**

---

## Table Stakes

Features users expect. Missing or broken = product feels incomplete or amateurish.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Single-sentence dashboard status | Users should know "I'm on track this month" or "I've overspent on food" from a headline, not by reading charts | Low | Copy change + information hierarchy redesign. Already have data; need the narrative layer. |
| Income captured during onboarding | All downstream calculations (50/30/20 splits, health score, budget targets) are meaningless without an income baseline. Current state: income not captured, breaks health meters. | Low | One new onboarding step. High leverage change. |
| Onboarding completion gates actual dashboard | Dashboard preview must be real data (or a guided first-import prompt), not a grey placeholder. Grey box destroys trust before the user starts. | Medium | Requires conditional rendering: "complete setup" state vs. populated state. |
| Category color coding persisted and visible | Every reference apps (Monarch, Copilot, Monzo) uses color + icon per category as the primary visual anchor. Users recognize "Restaurantes = orange" faster than reading text. | Low | Categories likely have color fields; verify they render in transaction lists and charts consistently. |
| Budget progress bar with remaining amount | Users expect to see "COP 180,000 de 500,000 gastado — quedan 320,000" for each budget bucket. Progress bars are table stakes for any budget view. | Low | Likely partially implemented; needs visual consistency pass. |
| "Unreviewed transactions" review queue | Copilot built its entire UX around a light-blue "needs review" indicator on every unreviewed transaction. This pattern — auto-categorize, then surface exceptions for human confirmation — is now expected in premium apps. | Medium | The rule engine auto-categorizes; the UI needs a "pendiente de revisión" badge/count and a dedicated review flow. |
| Inline category editing on transaction row | Users expect to change a category without opening a detail view. Single tap on the category chip → dropdown → done. Copilot calls this "quick edit" and it is a differentiating UX detail that feels necessary once you've used it. | Low | Modal or popover on category tap. Saves navigation round-trip. |
| Empty states with call-to-action | Blank screens with no data should explain what to do next. Example: a budget screen with zero transactions should say "Importa tu estado de cuenta para ver tus gastos" with a button. Blank screens erode trust. | Low | One empty state component per major screen section. |
| Debt-free countdown date | Every dedicated debt payoff app (Debt Payoff Planner, DebtZero) surfaces the projected debt-free date as the #1 motivational element on the debt screen. "Libre de deudas en: 14 meses — Mar 2027" above the fold. | Low | Zeta has the payoff simulation; the date just needs to be promoted to a headline. |
| Consistent error handling (error.tsx, not-found.tsx) | Users who hit a broken route or server error see a blank or crash screen. Expected: a friendly error page with navigation back to safety. | Low | PROJECT.md confirms these are missing. |
| Friendly UX copy (tono amigable, sin culpa) | YNAB is the gold standard here. Finance apps that use guilt-inducing copy ("You overspent by $200!") see worse engagement than apps that use encouraging framing ("Ya completaste el 80% de tu presupuesto de comidas"). | Low | Copy audit pass across all status messages, budget alerts, and health score labels. No new code; pure writing pass. |

---

## Differentiators

Features that set the product apart. Not universally expected, but deliver outsized delight when done right.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Salud financiera" score as a single grade (A-D or 0-100) | Monarch and Copilot use composite scores that answer "Am I on track?" with a single number. Zeta has health widgets but no single synthesized grade. A score of 72/100 or "B+" with a one-line explanation ("Gastas menos de lo que ganas, pero tu fondo de emergencia está bajo") is more actionable than 5 separate meters. | Medium | Requires weighting algorithm across existing health dimensions. Medium because the UI is simple once the score formula is defined. |
| Dashboard narrative widget (insight of the day) | Monarch's AI forecasts and Copilot's insights section both surface 1-2 sentence contextual observations: "Este mes gastas 23% más en restaurantes que en enero." Zeta is no-AI (deterministic), so these should be rule-based: compare current month vs previous month per category, flag deviations above 20%. | Medium | Rule-based comparison logic is feasible deterministically. The widget is a simple card. |
| Monthly spending comparison bar (this month vs last month) | Monarch's spending trend widget shows month-over-month bars per category. The question "Am I spending more this month?" is answered visually in 2 seconds. | Low-Medium | Recharts bar chart with two bars per category. Data likely already available. |
| Debt payoff strategy comparison (side-by-side) | Zeta already has avalanche and snowball. Showing both strategies on the same screen ("Con avalancha, ahorras 2.3M COP en intereses vs. bola de nieve") turns a setting into an insight. | Medium | Requires running both simulations and rendering a comparison card. Feasible. |
| Category spending heatmap or spend-over-time calendar | Showing which days of the month spending spikes (e.g., weekends for restaurants) gives context no bar chart offers. Lunch Money and some Copilot reports use calendar heat maps. | High | Complex to render well. Mark as phase-specific research needed. Do not build in polish pass. |
| Financial health trend line (score over 3-6 months) | A rising health score line is the most motivating visual in any tracking app. "Tu salud subió de 61 a 78 en 3 meses." | Medium | Requires persisting score snapshots. Data storage trivial; rendering is a small line chart. |
| "Quedan X días para el próximo ingreso" countdown | For users who import transactions periodically, surfacing "faltan 8 días para tu próximo extracto esperado" helps frame current spending. Relevant for Colombian users who often have predictable paydays. | Low | Purely date arithmetic. Single line on dashboard. |
| Rule management screen (view / edit / delete auto-categorization rules) | Copilot's biggest UX complaint is that rules cannot be viewed or managed. Users must contact support to change a rule. Zeta already has a rule engine — exposing rule management as a screen is a **competitive differentiator** vs Copilot. | Medium | CRUD screen for rules. Rule schema is already in @zeta/shared. |
| Import session summary (what changed after import) | After import, showing "Se importaron 47 transacciones, 12 sin categoría, 3 duplicados ignorados" in a summary card closes the loop and builds trust. Zeta's import wizard has a Results step; this is a UX polish of that existing step. | Low | Enhancement to existing Results screen. |

---

## Anti-Features

Features to deliberately NOT build in a polish pass.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| AI-powered insights or predictions | User explicitly prefers deterministic, no-ML. Adds complexity, breaks the "I understand exactly why this says X" contract. Also: all AI categorization in competitor apps requires a training period before it is useful. | Rule-based insights with transparent logic |
| Push / email notifications | Zeta is single-user, no mobile notifications wired. Adding notifications is a feature, not polish. Distraction cost > benefit for a solo-user app. | Surface insights on next dashboard load |
| Gamification (badges, points, streaks for logging) | Finance is serious. Badge systems feel patronizing to a developer-power-user who set up this app themselves. YNAB avoids badges; Copilot avoids badges. The debt countdown IS motivational enough. | Progress bars and countdown dates |
| Social features or benchmarking against other users | Single-user app. No user base. Benchmarking is fake ("users like you spend X") without real data. | Month-over-month personal comparisons |
| Fully customizable dashboard (drag-to-reorder widgets) | Monarch offers this; it adds complexity and most users never use it. For a single-user app, an opinionated default layout is faster to ship and faster to use. | Opinionated fixed layout with good defaults |
| Onboarding tooltip tours / product walkthroughs | Tooltip overlays are consistently rated the most annoying onboarding pattern. They block the UI and users dismiss them immediately. | Empty states and contextual help text |
| Dark mode toggle as a polish-pass item | Dark mode is a feature, not a polish pass item. It doubles every color decision and adds significant test surface. | Ship the light theme well; dark mode is a separate milestone |
| Real-time sync / live bank feeds | Out of scope per PROJECT.md. Also: Colombian banks do not expose reliable open banking APIs. The import model is correct for the market. | Keep PDF import model |
| Overly complex animation system | framer-motion is already 62 imports in the codebase. Adding more animation in a polish pass contradicts the "speed is #1" user preference. | Fade-in only; no layout animations |

---

## Feature Dependencies

```
Income captured in onboarding
  → 50/30/20 budget targets can be auto-calculated
  → Health score "savings rate" dimension becomes meaningful
  → "Quedan X días para próximo ingreso" becomes calculable

Category color coding consistent
  → Transaction list feels scannable without reading text
  → Dashboard charts use same colors as transaction list (recognition)
  → Spending comparison widget is readable at a glance

"Unreviewed transactions" queue
  → Requires auto-categorization to have run (already done on import)
  → Feeds a "transactions needing attention" count on dashboard
  → Reduces noise in main transaction list (reviewed = settled, unreviewed = action needed)

Debt-free date headline
  → Requires at least one debt with balance, rate, and payment defined (already captured)
  → Requires payoff simulation to have run (already done)
  → No additional data dependencies — purely a UI promotion

Financial health single score
  → Requires income baseline (blocks on onboarding fix)
  → Requires at least 1 month of transaction data
  → Feeds dashboard headline narrative widget

Dashboard narrative widget (rule-based insights)
  → Requires 2+ months of transaction data for comparison
  → Requires category color system to be consistent for category references to be clear
```

---

## MVP Recommendation for Polish Pass

Prioritize these in order — each is small, high-leverage, and unblocks the next:

1. **Capture income in onboarding** — unblocks health score, 50/30/20 targets, and all downstream calculations. One new form step.

2. **Dashboard headline narrative** — single sentence at the top of the dashboard answering "Am I on track?" Requires income baseline (step 1). Can be rule-based ("Llevas el 68% de tu presupuesto gastado a mitad de mes").

3. **Friendly UX copy pass** — audit all status labels, budget messages, and health score descriptions. No code; pure copy. High impact, near-zero risk.

4. **Inline category quick-edit on transactions** — one of the most-used interactions. Category popover on tap. Removes 3 navigation steps per correction.

5. **Unreviewed transactions badge + review queue** — surfaces import noise without overwhelming the main transaction list. Users feel the app is "tidy" once this is in place.

6. **Debt-free date as headline** — promote the existing simulation result to a card hero element on the debt screen. One-line change with outsized motivational effect.

7. **Category color consistency audit** — ensure every reference to a category (transaction list, charts, budget bars) uses the same color. Audit pass, not a feature build.

8. **Empty states** — one per major screen (transactions, budget, debts, categories). Each needs a short description + primary CTA.

Defer for later milestones:
- **Spending calendar heatmap** — high complexity, medium value
- **Rule management screen** — medium complexity, high value but not blocking polish
- **Health score trend line** — requires score snapshot storage schema change
- **Dashboard customization** — anti-feature per above reasoning

---

## Sources

**Competitor Analysis:**
- Monarch Money dashboard and widget customization: [help.monarch.com](https://help.monarch.com/hc/en-us/articles/360058127551-Customizing-Your-Dashboard) — HIGH confidence (official docs)
- Copilot quick-edit and unreviewed transaction indicator: [help.copilot.money](https://help.copilot.money/en/articles/9554412-transactions-tab-overview) — HIGH confidence (official docs)
- YNAB Age of Money metric and onboarding flow: [support.ynab.com](https://support.ynab.com/en_us/age-of-money-H1ZS84W1s) — HIGH confidence (official docs)
- YNAB friendly UX copywriting philosophy: [goodux.appcues.com](https://goodux.appcues.com/blog/you-need-a-budget-ynab-s-friendly-ux-copywriting) — MEDIUM confidence (analysis article)
- Lunch Money transaction review workflow: [lunchmoney.app/features](https://lunchmoney.app/features) — HIGH confidence (official docs)
- Debt Payoff Planner "debt-free countdown" UX: [debtpayoffplanner.com/overview](https://www.debtpayoffplanner.com/overview/) — MEDIUM confidence (product page)

**UX Research:**
- Progressive disclosure in fintech onboarding: [eleken.co fintech UX best practices](https://www.eleken.co/blog-posts/fintech-ux-best-practices) — MEDIUM confidence (verified across multiple sources)
- Empty state best practices: [logrocket.com fintech UX](https://blog.logrocket.com/ux-design/great-examples-fintech-ux/) — MEDIUM confidence
- Anti-gamification rationale: [theuxda.com top 20 financial UX](https://theuxda.com/blog/top-20-financial-ux-dos-and-donts-to-boost-customer-experience) — MEDIUM confidence
- Color-coded categories (Monzo model): multiple sources consistent — MEDIUM confidence
- Copilot Apple Design Award Finalist 2024 (design quality signal): [moneywithkatie.com Copilot review](https://moneywithkatie.com/copilot-review-a-budgeting-app-that-finally-gets-it-right/) — MEDIUM confidence

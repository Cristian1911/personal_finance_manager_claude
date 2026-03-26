# Zeta Financial Health Strategy

> Comprehensive guide to personal finance best practices, gap analysis against Zeta's current state, and improvement roadmap — with deep dive on the Financial Health Score system.

---

## Part 1: The Gold Standard — Personal Finance Best Practices Map

### 1.1 Budget Practices

| Practice | Description | Adoption Level | Source Signal |
|---|---|---|---|
| **50/30/20 Rule** | 50% needs, 30% wants, 20% savings/debt | Most cited across all sources | @money_cruncher, @ArthurJoneslll, Penn SRFS |
| **Zero-Based Budgeting** | Every dollar assigned to a job, balance = $0 | Power-user favorite | r/personalfinance, YNAB methodology |
| **Pay-Yourself-First** | Treat savings as a non-negotiable bill, automate it | #1 behavioral tip | @eagleseyeinc (375 likes) |
| **60/30/10 Method** | 60% essentials, 30% discretionary, 10% savings | Simpler alternative for debt-heavy users | Finance Monthly, CNBC |
| **Envelope/Category Budgeting** | Hard caps per spending category | Best for overspenders | r/personalfinance, Actual Budget |
| **Anti-Budget** | Track only savings rate; spend the rest freely | For high-earners who hate tracking | Humphrey Yang (365K views) |

**Key insight**: The method matters less than consistency. The best budget is the one the user actually follows. Apps should support multiple approaches or default to the simplest (50/30/20) and let users graduate to zero-based.

### 1.2 Core Financial Metrics

#### Tier 1: The Essential Three (80% of the picture)

| Metric | Formula | Why It Matters |
|---|---|---|
| **Net Worth** | Total Assets - Total Liabilities | The single most comprehensive number. Direction matters more than magnitude. |
| **Savings Rate** | (Income - Expenses) / Income × 100 | The behavioral health indicator. Predicts long-term wealth accumulation. |
| **Debt-to-Income (DTI)** | Monthly Debt Payments / Gross Monthly Income × 100 | Measures debt manageability. Banks use it for lending decisions. |

#### Tier 2: Stability Indicators

| Metric | Formula | Why It Matters |
|---|---|---|
| **Emergency Fund Ratio** | Liquid Savings / Monthly Expenses | Months of runway without income. Shock absorption capacity. |
| **Credit Utilization** | Total CC Balances / Total Credit Limits × 100 | Impacts credit score and signals financial stress. |
| **Burn Rate** | Daily Average Spending (total or discretionary) | How fast cash is leaving. Runway projections. |
| **Cash Flow Trend** | 3-month rolling (Income - Expenses) direction | Is the user's situation improving or worsening? |

#### Tier 3: Growth & Planning

| Metric | Formula | Why It Matters |
|---|---|---|
| **Net Worth Growth Rate** | (Current NW - Previous NW) / Previous NW × 100 | Momentum indicator — compound growth visibility. |
| **Spending-to-Income Ratio** | Total Expenses / Total Income × 100 | Inverse of savings rate, more intuitive for some users. |
| **Payment Consistency** | % of recurring bills paid on time (3-month window) | Behavioral reliability score. |
| **Debt Payoff Velocity** | Monthly debt reduction / Total remaining debt | Time-to-freedom estimate. |
| **Income Stability** | Std deviation of monthly income / Mean income | Volatility indicator — critical for informal workers. |

### 1.3 Visualization Strategies

#### Chart Type Selection Guide

| Data Type | Best Chart | Why | Example |
|---|---|---|---|
| **Single score/KPI** | Gauge, progress ring, or large number | Immediate comprehension | Financial Health Score: 72/100 |
| **Trend over time** | Line chart or area chart | Shows direction clearly | Net worth over 12 months |
| **Budget vs actual** | Horizontal bar with target line | Easy comparison | Category spending vs budget |
| **Category breakdown** | Donut chart or treemap | Part-of-whole relationships | Spending by category |
| **Multiple dimensions** | Radar/polar chart | Compare health across pillars | Score breakdown (5 axes) |
| **Projections** | Dashed line extension | Distinguishes forecast from actual | Debt payoff timeline |
| **Comparison** | Side-by-side bars or small multiples | A vs B clarity | Snowball vs Avalanche |
| **Distribution** | Stacked bar or waterfall | Shows composition | Income allocation (salary bar) |

#### Dashboard Design Principles (from research)

1. **Hero metric at the top** — one number that answers "how am I doing?" (@uxbystefan, @sajon_co)
2. **Trend > snapshot** — always show direction, not just current state
3. **Actionable sections** — each card should suggest what to do, not just what happened
4. **Progressive disclosure** — summary first, drill-down on click
5. **Color semantics** — green=healthy, yellow=warning, red=critical (universal)
6. **Sparklines inside cards** — 3-12 month mini trends within metric cards
7. **Personalized ordering** — most relevant metrics first based on user's situation

### 1.4 Debt Payment Strategies

| Strategy | Method | Best For | Pros | Cons |
|---|---|---|---|---|
| **Avalanche** | Pay highest interest rate first | Math-optimizers, large rate differentials | Saves the most money on interest | Slower psychological wins |
| **Snowball** | Pay smallest balance first | Motivation-driven, many small debts | Quick wins build momentum | Pays more total interest |
| **Hybrid** | Pay off one small debt first, then switch to avalanche | Most people (2026 consensus) | Best of both worlds | Slightly more interest than pure avalanche |
| **Cascade** | When a debt is paid off, redirect its payment to the next | All strategies (enhancement) | Accelerating payoff speed | Requires discipline to not spend freed money |
| **Consolidation** | Combine debts into single lower-rate loan | High-rate scattered debts | Simplifies payments, may lower rate | Risk of running up new debt |
| **Power Payment** | Fixed total debt payment amount regardless of minimums | Steady, predictable payoff | Consistent budgeting | May not prioritize optimally |

**The 2026 consensus (per r/debtfree)**: Hybrid approach — one quick snowball win for dopamine, then switch to avalanche for the math. The cascade enhancement should be applied to any strategy (freed payments roll forward).

### 1.5 Minimum Data for Financial Health Understanding

#### Progressive Data Model (from IPA + FinHealth Network research)

| Level | Data Required | Computable Metrics | Confidence |
|---|---|---|---|
| **Level 0** | 1 bank account linked | Cash flow direction, basic burn rate | Very Low |
| **Level 1** | All accounts linked + 1 month of transactions | Spending by category, income estimate, burn rate, basic savings rate | Low |
| **Level 2** | 3+ months of transactions + recurring payments identified | Savings rate trend, payment consistency, cash flow trend, emergency fund ratio | Medium |
| **Level 3** | + Credit card statements (limits, rates) | Credit utilization, DTI estimate, debt trajectory, interest costs | Medium-High |
| **Level 4** | + User-provided: salary, savings goals | Full DTI, accurate savings rate, goal progress, complete health score | High |
| **Level 5** | + 12+ months history + investment accounts | Net worth trend, income stability, growth rate, seasonal patterns | Very High |

**Key finding from research**: Transaction data alone enables ~60% of financial health assessment. Adding account balances gets to ~80%. The remaining 20% requires user-reported data (goals, insurance, retirement).

---

## Part 2: Zeta Gap Analysis — Current State vs Ideal

### 2.1 What Zeta Already Does Well

| Area | Current Implementation | Maturity |
|---|---|---|
| **Burn Rate** | Daily average, runway projection, discretionary mode, trend detection | Excellent |
| **Debt Overview** | Credit utilization gauge, monthly interest estimate, insights, salary bar | Excellent |
| **Debt Planner** | Avalanche, Snowball, Cascade, scenario builder with timeline | Excellent |
| **Statement Snapshots** | Month-over-month diffs, credit limit/rate tracking, balance history | Very Good |
| **Budget Tracking** | Per-category budgets, 3-month trend comparison, progress bars | Very Good |
| **Multi-Currency** | 8 currencies, exchange rates, base currency conversion | Very Good |
| **Auto-Categorization** | Rules-based + destinatario matching + confidence scoring | Good |
| **Import Pipeline** | PDF parsing, idempotency, installment detection, rate sanitization | Good |
| **Dashboard Hero** | Available-to-spend, total balance, pending obligations | Good |
| **Recurring Payments** | Templates, timeline view, frequency support, upcoming obligations | Good |

### 2.2 Gap Analysis

#### GAP 1: No Financial Health Score (HIGH PRIORITY)
- **Current**: No composite score or overall health indicator
- **Ideal**: Hero metric (0-100) with pillar breakdown, trend, and actionable guidance
- **Impact**: Users can't answer "am I getting better or worse?" at a glance
- **Data readiness**: ~80% of needed data already exists in Zeta's data model

#### GAP 2: No Net Worth Tracking Over Time (HIGH PRIORITY)
- **Current**: Net worth computed on-the-fly on accounts page, not stored historically
- **Ideal**: Monthly net worth snapshots, 12-month trend chart, growth rate
- **Impact**: Missing the #1 most comprehensive financial metric's trend
- **Fix complexity**: Low — snapshot monthly from existing account balances

#### GAP 3: No Savings Rate Metric (HIGH PRIORITY)
- **Current**: Income estimation exists (`actions/income.ts`) but savings rate not computed or displayed
- **Ideal**: Monthly savings rate with trend, benchmark comparison
- **Impact**: Missing the #1 behavioral health indicator
- **Fix complexity**: Low — income - expenses / income, data already available

#### GAP 4: No DTI Ratio Display (MEDIUM PRIORITY)
- **Current**: All data exists (debt payments from recurring templates, income from estimation) but DTI not computed
- **Ideal**: DTI ratio with health threshold visualization (green/yellow/red)
- **Impact**: Missing a key stability indicator
- **Fix complexity**: Low — combine existing income + debt payment data

#### GAP 5: No Emergency Fund Ratio (MEDIUM PRIORITY)
- **Current**: Savings account balances tracked, monthly expenses trackable
- **Ideal**: Months-of-expenses saved, with target visualization (e.g., "2.3 of 3 months")
- **Impact**: Missing a key shock-absorption metric
- **Fix complexity**: Low-Medium — need to define "liquid savings" accounts and compute monthly expense average

#### GAP 6: No Income Stability/Volatility Metric (LOW PRIORITY)
- **Current**: Monthly income averages computed
- **Ideal**: Income stability score (std dev / mean), especially important for informal workers in Colombia
- **Impact**: Moderate — affects risk assessment for debt decisions
- **Fix complexity**: Low — statistical computation on existing data

#### GAP 7: No Payment Consistency Tracking (MEDIUM PRIORITY)
- **Current**: Recurring templates exist, but no tracking of whether payments were made on time
- **Ideal**: 3-month rolling on-time payment percentage
- **Impact**: Missing a behavioral reliability indicator
- **Fix complexity**: Medium — need to match recurring templates to actual transactions by date

#### GAP 8: No Goal System (LOW-MEDIUM PRIORITY)
- **Current**: No savings goals, debt payoff targets, or milestones
- **Ideal**: Named goals with target amounts, deadlines, progress visualization
- **Impact**: Missing motivational framework — people save more when they save for something specific
- **Fix complexity**: Medium — new table + UI

#### GAP 9: No Score/Metric History Storage (MEDIUM PRIORITY)
- **Current**: All metrics computed on-the-fly, nothing stored historically
- **Ideal**: Monthly metric snapshots for trend analysis
- **Impact**: Can't show improvement over time (the most motivating feature)
- **Fix complexity**: Medium — new table + monthly snapshot job

#### GAP 10: Limited Dashboard Insights (LOW PRIORITY)
- **Current**: Stale account warnings, basic debt insights
- **Ideal**: Personalized, contextual suggestions ("Your savings rate improved 3% this month", "You're spending 15% more on restaurants than your 3-month average")
- **Impact**: Users miss actionable context on their data
- **Fix complexity**: Medium-High — requires insight engine

---

## Part 3: The Financial Health Score — Deep Dive

### 3.1 Design Principles

Based on research across CFPB, FinHealth Network, IPA (tested in Colombia), OECD/INFE, and fintech implementations:

1. **Transaction-first**: Must work with just transaction data (progressive enhancement as more data arrives)
2. **Rolling window**: 3-month rolling calculations smooth fluctuations (per Beyond Budget pattern)
3. **Colombia-calibrated**: Thresholds adjusted for Colombian financial realities (lower savings norms, high informality, COP-denominated high-rate debt)
4. **Pillar-based**: Separate sub-scores that aggregate into one hero number (per FinHealth Network's 4-pillar model)
5. **Confidence-aware**: Show score confidence based on data completeness (Level 0-5)
6. **Motivational**: Score should be achievable — a user taking basic good-faith steps should be able to reach "healthy" territory

### 3.2 Scoring Model: "Puntaje de Salud Financiera"

#### Five Pillars

| Pillar | Weight | What It Measures | Zeta Data Source |
|---|---|---|---|
| **Control de Gastos** (Spending Control) | **30%** | Are you spending less than you earn? | Transactions (inflow vs outflow) |
| **Consistencia** (Payment Consistency) | **25%** | Are you paying bills on time? | Recurring templates vs actual transactions |
| **Colchon** (Safety Buffer) | **20%** | Can you absorb a financial shock? | Account balances (savings/checking) vs monthly expenses |
| **Uso de Credito** (Credit Usage) | **15%** | Are you using credit responsibly? | Statement snapshots (utilization) |
| **Trayectoria de Deuda** (Debt Trajectory) | **10%** | Is your debt going up or down? | Account balances over time |

**Why these weights?**
- **Spending Control (30%)** gets the highest weight because it's (a) computable from day one with just transactions, (b) the most actionable metric — users can change spending behavior immediately, and (c) the strongest predictor of financial trajectory per NBER research.
- **Payment Consistency (25%)** is the second-highest because behavioral reliability predicts financial outcomes better than any static metric (per FICO's 35% weighting of payment history). In Colombia, missed payments trigger punitive interest rates fast.
- **Safety Buffer (20%)** matters hugely for shock absorption but gets a lower weight because Colombian savings norms are lower — we don't want to penalize users unfairly. Also, many Colombians use cesantias (mandatory severance savings) which Zeta may not track.
- **Credit Usage (15%)** is important but only applies to users with credit products. Score should still work without it.
- **Debt Trajectory (10%)** is a trend metric that rewards improvement — even if total debt is high, a downward trend should contribute positively.

#### Pillar Computation Details

##### Pillar 1: Control de Gastos (Spending Control) — 30%

```
savings_rate = (total_income - total_expenses) / total_income × 100
```

Computed over a **3-month rolling window**. Uses Zeta's existing income estimation + transaction aggregation.

| Savings Rate | Score (0-100) | Label |
|---|---|---|
| >= 20% | 100 | Excelente |
| 15-19% | 85 | Muy bien |
| 10-14% | 70 | Bien |
| 5-9% | 50 | Aceptable |
| 1-4% | 30 | Bajo |
| 0% (breakeven) | 15 | Justo |
| Negative (deficit) | 0-10 (proportional) | Deficit |

**Colombia adjustment**: Global standard says 20% = excellent. In Colombia (8.6% national gross savings rate), 10% is already above average. The scoring curve should be generous in the 5-15% range to reward effort.

##### Pillar 2: Consistencia (Payment Consistency) — 25%

```
on_time_rate = payments_made_on_or_before_due / total_expected_payments × 100
```

Matches recurring templates (with due dates) against actual transactions within a ±3 day window. 3-month rolling.

| On-Time Rate | Score (0-100) | Label |
|---|---|---|
| >= 98% | 100 | Impecable |
| 95-97% | 85 | Muy bien |
| 90-94% | 70 | Bien |
| 80-89% | 50 | Aceptable |
| 60-79% | 25 | Necesita mejora |
| < 60% | 0-15 | Critico |

**If no recurring payments are tracked**: This pillar gets weight redistributed proportionally to the other 4 pillars (so Spending Control would become ~37.5%, etc.).

##### Pillar 3: Colchon (Safety Buffer) — 20%

```
buffer_months = total_liquid_savings / average_monthly_expenses
```

"Liquid savings" = accounts of type SAVINGS + CHECKING (excluding accounts marked as not dashboard-visible). Average monthly expenses over 3 months.

| Buffer Months | Score (0-100) | Label |
|---|---|---|
| >= 6 months | 100 | Blindado |
| 4-5 months | 85 | Muy seguro |
| 3 months | 70 | Seguro |
| 2 months | 50 | Aceptable |
| 1 month | 30 | Bajo |
| < 1 month | 0-20 (proportional) | Vulnerable |

**Colombia adjustment**: US standard is 6 months. For Colombia, 3 months = "Seguro" (70 points) is intentionally generous. Most Colombians have less than 1 month of buffer — reaching 2 months is a genuine accomplishment.

##### Pillar 4: Uso de Credito (Credit Usage) — 15%

```
utilization = total_credit_card_balances / total_credit_limits × 100
```

Uses Zeta's existing credit utilization calculation from statement snapshots / account data.

| Utilization | Score (0-100) | Label |
|---|---|---|
| 1-10% | 100 | Optimo |
| 11-30% | 85 | Muy bien |
| 31-50% | 55 | Moderado |
| 51-70% | 30 | Elevado |
| 71-90% | 15 | Alto |
| > 90% | 0-5 | Critico |
| 0% (no usage) | 90 | Bien (slightly less than optimal) |

**If no credit cards**: Pillar weight redistributed to others.

##### Pillar 5: Trayectoria de Deuda (Debt Trajectory) — 10%

```
debt_change = (total_debt_3mo_ago - total_debt_now) / total_debt_3mo_ago × 100
```

Measures direction and velocity of debt change over 3 months.

| Debt Change | Score (0-100) | Label |
|---|---|---|
| Decreasing > 5% | 100 | Eliminando deuda |
| Decreasing 1-5% | 80 | En buen camino |
| Stable (±1%) | 50 | Estable |
| Increasing 1-5% | 25 | Creciendo |
| Increasing > 5% | 0-10 | Alerta |
| No debt | 100 | Libre de deuda |

#### Composite Score Calculation

```
raw_score = (spending_score × 0.30) + (consistency_score × 0.25)
          + (buffer_score × 0.20) + (credit_score × 0.15)
          + (debt_trajectory_score × 0.10)

// If a pillar is not computable (no data), redistribute its weight proportionally
// Example: no credit cards → 0.15 weight split across other 4 pillars

final_score = round(raw_score)
```

#### Score Tiers

| Range | Tier | Color | Spanish Label | Emoji |
|---|---|---|---|---|
| 80-100 | Excellent | Green (#22c55e) | Saludable | Shield |
| 60-79 | Good | Blue (#3b82f6) | En progreso | Upward trend |
| 40-59 | Fair | Yellow (#eab308) | Necesita atencion | Warning |
| 20-39 | Poor | Orange (#f97316) | En riesgo | Alert |
| 0-19 | Critical | Red (#ef4444) | Critico | Emergency |

### 3.3 Data Confidence System

| Confidence Level | Requirements Met | Display |
|---|---|---|
| **5 stars** | 12+ months data, all account types, recurring payments tracked, income verified | "Puntaje completo" |
| **4 stars** | 3+ months data, savings + checking + credit linked | "Puntaje confiable" |
| **3 stars** | 3+ months data, at least 2 account types | "Puntaje estimado" |
| **2 stars** | 1-3 months data, 1+ accounts | "Puntaje parcial" |
| **1 star** | < 1 month data or single account | "Puntaje preliminar" |

Display as: `72/100 ★★★★☆ Puntaje confiable`

When confidence is low, show a prompt: *"Agrega tus cuentas de ahorro para mejorar la precision de tu puntaje"* — this drives data completeness while being honest about limitations.

### 3.4 Score Visualization Design

#### Hero Component (Dashboard Top)

```
┌─────────────────────────────────────────────────┐
│                                                   │
│        ┌──────────┐                               │
│        │          │   72                          │
│        │  GAUGE   │   ── Saludable                │
│        │          │   +5 vs mes pasado            │
│        └──────────┘   ★★★★☆                       │
│                                                   │
│   ▰▰▰▰▰▰▰▰▰▰▰▰▰▰▱▱▱▱▱▱  Gastos     85/100     │
│   ▰▰▰▰▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱  Pagos      65/100     │
│   ▰▰▰▰▰▰▰▰▰▰▰▰▰▰▱▱▱▱▱▱  Colchon    70/100     │
│   ▰▰▰▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱  Credito    55/100     │
│   ▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▱▱▱▱  Deuda      80/100     │
│                                                   │
│   ────── 6-month sparkline ──────                 │
│                                                   │
└─────────────────────────────────────────────────┘
```

#### Detail View (Expandable or Separate Page)

- **Radar chart** showing all 5 pillars (polygonal shape reveals strengths/weaknesses at a glance)
- **Per-pillar card** with:
  - Current score + trend arrow
  - Key metric value (e.g., "Tasa de ahorro: 12%")
  - 6-month mini sparkline
  - One actionable suggestion
- **Score history** line chart (monthly dots, 12-month view)
- **What-if simulator**: "Si reduces gastos en restaurantes un 20%, tu puntaje subiria a ~78"

### 3.5 Storage Schema

```sql
-- Monthly financial health snapshots
CREATE TABLE financial_health_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Period
    snapshot_month DATE NOT NULL,  -- first day of month (2026-03-01)

    -- Composite score
    overall_score SMALLINT NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
    confidence_level SMALLINT NOT NULL CHECK (confidence_level BETWEEN 1 AND 5),
    tier TEXT NOT NULL,  -- 'saludable', 'en_progreso', 'necesita_atencion', 'en_riesgo', 'critico'

    -- Pillar scores
    spending_control_score SMALLINT CHECK (spending_control_score BETWEEN 0 AND 100),
    payment_consistency_score SMALLINT CHECK (payment_consistency_score BETWEEN 0 AND 100),
    safety_buffer_score SMALLINT CHECK (safety_buffer_score BETWEEN 0 AND 100),
    credit_usage_score SMALLINT CHECK (credit_usage_score BETWEEN 0 AND 100),
    debt_trajectory_score SMALLINT CHECK (debt_trajectory_score BETWEEN 0 AND 100),

    -- Raw metric values (for debugging / display)
    savings_rate NUMERIC(5,2),         -- percentage
    on_time_payment_rate NUMERIC(5,2), -- percentage
    buffer_months NUMERIC(4,1),        -- months of expenses
    credit_utilization NUMERIC(5,2),   -- percentage
    debt_change_rate NUMERIC(5,2),     -- percentage (negative = decreasing)

    -- Supporting data
    total_income NUMERIC(15,2),
    total_expenses NUMERIC(15,2),
    total_liquid_savings NUMERIC(15,2),
    total_debt NUMERIC(15,2),
    net_worth NUMERIC(15,2),
    currency_code TEXT NOT NULL DEFAULT 'COP',

    -- Pillar weights used (may vary if pillars skipped)
    weights_used JSONB NOT NULL DEFAULT '{"spending":0.30,"consistency":0.25,"buffer":0.20,"credit":0.15,"debt":0.10}',

    -- Metadata
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, snapshot_month)
);

-- RLS
ALTER TABLE financial_health_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own snapshots" ON financial_health_snapshots
    FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can insert own snapshots" ON financial_health_snapshots
    FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- Index for time-series queries
CREATE INDEX idx_fhs_user_month ON financial_health_snapshots(user_id, snapshot_month DESC);
```

### 3.6 Computation Architecture

```
┌───────────────────────────────────────────────────┐
│                  Score Engine                       │
│         packages/shared/health-score.ts             │
│                                                     │
│  computeHealthScore(input: HealthScoreInput)        │
│    → HealthScoreResult                              │
│                                                     │
│  Input:                                             │
│    - transactions (3-month window)                  │
│    - account balances (current)                     │
│    - credit limits (current)                        │
│    - recurring templates                            │
│    - profile (salary, currency)                     │
│                                                     │
│  Output:                                            │
│    - overallScore: number                           │
│    - confidence: 1-5                                │
│    - pillars: { name, score, rawValue, label }[]    │
│    - tier: string                                   │
│    - weightsUsed: Record<string, number>            │
│    - suggestions: string[]                          │
│                                                     │
│  Pure function — no DB calls, no side effects       │
│  Testable, reusable across web + mobile             │
└───────────────────────────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────┐
│              Server Action                          │
│       actions/health-score.ts                       │
│                                                     │
│  getHealthScore()                                   │
│    1. Fetch transactions (3 months)                 │
│    2. Fetch account balances                        │
│    3. Fetch recurring templates                     │
│    4. Fetch profile                                 │
│    5. Call computeHealthScore()                     │
│    6. Optionally store snapshot (if new month)      │
│    7. Return result + historical trend              │
│                                                     │
│  Cached with tag: "health-score"                    │
│  Revalidated on: transaction import, account edit   │
└───────────────────────────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────┐
│            UI Components                            │
│                                                     │
│  HealthScoreHero — gauge + score + tier + delta     │
│  HealthScorePillars — 5 horizontal bars             │
│  HealthScoreRadar — radar chart (detail view)       │
│  HealthScoreHistory — sparkline / line chart        │
│  HealthScoreSuggestions — actionable tips            │
│  HealthScoreConfidence — star rating + prompt        │
└───────────────────────────────────────────────────┘
```

---

## Part 4: Improvement Roadmap

### Phase 1: Foundation Metrics (Weeks 1-2)

**Goal**: Compute and display the core metrics that feed the health score, without the score itself yet.

#### 1A. Net Worth History

- **What**: Store monthly net worth snapshots; display 12-month trend chart on accounts page
- **Schema change**: Add `net_worth_snapshots` table (user_id, month, amount, currency, breakdown JSONB)
- **Trigger**: Compute on first dashboard load of each month, or on account balance change
- **UI**: Line chart on accounts page header, replacing the static number
- **Effort**: Small

#### 1B. Savings Rate

- **What**: Monthly savings rate = (income - expenses) / income
- **Data**: Already have income estimation + transaction aggregation
- **UI**: New metric card on dashboard with sparkline trend
- **Effort**: Small

#### 1C. DTI Ratio

- **What**: Monthly debt payments / estimated monthly income
- **Data**: Sum of recurring outflows tagged as debt + monthly_payment from debt accounts / income estimate
- **UI**: Gauge or progress bar with green/yellow/red thresholds
- **Effort**: Small

#### 1D. Emergency Fund Ratio

- **What**: Liquid savings / average monthly expenses = months of buffer
- **Data**: Sum of SAVINGS + CHECKING balances / 3-month expense average
- **UI**: Progress bar toward 3-month target
- **Effort**: Small

### Phase 2: Health Score MVP (Weeks 3-4)

**Goal**: Launch the composite Financial Health Score with all 5 pillars.

#### 2A. Score Engine

- **What**: `packages/shared/health-score.ts` — pure function implementing the 5-pillar model
- **Tests**: Comprehensive unit tests with edge cases (no credit cards, no recurring, new user with 1 month of data, etc.)
- **Effort**: Medium

#### 2B. Payment Consistency Detection

- **What**: Match recurring templates to actual transactions within ±3 day window
- **Logic**: For each recurring template occurrence in the 3-month window, check if a matching transaction exists (same account, similar amount ±5%, within date window)
- **Effort**: Medium (this is the most complex new computation)

#### 2C. Score Storage

- **What**: `financial_health_snapshots` table + migration
- **Trigger**: Compute and store on first dashboard visit of each new month
- **Effort**: Small

#### 2D. Dashboard Integration

- **What**: HealthScoreHero component replaces or augments the current dashboard hero
- **Placement**: Top of dashboard, above "Tu dinero ahora"
- **Progressive**: If confidence < 3 stars, show as secondary card with CTA to add more data
- **Effort**: Medium

### Phase 3: Score Enhancement (Weeks 5-6)

**Goal**: Make the score actionable and historical.

#### 3A. Per-Pillar Detail View

- **What**: Expandable cards or dedicated page showing each pillar's breakdown
- **Includes**: Raw metric value, threshold visualization, 6-month trend, one suggestion
- **Effort**: Medium

#### 3B. Radar Chart

- **What**: 5-axis radar chart showing pillar balance (strengths vs weaknesses at a glance)
- **Library**: Recharts (already used in Zeta for other charts)
- **Effort**: Small

#### 3C. Score History Timeline

- **What**: Monthly score dots with line chart, clickable for month detail
- **Data**: From `financial_health_snapshots` table
- **Effort**: Small-Medium

#### 3D. Contextual Suggestions Engine

- **What**: Based on lowest-scoring pillar, generate 1-3 actionable suggestions in Spanish
- **Examples**:
  - Low spending control: "Este mes gastaste 15% mas en restaurantes. Reducir ahi subiria tu puntaje ~5 puntos."
  - Low buffer: "Tienes 1.2 meses de colchon. Con $200K/mes adicionales llegarias a 3 meses en 8 meses."
  - Low consistency: "Tienes 2 pagos vencidos este mes. Configurar debito automatico mejora este indicador."
- **Effort**: Medium

### Phase 4: Advanced Features (Weeks 7+)

#### 4A. What-If Simulator

- **What**: Slider-based UI: "If I save X more per month" / "If I pay off Y debt" → score projection
- **Reuses**: Existing scenario engine from debt planner
- **Effort**: Medium-High

#### 4B. Peer Comparison (Optional)

- **What**: Anonymous percentile rank ("Tu puntaje es mejor que el 65% de usuarios de Zeta")
- **Requires**: Aggregate statistics across user base (privacy-safe)
- **Effort**: High (privacy + statistical infrastructure)

#### 4C. Goal System

- **What**: Named savings goals (emergency fund, vacation, down payment) with target + deadline + progress
- **Schema**: New `goals` table
- **Links to**: Safety Buffer pillar (goal progress feeds into buffer assessment)
- **Effort**: Medium-High

#### 4D. Anomaly Detection

- **What**: Flag unusual spending patterns ("Gastaste 3x mas de lo normal en entretenimiento esta semana")
- **Logic**: Statistical deviation from 3-month category averages
- **Effort**: Medium

---

## Part 5: Implementation Priority Matrix

| Feature | User Impact | Effort | Data Ready? | Priority |
|---|---|---|---|---|
| Savings Rate metric | High | Small | Yes | P0 |
| Net Worth history | High | Small | Yes | P0 |
| DTI Ratio display | Medium | Small | Yes | P0 |
| Emergency Fund Ratio | Medium | Small | Yes | P0 |
| Health Score engine | Very High | Medium | Mostly | P1 |
| Payment Consistency detection | High | Medium | Partial | P1 |
| Score storage + history | High | Small | N/A (new) | P1 |
| Dashboard hero integration | Very High | Medium | After P1 | P1 |
| Per-pillar detail cards | Medium | Medium | After P1 | P2 |
| Radar chart | Medium | Small | After P1 | P2 |
| Contextual suggestions | High | Medium | After P1 | P2 |
| Score history timeline | Medium | Small | After P1 | P2 |
| What-if simulator | Medium | Medium-High | After P2 | P3 |
| Goal system | Medium | Medium-High | N/A (new) | P3 |
| Anomaly detection | Medium | Medium | After P1 | P3 |
| Peer comparison | Low | High | After P1 | P4 |

---

## Appendix A: Colombian Financial Context

Thresholds in this document are calibrated for Colombian users based on:

- **National gross savings rate**: 8.6% (vs ~15-20% in advanced economies)
- **Financial inclusion**: 94.6% have a financial product, but only 35.3% have credit
- **Informal economy**: ~50% of workforce, irregular income patterns
- **Usura rate**: Legally capped maximum interest rate (relevant for debt health assessment)
- **Cesantias**: Mandatory severance savings — a forced savings vehicle unique to Colombia, equivalent to ~1 month salary/year
- **Digital wallets**: 27.5M adults use them — growing channel for financial data

**Key calibration decisions**:
1. Savings rate thresholds shifted down (10% = "Bien" instead of "Warning")
2. Emergency fund: 3 months = "Seguro" (not just "Good")
3. Income stability metric included to account for informal/variable income
4. Score works with incomplete data (confidence system prevents misleading precision)

## Appendix B: Score Formula Quick Reference

```typescript
type PillarWeight = {
  spending: 0.30,
  consistency: 0.25,
  buffer: 0.20,
  credit: 0.15,
  debt: 0.10,
}

// If a pillar has no data, redistribute its weight:
function adjustWeights(available: string[]): Record<string, number> {
  const base = { spending: 0.30, consistency: 0.25, buffer: 0.20, credit: 0.15, debt: 0.10 }
  const missing = Object.keys(base).filter(k => !available.includes(k))
  const missingWeight = missing.reduce((sum, k) => sum + base[k], 0)
  const availableWeight = 1 - missingWeight

  const adjusted: Record<string, number> = {}
  for (const k of available) {
    adjusted[k] = base[k] / availableWeight  // proportional redistribution
  }
  return adjusted
}

// Score tiers
function getTier(score: number): string {
  if (score >= 80) return 'saludable'
  if (score >= 60) return 'en_progreso'
  if (score >= 40) return 'necesita_atencion'
  if (score >= 20) return 'en_riesgo'
  return 'critico'
}
```

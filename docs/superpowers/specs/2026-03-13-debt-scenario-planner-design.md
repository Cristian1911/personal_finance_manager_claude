# Debt Scenario Planner

**Date:** 2026-03-13
**Status:** Draft
**Replaces:** Current 3-tab simulator (`/deudas/simulador`)

## Problem

The current debt simulator is a calculator, not a planning tool. It answers "what if I pay X extra?" but can't model the real decisions users face: "I have 2M COP arriving in April and 1.5M in May — should I wipe out Card X first, or split it across two loans to free up cash flow faster?" Users need to build time-sequenced plans, compare alternatives side-by-side, control where freed payments cascade, and save plans for future reference.

Additionally, interest calculations use nominal `rate / 12` instead of the correct Colombian EA (Efectivo Anual) compound conversion, systematically understating interest costs.

## Goals

1. Replace the current simulator with a wizard-style **Scenario Planner**
2. Support defining **future cash injections** with dates (one-time or recurring)
3. Enable **full scenario comparison** — build 2-3 plans and compare total cost, timeline, and payoff order
4. Give the user **interactive cascade control** — when a debt is paid off, decide where the freed payment goes
5. Visualize the month-by-month timeline with **cascade events** highlighted
6. **Persist scenarios** to the database (optional — user can explore without saving)
7. Fix interest to use **EA compound conversion**
8. Desktop-first; mobile is a follow-up iteration

## Non-Goals

- Integrating with banking APIs for live balance updates
- Automated payment scheduling or reminders
- Multi-currency scenario comparison (accounts in different currencies are simulated independently)
- Replacing the debt dashboard (`/deudas`) — it remains the overview; the planner is the workshop

---

## Architecture

### Wizard Steps

The planner is a 4-step wizard rendered as freely navigable tabs (not a locked linear flow). The user can jump between steps at any time. Each step's output feeds the next.

#### Step 1 — "Tu efectivo" (Your Cash)

**Purpose:** Define the extra money available for debt payments over time.

**Inputs:**
- A list of `CashEntry` items, each with:
  - `amount: number` — the extra cash available
  - `month: string` — target month in `YYYY-MM` format (e.g., "2026-04")
  - `label?: string` — optional human label ("Prima", "Freelance", "Bono")
  - `currency: CurrencyCode` — defaults to user's preferred currency
  - `recurring?: { months: number }` — if set, repeats for N months starting from `month`
- Quick-add shortcut: "X amount every month for N months" auto-generates entries

**Context panel (sidebar or top section):**
- Current debt summary: total debt, account list with balances and rates
- This gives the user context for deciding how much to allocate

**Validation:**
- At least one cash entry required to proceed
- Amount must be > 0
- Month must be current month or future

**Output:** `CashEntry[]` — feeds into Step 2.

#### Step 2 — "Asignar pagos" (Allocate Payments)

**Purpose:** Decide where each cash injection goes and control cascade behavior.

**Modes:**
1. **Auto-allocate** (default): User picks a strategy (snowball, avalanche, or custom priority order). The engine distributes each cash entry optimally according to the strategy.
2. **Manual override**: User can override any specific month's allocation — e.g., "In April, put all 2M on Card X regardless of what the strategy says."

**Cascade control:**
- When an account reaches zero balance, its freed minimum payment must go somewhere
- Default: follows the selected strategy (snowball → next lowest balance, avalanche → next highest rate)
- Override: user can pin cascade redirects — "When Card X is paid off, send its freed 150K to Loan Y specifically"
- Cascade overrides are shown as visual links between accounts

**Visualization:**
- Horizontal timeline bar per account showing projected balance trajectory
- Cascade events marked with connector arrows between accounts
- Cash injection events marked on the timeline

**Output:** `ScenarioAllocation` — the fully resolved plan of who gets paid what, when.

#### Step 3 — "Comparar" (Compare)

**Purpose:** Side-by-side scenario comparison.

**Flow:**
1. The scenario from Step 2 becomes "Plan A"
2. User can create "Plan B" (and optionally "Plan C") by duplicating Plan A and modifying inputs — different strategy, different manual overrides, different cascade redirects
3. Up to 3 scenarios can be compared simultaneously

**Comparison view:**
- Summary table with columns per scenario:
  - Total months to debt-free
  - Total interest paid
  - Total amount paid (principal + interest)
  - Payoff order (which account gets paid off first, second, etc.)
- Overlay chart: all scenarios' total-debt-over-time on one graph (different colors, one dashed for baseline)
- Delta callout: "Plan A saves X vs Plan B in interest and Y months"
- Winner badge on the recommended scenario

**Baseline:** Always includes a "solo mínimo" baseline (no extra payments) for reference.

#### Step 4 — "Detalle" (Detail)

**Purpose:** Deep-dive into any single scenario's month-by-month breakdown.

**Scenario selector:** Dropdown or tabs to switch between scenarios from Step 3.

**Month-by-month table:**
- Each row = one month
- Columns: month label (e.g., "Abr 2026"), then for each account: payment applied, interest accrued, new balance
- **Cascade events** highlighted inline with a visual indicator: "Tarjeta X liquidada → $150K liberados → redirigidos a Préstamo Y"
- Cash injection months highlighted with the source label

**Per-account chart:**
- Selectable area chart showing one account's balance over time
- Overlays the payment amounts as bars on the same chart

**Summary cards:**
- Total interest paid
- Total months
- Total amount paid
- Payoff order with projected dates (not just month numbers — actual calendar months)
- Interest saved vs baseline

---

## Data Model

### New table: `debt_scenarios`

```sql
create table debt_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,  -- null = unsaved draft state; set when user explicitly saves

  -- Inputs
  cash_entries jsonb not null,        -- CashEntry[]
  strategy text not null default 'avalanche',  -- 'snowball' | 'avalanche' | 'custom'
  allocations jsonb not null default '{}',     -- manual overrides & cascade redirects

  -- Frozen account state at creation time
  snapshot_accounts jsonb not null,   -- DebtAccount[] snapshot so plan stays valid

  -- Computed results (cached to avoid recalculation on every view)
  results jsonb,                      -- ScenarioResult (timeline, totals, payoff order)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint debt_scenarios_user_id_fkey foreign key (user_id) references auth.users(id)
);

-- RLS
alter table debt_scenarios enable row level security;
create policy "Users manage own scenarios"
  on debt_scenarios for all
  using ((select auth.uid()) = user_id);

-- Index for listing user's scenarios
create index idx_debt_scenarios_user on debt_scenarios(user_id, updated_at desc);
```

### JSONB Structures

**`cash_entries`** — `CashEntry[]`:
```typescript
interface CashEntry {
  id: string;              // client-generated UUID for UI keying
  amount: number;
  month: string;           // "YYYY-MM"
  label?: string;
  currency: CurrencyCode;
  recurring?: { months: number };
}
```

**`allocations`** — `ScenarioAllocations`:
```typescript
interface ScenarioAllocations {
  // Manual overrides: for a specific month, direct a cash entry to a specific account
  manualOverrides: {
    month: string;           // "YYYY-MM"
    cashEntryId: string;     // which cash entry
    accountId: string;       // target account
    amount: number;          // how much (may be partial)
  }[];

  // Cascade redirects: when an account is paid off, where does its freed payment go?
  cascadeRedirects: {
    fromAccountId: string;   // the account being paid off
    toAccountId: string;     // where to redirect its freed minimum payment
  }[];

  // Custom priority order (only used when strategy = 'custom')
  customPriority?: string[]; // account IDs in priority order
}
```

**`snapshot_accounts`** — `DebtAccount[]`:
Same shape as the existing `DebtAccount` interface from `@zeta/shared`. Frozen at scenario creation so the plan remains valid even if live account balances change.

**`results`** — `ScenarioResult`:
```typescript
interface ScenarioResult {
  totalMonths: number;
  totalInterestPaid: number;
  totalAmountPaid: number;
  debtFreeDate: string;     // "YYYY-MM" projected date
  payoffOrder: {
    accountId: string;
    accountName: string;
    month: number;           // month number (1-indexed)
    calendarMonth: string;   // "YYYY-MM" actual calendar month
  }[];
  timeline: ScenarioMonth[];
}

interface ScenarioMonth {
  month: number;
  calendarMonth: string;    // "YYYY-MM"
  totalBalance: number;
  cumulativeInterest: number;

  // Per-account detail for this month
  accounts: {
    accountId: string;
    balanceBefore: number;
    interestAccrued: number;
    minimumPaymentApplied: number;
    extraPaymentApplied: number;
    cascadePaymentApplied: number;  // from freed minimums
    balanceAfter: number;
    paidOff: boolean;
  }[];

  // Events that happened this month
  events: ScenarioEvent[];
}

interface ScenarioEvent {
  type: 'cash_injection' | 'account_paid_off' | 'cascade_redirect';
  description: string;       // human-readable, in Spanish
  accountId?: string;
  amount?: number;
  // For cascade_redirect:
  fromAccountId?: string;
  toAccountId?: string;
  freedAmount?: number;
}
```

---

## Calculation Engine

All calculation logic lives in `packages/shared/src/utils/debt-simulator.ts`. The existing functions (`runSimulation`, `compareStrategies`, `allocateLumpSum`, `simulateSingleAccount`) remain available but are no longer used by the simulator UI. The new planner uses `runScenario()`.

### Interest Rate Fix

Replace all instances of `(balance * rate / 100) / 12` with the correct EA compound conversion:

```typescript
/**
 * Convert an annual effective rate (EA) to a monthly effective rate.
 * Colombian banks quote rates as EA (Efectivo Anual).
 * Formula: monthly = (1 + EA/100)^(1/12) - 1
 */
export function monthlyRateFromEA(eaPercent: number): number {
  return Math.pow(1 + eaPercent / 100, 1 / 12) - 1;
}

// Usage in simulation loop:
// OLD: const interest = (balance * (rate / 100)) / 12;
// NEW: const interest = balance * monthlyRateFromEA(rate);
```

This fix applies to:
- `runSimulation()` (line 95)
- `simulateSingleAccount()` inner `simulate()` (line 279)
- `allocateLumpSum()` interest calculations (lines 203, 224)
- `estimateMonthlyInterest()` in `debt.ts` (line 219)

### New Function: `runScenario()`

```typescript
interface ScenarioInput {
  accounts: DebtAccount[];
  cashEntries: CashEntry[];
  strategy: PayoffStrategy | 'custom';
  allocations: ScenarioAllocations;
  startMonth: string;         // "YYYY-MM" — typically current month
}

function runScenario(input: ScenarioInput): ScenarioResult
```

**Algorithm (per-month loop, max 360 months):**

1. **Determine calendar month** from `startMonth` + month offset
2. **Accrue interest** on each active account using `monthlyRateFromEA()`
3. **Pay minimums** on each active account (capped at balance). Track freed minimums when accounts reach zero.
4. **Apply cash entries** for this calendar month:
   - Check `manualOverrides` first — if the user pinned a cash entry to a specific account, honor it
   - Remaining unallocated cash goes to the priority account per strategy
5. **Apply freed minimums (cascade):**
   - Check `cascadeRedirects` — if the user pinned where freed cash goes, honor it
   - Remaining freed cash goes to the priority account per strategy
6. **Record events**: cash injections, payoffs, cascade redirects — with Spanish descriptions
7. **Snapshot** the month's state into the timeline

**Priority logic by strategy:**
- `snowball`: lowest balance first
- `avalanche`: highest rate first
- `custom`: follows `allocations.customPriority` order

### Preserved Functions

The existing `runSimulation()`, `compareStrategies()`, `allocateLumpSum()`, and `simulateSingleAccount()` remain in the codebase. They are still valid utilities (e.g., `compareStrategies` could be used as a quick preset in Step 2). They will also be updated to use `monthlyRateFromEA()`.

---

## Server Actions

### New file: `webapp/src/actions/scenarios.ts`

```typescript
// CRUD operations for debt scenarios

export async function getScenarios(): Promise<DebtScenario[]>
// List all saved scenarios for the current user, ordered by updated_at desc

export async function getScenario(id: string): Promise<DebtScenario | null>
// Get a single scenario by ID

export async function saveScenario(data: SaveScenarioInput): Promise<ActionResult<DebtScenario>>
// Create or update a scenario. If id is provided, updates; otherwise creates.
// Validates cash_entries, runs the scenario engine, stores computed results.

export async function deleteScenario(id: string): Promise<ActionResult<void>>
// Soft or hard delete a scenario
```

All actions use `getAuthenticatedClient()` and include `.eq("user_id", user.id)` for defense-in-depth.

---

## UI Components

### New route: `/deudas/planificador`

Replaces `/deudas/simulador`. The old route redirects to the new one.

### Component tree

```
app/(dashboard)/deudas/planificador/page.tsx    -- RSC, fetches accounts + saved scenarios
  components/debt/scenario-planner.tsx          -- Main client component, wizard state
    components/debt/planner/cash-step.tsx        -- Step 1: cash entry management
    components/debt/planner/allocate-step.tsx    -- Step 2: allocation + cascade control
    components/debt/planner/compare-step.tsx     -- Step 3: side-by-side comparison
    components/debt/planner/detail-step.tsx      -- Step 4: month-by-month deep-dive
    components/debt/planner/scenario-manager.tsx -- Save/load/delete scenarios panel
```

### State Management

The planner uses a single `useReducer` at the `scenario-planner.tsx` level:

```typescript
interface PlannerState {
  // Step 1
  cashEntries: CashEntry[];

  // Step 2 (per scenario)
  scenarios: ScenarioState[];  // max 3
  activeScenarioIndex: number;

  // Computed
  results: Map<number, ScenarioResult>;  // index → computed result

  // Persistence
  savedScenarioId: string | null;  // if loaded from DB
  isDirty: boolean;
}

interface ScenarioState {
  name: string;           // "Plan A", "Plan B", "Plan C"
  strategy: PayoffStrategy | 'custom';
  allocations: ScenarioAllocations;
}
```

Results are computed client-side via `useMemo` calling `runScenario()` — no server round-trip needed for simulation. Server actions are only used for save/load/delete.

### Dashboard Integration

The `/deudas` page button changes from "Simulador de pago" to "Planificador de pagos" and points to `/deudas/planificador`.

If the user has saved scenarios, the debt dashboard shows a small "Planes guardados" section with scenario names and a quick summary (strategy, months to debt-free, last updated). Clicking opens the scenario in the planner.

---

## Migration Path

1. The current `/deudas/simulador` route gets a redirect to `/deudas/planificador`
2. The old `DebtSimulator` component is kept temporarily but no longer routed to
3. Once the planner is stable, the old component and dead-code local copies (`webapp/src/lib/utils/debt.ts`, `webapp/src/lib/utils/debt-simulator.ts`) are deleted
4. The EA interest fix is applied to ALL existing functions, not just the new ones — this ensures the dashboard's `estimateMonthlyInterest()` and insights are also accurate

---

## Iteration Plan

**Phase 1 (this implementation):** Desktop wizard with all 4 steps, EA fix, DB persistence, cascade control. The wizard button is hidden on mobile (matches current behavior).

**Phase 2 (follow-up):** Mobile-responsive wizard — adapt each step's layout for small screens. The step-by-step nature of the wizard maps naturally to mobile navigation.

---

## Open Questions

1. **Custom priority order UX**: For the "custom" strategy, should the user drag-and-drop accounts to set priority, or use a numbered list? Drag-and-drop is more intuitive but harder to implement accessibly.
2. **Scenario limit**: Cap at 3 scenarios for comparison? More becomes visually unreadable on the chart.
3. **Historical tracking**: Should saved scenarios track "plan vs reality" — comparing projected balances against actual imported statement data? This is powerful but significantly more complex (requires matching scenario accounts to live accounts over time). Recommended as a Phase 3 feature.

# Account Detail Page Redesign

## Overview

Full rewrite of `accounts/[id]/page.tsx` — replace the current PageHero + stat cards + timeline layout with a card-visual hero, balance graph with flip interaction, quick actions bar, and recent transactions list. Adds transfer functionality and `card_brand` field.

## Design Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Hero per account type | Card visual (CC, savings, checking w/ debit), Balance graph (loan, investment), Spending pulse (checking w/o debit, cash) | Each type tells its own story |
| Card ↔ Graph toggle | Tap to flip (CSS rotateY) | Direct, discoverable, no extra UI chrome |
| Range selector placement | Inside hero, below flip zone, hidden on card face | Avoids clutter, appears when relevant |
| Quick actions | Horizontal icon bar below hero | Replaces scattered dialog triggers |
| Main content | Recent transactions (compact rows) | More useful than stat cards |
| Statement snapshots | Compact link card below transactions | Defers redesign to follow-up |
| Transfer | Linked transaction pair via `transfer_group_id` | Clear accounting, no double-counting |
| Card fidelity | Flat with subtle gradient, real proportions, brand logo | Between minimal and realistic |

## Data Model Changes

### 1. `card_brand` on accounts

```sql
-- Plaintext column (not PII, no encryption needed)
-- But accounts uses _enc pattern, so need view + trigger updates
ALTER TABLE accounts_enc ADD COLUMN card_brand TEXT;
-- Values: VISA, MASTERCARD, AMEX, DINERS, DISCOVER, null
```

Update `accounts` view and INSTEAD OF triggers to pass through `card_brand`. Regenerate TypeScript types.

Fallback: null → generic card design (no brand logo, neutral gradient).

Population sources:
- PDF import: parsers can extract brand from statement data
- Manual: optional field in AccountFormDialog
- Email ingestion: can derive from card network patterns

### 2. `transfer_group_id` on transactions

```sql
ALTER TABLE transactions_enc ADD COLUMN transfer_group_id UUID;
CREATE INDEX idx_transactions_transfer_group ON transactions_enc(transfer_group_id) WHERE transfer_group_id IS NOT NULL;
```

Update `transactions` view and INSTEAD OF triggers. Plaintext (UUID, not PII).

### 3. New server action: `getAccountTransactions`

```typescript
getAccountTransactions(accountId: string, opts: { limit: number; offset: number })
  → Promise<{ transactions: Transaction[]; hasMore: boolean }>
```

Cached with `cacheTag("transactions", "zeta")`. Filtered by account_id + user_id (defense-in-depth).

### 4. New server action: `createTransfer`

```typescript
createTransfer(data: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currencyCode: string;
  date: string;
  notes?: string;
}) → Promise<ActionResult<{ outflowId: string; inflowId: string }>>
```

Creates two transactions:
- OUTFLOW on source: negative delta, `transfer_group_id` set
- INFLOW on destination: positive delta, same `transfer_group_id`
- Calls `applyAccountBalanceDelta()` on both accounts
- Calls `revalidateFinancialViews()`

## Component Architecture

```
AccountDetailPage (server component)
├── AccountHero
│   ├── FlipZone (client component — manages flip state)
│   │   ├── CardFace
│   │   │   ├── Institution name (top-left)
│   │   │   ├── Card brand logo or fallback (top-right)
│   │   │   ├── Balance (center)
│   │   │   └── Mask •••• XXXX (bottom)
│   │   └── GraphFace
│   │       ├── Balance + trend badge
│   │       └── AreaChart (recharts)
│   ├── DotIndicator (always visible for card-bearing accounts)
│   └── RangePills (visible only on graph face, animates in/out)
│
├── SpendingPulseHero (checking w/o debit, cash — no flip)
│   ├── Balance (large)
│   ├── "Este mes" spent badge
│   └── 30-day sparkline
│
├── BalanceGraphHero (loan, investment — no flip)
│   ├── Balance + trend
│   ├── AreaChart
│   └── RangePills (always visible)
│
├── QuickActionsBar
│   ├── Pagar → QuickPaymentDialog (CC, LOAN)
│   ├── Transferir → TransferDialog (SAVINGS, CHECKING, CASH) ← NEW
│   ├── Agregar → Opens transaction creation form prefilled with this account (CC, SAVINGS, CHECKING, CASH)
│   ├── Ajustar → ReconcileBalanceDialog (all types)
│   └── Más → dropdown: Edit, Delete (all types)
│
├── RecentTransactions
│   ├── Section header: "Transacciones" + "Ver todas" link
│   ├── CompactTransactionRow × 10 (date, merchant, amount)
│   ├── "Cargar más" button (pagination)
│   └── Empty state with CTA
│
└── StatementSnapshotsCard (CREDIT_CARD, LOAN, SAVINGS only)
    ├── Icon + "Extractos (N)"
    ├── "Último: [period]"
    └── → navigates to snapshot view
```

## Hero Variants by Account Type

| Type | Hero Component | Has Flip | Range Pills | Quick Actions |
|------|---------------|----------|-------------|---------------|
| CREDIT_CARD | FlipZone (card ↔ graph) | Yes | On graph face | Pagar, Agregar, Ajustar, Más |
| SAVINGS | FlipZone (card ↔ graph) | Yes | On graph face | Transferir, Agregar, Ajustar, Más |
| CHECKING (w/ debit mask) | FlipZone (card ↔ graph) | Yes | On graph face | Transferir, Agregar, Ajustar, Más |
| CHECKING (no debit mask) | SpendingPulseHero | No | No | Transferir, Agregar, Ajustar, Más |
| LOAN | BalanceGraphHero | No | Always visible | Pagar, Ajustar, Más |
| INVESTMENT | BalanceGraphHero | No | Always visible | Ajustar, Más |
| CASH | SpendingPulseHero | No | No | Transferir, Agregar, Ajustar, Más |
| OTHER | SpendingPulseHero | No | No | Agregar, Ajustar, Más |

## Card Visual Design

- Aspect ratio: 85.6:53.98 (ISO/IEC 7810 ID-1)
- Background: subtle gradient using account `color` field, or institution-derived default
- Typography: clean sans-serif, white on dark gradient
- Brand logo: top-right corner (VISA, Mastercard, etc.) or "DÉBITO"/"CRÉDITO" label if no brand
- No embossing, chip textures, or skeuomorphic elements
- Flat + gradient = modern card feel

## Flip Interaction

- Trigger: tap/click anywhere on the flip zone
- Animation: CSS `transform: rotateY(180deg)` with `perspective(1000px)` on container
- Duration: ~400ms ease-in-out
- Both faces use `backface-visibility: hidden`
- State managed in client component via `useState`
- Range pills animate in (opacity + translateY) when graph face becomes active

## Transfer Dialog

New `TransferDialog` component:

**Fields:**
- From account (preselected from current account context)
- To account (select, excludes "from" account)
- Amount (number input, defaults to "from" account currency)
- Date (date picker, defaults to today)
- Notes (optional textarea)

**Validation (Zod):**
- fromAccountId: valid UUID, different from toAccountId
- toAccountId: valid UUID, different from fromAccountId
- amount: positive number
- date: valid date string

**Backend creates linked pair:**
- Transaction 1: OUTFLOW, source account, amount as negative
- Transaction 2: INFLOW, destination account, amount as positive
- Both share `transfer_group_id` (new UUID)
- Both use `capture_method: MANUAL_FORM`
- `applyAccountBalanceDelta()` on both accounts
- `revalidateFinancialViews()` after insert

## Transactions List

- Compact row: `[date] [merchant/description] [amount]`
- Amount colored: green for inflow, default for outflow
- Category badge (small, inline)
- Tap row → opens transaction detail/edit sheet (reuse existing)
- Pagination: 10 initial, "Cargar más" button, not infinite scroll
- Link: "Ver todas" → `/transactions?account={accountId}`
- Empty state: "No hay transacciones" + "Agregar transacción" CTA

## Statement Snapshots Card

- Compact card below transactions
- Only for: CREDIT_CARD, LOAN, SAVINGS
- Shows: icon, "Extractos (count)", "Último: [period_to formatted]"
- Tapping → navigates to existing snapshot view (or future redesigned one)
- Data: reuse existing `getStatementSnapshots` action (just need count + latest period)

## Missing Debit Card Mask Banner

For CHECKING accounts without `debit_card_mask`:
- Small info banner inside hero: "Agrega tu tarjeta débito para ver la vista de tarjeta"
- CTA opens AccountFormDialog focused on debit_card_mask field
- Falls back to SpendingPulseHero until mask is provided

## Cashflow Metric Impact

Transfers between own accounts must NOT count as income or expense in cashflow metrics. Filter: when both sides of a `transfer_group_id` belong to the same user, exclude from income/expense totals. This is a new exclusion rule in `getMonthlyCashflowCached()`.

## Out of Scope (Follow-up)

- Statement snapshots redesign (visual overhaul)
- Populating `card_brand` from PDF parsers automatically
- Debit card mask extraction from email ingestion
- Transfer support in reconciliation flow

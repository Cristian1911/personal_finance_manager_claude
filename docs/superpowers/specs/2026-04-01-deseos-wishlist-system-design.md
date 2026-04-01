# Deseos — Wishlist & Purchase Behavior System

> **Date:** 2026-04-01
> **Status:** Approved
> **Location:** `/plan` → Deseos tab + Dashboard widget

## Overview

A persistent wishlist that tracks things the user wants to buy, scores them against their real financial state, and proactively nudges when purchases become affordable. Over time, post-purchase reflections build a personal pattern of spending wisdom.

**Core value:** Control over impulse. The app helps you see the real impact of buying, blocks you when you can't afford it, and rewards you when you can.

**Four pillars:**
1. **Control** — "I have 12 things I want, but I'm choosing deliberately"
2. **Motivation** — "Pay off your Nu card and you unlock that PS5"
3. **Reflection** — "Was it worth it?" closes the feedback loop
4. **Learning** — "Your impulse purchases average 2.1★; items you waited 2+ months: 4.3★"

## Lifecycle

```
Quick Capture → Enrich → Live Scoring → Unlock → Buy → Reflect → Learn
```

### 1. Quick Capture
- Tap "+" on the Deseos page → enter name and price → done
- Two fields only: "¿Qué quieres?" and "¿Cuánto cuesta?"
- Currency defaults to user's preferred currency

### 2. Enrich (nudged, not forced)
- Items with `enriched: false` show a "?" icon and "Completar" button
- Enrichment form fields:
  - **Why** — free text ("¿Por qué lo quieres?")
  - **Urgency** — `NECESSARY` / `USEFUL` / `IMPULSE` (reuses `PurchaseUrgency` enum)
  - **Desire type** — `long_held` / `recent` / `spontaneous`
  - **Category** — links to existing categories (determines budget zone impact)
  - **Funding type** — `ONE_TIME` / `INSTALLMENTS`
  - **Installments** — number of months (if applicable)
  - **Preferred account** — which account to pay from
- Until enriched, the item cannot be scored — gray "?" status instead of traffic light
- This creates natural incentive to complete enrichment without blocking capture

### 3. Live Scoring
- Once enriched, scored via existing `analyzePurchaseDecision()` from `@zeta/shared`
- Input assembled from: item fields + current financial state (liquid cash, debt utilization, budget remaining, income, expenses, upcoming payments)
- Score cached on the item (`last_score`, `last_verdict`, `last_scored_at`)
- Re-scored when:
  - User opens the Deseos page and score is stale (> 24h)
  - Financial event occurs (transaction import, debt payment, month boundary)
- Traffic light display:
  - **Green** (score ≥ 55): "Puedes comprarlo" — BUY or BUY_WITH_CAUTION
  - **Yellow** (score 35-54): "Espera un poco" — WAIT
  - **Red** (score < 35): "No es buen momento" — NOT_RECOMMENDED

### 4. Unlock
- When an item transitions from non-green → green for the first time, `ready_at` is set
- This transition is a nudge trigger (see Nudge System)

### 5. Buy
- User marks item as "Comprado"
- Prompted to link to an existing transaction (search by amount/date range) or skip
- Status moves to `bought`, `bought_at` is set, `transaction_id` linked if matched

### 6. Reflect
- **First reflection** — 14 days after `bought_at`:
  - Triggered when user opens the app and the item qualifies
  - Shows as a card on Deseos page: "Compraste [item] hace 2 semanas. ¿Valió la pena?"
  - Fields: worth_it (yes/no), rating (1-5★), optional note
- **Second reflection** — 60 days after `bought_at` (expensive items only):
  - Triggered when `amount > estimated_monthly_income * 0.10`
  - Same format, stored as a second row in `wishlist_reflections`
- After reflecting, status moves to `reflected` → `archived`

### 7. Learn
- Aggregation of reflection data surfaces patterns on the Deseos list page
- Appears as a small insight card once 5+ items have been reflected on
- Pattern examples:
  - "Tus compras tipo **impulso** tienen promedio 2.1★. Las que esperaste 2+ meses: 4.3★."
  - "3 de 3 compras en **Educación** fueron 5★. Es tu zona fuerte."
  - "Las compras que empezaron en rojo y esperaste a verde: 4.5★ promedio."
- Computed server-side on page load via simple aggregation queries (grouped by urgency, desire_type, category, wait time)
- Minimum threshold: 3+ items in a group to surface an insight
- No ML, no AI — just averages and counts
- When a new enriched item matches a pattern with data, a subtle hint appears on the item card:
  - "Tus compras de impulso suelen tener 2.1★ — ¿seguro que no quieres esperar?"

## Nudge System

Four deterministic triggers. No AI, no push notifications in v1.

### Trigger 1: Debt Milestone
- **When:** Account balance drops to zero (paid off) or crosses 50% threshold
- **Detected:** After transaction imports or manual balance updates (existing `getRecentImpactEvents()`)
- **Message:** "Pagaste tu tarjeta Nu. Liberaste $150K/mes. Tu [item] que llevas queriendo 3 meses ahora está en verde."

### Trigger 2: Budget Surplus
- **When:** End of month, spent < budgeted in "wants" (30%) zone. Surplus ≥ cheapest wishlist item price.
- **Detected:** On dashboard/Deseos page load during last 5 days of month or first load of new month
- **Message:** "Este mes te sobraron $80K en gastos variables. Suficiente para [item] que llevas en tu lista desde febrero."

### Trigger 3: Desire Maturity
- **When:** Item on list 30+ days, enriched, score currently green
- **Detected:** On Deseos/dashboard page load
- **Message:** "Llevas 2 meses queriendo [item] y tus finanzas lo permiten. Esto no es impulso — date el gusto."

### Trigger 4: Score Transition (Unlock)
- **When:** Item score crosses from red/yellow → green during re-score
- **Detected:** During batch re-score on financial events
- **Message:** "Tu [item] acaba de pasar a verde. Algo cambió en tus finanzas — revísalo."

### Delivery
- **Dashboard widget:** "Deseos" card shows the most relevant nudge (priority: debt milestone > unlock > surplus > maturity)
- **Deseos page banner:** Contextual banner at top of list when there's an active nudge
- No push notifications in v1

### Fatigue Prevention
- Max 1 nudge per day on dashboard widget
- Dismissed once seen (tracked per item via `last_nudge_dismissed_at` or similar)
- Preference: items that are enriched and have been held longest

## Data Model

### Table: `wishlist_items`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `user_id` | uuid | FK → `auth.users`, RLS |
| `name` | text | Required. "PlayStation 5", "Curso de cocina" |
| `amount` | numeric | Required. Estimated price |
| `currency_code` | text | Default: user's preferred currency |
| `url` | text | Optional. Product link |
| `image_url` | text | Optional. Product image |
| `status` | text | `wishlist` → `bought` → `reflected` → `archived`. Traffic light is computed from `last_score`, not status. |
| `why` | text | Nullable. "¿Por qué lo quieres?" |
| `urgency` | text | Nullable. `NECESSARY` / `USEFUL` / `IMPULSE` |
| `desire_type` | text | Nullable. `long_held` / `recent` / `spontaneous` |
| `category_id` | uuid | Nullable. FK → `categories` |
| `funding_type` | text | Nullable. `ONE_TIME` / `INSTALLMENTS` |
| `installments` | integer | Nullable. Number of months |
| `account_id` | uuid | Nullable. Preferred payment account |
| `enriched` | boolean | Default `false`. True once context fields filled |
| `enriched_at` | timestamptz | Nullable |
| `ready_at` | timestamptz | Nullable. First time score hit green |
| `bought_at` | timestamptz | Nullable |
| `transaction_id` | uuid | Nullable. FK → `transactions` |
| `last_scored_at` | timestamptz | Nullable |
| `last_score` | integer | Nullable. 0-100 |
| `last_verdict` | text | Nullable. `BUY` / `BUY_WITH_CAUTION` / `WAIT` / `NOT_RECOMMENDED` |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Default `now()` |

**RLS:** `(select auth.uid()) = user_id`

### Table: `wishlist_reflections`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `wishlist_item_id` | uuid | FK → `wishlist_items` |
| `user_id` | uuid | FK → `auth.users`, RLS |
| `worth_it` | boolean | Required. Core question |
| `rating` | integer | Required. 1-5 |
| `note` | text | Optional. Free text |
| `days_since_purchase` | integer | Computed from `bought_at` |
| `reflected_at` | timestamptz | Default `now()` |

**RLS:** `(select auth.uid()) = user_id`

## UI Layout

### Deseos Page (`/plan` → Deseos tab)

The Plan page gets a third tab alongside Deudas and Recurrentes.

**Page structure (top to bottom):**
1. Tab bar: Deudas | Recurrentes | **Deseos**
2. Nudge banner (dismissible, only when active nudge exists)
3. Quick-add inline input ("+ Agregar deseo rápido...")
4. Active items list, sorted by score descending (green first, then yellow, then red, then unenriched)
5. Learning insight card (when 5+ reflections exist)
6. "Comprados" section — collapsed by default, shows bought items with reflection ratings

**Item card shows:**
- Traffic light dot (green/yellow/red) or "?" for unenriched
- Name
- Amount + currency
- Desire age ("Deseo desde feb")
- Verdict text ("Puedes comprarlo" / "Espera un poco" / "No es buen momento")
- Score number
- Tags: urgency, desire type, category name
- "Completar" badge for unenriched items

### Dashboard Widget

Compact card in the dashboard grid:
- Header: "Deseos" + item count + ready count
- Featured item: top unlocked/ready item with nudge context
- Next-closest item (highest non-green score)
- "Ver todos →" link to `/plan` Deseos tab

### Enrichment Form

Opened by tapping an unenriched item or its "Completar" button. Could be a sheet/drawer:
- Why (textarea)
- Urgency (3-option selector: Necesario / Útil / Impulso)
- Desire type (3-option: Lo quiero hace rato / Reciente / Espontáneo)
- Category (existing category picker)
- Funding (ONE_TIME / INSTALLMENTS toggle, installments count if applicable)
- Account (existing account picker)

### Reflection Card

Surfaces on Deseos page or dashboard when an item qualifies (14 or 60 days post-purchase):
- Item name + amount + "Compraste hace X semanas"
- Worth it? (Yes / No buttons)
- Rating (1-5 stars)
- Optional note (textarea)
- Submit → item moves to `reflected` status

## Server Actions

### CRUD
- `createWishlistItem(name, amount, currencyCode)` — quick capture
- `enrichWishlistItem(id, context)` — fill context fields, set `enriched: true`
- `updateWishlistItem(id, fields)` — edit name, amount, etc.
- `deleteWishlistItem(id)` — remove from list
- `getWishlistItems()` — all items for current user, ordered by status + score

### Scoring
- `scoreWishlistItem(id)` — run `analyzePurchaseDecision()` for a single item, cache result
- `rescoreAllWishlistItems()` — batch re-score all enriched items, detect transitions

### Lifecycle
- `markWishlistItemBought(id, transactionId?)` — set status to `bought`
- `submitReflection(itemId, worthIt, rating, note?)` — create reflection row

### Nudges
- `getActiveNudges()` — compute and return current nudges (debt milestone, surplus, maturity, unlock)
- `dismissNudge(itemId)` — mark nudge as seen

### Insights
- `getWishlistInsights()` — aggregate reflection data, return pattern strings

## Scope Boundaries

### In v1
- Full CRUD for wishlist items
- Quick capture + enrichment flow
- Live scoring via existing `analyzePurchaseDecision()`
- Traffic light display on list and dashboard widget
- Four nudge triggers (debt milestone, budget surplus, desire maturity, score transition)
- Post-purchase reflection (14-day and 60-day)
- Learning insights (simple aggregation, 5+ reflected items threshold)
- Transaction linking on purchase

### Not in v1
- URL metadata scraping (auto-fill name/image from product URL)
- Push notifications (mobile)
- Sharing wishlists
- Price tracking / price drop alerts
- Savings goal allocation ("save $X/month toward this item")
- Integration with external wishlists (Amazon, etc.)

## Error Handling

- Duplicate items: allowed (you might want the same thing at different prices/times)
- Scoring failure: show stale score with "Última evaluación: hace X días" note, don't block the list
- Reflection prompt dismissed: don't re-show for 7 days, then try once more. After second dismissal, skip.
- Transaction linking: optional, search by amount ± 10% and date range ± 7 days from `bought_at`

# Mobile App Redesign — Design Document

> Date: 2026-03-07
> Status: Approved
> Scope: Full visual + structural redesign of the React Native / Expo mobile app

---

## Motivation

The current mobile app has several problems:
- The top area of the dashboard is wasted (MonthSelector floats with no visual weight)
- Too many tabs (6) — more than recommended for mobile
- The tab bar uses a muted beige (`#C5BFAE`) that doesn't match the brand
- Cards on the dashboard are too many and too similar in weight — no hierarchy
- The PurchaseDecisionCard adds noise on the home screen
- Generic look — no strong visual identity

Reference: Copilot Money (clean hero, strong typography, dark header, white cards).

---

## 1. Navigation Structure

Reduce from 6 tabs to 5. Remove "Presupuestos" as a standalone tab.

| Tab | Icon | Route |
|-----|------|-------|
| Inicio | LayoutDashboard | `/(tabs)/index` |
| Transacciones | Receipt | `/(tabs)/transactions` |
| Cuentas | Wallet | `/(tabs)/accounts` |
| Importar | Upload | `/(tabs)/import` |
| Ajustes | Settings | `/(tabs)/settings` |

"Presupuestos" content is accessible from the Cuentas tab (account detail) or as a future entry inside the dashboard hero.

### Tab bar styling

```
backgroundColor: #FFFFFF
borderTopColor: #E5E7EB (1px)
tabBarActiveTintColor: #10B981
tabBarInactiveTintColor: #9CA3AF
```

---

## 2. Dashboard Hero

The top section becomes a full-width immersive hero that occupies ~40% of the screen (280–320px on iPhone 14).

### Visual spec

- Background: `#111827` (near-black), edge-to-edge
- Bottom corners: `borderBottomLeftRadius: 24`, `borderBottomRightRadius: 24`
- All text: white
- No top border radius — blends with status bar

### Layout (top to bottom)

```
[status bar safe area]

← marzo 2026                    [⟳ sync icon]    ← tappable month, opens picker
                                                     sync icon shows when syncing

Disponible para gastar                           ← label: fontSize 13, gray-300
$2.450.000                                       ← fontSize 40, fontWeight 700, white

████████████░░░░  68% del mes                    ← 4px bar, emerald #10B981
Gastado $1.2M  ·  Ingresos $3.8M                ← fontSize 12, gray-300

[  + Registrar  ]    [  ↑ Importar  ]            ← pill buttons, border white/30, text white
```

### Hero interaction
- Tap on month label → opens month picker (bottom sheet or inline scroll)
- "Registrar" → navigates to `/capture`
- "Importar" → navigates to `/(tabs)/import`
- Pull-to-refresh triggers sync (existing behavior)

---

## 3. Dashboard Content (scroll below hero)

4 card blocks in fixed order. Each card: white background, `borderRadius: 16`, `shadowOpacity: 0.06`, horizontal margin `16px`, vertical gap `12px` between cards.

### Block 1 — Proximos pagos (conditional)

Only rendered if there is at least one payment due within 21 days.

```
Proximos pagos
─────────────────────────────
Bancolombia        vence en 3 dias
Visa               vence en 12 dias
```

Each row shows account name + days until due. Tap → account detail.

### Block 2 — Resumen del mes

```
Resumen del mes
─────────────────────────────
Ingresos   ████████████░░  $3.800.000
Gastos     ████████░░░░░░  $1.200.000
```

Two horizontal bars proportional to each other. Emerald for income, gray-300 for expenses (or red if expenses > income).

### Block 3 — Top categorias

```
Top categorias
─────────────────────────────
Comidas       ████░░  $320.000
Transporte    ██░░░░  $180.000
Mercado       █░░░░░   $95.000
```

Top 5 categories by spend. Each row: category name + horizontal bar + amount. Bars use the category's own color. Tap on a category → transactions filtered by that category.

### Block 4 — Ultimas transacciones

```
Ultimas transacciones                      Ver todas →
─────────────────────────────────────────────────────
Exito · Mercado                             -$45.000
Nomina · Ingresos                        +$3.800.000
Rappi · Comidas                             -$32.000
```

Shows 3 rows max. "Ver todas" link navigates to the Transacciones tab. Transaction rows reuse the existing `TransactionRow` component.

### Removed from dashboard
- `PurchaseDecisionCard` — removed entirely (experimental, adds noise)
- Separate "Acciones rapidas" card — merged into the hero

---

## 4. Visual Identity Tokens

### Color palette

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#10B981` | Tab active, progress bars, income values, CTAs |
| `primary-dark` | `#059669` | Pressed/hover states |
| `primary-light` | `#D1FAE5` | Badge backgrounds, subtle highlights |
| `hero-bg` | `#111827` | Dashboard hero background |
| `surface` | `#F9FAFB` | Screen background |
| `card` | `#FFFFFF` | Card backgrounds |
| `text-primary` | `#111827` | Headings, primary labels |
| `text-secondary` | `#6B7280` | Sublabels, metadata |
| `text-on-hero` | `#FFFFFF` | All text inside the hero |
| `text-on-hero-dim` | `#D1D5DB` | Dim labels inside the hero |
| `success` | `#22C55E` | INFLOW amounts, positive balances |
| `danger` | `#EF4444` | OUTFLOW alerts, negative balances |
| `border` | `#E5E7EB` | Card borders, dividers |

### Typography (Inter, already installed)

| Role | fontSize | fontWeight |
|------|----------|------------|
| Hero balance | 40 | 700 |
| Screen title | 20 | 700 |
| Card title | 15 | 600 |
| Body / row label | 14 | 400 |
| Sublabel / metadata | 12 | 400 |
| Amount in list | 15 | 600 |

### Spacing

| Token | Value |
|-------|-------|
| Screen horizontal padding | 16px |
| Gap between cards | 12px |
| Card internal padding | 16px |
| Hero height | 280–320px |
| Hero bottom radius | 24px |

---

## 5. Out of Scope (this iteration)

- Transactions tab redesign — only dashboard is redesigned in v1
- Accounts tab redesign — deferred
- Budgets tab — remains accessible from Cuentas detail
- Dark mode — deferred
- Onboarding flow changes — deferred
- Any backend / sync changes — none required

---

## 6. Files to Touch

| File | Change |
|------|--------|
| `mobile/app/(tabs)/_layout.tsx` | Remove Presupuestos tab, reorder tabs, update tab bar colors |
| `mobile/app/(tabs)/index.tsx` | Full dashboard redesign |
| `mobile/components/dashboard/BalanceCard.tsx` | Replace with new hero component |
| `mobile/components/dashboard/MonthSummary.tsx` | Redesign as compact card |
| `mobile/components/dashboard/CategoryBreakdown.tsx` | Redesign with horizontal bars |
| `mobile/components/dashboard/PurchaseDecisionCard.tsx` | Remove (not used) |
| `mobile/components/common/MonthSelector.tsx` | Integrate into hero header |
| `mobile/components/common/FloatingCaptureButton.tsx` | Evaluate — may be removed if hero has "Registrar" button |

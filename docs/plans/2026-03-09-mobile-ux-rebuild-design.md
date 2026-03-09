# Mobile UX Rebuild — Design Document

> **Date:** 2026-03-09
> **Status:** Approved
> **Branch:** feat/category-budgets

## Problem

The app has solid foundations (data layer, server actions, Supabase) and basic responsive CSS, but the mobile experience feels like a shrunken desktop app rather than a purpose-built mobile experience. The primary mobile use cases — quick glance ("how much do I have?") and quick capture ("I just paid for X") — aren't optimized for.

## Goals

1. **Mobile-first UX** for glance + capture workflows
2. **Bottom tab navigation** with 5 key sections
3. **FAB with sub-actions** for quick transaction capture
4. **Customizable dashboard widgets**
5. **Inline categorization inbox** in budget view
6. **Separate mobile layout** that coexists with the desktop sidebar layout

## Architecture: Parallel Mobile Shell (Approach A)

Separate layout components detected by viewport. Shared server-side data fetching, platform-specific client wrappers.

```
app/(dashboard)/
  layout.tsx              ← viewport detection, renders:
    └─ lg+:  Sidebar + main content (existing desktop)
    └─ <lg:  MobileShell (bottom tabs + FAB + mobile views)

components/mobile/
  mobile-shell.tsx        ← bottom tabs + FAB container + page content
  bottom-tab-bar.tsx      ← 5 tabs with icons, labels, badges
  fab-menu.tsx            ← floating [+] with sub-action expansion
  mobile-dashboard.tsx    ← dashboard: hero + upcoming + widgets
  mobile-recurrentes.tsx  ← recurring payment timeline
  mobile-presupuesto.tsx  ← budgets + categorization inbox
  mobile-gestionar.tsx    ← action cards grid
  mobile-movimientos.tsx  ← summary + date-grouped feed (non-tab page)
```

**Viewport detection:** CSS-based (`hidden lg:block` / `lg:hidden`) for layout split. Server components fetch data once; page passes props to either desktop or mobile client wrapper.

**Navigation model:** Bottom tabs handle primary navigation. Sub-pages (account detail, transaction detail, import wizard, settings) push onto a stack with a back-arrow header, hiding the tab bar or keeping it contextual.

## Bottom Tab Bar

```
┌─────────────────────────────────────┐
│  🏠        🔄       [+]      💰    ⚡  │
│ Inicio  Recurren.        Presup. Gestión│
└─────────────────────────────────────┘
```

- Fixed at bottom, `pb-safe` for notch/home-indicator
- Active tab: filled icon + primary color label
- Badge on **Presupuesto** showing uncategorized transaction count
- **[+]** center button: elevated, primary color, distinct from other tabs
- Tabs map to URL segments: `/dashboard`, `/recurrentes`, `/categories` (presupuesto), `/gestionar`

## Tab 1: Inicio (Dashboard)

Primary use case: **Glance** — "how much do I have, what's coming up?"

```
┌─────────────────────────┐
│ Hola, Cristian     [⚙️]  │
│                         │
│ Dinero disponible       │
│ $1,234,567              │
│ después de fijos: $890k │
│                         │
│ Próximos pagos          │
│ ┌───────────────────┐   │
│ │ 🔄 Netflix  Mar 15│   │
│ │    $22,900        │   │
│ ├───────────────────┤   │
│ │ 🏠 Arriendo Mar 28│   │
│ │    $1,200,000     │   │
│ └───────────────────┘   │
│ [Ver todos →]           │
│                         │
│ ┌─Widget area──────┐   │
│ │ (customizable)   │   │
│ │ spending chart,  │   │
│ │ accounts, etc.   │   │
│ └──────────────────┘   │
│                         │
│ Actividad reciente      │
│ Spotify    -$16.9k      │
│ Uber       -$8.5k       │
│ [Ver todos →]           │
└─────────────────────────┘
```

### Sections

1. **Hero:** "Dinero disponible" — total balance minus pending fixed payments. Uses existing dashboard-hero logic.
2. **Próximos pagos:** Next 3-5 upcoming recurring payments sorted by date. "Ver todos" navigates to Recurrentes tab.
3. **Widget area:** Customizable grid. User toggles widgets on/off and reorders from Settings. Initial widget options:
   - Spending by category (donut/bar chart)
   - Account balances (horizontal scroll cards)
   - Monthly spending trend (line chart)
   - Debt overview (total debt + progress)
4. **Actividad reciente:** Last 5 transactions. "Ver todos" navigates to Movimientos (full-page, non-tab).

### Widget System

Widgets stored as user preference (localStorage initially, Supabase `profiles.dashboard_widgets` later). Each widget is a self-contained component that receives data props.

```ts
interface DashboardWidget {
  id: string;           // "spending-chart" | "accounts" | "trend" | "debt"
  enabled: boolean;
  order: number;
}
```

## Tab 2: Recurrentes

Uses the existing timeline-first layout already built (mini calendar + payment timeline + completed section). The `RecurringTimelineView` component works well on mobile already.

## Tab 3: [+] FAB (Floating Action Button)

Primary use case: **Capture** — "I just spent/received money"

### Behavior

1. **Tap [+]:** Button animates, backdrop dims, 3 sub-actions expand upward:
   - **Gasto rápido** (expense) — bottom sheet form, direction pre-set to OUTFLOW
   - **Ingreso** (income) — bottom sheet form, direction pre-set to INFLOW
   - **Transferencia** (transfer) — bottom sheet with source + destination accounts

2. **Tap sub-action:** Opens a bottom sheet form:
   ```
   ┌─────────────────────────┐
   │ Gasto rápido        [✕] │
   │                         │
   │ $ ___________           │
   │ Descripción ________    │
   │ Cuenta: [Bancolombia ▾] │
   │ Categoría: [Comida ▾]   │
   │                         │
   │ [     Guardar     ]     │
   └─────────────────────────┘
   ```

3. **Tap backdrop:** Collapses sub-actions.

### Form Details

- **Amount:** Uses existing `CurrencyInput` component
- **Account:** Select from user's accounts, remembers last used
- **Category:** Category picker with icons, remembers last used per merchant (auto-categorize)
- **Date:** Defaults to today, optional date picker
- Calls existing `createTransaction` server action

## Tab 4: Presupuesto (Budget + Categorization Inbox)

Primary use case: **Review** — "am I on track? clean up my inbox"

```
┌─────────────────────────┐
│ Presupuesto    Mar 2026 │
│                         │
│ ⚠️ 5 sin categoría      │
│ ┌───────────────────┐   │
│ │ Spotify  $16.9k [🎵▾]│
│ │ Uber     $8.5k  [🚗▾]│
│ │ Netflix  $22.9k [🎮▾]│
│ └───────────────────┘   │
│                         │
│ 🍔 Alimentación   $280k │
│ ████████░░░░ 70%        │
│                         │
│ 🚗 Transporte    $120k  │
│ ████░░░░░░░░ 40%        │
│                         │
│ 🏠 Vivienda     $1.2M   │
│ ██████████░░ 85%        │
└─────────────────────────┘
```

### Categorization Inbox

- Collapsible section at the top when uncategorized transactions exist
- Each row shows: description, amount, one-tap category picker dropdown
- Assigning a category immediately saves (server action) and removes from inbox
- Count reflected as badge on the tab icon
- When inbox is empty, section disappears

### Budget Progress

- Each active category with a budget shows: icon, name, spent amount, progress bar, percentage
- Tapping a category navigates to filtered transaction list (Movimientos filtered by category)
- Color coding: green (<70%), amber (70-90%), red (>90%)
- Month selector at top for historical comparison

## Tab 5: Gestionar (Admin Hub)

Primary use case: **Manage** — less frequent admin tasks

```
┌─────────────────────────┐
│ Gestionar               │
│                         │
│ ┌──────────┐┌──────────┐│
│ │ 📄        ││ 🔄        ││
│ │ Importar  ││ Plantillas││
│ │ PDF       ││ recurren. ││
│ └──────────┘└──────────┘│
│ ┌──────────┐┌──────────┐│
│ │ 🏦        ││ ⚙️        ││
│ │ Cuentas   ││ Ajustes   ││
│ │           ││           ││
│ └──────────┘└──────────┘│
└─────────────────────────┘
```

- **Importar PDF:** Opens the existing import wizard (already responsive)
- **Plantillas recurrentes:** Opens recurring templates list for CRUD operations (distinct from timeline)
- **Cuentas:** Opens accounts list/detail
- **Ajustes:** Opens settings (including dashboard widget configuration)

Each card navigates to a sub-page with a back-arrow header.

## Movimientos (Non-Tab Full Page)

Accessed from: Dashboard "Ver todos →", account detail, category detail in Presupuesto.

```
┌─────────────────────────┐
│ ← Movimientos  Mar 2026 │
│                         │
│ Gastos: $1.2M           │
│ Ingresos: $2.8M         │
│ [🍔$280k][🚗$120k][⋯]  │
│─────────────────────────│
│ Hoy                     │
│ Spotify     -$16.9k     │
│ 🎵 Entretenimiento      │
│                         │
│ Uber        -$8.5k      │
│ 🚗 Transporte           │
│─────────────────────────│
│ Ayer                    │
│ Nómina     +$2.8M       │
│ 💼 Ingreso              │
└─────────────────────────┘
```

- **Summary header:** Total gastos + ingresos for the month
- **Category chips:** Horizontally scrollable, tappable to filter
- **Date-grouped feed:** Transactions grouped by date, infinite scroll
- **Back arrow:** Returns to previous context (dashboard, account, category)
- **Search:** Icon in header opens search input
- Tapping a transaction opens detail view

## Component Reuse Strategy

| Data concern | Server component (shared) | Desktop client | Mobile client |
|---|---|---|---|
| Dashboard data | `dashboard/page.tsx` fetches accounts, upcoming, recent | `DashboardContent` | `MobileDashboard` |
| Transactions | `transactions/page.tsx` fetches txns | `TransactionTable` | `MobileMovimientos` |
| Recurring | `recurrentes/page.tsx` fetches templates | `RecurringTimelineView` | Same component (already mobile-ready) |
| Budget | `categories/page.tsx` fetches categories, budgets | `BudgetCategoryGrid` | `MobilePresupuesto` |
| Categorize | Shared server action | `CategoryInbox` | Inline in `MobilePresupuesto` |

Shared utilities: `formatCurrency`, `formatDate`, `useRecurringMonth` hook, all server actions.

## Implementation Phases

1. **Phase 1: Shell** — Mobile layout, bottom tab bar, FAB menu, viewport detection
2. **Phase 2: Inicio** — Mobile dashboard with hero + upcoming + activity
3. **Phase 3: FAB forms** — Quick capture bottom sheets (expense, income, transfer)
4. **Phase 4: Presupuesto** — Mobile budget view + categorization inbox
5. **Phase 5: Gestionar** — Action cards grid + sub-page navigation
6. **Phase 6: Movimientos** — Summary + feed view
7. **Phase 7: Widgets** — Dashboard widget system + settings UI
8. **Phase 8: Polish** — Animations, transitions, safe areas, haptic feedback patterns

## Non-Goals (for now)

- Native app wrapper (Capacitor/Expo) — staying as PWA
- Offline support
- Push notifications
- Biometric auth
- Swipe gestures on transaction cards

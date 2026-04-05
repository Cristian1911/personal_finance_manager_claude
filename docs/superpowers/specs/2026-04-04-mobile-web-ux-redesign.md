# Mobile Web UX Redesign

**Date:** 2026-04-04
**Status:** Approved
**Scope:** All mobile web views (viewport < 1024px)
**Mockups:** `.superpowers/brainstorm/52480-1775340022/content/`

## Problem

The mobile web experience suffers from three core issues:
1. **Signal-to-noise** — everything calls for attention, so nothing feels relevant
2. **Hidden affordances** — the app has powerful features but actions are buried under walls of information
3. **Disconnected experience** — interesting data with no narrative thread connecting it ("vintage store" problem)

The desktop view works because width creates natural hierarchy. On mobile, the same content collapses into a single column of noise.

## Design Principles

### Container System
- All content lives in **inset cards** with side margins — nothing stretches edge-to-edge
- Page background: `#0e100e`. Card surface: `#161816`. Clear figure/ground contrast.
- Cards use `border-radius: 14px`, `border: 1px solid rgba(255,255,255,0.05)`
- Lists live inside card containers (`m-card-tight`) — items never float uncontained
- Grouped grids (2x2 metrics) are a single card with internal dividers, not separate boxes

### Color Hierarchy
Each color earns its place. No color is used "by default" — it must match the semantic meaning.

| Color | Token | Hex | Role | Used for |
|-------|-------|-----|------|----------|
| **Brass** | `z-brass` | `#937844` | Brand identity + interactive | Health ring, avatar border, active tab, "+" button, action buttons, hub entry icons, attention dot, card usage % |
| **White** | `z-white` | `#F6F0E3` | Neutral facts | Dollar amounts, names, neutral metrics ($245k, $870k, 12 pendientes, 23m) |
| **Green** | `z-income` | `#5CB88A` | Confirmed positive | Budget on track (5%), income, payoff progress, "Holgado" chip |
| **Red** | `z-debt` | `#E05545` | Real pain | Interest payments, over-budget categories, critical alerts |
| **Sage** | `z-sage` / `z-sage-dark` | `#768053` / `#938C7E` | Background text | Eyebrows, labels, subtitles, ZETA wordmark, secondary info |

**Rules:**
- Brass is NOT for financial data. If a number is good → green. Bad → red. Neutral → white.
- Red should appear sparingly — maximum 2-3 red elements per screen.
- Green means "you're doing well," not just "positive number."

### Typography
- Page titles: `17px font-weight: 700`
- Card values: `16-28px font-weight: 700-800 tabular-nums`
- Eyebrows: `8px uppercase tracking: 0.18em color: #6b7a5e`
- Body text: `12-13px`
- All financial amounts: `tabular-nums` always

## Navigation

### Tab Bar
4 tabs + center "+" button:
- **Inicio** — dashboard (Focus or Digest mode)
- **Movimientos** — transaction list
- **+** (center, brass circle) — always opens "new transaction" sheet
- **Plan** — budget hub
- **Deudas** — debt hub

The "+" is not a FAB — it's embedded in the tab bar, always visible, always means "create transaction."

### Secondary Navigation
- **Avatar button** (top-right on Inicio) opens a compact dropdown menu:
  - User profile info
  - Ajustes (settings)
  - Importar extracto
  - **"Ver todo"** — navigates to a full page listing all secondary sections (Cuentas, Destinatarios, Categorias, Tags, etc.)
- **Contextual links** within hubs also reach secondary pages (e.g., an account link in Deudas)

### Page Header Pattern
Every non-dashboard page uses the same header:
- Left: page title (17px bold) + subtitle (10px sage)
- Right: contextual action button (brass ghost style: `rgba(196,169,77,0.1)` bg, brass text, brass border)

Action examples:
- Movimientos → "Filtros"
- Plan → "Planificar"
- Deudas → (no top action — hub entries serve this purpose)

## Pages

### 1. Inicio (Dashboard)

**Two modes** selectable by the user (settings or onboarding):

#### Focus Mode (default)
Fits in one viewport. No scroll needed.
1. Top bar: ZETA wordmark (left) + avatar with brass border (right)
2. **Health score card** — brass ring showing score out of 100, centered
3. **2x2 metrics card** — single card with internal dividers:
   - Disponible (white), Plan % (green if good / red if bad), Pendientes (white + brass dot), Libre deuda (white)
4. **Last transaction card** — eyebrow "ULTIMO" + name + amount

#### Digest Mode (alternative)
Short scroll with curated content.
1. Greeting: "Hola Cristian"
2. **Hero balance card** — centered, DISPONIBLE eyebrow + large amount + subtitle
3. **Attention card** — list of actionable items with colored dots (brass for attention, red for urgent), each row tappable with "›"
4. **Metrics strip** — 3 numbers in a row separated by thin dividers (Plan / Salud / Libre), no cards
5. **Recent transactions card** — last 3 transactions in a contained list

### 2. Movimientos (Transactions)

Header: "Movimientos" / "Abril 2026" + "Filtros" action

1. **Summary card** — 3-column: Gastos (white) / Ingresos (green) / Total (white), separated by dividers
2. **Transaction list grouped by date** — each date group is:
   - Section title: "SAB, 04 ABR" (eyebrow style, outside cards)
   - Card containing all transactions for that date
   - Each row: name + category label (sage, or brass for "Sin categoria") + amount (white for expenses, green for income)

### 3. Plan (Budget Hub)

Header: "Plan" / "Abril 2026 · 26d restantes" + "Planificar" action

Hub pattern — summary + entry points, not the full budget page.

1. **Budget health card:**
   - GASTADO ESTE MES eyebrow + large % (green/red/brass based on status)
   - Right-aligned: spent / total amounts
   - Progress bar (color matches status)
   - Pace info + status chip ("Holgado", "Al limite", "Sobre el ritmo")

2. **Hub entries** (tappable cards with icon + title + live hint):
   - **Presupuesto** — icon (brass), hint: "2 categorias sobre el ritmo" (red count)
   - **Pagos y compromisos** — icon (brass), hint: "Netflix en 2 dias"

3. **Distribution card:**
   - Eyebrow "DISTRIBUCION" + chip showing active mode ("50/30/20" or "Ritmo YNAB" or "Por categoria")
   - Renders dynamically based on user's configured allocation style
   - For 50/30/20: three horizontal bars (Necesario=green, Deseos=brass, Ahorro=sage)
   - For Ritmo YNAB: bars for Fijos, Frecuentes, No Mensuales, Metas, Calidad de Vida
   - For Por categoria: top categories by spending

### 4. Deudas (Debt Hub)

Header: "Deudas" / "9 cuentas activas"

Hub pattern — KPIs + entry points.

1. **Monthly debt cost hero card:**
   - CUOTA MENSUAL eyebrow + large amount (white — it's a fact)
   - Right side: interest amount (red) + "intereses" label
   - Split bar below: capital portion (white) vs interest portion (red)
   - Labels: "$586k capital" / "$284k intereses"

2. **Card usage gauge:**
   - USO DE TARJETAS eyebrow + percentage (brass — informational)
   - Gradient gauge bar: green → brass → red
   - Below: used amount / total cupo

3. **Credit card interest card:**
   - INTERESES TARJETAS / MES eyebrow
   - Large amount (red — it's pain)
   - Right: "de $284k total" + percentage of total interest from cards

4. **Nearest payoff card** (green border accent):
   - CREDITO MAS CERCANO A PAGAR eyebrow (green)
   - Name + remaining amount + months to payoff (green)
   - Progress bar (green)

5. **Hub entries:**
   - **Ver todas las deudas** — detailed per-account view
   - **Simular escenarios** — strategy selector (avalancha/bola de nieve) + what-if calculator

## Phasing

This spec covers **Phase 1: Foundation + Main Views**. Subsequent phases will get their own specs after Phase 1 is validated in real use.

### Phase 1 (this spec)
- Design system: container system, color hierarchy, typography
- Navigation: tab bar (4 tabs + "+"), avatar menu, "Ver todo" page
- Inicio (Focus + Digest modes)
- Movimientos
- Plan hub
- Deudas hub

### Phase 2 (separate spec after Phase 1 lands)
- Hub subpages: Presupuesto, Pagos y compromisos, Ver todas las deudas, Simular escenarios
- Cuentas page
- Transaction detail sheet
- New transaction sheet ("+" flow)

### Phase 3 (separate spec after Phase 2 lands)
- Destinatarios (apply container system — already decent)
- Categorias / Configurar
- Settings
- Ver todo menu page
- Deseos, Email ingest UI
- Edge cases: empty states, loading skeletons, error states

## Responsive Breakpoint

- **< 1024px (`lg:`)**: Mobile layout — tab bar, mobile topbar, all patterns described above
- **>= 1024px**: Desktop layout — sidebar, topbar, current desktop experience (unchanged)

This matches the existing breakpoint. No changes to desktop.

## What's NOT in Scope

- Desktop view changes — desktop is considered good as-is
- React Native mobile app — this spec is web-only; the RN app will follow later
- New features or data sources — this is a pure UX restructure of existing data
- Onboarding flow changes
- PDF import wizard (already works, not mobile-specific)

## Implementation Notes

- The `components/mobile/` directory already has a component library (bottom-tab-bar, mobile-topbar, fab-menu, mobile cards, etc.) — this redesign replaces most of them
- The FAB menu (`fab-menu.tsx`) is removed; its "add transaction" action moves to the tab bar center "+"
- The mobile sheet provider and keyboard inset hook should be preserved
- Each hub entry navigates to a subpage — these can use the existing page components with the new container system applied
- The Digest/Focus mode toggle should be stored in `profiles.dashboard_config` (existing JSONB column)
- Desktop components remain untouched — the `lg:hidden` / `hidden lg:block` pattern continues

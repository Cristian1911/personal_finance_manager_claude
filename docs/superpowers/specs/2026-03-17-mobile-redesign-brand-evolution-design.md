# Mobile-First Redesign + Brand Evolution + Personalized Onboarding

**Date:** 2026-03-17
**Branch:** TBD (feature branch from main)
**Status:** Approved — ready for implementation planning

## Goal

Transform Zeta's mobile experience from a responsive desktop app into a mobile-first fintech product. Evolve the brand identity ("Sage Evolved") for more depth, contrast, and personality. Redesign onboarding to configure a purpose-driven, personalized app experience.

## Research Context

Based on a 30-day research sweep (Reddit, X, YouTube, web) covering 2026 mobile design trends, fintech UX best practices, and Claude Code design quality techniques. Key findings:

- Fintech trust = consistency across every screen (Eleken fintech guide)
- Contextual nudges and predictive budgeting are the 2026 default
- Bold direction before code — commit to a design concept before implementation (Anthropic frontend-design skill)
- Extreme weight contrast (200/900) and tabular numbers for financial apps
- Navigation should reflect mental models of money management, not app structure

## Critical Audit Summary (Current State: 5.5/10)

| Area | Score | Key Issue |
|------|-------|-----------|
| Navigation | 8/10 | Strong (tab bar + FAB), but "Gestionar" tab is a dumping ground |
| Visual Identity | 6/10 | Brand tokens exist but inconsistently applied across mobile |
| Page Coverage | 6/10 | Only 4/12 pages have dedicated mobile components |
| Dashboard | 5/10 | Shows data but doesn't help users act on it |
| Accessibility | 5/10 | Color-only warnings, missing ARIA, Spanish typos |
| Motion | 3/10 | Essentially static despite Framer Motion being installed |

---

## Phase 0 — Brand Evolution: "Sage Evolved"

### Design Direction

Keep Zeta's warm sage DNA but evolve it. Deeper base with cool blue undertone. Sage becomes a tinting color at low opacity, not the primary interactive color. Cool-warm tension creates depth and character.

### New Color Tokens

#### Core Palette

| Token | Old Value | New Value | Change |
|-------|-----------|-----------|--------|
| `--z-ink` | #1C1C1C | #0A0E14 | Deeper, cool blue undertone |
| `--z-surface` | #242424 | #131720 | More separation from base |
| `--z-surface-2` | #2E2E2E | #1C1F28 | Elevated cards |
| `--z-surface-3` | (none) | #262A34 | NEW — popovers, menus, tooltips |
| `--z-white` | #F5F3EF | #F0EDE6 | Slightly warmer, becomes primary interactive color |

#### Border System (replacing fixed hex)

```css
--z-border: rgba(192, 185, 170, 0.08);       /* default borders */
--z-border-strong: rgba(192, 185, 170, 0.14); /* emphasized borders */
```

Sage-tinted opacity borders adapt to any surface level automatically.

#### Sharpened Semantic Colors

| Token | Old Value | New Value | Reason |
|-------|-----------|-----------|--------|
| `--z-income` | #52B788 | #5CB88A | Slightly brighter, more energy |
| `--z-expense` | #F4A261 | #E8875A | Shifted to burnt orange — more separation from alert |
| `--z-debt` | #C44536 | #E05545 | True red — more urgency, less earthy |
| `--z-alert` | #E9C46A | #D4A843 | Deeper amber — fills the gap expense left |

#### Sage's New Role

Sage (#C5BFAE / rgb 192,185,170) is no longer the primary color. It becomes a **tinting agent**:
- Borders: `rgba(192,185,170,0.08)`
- Muted text: `rgba(192,185,170,0.45)`
- Surface tints: `rgba(192,185,170,0.03-0.06)`
- Primary interactive color becomes `--z-white` (#F0EDE6) for buttons and active states

### Typography Changes

- **Keep Geist Sans** — personality comes from weight contrast, not a new font
- `font-variant-numeric: tabular-nums` on all financial amounts
- Display amounts: **weight 900**, letter-spacing -0.04em
- Labels/captions: **weight 400**, letter-spacing 0.06em, text-transform uppercase
- CSS-ify all 9 type scales from the brand handoff as custom properties:
  - `--z-type-display`, `--z-type-hero`, `--z-type-h1`, `--z-type-body`
  - `--z-type-widget-lg`, `--z-type-widget-sm`, `--z-type-label`, `--z-type-caption`, `--z-type-trend`
- CSS-ify spacing scale: `--z-space-xs` through `--z-space-3xl`

#### Type Scale Values (from brand handoff)

| Token | Size | Weight | Tracking | Line Height |
|-------|------|--------|----------|-------------|
| `--z-type-display` | 52px | 800 | -0.04em | 1.0 |
| `--z-type-hero` | clamp(56px, 8vw, 96px) | 900 | -0.04em | 0.95 |
| `--z-type-h1` | 28px | 700 | -0.02em | 1.2 |
| `--z-type-body` | 15px | 400 | 0 | 1.7 |
| `--z-type-widget-lg` | 22px | 800 | 0 | 1.2 |
| `--z-type-widget-sm` | 18px | 800 | 0 | 1.2 |
| `--z-type-label` | 11px | 400 | 0 | 1.4 |
| `--z-type-caption` | 10px | 500 | 0.08em | 1.4 |
| `--z-type-trend` | 11px | 400 | 0 | 1.0 |

#### Spacing Scale Values (from brand handoff)

| Token | Value |
|-------|-------|
| `--z-space-xs` | 6px |
| `--z-space-sm` | 8px |
| `--z-space-md` | 16px |
| `--z-space-lg` | 20px |
| `--z-space-xl` | 28px |
| `--z-space-2xl` | 40px |
| `--z-space-3xl` | 64px |

### Migration Impact

- **globals.css**: Update all token values, add new tokens. **Must also add `--color-z-surface-3: var(--z-surface-3)` to the `@theme inline` block** so `bg-z-surface-3` works as a Tailwind utility.
- **Brand handoff HTML**: Update to reflect new values
- **All components using z-* tokens**: Automatically pick up new values (no code changes)
- **Components with hardcoded colors**: Must be migrated (FAB: bg-orange-500 → bg-z-expense, etc.)
- **shadcn mapping**: `--primary` changes from `var(--z-sage)` to `var(--z-white)`. This has cascade effects:
  - **FAB button** (`fab-menu.tsx`): Currently uses `bg-primary`. With white as primary, the FAB becomes a near-white circle — too low contrast as an action affordance. Change FAB to use a dedicated class: `bg-z-white text-z-ink` explicitly, not `bg-primary`.
  - **`--border` / `--input` mapping**: The new `--z-border` is `rgba(192,185,170,0.08)` — very low opacity. On `--z-ink` backgrounds this produces near-invisible borders. Remap: `--border: var(--z-border-strong)` and `--input: var(--z-border-strong)` so form inputs and card borders remain legible. Use `--z-border` (0.08) only for subtle dividers within cards.

---

## Phase 1 — Foundation: Tokens, Motion, Accessibility

### Design Token CSS Variables

Expose all type and spacing scales from the brand handoff as CSS custom properties in globals.css. Components should reference these instead of hardcoded values.

### Status Surface Utility Classes

Create utility classes using the `color-mix()` formula from the brand handoff:

```css
.surface-income  { color: var(--z-income);  border-color: color-mix(in srgb, var(--z-income) 20%, transparent);  background: color-mix(in srgb, var(--z-income) 8%, transparent); }
.surface-expense { color: var(--z-expense); border-color: color-mix(in srgb, var(--z-expense) 20%, transparent); background: color-mix(in srgb, var(--z-expense) 8%, transparent); }
.surface-debt    { color: var(--z-debt);    border-color: color-mix(in srgb, var(--z-debt) 20%, transparent);    background: color-mix(in srgb, var(--z-debt) 8%, transparent); }
.surface-alert   { color: var(--z-alert);   border-color: color-mix(in srgb, var(--z-alert) 20%, transparent);   background: color-mix(in srgb, var(--z-alert) 8%, transparent); }
```

### Brand Token Standardization

Audit and fix all mobile components that use hardcoded Tailwind colors instead of brand tokens:
- `fab-menu.tsx`: `bg-orange-500` → `bg-z-expense`, `bg-green-500` → `bg-z-income`, `bg-blue-500` → needs a neutral/transfer token
- `mobile-movimientos.tsx`: `text-orange-500` → `text-z-expense`, `text-green-500/600` → `text-z-income`
- Any chart components with hardcoded hex values

### Microinteractions (Framer Motion)

- **Staggered list reveals**: All mobile list views (transactions, payments, budget rows) animate in with staggered delays on mount
- **Page transitions**: Tab switches use a crossfade or slide transition
- **Skeleton loading states**: Data-heavy sections show skeleton placeholders while loading
- **Swipe-to-dismiss**: Dismissable cards (alerts, nudges) support horizontal swipe gesture
- Keep animations short (150-300ms) and purposeful — no gratuitous motion

### Accessibility Fixes

- ARIA labels on all collapsible sections (inbox header, budget sections)
- Keyboard navigation (Enter/Space) for all expandable rows
- Budget warnings: add icon alongside color (not color-only)
- Category chip horizontal scroll: add fade gradient indicators at edges
- Fix Spanish typos: "rapido" → "rápido", "pagina" → "página" in `mobile-sheet-provider.tsx`

---

## Phase 2 — Navigation + Widget System

### Database: dashboard_config

New JSONB column on `profiles` table:

```sql
ALTER TABLE profiles ADD COLUMN dashboard_config jsonb DEFAULT NULL;
```

Shape:

```typescript
interface DashboardConfig {
  purpose: "manage_debt" | "track_spending" | "save_money" | "improve_habits";
  tabs: TabConfig[];
  widgets: WidgetConfig[];
}

interface TabConfig {
  id: string;          // e.g., "debt-recurring", "movimientos"
  label: string;       // e.g., "Deudas"
  icon: string;        // lucide icon name
  features: string[];  // e.g., ["debt", "recurring"]
  position: 2 | 3;     // tab slot (1=Inicio, 4=More, always fixed)
}

interface WidgetConfig {
  id: string;          // e.g., "spending-trend", "debt-progress"
  visible: boolean;
  order: number;
}
```

### Default Configs Per Purpose

| Purpose | Tab 2 | Tab 3 | Top Widgets |
|---------|-------|-------|-------------|
| manage_debt | Deudas+Recurrentes | Presupuesto | debt-progress, next-payment, interest-saved, budget-pulse |
| track_spending | Movimientos | Presupuesto | spending-trend, category-donut, recent-tx, budget-pulse |
| save_money | Presupuesto+Ahorro | Movimientos | available-to-save, budget-remaining, savings-streak, alerts |
| improve_habits | Movimientos+Presupuesto | Recurrentes | habit-score, recurring-health, categorization-nudge, trend |

### localStorage Cache

- Key: `zeta:dashboard_config`
- On profile load: write config to localStorage
- On dashboard render: read localStorage first, fall back to DB fetch
- On config update: write to DB via `updateDashboardConfig()` server action, then update localStorage
- Hook: `useDashboardConfig()` — **client-only hook**. Reads from localStorage on mount, returns config + setter. The setter writes to localStorage immediately (optimistic) and calls the server action in the background.
- **Existing user fallback**: If `dashboard_config` is NULL (users who onboarded before Phase 2), the hook returns a hardcoded default based on `profile.app_purpose`. If `app_purpose` is also NULL, fall back to `track_spending` defaults.
- Server action: `updateDashboardConfig(config: DashboardConfig)` — validates with Zod, upserts on `profiles.dashboard_config`, uses `getAuthenticatedClient()`

### Widget System

Widget registry maps IDs to:
- React component (Client Component)
- Default size (compact/standard)
- Minimum data requirements (e.g., debt-progress needs ≥1 debt account)

**Data fetching architecture**: Widgets receive data as props, NOT via individual server action calls. The dashboard page (Server Component) fetches all needed data in a single `Promise.all` at the page level (extending the existing pattern), then passes data down to widgets via the render engine. This keeps the existing RSC architecture and avoids waterfall client-side fetches. Widgets that need no data (e.g., nudge-cards) can be pure client components.

~8 initial widgets:
1. **spending-trend** — This month vs last, bar or sparkline
2. **budget-pulse** — Overall budget % used, segmented bar
3. **debt-progress** — Total debt trend, payoff ETA
4. **category-donut** — Top categories this month
5. **recent-tx** — Last 3-5 transactions
6. **upcoming-payments** — Next payments due
7. **nudge-cards** — Contextual alerts (existing DashboardAlerts, richer)
8. **habit-score** — % of budget categories on track

Dashboard renders: filter visible widgets → sort by order → render in vertical stack.

### Widget Customization (Hybrid: swipe + settings)

**Swipe-to-dismiss:**
- Horizontal swipe on any widget card → card slides out → "Oculto" undo toast (5s timeout)
- On dismiss: update config (widget.visible = false), sync to DB
- On undo: restore widget, cancel DB update

**Settings page: "Personalizar inicio"**
- Checklist of all widgets with visibility toggle
- Drag handles to reorder (or up/down arrows for a11y)
- "Restaurar predeterminados" button to reset to purpose defaults

### Purpose-Driven Tab Bar

Tab bar reads `dashboard_config.tabs` to render dynamic tabs 2-3. Tab 1 (Inicio) and Tab 4 (Más) are always fixed.

**Structural change required**: The current `BottomTabBar` uses a hardcoded `TABS` array with a left/right split and a center `w-16` gap for the FAB. This must be restructured:
- Replace the hardcoded `TABS` array with a dynamic builder: fixed tab 1 (left) + dynamic tabs 2-3 (from config) + fixed tab 4 (right)
- Maintain the center FAB gap by splitting tabs into `[tab1, tab2]` (left) and `[tab3, tab4]` (right) around the gap div
- The FAB gap width stays at `w-16`

**Route for "Más" tab**: Create a new route `/mas` (or reuse `/gestionar` with redirect). The `/gestionar` page content is replaced with the Profile/More layout. Add a redirect from `/gestionar` → `/mas` for any bookmarks or cached links. Update `getContextActions()` in `mobile-sheet-provider.tsx` if new sub-routes are added.

### Profile/More Tab (replaces Gestionar)

- Profile header: name, purpose badge, avatar placeholder
- Quick links grid: Importar, Cuentas, Destinatarios, Categorías
- Settings section: Moneda, Personalizar inicio, Notificaciones
- Data section: Exportar, Acerca de
- All current Gestionar action cards absorbed here

---

## Phase 3 — Composite Tab Views + Missing Pages

### Composite Views

**MobileDebtRecurrentes** (manage_debt tab 2):
- Debt summary hero (total debt, utilization, monthly interest)
- Upcoming payment timeline (merged from recurring — only debt-related payments)
- Per-account debt cards (balance, rate, min payment)
- Payoff progress indicator

**MobileMovimientosPresupuesto** (improve_habits tab 2):
- Spending summary (expenses vs income this month)
- Category budget progress bars (inline, compact)
- Date-grouped transaction feed with category chips
- Budget context alongside transactions

**MobilePresupuestoAhorro** (save_money tab 2):
- Available to save hero (income - expenses - fixed)
- Budget progress bars (fixed vs variable)
- Unbudgeted spending alerts
- Savings streak (consecutive months where total spending < total budgeted amount across all categories with budgets)

### Remaining Mobile Views

**MobileDeudas** — Standalone debt view for contexts where it's not merged with recurring. Same content as the debt section of MobileDebtRecurrentes.

**MobileImportWizard** — 4-step flow using bottom sheets instead of full pages:
1. Upload PDF (sheet with file picker)
2. Review accounts (sheet with account mapping)
3. Confirm transactions (sheet with selection list)
4. Results (sheet with import summary + diffs)

**MobileAccountDetail** — Simplified version of desktop account detail:
- Stacked info cards (balance, metadata)
- Simplified balance chart (smaller, touch-friendly)
- Statement history timeline (already mobile-friendly)

**MobileSettings** — Grouped sections with clear headers:
- Profile section (name, currency, timezone)
- App section (personalizar inicio, categorías, destinatarios)
- About section

**Smart empty states** — Each section gets a purpose-relevant empty state with a CTA. E.g., empty debt view for a manage_debt user: "Importa tu primer extracto para ver tus deudas aqui."

---

## Phase 4 — Onboarding Redesign

### Updated Flow (6 steps)

**Migration note**: The current onboarding has 4 steps in this order: (1) Objetivo, (2) Finanzas, (3) Perfil, (4) Primera cuenta. The new flow reorders steps 2↔3 and inserts two new steps. The `totalSteps` constant in `onboarding/page.tsx` must be updated from 4 to 6, and analytics events (`onboarding_step_completed`) must be updated to reflect the new step numbers.

1. **Objetivo** (existing, unchanged) — 4 purpose cards: manage_debt, track_spending, save_money, improve_habits
2. **Perfil** (was step 3, moved up) — name, preferred currency, timezone/locale auto-detected
3. **Finanzas** (was step 2, enhanced) — Monthly income, monthly expenses. For `manage_debt` users: also ask "¿Cuantas tarjetas de crédito o préstamos tienes?" (UX expectation-setting only — not stored as a separate field, just used to show a contextual message like "Perfecto, Zeta te ayudará a organizar tus X deudas")
4. **Tu app** (NEW) — Shows phone mockup with personalized tab bar based on purpose. "Basado en tu objetivo, asi se ve tu Zeta:" Each tab labeled with its contents. User can tap tabs 2-3 to swap from available options. Generates `dashboard_config` and writes to profile.
5. **Primera cuenta** (existing, unchanged) — Create first account
6. **Quick win** (NEW) — Purpose-specific first action (opens the relevant existing flow, not a new screen):
   - manage_debt → "Importa tu primer extracto" (link to /import)
   - track_spending → "Registra tu primer gasto" (opens quick capture)
   - save_money → "Configura tu primer presupuesto" (link to /categories)
   - improve_habits → "Registra tu primer gasto" (opens quick capture)
   - All: "Explorar primero" skip option

### Data Written During Onboarding

Step 4 generates and persists `dashboard_config`:
- `purpose`: from step 1
- `tabs`: default for purpose (editable in step 4)
- `widgets`: default widget set for purpose

This is written to `profiles.dashboard_config` and cached in localStorage.

### Onboarding Guard

Existing guard in `(dashboard)/layout.tsx` checks `profile.onboarding_completed`. No changes needed — the redirect to `/onboarding` already works. After step 6, set `onboarding_completed = true` and redirect to dashboard.

---

## Technical Notes

### Dependencies

- No new packages required for Phase 0-1
- Phase 2 widget drag-reorder: evaluate `@dnd-kit/core` or simple up/down arrows (simpler)
- Framer Motion already installed (used for page transitions on desktop)

### Migration Safety

- Phase 0 (brand tokens) is a pure CSS change — update globals.css values, all `z-*` classes auto-update
- Phase 1 is additive (new CSS vars, new motion, new ARIA attrs)
- Phase 2 requires a DB migration (JSONB column, nullable with defaults). **After running the migration, regenerate types**: `npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > src/types/database.ts` — without this, `profile.dashboard_config` will be a TypeScript error.
- Phase 3 is new components, no breaking changes
- Phase 4 modifies existing onboarding (additive steps, backward compatible)

### Each Phase Is Independently Shippable

- Phase 0 can ship alone → immediate visual refresh
- Phase 1 can ship alone → better polish + a11y
- Phase 2 can ship alone → new nav + widgets (using hardcoded defaults until onboarding is updated)
- Phase 3 can ship alone → better mobile coverage
- Phase 4 can ship alone → personalized onboarding (uses Phase 2 config system)

Recommended order: 0 → 1 → 2 → 3 → 4 (each builds on previous)

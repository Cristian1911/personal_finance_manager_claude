# Landing Page Redesign — Spec

**Date:** 2026-04-08  
**Goal:** Replace the 1,500-line all-JSX landing page with a hybrid approach — interactive real components with mock data for hero features, placeholder cards (screenshot-ready) for secondary features, proper mobile experience with hamburger nav and swipeable carousel.

## Problem

1. **No mobile navigation** — below `md` the nav links disappear entirely, no hamburger menu
2. **Showcase panels are massive** — MockShell browser frames stack vertically at full detail, creating endless scroll
3. **No mobile-specific layout** — desktop layout collapsed to 1 column, not designed for mobile
4. **Internal copy visible** — CTA section has meta text ("Lista para publicidad y crecimiento") that's not user-facing
5. **No real product UI** — all mockups are handcrafted JSX, not actual app components
6. **1,561 lines in a single file** — hard to maintain

## Approach

**Hybrid:** Keep the hero as styled JSX, embed 3 real interactive components with mock data, replace the 6 showcase MockShell panels with placeholder cards ready for screenshots.

## Sections (render order)

### 1. Header

**Desktop (md+):** Keep current — logo, nav links (`#showcase`, `#funciones`, `#como-funciona`, `#colombia`, `#faq`), Entrar + Crear cuenta buttons.

**Mobile (<md):** Logo + "Crear cuenta" CTA + hamburger icon. Hamburger opens a vaul `Drawer` from the right with:
- Nav links (same anchors as desktop)
- "Entrar" button
- "Crear cuenta" button

No new dependencies — uses the existing `Drawer` primitive from `@/components/ui/drawer`.

### 2. Hero

**Desktop (lg+):** Two columns — `grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)]`.

- **Left:** Headline, subtitle, CTA buttons (flex-row), 3 highlight pills. Keep current copy.
- **Right:** Interactive dashboard card — a `LandingHeroCard` component rendering:
  - Available to spend (mock: $3,420,000 COP)
  - Spent today vs daily allowance (mock: $45,000 / $180,000)
  - Month map: 6 category progress bars with mock percentages
  - All data from inline constants, no DB

**Mobile (<lg):** Single column — headline, CTAs (flex-col on smallest, flex-row on sm+), then the interactive card below.

### 3. Interactive: Budget Treemap

Full-width section after hero. A `LandingBudgetSection` component:

- Section heading with eyebrow "Presupuesto"
- Renders category spending as colored progress bars with labels and percentages
- 6 categories with mock data: Hogar (84%), Alimentación (62%), Transporte (48%), Salud (30%), Estilo de vida (75%), Obligaciones (92%)
- Hover/tap on a bar shows a tooltip with amount spent / budget
- Wrapped in a card with the standard `bg-white/[0.03] border-white/8` treatment
- Touch-friendly: bars are tall enough for tap targets (min 40px)

### 4. Interactive: Monthly Planning

Full-width section. A `LandingPlanSection` component:

- Section heading with eyebrow "Planificación mensual"
- Renders a simplified plan overview:
  - Income bar: $10,400,000
  - Committed expenses bar: $7,200,000
  - Available balance: $3,200,000
  - 3–4 upcoming obligation items (Arriendo, Servicios, Tarjeta, Crédito vehículo) with dates and amounts
- Visual: stacked horizontal bars showing income vs expenses vs available
- No dependency on recharts — pure CSS bars (same as the hero month map pattern)

### 5. Showcase Section

Replaces the current ~800 lines of MockShell JSX panels.

**6 panels:** Import Flow, Cuentas, Destinatarios, Deuda, Recurrentes, Quick Capture.

Each panel is a card with:
- Icon (from lucide-react)
- Title
- One-liner description
- Placeholder area: category-colored gradient background + centered icon + "Vista previa próximamente" text
- The placeholder area is sized to match a future screenshot (`aspect-video` on desktop, `aspect-[9/16]` in phone frames on mobile)

**Desktop (lg+):** `grid-cols-2` layout, 3 rows of 2 cards.

**Mobile (<lg):** Horizontal swipeable carousel.
- CSS `scroll-snap-type: x mandatory` on a flex container with `overflow-x: auto`
- Each slide is a phone-frame card: `max-w-[280px]`, `rounded-[2rem]`, notch element at top
- Dot indicators below the carousel (pure CSS, highlighted via `:has()` or IntersectionObserver)
- No JS carousel library — CSS scroll-snap is sufficient

### 6. Features Grid

Keep current structure:
- `grid-cols-1` mobile / `lg:grid-cols-2` / `xl:grid-cols-3`
- 6 FeatureCard components — unchanged

### 7. Para quién + Colombia

Keep current structure:
- `lg:grid-cols-[1.05fr_0.95fr]`
- Content unchanged

### 8. Cómo Funciona

Keep current structure:
- `lg:grid-cols-3`, 3 step cards
- Content unchanged

### 9. CTA Section

**Rewrite copy.** Remove:
- Badge "Lista para publicidad y crecimiento"
- Body text "Este landing deja visible la historia completa de Zeta..."

Replace with:
- Badge: "Empieza hoy"
- Heading: "Toma el control de tus finanzas"
- Body: "Zeta te da claridad diaria sobre tu dinero — sin conectar bancos, sin compartir credenciales. Importa tus extractos PDF y empieza a planificar en minutos."
- CTAs: "Crear cuenta gratis" (primary) + "Ver cómo funciona" (ghost, scrolls to #como-funciona)
- Right column: 4 feature blurbs — keep structure, update copy to remove internal language

### 10. FAQ + Footer

Keep as-is. No changes needed.

## File Structure

```
webapp/src/components/marketing/
├── landing-page.tsx          # Main page — imports sections
├── landing-header.tsx        # Header with mobile hamburger
├── landing-hero.tsx          # Hero section + interactive card
├── landing-budget.tsx        # Interactive budget treemap
├── landing-plan.tsx          # Interactive monthly planning
├── landing-showcase.tsx      # Screenshot placeholder grid/carousel
├── landing-features.tsx      # 6 feature cards (extracted from current)
├── landing-cta.tsx           # CTA section with rewritten copy
├── landing-data.ts           # All mock data constants
└── phone-frame.tsx           # Reusable phone-shaped frame component
```

Split the 1,561-line monolith into focused files. `landing-page.tsx` becomes a thin compositor importing sections.

## Mock Data (`landing-data.ts`)

All inline constants, same shape as domain types but hardcoded:

```typescript
export const LANDING_HERO_DATA = {
  availableToSpend: 3_420_000,
  spentToday: 45_000,
  dailyAllowance: 180_000,
  currency: "COP" as const,
};

export const LANDING_BUDGET_DATA = [
  { name: "Hogar", spent: 1_848_000, budget: 2_200_000, color: "#5CB88A" },
  { name: "Alimentación", spent: 496_000, budget: 800_000, color: "#D4A843" },
  // ... 4 more
];

export const LANDING_PLAN_DATA = {
  income: 10_400_000,
  committed: 7_200_000,
  available: 3_200_000,
  obligations: [
    { name: "Arriendo", amount: 1_850_000, dueDate: "01 May", paid: false },
    // ... 3 more
  ],
};

export const LANDING_SHOWCASE_PANELS = [
  { id: "import", title: "Importación de extractos", description: "...", icon: "FileUp", color: "#D4A843" },
  // ... 5 more
];
```

## Technical Constraints

- **No new dependencies** — carousel via CSS scroll-snap, drawer via existing vaul primitive
- **No DB calls** — all data from `landing-data.ts` constants
- **No recharts** — pure CSS bars for budget/plan visualizations
- **`"use client"` only on interactive sections** — header (drawer state), hero card (hover), budget (tooltips), plan (expand)
- **Phone frame** — simple `div` with `rounded-[2rem]`, pseudo-element notch, `bg-z-ink` body. No library.
- **Screenshot placeholders** — `aspect-video` (desktop) / `aspect-[9/16]` (mobile) containers with gradient + icon. Ready to swap for `<Image>` when screenshots are captured.

## Out of Scope

- Actual screenshots (follow-up task after demo mode is deployed)
- Animations/transitions beyond CSS transitions already in use
- SEO metadata changes
- A/B testing infrastructure
- Analytics events

# Landing Page Redesign — Storytelling Arc + Mobile

**Date:** 2026-04-09  
**Scope:** Landing page only (`webapp/src/components/marketing/`)  
**Visual companion:** `docs/visual-companions/ux-improvements-april-2026.html` (mobile UX section)

---

## Problem

The landing page has two structural issues:

1. **No narrative arc.** Sections appear in arbitrary order: Hero → Budget demo → Plan demo → Showcase carousel → Feature grid → Audience → How it works → CTA → FAQ. The user sees proof (Budget, Plan) before understanding the process (How it works), and features are explained twice (Showcase + Features) with different content.

2. **Mobile is not fully thought through.** The hero card (dashboard preview) is too heavy for mobile screens <375px. Section padding (`py-24` = 96px) wastes scroll space. The showcase carousel uses a fixed 280px card width that can overflow on 320px screens. Highlight cards force 3 columns at `sm` breakpoint on text-heavy cards.

---

## Design

### Section Reorder — Storytelling Arc

```
ACT 1: HOOK (Problem → Promise)
  └─ Hero — "Claridad diaria sobre tu dinero"

ACT 2: PROCESS ("It's easy")
  └─ HowItWorks — 3 steps, moved from position 8 to position 3

ACT 3: PROOF ("See it in action")
  ├─ Budget — interactive budget demo
  ├─ Plan — income distribution + obligations
  └─ Showcase — visual feature walkthrough (absorbs Features)

ACT 4: TRUST ("Made for you")
  └─ Audience + Colombia — profiles + bank support

ACT 5: ACTION
  ├─ CTA — final conversion
  └─ FAQ — objection handling
```

### Removed: `LandingFeatures`

The 6-card Features grid overlaps heavily with the 6-panel Showcase:

| Showcase Panel | Features Card |
|----------------|---------------|
| Importacion de extractos | Importacion de extractos PDF |
| Dashboard de margen diario | Dashboard que responde que hacer hoy |
| Destinatarios inteligentes | Recurrentes, destinatarios y orden operativo |
| Estrategia de deuda | Deudas con estrategia, no solo saldo |
| Recurrentes y pagos proximos | (covered by above) |
| Registro rapido | Presupuesto 50/30/20 / Multi-moneda |

Showcase panels are more visual and scannable. Features cards add bullet lists that duplicate the same information. Remove `LandingFeatures` and give Showcase a proper `SectionHeading`.

### New `landing-page.tsx` order

```tsx
<LandingHeader />
<main>
  <LandingHero />
  <LandingHowItWorks />
  <LandingBudget />
  <LandingPlan />
  <LandingShowcase />
  <LandingAudience />
  <LandingCTA />
  <LandingFAQ />
</main>
<Footer />
```

### Copy Refinements

**Hero H1:**
- Current: "Tu dinero deja de sentirse confuso y empieza a contar una historia clara."
- New: "Claridad diaria sobre tu dinero."
- Rationale: Shorter, punchier. The subtitle carries the detail.

**Hero subtitle:**
- Current: "Zeta reune extractos, presupuesto, deudas, cuentas y pagos recurrentes para darte una vista accionable de tus finanzas personales en Colombia."
- New: "Extractos, presupuesto, deudas y pagos recurrentes en una sola vista. Sin conectar tu banco. Hecho para Colombia."
- Rationale: Shorter sentences, easier to scan on mobile.

**Showcase SectionHeading (new):**
- Eyebrow: "Todo lo que hace"
- Title: "Herramientas que responden preguntas, no crean trabajo"
- Description: "Cada modulo esta pensado para responderte algo concreto sobre tu dinero."

### Mobile-Specific Fixes

#### 1. Hero card — mobile alternative

**Current:** `HeroCard` renders the full dashboard preview at all breakpoints. On <375px it compresses awkwardly.

**Change:** Hide `HeroCard` on mobile, show a condensed stat strip:

```tsx
{/* Desktop: full preview card */}
<div className="hidden lg:block">
  <HeroCard />
</div>

{/* Mobile: condensed stat strip */}
<div className="lg:hidden">
  <MobileHeroStrip />
</div>
```

`MobileHeroStrip`: A compact card showing just the key numbers:
- "Disponible: $1.850.000" (large)
- "Gasto hoy: $87.500 / $113.000" (progress bar)
- Same border/shadow tokens as the full card

#### 2. Hero highlights — stack on mobile

**Current:** `sm:grid-cols-3` — 3 columns starting at 640px.  
**Change:** `md:grid-cols-3` — 3 columns starting at 768px. On smaller screens, stack vertically.

#### 3. Showcase carousel — responsive card width

**Current:** `CARD_WIDTH = 280` (fixed px).  
**Change:** Use CSS `min()` to prevent overflow:

```tsx
const CARD_WIDTH_CSS = "min(280px, calc(100vw - 48px))";
```

Apply via inline `style` on carousel items. The padding calculation also needs to reference this value.

#### 4. Section spacing — reduce on mobile

**Current:** All sections use `py-24` (96px top + bottom).  
**Change:** `py-16 sm:py-24` throughout. 64px on mobile, 96px on desktop.

Affected files: `landing-features.tsx` (HowItWorks, FAQ), `landing-budget.tsx`, `landing-plan.tsx`, `landing-cta.tsx`, `landing-showcase.tsx`.

#### 5. Hero section padding

**Current:** `pb-20 pt-16 sm:pt-24` — hero has custom padding.  
**Change:** `pb-12 pt-12 sm:pb-20 sm:pt-24` — tighter on mobile.

#### 6. CTA 2x2 grid

Already stacks to 1 column on mobile (`sm:grid-cols-2`). No change needed.

---

## Files Changed

| File | Change |
|------|--------|
| `landing-page.tsx` | Reorder sections, remove `LandingFeatures` import |
| `landing-hero.tsx` | Add `MobileHeroStrip`, hide `HeroCard` on mobile, refine H1/subtitle, fix highlights grid |
| `landing-features.tsx` | Remove `LandingFeatures` export and `FeatureCard`. Keep `LandingAudience`, `LandingHowItWorks`, `LandingFAQ`. Reduce padding to `py-16 sm:py-24` |
| `landing-showcase.tsx` | Add `SectionHeading` with heading text. Fix carousel card width for small screens. Reduce padding |
| `landing-budget.tsx` | Reduce section padding to `py-16 sm:py-24` |
| `landing-plan.tsx` | Reduce section padding to `py-16 sm:py-24` |
| `landing-cta.tsx` | Reduce section padding to `py-16 sm:py-24` |
| `landing-data.ts` | Remove `LANDING_FEATURES` export |

**No new files.** No new components beyond `MobileHeroStrip` (inline in `landing-hero.tsx`).

---

## Agent Review Gates

After implementation:

1. **`zetas-front-guy`** — design system compliance on all TSX changes
2. **`perf-auditor`** — ensure no new client-side bundles or heavy imports

---

## Out of Scope

- Landing page animations/transitions
- New interactive demos
- A/B testing infrastructure
- Analytics/conversion tracking
- Auth flow changes
- Dark/light mode toggle
- New FAQ questions
- Social proof / testimonials (no data yet)

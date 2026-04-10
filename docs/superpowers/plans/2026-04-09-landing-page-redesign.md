# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the landing page into a storytelling arc (Hook → Process → Proof → Trust → Action), remove redundant Features section, and fix mobile responsiveness.

**Architecture:** Pure front-end changes to marketing components. No new data fetching, no server actions, no API changes. Section reordering in the page wrapper, copy refinements, and responsive fixes.

**Tech Stack:** Next.js 15, React 19, Tailwind v4, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-04-09-landing-page-redesign.md`

**Review agents:** `zetas-front-guy` (every TSX change), `perf-auditor` (bundle check)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `webapp/src/components/marketing/landing-page.tsx` | Modify | Reorder sections, remove `LandingFeatures` import |
| `webapp/src/components/marketing/landing-hero.tsx` | Modify | Refine copy, add `MobileHeroStrip`, fix highlights grid |
| `webapp/src/components/marketing/landing-features.tsx` | Modify | Remove `LandingFeatures` + `FeatureCard`, reduce padding on remaining sections |
| `webapp/src/components/marketing/landing-showcase.tsx` | Modify | Add section heading, fix carousel card width, reduce padding |
| `webapp/src/components/marketing/landing-budget.tsx` | Modify | Reduce padding |
| `webapp/src/components/marketing/landing-plan.tsx` | Modify | Reduce padding |
| `webapp/src/components/marketing/landing-cta.tsx` | Modify | Reduce padding |
| `webapp/src/components/marketing/landing-data.ts` | Modify | Remove `LANDING_FEATURES` export |

---

### Task 1: Remove `LandingFeatures` and clean up data

**Files:**
- Modify: `webapp/src/components/marketing/landing-data.ts:119-202`
- Modify: `webapp/src/components/marketing/landing-features.tsx:49-105`

- [ ] **Step 1: Remove `LANDING_FEATURES` from `landing-data.ts`**

Delete the `Feature` type (lines 121-127) and `LANDING_FEATURES` array (lines 129-202). Keep everything else.

- [ ] **Step 2: Remove `LandingFeatures` and `FeatureCard` from `landing-features.tsx`**

Delete `FeatureCard` function (lines 51-86) and `LandingFeatures` function (lines 90-105). Remove the `LANDING_FEATURES` import from line 12. Remove the `CheckCircle2` import from line 1 and the `Feature` type import.

Keep: `SectionHeading`, `LandingAudience`, `LandingHowItWorks`, `LandingFAQ`. Update exports accordingly.

- [ ] **Step 3: Verify build compiles**

Run: `cd webapp && pnpm build`

- [ ] **Step 4: Commit**

```
refactor: remove redundant LandingFeatures section (Showcase covers it)
```

---

### Task 2: Reorder sections in `landing-page.tsx`

**Files:**
- Modify: `webapp/src/components/marketing/landing-page.tsx:1-52`

- [ ] **Step 1: Remove `LandingFeatures` import and reorder**

Update imports — remove `LandingFeatures` from the import on line 9:
```ts
import {
  LandingAudience,
  LandingHowItWorks,
  LandingFAQ,
} from "./landing-features";
```

Reorder `<main>` children (lines 25-35):
```tsx
<main className="relative">
  <LandingHero />
  <LandingHowItWorks />
  <LandingBudget />
  <LandingPlan />
  <LandingShowcase />
  <LandingAudience />
  <LandingCTA />
  <LandingFAQ />
</main>
```

- [ ] **Step 2: Verify build compiles**

Run: `cd webapp && pnpm build`

- [ ] **Step 3: Commit**

```
feat: reorder landing page sections into storytelling arc
```

---

### Task 3: Refine hero copy and add mobile hero strip

**Files:**
- Modify: `webapp/src/components/marketing/landing-hero.tsx:1-186`

- [ ] **Step 1: Update H1 and subtitle copy**

Replace the H1 at line 131-134:
```tsx
<h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-7xl">
  Claridad diaria sobre tu dinero.
</h1>
```

Replace the subtitle at lines 135-139:
```tsx
<p className="max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
  Extractos, presupuesto, deudas y pagos recurrentes en una sola
  vista. Sin conectar tu banco. Hecho para Colombia.
</p>
```

- [ ] **Step 2: Fix hero highlights grid breakpoint**

Change line 163 from `sm:grid-cols-3` to `md:grid-cols-3`:
```tsx
<div className="grid gap-4 md:grid-cols-3">
```

- [ ] **Step 3: Reduce hero section padding**

Update the `<section>` at line 121:
```tsx
<section className="mx-auto max-w-7xl px-6 pb-12 pt-12 sm:pb-20 sm:pt-24">
```

- [ ] **Step 4: Add `MobileHeroStrip` and split hero card rendering**

Add a `MobileHeroStrip` function before `LandingHero`:

```tsx
function MobileHeroStrip() {
  const { availableToSpend, spentToday, dailyAllowance } = LANDING_HERO_DATA;
  const spentPct = Math.round((spentToday / dailyAllowance) * 100);

  return (
    <Card className="overflow-hidden rounded-2xl border-white/10 bg-[#111111]/90 shadow-xl shadow-black/20">
      <div className="px-5 py-4">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Disponible para gastar
        </p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">
          {formatCurrency(availableToSpend, "COP")}
        </p>

        <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Gasto hoy</span>
            <span>
              <span className="font-medium">
                {formatCurrency(spentToday, "COP")}
              </span>
              <span className="ml-1 text-[10px] text-muted-foreground">
                / {formatCurrency(dailyAllowance, "COP")}
              </span>
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/8">
            <div
              className="h-1.5 rounded-full bg-primary"
              style={{ width: `${Math.min(spentPct, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 5: Split hero card rendering by breakpoint**

In the grid at line 122, replace the `<HeroCard />` call with:
```tsx
{/* Right column — dashboard card */}
<div className="hidden lg:block">
  <HeroCard />
</div>
<div className="lg:hidden">
  <MobileHeroStrip />
</div>
```

- [ ] **Step 6: Verify build compiles**

Run: `cd webapp && pnpm build`

- [ ] **Step 7: Commit**

```
feat: hero copy refinement, mobile hero strip, responsive highlights
```

---

### Task 4: Add section heading to Showcase and fix carousel

**Files:**
- Modify: `webapp/src/components/marketing/landing-showcase.tsx:64-198`

- [ ] **Step 1: Update section heading text**

Replace the heading block at lines 170-182:
```tsx
<div className="mb-12 flex flex-col items-center gap-4 text-center">
  <Badge variant="outline" className="border-white/10 bg-white/4 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-z-sage-light">
    Todo lo que hace
  </Badge>
  <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
    Herramientas que responden preguntas, no crean trabajo
  </h2>
  <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
    Cada modulo esta pensado para responderte algo concreto sobre tu dinero.
  </p>
</div>
```

- [ ] **Step 2: Reduce section padding**

At line 167, change:
```tsx
<section id="showcase" className="px-4 py-16 sm:py-24">
```

- [ ] **Step 3: Fix carousel card width for small screens**

Replace the fixed `CARD_WIDTH` constant at line 64 and update the carousel. Change the card rendering to use responsive width:

At line 112, change the inline style:
```tsx
style={{ width: "min(280px, calc(100vw - 48px))" }}
```

Update the padding calculations at lines 102-103:
```tsx
paddingLeft: "max(16px, calc(50% - 140px))",
paddingRight: "max(16px, calc(50% - 140px))",
```

The scroll calculation at line 79 still uses `CARD_WIDTH` + `CARD_GAP` — keep the JS constant for scroll math, since `280px` is the max card width and the snap behavior works correctly.

- [ ] **Step 4: Verify build compiles**

Run: `cd webapp && pnpm build`

- [ ] **Step 5: Commit**

```
feat: showcase heading, responsive carousel card width
```

---

### Task 5: Reduce padding on remaining sections

**Files:**
- Modify: `webapp/src/components/marketing/landing-budget.tsx:23`
- Modify: `webapp/src/components/marketing/landing-plan.tsx:20`
- Modify: `webapp/src/components/marketing/landing-cta.tsx:36`
- Modify: `webapp/src/components/marketing/landing-features.tsx` (HowItWorks, FAQ)

- [ ] **Step 1: `landing-budget.tsx` — line 23**

Change `py-24` to `py-16 sm:py-24`:
```tsx
<section className="px-4 py-16 sm:py-24">
```

- [ ] **Step 2: `landing-plan.tsx` — line 20**

Change `py-24` to `py-16 sm:py-24`:
```tsx
<section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
```

- [ ] **Step 3: `landing-cta.tsx` — line 36**

Change `py-24` to `py-16 sm:py-24`:
```tsx
<section className="py-16 sm:py-24">
```

- [ ] **Step 4: `landing-features.tsx` — `LandingHowItWorks` (line 215) and `LandingFAQ` (line 251)**

Change both `py-24` to `py-16 sm:py-24`:
```tsx
// LandingHowItWorks
<section id="como-funciona" className="space-y-12 py-16 sm:py-24">

// LandingFAQ
<section id="faq" className="space-y-12 py-16 sm:py-24">
```

- [ ] **Step 5: Verify build compiles**

Run: `cd webapp && pnpm build`

- [ ] **Step 6: Commit**

```
fix: reduce section padding on mobile (py-16 sm:py-24)
```

---

### Task 6: Build gate + agent reviews

- [ ] **Step 1: Run full build**

Run: `cd webapp && pnpm install && pnpm build`

Expected: Clean build, no errors.

- [ ] **Step 2: Run `zetas-front-guy` agent review**

Spawn `zetas-front-guy` to review all changed TSX files for design token compliance.

- [ ] **Step 3: Fix any issues from reviews**

- [ ] **Step 4: Final commit if review fixes were needed**

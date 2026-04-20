# Zeta Design Tokens — Mobile-First

Canonical patterns for all UI surfaces. Every component should use these tokens.
When in doubt, use the mobile variant.

---

## 1. Eyebrow Label

The small uppercase label above page/section titles.

```
text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark
```

- Always `tracking-[0.18em]` — not `tracking-wide`, not `tracking-wider`, not `[0.22em]`, not `[0.2em]`
- Always `text-[10px]` for mobile, `text-xs` for desktop
- `text-[9px]` is permitted ONLY inside extremely tight tiles (≤ 28px height) where no other size fits
- `text-[8px]` is never permitted
- Color: `text-z-sage-dark` for page-level, `text-muted-foreground` for section-level

## 2. Page Title

```
text-2xl font-semibold tracking-tight        /* mobile */
text-3xl font-semibold tracking-tight        /* desktop (lg:) */
```

## 3. Card Containers

Four tiers, each with one canonical definition. Prefer the `styles.ts` constant when one exists.

### Tier 0: Feature Hero (page-level hero sections)
```
rounded-[28px] border border-white/6 px-5 py-6
shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]
+ radial gradient background (use <PageHero /> which handles variants)
```
Used in: `PageHero`, dashboard/plan hero, import wizard hero. The `rounded-[28px]` radius is INTENTIONAL and permitted only for this tier.

### Tier 1: Surface card (primary containers)
```
rounded-2xl border border-white/6 bg-z-surface-2/80 p-4
shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]
```
Constant: `PANEL_SURFACE_CLASS`. Use `PANEL_SURFACE_SUBTLE_CLASS` for the softer `bg-z-surface-2/55` variant.

### Tier 2: Compact card (list items, mobile tiles)
```
rounded-xl border border-white/6 bg-[#111] px-3 py-2
```
Constants: `MOBILE_CARD_CLASS`, `MOBILE_CARD_TIGHT_CLASS` for mobile v2.

### Tier 3: Stat box / inset panel (metric displays)
```
rounded-2xl border border-white/6 bg-black/10 p-4
```
Constants (`styles.ts`):
- `PANEL_INSET_CLASS` — standard inset stat box
- `PANEL_INSET_INTERACTIVE_CLASS` — hoverable/tappable inset tile
- `PANEL_INSET_SUBTLE_CLASS` — low-contrast variant

### Rules:
- Border is always `border-white/6` — not `/4`, not `/8`, not `/10`
- Never use `border-z-border` (deprecated, use `border-white/6`)
- Border-radius: `rounded-[28px]` (Tier 0 only), `rounded-2xl` (large), `rounded-xl` (compact)
- Never use `rounded-[18px]` or other arbitrary radii outside Tier 0

## 4. Progress Bars

```
/* Container */
h-2 w-full rounded-full bg-muted overflow-hidden

/* Fill */
h-full rounded-full transition-all
```

- Default height: `h-2`
- Exceptions:
  - `h-1` — mini bars inside tight tiles (≤ 28px height)
  - `h-1.5` — medium bars in dense panels (cashflow planner, compact cards)
- Never use `h-3`, `h-[3px]`, or arbitrary values
- Color thresholds (apply exact cutoffs — do not round):
  - `>= 100%` → `bg-red-500` (or `bg-z-debt`)
  - `>= 75%`  → `bg-yellow-500` (or `bg-z-alert`)
  - `< 75%`   → `bg-emerald-500` (or `bg-z-income`)
  - No budget → `bg-muted-foreground/30`
- Never use gradient fills on progress bars — the threshold color must be a single solid class

## 5. Section Divider

```html
<div className="flex items-center gap-3 py-1">
  <span className="h-px flex-1 bg-white/6" />
  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
    {label}
  </span>
  <span className="h-px flex-1 bg-white/6" />
</div>
```

- Line color: `bg-white/6` — not hardcoded hex
- Label uses same eyebrow token

## 6. Metric Display

Currency amounts that need to be scannable:

```
text-lg font-semibold tabular-nums           /* standard */
text-[32px] font-extrabold tabular-nums      /* full hero/primary number */
text-[28px] font-extrabold tabular-nums      /* mobile compact hero (tiles) */
text-[22px] font-extrabold tabular-nums      /* widget-large (dashboard KPI widgets) */
text-sm  font-semibold tabular-nums          /* inline/compact */
```

- Always include `tabular-nums` on financial amounts
- Use `font-extrabold` — avoid ad-hoc numeric weights (`font-[680]` is not permitted)
- Color: default for neutral, `text-red-500` (or `text-z-debt`) for negative, `text-emerald-500` (or `text-z-income`) for positive

## 7. Buttons

Three variants defined in `lib/constants/styles.ts`:

```ts
BRASS_BUTTON_CLASS       = "bg-z-brass text-z-ink hover:bg-z-brass/90"
GHOST_BUTTON_CLASS       = "border-white/8 bg-black/10 text-z-sage-light hover:bg-white/5"
BRASS_GHOST_BUTTON_CLASS = "border-z-brass/20 bg-z-brass/8 text-z-brass hover:bg-z-brass/12"
MOBILE_ACTION_BUTTON_CLASS = /* small brass-ghost for mobile micro-actions */
```

- Primary actions: `BRASS_BUTTON_CLASS`
- Secondary actions: `GHOST_BUTTON_CLASS`
- Accent links: `BRASS_GHOST_BUTTON_CLASS`
- Mobile micro-actions (tile CTAs, inline row actions): `MOBILE_ACTION_BUTTON_CLASS`
- Text on brass is always `text-z-ink` — never `text-z-white`
- Never invent a fourth variant inline. New variants must land in `styles.ts` first.

## 8. List Items

```
/* Standard row */
flex items-center justify-between py-2 px-1

/* With icon */
flex items-center gap-2.5 py-2

/* Icon container */
flex size-7 shrink-0 items-center justify-center rounded-md
style={{ backgroundColor: `${color}20`, color }}

/* Icon size */
size-4 (standard), size-3.5 (compact)
```

## 9. Month Selector

Always use `<MonthSelector />` component directly. No custom wrappers.
The component handles its own styling consistently.

## 10. Color Semantics

```
Positive/income:  text-emerald-500 or text-z-income
Negative/debt:    text-red-500 or text-z-debt
Warning:          text-amber-400 or text-z-expense
Neutral accent:   text-z-brass
Muted text:       text-muted-foreground
```

- Never use hardcoded hex for semantic colors (no `#3a3a3a`, no `#c44`)
- Use CSS variables via Tailwind classes

## 11. Semantic Surface Utilities

Defined in `globals.css` — use for semantic chips, badges, and small tinted surfaces:

```
.surface-income   /* z-income tint — inflow chips, positive badges */
.surface-expense  /* z-expense tint — outflow chips */
.surface-debt     /* z-debt tint — debt pills, alert badges */
.surface-alert    /* z-alert tint — warning pills */
.surface-neutral  /* z-sage-dark tint — neutral/pending badges */
```

Each applies color + border (20% alpha) + background (8% alpha) via `color-mix`. Prefer these over composing your own tint classes.

## 12. Charts (Recharts / SVG primitives)

Recharts and raw SVG do not accept CSS variables directly in all props. The ONLY hex values permitted as chart fallbacks are the Zeta semantic tokens:

```
z-income    #5CB88A
z-expense   #E8875A
z-debt      #E05545
z-alert     #D4A843
z-excellent #3D9E6E
z-brass     #937844
z-sage      #768053
z-sage-dark #938C7E
```

Any other hex in a chart file (e.g. `#3b82f6`, `#8b5cf6`, `#a1a1aa`) is a violation. Bank-branded card gradients (`accounts/card-face.tsx`) are the one documented exception — those are brand assets per bank and must live only in that file.

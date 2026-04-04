# Zeta Design Tokens — Mobile-First

Canonical patterns for all UI surfaces. Every component should use these tokens.
When in doubt, use the mobile variant.

---

## 1. Eyebrow Label

The small uppercase label above page/section titles.

```
text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark
```

- Always `tracking-[0.18em]` — not `tracking-wide`, not `[0.22em]`, not `[0.2em]`
- Always `text-[10px]` for mobile, `text-xs` for desktop
- Color: `text-z-sage-dark` for page-level, `text-muted-foreground` for section-level

## 2. Page Title

```
text-2xl font-semibold tracking-tight        /* mobile */
text-3xl font-semibold tracking-tight        /* desktop (lg:) */
```

## 3. Card Containers

Three tiers, each with one canonical definition:

### Tier 1: Surface card (primary containers, hero sections)
```
rounded-2xl border border-white/6 bg-z-surface-2/80 p-4
shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]
```

### Tier 2: Compact card (list items, mobile tiles)
```
rounded-xl border border-white/6 bg-[#111] px-3 py-2
```

### Tier 3: Stat box (metric displays)
```
rounded-2xl border border-white/6 bg-black/10 p-4
```

### Rules:
- Border is always `border-white/6` — not `/4`, not `/8`
- Never use `border-z-border` (deprecated, use `border-white/6`)
- Border-radius: `rounded-2xl` for large cards, `rounded-xl` for compact
- Never use arbitrary values like `rounded-[18px]` or `rounded-[28px]`

## 4. Progress Bars

```
/* Container */
h-2 w-full rounded-full bg-muted overflow-hidden

/* Fill */
h-full rounded-full transition-all
```

- Height: always `h-2` — not `h-1.5`, not `h-3`, not `h-[3px]`
- Exception: mini bars inside tight spaces use `h-1`
- Color thresholds:
  - `>= 100%` → `bg-red-500`
  - `>= 75%` → `bg-yellow-500`  
  - `< 75%` → `bg-emerald-500`
  - No budget → `bg-muted-foreground/30`

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
text-[32px] font-extrabold tabular-nums      /* hero/primary number */
text-sm font-semibold tabular-nums           /* inline/compact */
```

- Always include `tabular-nums` on financial amounts
- Color: default for neutral, `text-red-500` for negative, `text-emerald-500` for positive

## 7. Buttons

Three variants defined in `lib/constants/styles.ts`:

```ts
BRASS_BUTTON_CLASS    = "bg-z-brass text-z-ink hover:bg-z-brass/90"
GHOST_BUTTON_CLASS    = "border-white/8 bg-black/10 text-z-sage-light hover:bg-white/5"
BRASS_GHOST_BUTTON_CLASS = "border-z-brass/20 bg-z-brass/8 text-z-brass hover:bg-z-brass/12"
```

- Primary actions: `BRASS_BUTTON_CLASS`
- Secondary actions: `GHOST_BUTTON_CLASS`  
- Accent links: `BRASS_GHOST_BUTTON_CLASS`
- Text on brass is always `text-z-ink` — never `text-z-white`

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

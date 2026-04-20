# Zeta — Brand & Design Brief (Mobile-First)

One-page summary for design tools. Pair with `tokens/TOKENS.md` (component rules), `mobile-screens/` (ground-truth screens), and `storybook-static/` (live components).

## What Zeta is

A personal finance manager for Colombian users. Tracks transactions across banks (PDF statement import), manages budgets with 50/30/20 allocation, models debt payoff, handles multi-currency accounts. **Dark-mode-first. Mobile-first. Spanish UI.**

## Primary surface: mobile

Zeta is used on a phone. A user opens it on the bus to check whether a Bancolombia charge cleared, adds a quick expense from a coffee shop, or reviews last month's budget while waiting in line. The webapp exists and mirrors mobile composition, but every design decision starts from the 390×844 viewport and scales up. If something doesn't fit on mobile, it doesn't ship on mobile.

## Core principle

> **Every screen should answer "Am I on track?" without explanation.**

Data is present — the job is presenting it with purpose, hierarchy, and visual clarity so the user feels informed, not overwhelmed. On mobile, this means one clear answer above the fold, supporting detail below.

## Brand identity — "Obsidian & Brass" / "Sage Evolved"

Editorial, grown-up, quietly confident. Dark canvas with warm sage-olive tones and a brass accent. Not a fintech neon dashboard, not a minimalist white app. Think: private-wealth quarterly on dark paper, folded into your pocket.

### Palette (see `tokens/colors.css`)

- **Background**: `#121412` ink. Layered surfaces step up in luminance: `#171A17` → `#1E221E` → `#262B26`.
- **Brand core**: olive-deep `#3F4632`, sage `#768053`, brass `#937844` (primary CTA).
- **Foreground**: warm off-white `#F6F0E3` for text, `#D9CCB9` sage-light for secondary, `#938C7E` sage-dark for muted.
- **Borders**: sage-tinted alpha (`rgba(217,204,185,0.08)`) — never flat gray. Always `border-white/6` in Tailwind.
- **Financial semantics**: income `#5CB88A`, expense `#E8875A`, debt `#E05545`, alert `#D4A843`, excellent `#3D9E6E`.

### Typography

- Geist Sans (body, UI) + Geist Mono (monospace accents).
- Financial numbers **always `tabular-nums`** so columns align.
- Eyebrow label (ubiquitous): `text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark`.
- Hero numbers: `text-[32px] font-extrabold tabular-nums`.
- On mobile, page title is `text-2xl font-semibold tracking-tight` (desktop bumps to `text-3xl`).

## Mobile layout rules

- **Viewport target**: 390 × 844 (iPhone 14-class). Design for 360 minimum width without breakage.
- **Tab bar**: 5 slots — dashboard, transactions, add (brass center FAB-style), budgets, profile. ~56px tall. Every bottom sheet must pad with `MOBILE_TAB_BAR_CLEARANCE_CLASS` so content isn't hidden.
- **Safe areas**: respect top notch and bottom home indicator. Eyebrow labels often sit below the notch as the first real content.
- **One-handed reach**: primary actions belong in the bottom third of the screen. Destructive actions require confirm sheets, never instant.
- **Sheets over modals**: bottom sheets (`vaul`) for all secondary flows. Rarely full-screen modals.
- **Horizontal rhythm**: 16 px (`p-4`) is the default page gutter. Cards inside lists use 12 px internal padding.
- **Vertical rhythm**: 8 px between tight elements, 16 px between related sections, 24 px between unrelated sections.
- **Lists are the dominant pattern**, not grids. Tier-2 compact cards stacked vertically, each ≥ 44 px tap target.
- **No hover-dependent affordances** — everything must work on touch. Swipe actions OK where metaphors are obvious (swipe to categorize, etc.).

## Visual grammar

1. **Card tiers, not one-size cards.**
   - Tier 1 surface card — primary containers, hero sections (`rounded-2xl bg-z-surface-2/80 p-4` + inset highlight shadow).
   - Tier 2 compact card — list items, mobile tiles (`rounded-xl bg-[#111] px-3 py-2`).
   - Tier 3 stat box — metric displays (`rounded-2xl bg-black/10 p-4`).

2. **Progress bars are h-2, thresholded by color** (emerald < 75%, yellow ≥ 75%, red ≥ 100%).

3. **Eyebrow + title + metric stack** — every widget leads with a tiny uppercase label, then a tight title, then the number.

4. **Section dividers**: hairline `bg-white/6` with centered eyebrow label.

5. **Buttons**: only three variants.
   - **Brass** primary (`bg-z-brass text-z-ink`).
   - **Ghost** secondary (`border-white/8 bg-black/10 text-z-sage-light`).
   - **Brass-ghost** accent link (`border-z-brass/20 bg-z-brass/8 text-z-brass`).

6. **Icon chips** for categories: `size-7 rounded-md` tinted by category color at 20% alpha, icon in the category's own color. Same pattern used for account types and destinatarios.

7. **No hardcoded colors in components.** Every color is a token. New colors require adding a token first.

## Tone of voice

- **Spanish-first** (Colombian register). All user-facing strings in Spanish.
- Direct, human, short. No finance jargon. No "synergy-speak."
- Informed not alarmist — attention surfaces nudge, they don't shout.
- Numbers carry the narrative; copy supports, doesn't decorate.

## Motion

Speed over animation. Page enter is a 0.1s 3px lift. No extraneous easing. Optimistic updates preferred; users should feel the app respond instantly. Avoid heavy client libs. On mobile, perceived snappiness beats any transition.

## Core mobile surfaces (map to `mobile-screens/`)

1. **Dashboard** (`01-dashboard.png`) — widgets answering "Am I on track?" (health score, cashflow, upcoming, budget status).
2. **Transactions** (`02`, `03`, `04`) — dense scannable list, tap for sheet detail, rapid categorization flow.
3. **Destinatarios** (`05-destinatarios.png`) — merchant profiles (people/brands you transact with), not raw strings.
4. **Import wizard** (`06-import.png`) — 6-step PDF/email flow.
5. **Accounts** (`07`, `08`) — multi-bank, multi-currency, debt badges.
6. **Debt planner** (`09`, `10`) — payoff scenarios, timeline.
7. **Recurring** (`11-recurrentes.png`) — upcoming occurrences lifecycle.
8. **Budget** (`12-presupuesto.png`) — 50/30/20 treemap + per-category.
9. **Settings** (`14`, `15`) — profile, analytics opt-in.
10. **Auth** (`16`, `17`, `18`) — login, signup, recovery.

## What to avoid

- Pure black `#000` or pure white `#fff` anywhere — breaks the warm palette.
- Flat gray borders, flat gray dividers.
- Neon gradients, glassmorphism, glowing CTAs.
- Round-pill buttons bigger than compact.
- Arbitrary radii like `rounded-[18px]`.
- Emoji as UI affordance. Icons are `lucide-react`, monochrome.
- Stock-fintech growth-up-and-to-the-right imagery.
- Dense desktop-style grids squished to phone width.

## Stack constraints

- Mobile: Expo + React Native + NativeWind (Tailwind v3-compatible — NativeWind can't consume v4 yet). Offline-first with local SQLite.
- Webapp: Next.js 15 App Router, Tailwind v4, shadcn/ui, React 19.
- Shared logic via `@zeta/shared` package.
- No stack changes. No heavy client-side libs without lazy loading.

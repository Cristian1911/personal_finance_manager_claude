# Claude Design Brief — Tendencias: spending / cashflow / category viewing & interaction

> Paste this into Claude Design to generate new wireframe proposals. The goal is
> fresh **layouts, diagram types, and interaction patterns** for how Zeta users
> view and explore their spending, cashflow, and categories on the `/tendencias`
> analytics surface — beyond what ships today.

---

## Product context

**Zeta** is a personal-finance app for **Colombian** users. Core promise:
**every screen should answer "¿Voy bien?" ("Am I on track?") at a glance, without
explanation.** Currency is **COP** — amounts are large (8–9 digits, e.g.
`$ 102.010.610`), which stresses every layout; designs must handle long numbers
gracefully.

`/tendencias` is the analytics surface. It has three lenses (segmented control):
- **¿A dónde va?** — where money goes (spending by category + by recipient).
- **¿Voy bien?** — savings rate, income vs expense, budget adherence.
- **¿Cambios?** — movers, anomalies, balance forecast.

A period control sits above the lenses: **Semana · Mes · 3M · 6M · 12M · Año**
(week-to-date, month-to-date, then rolling/yearly windows).

## What already ships (don't re-propose these as "new")

- Category list with **inline 2-level drill-down** (parent → subcategoría →
  transactions), per-card **search**, and **"Ver todas"**. Each row shows a tiny
  sparkline + MoM % chip and expands to its underlying movimientos.
- Recipient ("destinatarios") list with search, drill-down to transactions.
- Fixed-vs-variable split bar, anomalies list, balance forecast line, savings-rate
  and income-vs-expense charts, a "verdict" hero (gasto prom/mes, tasa de ahorro,
  ingreso prom).

## What we want proposals for

Richer, clearer, more **interactive** ways to see and explore the same data.
Treat the current screens as the *floor*, not the ceiling. Specifically:

1. **Spending by category** — better than a flat ranked list. How do you show
   composition, proportion, and trend together, and let the user pivot/compare?
2. **Cashflow over time** — income vs expense vs net, and where it's heading.
   Make the "am I net-positive and trending which way?" answer instant.
3. **Categories ↔ recipients relationship** — money flows from income through
   categories to merchants. Is there a view that makes the *flow* legible?
4. **Time controls & comparison** — short windows (Semana/Mes) AND period-over-
   period comparison ("this month vs last", "this week vs the 4-week average").
5. **Changes & anomalies** — surfacing what's unusual or accelerating, framed as
   "what should I look at?" not just a list.

For each, explore **different diagram types** and say when each is appropriate
(mobile vs desktop). Candidates to consider (pick what genuinely helps — don't
use a chart because it's pretty):
- treemap / partition for category composition
- stacked area or stream for cashflow over time
- **waterfall** for "income → fixed → variable → net" within a period
- **sankey** for income → category → recipient flow (desktop-leaning)
- bullet charts / progress vs budget target
- small multiples (sparkline-per-category grid)
- calendar heatmap for daily spend within Semana/Mes
- period-over-period delta bars / slope charts

And **interaction patterns** beyond drill-down: filtering, multi-select compare,
brushing a time range, toggling absolute vs %, pinning a category to watch.

## Hard constraints (these are non-negotiable)

- **Spanish-first** — all copy in Spanish (Colombian register).
- **Dark theme, Zeta tokens** — brass (`z-brass`) + sage + warm-white on near-black
  surfaces; income=sage/green, expense=`z-expense` (warm orange). No arbitrary
  colors; compose from the existing token palette (see
  `docs/design-system/TOKENS.md`).
- **Mobile-first at 375px AND a desktop layout.** The current pain point is mobile:
  big COP amounts + trend chips + names collide. Every proposal must show the 375px
  version first and prove the numbers + labels stay readable.
- **Performance-first** — speed over animation. No heavy client libraries; charting
  is **recharts** (already in the stack) or lightweight SVG. Avoid anything that
  needs large JS bundles or blocks interaction.
- **Deterministic** — no AI/ML insights; all framing is rule-based.
- **Stack** — Next.js 15 App Router, Tailwind v4, shadcn/ui. Match the existing
  `Zeta Wireframes.html` rendering style.

## Deliverables

Follow the existing flow convention: **per area, give Variant A (Safe) /
B (Richer) / C (Experimental)** as React-rendered wireframes in the
`Zeta Wireframes.html` style, each with:
- the **375px mobile** layout first, then the desktop layout,
- a one-line rationale ("answers ¿voy bien? by …"),
- which diagram type and why it beats the current one,
- the key interaction(s) and their empty/loading states,
- how it handles a worst-case COP amount (`$ 102.010.610`) + a long category name.

Optimize every proposal for the core promise: **answer "¿Voy bien?" at a glance.**

## Anti-goals

- No dashboards that require a legend or a tutorial to read.
- No decorative charts that don't change a decision.
- No desktop-only ideas without a mobile answer.
- Don't re-skin the current list — propose genuinely different structures.

# Prompt for Claude Design — Tendencias (Análisis) hub · NEW surface

> Paste everything below this line into your Claude Design project (the one that already contains the Zeta design system). This is a **net-new flow** — there is no existing wireframe for it, so you have room to define the IA. The token appendix is included only for cross-checking; the project's design system is the source of truth. A fast engineer-built exploration of this hub exists at `claude-ai-design/tendencias-hub-mockup.html` — treat it as one rough take to react to, not a target.

---

You are designing a **new page** for Zeta (personal finance app for Colombian users): the **Tendencias** hub (could also be named *Análisis*). Dark theme, Spanish UI, mobile-first (390px viewport). **Use this project's existing Zeta design system** — tokens, card tiers, chips, rings, sparklines, expandable cards, buttons. No new colors, no generic shadcn-default look.

## The job this page does

Zeta already has a **Dashboard** that answers *"¿voy bien ahora?"* (today's runway, health score, this-month budget, current balances). It does NOT answer the **retrospective / comparative** question: *"¿a dónde fue mi dinero y cómo está cambiando con el tiempo?"*

Tendencias is that lens. It must serve **three co-equal jobs** (the user weighted them equally) — your IA should give each a clear home without making one feel primary:

1. **¿A dónde va el dinero?** (expense breakdown lens)
2. **¿Voy bien?** (savings / on-track lens)
3. **¿Está cambiando mi gasto?** (velocity / change lens)

Everything is driven by a **period control** (3M · 6M · 12M · Año · personalizado) and a **currency** selector (multi-currency app). The page should open with a one-glance read ("am I on track?") before the user scrolls into detail.

## Design system appendix (verification reference)

**Colors**
```
--z-ink:        #121412   (text on brass)
--z-sage:       #768053
--z-brass:      #937844   (primary accent — CTAs, highlights)
--z-brass-hot:  #B29256
--z-sage-light: #D9CCB9   (secondary text)
--z-sage-dark:  #938C7E   (eyebrow labels)
--z-income:     #5CB88A   (positive / income)
--z-expense:    #E8875A   (negative / spending)
--z-surface:    #171A17   (page bg)
--z-surface-2:  #1E221E   (cards)
--z-surface-3:  #262B26   (nested surfaces)
Borders: rgba(255,255,255,0.06) always. Page canvas behind frame: #0b0c0b.
```

**Card tiers**
- Tier 1 surface card: `border-radius 16px; border 1px rgba(255,255,255,.06); background rgba(30,34,30,.8); padding 16px; inset top highlight rgba(255,255,255,.03)`
- Tier 2 compact row: `border-radius 12px; background #111; padding 8px 12px`
- Tier 3 stat box: `border-radius 16px; background rgba(0,0,0,.1); padding 16px`

**Type**
- Eyebrow: 10px, semibold, uppercase, letter-spacing 0.18em, color sage-dark
- Page title: 24px semibold tight
- Hero number: 32px extrabold, tabular-nums
- Standard metric: 18px semibold, tabular-nums
- All currency uses tabular-nums; Colombian format `$ 3.480.000` (dot thousands) or compact `$3,48M`

**Buttons**: brass solid (brass bg, ink text), ghost (white/8 border, black/10 bg, sage-light text), brass-ghost (brass/20 border, brass/8 bg, brass text). Touch targets ≥ 44px.

**Existing primitives to reuse**: segmented tab control, expandable cards (tap header → grid-rows 0fr→1fr animation, chevron rotates), circular SVG progress rings, thin sparkline bars / mini line charts, StateChip pills, delta chips (▲/▼ with income-green / expense-orange).

## The content (sections to design)

You don't have to keep this grouping — but every item below must have a home. Mark which job each section serves.

**Job 1 · ¿A dónde va el dinero?**
- **Gasto por categoría — tendencia multi-mes.** How categories evolve across the selected period. The hard design question: stacked area vs. small-multiples vs. ranked rows each with its own sparkline + MoM delta. Give 2–3 takes. Tap a category → drill into its own trend.
- **Top destinatarios** ("¿a dónde va?"). Ranked list of where money actually goes (grouped by *destinatario*, Zeta's personified merchant — has avatar/initial + color). Show amount, transaction count, MoM delta, share-of-spend bar. Top 5 + "ver todos".
- **Fijos vs. variables.** Split of fixed/recurring vs. discretionary spending, with how the variable portion is trending.

**Job 2 · ¿Voy bien?**
- **Tasa de ahorro — tendencia.** % saved per month over the period, with a target reference line (e.g. meta 20%). Current value prominent.
- **Ingreso vs. gasto en el tiempo.** Grouped bars or paired lines across months; surface the average net.
- **Cumplimiento de presupuesto (histórico).** Which categories consistently respect vs. blow their budget — "excedido 4 de 6 meses" framing, not just current month.

**Job 3 · ¿Está cambiando mi gasto?**
- **Cambios destacados (movers).** Biggest MoM increases/decreases by category, with before→after amounts.
- **Anomalías.** Flagged unusual events ("Compra de $1,2M — 3× tu promedio de categoría"; "Suscripciones subió 40%"). Alert-styled, tappable.
- **Proyección de saldo.** Solid historical line → dashed projection for the next 3 months (based on average spend + recurring obligations). Mark "hoy". Make the assumption legible ("no incluye ingresos no confirmados").

**Cross-cutting**
- **Period control** (3M/6M/12M/Año/personalizado) — design the control and where it lives (sticky? in header?).
- **Currency** selector.
- **Apertura / verdict.** A one-line plain-language read at the top ("Tu ahorro subió a 24% — el mejor en 6 meses. Pero Restaurantes viene acelerando."). Plus maybe 3 summary tiles (gasto prom/mes, tasa de ahorro, ingreso prom) with deltas.
- **Export** (CSV del periodo).

## What to produce — IA variants first, then component variants

This is a new surface, so the **biggest decision is the information architecture**. Produce **2–3 whole-page directions**, e.g.:
- **A · Scroll seccionado** — single scroll, the three jobs as labeled sections (dividers), verdict + tiles up top. Simplest, everything visible.
- **B · Lentes segmentados** — segmented control with three lenses (¿A dónde va? / ¿Voy bien? / ¿Cambios?), mirroring the Deudas page pattern. Less scroll, more focus per view.
- **C · Historia / progressive** — opens with the verdict + tiles, then progressive disclosure: collapsed section headers the user expands into charts. Lightest first paint.

For the **two hardest components**, give 2–3 sub-variants inside whichever direction:
- the **category multi-month trend** (stacked area vs small-multiples vs ranked-with-spark), and
- the **opening verdict / summary** (single sentence vs sentence + tiles vs a compact "scorecard").

## Sample data (use these realistic Colombian figures, consistent across charts)
- Period = últimos 6 meses (ene–jun). Currency COP.
- Ingreso prom $4,55M/mes; Gasto prom $3,48M/mes; Neto +$1,07M; Tasa de ahorro: 14% → 18% → 16% → 21% → 19% → **24%** (meta 20%).
- Categorías (jun, con tendencia): Mercado & Comida $890k (▲6%), Hogar & Servicios $635k (~0%), Restaurantes $410k (▲18%, viene acelerando), Transporte $320k (▼22%), Compras $380k, Salud $180k, Suscripciones $90k (▲40%).
- Fijos $2,02M (58%) vs variables $1,46M (42%, ▲9%).
- Top destinatarios: Éxito $420k / 14 compras; Rappi $180k / 9 pedidos (▲28%); Claro $90k recurrente; Uber $74k / 12 viajes; D1 $66k.
- Presupuesto: Restaurantes excedido 4/6 meses; Mercado dentro 5/6; Transporte dentro 6/6.
- Anomalía: Compras $1,2M el 14 jun (3× el promedio). Suscripciones +40% (2 cobros nuevos).
- Saldo hoy $5,2M; proyección a 3 meses ~$4,6M.

## Deliverable
One self-contained HTML file (inline CSS + minimal vanilla JS for tap/expand/segment interactions so states are demonstrable), **390px frames side by side** on the #0b0c0b canvas, grouped by IA direction (A/B/C) with clear variant labels, and the two component sub-variants shown explicitly. Spanish UI copy throughout. Speed-feel: subtle 150–200ms transitions, no heavy animation. Don't design a desktop layout — note in a caption that desktop reflows to 2 columns.

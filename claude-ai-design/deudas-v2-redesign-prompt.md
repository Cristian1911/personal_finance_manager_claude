# Prompt for Claude Design — Deudas page v2 (interactivity + layout ideas)

> Paste everything below this line into your Claude Design project (the one that already contains the Zeta design system). The token appendix is included only so the output can be cross-checked — the project's design system is the source of truth.

---

You are redesigning the **Deudas** page of Zeta (personal finance app for Colombian users). Dark theme, Spanish UI, mobile-first (390px viewport). **Use this project's existing Zeta design system** — tokens, card tiers, chips, rings, buttons. No new colors, no generic shadcn-default look. Exact token values are in the appendix below for verification.

## Design system appendix (verification reference)

**Colors**
```
--z-ink:        #121412   (text on brass)
--z-sage:       #768053
--z-brass:      #937844   (primary accent — CTAs, highlights)
--z-brass-hot:  #B29256
--z-sage-light: #D9CCB9   (secondary text)
--z-sage-dark:  #938C7E   (eyebrow labels)
--z-income:     #5CB88A   (positive)
--z-debt:       #E05545   (negative / debt)
--z-alert:      #D4A843   (warnings)
--z-surface:    #171A17   (page bg)
--z-surface-2:  #1E221E   (cards)
--z-surface-3:  #262B26   (nested surfaces)
Borders: rgba(255,255,255,0.06) always.
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
- All currency uses tabular-nums; format `$ 102.916` (Colombian: dot thousands)

**Buttons**: brass solid (brass bg, ink text), ghost (white/8 border, black/10 bg, sage-light text), brass-ghost (brass/20 border, brass/8 bg, brass text). Touch targets ≥ 44px.

**Existing primitives you can reuse**: segmented tab control (3 lenses), circular SVG progress ring (44px, brass/debt-red stroke), thin usage bars, StateChip pills (small rounded pill with colored border), expandable cards (tap header → grid-rows 0fr→1fr animation, chevron rotates).

## Current page (what exists today)

Route `/deudas`, three lenses via segmented control:

1. **Carga** — hero card "cuota mensual" with capital/interest split bar (expandable), then a **Tendencia card**: 6 tiny sparkline bars (custom divs, brass or debt-red), % delta with ▲/▼, status chip ("Mejorando"/"Estable"/"Mes pesado"). **Not interactive at all.**
2. **Plan** — "Libre de deudas" horizon hero (projected date, progress bar), a 44px milestone ring showing months remaining ("28m"), closest-loan card ("Bancolombia Préstamo ****8386 · 82% pagado · $ 102.916/mes"), two action buttons ("Plata extra / Abonar a deuda" and "Simular pagos") floating as detached pill chips, then insight chips ("Prioriza la deuda más cara — 'Bancolombia VISA ****7022' tiene la tasa más alta (28.1% EA)"). **No chip is clickable.**
3. **Cuentas** — 2-col header tiles: utilization ring "Uso del cupo" + "Deuda total" amount, then a flat list of account rows (name, balance in red, thin usage bar, 10px metadata line with cuota · tasa), then a small "Deudas con personas" link row buried at the bottom, easy to miss.

Below all lenses there's a leftover "Mis cuentas" section — **it will be removed**, don't include it.

## Problems to solve — produce 2–3 variants for each

### A. Tendencia chart → interactive
The sparkline is dead. Design:
- **Collapsed state**: compact bars + delta, but each bar tappable — tapping a month shows its amount + month label (selected bar highlights brass-hot, others dim).
- **Expanded state**: tap-to-expand into a full bar chart with Y-axis scale markers on the left, month labels at the bottom, selected-month detail row (total, delta vs previous month).
Show both states in the mockup. At least one variant should treat expansion as the same card growing (not a modal).

### B. Plan lens — clickable chips with contextual detail
Every stat chip/ring should reveal context on tap:
- Milestone ring "28m" → expands to show the payoff timeline math (months left, projected date, what an extra payment would change).
- Closest-loan card → expands to per-debt detail (balance remaining, rate, cuota, % paid).
- Insight chips ("Prioriza la deuda más cara") → tap reveals the supporting numbers and a CTA (e.g. "Abonar a esta deuda").
Use a consistent expand affordance (chevron or "+") so users learn one gesture.

### C. Action buttons placement
"Plata extra" and "Simular pagos" currently float as two detached pills between content blocks (looks lost — see problem). Propose better placements: e.g. anchored action row inside the horizon hero card, a sticky compact bar, or integrated into the expanded states from (B). Keep both actions one tap away.

### D. Cuentas header tiles → expandable
"Uso del cupo" and "Deuda total" tiles should expand to show the breakdown: per-account contribution to the total (small stacked list or mini-bars inside the expanded tile), credit limit vs used per card.

### E. "Deudas con personas" promotion
Move it to the top of the Cuentas lens (or even page-level) and make it visually first-class: show net position ("te deben $ 450.000" in income green / "debes $ X" in debt red), people count, maybe avatars/initials. It must not read as a footnote link.

### F. Account list redesign (main ask)
The current list (name + red balance + thin bar + tiny metadata) is monotonous. Explore at least 3 distinct directions, e.g.:
1. **Grouped cards** — credit cards vs préstamos sections, each row with usage ring instead of bar.
2. **Progress-forward rows** — "% pagado" as the dominant visual (like the closest-loan card), payoff framing instead of debt framing.
3. **Compact stat tiles** — 2-col grid of mini cards with utilization ring + balance + cuota.
Each row must still surface: balance, usage % (cards) or % paid (loans), cuota mensual, tasa. Rows tap-to-expand for full detail.

## Sample data (use realistic Colombian figures)
- Bancolombia Préstamo ****8386 — 82% pagado, $ 102.916/mes, saldo $ 2.450.000
- Bancolombia VISA ****7022 — tasa 28.1% EA, cupo $ 8.000.000, usado $ 3.680.000 (46%), cuota $ 412.000
- Nu Tarjeta ****4411 — cupo $ 3.000.000, usado $ 2.250.000 (75%), cuota $ 310.000
- Deudas con personas: 2 activas, te deben $ 450.000
- Tendencia: ene 5.2M, feb 5.0M, mar 5.1M, abr 4.8M, may 4.6M, jun 4.4M (mejorando, −4.3%)

## Deliverable
One self-contained HTML file (inline CSS + minimal vanilla JS for the tap/expand interactions so states are demonstrable), 390px frames side by side on a neutral canvas, grouped by problem (A–F) with variant labels. Spanish UI copy throughout. Show collapsed AND expanded states. Prefer speed-feel: subtle 150–200ms transitions, no heavy animation.

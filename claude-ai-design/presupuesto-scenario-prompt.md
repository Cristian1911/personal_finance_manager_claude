# Prompt for Claude Design — Presupuesto "Simular cambio" (scenario budget)

> Paste everything below this line into your Claude Design project (the one with the Zeta design system). Token appendix at the end is only for cross-checking — the project's design system is the source of truth.

---

You are designing a new feature for the **Presupuesto** page of Zeta (personal finance app, Colombian users). Dark theme, Spanish UI, mobile-first (390px viewport). **Use this project's existing Zeta design system** — tokens, card tiers, chips, progress bars, buttons. No new colors, no generic shadcn look.

## Current Presupuesto page (context)

Lives as a tab inside `/plan`. Shows, top to bottom:
1. **Hero card**: mode badge (Flexible/Estricto), ingreso mensual, asignado, restante.
2. **Month selector**.
3. **50/30/20 allocation bars**: Necesidades / Gustos / Ahorro, horizontal bars with target dashes, color-coded vs targets.
4. **Treemap** of budget by category.
5. **Category grid**: expandable cards per category — presupuesto, gastado, ratio color (green/yellow/red), pacing vs month progress, promedio 3 meses, compromisos recurrentes ("X fijos · Y flexible"), subcategory breakdown, inline budget editor.

Budgets are **standing monthly amounts per category** (not per calendar month). The app also has: **Deseos** (wishlist items with amount + an affordability engine returning verdicts COMPRA / CON CUIDADO / ESPERA / NO RECOMENDADO and a 0–100 score), and per-category **3-month spending averages**.

## The feature: "Simular cambio" — scenario budget

A user is planning a life change (canonical case: **moving out to rent a house**) and needs the budget page to answer four questions:
1. ¿Cuánto gasto hoy y en qué? (already covered)
2. ¿Cuánto necesito al mes para que el cambio funcione?
3. ¿Qué parte de mi ingreso se irá ahí?
4. ¿Tengo que recortar mis gastos actuales? ¿Dónde?

Mechanic: the user enters a **scenario mode** that clones their current budget into an editable draft. They add/edit lines (Arriendo +$1.500.000, Mercado sube a $600.000…), attach one-time purchases (nevera, muebles — pulled from Deseos), and the page recomputes everything **against their real 3-month spending averages**, ending in a clear verdict: "funciona" or "te faltan $X/mes — candidatos a recorte: …". Nothing touches the live budget until the user applies the scenario.

## Surfaces to design — 2–3 variants each

### A. Entry point + mode state
How scenario mode starts and how the page signals "estás viendo una simulación, no tu presupuesto real". Ideas: a "Simular un cambio" chip near the hero; hero card swaps to scenario framing; persistent thin banner with "Descartar / Aplicar". Must feel clearly sandboxed (consider alert-gold accents) without redesigning the whole page.

### B. Scenario editor (core surface)
The draft budget list. Each category row shows: current budget → scenario budget, **delta chip** (+$ / −$), and the real promedio 3m as the reality anchor. New categories (Arriendo) insert with a "nuevo" badge. Editing inline (tap amount → numeric input). Show how an increased line, a decreased (cut) line, and a new line each look. One variant should group rows: "Nuevos gastos" / "Cambian" / "Igual".

### C. Verdict summary (the answer card)
The money shot. Must answer questions 2–4 at a glance:
- Total mensual del escenario vs ingreso → sobra/falta amount (income-green if positive, debt-red if negative).
- New 50/30/20 bars: scenario allocation vs current, side by side or overlaid ghost bars.
- If short: **"Necesitas recortar $X/mes"** + ranked cut candidates — categories where promedio 3m exceeds what's assignable, each with a suggested cut amount and a one-tap "aplicar recorte" that edits the draft.
- If it fits: green verdict + how much margin remains.
Design both states (fits / doesn't fit).

### D. One-time purchases pool (gastos de arranque)
A section for the startup costs (nevera, muebles, cocina) — distinct from monthly lines. Each item: amount, afford-engine verdict chip, and a funding plan ("ahorrando $400k/mes los tienes en 4 meses" or "con tu colchón actual cubres 2 de 3"). Total arranque + months-to-ready readout. Items can come from Deseos (show linked badge) or be added ad hoc.

### E. Apply / compare moment
What happens when the user commits: a compare sheet (actual vs escenario, the lines that change highlighted) with "Aplicar desde [mes]" confirm. One variant can keep the scenario saved as a named draft ("Mudanza") to revisit instead of applying.

## Sample data (use these exact figures)

- Ingreso mensual: $4.500.000
- Current budgets: Mercado $350.000 (prom 3m $410.000), Transporte $280.000 (prom $295.000), Restaurantes $300.000 (prom $385.000), Suscripciones $95.000 (prom $95.000), Salidas $250.000 (prom $310.000), Deudas $815.000 (fijo), Ahorro $600.000
- Scenario adds: Arriendo $1.500.000 (nuevo), Servicios $220.000 (nuevo), Internet $95.000 (nuevo), Mercado sube a $650.000
- Resulting shortfall: −$1.080.000/mes → cut candidates: Restaurantes (−$150.000), Salidas (−$120.000), Ahorro (−$300.000), …
- Gastos de arranque: Nevera $1.200.000 (verdict: CON CUIDADO), Muebles sala $1.800.000 (verdict: ESPERA), Cocina/menaje $450.000 (verdict: COMPRA)

## Deliverable

One self-contained HTML file (inline CSS + minimal vanilla JS so editing/expanding states are demonstrable), 390px frames side by side on a neutral canvas, grouped by surface (A–E) with variant labels. Spanish copy throughout, currency formatted `$ 1.500.000`, tabular-nums. Show both verdict states (fits / shortfall). Subtle 150–200ms transitions, speed-feel over animation.

## Design system appendix (verification reference)

```
--z-ink:        #121412   (text on brass)
--z-sage:       #768053
--z-brass:      #937844   (primary accent)
--z-brass-hot:  #B29256
--z-sage-light: #D9CCB9   (secondary text)
--z-sage-dark:  #938C7E   (eyebrow labels)
--z-income:     #5CB88A   (positive)
--z-debt:       #E05545   (negative)
--z-alert:      #D4A843   (warnings — good fit for "scenario mode" accents)
--z-surface:    #171A17   (page bg)
--z-surface-2:  #1E221E   (cards)
--z-surface-3:  #262B26   (nested)
Borders always rgba(255,255,255,0.06).
Card tiers: 16px radius surface card (rgba(30,34,30,.8), p16) · 12px radius compact row (#111) · stat box (black/10).
Eyebrow: 10px semibold uppercase ls-0.18em sage-dark. Hero number: 32px extrabold tabular-nums.
Buttons: brass solid (ink text) / ghost (white/8 border) / brass-ghost. Touch targets ≥ 44px.
```

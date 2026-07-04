# Unification Layer — Spec Digest (Handoff 7a + T1–T6)

Source: Claude Design project `ffb42125-91ad-43ad-8499-9e7398a6c75b`. Full boards live in this directory (`*.dc.html`). This digest is the authoritative compact spec for implementation agents.

**North star / definition of done:** every screen answers "¿voy bien?" in the hero slot without explanation.

**Scope:** 4 new primitives + 1 theme object + 6 copy rules. No rebrand, no new tokens, no new hues, no new libraries.

---

## HANDOFF 7a — Migration Checklist

### a · Qué se construye
1. `<Verdict />` (T1) — pill chip + detail line. Props: `state` (vas-bien | cerca | te-pasaste | atencion), `delta?`, `detail?`, `compact?`. Colors: income/alert/debt tokens, 8% tint + 20% border. Fixed hero slot: eyebrow → number → verdict → detail → meta. One full-volume verdict per screen.
2. `<Disclosure />` (T3) — grid-rows 0fr→1fr 160ms, caret 180°, content enter 120ms. Label "Ver + qué" / "Ocultar …". Tokens: `--motion-ease: cubic-bezier(0.2,0,0,1)`, `--motion-1/2/3: 120/160/200ms`. Dim only on focus-leaving overlays.
3. `<MonthControl />` (T5) — chevron · "Abril 2026" · chevron, compact-card container, fixed-width tabular label, next disabled at current. Month = ONE app-level store key in the URL. Range variant for Tendencias. Header grammar everywhere: title left, control right, no subtitles, no wordmark.
4. `<GroupSummary />` (T6) — V2 header: count + aggregate delta ("7 sobre límite · −$486.000"). Mandatory above any 3+ same-state rows; state word once per group; rows carry deltas only. Ladder: V1 34/800 · V2 15/600 · V3 13 · V4 11. Healthy groups collapse behind a Disclosure.
5. `chartTheme` (T2) — one recharts theme object: chart-1→brass, chart-2→sage-dark, horizontal hairlines only, no axis lines, dashed 4-3 forecasts at 50%, tabular compact labels, `isAnimationActive: false`. Two tiers: gauges judge (max one per screen, verdict-bearing), charts explain (never verdict-bearing).

### b · Qué se elimina
- Dashboard status dot · "SOBRE LIMITE"/"ATENCION" pills · "Te pasaste del presupuesto" strings → `<Verdict />`
- Page-dim on hero expand · silent growers · bare "Ver" links → `<Disclosure />`
- "Abr" pill · below-hero selectors · title+subtitle headers · wordmark-as-header → `<MonthControl />` + canonical header
- Per-row uppercase alarm pills · equal-volume walls → `<GroupSummary />` + ladder
- Unthemed recharts defaults · per-card chart palettes → `chartTheme`
- Letter-badge account glyphs → colored dot everywhere (the smaller, quieter system)

### c · Reglas de copy (cierran la deriva)
1. Verdict vocabulary closed: Vas bien · Cerca del límite · Te pasaste · Atención. No synonyms, no uppercase.
2. Disclosure labels: "Ver + qué" ↔ "Ocultar + qué". Never bare "Ver".
3. Selector shows "Abril 2026" only; "abr" on axes; relative dates only in rows.
4. Celebration eyebrows: DEUDA SALDADA · MES CERRADO BAJO PLAN · TODO PAGADO. Detail in tuteo, past tense, no exclamation.
5. Past months read-only: "Mes cerrado" line, verdicts in past tense ("Cerraste bajo plan").
6. Group summaries: "N sobre límite" / "N en orden" / "N de M pagados".

### d · Secuencia (4 fases por apalancamiento)
- **Fase 1 · Veredicto (T1):** build `<Verdict />`; converge dashboard dot + Presupuesto pill; add slot to Deudas, Recurrentes, Plan. Delete the three dialects. Resolves findings 1, 8 (parcial).
- **Fase 2 · Marco (T5+T3):** canonical header + shared month store on the five surfaces; replace every expand with `<Disclosure />`; remove hero dim. Mechanical, low risk, wide surface. Resolves 3, 4, 6.
- **Fase 3 · Densidad (T6+T2):** ladder + `<GroupSummary />` on Presupuesto and Deudas; `chartTheme` on Tendencias, forecast, income-expense; unify account glyphs. Resolves 2, 5, 7.
- **Fase 4 · Calidez (T4):** three celebration moments (deuda saldada, mes cerrado, todo pagado) + residue rows in Actividad reciente. Ships last: depends on Verdict, ring, motion tokens. Resolves 9. One event, once, brass-on-number.

### Guardrails de aceptación
- brass nunca en veredictos ni filas
- un veredicto a todo volumen por pantalla
- un gauge radial por pantalla, máximo
- solo transform/opacity · 120/160/200ms · una curva
- dim = el foco sale de la página
- cero hues nuevos · cero librerías nuevas

### e · Hallazgo → resolución
1 Sin veredicto unificado → T1 (Fase 1) · 2 Dos dialectos de data-viz → T2 (F3) · 3 Deriva del selector de mes → T5 (F2) · 4 Gramática de encabezados → T5 (F2) · 5 Dos sistemas de glifos de cuenta → — (F3) · 6 Idiomas de expandir/colapsar → T3 (F2) · 7 Paredes de densidad → T6 (F3) · 8 Deriva de tono de copy → T1 (F1) · 9 El éxito es mudo → T4 (F4).

---

## T1 — VERDICT SYSTEM

Thesis: one component, one vocabulary, one slot. The verdict is the ONLY element on a screen allowed to speak at full volume about status; everything below enumerates compact. Brass never carries a verdict (brass = actions + brand).

Anatomy:
- CONTAINER: pill, radius 999, height 24, padding 0 10px 0 8px. Tint 8% + border 20% of bound token (existing `.surface-*` recipe; `color-mix(in srgb, var(--tok) 8%, transparent)` bg, 20% border). No new styles.
- ICON: Lucide, 12px, stroke 2.5. One fixed icon per state — meaning never rides color alone.
- WORD: 12px/600, sentence case, tuteo. One of four words. Closed vocabulary.
- DELTA (opt): tabular-nums, same hue, preceded by "·". The one number that justifies the word.
- DETAIL: one sentence, 13px sage-light, under the chip. Answers *why*. Amounts inside keep semantic colors.
- COMPACT: row form for lists — icon + word only, 11px/600, no pill.

Slot (fixed on every hero): eyebrow → number → verdict → detail → meta. 8px above chip, 6px chip→detail, 12px detail→meta. One full-volume verdict per screen; never in brass.

States (4 states, 3 tokens — deliberate: cerca + atención share alert; color carries severity, word+icon carry reason):
| state | word | token | lucide icon | replaces |
|---|---|---|---|---|
| vas-bien | Vas bien | --z-income | check (`Check`) | dashboard green dot · grey "Vas bien" text |
| cerca | Cerca del límite | --z-alert | arrow-up-right (`ArrowUpRight`) | 75–99% yellow percentages with no word |
| te-pasaste | Te pasaste | --z-debt | circle-x (`CircleX`) | "SOBRE LIMITE" pill · "Te pasaste del presupuesto" |
| atencion | Atención | --z-alert | triangle-alert (`TriangleAlert`) | "ATENCION" · "Necesita atención" headers |

Semantics: vas-bien = within plan / debt falling / all paid. cerca = 75–99% of limit or pace projects crossing before month end (magnitude warning, no action needed). te-pasaste = ≥100% or balance grew this month (the only red). atencion = user action needed (payment due, sin categoría, data gap) — feeds "Por resolver" inbox.

Migration: dashboard dot-plus-sentence → chip in same position under hero number, existing sentence survives verbatim as detail line. Presupuesto "SOBRE LIMITE" → re-cases to "Te pasaste", binds to surface-debt recipe, moves from per-row stamp to single hero verdict; rows demote to 11px compact form. Deudas/Recurrentes/Plan heroes (no judgment today) adopt full slot.

Hero mock constants: hero number 34px/800 letter-spacing -0.02em tabular; hero card gradient radial + linear (see shared constants below); meta row 11px sage-dark justify-between.

---

## T2 — DATA-VIZ IDENTITY

Thesis: two tiers, one language — gauges judge (Tier 1, verdict-bearing, max 1/screen); charts explain (Tier 2 recharts, never verdict-bearing).

Shared DNA (every chart):
- FRAME: charts inside surface cards under an eyebrow; no plot background, no axis lines, no legend boxes, no vertical gridlines.
- GRID: horizontal hairlines only rgba(255,255,255,0.06), max 3; zero baselines/limits = solid white/12.
- SERIES: brass = what you did; sage-dark = comparison (ideal/promedio/proyección); income green + expense orange only when both meet in one frame; debt red only for debt; max 2 series + 1 reference per chart.
- FORECAST: dashed "4 3", 50% opacity, same hue as its series; only dot allowed = 3px "hoy" marker.
- NUMBERS: tabular-nums, compact COP ($3,76M · $178K), 9–10px sage-dark; label only decision numbers (peak + current); keys = inline swatch chips (8×8 radius 2), not legend boxes.
- MOTION: none; `isAnimationActive={false}` always; tooltips = compact cards (#111, border white/6).

chartTheme mapping (rebind, not rewrite): --chart-1 → --z-brass (actual/tú); --chart-2 → --z-sage-dark (ideal/promedio); --chart-3 → --z-income; --chart-4 → --z-expense; --chart-5 → --z-debt. CartesianGrid vertical={false} stroke white/6; XAxis/YAxis axisLine={false} tickLine={false}. Surfaces: Tendencias, forecast card, income-expense card.

Tier 1 gauge: hand-rolled SVG 270° ring, 8–9px stroke, round caps; track white/6; fill brass (→ --z-debt only at ≥100% "Te pasaste"); sage-dark "hoy" tick; center = hero number (26px/800 @128px, 19px/800 @96px) + micro-label. viewBox 0 0 128 128, path "M 27.23 100.77 A 52 52 0 1 1 100.77 100.77", pathLength=100, dasharray "{pct} 100". Reserved for aggregates (RITMO, debt payoff, capital/interés). Verdict logic demo: pct≥100 → te-pasaste; pct≥87 → cerca; else vas-bien.

Tier 2: lines + bars only — no area fills, no pies. Verdict chip NEVER on a workhorse chart.

Split bar signature: 10px height, radius 999, track white/6; capital = brass, interés = expense 0.85 opacity, restante = white/10.

Application details: Tendencias bars 26px wide radius 3 3 0 0; history months 0.55 opacity brass, current 1.0; promedio dashed sage reference; axis 3-letter lowercase months 10px, current month sage-light/600. Ingresos-vs-gastos paired bars 12px gap 3, 0.8 history/full current. Burndown: ideal dashed "2 3" sage-dark 0.8; actual brass 1.75; projection dashed "4 3" 0.5; hoy dot r=3.

Deletes: plot backgrounds, axis/legend chrome, vertical gridlines, area fills, pies, chart animation, verdict chips on analytical charts.

---

## T3 — MOTION VOCABULARY

Thesis: one idiom — the disclosure. Motion budget = transform + opacity only. Page dims ONLY when input focus leaves it.

Tokens: `--motion-ease: cubic-bezier(0.2, 0, 0, 1)`; `--motion-1: 120ms` (content-enter); `--motion-2: 160ms` (disclosure); `--motion-3: 200ms` (sheet). Nothing longer; charts stay at zero.

Disclosure:
- AFFORDANCE: label "Ver + qué" (e.g. "Ver flujo por día", "Ver desglose", "Ver 7 categorías"); expanded → "Ocultar …". Never bare "Ver". 12px/600 sage-light, hover → white, hit area ≥44px. Never brass. Banned: "Ver" (bare), "Expandir", "Mostrar más".
- CARET: chevron-down 12px stroke 1.5, right of label; rotates 180° on expand, same curve; the ONLY rotating element in the app.
- CONTAINER: grid-template-rows 0fr → 1fr @160ms (no JS measuring, no max-height hacks); content enters @120ms opacity + translateY(-3px)→0; siblings reflow; nothing springs/scales/slides sideways.

Dim rule: dim = modal. Backdrop rgba(0,0,0,0.6) + blur(4px) iff input focus leaves the page (sheets, dialogs, FAB quick-capture); belongs to overlay, not card. Disclosure NEVER dims. Never: press scale (hover-tint only), scroll-triggered motion, chart animation, skeleton shimmer choreography.

Sheet: translateY(105%)→0 @200ms; backdrop opacity @200ms; handle 40×4 radius 2 white/12.

Deletes/applies: dashboard hero whole-page dim on expand (dim removed); silent growers gain caret+label. Applies: Inicio hero ("Ver flujo por día"), Deudas rows ("Ver desglose", split bar inside), Movimientos FAB sheet.

---

## T4 — CELEBRATION MOMENTS

Thesis: brass touches a number for the first time. One earned moment per event, quiet, typographic, under a second. Brass-on-number never appears in ordinary state.

- TRIGGER: earned events only — debt reaches zero, month closes under plan, last pending recurrente clears. Never app-open, never streaks, never twice per event.
- BRASS: hero number turns brass — the entire spectacle; holds while on screen, then returns to white.
- EYEBROW: "DEUDA SALDADA" · "MES CERRADO BAJO PLAN" · "TODO PAGADO" — same 10px uppercase voice.
- VERDICT: T1 chip stays "Vas bien" — no fifth state. Detail names achievement, one sentence, tuteo, no exclamation.
- MOTION: T3 budget; ring sweeps closed once @600ms (the SINGLE exception to the 200ms cap); text rises 120ms. Keyframes: z-ring-sweep (dashoffset 100→0, 600ms), z-rise (opacity 0→1 + translateY 6px→0, 120ms). No particles/scale/shimmer.
- RECORD: each moment leaves a "logro" residue row in Actividad reciente.
- Constraint: max one celebration per screen visit; on collision larger speaks, smaller becomes its detail line.

Event 1 — Deuda saldada: ring sweeps full 600ms; "$0" brass 30px/800; text rise delayed 450ms; detail "Pagaste $8.400.000 en 14 meses. Tu cuota mensual baja $600.000."; CTA brass-ghost "Ver historial"; debt row → "Saldadas" group (opacity 0.7) instead of vanishing.
Event 2 — Mes cerrado bajo plan: first visit after month close only; hero = unspent margin brass 34/800 + "sin gastar"; chip "Vas bien · 79% del plan"; CTAs "Mover al ahorro" (brass) + "Ver julio" (ghost); residue row "Logro / junio cerró bajo plan · margen $412.000".
Event 3 — Todo pagado: count "11 de 11 pagados" turns brass 34/800, transition 200ms; eyebrow → "Todo pagado" brass; chip flips Atención → Vas bien; segment dot strip (flex 1, h4, radius 2, paid=brass unpaid=white/10, 200ms); empty inbox says "Nada por resolver. El próximo cobro es Netflix, el 2 de agosto."

---

## T5 — SHARED TIME MODEL

Thesis: one header, one clock. Every month-scoped surface renders the identical header row — title left, month control right — and month is ONE piece of shared app state (one store key, in the URL).

- TITLE: H1 22px/600 (28px/700 desktop), sentence case, matches tab name exactly: Inicio, Movimientos, Plan, Deudas, Recurrentes. No subtitles. Wordmark leaves headers (splash/auth only).
- CONTROL: month stepper top-right: chevron · label · chevron in compact-card container (#111, border white/6, radius 10). Chevrons 14px stroke 1.5, hit areas 32×44. Fixed-width label (min 88px phone / 120px range) so stepping never shifts layout. Next chevron disabled at current month (rgba(255,255,255,0.15)).
- LABEL: "Abril 2026" — full month capitalized + year. ALWAYS. Never "Abr", "Este mes", year-less. tabular-nums.
- STATE: month = app-level state in the URL. Tab switches never reset it; stepping on Plan steps Movimientos. Five clocks → one.
- Format ladder: "Abril 2026" (header control only) · "abr" (chart axes only, 3-letter lowercase, no period) · "15 de abril" (rows/details; "de 2025" only if year differs) · "hace 3 días / hoy / ayer" (Actividad reciente + verdict details only) · "Nov 2025 – Abr 2026" (range surfaces / Tendencias; chevrons slide the 6-month window).
- Past months: read-only + say so — lock icon 11px + "Mes cerrado · solo lectura" (11px sage-dark) under header; capture actions hidden; verdicts past tense ("Cerraste bajo plan").

Deletes: "Abr" pill above title · selector below hero · title+subtitle header · wordmark-as-header. Four patterns → one slot.

---

## T6 — NUMBER WALL HIERARCHY

Thesis: one number decides; everything else testifies. Exactly ONE hero-scale number per screen — the one answering ¿voy bien? (a DERIVED judgment, never the largest raw amount).

Ladder (four volumes, nothing else):
- V1 · 34px/800 — the decider, one per screen; only number allowed semantic color at scale.
- V2 · 15px/600 — group summary: count + aggregate delta ("7 categorías sobre límite · −$486.000").
- V3 · 13px/400–500 — row ("Transporte +$81.000").
- V4 · 11px/400 — evidence ("$381.000 de $300.000").

Rules:
- SUMMARY FIRST: any group of 3+ same-state rows must be introduced by a V2 summary (count + aggregate delta).
- STATE ONCE: verdict word once per group (in summary), never per row; rows carry only their own delta in the group's color.
- SORT: worst first by absolute delta; healthy groups collapse behind a T3 disclosure ("Ver 10 en orden") — calm rows cost a tap, alarm rows do not.
- BARS: row progress bars 3px hairlines, track white/6; only over-limit rows tint debt-red; healthy fills white/25 — NOT brass.

Applications:
- Presupuesto: hero "112%" debt 34/800 + "del plan usado"; chip "Te pasaste · −$486.000"; detail "Llevas $486.000 sobre el plan; Transporte pesa más de la mitad."; hero bar 6px 100% debt; V2 "7 sobre límite / −$486.000"; top 3 offenders + rest behind "Ver 4 más"; healthy group "10 en orden" + single "Vas bien" chip behind "Ver 10 en orden".
- Deudas: V1 = total cuota white (Vas bien → not colored) + chip "Vas bien · 24% del ingreso"; capital/interés = T2 split bar; V2 "3 cuotas este mes / 2 pagadas"; pending row full opacity + "vence en 2 días" alert chip + owns the ONLY brass action; paid rows dim 0.6 with income check chips; per-debt split = V4 evidence in row.

Deletes: per-row uppercase alarm pills, repeated verdict chips per row, multiple hero-scale numbers, brass fills on healthy bars.

---

## Shared mockup constants (all boards)

Phone frame 380px radius 28 border white/6 bg --z-ink. Hero card gradient: `radial-gradient(circle at top left, rgba(63,70,50,0.22), transparent 42%), linear-gradient(180deg, rgba(27,30,27,0.96), rgba(18,20,18,0.98))`. Verdict chip recipe: h24, pad 0 10px 0 8px, radius 999, bg color-mix 8%, border color-mix 20%, 12px/600 lh1, icon 12 stroke 2.5. Hero number 34/800 ls -0.02em tabular. Eyebrow ~10px uppercase. Compact rows: z-card-compact pad 10px 12px, name 13/500 white, meta 10 sage-dark, amount 13 z-num.

Design-board token names (map to webapp equivalents during implementation): --z-ink, --z-white, --z-border, --z-brass, --z-income, --z-expense, --z-alert, --z-debt, --z-sage-light, --z-sage-dark.

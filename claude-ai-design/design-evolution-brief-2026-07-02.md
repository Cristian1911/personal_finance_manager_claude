# Zeta — Design Evolution Brief (for Claude Design / Fable 5)

Paste this whole document as the prompt. The Zeta Design System project already has the tokens, component previews and 16 current-state mobile screenshots synced — reference them, do not reinvent them.

---

## Prompt

You are evolving the visual and compositional design of **Zeta**, a Spanish-first personal finance app for Colombian users (dark ink surfaces, brass accent, Inter type, mobile-first). The design system in this project is the source of truth: `.z-*` classes, brass-only accent, eyebrow micro-labels, big-number heroes. The screenshots in this project show the real shipped app.

The product's north star: **every screen must answer "¿Voy bien?" (am I on track?) at a glance, without explanation.**

A full cohesion audit of the shipped codebase just concluded. Its verdict: the app is **cohesive at the atomic level** (tokens, type, color discipline) but **fragmented at the compositional level**. Your job is to design the unification layer — not a rebrand.

### What the app is today (state of the union)

Every screen opens with an uppercase micro-eyebrow, one dominant tabular number, and a supporting stat row on near-black ink. Brass is reserved exclusively for actions and brand. The FAB-centered 4-tab bar (Inicio, Movim., Plan, Deudas) gives a recognizable silhouette. But each major surface was built as its own island: 12+ bespoke hero components, three different verdict dialects, and two data-viz languages (recharts analytical cards vs hand-rolled SVG gauges).

### Signature elements — preserve these, they ARE the brand

1. Brass-only accent discipline — brass is never decorative, only actions and brand.
2. The eyebrow system — 10px uppercase, wide-tracked micro-labels ("DISPONIBLE PARA GASTAR", "CUOTA MENSUAL") on nearly every card.
3. Big-number-first heroes with tabular-nums — the "one giant number" moment.
4. Semantic amount colors — income green, expense orange, debt red, consistently applied.
5. FAB + 4-tab silhouette with the central brass plus button.
6. The RITMO radial gauge on the dashboard — the app's one delightful custom viz, seed of a viz identity.
7. The action-inbox concept ("Por resolver", "Necesita atención") reinforcing the on-track narrative.

### The fragmentation you must resolve (top findings, ranked)

1. **No unified verdict.** Dashboard answers "am I on track" with a colored dot plus sentence; Presupuesto with an uppercase pill ("SOBRE LIMITE"); Deudas, Plan and Recurrentes do not answer it at all — they lead with a raw amount and never say whether it is good or bad. This directly violates the north star.
2. **Two data-viz dialects.** Recharts cards (Tendencias, forecast, income-expense) share no theme with the custom SVG hero gauges (RITMO ring, capital/interes split bar). Tendencias reads like a different app.
3. **Period control drift.** The month selector renders "Abr" on some screens, "Abril 2026" on others, placed above the title on some and below on others.
4. **Header grammar drift across peer tabs** — wordmark vs H1 title vs title-plus-subtitle.
5. **Two account glyph systems** in transaction rows: colored dot vs letter badge.
6. **Expand/collapse idiom varies** — one hero dims the whole page, another silently grows, links say "Ver flujo por dia" or bare "Ver".
7. **Density walls.** Presupuesto shows seven "SOBRE LIMITE" rows all shouting at equal volume; the one decision-driving number (112%) does not out-rank the enumeration.
8. **Copy tone drift** — "SOBRE LIMITE" vs "Te pasaste del presupuesto" vs "ATENCION" for the same concept.
9. **Success is silent.** The app is fluent at danger (red everywhere) but nearly mute at achievement — "Vas bien" is muted grey text. Paying a debt to zero produces no moment.

### Design territories — produce proposals for these

Work territory by territory. For each: a direction statement, the component anatomy, and 2–3 concrete screen applications rendered in the existing design language.

**T1 — Unified verdict system (highest leverage).** One verdict component plus one enumerated Spanish vocabulary (suggested states: "Vas bien", "Cerca del limite", "Te pasaste", "Atencion"), color-bound to the existing semantic tokens only. Every hero renders it in the same slot. Prove it on the three heroes that today have no verdict: Deudas, Recurrentes, Plan.

**T2 — Data-viz identity.** Define what "a Zeta chart" looks like: ink grid, brass/sage series, tabular-num labels, and a deliberate two-tier split (hero gauges as signature moments vs analytical charts as workhorse). Prove it on Tendencias and one dashboard card.

**T3 — Motion vocabulary.** One expand/collapse grammar: affordance wording, caret behavior, easing, and an explicit rule on page dimming. Cheap motion only (transform/opacity).

**T4 — Celebration moments.** Reward states that live within the restraint: staying under budget at month close, a debt reaching zero, clearing all pending recurrentes. No confetti-slop; think brass, typography and the eyebrow system used with warmth.

**T5 — Shared time model.** One month-selector label format and one canonical header slot, identical across the five month-scoped surfaces.

**T6 — Hierarchy for number walls.** A typographic system that lets the single decision-driving number dominate and demotes enumerations (e.g., summarize "7 sobre limite" before listing them). Prove on Presupuesto and the Deudas cuota breakdown.

### Hard guardrails (anti-goals)

- Brass is the only accent. No second accent color, no gradients-as-identity, no purple, no glow.
- Verdict colors bind to existing semantic tokens (income/alert/debt) — no new hues.
- Spanish-first, tuteo, sentence case. Fix the copy drift; do not multiply it.
- Speed over animation: GPU transform/opacity only, nothing that adds a heavy library.
- Do not erase the signatures listed above — unify around them.
- One radial gauge is a signature; ten would be noise. Restraint in viz.
- Use the synced `.z-*` classes and token names in any HTML previews; mark cards with @dsCard; no emoji and no exclamation marks in UI copy.

### Deliverable

Start with T1 (unified verdict). Deliver: (a) the verdict component spec — anatomy, states, vocabulary, token mapping; (b) the three hero redesigns (Deudas, Recurrentes, Plan) as on-brand previews; (c) a one-paragraph migration note describing how the existing dashboard dot-sentence and budget pill converge onto it. Then await feedback before moving to T2.

---

## Appendix — code anchors (for the engineering follow-up, not for the design tool)

- Verdict layer today: `webapp/src/components/dashboard/status-headline.tsx`, `webapp/src/components/mobile/v2/state-chip.tsx` (4 variants, free-text label, barely adopted)
- Fragmented heroes: `hybrid-hero.tsx`, `mobile/v2/deudas/deudas-hero.tsx`, `mobile/v2/plan/plan-net-hero.tsx`, `mobile/v2/plan/plan-budget-hero.tsx`, `recurring/recurring-hero-compact.tsx`, plus v1 leftovers in `mobile/cards/`
- Period control: `webapp/src/components/month-selector.tsx` (label + placement drift)
- Viz split: `webapp/src/components/charts/*` (recharts) vs `accounts/balance-graph-hero.tsx` + `graph-face.tsx` (custom SVG)
- Known copy bug: "Cerca del limite" missing accent in `status-headline.tsx`
- Audit source: ux-analyst run 2026-07-02, full findings table in session transcript

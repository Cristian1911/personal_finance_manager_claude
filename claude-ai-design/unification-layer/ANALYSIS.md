# Unification Layer — Analysis & Migration Map

Source of truth: `SPEC-DIGEST.md` (handoff 7a + territory boards T1–T6, saved in this directory).
Current-code evidence: 7 mapper agents, 233 findings — full inventory in `inventory.md` (file:line | current | target | phase | effort), raw data in `findings-tagged.json`.

**North star:** every screen answers *¿voy bien?* in the hero slot without explanation.
**Scope:** 4 primitives + 1 theme + 6 copy rules. No new tokens (except motion), no new hues, no new libraries.

---

## 1. Standardized patterns (the system in brief)

### `<Verdict />` — the one status voice (T1)
- **Contract:** `state: "vas-bien" | "cerca" | "te-pasaste" | "atencion"`, `delta?`, `detail?`, `compact?`.
- Pill h24, radius 999, pad `0 10px 0 8px`, bg 8% tint + border 20% of the bound token (= existing `.surface-*` recipe, globals.css:243–247 — zero new styles). Word 12px/600 sentence case; Lucide icon 12px stroke 2.5 fixed per state (`Check`, `ArrowUpRight`, `CircleX`, `TriangleAlert`); delta tabular-nums same hue after "·"; detail = one sentence 13px sage-light. Compact = icon + word 11px/600, no pill.
- **The rule:** one full-volume verdict per screen, in the fixed hero slot (eyebrow → number → verdict → detail → meta; 8px/6px/12px gaps). Brass NEVER carries a verdict. Vocabulary closed: Vas bien · Cerca del límite · Te pasaste · Atención (cerca = 75–99%, te-pasaste ≥100% or balance grew, atencion = user action needed).

### `<Disclosure />` — the one expand idiom (T3)
- **Contract:** grid-template-rows 0fr→1fr @`--motion-2` (160ms); content enters @`--motion-1` (120ms) opacity + translateY(-3px)→0; caret ChevronDown 12px stroke 1.5 rotating 180° (the ONLY rotating element); label "Ver + qué" ↔ "Ocultar + qué", 12px/600 sage-light hover:white, hit area ≥44px, never brass, never bare "Ver"/"Expandir"/"Mostrar".
- Motion tokens (net-new, globals.css :root): `--motion-ease: cubic-bezier(0.2,0,0,1)`, `--motion-1/2/3: 120/160/200ms`. Budget: transform+opacity only; nothing >200ms (single exception: 600ms celebration ring sweep).
- **The rule:** dim = focus leaves the page (sheets/dialogs only, `rgba(0,0,0,0.6)+blur(4px)` @200ms). A disclosure never dims. No press-scale, no scroll-motion, no chart animation.

### `<MonthControl />` — the one clock (T5)
- **Contract:** chevron · "Abril 2026" · chevron in a Tier-2 compact-card container (#111, border white/6, radius 10); chevrons 14px stroke 1.5, hit 32×44; label fixed-width (min 88px, tabular-nums), full month + year ALWAYS; next disabled at current month. Range variant for Tendencias ("Nov 2025 – Abr 2026", min 120px).
- Month = ONE app-level key in the URL (`?month=YYYY-MM`), shared by all five surfaces, surviving tab switches; `router.replace` semantics.
- **The rule:** header grammar everywhere — title left (H1 22/600 mobile, 28/700 desktop, = tab name), control right, no subtitles, no wordmark. Format ladder: "Abril 2026" (control only) · "abr" (chart axes only) · "15 de abril" (rows) · relative (Actividad reciente + verdict details only). Past months: lock + "Mes cerrado · solo lectura", capture hidden, verdicts past tense.

### `<GroupSummary />` + ladder — one number decides (T6)
- **Contract:** V2 header 15px/600 = count + aggregate delta ("7 sobre límite · −$486.000"). Mandatory above any 3+ same-state rows. Grammar: "N sobre límite" / "N en orden" / "N de M pagados".
- Ladder: V1 34px/800 (ONE per screen, the derived judgment, only number allowed semantic color at scale) · V2 15/600 · V3 13 (row, delta only in group color) · V4 11 (evidence "$X de $Y").
- **The rule:** state word once per group; healthy groups collapse behind a Disclosure ("Ver 10 en orden"); worst-first by absolute delta; row bars 3px hairline track white/6, over-limit tints debt, healthy fills white/25 — never brass, never green.

### `chartTheme` — gauges judge, charts explain (T2)
- **Contract:** one module consumed by every recharts chart: `CartesianGrid vertical={false} stroke rgba(255,255,255,0.06)` (max 3 hairlines; zero-baselines solid white/12), `XAxis/YAxis axisLine={false} tickLine={false}`, `isAnimationActive: false`, tooltips #111/border-white/6, no legend boxes (inline 8×8 radius-2 swatch chips), labels tabular compact COP ($3,76M) 9–10px sage-dark, axis months "abr" 3-letter lowercase no period.
- Series slots rebind: `--chart-1→--z-brass` (actual/tú), `--chart-2→--z-sage-dark` (comparison), `--chart-3→--z-income`, `--chart-4→--z-expense`, `--chart-5→--z-debt`. Forecasts dashed "4 3" @50% same hue; only dot = 3px "hoy". Lines + bars only — no areas, no pies. Max 2 series + 1 reference.
- **The rule:** Tier-1 gauge (hand-rolled 270° ring, viewBox 0 0 128 128, pathLength=100, track white/6, fill brass→debt only ≥100%) is the only verdict-bearing viz, max one per screen. A verdict chip never sits on a Tier-2 chart.

### Copy rules (close the drift)
1. Verdict vocabulary closed, no synonyms, no uppercase. 2. "Ver + qué"/"Ocultar + qué", never bare. 3. "Abril 2026" only in the control; "abr" on axes; relative only in rows. 4. Celebration eyebrows DEUDA SALDADA · MES CERRADO BAJO PLAN · TODO PAGADO; tuteo, past tense, no "!". 5. Past months: "Mes cerrado", past-tense verdicts. 6. Group summaries "N sobre límite"/"N en orden"/"N de M pagados".

### Guardrails de aceptación
brass nunca en veredictos ni filas · un veredicto a todo volumen por pantalla · un gauge radial por pantalla máximo · solo transform/opacity 120/160/200ms una curva · dim = el foco sale de la página · cero hues nuevos, cero librerías nuevas.

---

## 2. Token mapping (design board → webapp)

| Board token | Webapp reality |
|---|---|
| `--z-ink` | `--z-ink` #0b0b0c (globals.css:72) → `bg-z-ink` / `text-z-ink` |
| `--z-white` | `--z-white` #F6F0E3 (globals.css:79) → `text-z-white` |
| `--z-border` | `--z-border` rgba(217,204,185,0.08) exists but `border-z-border` is DEPRECATED — canonical utility is `border-white/6`; strong variant `--z-border-strong` feeds shadcn `--border` |
| `--z-brass` | `--z-brass` #a98a51 → `text-z-brass` / `bg-z-brass`; hover `--z-brass-hot` #c2a063 |
| `--z-income` | `--z-income` #5CB88A → `text-z-income`; recipe `.surface-income` (globals.css:243) |
| `--z-expense` | `--z-expense` #E8875A → `text-z-expense`; `.surface-expense` |
| `--z-alert` | `--z-alert` #D4A843 → `text-z-alert`; `.surface-alert` |
| `--z-debt` | `--z-debt` #E05545 → `text-z-debt`; `.surface-debt`; also shadcn `--destructive` |
| `--z-sage-light` | `--z-sage-light` #D9CCB9 → `text-z-sage-light` |
| `--z-sage-dark` | `--z-sage-dark` #938C7E → `text-z-sage-dark`; also `--muted-foreground`; `.surface-neutral` |
| `--motion-ease`, `--motion-1/2/3` | **DO NOT EXIST** — create in globals.css :root (next to `--z-layer-*`, lines 152–159) |
| `--chart-1..5` | exist (globals.css:183–187 AND `.dark` 220–224) but bound income/expense/alert/debt/brass — **must rebind in BOTH blocks** |
| `z-card-surface` | `PANEL_SURFACE_CLASS` (styles.ts:63–64) |
| `z-card-compact` | Tier-2 recipe `rounded-xl border border-white/6 bg-[#111]` (hardcoded in ~5 files — promote to constant) |
| `z-card-stat` | `PANEL_INSET_CLASS` (styles.ts:75) / `StatCard` (ui/stat-card.tsx) |
| `z-num` | inline `tabular-nums` |
| hero gradient | `HERO_CARD_GRADIENT_CLASS` (styles.ts:71–72) — character-for-character match to the board |
| eyebrow | `SECTION_EYEBROW_CLASS` (styles.ts:59–60) — exact match |
| buttons | `BRASS_BUTTON_CLASS` / `GHOST_BUTTON_CLASS` / `BRASS_GHOST_BUTTON_CLASS` — unchanged (brass = actions) |
| `--z-excellent` | 5th status hue used by health-levels.ts — OUTSIDE the 3-token verdict palette; Verdict must not use it |

---

## 3. Current-state inventory

233 findings, rendered per territory in **`inventory.md`** (same directory). Counts: tokens 25 · verdicts 35 · headers-month 30 · disclosure-motion 61 · charts 35 · density-glyphs 30 · celebrations 17. Highlights the phase plan below is built from:

- **Verdict dialects (4):** dashboard dot+sentence (`status-headline.tsx`), Inicio uppercase pill via shared `deriveRitmoStatus` ("Vas justo" off-vocabulary), Presupuesto `StateChip` uppercase stamps ("SOBRE LÍMITE"/"ATENCIÓN"), Plan pressure badges ("Estable/Atención/Crítico"). Heroes of Deudas/Recurrentes/Plan render NO judgment.
- **Month/headers:** month already URL state with `router.replace`, but 4 header dialects, 3 steppers + Tendencias `?range=`, month dropped on every tab switch, "Abr" pill and below-hero selectors live, no read-only past months.
- **Disclosure:** ~16 inline grid-rows copies + shared `Expand`/`ExpandableCard`/`HeaderChevron` at 200/150ms+delay-75; ~15 instant `{expanded && …}` mounts; one page-dim (plan-net-hero + use-chart-focus-mode); wide copy drift (bare "Ver", "Expandir", brass labels); sheets at 300–500ms; no framer-motion anywhere (pure CSS migration).
- **Charts:** all recharts already `isAnimationActive={false}` + axisLine/tickLine false; 11 banned AreaCharts, 1 banned Pie, foreign hues (#a1a1aa, #3b82f6, #7c3aed…, DEBT_PALETTE in @zeta/shared), 5 orphan chart files (delete), 5 divergent ring geometries (none 270°).
- **Density/glyphs:** no V1/V2 primitives; 5 hero scales (32–46px); STATE ONCE violated on 6 surfaces; 3 glyph systems (BankBadge letter-monogram → DELETE, AccountIcon tiles via `account-row-identity.tsx` choke point, colored dot = target, 5 sites, 3 sizes).
- **Celebrations:** zero event-gated moments; always-on success states violate "never app-open" (DebtFreeBanner, "Todo al día"); debt-zero lifecycle is manual archive; month-close detection net-new.

---

## 4. Gap analysis

### Reusable as-is (the spec was written for this codebase)
- `.surface-*` recipe = Verdict colors, zero new CSS (globals.css:243–247).
- `HERO_CARD_GRADIENT_CLASS`, `SECTION_EYEBROW_CLASS` = exact board matches.
- `?month=YYYY-MM` URL state + `parseMonth`/`formatMonthParam` + replace-discipline → MonthControl is a UI swap, not a state redesign.
- `mobile/v2/expand.tsx` = Disclosure's engine (retune 200→160ms, add caret+label+content-enter).
- `mobile/v2/progress-ring.tsx` = best seed for the shared Tier-1 270° ring.
- `deriveRitmoStatus` (`packages/shared/src/utils/ritmo.ts`) = verdict state machine seed (shared with mobile).
- `ui/chip.tsx` = convention template (cva + data-slot + cn) for the four new primitives.
- Recharts defaults already half-compliant (no animation, no axis lines).

### Net-new
`--motion-*` tokens · `ui/verdict.tsx` · `ui/disclosure.tsx` · `ui/month-control.tsx` · `ui/group-summary.tsx` · `lib/constants/chart-theme.ts` (or sibling of ui/chart.tsx) · ladder constants (V1–V4) · canonical `AccountDot` · past-month read-only state · month-close detection + celebration gating (profile JSONB or localStorage precedents exist) · `z-ring-sweep`/`z-rise` keyframes · "N de M pagados" grammar.

### Conflicts needing a decision
1. **"cerca" threshold:** spec 75–99 vs code 80/85/90 variants (ritmo 0.85, presupuesto 80, budget-list 85, status-headline 90). → Standardize 75; it's a product behavior change, not just paint.
2. **health-levels.ts 5-state system + `--z-excellent`:** outside closed vocabulary. → Keep as analytical meter (it's a gauge, Tier 1), but its copy stops using verdict words; do NOT feed Verdict from it.
3. **`--chart-*` rebind blast radius:** silently recolors every `var(--chart-N)` consumer → rebind + per-consumer audit must land in ONE change.
4. **@zeta/shared changes** (`ritmo.ts` 4-state, salary-breakdown DEBT_PALETTE): mobile consumes both → mobile needs a same-PR compatibility pass or tolerant mapping.
5. **FAB plus rotate-45** vs "caret is the only rotating element" → propose exempt (overlay affordance, not disclosure) — confirm.
6. **Dialog `zoom-in-95`** vs "nothing scales" → replace with fade/translate at --motion-3.
7. **Tendencias `?range=` (WTD…YTD)** vs range-MonthControl sliding a 6-month window → biggest T5 redesign; keep `?range=` semantics behind the new control or migrate fully.
8. **Recurrentes future-month stepping** vs clamp-at-current → spec says clamp; future preview becomes an explicit exception if product needs it.
9. **Contradictory findings:** `plan-budget-hero.tsx` reported both "dead code, delete" (verdicts mapper) and "mounted by plan-root" (density mapper) → verify importers before deleting. Same check for `pulse-widget`.
10. **Wordmark:** mobile Inicio header title="Zeta" → "Inicio" (wordmark to splash/auth only) — brand-visible change, flag to Cristian.
11. **Month persistence across nav:** tab bar + sidebar links are static hrefs → decide mechanism (client nav components append current `?month=`, or layout store rehydrates) — architectural choice in Fase 2.
12. **TOKENS.md is stale** (progress bars §4/§6 use raw red-500/yellow-500/emerald-500, buttons §7) → docs pass rides along.

---

## 5. Phase plan (by leverage, per handoff)

### Fase 1 · Veredicto (T1) — resolves findings 1, 8
1. `ui/verdict.tsx` (+ story): cva states → `.surface-income/-alert/-debt`; full + compact forms; delta/detail slots.
2. `@zeta/shared/ritmo.ts`: `deriveRitmoStatus` → 4-state, cerca=75; keep label mapping for mobile compatibility.
3. Converge the dialects, one surface at a time:
   - `dashboard/status-headline.tsx` (dot → chip, sentence → detail) + `dashboard-hero.tsx` slot order
   - `dashboard/hybrid-hero.tsx` (top-right pill → slot under number; sparkline verdict-tone → fixed sage later in F3)
   - `plan/tabs/plan-tab-presupuesto.tsx` (chipConfig → Verdict; "En control/Sobre límite" deleted)
   - `plan/plan-hero.tsx` + `actions/plan.ts buildHeroSummary` (pressure → 4-state; headlines → detail lines)
   - `mobile/v2/plan/plan-net-hero.tsx`, `mobile/v2/deudas/deudas-hero.tsx`, `debt/debt-hero-card.tsx`, `mobile/v2/plan/mobile-recurrentes-view.tsx` hero, `plan/tabs/plan-tab-recurrentes.tsx` (+ `ui/attention-card.tsx` "Necesita atención" → atencion, never brass)
   - `tendencias/verdict-header.tsx` (brass → semantic), `budget/scenario/scenario-verdict.tsx` (delta grammar), `mobile/v2/inicio/widgets/attention-widget.tsx`
4. Copy sweep: section subtitles drop verdict clauses (`flujo-section.tsx`, `presupuesto-section.tsx`), `(dashboard)/layout.tsx` attentionSummary, `plan-drill-cards.tsx`/`plan-zone-chips.tsx` (brass/amber → tokens, group grammar).
5. Delete dead dialects after import-verification: `plan-budget-hero.tsx`?, `pulse-widget.tsx`?, `mobile-dashboard-v2.tsx`, `burndown-expandable` strings.
- **Guardrails:** one full-volume verdict per screen; brass never on verdicts.

### Fase 2 · Marco (T5+T3) — resolves 3, 4, 6
1. Motion tokens in globals.css; retune `page-enter` to 120ms/--motion-ease.
2. `ui/disclosure.tsx` wrapping the Expand engine; migrate ~45 call-sites (list in inventory: disclosure-motion); delete page-dim (`plan-net-hero.tsx` overlay + `hooks/use-chart-focus-mode.ts`); copy rule 2 sweep (bare Ver/Expandir/Mostrar/brass labels, `INLINE_EXPAND_TOGGLE_CLASS` rebind).
3. `ui/month-control.tsx` (evolve `month-selector.tsx`; kill compact/short label; clamp next; capitalize label via helper not CSS); delete `use-recurring-month.ts` stepper + orphaned `recurring-hero-compact.tsx`/manager; Tendencias range variant over `period-control.tsx`.
4. Canonical header on 7 surfaces (dashboard desktop+starter+mobile wordmark, transactions PageHero pills, plan + subtabs "Abr" pill, presupuesto/recurrentes duplicates, deudas mobile+desktop, tendencias shell); subtitles deleted; month survives nav (mechanism per §4.11); redirects forward month.
5. Sheet/drawer/dialog/FAB: 200ms + rgba(0,0,0,0.6)+blur(4px) backdrops + 40×4 white/12 handle; press-scale purge; off-token durations clamp (300/400/500 → 120/160/200).
6. Past-month read-only line + capture hiding (net-new, per-surface flag from shared month).
- **Guardrails:** solo transform/opacity 120/160/200 una curva; dim solo al salir de la página.

### Fase 3 · Densidad (T6+T2) — resolves 2, 5, 7
1. `chart-theme.ts` + `--chart-*` rebind (both :root and .dark) + consumer audit; delete 5 orphan chart files; area→line ×11; pie→bars (category-donut); foreign hex → tokens (incl. @zeta/shared salary-breakdown palette); axis formatter ladder; tooltip/swatch standardization; verdict-bearing elements off charts (budget-pace color, burndown badge, sparkline tones).
2. Shared Tier-1 270° ring (seed progress-ring.tsx) replacing speedometer-gauge, ritmo-widget ArcRing, debt utilization ring, mobile-budget-ring; one gauge per screen audit; 600ms gauge transition removed.
3. Ladder constants + `ui/group-summary.tsx`; apply to `mobile-budget-list.tsx` (V2 headers, worst-first by absolute delta, healthy behind Disclosure, 3px hairline bars), `budget-category-grid.tsx`/`budget-summary-bar.tsx` desktop, deudas rows (`deudas-cuentas-lens.tsx` brass tick-gauge → white/25, V2 "N cuotas este mes"), STATE-ONCE sweeps (recurring card/timeline, transaction table status column, tendencias delta chips, trend-comparison badges, inicio attention strip), one-V1 normalization per screen.
4. Glyphs: canonical `AccountDot`; swap inside `account-row-identity.tsx` (7 sites at once); delete `bank-badge.tsx`; converge 5 dot sites on one size; token fallback (kill #6366f1).
- **Guardrails:** un gauge por pantalla; brass nunca en filas; cero hues nuevos.

### Fase 4 · Calidez (T4) — resolves 9
1. `z-ring-sweep` + `z-rise` keyframes (globals.css, consume --motion-ease).
2. Celebration primitive (brass-on-number + eyebrow swap + Vas bien chip + detail, event-gated once, max one per visit, collision rule).
3. Event 1 Deuda saldada (zero-balance trigger replacing manual-archive-only flow; ring sweep 600ms; "Saldadas" group on both platforms, rows opacity 0.7).
4. Event 2 Mes cerrado bajo plan (first-visit flag in profile JSONB `celebrations.lastClosedMonthShown` or localStorage; margin from `getMonthlyCashflow().net` + `getBudgetSummary(month)`; CTAs Mover al ahorro / Ver julio).
5. Event 3 Todo pagado ("N de M pagados" grammar first; count turns brass; chip flips Atención→Vas bien; segment dot strip; empty inbox names next charge from `getPendingOccurrences`).
6. "Logro" residue rows in `inicio-activity.tsx` + desktop Últimas transacciones (needs row-type discriminator on `RecentActivityTx`); de-celebrate always-on surfaces (DebtFreeBanner → informational, "¡Libre de deudas!" copy, "Todo al día" card).
- **Guardrails:** one event, once, brass-on-number; no fifth verdict state.

---

## 6. Risks & open questions

1. **Threshold unification changes behavior**, not just paint (cerca 75 vs 80/85/90). Needs Cristian's sign-off — it will re-classify months that today read "En control".
2. **`--chart-*` rebind is app-wide**: any missed `var(--chart-N)` consumer silently swaps hue. Mitigation: grep-audit + visual pass on Tendencias/forecast/flujo in the same PR.
3. **Shared-package edits hit mobile** (ritmo verdict states, debt palette): mobile app must keep compiling/rendering; parity pass required (webapp is design source of truth, mobile mirrors later — but don't break its build).
4. **Tendencias time model** (WTD/YTD chips) doesn't reduce cleanly to a 6-month range slider; decide keep-behind-new-control vs full migration before F2 lands there.
5. **Month persistence across nav** needs one mechanism (link decoration vs store rehydration) — decide once, apply to tab bar + sidebar + redirects.
6. **Conflicting dead-code reports** (plan-budget-hero, pulse-widget): verify importers before deletion.
7. **Subtitle deletions lose information** (freshness, counts, "días restantes") — relocate to hero meta row or drop deliberately, per surface.
8. **Vaul/shadcn animation overrides** (500ms defaults) may need CSS specificity care; verify sheet feel at 200ms on device.
9. **Wordmark removal from mobile Inicio header** is a visible brand change — confirm.
10. **Docs debt:** TOKENS.md §4/§6/§7/§10 and Storybook chart stories must be updated with the new primitives/theme, or the old patterns will keep propagating.

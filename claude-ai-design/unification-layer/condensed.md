== tokens ==
SUMMARY: Token foundation is already 95% in place: all 10 design-board tokens (--z-ink, --z-white, --z-border, --z-brass, --z-income, --z-expense, --z-alert, --z-debt, --z-sage-light, --z-sage-dark) exist under identical names in webapp/src/app/globals.css :root (lines 70-93) and are exposed as Tailwind utilities (text-z-*/bg-z-*/border-z-*) via @theme inline; the exact 8%-tint/20%-border verdict recipe already ships as .surface-income/-expense/-debt/-alert/-neutral classes (globals.css 243-247) with only 3 consumers today. What does NOT exist: --motion-ease/--motion-1/2/3 tokens (zero motion tokens anywhere; only a page-enter 0.1s keyframe plus ~54 hardcoded Tailwind duration-* call-sites), z-card-* classes (their equivalents are PANEL_SURFACE_CLASS, the bg-[#111] Tier-2 compact recipe, and PANEL_INSET_CLASS/StatCard), celebration keyframes, and a 270° gauge. The closest Verdict precursor is mobile/v2/state-chip.tsx (12%/25% uppercase 9px — a different dialect), alongside the dashboard status dot (status-headline.tsx) and the plan/budget "En control/Atención/Sobre límite" chipConfig. Chart slots --chart-1..5 exist but are bound income/expense/alert/debt/brass in BOTH :root and .dark, so the T2 rebind to brass/sage-dark/income/expense/debt requires auditing every var(--chart-N) consumer. HERO_CARD_GRADIENT_CLASS in lib/constants/styles.ts matches the board's hero gradient character-for-character, and SECTION_EYEBROW_CLASS matches the eyebrow spec; TOKENS.md is stale on buttons and progress bars and needs a docs pass.
- [1/trivial] token-parity-core @ webapp/src/app/globals.css:70-93
  NOW: All 10 design-board tokens already exist under the same names in :root — --z-ink:#0b0b0c, --z-white:#F6F0E3, --z-brass:#a98a51, --z-income:#5CB88A, --z-expense:#E8875A, --z-alert:#D4A843, --z-debt:#E05545, --z-sage-light
  TO:  No new tokens needed (spec: 'cero hues nuevos'). Verdict/chartTheme bind to these existing vars. Note --z-excellent is a 5th status hue outside the board's 3-token verdict palette — Verdict must NOT u
- [1/trivial] surface-recipe-exists @ webapp/src/app/globals.css:243-247
  NOW: The exact 8%-tint/20%-border recipe the Verdict spec names already exists as utility classes in @layer base: `.surface-income { color: var(--z-income); border-color: color-mix(in srgb, var(--z-income) 20%, transparent); 
  TO:  <Verdict /> pill binds to this exact recipe (spec T1: 'existing .surface-* recipe... No new styles'). Reuse the classes or the color-mix formula directly; states map vas-bien→surface-income, cerca/ate
- [1/medium] state-chip-closest-verdict-precursor @ webapp/src/components/mobile/v2/state-chip.tsx:3-28
  NOW: StateChip is the closest existing verdict chip but uses a DIFFERENT recipe: variants `sage: "bg-z-income/12 border-z-income/25 text-z-income"`, `brass: "bg-z-brass/12 border-z-brass/25 text-z-brass"`, `warn: "bg-z-alert/
  TO:  Replaced by <Verdict /> (8% tint/20% border via surface-*, sentence case 12px/600, fixed Lucide icon 12px stroke 2.5, closed 4-word vocabulary). Also note it has a `brass` variant — spec forbids brass
- [1/small] dashboard-status-dot @ webapp/src/components/dashboard/status-headline.tsx:27-55
  NOW: Dashboard status dot + sentence: `dotColor = "bg-z-debt" | "bg-z-alert" | "bg-z-income"` rendered as `<span className={\`inline-block h-2 w-2 rounded-full shrink-0 ${dotColor}\`}>` beside 15px muted copy. Strings: "Te pa
  TO:  Phase 1 converges this into <Verdict /> chip in the same hero position; existing sentence survives verbatim as the detail line. Delete the dot.
- [1/medium] presupuesto-pill-dialect @ webapp/src/components/plan/tabs/plan-tab-presupuesto.tsx:149-155
  NOW: Budget hero chip dialect: `pressure = progress >= 100 ? "critical" : progress >= 80 ? "watch" : "stable"` with `chipConfig = { stable: { label: "En control", variant: "sage" }, watch: { label: "Atención", variant: "warn"
  TO:  Vocabulary closes to Vas bien · Cerca del límite · Te pasaste · Atención via <Verdict />; "En control"/"Sobre límite" labels deleted; brass never on verdicts.
- [1/small] chip-primitive-conventions @ webapp/src/components/ui/chip.tsx:19-65
  NOW: Canonical ACTION chip (not status): cva variants neutral (`border-white/6 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]`), active (`border-z-brass/30 bg-z-brass/10 text-z-brass`), primary (`border-z-brass b
  TO:  Keep for actions. <Verdict /> should be a NEW sibling primitive (ui/verdict.tsx) following this exact pattern: cva + VariantProps, data-slot, asChild optional, cn() from @/lib/utils — spec chip anatom
- [1/trivial] badge-primitive @ webapp/src/components/ui/badge.tsx:7-27
  NOW: shadcn Badge cva: variants default (bg-primary), secondary, destructive (bg-destructive text-white), outline (border-border text-foreground), ghost, link; base `inline-flex items-center justify-center rounded-full border
  TO:  Keep Badge for generic labels; the Badge+surface-* combo call sites migrate to <Verdict compact /> where the label is a status judgment.
- [1/trivial] other-pill-inventory @ webapp/src/lib/constants/styles.ts:126-155
  NOW: Non-status pill constants that Verdict must NOT absorb (actions/toggles): MOBILE_ACTION_BUTTON_CLASS `rounded-lg border border-z-brass/20 bg-z-brass/8 px-2.5 py-1 text-[10px] font-semibold text-z-brass` (126-127), DETAIL
  TO:  Unchanged — these are action/toggle pills. Inventory recorded so Verdict migration doesn't touch them.
- [3/small] kpi-widget-tint-drift @ webapp/src/components/ui/kpi-widget.tsx:14-20
  NOW: KPIWidget colorMap uses a 10% icon-tint dialect: `income: { icon: "bg-z-income/10 text-z-income" ... }`, expense/debt/alert same pattern, on `rounded-[14px] bg-z-surface-2` container (no border-white/6, arbitrary radius)
  TO:  Not a Verdict target, but a tint-recipe drift call-site (10% vs the 8%/20% surface recipe) to normalize during Phase 3 density pass.
- [2/medium] motion-tokens-missing @ webapp/src/app/globals.css:256-262
  NOW: NO motion tokens exist anywhere (`--motion` greps to zero across src/ and docs/). Only motion CSS in globals.css: `@keyframes page-enter { from { opacity: 0; transform: translateY(3px); } ... }` + `.animate-page-enter { 
  TO:  Add to :root — `--motion-ease: cubic-bezier(0.2, 0, 0, 1); --motion-1: 120ms; --motion-2: 160ms; --motion-3: 200ms` — and migrate transition call-sites; anything >200ms deleted except the 600ms celebr
- [2/medium] disclosure-precursor-expand @ webapp/src/components/mobile/v2/expand.tsx:16-26
  NOW: Shared Expand already uses the spec's mechanism: `"grid transition-[grid-template-rows] duration-200 ease-out"`, `open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"`, inner `min-h-0 overflow-hidden`, content stays mounted (Ani
  TO:  Becomes the engine of <Disclosure /> — add caret (chevron-down 12px stroke 1.5, rotate 180°), "Ver + qué"/"Ocultar …" label 12px/600 sage-light, --motion-2 container + --motion-1 content opacity/trans
- [2/large] disclosure-precursor-expandable-card @ webapp/src/components/mobile/cards/expandable-card.tsx:24-52
  NOW: ExpandableCard: container `rounded-[18px] border border-white/6 bg-[#111] transition-colors` (+`border-white/10` when expanded), inline `style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}` with `transition-[grid-temp
  TO:  All expand call-sites converge on <Disclosure /> with caret + labeled affordance and motion tokens; rounded-[18px] and bg-[#111] are the Tier-2 compact-card recipe (see card-tiers finding).
- [2/small] expand-toggle-brass-violation @ webapp/src/lib/constants/styles.ts:157-163
  NOW: INLINE_EXPAND_TOGGLE_CLASS = `"flex w-full items-center justify-center gap-1 border-t border-white/6 py-2 text-[11px] font-semibold text-z-brass transition-colors hover:bg-white/[0.02]"` — a disclosure affordance in BRAS
  TO:  Both fold into <Disclosure /> affordance: 12px/600 text-z-sage-light hover:text-white, chevron caret, "Ver + qué"/"Ocultar + qué" labels; brass removed.
- [2/trivial] radix-collapsible-unstyled @ webapp/src/components/ui/collapsible.tsx:1-33
  NOW: Unstyled Radix Collapsible passthrough (Collapsible/CollapsibleTrigger/CollapsibleContent with data-slot attrs, zero classes). Available but rarely the pattern used; grid-rows Expand is the de-facto idiom.
  TO:  Either becomes the a11y skeleton inside <Disclosure /> or stays for non-animated collapse; decide during Phase 2 build.
- [2/medium] month-selector-current-state @ webapp/src/components/month-selector.tsx:16-76
  NOW: MonthSelector: shadcn `<Button variant="outline" size="icon-sm">` chevrons (ChevronLeft/Right h-4 w-4), center Button `variant={isCurrent ? "secondary" : "outline"}` with `compact ? "min-w-0 px-2 text-xs capitalize" : "m
  TO:  <MonthControl />: compact-card container (#111/border-white/6/radius 10), chevrons 14px stroke 1.5 hit 32×44, fixed-width tabular label min 88px, "Abril 2026" always (kill compact/short mode from head
- [2/medium] header-grammar-primitives @ webapp/src/components/ui/page-header-row.tsx:19-45
  NOW: PageHeaderRow (desktop-only `hidden lg:flex`): `<h1 className="text-[22px] font-bold tracking-tight">` + optional subtitle `mt-0.5 text-sm text-muted-foreground` + actions slot. PageHero (ui/page-hero.tsx:29-59) renders 
  TO:  Canonical header: H1 22px/600 (28px/700 desktop) sentence case matching tab name, MonthControl top-right, NO subtitles. PageHeaderRow drops subtitle prop; PageHero description demoted per-surface.
- [2/small] card-tiers-mapping @ webapp/src/lib/constants/styles.ts:63-89
  NOW: No z-card-* classes exist anywhere (grep zero). Equivalents: Tier 1 surface = PANEL_SURFACE_CLASS `"rounded-2xl border border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"` (63-64) + PANEL_SURF
  TO:  Board's z-card-surface/z-card-compact/z-card-stat map onto PANEL_SURFACE_CLASS / Tier-2 #111 compact / PANEL_INSET_CLASS respectively; MonthControl + compact rows use the Tier-2 recipe (#111, border w
- [1/trivial] hero-gradient-exact-match @ webapp/src/lib/constants/styles.ts:71-72
  NOW: HERO_CARD_GRADIENT_CLASS = `"bg-[radial-gradient(circle_at_top_left,rgba(63,70,50,0.22),transparent_42%),linear-gradient(180deg,rgba(27,30,27,0.96),rgba(18,20,18,0.98))]"` — EXACTLY the board's hero gradient. Used by: mo
  TO:  HERO_CARD_GRADIENT_CLASS is the canonical hero-card gradient for the fixed hero slot (eyebrow → number → verdict → detail → meta); consider collapsing PageHero GRADIENTS.sage into it.
- [1/trivial] button-constants-and-stale-tokens-doc @ webapp/src/lib/constants/styles.ts:1-11
  NOW: BRASS_BUTTON_CLASS = `"bg-gradient-to-b from-z-brass-hot to-z-brass text-z-ink hover:brightness-110"`; GHOST_BUTTON_CLASS = `"border-white/6 bg-black/10 text-z-sage-light hover:bg-white/5 hover:text-z-sage-light"`; BRASS
  TO:  Buttons unchanged (brass = actions, per spec). Update TOKENS.md §7 to match code during the unification-layer docs pass; celebration CTA 'brass-ghost' = existing BRASS_GHOST_BUTTON_CLASS.
- [3/medium] chart-token-rebind @ webapp/src/app/globals.css:182-187
  NOW: Chart slots bound in :root (183-187) AND duplicated in .dark (220-224): `--chart-1: var(--z-income); --chart-2: var(--z-expense); --chart-3: var(--z-alert); --chart-4: var(--z-debt); --chart-5: var(--z-brass);` — compone
  TO:  T2 rebind: --chart-1 → --z-brass (actual/tú), --chart-2 → --z-sage-dark (ideal/promedio), --chart-3 → --z-income, --chart-4 → --z-expense, --chart-5 → --z-debt. Must change BOTH :root and .dark blocks
- [3/large] chart-theme-home @ webapp/src/components/ui/chart.tsx:37-73
  NOW: shadcn ChartContainer/ChartStyle wrapper exists (recharts, per-chart ChartConfig with color/theme per series); no shared zeta chartTheme object — each chart in src/components/charts/ configures its own grid/axis/palette.
  TO:  New `chartTheme` object (axisLine={false}, tickLine={false}, CartesianGrid vertical={false} stroke white/6, isAnimationActive:false, series slots) exported near ui/chart.tsx or lib/, consumed by Tende
- [3/small] tokens-doc-progress-bar-conflict @ docs/design-system/TOKENS.md:62-77
  NOW: TOKENS.md §4 canonical progress bar: container `h-2 w-full rounded-full bg-muted`, thresholds `>=100% → bg-red-500`, `>=75% → bg-yellow-500`, `<75% → bg-emerald-500` — raw Tailwind hues, not z-tokens, and h-2 (8px). §6 h
  TO:  T6 row bars: 3px hairlines, track white/6, over-limit tint --z-debt, healthy fill white/25 (never brass, never green fills); TOKENS.md §4/§6/§10 need updating as part of the unification docs so the ol
- [1/medium] health-levels-5-state-system @ webapp/src/lib/health-levels.ts:5-67
  NOW: Parallel status vocabulary: `type Level = "excelente" | "solido" | "atento" | "alto" | "critico"` with getLevelColor → var(--z-excellent)/var(--z-income)/var(--z-alert)/var(--z-expense)/var(--z-debt) (5 hues) and getLeve
  TO:  Out of Verdict's closed vocabulary but a second status dialect; Phase 1 should decide whether health meters keep their 5-level gradient (analytical, not verdict) or their TAGS re-case into Verdict com
- [4/small] celebration-keyframes-missing @ webapp/src/app/globals.css:256-262
  NOW: Only `@keyframes page-enter` exists. No z-ring-sweep (dashoffset 100→0, 600ms) or z-rise (opacity 0→1 + translateY 6px→0, 120ms) keyframes; no brass-on-number pattern anywhere (hero numbers today are white or semantic-co
  TO:  Phase 4 adds @keyframes z-ring-sweep + z-rise to globals.css next to page-enter; brass number treatment appears only in the three celebration events.
- [1/trivial] primitive-conventions @ webapp/src/components/ui/chip.tsx:1-65
  NOW: Conventions for new primitives (Verdict, Disclosure, MonthControl, GroupSummary): live in webapp/src/components/ui/ as kebab-case .tsx files; named function exports (no default); `cn()` from "@/lib/utils" (clsx + twMerge
  TO:  New primitives follow these exact conventions: ui/verdict.tsx, ui/disclosure.tsx, ui/month-control.tsx (or evolve components/month-selector.tsx), ui/group-summary.tsx + stories.
== verdicts ==
SUMMARY: Zeta's webapp today speaks at least four verdict dialects that Fase 1 must converge into <Verdict />: (1) the dashboard dot+sentence in StatusHeadline (h-2 w-2 dot, "Te pasaste del presupuesto —…", thresholds >100/>=90), (2) the Inicio HybridHero uppercase pill driven by shared deriveRitmoStatus ("Vas bien"/"Vas justo"/"Te pasaste", 0.85 alert threshold — off-vocabulary and shared with mobile), (3) the Presupuesto StateChip pills whose `uppercase` class produces the "SOBRE LÍMITE"/"ATENCIÓN" stamps (plan-tab-presupuesto chipConfig, thresholds 100/80) plus per-group risk labels in mobile-budget-list (Sobre/Cerca/Dentro del límite at >100/85/<85, over colored expense-orange and near colored brass), and (4) the Plan hero pressure badges ("Estable"/"Atención"/"Crítico" from actions/plan.ts buildHeroSummary). Deudas (debt-hero-card desktop, deudas-hero mobile), Recurrentes (mobile-recurrentes-view hero, brass eyebrow) and Plan mobile (plan-net-hero) heroes confirm the handoff's claim: they render eyebrow→number→evidence with no verdict word, and the insertion point is directly under each hero number. Thresholds are inconsistent across surfaces (75/80/85/90 for "cerca"), several judgments ride brass (plan-drill-cards "N sobre límite", AttentionCard "Necesita atención", Tendencias VerdictHeader callout, Por-resolver widget tone) violating the brass guardrail, and a large family of off-vocabulary verdict strings lives in DEAD code (mobile-dashboard-v2, burndown-expandable, pulse-widget, plan-budget-hero) that should be deleted rather than migrated. Good news: the exact Verdict chip recipe already exists as `.surface-*` utilities in globals.css (8% color-mix bg + 20% border), and the shared RitmoStatusTone already uses the income/alert/debt token triad the spec requires.
- [1/small] dashboard-status-dot @ webapp/src/components/dashboard/status-headline.tsx:25-57
  NOW: The dashboard status dot: `<span className={"inline-block h-2 w-2 rounded-full shrink-0 " + dotColor} aria-label=... />` + 15px muted sentence. States: spentPercent > 100 → dotColor "bg-z-debt", copy `Te pasaste del pres
  TO:  Replace dot+sentence with <Verdict state> chip in same position; existing sentence survives verbatim as the detail line. Thresholds re-bound to vas-bien / cerca 75-99 / te-pasaste >=100.
- [1/medium] dashboard-status-dot-mount @ webapp/src/components/dashboard/dashboard-hero.tsx:190-193
  NOW: `<StatusHeadline allocationData={allocationData} />` rendered inside desktop DashboardHero below the KPI grid, wrapped with debtFreeBanner in a `space-y-3` div. Hero slot order today: 'Estado del mes' pill + freshness ba
  TO:  Verdict moves into the fixed hero slot: eyebrow → number → verdict → detail → meta. Freshness badge either becomes meta or feeds the atencion state.
- [1/medium] inicio-hero-status-pill @ webapp/src/components/dashboard/hybrid-hero.tsx:128-155
  NOW: HybridHero (Inicio hero, mounted in zones/hero-zone.tsx:83 desktop and zones/mobile-zone.tsx:155 mobile) renders a status pill top-right: `inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] fo
  TO:  Pill becomes <Verdict /> chip: sentence case, 12px/600, icon per state, 8%/20% surface recipe; moves from top-right corner into the slot under the hero number; "Vas justo" is off-vocabulary → "Cerca d
- [1/small] ritmo-verdict-logic @ packages/shared/src/utils/ritmo.ts:43-51
  NOW: deriveRitmoStatus — the state machine feeding the Inicio hero pill (shared web+mobile): `if (ritmo.availableTotal < 0 || overspentToday) return { tone: "debt", label: "Te pasaste" }; if (ritmo.spentFraction >= 0.85) retu
  TO:  Return Verdict states (vas-bien | cerca | te-pasaste | atencion) with closed vocabulary; "Vas justo" → "Cerca del límite"; threshold 75-99%. Shared package change — mobile consumes it too.
- [1/medium] presupuesto-hero-pill @ webapp/src/components/plan/tabs/plan-tab-presupuesto.tsx:149-155, 186-233
  NOW: Presupuesto mobile hero (route /plan?tab=presupuesto, /presupuesto redirects here): `const pressure = progress >= 100 ? "critical" : progress >= 80 ? "watch" : "stable"` + chipConfig `{ stable: { label: "En control", var
  TO:  Single hero <Verdict />: "Sobre límite" re-cases to "Te pasaste", binds to surface-debt recipe; "En control" → "Vas bien"; threshold watch 80 → cerca 75. Hero becomes the one full-volume verdict of th
- [1/medium] state-chip-primitive @ webapp/src/components/mobile/v2/state-chip.tsx:3-28
  NOW: StateChip — the uppercase pill primitive behind every SOBRE LÍMITE/ATENCIÓN stamp: `inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em]` with variants `{ sage: "bg-
  TO:  Verdict-bearing call-sites migrate to <Verdict /> (12px/600 sentence case, 8%/20% recipe, icon). StateChip either deleted or restricted to non-verdict metadata chips; brass variant never for status.
- [3/medium] budget-risk-groups @ webapp/src/components/budget/mobile-budget-list.tsx:33-45, 96-104, 181-207
  NOW: Mobile budget list groups by risk: `over` percentUsed > 100, `near` >= 85 && <= 100, `safe` < 85 (worst-first sort). Rendered as three RiskSections with colored eyebrow labels: `<RiskSection label="Sobre límite" labelCla
  TO:  T6 GroupSummary V2 headers ("7 sobre límite · −$486.000" / "10 en orden"), state word once per group, healthy group collapses behind Disclosure "Ver 10 en orden"; colors re-bound: over → debt, near → 
- [3/small] budget-row-stamps @ webapp/src/components/budget/mobile-budget-list.tsx:209-268
  NOW: BudgetCategoryRow: `const isOver = pct > 100; const isWarning = pct >= 85 && pct <= 100; const barColor = isOver ? "bg-z-debt" : isWarning ? "bg-z-alert" : "bg-z-income"`. Spent amount colored `isOver ? "text-z-debt" : i
  TO:  Rows demote to V3/V4: delta only in group color, no per-row verdict tint on healthy rows; bars 3px hairline track white/6, only over-limit rows tint debt.
- [1/small] budget-desktop-percent-stamps @ webapp/src/components/budget/budget-summary-bar.tsx:49-59
  NOW: Desktop Presupuesto header percent: `overallPercent > 100 ? "text-z-debt" : overallPercent > 80 ? "text-z-expense" : "text-foreground"` on an 18px number — a naked colored percentage with no word (the '75-99% yellow perc
  TO:  Percent stays V1 hero number; judgment moves to a single <Verdict /> chip; threshold 80 → 75, expense-orange → alert token.
- [3/trivial] budget-card-bar-thresholds @ webapp/src/components/budget/budget-category-card.tsx:38-44
  NOW: Desktop category card bar: `const barColor = totalPercent >= 100 ? "bg-z-debt" : totalPercent >= 75 ? "bg-z-alert" : undefined` (undefined falls back to category.color fill). The only place already using the 75% cerca th
  TO:  Keep thresholds (they match the spec) but bars become 3px hairlines; healthy fill white/25 not category color at full saturation.
- [1/medium] plan-hero-pressure-badge @ webapp/src/components/plan/plan-hero.tsx:19-32, 49-51
  NOW: Desktop Plan hero (mounted plan-resumen-zone.tsx:36) pressure pill: `pressureStyles = { stable: { badge: "border-z-income/30 bg-z-income/10 text-z-income", label: "Estable" }, watch: { badge: "border-z-alert/30 bg-z-aler
  TO:  Badge row replaced by <Verdict /> under the hero number (full slot: eyebrow → number → verdict → detail → meta). Crítico → "Te pasaste", Estable → "Vas bien".
- [1/medium] plan-pressure-logic @ webapp/src/actions/plan.ts:88-163
  NOW: buildHeroSummary — Plan pressure state machine: `isCritical = heroData.availableToSpend < 0 || (spentPercent != null && spentPercent > 100)`; `isWatch = !isCritical && (pendingObligations.length > 0 || freshness !== "fre
  TO:  Map to the 4-state machine: spentPercent>=100 or negative margin → te-pasaste; 75-99 → cerca; pendingObligations/freshness → atencion; else vas-bien. Headlines become verdict detail lines.
- [1/trivial] plan-overlimit-thresholds @ webapp/src/actions/plan.ts:196-203, 241-250
  NOW: PlanBudgetSummary counts feeding chips/rails/drill-cards everywhere: `overLimitCategories = categories.filter((c) => (c.budget ?? 0) > 0 && c.percentUsed > 100)`; `nearLimitCategories = ... c.percentUsed >= 85`; attentio
  TO:  Canonical counts source for GroupSummary ("N sobre límite") and cerca threshold moves 85 → 75 to match the closed vocabulary semantics.
- [1/medium] plan-mobile-hero-no-verdict @ webapp/src/components/mobile/v2/plan/plan-net-hero.tsx:50-102
  NOW: Mobile Plan hero (mounted via plan-root.tsx:58): eyebrow "Neto del mes" 10px uppercase text-z-brass (brass eyebrow) + meta "{daysRemaining} días restantes" → 3xl number colored by sign (`neto > 0 ? "text-z-income" : neto
  TO:  Adopt full Verdict slot: chip under the number (state from plan pressure/margin), detail sentence, meta row. Expand label becomes Disclosure "Ver flujo por día" (T3).
- [1/small] deudas-hero-mobile-no-verdict @ webapp/src/components/mobile/v2/deudas/deudas-hero.tsx:43-88
  NOW: Mobile Deudas hero (mounted deudas-lens-root.tsx:131): eyebrow MOBILE_EYEBROW_CLASS "Cuota mensual" → 32px `font-[680] tracking-[-0.05em] tabular-nums` number + right-aligned interest (`text-z-debt` 16px + "en intereses"
  TO:  Insert <Verdict /> per T6: "Vas bien · 24% del ingreso" chip (white V1 number stays uncolored when vas-bien), detail line, split bar stays as T2 evidence.
- [1/medium] deudas-hero-desktop-no-verdict @ webapp/src/components/debt/debt-hero-card.tsx:24-76
  NOW: Desktop Deudas hero (deudas/page.tsx:208): Card with two gradient tiles — left "Deuda total" label + 2xl/3xl bold number + "Pagas al mes" + number; right "Intereses / mes" uppercase label + 2xl text-z-expense number + "D
  TO:  Restructure to canonical hero slot with <Verdict /> under the deciding number (cuota vs ingreso), debt-red reserved for te-pasaste states only.
- [1/medium] recurrentes-hero-no-verdict @ webapp/src/components/mobile/v2/plan/mobile-recurrentes-view.tsx:241-264
  NOW: Recurrentes hero (route /recurrentes redirects to /plan?tab=recurrentes → this view on mobile): HERO_CARD_GRADIENT_CLASS card, eyebrow "Compromiso mensual" `text-[10px] font-semibold uppercase tracking-[0.18em] text-z-br
  TO:  Full slot: eyebrow (sage-dark not brass) → number → <Verdict /> ("Vas bien" when all paid / atencion when payment due) → detail "N de M pagados" (T6 group grammar) → meta. Feeds T4 'Todo pagado' celeb
- [1/medium] recurrentes-desktop-header @ webapp/src/components/plan/tabs/plan-tab-recurrentes.tsx:68-99
  NOW: Desktop Recurrentes: h2 "Recurrentes" + subtitle "{activeCount} plantillas activas", SummaryCard metrics (Plantillas activas / Salidas/mes / Entradas/mes) and `<AttentionCard signals={...page === "recurrentes"} />`. No h
  TO:  Adopt canonical hero with <Verdict /> slot; AttentionCard signals fold into the atencion state.
- [1/small] attention-card-dialect @ webapp/src/components/ui/attention-card.tsx:24-61
  NOW: AttentionCard header: `{hasSignals ? "Necesita atención" : "Estado"}` as 10px uppercase eyebrow in `text-z-brass` when signals exist (brass carries the verdict), `text-z-olive-deep` otherwise; empty state renders CheckCi
  TO:  "Necesita atención" → <Verdict state="atencion"> (word "Atención", TriangleAlert icon, --z-alert 8%/20%) — never brass; "Al día" → "Vas bien".
- [1/trivial] attention-summary-strings @ webapp/src/app/(dashboard)/layout.tsx:85-92
  NOW: attentionSummary fed to the mobile shell: `?? \`${attentionSnapshot.totalAction} pendientes requieren atención\`` / `\`${totalSuggestion} sugerencia(s) para revisar\`` / `"Todo en orden por ahora"` — a third phrasing fam
  TO:  Copy converges on closed vocabulary: atencion detail line grammar; "Todo en orden por ahora" → "Vas bien" family.
- [1/small] attention-widget-por-resolver @ webapp/src/components/mobile/v2/inicio/widgets/attention-widget.tsx:40-73
  NOW: Inicio "Por resolver" widget: `tone = overdueCount > 0 ? "debt" : total > 0 ? "brass" : "foreground"` (brass carries needs-action), empty state CheckCircle2 text-z-income + "Al día" 12px semibold, caption `"${overdueCoun
  TO:  atencion state binds to --z-alert (not brass); "Al día" re-words to vas-bien vocabulary; compact Verdict form for the chip.
- [1/trivial] flujo-subtitle-verdict @ webapp/src/components/dashboard/flujo-section.tsx:61-76
  NOW: Dashboard Flujo section subtitle generator: `flujoSubtitle = \`Gastaste ${X} de ${Y} — por encima del ingreso\`` when expenses > income, `\`... — vas bien\`` when income > 0, else `\`${X} en gastos este mes\`` / "Importa
  TO:  Section subtitles stop carrying verdict words (one full-volume verdict per screen); keep as neutral evidence or delete.
- [1/trivial] presupuesto-subtitle-verdict @ webapp/src/components/dashboard/presupuesto-section.tsx:45-58
  NOW: Dashboard Presupuesto section subtitle: totalSpentPct > 100 → `\`Necesidades al ${needsPct}% — por encima del presupuesto\``; >= 90 → `\`... — cerca del limite\`` (unaccented); else `\`... — dentro del presupuesto\``. Sa
  TO:  Delete verdict clause from subtitle (verdict lives once in the hero); fix accent if any copy survives.
- [1/small] plan-rail-and-section-strings @ webapp/src/components/plan/plan-decision-rail.tsx:82-93
  NOW: Plan desktop decision rail budget cell: `budget.overLimitCount > 0 ? \`${n} en alerta\` : budget.nearLimitCount > 0 ? \`${n} cerca del límite\` : "Bajo control"`. Sibling plan-budget-section.tsx:69-75 says `\`${n} catego
  TO:  Group-summary grammar: "N sobre límite" / "N en orden" per copy rule 6; verdict words only from the closed set.
- [1/trivial] plan-zone-chips-overlimit @ webapp/src/components/mobile/v2/plan/plan-zone-chips.tsx:133-146, 174-180
  NOW: Plan mobile expanded Presupuesto panel: DetailRow `label="Sobre el límite" value={\`${overLimitCount} categoría(s)\`} valueClass="text-z-debt"`; "Sin categorizar" uses `valueClass="text-amber-400"` (hardcoded Tailwind pa
  TO:  "Sobre el límite" → group-summary "N sobre límite"; amber-400 → --z-alert token.
- [1/small] plan-drill-cards-brass-verdict @ webapp/src/components/mobile/v2/plan/plan-drill-cards.tsx:43-59
  NOW: Plan drill cards captions: `overLimit > 0 ? <span className="font-semibold text-z-brass">{overLimit} sobre límite</span> : "dentro del límite"`; Periodo caption `percentAssigned >= 100 ? "al día" : <span className="font-
  TO:  Status words re-bind to semantic tokens (debt/alert), brass reserved for actions; captions adopt "N sobre límite" compact verdict form.
- [3/small] burn-rate-trend-labels @ webapp/src/components/dashboard/burn-rate-card.tsx:36-46
  NOW: Desktop Ritmo de gasto card (live via flujo-section dynamic import): `trendLabel = { accelerating: "↑ Acelerando", stable: "→ Estable", decelerating: "↓ Desacelerando" }` with `trendColor = { accelerating: "text-red-400"
  TO:  Trend stays as chart evidence (T2 explains, never judges); colors re-bind to z-tokens; any judgment moves to the screen's single Verdict.
- [1/small] tendencias-verdict-header-brass @ webapp/src/components/tendencias/verdict-header.tsx:6-15
  NOW: Tendencias already has a `VerdictHeader` (mounted tendencias-shell.tsx:33): brass callout `flex items-center gap-3 rounded-2xl border border-z-brass/25 bg-z-brass/8 p-3` + `<TrendingUp className="size-4 shrink-0 text-z-b
  TO:  Re-bind to <Verdict /> chip + detail line with semantic tokens; brass removed from the verdict surface.
- [1/small] scenario-verdict-pills @ webapp/src/components/budget/scenario/scenario-verdict.tsx:127-139
  NOW: Simulador verdict pill: `fits ? "border-z-income/35 bg-z-income/8 text-z-income" : "border-z-debt/35 bg-z-debt/8 text-z-debt"` with copy `\`sobran ${X}\`` / `\`faltan ${X}\`` + "/mes" at `text-[10px] font-bold`. Sibling 
  TO:  Adopt <Verdict /> with delta prop (`state · delta` grammar) instead of bespoke pills.
- [1/small] debt-trend-statechip @ webapp/src/components/mobile/v2/deudas/debt-trend-card.tsx:13-17, 118
  NOW: Deudas mobile trend card STATUS_META: `{ mejorando: { label: "Mejorando", variant: "sage" }, estable: { label: "Estable", variant: "brass" }, mes_pesado: { label: "Mes pesado", variant: "danger" } }` rendered as uppercas
  TO:  Compact Verdict form or plain meta text; "Mes pesado"/"Mejorando" leave the verdict register (chart explains, hero judges).
- [1/small] budget-hero-dead-code @ webapp/src/components/mobile/v2/plan/plan-budget-hero.tsx:23-27, 100-114, 128-158
  NOW: PlanBudgetHero (labels `{ stable: "Holgado", watch: "Atención", critical: "Crítico" }` + StateChip + per-category `>= 100 ? "text-z-debt" : >= 80 ? "text-z-alert" : "text-z-income"` rows + footer "X pts sobre/bajo ritmo"
  TO:  Delete during Fase 1 cleanup — these carry 8+ off-vocabulary verdict strings that would otherwise be migrated for nothing.
- [1/trivial] verdict-chip-recipe-exists @ webapp/src/app/globals.css:243-247
  NOW: The exact Verdict chip color recipe already exists as utilities: `.surface-income { color: var(--z-income); border-color: color-mix(in srgb, var(--z-income) 20%, transparent); background: color-mix(in srgb, var(--z-incom
  TO:  <Verdict /> binds its 4 states to .surface-income (vas-bien), .surface-alert (cerca + atencion), .surface-debt (te-pasaste) — zero new styles needed.
- [1/trivial] marketing-vas-bien @ webapp/src/components/marketing/landing-demo.tsx:76-91
  NOW: Landing demo verdict strings (marketing, outside app shell): `{ text: "Vas bien.", color: "#5CB88A", glow: "rgba(61,158,110,0.6)", state: "good" }` and metaText `\`+ $ ${x}k sobre el promedio · quedan ${left} días\`` — h
  TO:  Out of T1 migration scope (marketing surface); note only so vocabulary stays aligned if touched.
- [1/small] health-copy-generators @ webapp/src/actions/health-meters.ts:77-100
  NOW: Health meter sentence generators: `\`Tu ${worstLabel} está en zona crítica y necesita atención inmediata.\``, `\`Múltiples áreas en rojo — ... requieren atención urgente.\``, `\`En general vas bien — solo tu ${worstLabel
  TO:  Copy survives as detail-line material but drops standalone verdict claims ("vas bien") — the word belongs to the chip.
- [3/trivial] hybrid-hero-progress-gradient @ webapp/src/components/dashboard/hybrid-hero.tsx:207-220
  NOW: Inicio hero period progress bar paints a 4-stop severity gradient regardless of state: `background: "linear-gradient(to right, var(--color-z-excellent) 0%, var(--color-z-sage) 30%, var(--color-z-alert) 70%, var(--color-z
  TO:  Bar becomes single-hue evidence (T2/T6: healthy = white/25 or brass-for-gauge only, debt only at >=100); severity expressed once by the Verdict chip.
== headers-month ==
SUMMARY: The webapp already keeps month state in the URL (?month=YYYY-MM, absent = current month) and all month navigation uses router.replace, but there is no shared clock: each surface re-parses searchParams independently, and every cross-surface navigation (mobile tab bar, desktop sidebar, /recurrentes and /presupuesto redirects, mobile Plan drill cards) uses static hrefs that drop the month — only desktop PlanTabNav preserves it. There are three stepper implementations (shared MonthSelector with a label-click-jumps-to-today center button and a year-less "Jul" compact form; use-recurring-month's goPrev/goNext consumed by the Recurrentes calendar with no future clamp; an orphaned RecurringHeroCompact/MobileRecurringManager pair) plus a fourth time model on Tendencias (?range= chips WTD-YTD). Headers are four dialects: desktop marketing-style hero titles with eyebrows and month-in-subtitle prose ("Tu estado financiero de hoy", "Tu capa estratégica", PageHero pills including an uppercased month pill), mobile MobileHeader with subtitles and a centered below-header MonthSelector, wordmark-as-header on mobile Inicio (title="Zeta", no month control at all), and duplicated main+sub headers on Plan's presupuesto/recurrentes tabs. Month labels come from formatMonthLabel (lowercase "julio 2026", capitalized only via CSS), short months leak into prose (Tendencias anomalies/forecast, "MMM yyyy" in account cards), and rows use "dd MMM yyyy" instead of the "15 de abril" rung. No past-month read-only concept ("Mes cerrado") exists anywhere — only ad-hoc data guards on Deudas and plan-timeline.
- [Fase 2 · Marco (T5)/small] header-dashboard-desktop @ webapp/src/app/(dashboard)/dashboard/page.tsx:185-199
  NOW: Desktop Inicio header: eyebrow <p class="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">Inicio</p>, <h1 class="text-3xl font-semibold tracking-tight">Tu estado financiero de hoy</h1>, subtitle <p cla
  TO:  Canonical header: H1 28px/700 "Inicio" (matches tab name exactly), no eyebrow-as-title-prefix, no subtitle, <MonthControl /> top-right with "Julio 2026" label.
- [Fase 2 · Marco (T5)/trivial] header-dashboard-starter @ webapp/src/app/(dashboard)/dashboard/page.tsx:141-156
  NOW: Starter-mode branch renders <h1 class="text-2xl font-bold">Inicio</h1> + subtitle <p class="text-muted-foreground">Tu base ya está lista. Falta activar tu flujo.</p> — a second header dialect on the same route, no month 
  TO:  Same canonical header row (title left, MonthControl right); subtitle removed per no-subtitles rule.
- [Fase 2 · Marco (T5)/small] header-dashboard-mobile-wordmark @ webapp/src/components/dashboard/zones/mobile-zone.tsx:147
  NOW: Mobile Inicio header is <MobileHeader variant="main" title="Zeta" /> — wordmark-as-header. NO month control exists anywhere in the mobile dashboard branch (month param is consumed by data fetches but the user cannot step
  TO:  Title "Inicio" (tab name), wordmark leaves headers (splash/auth only); <MonthControl /> in the header row so mobile Inicio joins the shared clock.
- [Fase 2 · Marco (T5)/medium] mobileheader-component-grammar @ webapp/src/components/mobile/v2/mobile-header.tsx:43-103
  NOW: MobileHeader main variant: title <p class="truncate text-[15px] font-bold leading-tight text-foreground"> + optional subtitle <p class="truncate text-[11px] text-muted-foreground">; action slot right + MobileAvatarMenu. 
  TO:  H1 22px/600 sentence case, no subtitles; month control occupies the right slot (chevron · "Abril 2026" · chevron in compact-card container).
- [Fase 2 · Marco (T5)/medium] header-movimientos-desktop @ webapp/src/app/(dashboard)/transactions/page.tsx:133-153
  NOW: Desktop uses <PageHero> with pills row: <HeroPill>Movimientos</HeroPill>, conditional <HeroAccentPill>{activeFilterCount} filtros activos</HeroAccentPill>, <HeroPill>{monthLabel}</HeroPill> (HeroPill css uppercases it → 
  TO:  Month pill above title deleted; title left "Movimientos", MonthControl right, no description subtitle. Month name only in the control ("Julio 2026").
- [Fase 2 · Marco (T5)/small] header-movimientos-mobile @ webapp/src/components/mobile/v2/movimientos/movimientos-root.tsx:163-173
  NOW: <MobileHeader variant="main" title="Movimientos" /> then a SEPARATE centered row below: <div className="flex justify-center"><Suspense fallback="..."><MonthSelector /></Suspense></div> — the below-hero selector pattern t
  TO:  Selector moves into the header row (title left, MonthControl right); centered below-header selector deleted.
- [Fase 2 · Marco (T5)/small] header-plan-desktop @ webapp/src/app/(dashboard)/plan/page.tsx:155-175
  NOW: Desktop Plan header: <SectionEyebrow>Plan</SectionEyebrow>, <h1 class="text-3xl font-semibold tracking-tight">Tu capa estratégica</h1>, subtitle <p class="text-muted-foreground">{monthLabel} · reúne presupuesto, deuda, o
  TO:  Title "Plan" (tab name), no subtitle, MonthControl right. Month name leaves the subtitle prose.
- [Fase 2 · Marco (T5)/small] header-plan-mobile-resumen @ webapp/src/components/mobile/v2/plan/plan-root.tsx:44-55
  NOW: <MobileHeader variant="main" title="Plan" subtitle={`${monthLabel} · ${daysInMonth - dayOfMonth}d restantes`} /> plus a centered <MonthSelector /> below the header (flex justify-center, Suspense fallback shows lowercase 
  TO:  Title "Plan", subtitle deleted, MonthControl in header right slot; below-hero selector removed.
- [Fase 2 · Marco (T5)/small] header-plan-mobile-subtabs-abr-pill @ webapp/src/app/(dashboard)/plan/page.tsx:134-150
  NOW: Non-resumen tabs on mobile render <MobileHeader variant="main" title={MOBILE_TAB_TITLES[activeTab]} /> (Presupuesto/Periodo/Recurrentes/Deseos) + centered <MonthSelector compact /> whose label is formatMonthLabelShort → 
  TO:  MonthControl with full "Julio 2026" label in the header row; short year-less month label banned outside chart axes.
- [Fase 2 · Marco (T5)/small] header-presupuesto-duplicate-mobile @ webapp/src/components/plan/tabs/plan-tab-presupuesto.tsx:177-183
  NOW: PlanTabPresupuesto's mobile branch renders its OWN <MobileHeader variant="sub" title="Presupuesto" backHref="/plan" action={<BudgetAjustesSheet variant="icon" …/>} /> — while plan/page.tsx:136 already rendered <MobileHea
  TO:  One canonical header per screen; duplicate removed when converging on MonthControl header grammar.
- [Fase 2 · Marco (T5)/small] header-presupuesto-desktop @ webapp/src/components/plan/tabs/plan-tab-presupuesto.tsx:269-289
  NOW: Desktop Presupuesto header inside Plan: <h2 class="text-2xl font-semibold">Presupuesto</h2> + subtitle <p class="text-sm text-muted-foreground">{monthLabel} · {daysRemaining} días restantes</p> (lowercase "julio 2026"); 
  TO:  Title-left/control-right grammar; month name only in the MonthControl, not in subtitle prose.
- [Fase 2 · Marco (T5)/small] header-recurrentes-duplicate-mobile @ webapp/src/components/plan/tabs/plan-tab-recurrentes.tsx:50-66
  NOW: Mobile branch renders <MobileHeader variant="sub" title="Recurrentes" backHref="/plan" /> (line 51) while plan/page.tsx:136 already rendered <MobileHeader variant="main" title="Recurrentes"> — second duplicated header. D
  TO:  Single canonical "Recurrentes" header with MonthControl; subtitle count moves to a GroupSummary (T6), not the header.
- [Fase 2 · Marco (T5)/small] header-deudas-mobile @ webapp/src/app/(dashboard)/deudas/page.tsx:289-299
  NOW: Mobile: <MobileHeader variant="main" title="Deudas" subtitle={`Lectura en ${currency}`} /> + centered <MonthSelector /> below (flex justify-center, Suspense skeleton h-9 w-40).
  TO:  Title "Deudas", no subtitle, MonthControl in header right slot.
- [Fase 2 · Marco (T5)/small] header-deudas-desktop @ webapp/src/app/(dashboard)/deudas/page.tsx:314-334
  NOW: Desktop: <PageHeaderRow title="Deudas" subtitle={`Lectura en ${currency}`} actions={…"Planificador de pagos" brass Button, "Volver a Plan" ghost, <MonthSelector />} />. PageHeaderRow (webapp/src/components/ui/page-header
  TO:  PageHeaderRow is the closest existing shape (title left / actions right, 22px) — converges to H1 22/600 (28/700 desktop), subtitle dropped, MonthControl replaces MonthSelector.
- [Fase 2 · Marco (T5)/medium] header-tendencias @ webapp/src/components/tendencias/tendencias-shell.tsx:25-35
  NOW: Single shell for mobile+desktop: <SectionEyebrow>Análisis</SectionEyebrow> + <h1 class="text-2xl font-semibold tracking-tight lg:text-3xl">Tendencias</h1>, <ExportButton> top-right. No MobileHeader at all on /tendencias 
  TO:  Canonical header with the RANGE variant of MonthControl top-right: "Nov 2025 – Abr 2026" fixed-width (min 120px), chevrons slide the 6-month window; eyebrow-title stack replaced by plain title.
- [Fase 2 · Marco (T5)/medium] month-state-url-param-per-page @ webapp/src/app/(dashboard)/dashboard/page.tsx:100-103
  NOW: Month IS already URL state (?month=YYYY-MM) but parsed independently per page: dashboard/page.tsx:100-103 (parseMonth + formatMonthLabel), transactions/page.tsx:63-65, plan/page.tsx:40+46, deudas/page.tsx:280. Current mo
  TO:  ONE app-level month key in the URL shared by all five surfaces — same key name, same parse helper, one <MonthControl /> writing it.
- [Fase 2 · Marco (T5)/medium] month-stepper-monthselector @ webapp/src/components/month-selector.tsx:16-76
  NOW: Primary stepper. Three shadcn Buttons in `flex items-center gap-1`: ChevronLeft h-4 w-4 (variant outline size icon-sm, aria-label "Mes anterior"), center Button (variant secondary when current, min-w-[120px] sm:min-w-[16
  TO:  <MonthControl />: chevron · "Abril 2026" · chevron inside ONE compact-card container (#111, border white/6, radius 10), chevrons 14px stroke 1.5 hit 32×44, fixed-width tabular label min 88px, next dis
- [Fase 2 · Marco (T5)/medium] month-cursor-recurring-duplicate @ webapp/src/components/recurring/use-recurring-month.ts:122-157
  NOW: SECOND month-cursor implementation: reads searchParams.get("month") via parseMonth, exposes goNextMonth/goPrevMonth/navigateToMonth (router.replace, deletes param at current month — lines 134-148), builds its own monthLa
  TO:  Deleted in favor of the single MonthControl + shared month store; occurrence loading keys off the shared month value.
- [Fase 2 · Marco (T5)/small] month-stepper-recurring-mini-calendar @ webapp/src/components/recurring/recurring-mini-calendar.tsx:58-80
  NOW: Desktop Recurrentes calendar has its own month nav header: ghost Button size icon-xs ChevronLeft/ChevronRight (aria-labels "Mes anterior"/"Mes siguiente") around <span class="text-sm font-medium capitalize">{monthLabel}<
  TO:  Calendar keeps its grid but month stepping defers to the page-level MonthControl (one clock); if an inline nav stays it must disable next at current month per spec.
- [Fase 2 · Marco (T5)/trivial] month-stepper-orphaned-recurring-hero @ webapp/src/components/recurring/recurring-hero-compact.tsx:34-54
  NOW: ORPHANED (no importers found): RecurringHeroCompact renders a third stepper — size-7 rounded-full bordered chevron buttons + <span class="text-xs font-medium capitalize text-muted-foreground">{monthLabel}</span>, disable
  TO:  Delete both files during the T5 sweep (dead month-stepper dialect).
- [Fase 2 · Marco (T5)/large] range-state-tendencias @ webapp/src/components/tendencias/period-control.tsx:5-41
  NOW: Tendencias time state is a SEPARATE URL key ?range= with values WTD|MTD|3M|6M|12M|YTD (labels "Semana", "Mes", "3M", "6M", "12M", "Año"), rendered as chip buttons (ACTIVE_CHIP brass tint) below the verdict; setRange uses
  TO:  Range variant of MonthControl: chevron · "Nov 2025 – Abr 2026" · chevron sliding a 6-month window, top-right in the header, sharing the app month key as anchor.
- [Fase 2 · Marco (T5)/medium] month-reset-on-tab-switch @ webapp/src/components/mobile/v2/mobile-tab-bar.tsx:18-39
  NOW: Tab bar links use bare static hrefs (tab.href from lib/constants/mobile-nav.ts:21-47 — "/dashboard", "/transactions", "/plan", "/deudas", "/gestionar") so switching tabs DROPS ?month=. Desktop sidebar identical: nav-item
  TO:  Nav links carry (or the app store rehydrates) the shared month key so the clock survives surface switches.
- [Fase 2 · Marco (T5)/trivial] month-preserved-plan-tabs-only @ webapp/src/components/plan/plan-tab-nav.tsx:17-24
  NOW: Only place month survives navigation: PlanTabNav.buildHref sets params.set("month", month) when switching Plan tabs (desktop). Mobile equivalent PlanDrillCards (webapp/src/components/mobile/v2/plan/plan-drill-cards.tsx:8
  TO:  Uniform: all intra/inter-surface nav preserves the single month key.
- [Fase 2 · Marco (T5)/small] format-helpers-date-ts @ webapp/src/lib/utils/date.ts:95-131
  NOW: parseMonth (YYYY-MM regex, falls back to current month), formatMonthParam ("yyyy-MM"), formatMonthLabel → format(date, "MMMM yyyy", {locale: es}) returns LOWERCASE "julio 2026" (capitalization only via CSS `capitalize` i
  TO:  Label helper produces "Abril 2026" (capitalized, tabular-nums); short form restricted to chart axes ("abr" lowercase, no period); row format "15 de abril" with "de 2025" only when year differs.
- [Fase 2 · Marco (T5)/small] short-month-outside-axes @ webapp/src/components/tendencias/anomalies-card.tsx:24
  NOW: monthShort (tendencias/format.ts:1-7, MESES array "ene"…"dic") used in PROSE: anomalies-card.tsx:24 `{formatCurrency(a.amount, currency)} en {monthShort(a.month)} — {a.multiple.toFixed(1)}× tu promedio.` and forecast-car
  TO:  3-letter months only on chart axes; prose/details use "15 de abril" / "Abril 2026" ladder rungs.
- [Fase 2 · Marco (T5)/medium] month-label-in-prose-subtitles @ webapp/src/app/(dashboard)/transactions/page.tsx:105-108
  NOW: monthLabel woven into sentence copy across surfaces: transactions description `${monthLabel} en una sola vista: …` + scopeLabel = monthLabel.toLowerCase() (line 105); dashboard subtitle page.tsx:193; plan subtitle plan/p
  TO:  "Abril 2026" appears ONLY in the header control; subtitles deleted; row/group dates follow the ladder ("15 de abril", relative only in Actividad reciente).
- [Fase 2 · Marco (T5)/large] past-month-no-readonly @ webapp/src/app/(dashboard)/deudas/page.tsx:49-50
  NOW: NO "Mes cerrado" / read-only concept exists anywhere (grep for "Mes cerrado"/"solo lectura" returns nothing). Past-month handling is data-only: deudas/page.tsx:49-50+69 computes isCurrentMonth = !month || month >= toColo
  TO:  Past months read-only: lock icon 11px + "Mes cerrado · solo lectura" (11px sage-dark) under header, capture actions hidden, verdicts in past tense ("Cerraste bajo plan").
- [Fase 2 · Marco (T5)/trivial] router-replace-discipline-ok @ webapp/src/components/month-selector.tsx:37-40
  NOW: All three month/range navigations already use router.replace, never push: month-selector.tsx:40 (with explanatory comment), use-recurring-month.ts:142-145 (same comment), period-control.tsx:26. Back-button discipline for
  TO:  Keep replace semantics when consolidating into MonthControl — no change needed, just don't regress.
- [Fase 2 · Marco (T5)/small] recurrentes-no-future-clamp @ webapp/src/components/recurring/recurring-timeline-view.tsx:32-36
  NOW: Recurrentes surfaces allow stepping into FUTURE months (mini-calendar next chevron never disabled; orphaned manager passes canGoNext={true}), while MonthSelector disables next at current month — two conflicting clamp pol
  TO:  Spec says next chevron disabled at current month everywhere; if Recurrentes needs future preview it becomes an explicit product exception, not a component fork.
- [Fase 2 · Marco (T5)/trivial] route-aliases-redirect @ webapp/src/app/(dashboard)/recurrentes/page.tsx:3-5
  NOW: /recurrentes redirects to /plan?tab=recurrentes and /presupuesto redirects to /plan?tab=presupuesto (presupuesto/page.tsx:3-5) — both drop any ?month= on the incoming URL. The Recurrentes and Presupuesto "surfaces" physi
  TO:  Redirects forward the shared month key (or the surfaces adopt the canonical header where they actually render, inside Plan tabs).
== disclosure-motion ==
SUMMARY: Zeta's webapp already speaks a proto-disclosure dialect but with three competing idioms and off-spec values. The dominant pattern (16 inline copies + shared <Expand>/<ExpandableCard>/<HeaderChevron>) is grid-template-rows 0fr->1fr at "duration-200 ease-out" with content at "transition-opacity duration-150" + "delay-75" — the spec wants 160ms container (--motion-2), 120ms opacity+translateY(-3px) content (--motion-1), and one cubic-bezier(0.2,0,0,1) curve; no --motion-* tokens exist yet (they belong in the :root block of globals.css next to the --z-layer-* scale, lines 152-159). A second idiom is instant conditional mounting ({expanded && ...}) used by ~15 expanders including Radix Collapsible call-sites (CollapsibleContent has no animation), and a third is icon-swap/unicode-arrow toggles. The page-dim-on-hero-expand the handoff deletes is exactly plan-net-hero.tsx:36-48 ("fixed inset-0 z-40 bg-black/40" + relative z-50 card) powered by hooks/use-chart-focus-mode.ts (its only consumer) — no other hero dims. Copy drift is wide: bare "Ver"/"Ver ↓"/"Ver →", banned "Expandir"/"Mostrar"/"Colapsar", "Ver menos" instead of "Ocultar + qué", and several brass-colored disclosure labels (INLINE_EXPAND_TOGGLE_CLASS, plan-flow-timeline, Ver mapa, movimientos-lectura). All overlay backdrops are bg-black/50 with no blur vs the rgba(0,0,0,0.6)+blur(4px) spec, and sheets run at 300-500ms (shadcn Sheet duration-500/300, vaul defaults ~500ms) vs the 200ms --motion-3 budget; five press/hover-scale effects and a 600ms chart transition violate the motion guardrails. No framer-motion exists anywhere — the migration is pure CSS/class work.
- [2/trivial] motion-tokens-home @ webapp/src/app/globals.css:70-198
  NOW: No --motion-* tokens exist. The :root token block (lines 70-198) already hosts --z-space-*, --z-mobile-*, and the z-index scale --z-layer-raised/sticky/nav/modal/popover/toast/tooltip/dev (lines 152-159). @theme inline b
  TO:  Add --motion-ease: cubic-bezier(0.2,0,0,1); --motion-1: 120ms; --motion-2: 160ms; --motion-3: 200ms in this :root block, next to the --z-layer-* scale.
- [2/trivial] page-enter-keyframe @ webapp/src/app/globals.css:256-262
  NOW: @keyframes page-enter { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } } .animate-page-enter { animation: page-enter 0.1s ease-out; } — 100ms, +3px direction, ease-out.
  TO:  Align to content-enter spec: 120ms (--motion-1), opacity + translateY(-3px)->0, --motion-ease single curve.
- [2/medium] shared-expand-component @ webapp/src/components/mobile/v2/expand.tsx:7-27
  NOW: Shared <Expand> — the only grid-rows utility: "grid transition-[grid-template-rows] duration-200 ease-out" + open ? "grid-rows-[1fr]" : "grid-rows-[0fr]", inner "min-h-0 overflow-hidden". Content stays mounted during clo
  TO:  Becomes the container of <Disclosure />: grid-rows 0fr->1fr @160ms (--motion-2, --motion-ease); grow API with label "Ver + qué"/"Ocultar …" + 12px caret + 120ms content-enter.
- [2/trivial] shared-header-chevron @ webapp/src/components/mobile/v2/header-chevron.tsx:5-15
  NOW: <HeaderChevron>: ChevronDown "size-4 shrink-0 text-muted-foreground transition-transform duration-200" + rotate-180 when open. size-4 = 16px, default lucide stroke 2.
  TO:  Disclosure caret: chevron-down 12px stroke 1.5, right of label, rotates 180 deg at --motion-2 with --motion-ease (the ONLY rotating element).
- [2/small] shared-expandable-card @ webapp/src/components/mobile/cards/expandable-card.tsx:39-53
  NOW: Second shared expander <ExpandableCard>: inline style gridTemplateRows expanded?"1fr":"0fr" with "grid transition-[grid-template-rows] duration-200 ease-out"; content "transition-opacity duration-150" + "opacity-100 dela
  TO:  Fold into <Disclosure /> (160ms container, 120ms opacity+translateY(-3px) content, mandatory label+caret).
- [2/trivial] accordion-hook @ webapp/src/components/mobile/v2/use-expandable-zone.ts:9-28
  NOW: useExpandableZone — one-zone-at-a-time accordion state hook (activeZone/toggle/close/isActive). Pure state, no motion.
  TO:  Keep; pairs with <Disclosure /> for zone accordions.
- [2/small] hero-page-dim-delete @ webapp/src/components/mobile/v2/plan/plan-net-hero.tsx:32-48, 97-111
  NOW: THE page-dim-on-expand the handoff deletes (only instance in webapp): const { overlayVisible, handleOverlayClick } = useChartFocusMode(expanded); {overlayVisible && <div className="fixed inset-0 z-40 bg-black/40" onClick
  TO:  Remove dim entirely (dim = focus leaves page only); convert to <Disclosure /> "Ver flujo del mes"/"Ocultar flujo del mes", sage-light label, rotating caret, 160ms.
- [2/trivial] hero-dim-hook-delete @ webapp/src/hooks/use-chart-focus-mode.ts:1-28
  NOW: useChartFocusMode: sets document.body.style.overflow="hidden", 50ms setTimeout before overlayVisible=true. Sole consumer is plan-net-hero.tsx.
  TO:  Delete file with the dim removal.
- [2/small] inicio-hero-silent-grower @ webapp/src/components/mobile/v2/inicio/inicio-burndown.tsx:252-277
  NOW: Tappable chart button aria-label="Expandir detalle del gráfico" (banned word "Expandir"), NO visible caret or label; expander: "grid transition-[grid-template-rows] duration-200 ease-out" + gridTemplateRows inline, conte
  TO:  T3 applies: Inicio hero gets Disclosure "Ver flujo por día"/"Ocultar flujo por día" with caret; 160/120ms tokens.
- [2/small] pulse-widget-silent-grower @ webapp/src/components/mobile/v2/inicio/pulse-widget.tsx:174-227
  NOW: Whole card is a <button> aria-label="Expandir desglose del disponible diario" (banned "Expandir"), no caret/label; grid duration-200 ease-out + "transition-opacity duration-150" delay-75. NOTE: inicio-root.tsx:333 says t
  TO:  Delete if confirmed dead; otherwise migrate to Disclosure "Ver desglose".
- [2/small] dashboard-burndown-expandable @ webapp/src/components/dashboard/burndown-expandable.tsx:55-96
  NOW: Header button with ChevronDown size-4 "transition-transform" + rotate-180 but NO text label (silent-ish); container "grid transition-[grid-template-rows] duration-200 ease-out" + inline gridTemplateRows; content "mt-3 sp
  TO:  Disclosure with explicit label ("Ver quema de gasto"/"Ocultar …"), 160/120ms.
- [2/medium] hybrid-hero-toggle @ webapp/src/components/dashboard/hybrid-hero.tsx:217, 243-257, 531
  NOW: Toggle label "Ver detalle"/"Ocultar detalle" (line 247) with ChevronDown "size-3.5 text-z-brass transition-transform" rotate-180 (brass caret — banned); detail mounts INSTANTLY via {expanded && (...)} — no animated conta
  TO:  Disclosure with "Ver + qué" copy, sage-light label, 160ms grid container; kill 500ms width transition (cap 200ms or none); remove press-scale (hover-tint only).
- [2/small] deudas-hero-silent-grower @ webapp/src/components/mobile/v2/deudas/deudas-hero.tsx:44-99
  NOW: Whole card <button> aria-label="Expandir desglose de cuota mensual" (banned "Expandir"), no caret/label; grid duration-200 ease-out + opacity duration-150 delay-75.
  TO:  Disclosure "Ver desglose"/"Ocultar desglose" (T3 Deudas rows: "Ver desglose", split bar inside).
- [2/small] deudas-salary-bar-silent-grower @ webapp/src/components/mobile/v2/deudas/deudas-salary-bar.tsx:21-64
  NOW: Whole panel <button onClick={() => toggle("salary")}> with only "Tu salario" + "% libre" text — no caret, no Ver-label, no aria-label; grid duration-200 + opacity 150 delay-75; bar segments use "h-full transition-all".
  TO:  Disclosure with caret + "Ver distribución"/"Ocultar distribución".
- [2/medium] deudas-cuentas-lens-expanders @ webapp/src/components/mobile/v2/deudas/deudas-cuentas-lens.tsx:141-184, 245-310, 355-457, 555-671
  NOW: Four <Expand>+<HeaderChevron> expanders (lines 156, 270, 381, 583): ClosedObligations, personal debts summary, Deuda total tiles, per-account rows. Carets present, but headers carry no "Ver + qué" label; inner rows use "
  TO:  Migrate to <Disclosure /> keeping card-header pattern; add labels per T3 Deudas application ("Ver desglose"); tokens 160/120ms.
- [2/small] debt-trend-card-expander @ webapp/src/components/mobile/v2/deudas/debt-trend-card.tsx:108-132, 229-364
  NOW: Clickable header div (cursor-pointer) + nested chevron <button> aria-label "Ver detalle de tendencia"/"Ocultar detalle de tendencia" with <HeaderChevron>; two nested <Expand> (lines 229, 313); bars use "transition-opacit
  TO:  Disclosure; aria copy already compliant — surface it as the visible label.
- [2/small] deudas-plan-lens-expanders @ webapp/src/components/mobile/v2/deudas/deudas-plan-lens.tsx:215-307
  NOW: Two <Expand> blocks (lines 225, 307) triggered by header buttons with {hasDetail && <HeaderChevron open={open} />} — caret only, no text label.
  TO:  Disclosure with "Ver + qué" labels.
- [2/small] inicio-activity-row-expand @ webapp/src/components/mobile/v2/inicio/inicio-activity.tsx:228-246
  NOW: Activity rows expand TransactionQuickActions: "grid transition-[grid-template-rows] duration-200 ease-out" + gridTemplateRows inline; content "px-1 py-1.5 transition-opacity duration-150" (no delay). Row button has no ca
  TO:  Disclosure container tokens (160/120ms); row-tap OK but needs affordance decision per silent-grower rule.
- [2/small] movimientos-row-expand-instant @ webapp/src/components/mobile/v2/movimientos/movimientos-transaction-row.tsx:66-75, 145-156
  NOW: Row button aria-label "Ver acciones de X"/"Ocultar acciones de X" (copy compliant) but NO caret; expanded quick-actions mount INSTANTLY: {expanded && (<div className="mt-3"><TransactionQuickActions .../></div>)} — no ani
  TO:  Wrap in Disclosure container (grid 0fr->1fr @160ms + content @120ms); add caret affordance.
- [2/trivial] movimientos-lectura-toggle-copy @ webapp/src/components/mobile/v2/movimientos/movimientos-lectura.tsx:289-301
  NOW: Toggle text: {expanded ? "▴ Colapsar" : "▾ Ver flujo por día"} in "text-[10px] font-medium text-z-brass" — unicode arrows instead of caret icon, "Colapsar" instead of "Ocultar + qué", brass (banned); grid duration-200 + 
  TO:  "Ver flujo por día"/"Ocultar flujo por día", 12px/600 sage-light, rotating ChevronDown 12px; 160/120ms.
- [2/small] movimientos-herramientas-zones @ webapp/src/components/mobile/v2/movimientos/movimientos-herramientas.tsx:168-185
  NOW: Zone stat-chips (aria-expanded on each chip, no caret) drive a shared panel: "grid transition-[grid-template-rows] duration-200 ease-out" + gridTemplateRows activeZone?1fr:0fr; content "mt-1.5 transition-opacity duration
  TO:  Disclosure tokens; chip-as-trigger keeps aria but needs caret/affordance ruling.
- [2/small] plan-budget-hero-expander @ webapp/src/components/mobile/v2/plan/plan-budget-hero.tsx:105-126
  NOW: Footer has StateChip + ChevronDown "size-3.5 text-muted-foreground transition-transform" rotate-180 — caret yes, text label no; grid duration-200 + "mt-3 space-y-2 transition-opacity duration-150" delay-75.
  TO:  Disclosure with label ("Ver categorías"/"Ocultar categorías"), tokens.
- [2/small] plan-zone-chips-expander @ webapp/src/components/mobile/v2/plan/plan-zone-chips.tsx:111-125
  NOW: "grid transition-[grid-template-rows] duration-200 ease-out" + gridTemplateRows hasActive?1fr:0fr; content "mt-1.5 transition-opacity duration-150" + delay-75; chip triggers with aria-expanded, no caret.
  TO:  Disclosure tokens (160/120ms).
- [2/small] widget-grid-expander @ webapp/src/components/mobile/v2/inicio/widget-grid.tsx:116-135
  NOW: Widget chips expand a detail panel: "grid transition-[grid-template-rows] duration-200 ease-out" + gridTemplateRows active?1fr:0fr; content "transition-opacity duration-150" (pt-1 when active); sibling chips get dimmed o
  TO:  Disclosure tokens; chips keep active/dimmed states (not a page dim — in-flow opacity).
- [2/small] linked-metric-detail-panel @ webapp/src/components/mobile/v2/linked-metric-detail-panel.tsx:97-118
  NOW: "grid transition-[grid-template-rows] duration-200 ease-out" + gridTemplateRows activeChip?1fr:0fr; content "mt-2 transition-opacity duration-150" + "opacity-100 delay-75".
  TO:  Disclosure tokens.
- [2/small] mobile-hero-card-collapse-panel @ webapp/src/components/mobile/cards/mobile-hero-card.tsx:273-285
  NOW: CollapsePanel: "grid transition-[grid-template-rows] duration-200 ease-out" + gridTemplateRows visible?1fr:0fr; content "mt-2 transition-opacity duration-150". Section chips at line ~260 use aria-expanded.
  TO:  Disclosure tokens (legacy mobile/cards surface — audit if still mounted).
- [2/small] mobile-alert-card-expander @ webapp/src/components/mobile/cards/mobile-alert-card.tsx:99-115, 136
  NOW: Grid duration-200 + "rounded-xl border p-3 transition-opacity duration-150"; dismiss/collapse action labeled bare "Ocultar" (line 136).
  TO:  Disclosure tokens; label "Ocultar + qué" (e.g. "Ocultar alerta").
- [2/small] mobile-upcoming-payments-expander @ webapp/src/components/mobile/cards/mobile-upcoming-payments.tsx:96-106
  NOW: Per-item: "grid transition-[grid-template-rows] duration-200 ease-out" + gridTemplateRows isExpanded?1fr:0fr; content "mb-1 rounded-lg border border-white/8 bg-black/20 p-2.5 transition-opacity duration-150" + "opacity-1
  TO:  Disclosure tokens + affordance.
- [2/small] radix-collapsible-no-motion @ webapp/src/components/ui/collapsible.tsx:22-31
  NOW: shadcn Collapsible wrapper: CollapsibleContent has NO animation classes — expand/collapse is instant everywhere it is used (5 call-sites).
  TO:  Replace call-sites with <Disclosure /> (or give CollapsibleContent the 160ms grid-rows treatment) so all expanders share one idiom.
- [2/trivial] transaction-form-advanced-collapsible @ webapp/src/components/transactions/transaction-form.tsx:331-354
  NOW: Radix Collapsible "Opciones relacionadas" with ChevronDown className transition-transform + advancedOpen ? "rotate-180" (line 348); content instant (no animation).
  TO:  Disclosure; label already descriptive.
- [2/trivial] mobile-transaction-form-advanced-collapsible @ webapp/src/components/mobile/mobile-transaction-form.tsx:476-499
  NOW: Radix Collapsible "Más opciones" + ChevronDown rotate-180 (line 493); instant content.
  TO:  Disclosure.
- [2/trivial] destinatario-suggestions-collapsible @ webapp/src/components/destinatarios/destinatario-suggestions-tab.tsx:177-197
  NOW: Collapsible trigger "Ver transacciones" with STATIC ChevronRight h-3 w-3 (no rotation, wrong direction); no "Ocultar" state; instant content.
  TO:  Disclosure: "Ver transacciones"/"Ocultar transacciones", rotating chevron-down.
- [2/trivial] recurring-completed-collapsible @ webapp/src/components/recurring/recurring-completed-section.tsx:32-43
  NOW: Collapsible trigger "N pagos completados este mes" + ChevronDown "transition-transform [[data-state=open]>&]:rotate-180"; instant content. Trigger styled z-income.
  TO:  Disclosure ("Ver N pagados" pattern fits T6 group summary too).
- [2/trivial] import-page-native-details @ webapp/src/app/(dashboard)/import/page.tsx:128-132
  NOW: Native <details className="group ..."> + <summary> "Más sobre este flujo" with ChevronDown "transition-transform group-open:rotate-180" — instant expand.
  TO:  Disclosure (or accept native details with 160ms treatment); copy OK-ish but not "Ver + qué".
- [2/trivial] periodo-view-instant-expand @ webapp/src/components/mobile/v2/plan/mobile-periodo-view.tsx:55-71
  NOW: "Ver flujo del mes" + ChevronDown rotate-180, but label NEVER flips to "Ocultar …" when open, and content mounts instantly via {chartOpen && ...}.
  TO:  Disclosure: label toggles "Ver flujo del mes"/"Ocultar flujo del mes", 160ms container.
- [2/trivial] recurrentes-templates-bare-ver @ webapp/src/components/mobile/v2/plan/mobile-recurrentes-templates-strip.tsx:44-69
  NOW: Toggle label {expanded ? "Ocultar" : "Ver"} — BARE, in "text-[11px] font-medium text-z-brass" (banned brass), with ChevronUp/ChevronDown icon SWAP instead of rotation; content instant {expanded && ...}.
  TO:  "Ver plantillas"/"Ocultar plantillas", sage-light, single rotating caret, Disclosure 160ms.
- [2/trivial] recurrentes-completados-bare-ver @ webapp/src/components/mobile/v2/plan/mobile-recurrentes-view.tsx:527-535, 439
  NOW: Completados toggle: <span>{show ? "Ocultar ↑" : "Ver ↓"}</span> — bare Ver with unicode arrows, instant {show && ...}. Also line 439: showAllLabel="Mostrar todas las transacciones →" (banned "Mostrar").
  TO:  "Ver N completados"/"Ocultar completados" + rotating caret + Disclosure; rename showAll label to "Ver todas las transacciones".
- [2/small] plan-accounts-card-silent-grower @ webapp/src/components/mobile/v2/plan/plan-mobile-accounts-card.tsx:29-62
  NOW: Whole card <button> aria-label "Mostrar saldos de cuentas principales" (banned "Mostrar") / "Ocultar saldos …"; NO caret or visible label; content instant {expanded && ...}; card uses "transition-all" + brass border stat
  TO:  Disclosure "Ver cuentas"/"Ocultar cuentas" with caret, 160ms.
- [2/trivial] persona-card-instant @ webapp/src/components/personas/persona-card.tsx:105-115
  NOW: ChevronDown "size-4 shrink-0 text-muted-foreground transition-transform" rotate-180; detail instant {open && ...}.
  TO:  Disclosure 160ms container.
- [2/trivial] pendientes-completados-instant @ webapp/src/components/reminders/pendientes-widget.tsx:45-57
  NOW: "Completados (N)" + ChevronDown h-3 w-3 rotate-180; instant {showCompleted && ...}.
  TO:  Disclosure ("Ver N completados").
- [2/trivial] expense-entry-row-instant @ webapp/src/components/cashflow-planner/expense-entry-row.tsx:192-200
  NOW: ChevronDown rotate-180 caret; detail instant {expanded && (...)}.
  TO:  Disclosure 160ms container.
- [2/trivial] income-envelope-toggle @ webapp/src/components/cashflow-planner/income-envelope-card.tsx:229-237
  NOW: Toggle text {expanded ? "Ocultar asignaciones" : `Ver ${n} asignación(es)`} — copy compliant but NO caret, "text-[10px] text-muted-foreground", instant swap (no animated container in file).
  TO:  Disclosure: keep copy, add 12px caret + 160ms container, 12px/600 sage-light.
- [2/trivial] envelope-board-settled-instant @ webapp/src/components/cashflow-planner/envelope-board.tsx:120-175
  NOW: "N confirmados"/"N pagados" settled toggles with ChevronDown rotate-180 (lines 131-136, 166-171); no grid-rows container in file — lists swap instantly.
  TO:  Disclosure containers; labels already count-based (aligns with T6 "N de M pagados").
- [2/trivial] import-step-review-instant @ webapp/src/components/import/step-review.tsx:640-660, 770-790
  NOW: Two expanders: label {expanded ? "Ocultar detalle" : "Ver y ajustar selección"} + ChevronDown rotate-180 (646-654); currency-group header + ChevronDown rotate-180 (777-782); both instant {expanded && ...}.
  TO:  Disclosure 160ms; copy already compliant.
- [2/small] import-misc-expanders-instant @ webapp/src/components/import/credit-card-stack-card.tsx:137-150
  NOW: "Ver detalles"/"Ocultar detalles" + ChevronDown h-3 w-3 rotate-180, instant {expanded && <dl ...>}. Same instant+caret pattern in import/suggested-destinatarios-panel.tsx:141-150, import/pending-email-statements.tsx:231-
  TO:  All four -> Disclosure 160ms containers with labels.
- [2/trivial] destinatario-list-row-expand @ webapp/src/components/destinatarios/destinatario-list.tsx:504-513
  NOW: Row-name ChevronDown "size-4 shrink-0 text-muted-foreground transition-transform" rotate-180; expansion instant (no grid-rows container in file).
  TO:  Disclosure 160ms container.
- [2/trivial] ver-todas-brass-constant @ webapp/src/lib/constants/styles.ts:158-163
  NOW: INLINE_EXPAND_TOGGLE_CLASS = "flex w-full items-center justify-center gap-1 border-t border-white/6 py-2 text-[11px] font-semibold text-z-brass transition-colors hover:bg-white/[0.02]" — brass disclosure label (banned). 
  TO:  Rebind to 12px/600 sage-light hover:white; copy -> "Ver N categorías"/"Ver N destinatarios" and "Ocultar …" instead of "Ver menos".
- [2/trivial] plan-flow-timeline-ver-mas @ webapp/src/components/plan/plan-flow-timeline.tsx:118-131
  NOW: Toggle {expanded ? "Ver menos" : `Ver ${n} más`} in "text-[11px] font-semibold text-z-brass" + ChevronDown rotate-180; list slice swaps instantly.
  TO:  "Ver N más"/"Ocultar N" (Ocultar + qué), sage-light not brass, Disclosure reveal.
- [2/trivial] bare-ver-links @ webapp/src/components/gestionar/attention-hub.tsx:71
  NOW: <span className="text-sm font-medium text-muted-foreground">Ver →</span> — bare "Ver" on suggestion cards. Related: mobile/v2/inicio/inicio-attention-timeline.tsx:109 "Ver todo" (10px, aria says "Ver todos los pendientes
  TO:  Copy rule 2: "Ver + qué" (e.g. "Ver sugerencias", "Ver pendientes"). Never bare "Ver".
- [2/trivial] ver-mapa-brass @ webapp/src/app/(dashboard)/transactions/[id]/transaction-detail-client.tsx:951-959
  NOW: {mapOpen ? "Ocultar mapa" : "Ver mapa"} — copy compliant but styled "text-[11px] font-semibold text-z-brass hover:underline" (brass banned on disclosure labels); map mounts instantly {mapOpen && ...}.
  TO:  Sage-light label + caret + Disclosure container.
- [2/small] sheet-timing-backdrop @ webapp/src/components/ui/sheet.tsx:31-45, 60-73
  NOW: SheetOverlay: "data-[state=open]:animate-in … fade-in-0 fixed inset-0 z-[var(--z-layer-modal)] bg-black/50" (tw-animate default ~150ms, no blur). SheetContent: "transition ease-in-out data-[state=closed]:duration-300 dat
  TO:  Spec: sheet 200ms (--motion-3), backdrop rgba(0,0,0,0.6) + blur(4px) fading @200ms.
- [2/small] drawer-vaul-timing-backdrop @ webapp/src/components/ui/drawer.tsx:24-48
  NOW: DrawerOverlay: "fixed inset-0 z-[var(--z-layer-modal)] bg-black/50" (no blur, vaul default 500ms cubic-bezier(0.32,0.72,0,1) transition). Content: vaul default slide (500ms). Handle (line 46): "mx-auto mt-3 mb-2 h-1 w-10
  TO:  translateY(105%)->0 @200ms --motion-ease; backdrop rgba(0,0,0,0.6)+blur(4px) @200ms; handle 40x4 radius 2 white/12.
- [2/small] fab-menu-sheet @ webapp/src/components/mobile/fab-menu.tsx:93-106
  NOW: Movimientos FAB sheet (raw vaul): Overlay "fixed inset-0 bg-black/50" + FAB_MENU_Z; content vaul default 500ms; handle "mx-auto mt-3 mb-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30". T3 explicitly names this s
  TO:  200ms sheet + 0.6/blur(4px) backdrop + white/12 handle (same as drawer.tsx).
- [2/small] dialog-backdrops @ webapp/src/components/ui/dialog.tsx:39-48, 64-70
  NOW: DialogOverlay "bg-black/50" + fade animate-in/out (no blur); DialogContent "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 … duration-200" (scale entrance). alert-dialog.tsx:39 identical bg-black/50 overlay
  TO:  Backdrop rgba(0,0,0,0.6)+blur(4px) @200ms (dim=modal is correct here); consider replacing zoom-95 scale with opacity/translate to honor "nothing springs/scales".
- [2/small] press-scale-purge @ webapp/src/components/mobile/v2/mobile-tab-bar.tsx:80
  NOW: FAB: "transition-transform active:scale-95". Other press/hover scales: components/categories/zone-tile.tsx:36 "hover:scale-[1.02] active:scale-[0.98]"; components/categories/color-picker.tsx:27 "transition-transform hove
  TO:  Never press-scale — hover-tint only (T3 dim rule bans press scale explicitly).
- [2/trivial] fab-plus-rotation @ webapp/src/components/mobile/v2/mobile-tab-bar.tsx:83
  NOW: Plus icon: "size-5 stroke-[2.5] transition-transform duration-200" + rotate-45 when FAB menu open — a non-caret rotating element (spec: the disclosure caret is "the ONLY rotating element in the app").
  TO:  Decision: exempt (overlay affordance) or replace with icon swap/opacity.
- [2/small] off-token-durations @ webapp/src/components/accounts/flip-zone.tsx:30, 80
  NOW: "relative w-full transition-transform duration-400" (card flip) + "transition-all duration-300". Other 300ms sites: app/onboarding/page.tsx:238,247 ("transition-all duration-300" progress bars); components/dashboard/prim
  TO:  Clamp everything to 120/160/200 (--motion-1/2/3), one curve; nothing longer.
- [2/medium] content-enter-150ms-pattern @ webapp/src/components/mobile/v2/expand.tsx:19
  NOW: App-wide content-enter idiom is "transition-opacity duration-150" + "opacity-100 delay-75" (~20 call-sites: pulse-widget:225, burndown-expandable:94, mobile-hero-card:281, mobile-upcoming-payments:103, expandable-card:46
  TO:  Content enters @120ms (--motion-1) opacity + translateY(-3px)->0 inside <Disclosure /> — replaces the 150ms+delay-75 choreography everywhere.
- [3/trivial] chart-motion-violation @ webapp/src/components/dashboard/speedometer-gauge.tsx:95
  NOW: Gauge needle dot: transition: "cx 0.6s ease, cy 0.6s ease, fill 0.6s ease" — 600ms animation of non-transform SVG attributes on a chart (charts must stay at zero motion).
  TO:  Remove transition (charts stay at zero; the only 600ms allowed is the T4 celebration ring sweep).
- [2/trivial] skeleton-shimmer-check @ webapp/src/components/ui/skeleton.tsx:4-12
  NOW: Skeleton = "bg-accent animate-pulse rounded-md" — uniform Tailwind pulse, no shimmer/stagger choreography found anywhere (grep shows no custom shimmer keyframes). Loading spinners use animate-spin (Loader2) across ~40 fi
  TO:  Already compliant with "no skeleton shimmer choreography"; keep animate-pulse; document as the sanctioned loading state.
- [2/trivial] no-framer-motion @ webapp/package.json:1
  NOW: Zero framer-motion/motion imports in webapp/src (grep clean) and framer-motion is not a webapp dependency — all motion is CSS transitions + tw-animate-css utilities.
  TO:  Nothing to remove — satisfies "cero librerías nuevas"; Disclosure ships as pure CSS.
== charts ==
SUMMARY: Zeta's webapp has ~21 recharts call-sites plus ~12 hand-rolled SVG charts/gauges, and no shared chartTheme: every chart re-declares its own ChartConfig colors, grid, axes, tooltip, and legend. Good news: all recharts series already set isAnimationActive={false}, and all XAxis/YAxis already use axisLine={false} tickLine={false}. Bad news for the spec: --chart-1..5 in globals.css are bound to income/expense/alert/debt/brass (not the spec's brass/sage-dark/income/expense/debt); there are 11 banned AreaCharts with gradient fills, 1 banned PieChart (dashboard donut), several dashed CartesianGrids and ChartLegend boxes, foreign hues (#3b82f6, #8b5cf6, and the shared debt palette #7c3aed/#6366f1/#0891b2), two legacy hsl(var(--primary)) configs that resolve to invalid colors, and multiple verdict-bearing elements sitting directly on Tier-2 charts (budget-pace over/under coloring, inicio-burndown deviation badge, hero sparkline verdict tones, Ahorro% colored text). The Tier-1 gauge story is fragmented across five different ring geometries (180° speedometer, four 360° circle rings) — none match the 270° viewBox 0 0 128 128 pathLength=100 spec. Five chart components (balance-history, monthly-cashflow, daily-spending, enhanced-cashflow, income-vs-expenses) are orphaned with zero importers and can be deleted instead of migrated. The natural chartTheme home is a new module next to webapp/src/components/ui/chart.tsx (the shadcn wrapper every recharts chart already imports ChartContainer/ChartTooltip from).
- [3/medium] chart-vars-rebind @ webapp/src/app/globals.css:183-187, 220-224
  NOW: --chart-1: var(--z-income); --chart-2: var(--z-expense); --chart-3: var(--z-alert); --chart-4: var(--z-debt); --chart-5: var(--z-brass); (duplicated in :root and .dark)
  TO:  Spec mapping: --chart-1 → --z-brass (actual/tú), --chart-2 → --z-sage-dark (ideal/promedio), --chart-3 → --z-income, --chart-4 → --z-expense, --chart-5 → --z-debt. Rebinding silently recolors every --
- [3/medium] charttheme-home @ webapp/src/components/ui/chart.tsx:1-366
  NOW: shadcn chart wrapper: ChartContainer (injects per-chart --color-{key} vars via ChartStyle), ChartTooltip/ChartTooltipContent (border-border/50 bg-background), ChartLegend/ChartLegendContent (legend boxes with h-2 w-2 rou
  TO:  Single chartTheme object (e.g. new webapp/src/lib/constants/chart-theme.ts or exported from chart.tsx, which every recharts file already imports): grid={vertical:false, stroke:'rgba(255,255,255,0.06)'
- [3/small] tendencias-forecast-card @ webapp/src/components/tendencias/forecast-card.tsx:10, 28-38
  NOW: LineChart; config color 'var(--z-brass-hot)'; <Line stroke='var(--color-balance)' strokeWidth={2.2} strokeDasharray='4 4' dot={{ r: 2.5 }} isAnimationActive={false} />; XAxis tickLine/axisLine false fontSize 10; no grid,
  TO:  chartTheme forecast recipe: dashed '4 3' at 50% opacity, hue --z-brass (not brass-hot), dot={false} everywhere except a single 3px 'hoy' marker; horizontal hairlines white/6 if any.
- [3/trivial] tendencias-income-expense-card @ webapp/src/components/tendencias/income-expense-card.tsx:10-13, 30-48
  NOW: BarChart; income 'var(--z-income)', expense 'var(--z-expense)', radius [3,3,0,0], isAnimationActive false; no grid; custom tooltip 'rounded-lg border bg-background p-2 text-xs shadow-sm'; no legend.
  TO:  Nearly compliant — consume chartTheme: paired bars 12px gap 3, history 0.8 opacity / current full, tooltip from theme (#111 border white/6), horizontal hairlines max 3.
- [3/small] tendencias-savings-rate-area @ webapp/src/components/tendencias/savings-rate-card.tsx:2, 8-11, 29-41
  NOW: BANNED AreaChart: <Area stroke='var(--color-rate)' fill='url(#srGrad)'> with linearGradient stopOpacity 0.4→0.03 on 'var(--z-brass-hot)'; ReferenceLine y={20} stroke='var(--color-target)' (--z-income) strokeDasharray='3 
  TO:  Area → Line (brass); reference line = sage-dark dashed per theme (reference/promedio hue is sage-dark, income green reserved for income-vs-expense frames); remove gradient defs.
- [3/medium] burn-rate-forecast-card @ webapp/src/components/dashboard/burn-rate-card.tsx:27-29, 36-46, 156-216
  NOW: BANNED AreaChart (dashboard 'Ritmo de gasto' burndown): balance Area fill url(#gradientId) stops 'var(--chart-1)' 0.4→0.05; projected Area stroke 'var(--chart-1)' strokeDasharray='4 3' fill='none'; ReferenceLine y=0 stro
  TO:  Area→Line burndown per spec (actual brass 1.75, projection dashed '4 3' 0.5 same hue, hoy dot r=3); chart-1 rebinds to brass; y=0 baseline solid white/12; compact tabular COP ticks; trend verdict move
- [3/small] budget-pace-verdict-on-chart @ webapp/src/components/charts/budget-pace-chart.tsx:98-127, 133-142
  NOW: LineChart (dashboard Presupuesto section): ideal line stroke '#a1a1aa' HARDCODED HEX strokeDasharray '4 4'; actual line stroke={overBudgetPace ? 'var(--z-debt)' : 'var(--z-income)'} (verdict-colored series on Tier-2 char
  TO:  Ideal = sage-dark dashed '2 3' 0.8; actual = brass 1.75 always (never verdict-colored); hoy dot 3px brass; judgment moves to hero <Verdict />. Deletes #a1a1aa and stroke='white'.
- [3/medium] category-donut-pie-banned @ webapp/src/components/charts/category-donut.tsx:3, 17-29, 56-72
  NOW: BANNED PieChart/Pie/Cell donut (dashboard presupuesto-section.tsx:85): innerRadius 65% outerRadius 95% paddingAngle 2; COLORS = ['var(--z-expense)','var(--z-alert)','var(--z-income)','var(--z-sage-dark)','var(--z-sage-da
  TO:  Pie → horizontal bars (Tendencias bar recipe: 26px radius 3 3 0 0 or split-bar rows); keys as inline 8×8 radius-2 swatch chips; drop multi-hue category palette for theme hues.
- [3/small] cash-flow-view-toggle @ webapp/src/components/charts/cash-flow-view-toggle.tsx:105-157, 161-194, 196-278
  NOW: Dashboard Flujo card (mounted via flujo-charts.tsx). Line view: income solid 'var(--z-income)' w2, expenses dashed '6 3' 'var(--z-expense)' w2, ReferenceDots r=4 stroke='white'; YAxis hide. Bar view: CartesianGrid vertic
  TO:  Consume chartTheme: hairlines white/6, expenses dash aligned to spec dashes, no legend box (inline swatch chips), tabular compact COP ($3,76M), no stroke='white' dots; Ahorro verdict moves to hero Ver
- [3/trivial] orphan-chart-components @ webapp/src/components/charts/balance-history-chart.tsx:1-205
  NOW: ZERO importers for 5 chart files: balance-history-chart.tsx, monthly-cashflow-chart.tsx, daily-spending-chart.tsx, enhanced-cashflow-chart.tsx, income-vs-expenses-chart.tsx (verified by import grep — nothing outside comp
  TO:  Delete the 5 orphans instead of migrating them — removes ~1000 lines of off-spec chart code from the bundle surface.
- [3/small] net-worth-history-area @ webapp/src/components/charts/net-worth-history-chart.tsx:24-29, 54-100
  NOW: BANNED AreaChart (mounted by dashboard patrimonio-section.tsx:53): chartConfig color 'hsl(var(--primary))' — legacy shadcn hsl-wrap; --primary is var(--z-brass) (already a full color), so hsl(var(--primary)) parses as an
  TO:  Area → Line stroke var(--chart-1) (brass post-rebind); fix broken hsl() wrap; solid white/6 hairlines (no dashes); tabular compact COP ticks.
- [3/trivial] waterfall-chart-div-bars @ webapp/src/components/charts/waterfall-chart.tsx:69-95
  NOW: Hand-rolled div-bar waterfall (dashboard flujo-waterfall.tsx:35): bars bg-z-income (Ingresos), bg-z-expense (categories), 'border border-z-income bg-z-income/10' (Neto); 10px bold value labels above every bar.
  TO:  Compliant with bars-only rule; align via theme: label only decision numbers (peak + current) instead of all bars, track/rest hues from theme.
- [3/trivial] spending-heatmap-colors @ webapp/src/components/charts/spending-heatmap.tsx:10-16
  NOW: levelColors = ['var(--z-surface-3)', 'color-mix(in srgb, var(--z-expense) 25%, var(--z-surface-3))', …45%, …65%, 'var(--z-expense)'] — expense-orange intensity ramp (dashboard ActividadHeatmap).
  TO:  Token-based ramp is on-brand; keep but source ramp from chartTheme so heatmap and future heatmaps share one scale.
- [3/medium] debt-simulator-areas @ webapp/src/components/debt/debt-simulator.tsx:172-181, 283-345, 362-366, 542-627
  NOW: Two BANNED AreaCharts on /deudas simulator: (1) single-account 'Proyección de saldo' — withoutExtra 'var(--chart-1)' / withExtra 'var(--chart-2)' with fillWithout/fillWith gradients 0.3→0.05; (2) strategies chart — strat
  TO:  Area → Line; max 2 series + 1 reference per chart (3-series strategy chart needs baseline as reference); colors from rebound chart vars (brass=chosen plan, sage-dark=comparison); inline swatch chips, 
- [3/small] debt-planner-compare-areas @ webapp/src/components/debt/planner/compare-step.tsx:326-422
  NOW: BANNED overlay AreaChart (planner Comparar step): baseline Area stroke 'var(--muted-foreground)' strokeDasharray '5 5' fill url(#fillBaseline) 0.1→0.02; up to 3 plan Areas stroke PLAN_COLORS[i] fill gradients 0.3→0.05; C
  TO:  Area → Line overlay; baseline = sage-dark dashed reference; plans capped at theme series hues (brass + sage-dark + one semantic); kill gradients + legend box.
- [3/large] debt-planner-detail-stacked-area @ webapp/src/components/debt/planner/detail-step.tsx:168-177, 519-632
  NOW: BANNED stacked AreaChart per account: cfg color `var(--chart-${(i % 5) + 1})` cycling all 5 chart vars (per-card palette), gradient defs per account 0.3→0.05, stackId='accounts', hand-rolled legend with rounded-full dots
  TO:  Stacked area → grouped/stacked bars or line per spec (lines+bars only); max 2 series + 1 reference — per-account trajectories need a different encoding (e.g. T2 split-bar rows per debt); palette cycli
- [3/medium] salary-timeline-foreign-hues @ webapp/src/components/debt/salary-timeline-chart.tsx:34-49, 197-278, 284-303, 326-339
  NOW: Stacked BarChart (planner detail): fills from getDebtColor() — DEBT_PALETTE ['#dc2626','#ea580c','#d97706','#7c3aed','#6366f1','#0891b2'] + LIBRE_COLOR '#22c55e' hardcoded hex in packages/shared/src/utils/salary-breakdow
  TO:  Palette from chartTheme tokens (debt hues limited to --z-debt ramp/opacity steps, libre = --z-income); lowercase 3-letter axis months; banner → surface-income recipe; shared-package palette change coo
- [3/small] accounts-area-heroes @ webapp/src/components/accounts/balance-graph-hero.tsx:34, 45-56, 64-104
  NOW: BANNED AreaChart on account detail hero: strokeColor = isDebt ? 'var(--z-brass)' : 'var(--z-sage-light)'; gradient 0.3→0; tick {fontSize:9, fill:'var(--z-sage-dark)'}; Tooltip cursor stroke 'rgba(255,255,255,0.1)'; trend
  TO:  Area → Line brass (actual); trend verdict → T1 tokens (income/debt surface recipe) or removed from chart frame; axis fills/ticks from chartTheme.
- [3/trivial] accounts-axis-format @ webapp/src/components/accounts/chart-utils.tsx:17-26
  NOW: formatAxisDate: toLocaleDateString('es-CO', { day:'numeric', month:'short' }) → '3 jun.' (ICU adds trailing period, violates 'abr' no-period rule); formatAxisAmount: '1.2M'/'350k' (no $ prefix, lowercase k, not the $3,76
  TO:  Axis date via date-fns es 3-letter lowercase no period; amounts as tabular compact COP $3,76M/$178K from chartTheme formatter; promote this tooltip style into the shared theme.
- [3/small] sparkline-component @ webapp/src/components/charts/sparkline.tsx:6-11, 28-38
  NOW: Recharts AreaChart sparkline (dashboard accounts-overview rows): colorMap positive/warning/danger = z-income/z-expense/z-debt strokes with color-mix 12% fills, neutral = '#a1a1aa' + '#a1a1aa20' HARDCODED; verdict-colored
  TO:  Area → bare Line sparkline, no fill; row sparklines are evidence not verdicts — single quiet hue (sage-dark or white/25) per T6; delete #a1a1aa.
- [3/medium] speedometer-gauge-tier1 @ webapp/src/components/dashboard/speedometer-gauge.tsx:36-46, 56-123
  NOW: Hand-rolled 180° semicircle gauge (health score, mounted by health-score-section.tsx): viewBox '0 0 200 120', R=80, STROKE_W=12, four colored zone arcs ZONES = z-debt/z-alert/z-income/z-excellent at 0.85 opacity, indicat
  TO:  Tier-1 270° ring: viewBox 0 0 128 128, path 'M 27.23 100.77 A 52 52 0 1 1 100.77 100.77', pathLength=100, dasharray '{pct} 100', 8-9px stroke round caps, track white/6, fill brass (→ --z-debt only ≥10
- [3/small] progress-ring-mobile-v2 @ webapp/src/components/mobile/v2/progress-ring.tsx:26-45
  NOW: 44px full-circle ring (deudas lenses tiles): viewBox '0 0 40 40' -rotate-90, r=16 strokeWidth 3, track className 'stroke-white/6', tones TONE_STROKE brass/income/debt, strokeDasharray=circumference + dashoffset, round ca
  TO:  Candidate to become THE shared Tier-1 ring component (geometry → 270° pathLength=100 spec at 96/128px sizes); max one gauge per screen — audit deudas lenses for multiples.
- [3/small] ritmo-widget-ring @ webapp/src/components/mobile/v2/inicio/widgets/ritmo-widget.tsx:20-53
  NOW: ArcRing: 60px full-circle, r=24 strokeWidth 5, track 'var(--color-z-surface-3)', fill 'var(--color-z-income)' (income green as gauge fill — spec says gauge fill = brass), rotate(-90), center 13px bold '{percentage}%'. RI
  TO:  Replace with shared Tier-1 270° ring: track white/6, fill brass, sage-dark hoy tick, center hero number + micro-label.
- [3/small] debt-utilization-ring @ webapp/src/components/debt/debt-quick-stats.tsx:18-52
  NOW: UtilizationRing (deudas quick stats): 48px full-circle r=20 strokeWidth 4, track stroke 'hsl(var(--muted))' (legacy hsl-wrap — invalid color), fill stepped: ≤30 var(--z-income), ≤70 var(--z-alert), else var(--z-debt); ce
  TO:  Shared Tier-1 ring geometry; fill brass → debt at te-pasaste threshold only (color steps replaced by T1 verdict logic pct≥100 te-pasaste / ≥87 cerca); fix hsl() wrap.
- [3/small] mobile-budget-ring @ webapp/src/components/mobile/cards/mobile-budget-ring.tsx:131-157
  NOW: ProgressRing 38px full-circle strokeWidth 3, track 'rgba(255,255,255,0.06)', stroke = isOver ? 'var(--z-debt)' : isHigh ? 'var(--z-brass)' : 'var(--z-sage-light)'; tile also has stateCopy 'Sobre el límite'/'Último tramo'
  TO:  Shared ring (fill brass, debt ≥100 only — the 80-99% brass tier collapses); stateCopy converges to T1 vocabulary (Vas bien/Cerca del límite/Te pasaste).
- [3/small] runway-mini-chart-burndown @ webapp/src/components/dashboard/runway-mini-chart.tsx:151-152, 164-183, 222-257
  NOW: Hand-rolled SVG burndown (dashboard burndown-expandable + ritmo-widget detail): ideal line stroke 'var(--z-olive-deep)' strokeDasharray '4,3'; actual path brass 1.5; projected slope stroke 'var(--z-debt)' dasharray '3,2'
  TO:  Spec burndown: ideal dashed '2 3' sage-dark 0.8; actual brass 1.75; projection dashed '4 3' 0.5 SAME hue as series (brass, not debt); hoy dot r=3; olive-deep → sage-dark.
- [3/small] mobile-spending-pace-burndown @ webapp/src/components/mobile/cards/mobile-spending-pace.tsx:175-193
  NOW: RunwayChart SVG: gridlines stroke 'var(--z-surface-3)' 0.5; ideal 'var(--z-olive-deep)' dasharray '4,3' 1.5; actual brass 2; projected 'var(--z-debt)' dasharray '3,2'; dot brass r=3.5 + halo 5.5.
  TO:  Same burndown recipe as runway-mini-chart (ideal sage-dark '2 3' 0.8, projection brass '4 3' 0.5, hairlines white/6) — one shared burndown, two mounts.
- [3/small] inicio-burndown-inverted-hues @ webapp/src/components/mobile/v2/inicio/inicio-burndown.tsx:96-135, 159-183
  NOW: BurndownChart SVG: axis lines stroke '#2a2d28' HARDCODED (spec: no axis lines); expected/ideal line stroke 'var(--color-z-brass)' dashed '6,4' 0.6 and ACTUAL line stroke 'var(--color-z-income)' — hue roles INVERTED vs sp
  TO:  actual → brass 1.75, ideal → sage-dark dashed '2 3' 0.8; delete axis lines and #2a2d28; deviation verdict moves to the card's T1 Verdict slot.
- [3/small] plan-flow-chart @ webapp/src/components/mobile/v2/plan/plan-flow-chart.tsx:204-250, 296-334, 337-362, 422-430
  NOW: Plan 'FLUJO DEL MES' SVG: grid 'rgba(255,255,255,0.03)'; zero line brass 0.4 + '$0' brass label (spec: zero baseline = solid white/12, brass reserved for series); expense bars fill 'var(--z-debt)' (debt red for ordinary 
  TO:  Grid → white/6 hairlines; zero line white/12; expense bars → --z-expense; #ef4444/red-500 → --z-debt tokens via surface recipe; danger verdict text moves toward T1 detail line.
- [3/small] movimientos-lectura-brass-expense @ webapp/src/components/mobile/v2/movimientos/movimientos-lectura.tsx:141-199, 210-218
  NOW: FlowChart SVG (Movimientos lectura mode): income polyline 'var(--color-z-income)' solid 2.5; expense polyline 'var(--color-z-brass)' dashed '6 4' — brass used as EXPENSE hue (spec: brass = what you did/actions, expense =
  TO:  Expense line → --z-expense; income/expense pairing per spec (only frame where both greens+orange meet); Hoy label sage-light per axis ladder; dash from theme.
- [3/trivial] hero-sparkline-verdict-tone @ webapp/src/components/dashboard/hybrid-hero.tsx:51-55, 436-490
  NOW: HeroSparkline polyline stroke = TONE_STROKE[tone] where TONE_STROKE = {income:'var(--color-z-sage)', alert:'var(--color-z-alert)', debt:'var(--color-z-debt)'} — sparkline recolors by verdict state (comment: 'Te pasaste h
  TO:  Sparkline fixed quiet hue (sage-dark); verdict expressed solely by the adjacent <Verdict /> chip in the hero slot.
- [3/trivial] category-trend-sparkline-palette @ webapp/src/components/tendencias/category-trend-list.tsx:30-42, 74, 85-87
  NOW: Row Sparkline (Tendencias gastos lens, desktop-only) polyline stroke={color} = per-category color (multi-hue per-row palette on charts); row color dot 'size-2.5 rounded' style background: color.
  TO:  Row sparklines are V3 evidence — single hue from theme (sage-dark or white/25); category identity stays in the dot, not the chart stroke.
- [3/trivial] pulse-widget-sparkline-area @ webapp/src/components/mobile/v2/inicio/pulse-widget.tsx:73-135, 170-171
  NOW: Hand-rolled sparkline with BANNED area fill: gradient stopOpacity 0.25→0 + polyline; sparkColor = status.tone === 'brass' ? 'var(--color-z-brass)' : 'var(--color-z-sage)' (verdict-toned); status label 'En ritmo'/'Arriba 
  TO:  Drop area fill (line only), fixed sage hue; status converges to T1 Verdict (Vas bien / Cerca del límite).
- [3/small] axis-month-format-ladder @ webapp/src/actions/charts.ts:211, 264, 398, 676
  NOW: Month labels feeding chart axes: formatDate(new Date(m + '-15'), 'MMM yyyy') → 'jun 2026' (month+year on axis; spec axis = 'abr' 3-letter only) and formatDate(dateStr, 'dd MMM') → '03 jun'. Tendencias format.ts monthShor
  TO:  One axis formatter in chartTheme: 3-letter lowercase month, no period, no year (current month styled sage-light/600); promote monthShort into the theme.
- [3/small] chart-stories @ webapp/src/components/ui/chart.stories.tsx:1
  NOW: Storybook stories for the shadcn chart wrapper using recharts demo data/colors.
  TO:  Update stories to showcase chartTheme recipes (themed line, themed bars, burndown, split bar) so the theme has a living reference.
== density-glyphs ==
SUMMARY: T6 territory (number-wall hierarchy + account glyphs) is entirely unbuilt as a system, but the raw material is consistent: heroes hand-roll five different scales (32/36/42/44/46px with font-[680]/bold/extrabold), group headers are all the single 10px uppercase SECTION_EYEBROW_CLASS with bare counts and never an aggregate delta, and no V2 15/600 or V1 34/800 primitives exist. Budget already groups by risk state (mobile-budget-list) — the closest thing to the target — but sorts by percent instead of absolute delta, keeps healthy rows expanded, colors healthy bars green (6px, not 3px hairline/white-25), and its desktop counterpart is a completely unsorted equal-volume card grid. Deudas violates the brass guardrail twice (brass tick-gauge fills on healthy rows, a brass Abonar button inside every expanded row) and the desktop page stacks 12+ bold numbers with zero hierarchy. STATE ONCE is violated on six surfaces: per-row Pagado/Pendiente chips (recurrentes), per-date-group uppercase alarm labels (both recurring timelines), per-row status badges (transaction table), per-row delta pills (tendencias, trend-comparison), and per-card urgency labels (inicio attention strip). Account glyphs are three coexisting systems — BankBadge letter-monograms (2 call sites, deudas only), AccountIcon logo/lucide tiles (7 call sites, all through the AccountRowIdentity choke point), and the target colored dot (5 call sites, 3 divergent sizes) — so the dot unification is mostly mechanical. Design-board tokens map 1:1 to webapp tokens (same --z-* names in globals.css), so no token translation layer is needed.
- [3/medium] budget-risk-group-headers @ webapp/src/components/budget/mobile-budget-list.tsx:33-45, 96-104, 181-207
  NOW: Mobile Presupuesto groups rows into three risk sections via RiskSection: labels "Sobre límite" (labelClass text-z-expense), "Cerca del límite" (text-z-brass — brass carrying a verdict, guardrail violation), "Dentro del l
  TO:  V2 <GroupSummary /> 15px/600: count + aggregate delta ("7 sobre límite · −$486.000" / "N en orden"); state word once per group; sort worst-first by absolute delta; healthy group collapses behind T3 Di
- [3/small] budget-row-ladder @ webapp/src/components/budget/mobile-budget-list.tsx:209-268
  NOW: BudgetCategoryRow: name `truncate text-sm font-medium` (14px), spent `text-xs font-semibold tabular-nums` colored per-row (text-z-debt / text-z-alert / text-foreground), budget evidence `text-[10px] text-muted-foreground
  TO:  V3 13px row carrying only its own delta in the group's color; V4 11px evidence ("$381.000 de $300.000"); bars 3px hairlines track white/6; only over-limit rows tint debt-red; healthy fills white/25 — 
- [1/medium] budget-hero-statechip @ webapp/src/components/plan/tabs/plan-tab-presupuesto.tsx:149-233
  NOW: Mobile budget hero: percent at `text-[42px] font-[680] leading-none tracking-[-0.06em]` colored text-z-debt/text-z-income, PLUS a second large number `text-lg font-semibold` (totalSpent) beside it. Verdict = <StateChip> 
  TO:  One V1 34px/800 number; StateChip → <Verdict /> with closed vocabulary ("Te pasaste · −$486.000", sentence case, never uppercase); hero bar 6px 100% debt when over; spent/budget amounts demote to deta
- [3/large] budget-desktop-grid @ webapp/src/components/budget/budget-category-grid.tsx:134-137 (+ budget-category-card.tsx 39-131)
  NOW: Desktop Presupuesto tab renders `localCategories.map(...)` in incoming order into `grid gap-4 sm:grid-cols-2` — no grouping, no worst-first sort, no summary rows. Each BudgetCategoryCard: bar `h-2 bg-muted` filled with r
  TO:  Ladder + GroupSummary: V2 header per state group, top offenders first, healthy cards behind Disclosure; per-card state color demotes to delta-only; kill per-card Fijo/Variable badge repetition at full
- [3/medium] budget-summary-bar-desktop @ webapp/src/components/budget/budget-summary-bar.tsx:40-70, 99-137
  NOW: Header row has two `text-lg font-semibold tabular-nums` numbers ("{totalSpent} / {totalBudget}" and "{percent}%" colored text-z-debt >100 / text-z-expense >80) competing; below: stacked per-category color bar (h-2, raw c
  TO:  Percent verdict moves to the single hero Verdict; summary becomes V2 (15/600); stacked multicolor bar + legend replaced under chartTheme rules (inline swatch chips, max 2 series).
- [1/medium] plan-resumen-second-hero @ webapp/src/components/mobile/v2/plan/plan-budget-hero.tsx:23-27, 60-114, 128-159
  NOW: Plan resumen (mobile) has ANOTHER 46px budget hero: `text-[46px] font-[680] leading-none tracking-[-0.06em]` colored percent + `text-lg font-semibold` spent + StateChip with DIFFERENT vocabulary {stable:"Holgado", watch:
  TO:  One V1 per screen; closed verdict vocabulary (Vas bien / Cerca del límite / Te pasaste / Atención); expanded rows demote to V3 with delta only, 3px hairline bars.
- [3/small] deudas-mobile-hero-splitbar @ webapp/src/components/mobile/v2/deudas/deudas-hero.tsx:56-88
  NOW: Cuota mensual hero: `text-[32px] font-[680] leading-none tracking-[-0.05em] tabular-nums` (white) + second number `text-[16px] font-semibold text-z-debt` interest. Split bar `flex h-2.5 rounded-full`: capital = `bg-gradi
  TO:  V1 34/800 white total cuota + Verdict chip "Vas bien · 24% del ingreso"; T2 split bar signature: 10px height radius 999, capital=brass, interés=expense 0.85 opacity, restante=white/10.
- [3/medium] deudas-account-rows-brass @ webapp/src/components/mobile/v2/deudas/deudas-cuentas-lens.tsx:476-499, 501-674
  NOW: AccountRow: every balance `text-sm font-bold tabular-nums text-z-debt` (all rows red at same volume); TickGauge = 14 segments `h-2 flex-1 rounded-[1.5px]` filled `bg-z-brass` for healthy credit cards (brass on rows — gua
  TO:  V2 header "3 cuotas este mes / 2 pagadas"; rows carry deltas only; pending row full opacity + "vence en 2 días" alert chip + owns the ONLY brass action; per-debt capital/interés split = V4 evidence in
- [3/small] deudas-group-dividers-no-summary @ webapp/src/components/mobile/v2/deudas/deudas-cuentas-lens.tsx:73-104, 466-474
  NOW: GroupDivider renders `<span className="h-px flex-1 bg-white/6" /><span className={MOBILE_EYEBROW_CLASS}>Tarjetas de crédito / Préstamos</span>` — hairline eyebrow with NO count and NO aggregate above 2+ same-state rows.
  TO:  V2 GroupSummary above each group: count + aggregate delta ("N cuotas este mes / N pagadas", "N de M pagados").
- [3/medium] deudas-paid-vs-pending @ webapp/src/components/mobile/v2/deudas/deudas-cuentas-lens.tsx:137-187
  NOW: Paid treatment exists only for archived debts: collapsed card "Obligaciones cerradas" + `{archived.length} pagada{s} por completo` (text-[10px]), rows with `text-xs font-bold tabular-nums text-z-income` totalPaid. Active
  TO:  Paid rows dim opacity 0.6 with income check chips inside the same list; V2 "N de M pagados" summary; celebration residue row later (T4).
- [3/large] deudas-desktop-number-wall @ webapp/src/components/debt/debt-hero-card.tsx:35-72 (+ debt-quick-stats.tsx 202-441, debt-account-card.tsx 57-141)
  NOW: Desktop Deudas stacks: hero card with THREE bold numbers (`text-2xl sm:text-3xl font-bold` totalDebt, `text-xl sm:text-2xl font-bold` pagas al mes, `text-2xl font-bold text-z-expense` intereses/mes), then DebtQuickStats 
  TO:  Exactly ONE V1 (34/800, derived judgment) + verdict slot; tiles demote to V2/V3; per-debt capital/interés = V4 evidence inside rows; kill repeated type badges.
- [3/trivial] debt-account-row-brass-fill @ webapp/src/components/debt/debt-account-row.tsx:70-80
  NOW: Canonical compact debt row's utilization bar: `h-1.5 bg-white/6` with fill `utilization > 60 ? "bg-z-debt/80" : "bg-z-brass/80"` — brass fill on healthy bars.
  TO:  3px hairline; healthy fill white/25 (NOT brass); only over-limit tints debt-red.
- [3/small] state-once-recurring-card @ webapp/src/components/recurring/recurring-template-card.tsx:148, 195-201
  NOW: Every recurring template card renders `<StatChip label="Estado" value={occurrenceStatus === "paid" ? "Pagado ✓" : "Pendiente"} />` (StatChip label is `text-[8px] font-semibold uppercase tracking-[0.18em]`) — state repeat
  TO:  STATE ONCE: verdict word only in the V2 group summary ("N de M pagados"); rows carry date/amount deltas only; paid rows dim with income check.
- [3/medium] state-once-recurring-timeline @ webapp/src/components/recurring/recurring-timeline.tsx:45-61, 153-156, 188-191, 219-224
  NOW: Desktop timeline stamps every date group with an uppercase colored status label: `text-[10px] font-semibold uppercase tracking-[0.18em]` + dateColor (text-z-debt overdue / text-z-alert today / text-z-income paid) and pre
  TO:  One V2 summary per state; per-row/per-group uppercase alarm labels deleted; relative dates per T5 ladder.
- [3/medium] state-once-recurrentes-mobile @ webapp/src/components/mobile/v2/plan/mobile-recurrentes-view.tsx:52-74, 244-263, 285-308, 527-547
  NOW: Mobile Recurrentes: hero `text-3xl font-bold` compromiso + two colored counts `text-lg font-semibold text-z-alert` (Pendientes) and `text-z-income` (Completados) — 3 competing numbers; each pending date-group gets upperc
  TO:  One V1 + verdict slot (Deudas/Recurrentes adopt full hero slot per T1); V2 "N de M pagados" summaries; state once per group; disclosure label grammar "Ver/Ocultar + qué".
- [3/medium] state-once-movimientos-rows @ webapp/src/components/mobile/v2/movimientos/movimientos-transaction-row.tsx:88-128
  NOW: Every transaction row carries TWO pills: category chip (`rounded-full border px-2 py-px text-[11px] font-medium` with per-category color-mix bg/border) + account pill (`rounded-full bg-white/5 px-2 py-0.5 text-[10px]` co
  TO:  Rows demote to V3 13px with compact meta (dot stays — it IS the standard glyph); date groups gain V2 count+aggregate summaries where 3+ same-state rows repeat.
- [3/small] state-once-transaction-table-desktop @ webapp/src/components/transactions/transaction-table.tsx:287-305
  NOW: Desktop table stamps every row with `<Badge variant={tx.status === "POSTED" ? "secondary" : "outline"}>` "Confirmada"/"Pendiente"/"Cancelada" — nearly all rows are POSTED, so an entire column repeats the same state pill.
  TO:  STATE ONCE: status only when it deviates (Pendiente/Cancelada); confirmed is the silent default.
- [3/small] state-once-tendencias-delta-chips @ webapp/src/components/tendencias/delta-chip.tsx:1-14 (+ category-trend-list.tsx 82-89)
  NOW: Every category row in Tendencias renders a DeltaChip pill: `rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums` with `bg-z-expense/12 text-z-expense` (up) / `bg-z-income/10 text-z-income` (down) and glyphs
  TO:  Rows carry deltas only in the group's color (V3, no pill chrome per row); summary-first if 3+ rows share a state.
- [3/small] state-once-budget-trend-badges @ webapp/src/components/budget/trend-comparison.tsx:42-55
  NOW: Per-category anomaly Badge repeated per row: `Badge variant="outline" text-[10px] px-1.5` with `border-z-debt/30 text-z-debt` or `border-z-income/30 text-z-income` and text "+N% vs promedio".
  TO:  Delta text inline at V3/V4 volume in the group color; no per-row outlined pills.
- [3/small] state-once-inicio-attention-cards @ webapp/src/components/mobile/v2/inicio/inicio-attention-timeline.tsx:66-101
  NOW: "Por resolver" strip: each card repeats an uppercase urgency label `text-[9px] font-semibold uppercase tracking-[0.18em]` colored text-z-debt (overdue) / text-z-brass (today — brass as state) / text-muted-foreground, plu
  TO:  Urgency stated once (group summary or Verdict atención); cards carry only date + amount; brass never signals state.
- [3/medium] group-summary-prior-art @ webapp/src/components/mobile/v2/deudas/deudas-cuentas-lens.tsx:242-267 (+ 366-374; mobile-recurrentes-view.tsx 527-534; recurring-summary-bar.tsx 20-33; movimientos-lectura.tsx 264-291; mobile-budget-list.tsx 106-155; category-trend-list.tsx 297-306)
  NOW: Existing count+aggregate headers to converge into <GroupSummary />: PersonasCard "{N} activa(s)" + te deben/debes totals (closest V2 prototype); HeaderTiles "Deuda total" + "{N} cuenta(s)"; CompletedSection "Completados 
  TO:  All converge on V2 GroupSummary grammar: "N sobre límite" / "N en orden" / "N de M pagados" at 15px/600, count + aggregate delta, healthy groups behind Disclosure.
- [3/small] glyph-system-a-letter-badge @ webapp/src/components/debt/bank-badge.tsx:23-93
  NOW: BankBadge = the letter-badge system the handoff DELETES: BRANDS regex table (bancolombia #FDDA24, nu #820AD1, davivienda #ED1C27, nequi #200020, falabella #007A33, bogotá #002B7F, lulo #E2FF32, confiar #00843D, popular #
  TO:  Deleted — replaced by the colored account dot everywhere (the smaller, quieter system).
- [3/medium] glyph-system-b-icon-tile @ webapp/src/components/accounts/account-icon.tsx:15-65 (+ account-row-identity.tsx 49-94)
  NOW: AccountIcon = second glyph system: BANK_LOGOS[bank_key] SVG (lib/icons/bank-logos.tsx) or lucide TYPE_GLYPHS (Wallet/PiggyBank/CreditCard/Landmark/Banknote/TrendingUp) inside a tinted tile `inline-flex items-center justi
  TO:  Standardize on colored dot; AccountRowIdentity is the single choke point — swap its AccountIcon render for the dot and all 7 call sites migrate at once.
- [3/small] glyph-system-c-colored-dot @ webapp/src/components/mobile/v2/movimientos/movimientos-transaction-row.tsx:121-127
  NOW: The colored-dot system (handoff TARGET) already live at 5 call sites with 3 divergent sizes: movimientos row `h-[5px] w-[5px] rounded-full` + backgroundColor tx.account.color inside a `bg-white/5 px-2 py-0.5 text-[10px]`
  TO:  One canonical AccountDot component (single size/recipe) used everywhere; existing call sites converge on it.
- [3/trivial] glyph-hardcoded-fallback-hue @ webapp/src/components/debt/debt-account-card.tsx:36-44
  NOW: Desktop debt card icon tile hardcodes an indigo fallback: `backgroundColor: ${account.color ?? "#6366f1"}20` and `color: account.color ?? "#6366f1"` — a hue that exists nowhere in the token set. AccountCard (accounts/acc
  TO:  Colored dot with token-based fallback; zero new hues.
- [3/large] one-v1-dashboard-desktop @ webapp/src/components/dashboard/hybrid-hero.tsx:126-175 (+ interactive-metric-card.tsx:222, burn-rate-card.tsx:117, health-meter-expanded.tsx:155, dashboard-hero.tsx:96)
  NOW: Desktop Inicio: HybridHero `text-[44px] font-bold tracking-[-0.04em] tabular-nums` (Gasto de hoy, tone-colored) + status pill (uppercase `text-[10px] tracking-[0.12em]` + size-1.5 dot — the "dashboard status dot" T1 dele
  TO:  ONE V1 34/800 (the derived ¿voy bien? number); all others demote to V2/V3; dot+sentence converges into <Verdict /> (sentence survives as detail line).
- [3/medium] one-v1-inicio-mobile @ webapp/src/components/mobile/v2/inicio/pulse-widget.tsx:193-216 (+ inicio-burndown.tsx:240, widgets/where-today-widget.tsx:30, widgets/attention-widget.tsx:56)
  NOW: Mobile Inicio: pulse-widget `text-[36px] font-extrabold` /día + inicio-burndown `text-[24px] font-[680]` + where-today-widget `text-[26px] font-bold` + attention-widget `text-[26px] font-bold` — four 24px+ numbers compet
  TO:  One V1; widget numbers cap at V2 15/600.
- [3/medium] one-v1-plan-resumen @ webapp/src/components/plan/plan-hero.tsx:62-67 (+ plan-scenario-preview.tsx:30; mobile: plan-budget-hero.tsx:68, plan-net-hero.tsx:60)
  NOW: Plan resumen desktop: plan-hero `text-4xl md:text-5xl font-bold` disponible (colored text-z-debt when negative) + plan-scenario-preview `text-3xl` count. Mobile plan root stacks plan-budget-hero 46px AND plan-net-hero `t
  TO:  One V1 per screen (the disponible verdict); scenario count and secondary heroes demote to V2.
- [3/medium] one-v1-deudas-lenses @ webapp/src/components/debt/debt-free-countdown.tsx:36-39 (+ deudas-hero.tsx:58, mobile-recurrentes-view.tsx:248-263)
  NOW: DebtFreeCountdown `text-[42px] font-extrabold` months + `text-2xl font-bold` "meses" suffix (Deudas Plan lens); Carga lens hero is 32px — per-lens it's roughly one hero (compliant-ish), but Recurrentes hero has `text-3xl
  TO:  Normalize all heroes to V1 34/800 spec (letter-spacing -0.02em tabular); side counts become V2 group summaries.
- [3/small] eyebrow-vs-v2-ladder-gap @ webapp/src/lib/constants/styles.ts:59-95
  NOW: The codebase has ONE group-header primitive: SECTION_EYEBROW_CLASS = "text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark" (MOBILE_EYEBROW_CLASS aliases it). There is NO 15px/600 V2 summary primitive a
  TO:  Add ladder constants (V1 34/800 ls -0.02em tabular, V2 15/600, V3 13, V4 11) + <GroupSummary /> component in Fase 3; heroes converge on V1 constant.
== celebrations ==
SUMMARY: T4 (celebration moments) is almost entirely net-new: Zeta today has zero event-gated celebrations — no confetti, no brass-on-number, and the only custom keyframe in globals.css is `page-enter` (lines 256-262), so `z-ring-sweep`/`z-rise` have a clean insertion point but no `--motion-*` tokens yet (T3 dependency). What exists instead are always-on, state-based success surfaces that violate the 'never app-open' rule: the dashboard `DebtFreeBanner` and the '¡Libre de deudas!' card render every visit, mobile Recurrentes shows a green 'Todo al día' card whenever everything is paid, and the 'Por resolver' inbox empties into 'Todo tranquilo / Al día' with no next-charge line. Debt payoff currently has NO automatic lifecycle: a zero-balance debt stays listed (amount flips to income green) until the user manually runs 'Archivar (pagada)' → toast + redirect; a Saldadas-equivalent group ('Obligaciones cerradas', fed by is_active=false archives) exists only on the mobile Cuentas lens, not desktop. Recurrentes counts are split 'Pendientes N / Completados M' chips — the 'N de M pagados' grammar exists nowhere. Month-close detection is fully net-new (no 'mes cerrado' logic), though both persistence precedents (localStorage dismissal map in dashboard-alerts, nested JSONB in profiles.dashboard_config via guided-experience) and margin sources (`getMonthlyCashflow`.net, `getBudgetSummary(month)`) already exist. The 'logro' residue row targets `InicioActivity`/`renderRecentWidget` on mobile and the 'Últimas transacciones' card on desktop, but the row model (`RecentActivityTx`) is transaction-only and needs a type discriminator.
- [4/trivial] keyframes-insertion-point @ webapp/src/app/globals.css:256-262
  NOW: The ONLY custom keyframe in the app: `@keyframes page-enter { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }` + `.animate-page-enter { animation: page-enter 0.1s ease-out;
  TO:  Add `z-ring-sweep` (dashoffset 100→0, 600ms — single exception to 200ms cap) and `z-rise` (opacity 0→1 + translateY 6px→0, 120ms) keyframes next to page-enter; both consume T3 `--motion-ease` token.
- [4/large] no-celebration-infra @ webapp/src:-
  NOW: Zero celebration infrastructure: grep for confetti/celebrat/felicidades/logro across webapp/src returns only comments (onboarding page.tsx:65 '"Listo" celebration', debt-free-countdown.tsx:11 'Celebratory state', hybrid-
  TO:  Net-new celebration primitive: brass hero number + eyebrow (DEUDA SALDADA / MES CERRADO BAJO PLAN / TODO PAGADO) + T1 'Vas bien' chip + z-ring-sweep/z-rise motion, event-gated, once per event, max one
- [4/small] debt-free-banner-app-open-trigger @ webapp/src/components/dashboard/debt-free-banner.tsx:9-34
  NOW: `DebtFreeBanner` renders on EVERY desktop dashboard visit (mounted at zones/hero-zone.tsx:85): income-tinted banner `Libre de deudas: ${displayDate} (${data.monthsToFree} meses)` with inline styles `color-mix(in srgb, va
  TO:  Not a celebration under T4 rules (never app-open). Stays as informational line; the earned moment is Event 1 (deuda saldada) fired once when a debt actually reaches zero.
- [4/small] debt-free-countdown-celebratory-state @ webapp/src/components/debt/debt-free-countdown.tsx:10-24
  NOW: State-based celebratory card when user has no debts: `<p className="text-sm font-semibold text-z-income">¡Libre de deudas!</p>` + 'No tienes cuentas de deuda activas.' inside `rounded-xl bg-z-surface-2 border border-z-bo
  TO:  Copy re-cased to closed vocabulary, no exclamation; the one-time payoff moment moves to Event 1 (ring sweep + '$0' brass 30px/800 + detail 'Pagaste $X en N meses…' + brass-ghost 'Ver historial').
- [4/large] debt-zero-lifecycle-manual-archive @ webapp/src/components/accounts/quick-actions-bar.tsx:190-201, 275-280, 323-344
  NOW: What happens when a debt hits zero TODAY: nothing automatic. The account stays listed (deudas-cuentas-lens.tsx:568-580 flips the amount to `text-z-income` when `account.balance > 0` is false; several aggregates filter it
  TO:  Event 1 'Deuda saldada': one-time moment on zero-balance (ring sweeps closed 600ms, '$0' brass, text rise delayed 450ms, detail sentence, CTA 'Ver historial'); row moves to 'Saldadas' group at opacity
- [4/medium] saldadas-group-partial @ webapp/src/components/mobile/v2/deudas/deudas-cuentas-lens.tsx:131-187
  NOW: A Saldadas-like group EXISTS on mobile Cuentas lens only: `ClosedObligations` collapsible — header 'Obligaciones cerradas' + `{archived.length} pagada{s} por completo` (Archive icon `text-z-income`), rows show name, 'cer
  TO:  Rename/align to 'Saldadas' group semantics (rows opacity 0.7, income check chips per T6 Deudas application); add the desktop counterpart; group receives the debt row at payoff instead of the row vanis
- [4/medium] actividad-reciente-mobile-row-shape @ webapp/src/components/mobile/v2/inicio/inicio-activity.tsx:136-259
  NOW: Live mobile 'recent activity': eyebrow `Reciente` (SECTION_EYEBROW_CLASS, line 138), 3 visible rows (line 117 `transactions.slice(0, 3)`). Row anatomy: 22px icon square (`bg-z-income/12 text-z-income` / `bg-z-expense/12 
  TO:  Insertion point for 'logro' residue rows ('Logro / junio cerró bajo plan · margen $412.000', deuda saldada, todo pagado). Requires a row-type discriminator — `RecentActivityTx` (recent-widget.tsx:20-4
- [4/small] actividad-reciente-desktop @ webapp/src/app/(dashboard)/dashboard/page.tsx:247-306
  NOW: Desktop equivalent is the 'Últimas transacciones' Card (WidgetSlot `widgetId="recent-tx"`): CardTitle 'Últimas transacciones', 'Ver todas' link, rows are PrefetchLink to `/transactions/{id}` with ArrowDownLeft/ArrowUpRig
  TO:  Same residue-row insertion on desktop; a logro row appears alongside transaction rows after each celebration event.
- [4/trivial] actividad-reciente-dead-heading @ webapp/src/components/mobile/dashboard/../mobile-dashboard-v2.tsx:100
  NOW: webapp/src/components/mobile/mobile-dashboard-v2.tsx:100 contains the literal heading 'Actividad reciente' but the component has zero importers (replaced by InicioRoot + widgets). Dead code — do not migrate it; flag for 
  TO:  None (delete candidate). The handoff's 'Actividad reciente' maps to InicioActivity/recent-widget, not this file.
- [4/medium] recurrentes-paid-count-grammar @ webapp/src/components/mobile/v2/plan/mobile-recurrentes-view.tsx:244-263
  NOW: Mobile Recurrentes hero (HERO_CARD_GRADIENT_CLASS card): eyebrow 'Compromiso mensual' `text-z-brass`, number `text-3xl font-bold tabular-nums`, then two SEPARATE count chips — 'Pendientes' `text-z-alert` + `{hook.pending
  TO:  Converge to 'N de M pagados' count display; this count is what turns brass 34/800 in Event 3 ('11 de 11 pagados').
- [4/large] recurrentes-all-paid-state @ webapp/src/components/mobile/v2/plan/mobile-recurrentes-view.tsx:385-395
  NOW: All-paid state renders EVERY visit when `sortedDates.length === 0 && hook.completed.length > 0`: PANEL_INSET_CLASS card with `<Check className="mx-auto size-6 text-z-income" />`, 'Todo al día' `text-xs font-medium text-z
  TO:  Event 3 'Todo pagado': fires ONCE when the LAST pending recurrente clears — count 'N de N pagados' turns brass 34/800 (200ms), eyebrow 'Todo pagado' brass, T1 chip flips Atención→Vas bien, segment dot
- [4/medium] por-resolver-inbox-empty-state @ webapp/src/components/mobile/v2/inicio/inicio-attention-timeline.tsx:40-63
  NOW: The 'Por resolver' inbox exists as the attention timeline (eyebrow 'Por resolver', 'Ver todo →' to /gestionar). Empty state (56-63): CheckCircle2 `text-z-income` + 'Todo tranquilo' + 'Sin pendientes esta semana.' Compani
  TO:  Event 3 empty-inbox copy: 'Nada por resolver. El próximo cobro es Netflix, el 2 de agosto.' — needs next-pending-occurrence lookup (available from getPendingOccurrences / upcomingPayments already fed 
- [4/medium] month-close-detection-netnew @ webapp/src/components/dashboard/dashboard-alerts.tsx:31-62
  NOW: NO month-close detection exists anywhere (grep 'mes cerrado', 'cierre de mes', 'month_closed', 'monthClose' → zero product hits). Event 2 'first visit after month close' is net-new state. Two existing persistence precede
  TO:  First-visit-after-month-close flag (profile JSONB `celebrations.lastClosedMonthShown: "2026-06"` or localStorage) gating Event 2; fires once, never on subsequent visits.
- [4/medium] month-close-margin-sources @ webapp/src/actions/charts.ts:39-45
  NOW: Margin ('mes cerrado bajo plan · margen $X') is computable from existing cached queries — nothing new needed: (1) `MonthlyCashflow { month, label, income, expenses, net }` via `getMonthlyCashflow(month, currency)` (chart
  TO:  Event 2 hero: unspent margin brass 34/800 + 'sin gastar', chip 'Vas bien · 79% del plan', CTAs 'Mover al ahorro' (brass) + 'Ver julio' (ghost), residue row 'Logro / junio cerró bajo plan · margen $412
- [4/medium] ring-gauge-dependency @ webapp/src/components/mobile/v2/deudas/deudas-cuentas-lens.tsx:548-560
  NOW: No radial ring exists in product code for Event 1 to sweep: debt progress renders as linear elements only — `TickGauge` bar (deudas-cuentas-lens.tsx:550), horizontal bars in debt-free-countdown.tsx:51-59 (`bg-z-income` f
  TO:  Event 1 reuses the T2 270° ring (viewBox 0 0 128 128, pathLength=100) with `animation: z-ring-sweep 600ms var(--motion-ease)` sweeping to full on payoff.
- [4/trivial] existing-event-success-screens @ webapp/src/components/import/step-results.tsx:59-83
  NOW: Two existing event-gated (correctly one-time) success surfaces to keep stylistically consistent with T4: (1) import results hero — CheckCircle2 `h-16 w-16 text-z-income` + headline '{N} movimientos importados' / 'Ya tení
  TO:  Leave as-is functionally; align copy (drop '¡Listo!' exclamation) and motion to T3/T4 vocabulary when touched. They are precedent, not migration targets.
- [4/small] celebration-eyebrow-slot @ webapp/src/lib/constants/styles.ts:59, 71, 95
  NOW: Eyebrow + hero-card primitives the celebration reuses already exist: `SECTION_EYEBROW_CLASS` (=`MOBILE_EYEBROW_CLASS`, 10px uppercase tracking voice used by 'Reciente', 'Por resolver', 'Pendientes', 'Compromiso mensual',
  TO:  Eyebrow swaps to the celebration string in brass during the moment; hero number class gains a brass state (currently number colors are fixed: text-foreground / tone classes).

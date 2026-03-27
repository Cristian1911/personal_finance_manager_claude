# Phase 6: Dashboard Redesign - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform the dashboard from a data dump into a top-to-bottom narrative that answers "Am I on track this month?" without explanation. Add a status headline, composite health score, clear information hierarchy with primary/secondary/tertiary tiers, and dynamic "so what?" subtitles on every section. No new data sources — this phase reshapes how existing data is presented.

</domain>

<decisions>
## Implementation Decisions

### Health Headline (DASH-01)
- **D-01:** Status headline appears **below the KPI cards** in the hero section. Numbers first (Disponible para gastar + 3 KPI cards), then the narrative interpretation sentence.
- **D-02:** Headline is driven by **budget spending pace** — how much spent vs budgeted this month. Thresholds:
  - Under budget (< 90%): "Vas bien este mes — gastos dentro del presupuesto" with green indicator
  - Near limit (90-100%): "Cerca del limite — queda poco margen este mes" with yellow indicator
  - Over budget (> 100%): "Te pasaste del presupuesto — $X por encima" with red indicator
- **D-03:** Headline requires budget + transaction data to compute. When insufficient, fall back to a prompt-to-action (see D-14).

### Debt-Free Date in Hero (DASH-04)
- **D-04:** Debt-free date appears as a **separate colored banner below the headline** (not inline, not a KPI card). Format: "Libre de deudas: Dic 2028 (32 meses)".
- **D-05:** When user has no debts, the banner **disappears entirely** — hero stays clean with just the headline.
- **D-06:** Banner uses the existing `getDebtFreeCountdown` action data which is already fetched in tier 2. This banner should be part of the hero section but may stream in slightly after the headline if it's in tier 2 scope.

### Composite Health Score (DASH-02)
- **D-07:** Health score gets its **own dedicated section** positioned immediately after the hero. This is the second thing the user sees.
- **D-08:** Score format is **0-100 numeric** displayed as a big number inside a **speedometer (half-circle gauge)** with colored zones (red → yellow → green). Label below: "Bien", "Excelente", etc.
- **D-09:** Computation: **equal-weight average** of 4 dimensions, each scored 0-100:
  - Savings rate score (25%)
  - Emergency fund score (25%)
  - Debt-to-income ratio score (25%)
  - Spending pace score (25%)
- **D-10:** Individual health meters displayed as **horizontal bars below the speedometer** within the same section, replacing the current standalone `health-meters-card.tsx`.

### Information Hierarchy (DASH-03)
- **D-11:** Two visual tiers:
  - **Primary** (hero + health score): No card border/wrapper, larger fonts (3xl-4xl for key numbers), more vertical padding (py-6), subtle background tint (bg-z-surface-2)
  - **Secondary** (all other sections): Standard Card wrapper with border, normal fonts (lg-xl), compact padding (py-4), white/default bg
  - **Tertiary**: Sections that user has hidden via dashboard config (already supported by WidgetSlot)
- **D-12:** Section order is **fixed by default** but sections can be hidden/shown via existing `dashboard_config` JSONB and WidgetSlot system. No drag-drop, no reordering. Default narrative order:
  1. Hero (Disponible + KPIs + headline + debt-free banner)
  2. Health Score (speedometer + meters)
  3. Cash Flow (waterfall + trend)
  4. Budget (50/30/20 + pace)
  5. Activity Heatmap
  6. Accounts
  7. Debt Progress
  8. Net Worth

### Section Narratives (DASH-05)
- **D-13:** Every section gets a **dynamic data-driven subtitle** below the section title. The subtitle is a single sentence that interprets the data in context. Examples:
  - Flujo de Caja: "Gastaste $800K de $1.2M — vas bien"
  - Presupuesto: "Necesidades al 92% — cerca del limite"
  - Cuentas: "3 cuentas activas — saldo total $4.5M"
  - Deudas: "2 deudas activas — $150K pagado este mes"
- **D-14:** When data is insufficient for a dynamic subtitle, show a **prompt-to-action**: "Importa tu extracto para ver tu flujo", "Agrega tu ingreso en ajustes". Guides user toward fixing the data gap.
- **D-15:** Tone is **friendly coach** — second person, encouraging but honest. "Vas bien", "Cuidado", "Excelente". Never guilt-inducing ("MAL", "PELIGRO", "Fallaste"). Aligns with UX-03 requirement.

### Claude's Discretion
- Exact copy for each section's dynamic subtitle (Claude generates based on data patterns)
- Speedometer SVG implementation details (recharts, custom SVG, or library)
- Exact color zone thresholds on speedometer gauge
- How to map each health meter's raw value to a 0-100 score for the composite
- Mobile layout adaptations for the speedometer section
- Whether DashboardSection component needs a `subtitle` prop or if subtitles are handled per-section
- Skeleton designs for the new health score section

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Dashboard Page & Hero
- `webapp/src/app/(dashboard)/dashboard/page.tsx` — Main dashboard with Suspense streaming tiers, section ordering, mobile vs desktop split
- `webapp/src/components/dashboard/dashboard-hero.tsx` — Current hero: "Disponible para gastar" + 3 KPI cards (Saldo total, Fijos pendientes, Libre)
- `webapp/src/components/ui/kpi-widget.tsx` — KPI card component used in hero

### Health Meters (current implementation to evolve)
- `webapp/src/components/dashboard/health-meters-card.tsx` — Individual health meters with gradient bars + click-to-expand
- `webapp/src/components/dashboard/health-meter-expanded.tsx` — Expanded meter detail view
- `webapp/src/lib/health-levels.ts` — Level colors, tags, normalized positions, meter display labels
- `webapp/src/actions/health-meters.ts` — `getHealthMeters()` data fetching

### Dashboard Section Infrastructure
- `webapp/src/components/dashboard/dashboard-section.tsx` — Section wrapper with collapsible behavior
- `webapp/src/components/dashboard/widget-slot.tsx` — Per-widget visibility toggling via dashboard config
- `webapp/src/components/dashboard/dashboard-config-provider.tsx` — Dashboard config context
- `webapp/src/components/dashboard/dashboard-skeletons.tsx` — Content-shaped skeletons

### Data Sources (already exist)
- `webapp/src/actions/charts.ts` — `getDashboardHeroData`, cash flow data
- `webapp/src/actions/allocation.ts` — `get503020Allocation` for budget data
- `webapp/src/actions/debt-countdown.ts` — `getDebtFreeCountdown` for debt-free date
- `webapp/src/actions/burn-rate.ts` — `getBurnRate` for spending pace
- `webapp/src/actions/health-meters.ts` — Individual health meter data

### Prior Phase Decisions
- Phase 4 CONTEXT: Suspense streaming tiers (tier 1 = hero + health meters, tier 2 = everything else)
- Phase 4 CONTEXT: CSS animation pattern `animate-in fade-in slide-in-from-right-4 duration-200`
- Phase 4 CONTEXT: recharts v3 upgraded, lazy-loaded via `next/dynamic`
- Phase 4 CONTEXT: `DashboardSection` wrapper and `WidgetSlot` patterns established

### Product Decisions (2026-03-18 session)
- Hero stays focused on "Disponible para gastar" + micro cash flow breakdown
- Gamified health: speedometer = simplified, horizontal bars = detailed
- Widget-based layout with sections constraining widgets
- Every feature: compact/summary and expanded/detail modes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DashboardHero` component: already renders "Disponible para gastar" + 3 KPI cards — needs headline + debt-free banner additions
- `HealthMetersCard`: individual meters with gradient bars — needs composite score header and visual tier upgrade
- `DashboardSection`: collapsible section wrapper — needs subtitle prop for dynamic narratives
- `WidgetSlot`: visibility toggling via dashboard_config — already supports hide/show
- `KPIWidget`: reusable card component for hero sub-cards
- `DebtFreeCountdown` component exists — may need adaptation for the hero banner format
- `dashboard-skeletons.tsx`: content-shaped skeletons for all sections — will need new health score skeleton

### Established Patterns
- Suspense streaming: tier 1 (hero + health) renders immediately, tier 2 streams with skeletons
- Server Components fetch data via server actions, Client Components for interactivity
- `revalidateTag("zeta")` invalidates all dashboard data
- CSS animations via Tailwind + tw-animate-css (no framer-motion)
- recharts v3 for all chart visualizations, lazy-loaded via next/dynamic

### Integration Points
- `dashboard/page.tsx`: add headline computation, debt-free banner, reorder sections, add health score section
- `dashboard-hero.tsx`: add status headline below KPI cards + debt-free banner
- `health-meters-card.tsx`: major refactor — add speedometer gauge, composite score, visual tier upgrade to primary
- `dashboard-section.tsx`: add optional `subtitle` prop for dynamic narratives
- Each section component: add subtitle generation logic based on section data

</code_context>

<specifics>
## Specific Ideas

- Speedometer should use colored zones matching the existing health gradient: `var(--z-debt)` → `var(--z-expense)` → `var(--z-alert)` → `var(--z-income)` → `var(--z-excellent)`
- Headline copy should use the same friendly-coach tone as section narratives — never guilt-inducing
- The debt-free banner is visually distinct from the headline — it's a colored card/strip, not just text
- Primary tier sections (hero + health) should feel like they "float" on the page compared to the card-bordered secondary sections
- Section subtitles should include status indicators (colored dots or emoji) matching their assessment

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-dashboard-redesign*
*Context gathered: 2026-03-27*

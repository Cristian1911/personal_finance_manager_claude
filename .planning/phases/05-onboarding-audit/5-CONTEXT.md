# Phase 5: Onboarding Audit - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate a self-contained HTML walkthrough of the current 6-step onboarding flow so the user can review it visually in a browser before any redesign work (Phase 8). The walkthrough must faithfully represent the current implementation. No modifications to the actual onboarding code.

</domain>

<decisions>
## Implementation Decisions

### Walkthrough format
- **D-01:** Interactive wizard — clickable step-by-step navigation that mirrors the real flow. Back/Next buttons advance between steps, showing one step at a time. Progress bar visible.
- **D-02:** Output is a single self-contained `.html` file in `ui-showcases/` — no external dependencies beyond CDN links.

### Visual fidelity
- **D-03:** High fidelity — use Tailwind CSS via CDN + shadcn-like Card/Input/Select/Button styles. Match the real emerald gradient background, progress bar, card layout, and CurrencyInput formatting.
- **D-04:** Not pixel-perfect React — pure HTML/CSS/JS. No Supabase calls, no real form validation. Faithful representation, not a working clone.

### Annotations & findings
- **D-05:** Annotated inline — each step includes callout boxes noting UX concerns, missing fields, friction points, mobile-readiness issues, and positive patterns. Use ⚠️ for concerns and ✅ for good patterns.
- **D-06:** Annotations appear alongside/below each step, not overlaid on the UI mockup itself. Clearly separated from the step representation.

### Data & states
- **D-07:** Pre-filled with realistic Colombian user data:
  - Step 1: `manage_debt` purpose selected
  - Step 2: Name "María García", Currency COP
  - Step 3: Income $4,500,000, Expenses $3,200,000, Debts 2
  - Step 4: Tab preview configured for manage_debt purpose
  - Step 5: Account "Bancolombia Ahorros", type Ahorros, balance $1,250,000
  - Step 6: Quick win completion state

### Claude's Discretion
- Exact annotation content per step (Claude audits the real code and surfaces genuine findings)
- CSS styling details within the "high fidelity" constraint
- How annotations are visually styled (cards, sidebars, tooltips)
- Whether to include a summary/scorecard at the end

</decisions>

<specifics>
## Specific Ideas

- Interactive wizard should feel like clicking through the real onboarding — same centered card, same step flow
- Annotations should surface actionable findings, not vague "could be better" notes
- Current code has 6 steps with a single `useState(1)` state machine — walkthrough should reflect this exact structure
- The `getDefaultConfig(purpose)` function customizes dashboard tabs based on purpose selection — step 4 (tab preview) varies by purpose choice

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Onboarding implementation
- `webapp/src/app/onboarding/page.tsx` — Complete 6-step onboarding wizard (single "use client" component with useState-based state machine)
- `webapp/src/app/onboarding/layout.tsx` — Emerald gradient centered layout wrapper
- `webapp/src/actions/onboarding.ts` — `finishOnboarding()` server action: creates account + updates profile + marks onboarding_completed

### Supporting code
- `webapp/src/lib/dashboard-config-defaults.ts` — `getDefaultConfig(purpose)` function that generates tab configuration from purpose selection
- `webapp/src/types/dashboard-config.ts` — DashboardConfig type definition

### Prior phase decisions
- Phase 2 CONTEXT: `estimated_monthly_income` takes priority over `monthly_salary` — onboarding already writes this field
- Phase 4 CONTEXT: CSS animation pattern `animate-in fade-in slide-in-from-right-4 duration-200` — onboarding uses this

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `webapp/src/app/onboarding/page.tsx`: Full 6-step wizard with all form fields, validation, and step transitions — the source of truth for walkthrough content
- `webapp/src/app/onboarding/layout.tsx`: Emerald gradient background styling to replicate
- `webapp/src/lib/dashboard-config-defaults.ts`: Tab configuration logic for step 4 preview

### Established Patterns
- Step structure: each step is a Card with Header (icon + title + description), Content (form fields), and Footer (back/next buttons)
- Progress bar: `w-[${step/6*100}%]` of an emerald background bar
- Animations: `animate-in fade-in slide-in-from-right-4 duration-200` on step transitions
- Analytics: `trackClientEvent` called at each step (not needed in walkthrough)

### Integration Points
- `/onboarding` route is in middleware's public path blacklist
- Dashboard layout checks `profiles.onboarding_completed` flag
- `finishOnboarding()` writes to both `profiles` and `accounts` tables
- `getDefaultConfig(purpose)` in step 4 shows customized tab preview

</code_context>

<deferred>
## Deferred Ideas

- Redesigning the onboarding flow — Phase 8 (Onboarding Redesign)
- Adding new onboarding steps (savings, goals) — Phase 8
- Mobile onboarding experience — depends on RN app rebuild

</deferred>

---

*Phase: 05-onboarding-audit*
*Context gathered: 2026-03-27*

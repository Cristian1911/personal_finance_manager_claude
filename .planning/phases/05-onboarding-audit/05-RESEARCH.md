# Phase 5: Onboarding Audit - Research

**Researched:** 2026-03-27
**Domain:** Static HTML documentation artifact — interactive walkthrough of onboarding wizard
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Interactive wizard — clickable step-by-step navigation that mirrors the real flow. Back/Next buttons advance between steps, showing one step at a time. Progress bar visible.
- **D-02:** Output is a single self-contained `.html` file in `ui-showcases/` — no external dependencies beyond CDN links.
- **D-03:** High fidelity — use Tailwind CSS via CDN + shadcn-like Card/Input/Select/Button styles. Match the real emerald gradient background, progress bar, card layout, and CurrencyInput formatting.
- **D-04:** Not pixel-perfect React — pure HTML/CSS/JS. No Supabase calls, no real form validation. Faithful representation, not a working clone.
- **D-05:** Annotated inline — each step includes callout boxes noting UX concerns, missing fields, friction points, mobile-readiness issues, and positive patterns. Use warnings for concerns and checkmarks for good patterns.
- **D-06:** Annotations appear alongside/below each step, not overlaid on the UI mockup itself. Clearly separated from the step representation.
- **D-07:** Pre-filled with realistic Colombian user data: Step 1: `manage_debt` purpose selected / Step 2: Name "Maria Garcia", Currency COP / Step 3: Income $4,500,000, Expenses $3,200,000, Debts 2 / Step 4: Tab preview configured for manage_debt purpose / Step 5: Account "Bancolombia Ahorros", type Ahorros, balance $1,250,000 / Step 6: Quick win completion state

### Claude's Discretion

- Exact annotation content per step (Claude audits the real code and surfaces genuine findings)
- CSS styling details within the "high fidelity" constraint
- How annotations are visually styled (cards, sidebars, tooltips)
- Whether to include a summary/scorecard at the end

### Deferred Ideas (OUT OF SCOPE)

- Redesigning the onboarding flow — Phase 8 (Onboarding Redesign)
- Adding new onboarding steps (savings, goals) — Phase 8
- Mobile onboarding experience — depends on RN app rebuild
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ONB-01 | HTML/static walkthrough of current onboarding flow for audit review | Source code fully read. All 6 steps documented. UI-SPEC defines visual contract. Annotation topics identified per step. |
</phase_requirements>

---

## Summary

This phase produces a single self-contained HTML file (`ui-showcases/onboarding-walkthrough.html`) that renders the current 6-step onboarding wizard as a clickable interactive mockup for human review. The purpose is to give the user a browser-accessible audit document before any redesign begins in Phase 8.

The onboarding source is a single "use client" React component (`webapp/src/app/onboarding/page.tsx`) with a `useState(1)` state machine. All 6 steps, their fields, validation rules, conditional branches, and copy have been fully read from the source. The UI-SPEC (05-UI-SPEC.md) has been approved and provides the complete visual contract including color tokens, typography, spacing, interaction mechanics, and annotation callout styles.

The implementation domain is vanilla HTML/CSS/JavaScript — no build tools, no React, no Supabase. The file must be openable from `file://` in Chromium. The primary technical challenge is faithfully replicating Zeta's dark design system using CSS custom properties in a `<style>` block, plus a small JS state machine for wizard navigation and tab-swap behavior.

**Primary recommendation:** Implement the entire file in a single task. All design decisions are locked in the UI-SPEC; no research ambiguity remains. The executor reads page.tsx + UI-SPEC, writes the HTML directly.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS CDN | latest (cdn.tailwindcss.com) | Utility classes for layout helpers | CDN play-script version; no build required |
| Lucide icons (unpkg) | latest | Render exact icons from the React source | Matches the source icon set exactly |
| Geist Sans | via fonts.gstatic.com | Match app font | Source uses `--font-geist-sans` |

### Supporting

None — this artifact deliberately has no supporting libraries beyond the three above.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tailwind CDN | Pure inline styles | Tailwind CDN gives utility classes for layout; inline styles handle token-specific values. Mix is fine. |
| Lucide via unpkg | SVG copy-paste | Unpkg gives the full icon set as a JS import; copy-paste is more reliable for a self-contained file in case CDN is unavailable. Either is acceptable. |

**Installation:** No installation. CDN links only in `<head>`.

**Version verification:** Tailwind CDN play-script auto-serves latest. Lucide unpkg can be pinned to `lucide@latest`. No `npm view` needed — no packages installed.

---

## Architecture Patterns

### Output File Location

```
ui-showcases/
└── onboarding-walkthrough.html    # The entire artifact — self-contained
```

### HTML File Structure

```
DOCTYPE html
  head
    CDN: Tailwind, Lucide, Geist font
    style block:
      1. CSS custom properties (design tokens)
      2. Base resets
      3. Layout primitives (page wrapper, card, progress bar)
      4. Component classes (btn, input, select, annotation-box)
      5. Step transition animation
      6. Phone mockup classes
      7. Scorecard grid
  body
    Layout wrapper (emerald gradient)
    div#app:
      Progress section (hidden on step 6)
      Step 1 container + annotation-box
      Step 2 container + annotation-box
      Step 3 container + annotation-box
      Step 4 container + annotation-box
      Step 5 container + annotation-box
      Step 6 container + annotation-box
      Scorecard section
    script block (wizard state machine)
```

### Pattern 1: CSS Custom Property Token Replication

**What:** Declare all Zeta design tokens as CSS custom properties inside a `<style>` block. Verified values from `globals.css`.

**When to use:** Always — this is the foundation for visual fidelity.

**Verified token values (source: `webapp/src/app/globals.css`):**

```
--z-ink:           #0A0E14
--z-surface:       #131720
--z-surface-2:     #1C1F28
--z-surface-3:     #262A34
--z-sage:          #C5BFAE
--z-sage-light:    #D8D2C4
--z-sage-dark:     #9E9888
--z-white:         #F0EDE6
--z-income:        #5CB88A
--z-expense:       #E8875A
--z-alert:         #D4A843
--z-debt:          #E05545
--z-border:        rgba(192, 185, 170, 0.08)
--z-border-strong: rgba(192, 185, 170, 0.14)

Spacing tokens (verified from globals.css):
--z-space-xs: 6px   (NOTE: UI-SPEC says 4px — globals.css is authoritative, use 6px)
--z-space-sm: 8px
--z-space-md: 16px
--z-space-lg: 20px
--z-space-xl: 28px
--z-space-2xl: 40px
--z-space-3xl: 64px

shadcn semantic mappings:
--primary:            var(--z-white)
--primary-foreground: var(--z-ink)
--muted:              var(--z-surface-2)
--muted-foreground:   var(--z-sage-dark)
--card:               var(--z-surface)
--card-foreground:    var(--z-white)
--border:             var(--z-border-strong)
--background:         var(--z-ink)
--foreground:         var(--z-white)
```

### Pattern 2: Wizard State Machine (Vanilla JS)

**What:** A single `currentStep` variable drives `display:block/none` on step divs. No framework required.

The logic mirrors `page.tsx`:
- `nextStep()` increments, enforcing step-level validation
- `prevStep()` decrements, floor at 1
- `showStep(n)` hides all steps, shows step n, updates progress bar
- Progress section is hidden when n === 6 (no progress bar on completion screen)
- `simulateSubmit()` fakes an 800ms loading state on step 5 then advances to step 6

### Pattern 3: Step Transition Animation

**What:** CSS animation matching `animate-in fade-in slide-in-from-right-4 duration-200` from the source.

```css
/* Source: page.tsx applies these Tailwind classes on each step div */
@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateX(16px); }
  to   { opacity: 1; transform: translateX(0); }
}
.step-enter {
  animation: fadeSlideIn 200ms ease forwards;
}
```

Apply `step-enter` class when making a step visible via JavaScript.

### Pattern 4: Tab Swap Logic (Step 4 only)

**What:** Cycles through `TAB_OPTIONS` for phone mockup positions 2 and 3.

Mirrors `page.tsx swapTab()`:
- `TAB_OPTIONS` array has 6 entries (same as source)
- Never assign the same tab ID to both positions 2 and 3 simultaneously
- Pre-filled for `manage_debt`: position 2 = "Deudas" (CreditCard), position 3 = "Presupuesto" (PiggyBank)
- Clicking position 2 or 3 tab button calls `cycleTab(position)` which increments that position's index, skipping entries already used by the other position

### Pattern 5: Simulated Submit (Step 5 Finalizar)

**What:** 800ms fake loading delay per UI-SPEC, then advance to step 6.

Implementation:
- Disable the Finalizar button
- Show spinner + "Guardando..." text
- After 800ms (`setTimeout`), advance to step 6 by calling `showStep(6)`
- No Supabase call, no real data persistence

### Pattern 6: Annotation Callout HTML + CSS

**What:** Below each step card, a styled annotation div surfaces UX findings.

Structure per UI-SPEC:

```
div.annotation-box
  div.annotation-item.concern    (icon + strong label + description)
  div.annotation-item.positive   (icon + strong label + description)
```

CSS values from UI-SPEC:
```
.annotation-box:
  background: color-mix(in srgb, #C5BFAE 6%, transparent)
  border: 1px solid rgba(197, 191, 174, 0.12)
  border-radius: 12px
  padding: 16px
  font-size: 15px
  line-height: 1.6
  margin-top: 16px

.annotation-item:
  margin-bottom: 8px
  color: #D8D2C4

.annotation-item.concern strong:   color: #E8875A
.annotation-item.positive strong:  color: #5CB88A
```

### Anti-Patterns to Avoid

- **Using React/JSX:** Decision D-04 is explicit — pure HTML only.
- **Making Supabase calls:** All form interactions are simulated. No network requests.
- **Multiple HTML files:** Decision D-02 mandates a single `.html` file. All CSS and JS must be inlined within that file.
- **External CSS files:** The existing `ui-showcases/ship-now/styles.css` pattern does NOT apply here — D-02 requires self-contained.
- **Inventing steps:** Only replicate the 6 steps present in `page.tsx`. Do not add or remove steps.
- **Modifying onboarding source:** This phase is read-only relative to `webapp/src/app/onboarding/`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab swap deduplication | Custom dedup logic | Direct port of `page.tsx swapTab()` | Source logic already handles the case; exact port avoids divergence |
| Color values | Guessing from screenshots | Read from `globals.css` directly | Hex values already verified — use them verbatim |
| Copy strings | Paraphrasing | Copy verbatim from `page.tsx` and UI-SPEC copywriting contract | Annotation fidelity requires exact copy |
| Font loading | System fallback | CDN link to Geist Sans | Source uses Geist Sans; fallback would diverge visually |

**Key insight:** Everything needed is already in the source. The executor's job is faithful transcription + UX annotation, not design invention.

---

## Current Onboarding Flow — Complete Source Map

This section documents the exact current implementation so the planner can build tasks without re-reading source files.

### Step Structure (from `page.tsx`)

| Step | Title | Fields | Validation | Conditional |
|------|-------|--------|------------|-------------|
| 1 | "Bienvenido a Zeta" | Purpose selection (4 options) | `purpose` required | None |
| 2 | "Tu perfil" | Full name (text), Currency (select) | `fullName` required | None |
| 3 | "Pulso mensual" | Income (CurrencyInput), Expenses (CurrencyInput), Debt count (number) | `income` + `expenses` required | Debt count input only when `purpose === 'manage_debt'`; budget hint shown when `incomeNumber > 0` |
| 4 | "Tu app" | Phone mockup with swappable tabs | None | Loads `getDefaultConfig(purpose)` on mount |
| 5 | "Primera cuenta" | Account name (text), Account type (select), Balance (CurrencyInput) | `accountName` + `balance` required | Button label is "Finalizar" not "Siguiente"; triggers `onSubmit()` which calls `finishOnboarding()` then advances to step 6 |
| 6 | "Listo, {firstName}!" | Quick win CTAs | None | `QUICK_WIN[purpose]` determines primary CTA label and href |

### Progress Bar Behavior

- Displayed on steps 1 through 5, hidden on step 6
- Width: `(step / 6) * 100%`
- Text left: "Onboarding Zeta", text right: "Paso {N} de 6"
- Fill color: `--z-white` = `#F0EDE6`
- Track color: `--z-surface-2` = `#1C1F28`

### Layout Wrapper (from `layout.tsx`)

```
background: linear-gradient(to bottom, #ecfdf5 0%, #0A0E14 30%, #0A0E14 100%)
min-height: 100vh
display: flex; flex-direction: column; align-items: center; justify-content: center
padding: 16px (mobile) / 24px (md) / 32px (lg)
Card container: max-w-lg = 512px, w-full
```

### getDefaultConfig Output for `manage_debt` (from `dashboard-config-defaults.ts`)

- Tab position 2: `{ id: 'debt-recurring', label: 'Deudas', icon: 'CreditCard' }`
- Tab position 3: `{ id: 'presupuesto', label: 'Presupuesto', icon: 'PiggyBank' }`

### QUICK_WIN Map (from `page.tsx`)

| Purpose | CTA Label | href in HTML artifact |
|---------|-----------|----------------------|
| manage_debt | "Importa tu primer extracto" | # |
| track_spending | "Registra tu primer gasto" | # |
| save_money | "Configura tu primer presupuesto" | # |
| improve_habits | "Registra tu primer gasto" | # |

### Step 6 Success Icon

`CheckCircle2` lucide icon, size 40px, color `#5CB88A`, inside a circle:
`height: 64px; width: 64px; border-radius: 50%; background: color-mix(in srgb, #5CB88A 10%, transparent)`

---

## Annotation Topics (Pre-Audited from Source)

These are genuine UX findings from reading `page.tsx`. The executor uses these as a starting point and may elaborate further.

### Step 1 — Objetivo
- Good: Purpose selection uses clear benefit-language labels ("Salir de deudas" not "Debt management mode")
- Good: Radio-button semantics (re-click does not deselect) — reduces accidental deselection
- Concern: No skip option — users who do not know their goal cannot proceed without choosing
- Concern: Purpose choice silently controls step 3 (debt count visibility), step 4 (tab preview), and step 6 (quick win CTA) — no visible indication to the user that this choice has downstream effects

### Step 2 — Tu perfil
- Concern: Currency defaults to `USD` not `COP` — Colombian users will see the wrong default
- Concern: Only first name is used (step 6 greeting uses `fullName.split(" ")[0]`) — surname collected but unused
- Concern: Timezone captured silently via `Intl.DateTimeFormat()` — user is not informed or given control
- Good: Currency choices include COP, MXN, BRL — regionally appropriate

### Step 3 — Pulso mensual
- Good: "Disponible para presupuesto" live calculation gives immediate value — first moment the app shows it working
- Good: Debt count field is purpose-conditional — only shown for `manage_debt`, reducing form length
- Concern: Debt count is collected but discarded — it is NOT passed to `finishOnboarding()`, only used for the inline confirmation message
- Concern: `availableToBudget` uses `Math.max(income - expenses, 0)` — if expenses exceed income, the hint reads "Disponible para presupuesto: 0" with no warning
- Concern: No salary vs. irregular income distinction; no hint about what "estimated" means

### Step 4 — Tu app
- Concern: If user goes back to step 1 and changes purpose then returns to step 4, `dashboardConfig` is NOT regenerated (guarded by `!dashboardConfig` in the effect) — tab preview may reflect stale purpose
- Concern: Phone mockup inner screen shows only placeholder "Tu dashboard" text — no preview of actual content
- Concern: Interactive tab affordance is weak — only a text hint, no visual "tap me" indicator
- Good: Tab customization in onboarding is a differentiator — personalizing the app before first use increases perceived value

### Step 5 — Primera cuenta
- Concern: Account type defaults to `CHECKING` ("Corriente") — Colombian users more commonly have Ahorros as primary
- Concern: No multi-account entry in onboarding — users with multiple accounts must add them post-onboarding
- Concern: Balance is a required non-empty string; typing "0" enables the button but `parseFloat("0") || 0` = 0, which is a valid balance — this edge case is subtle
- Good: Starting onboarding with one real account grounds the user in actual data from day 1

### Step 6 — Quick win
- Good: Purpose-aware quick win CTA creates continuity between stated goal and first action
- Good: "Explorar primero" secondary CTA respects users who want to look around first
- Concern: "Explorar primero" routes to `/dashboard` — if user has no transactions, empty-state widgets may feel deflating immediately after the success screen
- Concern: No progress bar on step 6 — correct per source, but the visual jump may feel abrupt

---

## Common Pitfalls

### Pitfall 1: Tailwind CDN in File Protocol

**What goes wrong:** Tailwind CDN play-script (`cdn.tailwindcss.com`) may fail on `file://` due to restrictions in some Chromium versions.

**Why it happens:** Some CDN scripts use ES module imports that Chromium restricts on local filesystem.

**How to avoid:** Use the `<style>` block with CSS custom properties and hand-written classes for all structurally critical rules. Use Tailwind CDN only as a utility supplement. If CDN fails silently, the file still looks correct.

**Warning signs:** Page renders with no Tailwind utilities. Always test by opening the file with `file://` in Chrome before calling work done.

### Pitfall 2: Token Discrepancy Between UI-SPEC and globals.css

**What goes wrong:** UI-SPEC Spacing Scale lists `xs = 4px` but `globals.css` defines `--z-space-xs: 6px`.

**Why it happens:** UI-SPEC was authored from memory; globals.css is the authoritative source.

**How to avoid:** Use `6px` for `--z-space-xs`. The UI-SPEC states values are inherited from `--z-space-*` tokens — defer to globals.css.

**Authoritative value:** `--z-space-xs: 6px` (verified: `webapp/src/app/globals.css` line 130).

### Pitfall 3: Lucide Icons CDN Dependency

**What goes wrong:** If the browser has no internet connection, lucide icons from unpkg will not render.

**How to avoid:** Either use inline SVG for the 8-10 required icons (zero CDN dependency), or document that internet access is needed. Given this is a human-review artifact, CDN dependency is acceptable — add a comment in the HTML.

### Pitfall 4: Tab Swap Deduplication Bug

**What goes wrong:** The tab swap JS must never select the same tab ID for positions 2 and 3 simultaneously.

**Why it happens:** Naive index increment without deduplication can land on the same config for both positions.

**How to avoid:** Mirror `page.tsx swapTab()` exactly: after incrementing the index, loop forward while the new entry's ID matches the other position's current ID.

### Pitfall 5: Progress Bar Hidden on Step 6

**What goes wrong:** Progress bar must not appear on step 6. Source condition is `step < 6`. Forgetting this makes the completion screen look like an intermediate step.

**How to avoid:** Set `progressSection.style.display = 'none'` explicitly in `showStep(6)`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| External CSS file (ship-now pattern) | Self-contained `<style>` block in single HTML | Phase 5 D-02 | Simpler — file opens with no adjacent files |
| Steps in order Profile(3), Finanzas(2) | Current order: Profile(2), Finanzas(3) | Prior codebase | Walkthrough must match current order; source comments confirm the swap |

**Deprecated/outdated:**
- `monthly_salary` field: onboarding now writes `estimated_monthly_income` (Phase 2 decision). Annotations should reference the current field name.

---

## Open Questions

1. **Annotation depth per step**
   - What we know: Topics are identified for all 6 steps (see above).
   - What's unclear: Target 2-4 per step or all findings?
   - Recommendation: 2-4 per step. Prioritize highest-impact findings. Scorecard consolidates the rest.

2. **Scorecard bullet content**
   - What we know: UI-SPEC resolved to include it (Claude's Discretion). 3-column structure defined.
   - What's unclear: Exact bullets depend on full audit pass.
   - Recommendation: Executor derives bullets from per-step annotations. Do not invent.

3. **Tailwind CDN reliability on `file://`**
   - Recommendation: Ensure `<style>` block contains all structurally critical rules. CDN is a supplement.

---

## Environment Availability

Step 2.6 SKIPPED — this phase produces a static HTML file. No external tools, databases, or runtimes are required beyond a modern browser.

---

## Validation Architecture

> `nyquist_validation: true` in `.planning/config.json` — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (available in `packages/shared/`) |
| Webapp test script | Not configured — `webapp/package.json` has no `"test"` script |
| Quick run command | `cd packages/shared && pnpm test` |
| Full suite command | `cd packages/shared && pnpm test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| ONB-01 | HTML file exists at `ui-showcases/onboarding-walkthrough.html` | manual | `test -f ui-showcases/onboarding-walkthrough.html && echo PASS` | Not yet — Wave 0 creates it |
| ONB-01 | All 6 steps present in the file | structural grep | `grep -c 'id="step-[1-6]"' ui-showcases/onboarding-walkthrough.html` — must output 6 | Not yet |
| ONB-01 | All required copy strings present | structural grep | `grep -c 'Bienvenido a Zeta\|Tu perfil\|Pulso mensual\|Tu app\|Primera cuenta\|Listo' ui-showcases/onboarding-walkthrough.html` — must output 6 | Not yet |
| ONB-01 | File opens in browser and all 6 steps are clickable | manual | Open in Chrome, click through all 6 steps | Not yet |

**Note:** ONB-01 is a documentation artifact. Primary validation is human review. Structural greps above are sanity checks, not unit tests.

### Sampling Rate

- **Per task commit:** Run structural grep checks
- **Per wave merge:** Manual browser review — open file, click all 6 steps, verify annotations, verify tab swap in step 4
- **Phase gate:** Full browser walkthrough confirmed before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `ui-showcases/onboarding-walkthrough.html` — the entire deliverable; created in Wave 0/the single implementation task

*(No test framework gaps — this phase has no unit tests to configure.)*

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies To This Phase |
|-----------|-----------------------|
| Spanish-first UI — all user-facing strings in Spanish | Yes — all HTML copy must match source (already in Spanish per copywriting contract in UI-SPEC) |
| Package manager: pnpm | Not applicable — no packages installed in this phase |
| Build gates: `pnpm build` must pass | Run webapp build as a sanity gate to confirm no accidental webapp file changes occurred |
| GSD workflow enforcement | Meta — covered by this planning flow |
| No AI / deterministic rules | Not applicable — static document |
| Tech stack locked | Compliant — static HTML file is outside the webapp; no stack changes |

---

## Sources

### Primary (HIGH confidence)

- `webapp/src/app/onboarding/page.tsx` — Complete 6-step wizard source; all fields, validation, copy, and conditional logic verified by direct read
- `webapp/src/app/onboarding/layout.tsx` — Background gradient and layout wrapper verified
- `webapp/src/lib/dashboard-config-defaults.ts` — `getDefaultConfig(purpose)` output for all 4 purposes verified
- `webapp/src/types/dashboard-config.ts` — DashboardConfig, TabConfig, AppPurpose type definitions
- `webapp/src/app/globals.css` — All design token hex values and spacing values verified
- `.planning/phases/05-onboarding-audit/5-CONTEXT.md` — All locked decisions D-01 through D-07
- `.planning/phases/05-onboarding-audit/05-UI-SPEC.md` — Full visual contract, copywriting contract, interaction contract, annotation callout spec (status: approved)

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — ONB-01 definition confirmed
- `.planning/STATE.md` — Phase 5 is "Ready to plan", UI-SPEC approved

### Tertiary (LOW confidence)

None — all claims are grounded in direct source code reads.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — CDN URLs are well-known; no package versions to verify
- Architecture: HIGH — Source code fully read; no ambiguity about what to replicate
- Pitfalls: HIGH — Verified from source (file:// CDN, token discrepancy, tab dedup logic)
- Annotation content: MEDIUM — Pre-audited from source; executor may surface additional findings

**Research date:** 2026-03-27
**Valid until:** No expiry — targets a static artifact from locked source code. Onboarding source should not change before implementation.
